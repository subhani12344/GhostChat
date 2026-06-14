const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

let pool = null;
let usePostgres = false;
const JSON_DB_PATH = path.join(__dirname, 'database.json');

// Initial local JSON structure
const initialJsonDb = {
  users: [],
  bans: [],
  reports: [],
  feedbacks: [],
  otp_verifications: []
};

// Load JSON DB
function readJsonDb() {
  try {
    if (!fs.existsSync(JSON_DB_PATH)) {
      fs.writeFileSync(JSON_DB_PATH, JSON.stringify(initialJsonDb, null, 2));
      return initialJsonDb;
    }
    const data = fs.readFileSync(JSON_DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    // Ensure nested array exists for backwards compatibility
    if (!parsed.otp_verifications) {
      parsed.otp_verifications = [];
    }
    return parsed;
  } catch (err) {
    console.error('Error reading local JSON database:', err);
    return initialJsonDb;
  }
}

// Write JSON DB
function writeJsonDb(data) {
  try {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing to local JSON database:', err);
  }
}

// Initialize DB
async function initDb() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const pgHost = process.env.PGHOST;

  if (dbUrl || pgHost) {
    try {
      console.log('🔌 Connecting to PostgreSQL...');
      pool = new Pool(dbUrl ? { connectionString: dbUrl } : {
        host: process.env.PGHOST,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        port: parseInt(process.env.PGPORT || '5432', 10),
        ssl: { rejectUnauthorized: false }
      });

      // Quick query to test connection
      await pool.query('SELECT NOW()');
      usePostgres = true;
      console.log('✅ Connected to PostgreSQL successfully!');

      // Create Tables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS bans (
          id SERIAL PRIMARY KEY,
          target VARCHAR(100) UNIQUE NOT NULL, -- IP or Username
          reason TEXT NOT NULL,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS reports (
          id SERIAL PRIMARY KEY,
          reporter_ip VARCHAR(50),
          reported_ip VARCHAR(50),
          reporter_username VARCHAR(50),
          reported_username VARCHAR(50),
          reason VARCHAR(100) NOT NULL,
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS feedbacks (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          email VARCHAR(100) NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS otp_verifications (
          id SERIAL PRIMARY KEY,
          email VARCHAR(100) UNIQUE NOT NULL,
          username VARCHAR(50) NOT NULL,
          password VARCHAR(255) NOT NULL,
          otp_code VARCHAR(6) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          resend_count INTEGER DEFAULT 0,
          locked_until TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('📐 PostgreSQL tables verified.');
    } catch (err) {
      console.warn('⚠️ PostgreSQL connection failed. Falling back to local JSON database.', err.message);
      usePostgres = false;
    }
  } else {
    console.log('📁 No PostgreSQL config environment variables found. Using local JSON database (database.json).');
    usePostgres = false;
    readJsonDb();
  }
}

// Database Actions
const db = {
  // --- USERS ---
  async getUserByUsername(username) {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      return res.rows[0];
    } else {
      const data = readJsonDb();
      return data.users.find(u => u.username === username);
    }
  },

  async getUserByEmail(email) {
    // For registration check
    if (usePostgres) {
      // In PostgreSQL we didn't add email to users initially, so we check otp_verifications and mock if unlisted
      const res = await pool.query('SELECT * FROM otp_verifications WHERE email = $1', [email]);
      return res.rows.length > 0;
    } else {
      const data = readJsonDb();
      // Since user profiles only have username, we check verification logs to prevent duplicate email accounts
      const inOtp = data.otp_verifications.find(o => o.email === email);
      return !!inOtp;
    }
  },

  async createUser(username, hashedPassword, role = 'user') {
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *',
        [username, hashedPassword, role]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const newUser = {
        id: data.users.length + 1,
        username,
        password: hashedPassword,
        role,
        created_at: new Date().toISOString()
      };
      data.users.push(newUser);
      writeJsonDb(data);
      return newUser;
    }
  },

  // --- OTP VERIFICATION FLOW ---
  async getOtpVerification(email) {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM otp_verifications WHERE email = $1', [email]);
      return res.rows[0];
    } else {
      const data = readJsonDb();
      return data.otp_verifications.find(o => o.email === email);
    }
  },

  async createOtpVerification(email, username, passwordHash, otpCode, expiresAt) {
    if (usePostgres) {
      const res = await pool.query(`
        INSERT INTO otp_verifications (email, username, password, otp_code, expires_at, resend_count, locked_until)
        VALUES ($1, $2, $3, $4, $5, 0, NULL)
        ON CONFLICT (email) 
        DO UPDATE SET username = $2, password = $3, otp_code = $4, expires_at = $5, resend_count = 0, locked_until = NULL
        RETURNING *
      `, [email, username, passwordHash, otpCode, expiresAt]);
      return res.rows[0];
    } else {
      const data = readJsonDb();
      data.otp_verifications = data.otp_verifications.filter(o => o.email !== email);
      const newOtp = {
        id: data.otp_verifications.length + 1,
        email,
        username,
        password: passwordHash,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        resend_count: 0,
        locked_until: null,
        created_at: new Date().toISOString()
      };
      data.otp_verifications.push(newOtp);
      writeJsonDb(data);
      return newOtp;
    }
  },

  async updateOtpVerification(email, otpCode, expiresAt, resendCount, lockedUntil) {
    const lockedUntilStr = lockedUntil ? lockedUntil.toISOString() : null;
    if (usePostgres) {
      const res = await pool.query(`
        UPDATE otp_verifications
        SET otp_code = $2, expires_at = $3, resend_count = $4, locked_until = $5
        WHERE email = $1
        RETURNING *
      `, [email, otpCode, expiresAt, resendCount, lockedUntil]);
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const idx = data.otp_verifications.findIndex(o => o.email === email);
      if (idx !== -1) {
        data.otp_verifications[idx].otp_code = otpCode;
        data.otp_verifications[idx].expires_at = expiresAt.toISOString();
        data.otp_verifications[idx].resend_count = resendCount;
        data.otp_verifications[idx].locked_until = lockedUntilStr;
        writeJsonDb(data);
        return data.otp_verifications[idx];
      }
      return null;
    }
  },

  async deleteOtpVerification(email) {
    if (usePostgres) {
      await pool.query('DELETE FROM otp_verifications WHERE email = $1', [email]);
    } else {
      const data = readJsonDb();
      data.otp_verifications = data.otp_verifications.filter(o => o.email !== email);
      writeJsonDb(data);
    }
  },

  // --- BANS ---
  async isBanned(target) {
    if (usePostgres) {
      const res = await pool.query(
        'SELECT * FROM bans WHERE target = $1 AND (expires_at IS NULL OR expires_at > NOW())',
        [target]
      );
      return res.rows.length > 0 ? res.rows[0] : null;
    } else {
      const data = readJsonDb();
      const ban = data.bans.find(b => b.target === target);
      if (!ban) return null;

      if (ban.expires_at) {
        const isExpired = new Date(ban.expires_at) < new Date();
        if (isExpired) {
          // Clean up expired ban
          data.bans = data.bans.filter(b => b.target !== target);
          writeJsonDb(data);
          return null;
        }
      }
      return ban;
    }
  },

  async createBan(target, reason, expires_at = null) {
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO bans (target, reason, expires_at) VALUES ($1, $2, $3) ON CONFLICT (target) DO UPDATE SET reason = $2, expires_at = $3 RETURNING *',
        [target, reason, expires_at]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      // Remove existing ban if present
      data.bans = data.bans.filter(b => b.target !== target);
      const newBan = {
        id: data.bans.length + 1,
        target,
        reason,
        expires_at: expires_at ? new Date(expires_at).toISOString() : null,
        created_at: new Date().toISOString()
      };
      data.bans.push(newBan);
      writeJsonDb(data);
      return newBan;
    }
  },

  // --- REPORTS ---
  async createReport({ reporter_ip, reported_ip, reporter_username, reported_username, reason, details }) {
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO reports (reporter_ip, reported_ip, reporter_username, reported_username, reason, details) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [reporter_ip, reported_ip, reporter_username, reported_username, reason, details]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const newReport = {
        id: data.reports.length + 1,
        reporter_ip,
        reported_ip,
        reporter_username,
        reported_username,
        reason,
        details,
        created_at: new Date().toISOString()
      };
      data.reports.push(newReport);
      writeJsonDb(data);
      return newReport;
    }
  },

  async getReportsCount() {
    if (usePostgres) {
      const res = await pool.query('SELECT count(*) FROM reports');
      return parseInt(res.rows[0].count, 10);
    } else {
      const data = readJsonDb();
      return data.reports.length;
    }
  },

  async getBansCount() {
    if (usePostgres) {
      const res = await pool.query('SELECT count(*) FROM bans');
      return parseInt(res.rows[0].count, 10);
    } else {
      const data = readJsonDb();
      return data.bans.length;
    }
  },

  // --- FEEDBACK / DATA DELETION REQUESTS ---
  async createFeedback(name, email, message) {
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO feedbacks (name, email, message) VALUES ($1, $2, $3) RETURNING *',
        [name, email, message]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const newFeedback = {
        id: data.feedbacks.length + 1,
        name,
        email,
        message,
        created_at: new Date().toISOString()
      };
      data.feedbacks.push(newFeedback);
      writeJsonDb(data);
      return newFeedback;
    }
  }
};

module.exports = {
  db,
  initDb
};
