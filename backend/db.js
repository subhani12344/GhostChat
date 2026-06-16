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
  ip_bans: [],
  reports: [],
  feedbacks: [],
  otp_verifications: [],
  followers: [],
  notifications: [],
  anon_counter: { next: 1 },
  admin_users: [],
  admin_sessions: [],
  audit_logs: [],
  contact_inquiries: [],
  contact_replies: [],
  deletion_requests: []
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
    // Ensure nested arrays exist for backwards compatibility
    if (!parsed.otp_verifications) parsed.otp_verifications = [];
    if (!parsed.followers) parsed.followers = [];
    if (!parsed.notifications) parsed.notifications = [];
    if (!parsed.ip_bans) parsed.ip_bans = [];
    if (!parsed.anon_counter) parsed.anon_counter = { next: 1 };
    if (!parsed.admin_users) parsed.admin_users = [];
    if (!parsed.admin_sessions) parsed.admin_sessions = [];
    if (!parsed.audit_logs) parsed.audit_logs = [];
    if (!parsed.contact_inquiries) parsed.contact_inquiries = [];
    if (!parsed.contact_replies) parsed.contact_replies = [];
    if (!parsed.deletion_requests) parsed.deletion_requests = [];
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

// Generate a random 22-character password
function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+=-[]{}|;:,.<>?';
  const crypto = require('crypto');
  let password = '';
  for (let i = 0; i < 22; i++) {
    password += chars[crypto.randomInt(0, chars.length)];
  }
  return password;
}

// Seed the 5 default Super Administrators
async function seedAdminUsers() {
  const bcrypt = require('bcryptjs');
  console.log('🚀 Setting up 5 default Super Administrators...');
  const credentials = [];
  
  for (let i = 1; i <= 5; i++) {
    const username = `superadmin_${i}`;
    const email = `superadmin_${i}@ghostchat.local`;
    const password = `GhostAdmin_${i}#2026`;
    const password_hash = await bcrypt.hash(password, 10);
    credentials.push({ username, password });

    if (usePostgres) {
      await pool.query(
        `INSERT INTO admin_users (username, email, password_hash, role, is_active, password_changed)
         VALUES ($1, $2, $3, $4, TRUE, FALSE)
         ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
        [username, email, password_hash, 'super_admin']
      );
    } else {
      const data = readJsonDb();
      const idx = data.admin_users.findIndex(a => a.username === username);
      if (idx !== -1) {
        data.admin_users[idx].password_hash = password_hash;
        writeJsonDb(data);
      } else {
        const newAdmin = {
          id: data.admin_users.length + 1,
          username,
          email,
          password_hash,
          role: 'super_admin',
          twofa_secret: null,
          twofa_enabled: false,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_login: null,
          login_attempts: 0,
          locked_until: null,
          ip_whitelist: null,
          device_fingerprints: null,
          password_changed: false
        };
        data.admin_users.push(newAdmin);
        writeJsonDb(data);
      }
    }
  }

  console.log(`
┌───────────────────────────────────────────────────────────────────┐
│                    🔑 GHOSTCHAT SUPERADMIN SETUP                  │
├───────────────────────────────────────────────────────────────────┤
│  Username: superadmin_1   |   Password: ${credentials[0].password}  │
│  Username: superadmin_2   |   Password: ${credentials[1].password}  │
│  Username: superadmin_3   |   Password: ${credentials[2].password}  │
│  Username: superadmin_4   |   Password: ${credentials[3].password}  │
│  Username: superadmin_5   |   Password: ${credentials[4].password}  │
├───────────────────────────────────────────────────────────────────┤
│  ⚠️  COPY THESE NOW. Password change is required on first login. │
└───────────────────────────────────────────────────────────────────┘
`);
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
          email VARCHAR(100) UNIQUE,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'user',
          deletion_hold_until TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure existing database has the email and hold columns
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(100) UNIQUE;
      `);
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_hold_until TIMESTAMP;
      `);
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
      `);
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
      `);
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_img TEXT;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS followers (
          id SERIAL PRIMARY KEY,
          follower_username VARCHAR(50) NOT NULL,
          following_username VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(follower_username, following_username)
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          recipient_username VARCHAR(50) NOT NULL,
          sender_username VARCHAR(50) NOT NULL,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'unread',
          details TEXT,
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

      // IP/device/fingerprint bans for anonymous users
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ip_bans (
          id SERIAL PRIMARY KEY,
          target_type VARCHAR(30) NOT NULL, -- 'ip', 'device', 'fingerprint'
          target_value VARCHAR(500) NOT NULL,
          reason TEXT,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(target_type, target_value)
        );
      `);

      // Anonymous sequential ID counter
      await pool.query(`
        CREATE TABLE IF NOT EXISTS anon_counter (
          id INTEGER PRIMARY KEY DEFAULT 1,
          next_num INTEGER DEFAULT 1,
          CHECK (id = 1)
        );
      `);
      await pool.query(`INSERT INTO anon_counter (id, next_num) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;`);

      // Progressive moderation columns on users
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMP;`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lifetime_reports INTEGER DEFAULT 0;`);

      // Admin Panel specific tables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          twofa_secret VARCHAR(255),
          twofa_enabled BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          login_attempts INT DEFAULT 0,
          locked_until TIMESTAMP,
          ip_whitelist TEXT,
          device_fingerprints TEXT,
          password_changed BOOLEAN DEFAULT FALSE
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_sessions (
          id SERIAL PRIMARY KEY,
          admin_id INTEGER NOT NULL,
          access_token_hash VARCHAR(255),
          refresh_token_hash VARCHAR(255),
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ip_address VARCHAR(50),
          user_agent TEXT,
          device_fingerprint VARCHAR(255),
          is_active BOOLEAN DEFAULT TRUE
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          admin_id INTEGER,
          admin_username VARCHAR(50),
          admin_role VARCHAR(50),
          ip_address VARCHAR(50),
          user_agent TEXT,
          device_fingerprint VARCHAR(255),
          action_type VARCHAR(100) NOT NULL,
          target_type VARCHAR(50),
          target_id VARCHAR(50),
          previous_value TEXT,
          new_value TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS contact_inquiries (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          username VARCHAR(50),
          category VARCHAR(50),
          subject VARCHAR(255),
          message TEXT,
          priority VARCHAR(20) DEFAULT 'medium',
          status VARCHAR(20) DEFAULT 'new',
          assigned_to INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS contact_replies (
          id SERIAL PRIMARY KEY,
          inquiry_id INTEGER REFERENCES contact_inquiries(id) ON DELETE CASCADE,
          admin_id INTEGER,
          reply TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS deletion_requests (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          username VARCHAR(50),
          reason TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP,
          resolved_by INTEGER
        );
      `);

      // Seed 5 Super Administrators
      await seedAdminUsers();

      console.log('📐 PostgreSQL and Admin tables verified.');
    } catch (err) {
      console.warn('⚠️ PostgreSQL connection failed. Falling back to local JSON database.', err.message);
      usePostgres = false;
      await seedAdminUsers();
    }
  } else {
    console.log('📁 No PostgreSQL config environment variables found. Using local JSON database (database.json).');
    usePostgres = false;
    readJsonDb();
    await seedAdminUsers();
  }
}

// Database Actions
const db = {
  // --- USERS ---
  async getUserByUsername(username) {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
      const user = res.rows[0];
      if (user) {
        const pruned = await db.pruneExpiredDeletion(user);
        if (pruned) return null;
      }
      return user;
    } else {
      const data = readJsonDb();
      const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (user) {
        const pruned = await db.pruneExpiredDeletion(user);
        if (pruned) return null;
      }
      return user;
    }
  },

  async getUserByEmail(email) {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      const user = res.rows[0];
      if (user) {
        const pruned = await db.pruneExpiredDeletion(user);
        if (pruned) return null;
      }
      return user;
    } else {
      const data = readJsonDb();
      const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user) {
        const pruned = await db.pruneExpiredDeletion(user);
        if (pruned) return null;
      }
      return user;
    }
  },

  async createUser(username, email, hashedPassword, role = 'user') {
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO users (username, email, password, role, deletion_hold_until) VALUES ($1, $2, $3, $4, NULL) RETURNING *',
        [username, email, hashedPassword, role]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const newUser = {
        id: data.users.length + 1,
        username,
        email,
        password: hashedPassword,
        role,
        deletion_hold_until: null,
        nickname: '',
        bio: '',
        profile_img: '',
        created_at: new Date().toISOString()
      };
      data.users.push(newUser);
      writeJsonDb(data);
      return newUser;
    }
  },

  async deleteUser(username) {
    if (usePostgres) {
      await pool.query('DELETE FROM users WHERE username = $1', [username]);
      // Prune reports and bans associated
      await pool.query('DELETE FROM reports WHERE reported_username = $1', [username]);
      await pool.query('DELETE FROM bans WHERE target = $1', [username]);
    } else {
      const data = readJsonDb();
      data.users = data.users.filter(u => u.username !== username);
      data.reports = data.reports.filter(r => r.reported_username !== username);
      data.bans = data.bans.filter(b => b.target !== username);
      writeJsonDb(data);
    }
  },

  async executeUserDeletion(username) {
    if (usePostgres) {
      await pool.query('DELETE FROM followers WHERE follower_username = $1 OR following_username = $1', [username]);
      await pool.query('DELETE FROM notifications WHERE recipient_username = $1 OR sender_username = $1', [username]);
    } else {
      const data = readJsonDb();
      data.followers = data.followers.filter(f => f.follower_username !== username && f.following_username !== username);
      data.notifications = data.notifications.filter(n => n.recipient_username !== username && n.sender_username !== username);
      writeJsonDb(data);
    }
    await db.deleteUser(username);
  },

  async setUserDeletionHold(username, holdUntil) {
    const holdUntilStr = holdUntil ? holdUntil.toISOString() : null;
    if (usePostgres) {
      await pool.query('UPDATE users SET deletion_hold_until = $2 WHERE LOWER(username) = LOWER($1)', [username, holdUntil]);
    } else {
      const data = readJsonDb();
      const idx = data.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
      if (idx !== -1) {
        data.users[idx].deletion_hold_until = holdUntilStr;
        writeJsonDb(data);
      }
    }
  },

  async pruneExpiredDeletion(user) {
    if (user && user.deletion_hold_until) {
      const holdDate = new Date(user.deletion_hold_until);
      if (holdDate < new Date()) {
        await db.deleteUser(user.username);
        return true;
      }
    }
    return false;
  },

  async getReportsCountForUser(username) {
    if (usePostgres) {
      const res = await pool.query('SELECT count(*) FROM reports WHERE reported_username = $1', [username]);
      return parseInt(res.rows[0].count, 10);
    } else {
      const data = readJsonDb();
      return data.reports.filter(r => r.reported_username === username).length;
    }
  },

  // --- OTP VERIFICATION FLOW ---
  async getOtpVerification(email) {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM otp_verifications WHERE LOWER(email) = LOWER($1)', [email]);
      return res.rows[0];
    } else {
      const data = readJsonDb();
      return data.otp_verifications.find(o => o.email.toLowerCase() === email.toLowerCase());
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
      data.otp_verifications = data.otp_verifications.filter(o => o.email.toLowerCase() !== email.toLowerCase());
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
        WHERE LOWER(email) = LOWER($1)
        RETURNING *
      `, [email, otpCode, expiresAt, resendCount, lockedUntil]);
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const idx = data.otp_verifications.findIndex(o => o.email.toLowerCase() === email.toLowerCase());
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
      await pool.query('DELETE FROM otp_verifications WHERE LOWER(email) = LOWER($1)', [email]);
    } else {
      const data = readJsonDb();
      data.otp_verifications = data.otp_verifications.filter(o => o.email.toLowerCase() !== email.toLowerCase());
      writeJsonDb(data);
    }
  },

  // --- BANS ---
  async isBanned(target) {
    if (usePostgres) {
      const res = await pool.query(
        'SELECT * FROM bans WHERE LOWER(target) = LOWER($1) AND (expires_at IS NULL OR expires_at > NOW())',
        [target]
      );
      return res.rows.length > 0 ? res.rows[0] : null;
    } else {
      const data = readJsonDb();
      const ban = data.bans.find(b => b.target.toLowerCase() === target.toLowerCase());
      if (!ban) return null;

      if (ban.expires_at) {
        const isExpired = new Date(ban.expires_at) < new Date();
        if (isExpired) {
          // Clean up expired ban
          data.bans = data.bans.filter(b => b.target.toLowerCase() !== target.toLowerCase());
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
      data.bans = data.bans.filter(b => b.target.toLowerCase() !== target.toLowerCase());
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

  async deleteBan(target) {
    if (usePostgres) {
      await pool.query('DELETE FROM bans WHERE LOWER(target) = LOWER($1)', [target]);
    } else {
      const data = readJsonDb();
      data.bans = data.bans.filter(b => b.target.toLowerCase() !== target.toLowerCase());
      writeJsonDb(data);
    }
  },

  async unsuspendUser(username) {
    if (usePostgres) {
      await pool.query('UPDATE users SET suspended_until = NULL WHERE LOWER(username) = LOWER($1)', [username]);
    } else {
      const data = readJsonDb();
      const idx = data.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
      if (idx !== -1) {
        data.users[idx].suspended_until = null;
        writeJsonDb(data);
      }
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
  },

  // --- PROFILE UPDATES ---
  async updateUserProfile(username, nickname, bio, profile_img) {
    if (usePostgres) {
      const res = await pool.query(
        'UPDATE users SET nickname = $2, bio = $3, profile_img = $4 WHERE LOWER(username) = LOWER($1) RETURNING *',
        [username, nickname, bio, profile_img]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const idx = data.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
      if (idx !== -1) {
        data.users[idx].nickname = nickname || '';
        data.users[idx].bio = bio || '';
        data.users[idx].profile_img = profile_img || '';
        writeJsonDb(data);
        return data.users[idx];
      }
      return null;
    }
  },

  // --- FOLLOW SYSTEM ---
  async getFollowRelationship(follower, following) {
    if (usePostgres) {
      const res = await pool.query(
        'SELECT * FROM followers WHERE follower_username = $1 AND following_username = $2',
        [follower, following]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      return data.followers.find(f => f.follower_username === follower && f.following_username === following);
    }
  },

  async sendFollowRequest(follower, following) {
    const status = 'pending';
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO followers (follower_username, following_username, status) VALUES ($1, $2, $3) ON CONFLICT (follower_username, following_username) DO UPDATE SET status = EXCLUDED.status RETURNING *',
        [follower, following, status]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      let f = data.followers.find(x => x.follower_username === follower && x.following_username === following);
      if (f) {
        f.status = status;
      } else {
        f = {
          id: data.followers.length + 1,
          follower_username: follower,
          following_username: following,
          status,
          created_at: new Date().toISOString()
        };
        data.followers.push(f);
      }
      writeJsonDb(data);
      return f;
    }
  },

  async acceptFollowRequest(follower, following) {
    const status = 'accepted';
    if (usePostgres) {
      const res = await pool.query(
        'UPDATE followers SET status = $3 WHERE follower_username = $1 AND following_username = $2 RETURNING *',
        [follower, following, status]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const f = data.followers.find(x => x.follower_username === follower && x.following_username === following);
      if (f) {
        f.status = status;
        writeJsonDb(data);
        return f;
      }
      return null;
    }
  },

  async unfollowUser(follower, following) {
    if (usePostgres) {
      await pool.query(
        'DELETE FROM followers WHERE follower_username = $1 AND following_username = $2',
        [follower, following]
      );
    } else {
      const data = readJsonDb();
      data.followers = data.followers.filter(x => !(x.follower_username === follower && x.following_username === following));
      writeJsonDb(data);
    }
  },

  async getFollowersCount(username) {
    if (usePostgres) {
      const res = await pool.query(
        "SELECT count(*) FROM followers WHERE following_username = $1 AND status = 'accepted'",
        [username]
      );
      return parseInt(res.rows[0].count, 10);
    } else {
      const data = readJsonDb();
      return data.followers.filter(x => x.following_username === username && x.status === 'accepted').length;
    }
  },

  async getFollowingCount(username) {
    if (usePostgres) {
      const res = await pool.query(
        "SELECT count(*) FROM followers WHERE follower_username = $1 AND status = 'accepted'",
        [username]
      );
      return parseInt(res.rows[0].count, 10);
    } else {
      const data = readJsonDb();
      return data.followers.filter(x => x.follower_username === username && x.status === 'accepted').length;
    }
  },

  async getFollowers(username) {
    if (usePostgres) {
      const res = await pool.query(
        `SELECT u.username, u.nickname, u.bio, u.profile_img 
         FROM users u 
         JOIN followers f ON u.username = f.follower_username 
         WHERE f.following_username = $1 AND f.status = 'accepted'`,
        [username]
      );
      return res.rows;
    } else {
      const data = readJsonDb();
      const followerNames = data.followers
        .filter(x => x.following_username === username && x.status === 'accepted')
        .map(x => x.follower_username);
      return data.users
        .filter(u => followerNames.includes(u.username))
        .map(u => ({ username: u.username, nickname: u.nickname || '', bio: u.bio || '', profile_img: u.profile_img || '' }));
    }
  },

  async getFollowing(username) {
    if (usePostgres) {
      const res = await pool.query(
        `SELECT u.username, u.nickname, u.bio, u.profile_img 
         FROM users u 
         JOIN followers f ON u.username = f.following_username 
         WHERE f.follower_username = $1 AND f.status = 'accepted'`,
        [username]
      );
      return res.rows;
    } else {
      const data = readJsonDb();
      const followingNames = data.followers
        .filter(x => x.follower_username === username && x.status === 'accepted')
        .map(x => x.following_username);
      return data.users
        .filter(u => followingNames.includes(u.username))
        .map(u => ({ username: u.username, nickname: u.nickname || '', bio: u.bio || '', profile_img: u.profile_img || '' }));
    }
  },

  // --- NOTIFICATIONS SYSTEM ---
  async createNotification(recipient, sender, type, details = '') {
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO notifications (recipient_username, sender_username, type, status, details) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [recipient, sender, type, 'unread', details]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const newNotif = {
        id: data.notifications.length + 1,
        recipient_username: recipient,
        sender_username: sender,
        type,
        status: 'unread',
        details,
        created_at: new Date().toISOString()
      };
      data.notifications.push(newNotif);
      writeJsonDb(data);
      return newNotif;
    }
  },

  async getNotifications(recipient) {
    if (usePostgres) {
      const res = await pool.query(
        'SELECT * FROM notifications WHERE recipient_username = $1 ORDER BY created_at DESC',
        [recipient]
      );
      return res.rows;
    } else {
      const data = readJsonDb();
      return data.notifications
        .filter(n => n.recipient_username === recipient)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  async markNotificationsRead(recipient) {
    if (usePostgres) {
      await pool.query(
        "UPDATE notifications SET status = 'read' WHERE recipient_username = $1",
        [recipient]
      );
    } else {
      const data = readJsonDb();
      data.notifications.forEach(n => {
        if (n.recipient_username === recipient) n.status = 'read';
      });
      writeJsonDb(data);
    }
  },

  async deleteNotification(id) {
    const nid = parseInt(id, 10);
    if (usePostgres) {
      await pool.query('DELETE FROM notifications WHERE id = $1', [nid]);
    } else {
      const data = readJsonDb();
      data.notifications = data.notifications.filter(n => n.id !== nid);
      writeJsonDb(data);
    }
  },

  async deleteFollowRequestNotification(sender, recipient) {
    if (usePostgres) {
      await pool.query(
        "DELETE FROM notifications WHERE sender_username = $1 AND recipient_username = $2 AND type = 'follow_request'",
        [sender, recipient]
      );
    } else {
      const data = readJsonDb();
      data.notifications = data.notifications.filter(
        n => !(n.sender_username === sender && n.recipient_username === recipient && n.type === 'follow_request')
      );
      writeJsonDb(data);
    }
  },

  async declineFollowRequest(sender, recipient) {
    // Remove pending follow relationship
    if (usePostgres) {
      await pool.query(
        "DELETE FROM followers WHERE follower_username = $1 AND following_username = $2 AND status = 'pending'",
        [sender, recipient]
      );
    } else {
      const data = readJsonDb();
      data.followers = data.followers.filter(
        f => !(f.follower_username === sender && f.following_username === recipient && f.status === 'pending')
      );
      writeJsonDb(data);
    }
    // Also clean up the notification
    await db.deleteFollowRequestNotification(sender, recipient);
  },

  // --- ANONYMOUS ID POOL ---
  async getNextAnonId() {
    if (usePostgres) {
      const res = await pool.query(
        'UPDATE anon_counter SET next_num = next_num + 1 WHERE id = 1 RETURNING next_num'
      );
      return res.rows[0].next_num - 1; // return the value before increment
    } else {
      const data = readJsonDb();
      const num = data.anon_counter.next;
      data.anon_counter.next = num + 1;
      writeJsonDb(data);
      return num;
    }
  },

  // --- IP / DEVICE BANNING ---
  async createIpBan(targetType, targetValue, reason, expiresAt) {
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO ip_bans (target_type, target_value, reason, expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT (target_type, target_value) DO UPDATE SET reason = $3, expires_at = $4 RETURNING *',
        [targetType, targetValue, reason, expiresAt]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const existing = data.ip_bans.findIndex(b => b.target_type === targetType && b.target_value === targetValue);
      const ban = { id: Date.now(), target_type: targetType, target_value: targetValue, reason, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null, created_at: new Date().toISOString() };
      if (existing !== -1) data.ip_bans[existing] = ban;
      else data.ip_bans.push(ban);
      writeJsonDb(data);
      return ban;
    }
  },

  async isIpBanned(ip) {
    if (usePostgres) {
      const res = await pool.query(
        "SELECT * FROM ip_bans WHERE target_type = 'ip' AND target_value = $1 AND (expires_at IS NULL OR expires_at > NOW())",
        [ip]
      );
      return res.rows[0] || null;
    } else {
      const data = readJsonDb();
      const ban = data.ip_bans.find(b => b.target_type === 'ip' && b.target_value === ip);
      if (!ban) return null;
      if (ban.expires_at && new Date(ban.expires_at) < new Date()) {
        data.ip_bans = data.ip_bans.filter(b => !(b.target_type === 'ip' && b.target_value === ip));
        writeJsonDb(data);
        return null;
      }
      return ban;
    }
  },

  async isFingerprintBanned(fingerprint) {
    if (usePostgres) {
      const res = await pool.query(
        "SELECT * FROM ip_bans WHERE target_type = 'fingerprint' AND target_value = $1 AND (expires_at IS NULL OR expires_at > NOW())",
        [fingerprint]
      );
      return res.rows[0] || null;
    } else {
      const data = readJsonDb();
      const ban = data.ip_bans.find(b => b.target_type === 'fingerprint' && b.target_value === fingerprint);
      if (!ban) return null;
      if (ban.expires_at && new Date(ban.expires_at) < new Date()) return null;
      return ban;
    }
  },

  // --- PROGRESSIVE MODERATION ---
  async incrementLifetimeReports(username) {
    if (usePostgres) {
      const res = await pool.query(
        'UPDATE users SET lifetime_reports = COALESCE(lifetime_reports, 0) + 1 WHERE LOWER(username) = LOWER($1) RETURNING lifetime_reports',
        [username]
      );
      return res.rows[0]?.lifetime_reports || 0;
    } else {
      const data = readJsonDb();
      const idx = data.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
      if (idx !== -1) {
        data.users[idx].lifetime_reports = (data.users[idx].lifetime_reports || 0) + 1;
        writeJsonDb(data);
        return data.users[idx].lifetime_reports;
      }
      return 0;
    }
  },

  async setUserSuspension(username, expiresAt) {
    if (usePostgres) {
      await pool.query(
        'UPDATE users SET suspended_until = $2 WHERE LOWER(username) = LOWER($1)',
        [username, expiresAt]
      );
    } else {
      const data = readJsonDb();
      const idx = data.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
      if (idx !== -1) {
        data.users[idx].suspended_until = expiresAt ? new Date(expiresAt).toISOString() : null;
        writeJsonDb(data);
      }
    }
  },

  async isUserSuspended(username) {
    const user = await db.getUserByUsername(username);
    if (!user) return null;
    if (user.suspended_until && new Date(user.suspended_until) > new Date()) {
      return { suspended_until: user.suspended_until };
    }
    return null;
  },

  // --- ADMIN AUTH & MANAGEMENT ---
  async getAdminByUsername(username) {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM admin_users WHERE LOWER(username) = LOWER($1)', [username]);
      return res.rows[0] || null;
    } else {
      const data = readJsonDb();
      return data.admin_users.find(a => a.username.toLowerCase() === username.toLowerCase()) || null;
    }
  },

  async getAdminById(id) {
    const aid = parseInt(id, 10);
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM admin_users WHERE id = $1', [isNaN(aid) ? id : aid]);
      return res.rows[0] || null;
    } else {
      const data = readJsonDb();
      return data.admin_users.find(a => a.id === aid || a.id === id) || null;
    }
  },

  async getAdminUsers() {
    if (usePostgres) {
      const res = await pool.query('SELECT id, username, email, role, twofa_enabled, is_active, created_at, last_login, password_changed FROM admin_users ORDER BY id ASC');
      return res.rows;
    } else {
      const data = readJsonDb();
      return data.admin_users.map(a => ({
        id: a.id,
        username: a.username,
        email: a.email,
        role: a.role,
        twofa_enabled: a.twofa_enabled,
        is_active: a.is_active,
        created_at: a.created_at,
        last_login: a.last_login,
        password_changed: a.password_changed
      }));
    }
  },

  async createAdminUser(username, email, passwordHash, role) {
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO admin_users (username, email, password_hash, role, is_active, password_changed) VALUES ($1, $2, $3, $4, TRUE, FALSE) RETURNING *',
        [username, email, passwordHash, role]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const newAdmin = {
        id: data.admin_users.length + 1,
        username,
        email,
        password_hash: passwordHash,
        role,
        twofa_secret: null,
        twofa_enabled: false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login: null,
        login_attempts: 0,
        locked_until: null,
        ip_whitelist: null,
        device_fingerprints: null,
        password_changed: false
      };
      data.admin_users.push(newAdmin);
      writeJsonDb(data);
      return newAdmin;
    }
  },

  async updateAdminUser(id, updates) {
    const aid = parseInt(id, 10);
    const idVal = isNaN(aid) ? id : aid;
    if (usePostgres) {
      const fields = [];
      const values = [];
      let idx = 1;
      for (const [k, v] of Object.entries(updates)) {
        fields.push(`${k} = $${idx++}`);
        values.push(v);
      }
      values.push(idVal);
      const res = await pool.query(
        `UPDATE admin_users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
        values
      );
      return res.rows[0] || null;
    } else {
      const data = readJsonDb();
      const idx = data.admin_users.findIndex(a => a.id === idVal);
      if (idx !== -1) {
        data.admin_users[idx] = { ...data.admin_users[idx], ...updates, updated_at: new Date().toISOString() };
        writeJsonDb(data);
        return data.admin_users[idx];
      }
      return null;
    }
  },

  async deleteAdminUser(id) {
    const aid = parseInt(id, 10);
    const idVal = isNaN(aid) ? id : aid;
    if (usePostgres) {
      await pool.query('DELETE FROM admin_users WHERE id = $1', [idVal]);
    } else {
      const data = readJsonDb();
      data.admin_users = data.admin_users.filter(a => a.id !== idVal);
      writeJsonDb(data);
    }
  },

  async updateAdmin2FA(adminId, secret, enabled) {
    return db.updateAdminUser(adminId, { twofa_secret: secret, twofa_enabled: enabled });
  },

  // --- ADMIN SESSIONS ---
  async createAdminSession(adminId, accessTokenHash, refreshTokenHash, expiresAt, ip, ua, fp) {
    const aid = parseInt(adminId, 10);
    const adminIdVal = isNaN(aid) ? adminId : aid;
    if (usePostgres) {
      const res = await pool.query(
        `INSERT INTO admin_sessions (admin_id, access_token_hash, refresh_token_hash, expires_at, ip_address, user_agent, device_fingerprint, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) RETURNING *`,
        [adminIdVal, accessTokenHash, refreshTokenHash, expiresAt, ip, ua, fp]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const newSession = {
        id: data.admin_sessions.length + 1,
        admin_id: adminIdVal,
        access_token_hash: accessTokenHash,
        refresh_token_hash: refreshTokenHash,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        ip_address: ip,
        user_agent: ua,
        device_fingerprint: fp,
        is_active: true,
        created_at: new Date().toISOString()
      };
      data.admin_sessions.push(newSession);
      writeJsonDb(data);
      return newSession;
    }
  },

  async getAdminSession(accessTokenHash) {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM admin_sessions WHERE access_token_hash = $1 AND is_active = TRUE', [accessTokenHash]);
      return res.rows[0] || null;
    } else {
      const data = readJsonDb();
      return data.admin_sessions.find(s => s.access_token_hash === accessTokenHash && s.is_active) || null;
    }
  },

  async deactivateAdminSession(accessTokenHash) {
    if (usePostgres) {
      await pool.query('UPDATE admin_sessions SET is_active = FALSE WHERE access_token_hash = $1', [accessTokenHash]);
    } else {
      const data = readJsonDb();
      data.admin_sessions.forEach(s => {
        if (s.access_token_hash === accessTokenHash) s.is_active = false;
      });
      writeJsonDb(data);
    }
  },

  // --- AUDIT LOGS ---
  async writeAuditLog(adminId, username, role, ip, ua, fp, actionType, targetType, targetId, prevVal, newVal) {
    const aid = parseInt(adminId, 10);
    const adminIdVal = isNaN(aid) ? adminId : aid;
    const pvStr = prevVal ? JSON.stringify(prevVal) : null;
    const nvStr = newVal ? JSON.stringify(newVal) : null;
    if (usePostgres) {
      await pool.query(
        `INSERT INTO audit_logs (admin_id, admin_username, admin_role, ip_address, user_agent, device_fingerprint, action_type, target_type, target_id, previous_value, new_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [adminIdVal, username, role, ip, ua, fp, actionType, targetType, String(targetId), pvStr, nvStr]
      );
    } else {
      const data = readJsonDb();
      const newLog = {
        id: data.audit_logs.length + 1,
        admin_id: adminIdVal,
        admin_username: username,
        admin_role: role,
        ip_address: ip,
        user_agent: ua,
        device_fingerprint: fp,
        action_type: actionType,
        target_type: targetType,
        target_id: String(targetId),
        previous_value: pvStr,
        new_value: nvStr,
        created_at: new Date().toISOString()
      };
      data.audit_logs.push(newLog);
      writeJsonDb(data);
    }
  },

  async getAuditLogs() {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
      return res.rows;
    } else {
      const data = readJsonDb();
      return [...data.audit_logs].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 500);
    }
  },

  // --- CONTACT INQUIRIES & REPLIES ---
  async createContactInquiry(name, email, category, message) {
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO contact_inquiries (username, category, subject, message, priority, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [name, category, email, message, 'medium', 'new']
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const newInq = {
        id: data.contact_inquiries.length + 1,
        user_id: null,
        username: name,
        category,
        subject: email,
        message,
        priority: 'medium',
        status: 'new',
        assigned_to: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      data.contact_inquiries.push(newInq);
      writeJsonDb(data);
      return newInq;
    }
  },

  async getContactInquiries() {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM contact_inquiries ORDER BY created_at DESC');
      return res.rows;
    } else {
      const data = readJsonDb();
      return [...data.contact_inquiries].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  async getContactInquiryById(id) {
    const qid = parseInt(id, 10);
    const idVal = isNaN(qid) ? id : qid;
    if (usePostgres) {
      const inquiryRes = await pool.query('SELECT * FROM contact_inquiries WHERE id = $1', [idVal]);
      const repliesRes = await pool.query('SELECT * FROM contact_replies WHERE inquiry_id = $1 ORDER BY created_at ASC', [idVal]);
      if (!inquiryRes.rows[0]) return null;
      return {
        ...inquiryRes.rows[0],
        replies: repliesRes.rows
      };
    } else {
      const data = readJsonDb();
      const inquiry = data.contact_inquiries.find(q => q.id === idVal);
      if (!inquiry) return null;
      const replies = data.contact_replies.filter(r => r.inquiry_id === idVal);
      return { ...inquiry, replies };
    }
  },

  async updateContactInquiryStatus(id, status, assignedTo) {
    const qid = parseInt(id, 10);
    const idVal = isNaN(qid) ? id : qid;
    const assignedVal = assignedTo ? (isNaN(parseInt(assignedTo, 10)) ? assignedTo : parseInt(assignedTo, 10)) : null;
    if (usePostgres) {
      const res = await pool.query(
        'UPDATE contact_inquiries SET status = $1, assigned_to = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
        [status, assignedVal, idVal]
      );
      return res.rows[0] || null;
    } else {
      const data = readJsonDb();
      const idx = data.contact_inquiries.findIndex(q => q.id === idVal);
      if (idx !== -1) {
        data.contact_inquiries[idx].status = status;
        data.contact_inquiries[idx].assigned_to = assignedVal;
        data.contact_inquiries[idx].updated_at = new Date().toISOString();
        writeJsonDb(data);
        return data.contact_inquiries[idx];
      }
      return null;
    }
  },

  async createContactReply(inquiryId, adminId, reply) {
    const qid = parseInt(inquiryId, 10);
    const inquiryIdVal = isNaN(qid) ? inquiryId : qid;
    const aid = parseInt(adminId, 10);
    const adminIdVal = isNaN(aid) ? adminId : aid;
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO contact_replies (inquiry_id, admin_id, reply) VALUES ($1, $2, $3) RETURNING *',
        [inquiryIdVal, adminIdVal, reply]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const newReply = {
        id: data.contact_replies.length + 1,
        inquiry_id: inquiryIdVal,
        admin_id: adminIdVal,
        reply,
        created_at: new Date().toISOString()
      };
      data.contact_replies.push(newReply);
      writeJsonDb(data);
      return newReply;
    }
  },

  // --- DELETION REQUESTS ---
  async getDeletionRequests() {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM deletion_requests ORDER BY requested_at DESC');
      return res.rows;
    } else {
      const data = readJsonDb();
      return [...data.deletion_requests].sort((a,b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
    }
  },

  async createDeletionRequest(userId, username, reason) {
    const uid = parseInt(userId, 10);
    const userIdVal = isNaN(uid) ? userId : uid;
    if (usePostgres) {
      const res = await pool.query(
        'INSERT INTO deletion_requests (user_id, username, reason, status) VALUES ($1, $2, $3, \'pending\') RETURNING *',
        [userIdVal, username, reason]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const newReq = {
        id: data.deletion_requests.length + 1,
        user_id: userIdVal,
        username,
        reason,
        status: 'pending',
        requested_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by: null
      };
      data.deletion_requests.push(newReq);
      writeJsonDb(data);
      return newReq;
    }
  },

  async resolveDeletionRequest(id, status, adminId) {
    const rid = parseInt(id, 10);
    const idVal = isNaN(rid) ? id : rid;
    const aid = parseInt(adminId, 10);
    const adminIdVal = isNaN(aid) ? adminId : aid;
    if (usePostgres) {
      const res = await pool.query(
        'UPDATE deletion_requests SET status = $1, resolved_at = NOW(), resolved_by = $2 WHERE id = $3 RETURNING *',
        [status, adminIdVal, idVal]
      );
      return res.rows[0] || null;
    } else {
      const data = readJsonDb();
      const idx = data.deletion_requests.findIndex(r => r.id === idVal);
      if (idx !== -1) {
        data.deletion_requests[idx].status = status;
        data.deletion_requests[idx].resolved_at = new Date().toISOString();
        data.deletion_requests[idx].resolved_by = adminIdVal;
        writeJsonDb(data);
        return data.deletion_requests[idx];
      }
      return null;
    }
  },

  // --- AGGREGATES & PLATFORM MODERATION CRUD ---
  async getPlatformUsersFiltered(search, statusFilter, roleFilter, offset = 0, limit = 50) {
    if (usePostgres) {
      let query = 'SELECT id, username, email, role, created_at, suspended_until, lifetime_reports FROM users WHERE 1=1';
      const params = [];
      let idx = 1;
      
      if (search) {
        query += ` AND (LOWER(username) LIKE LOWER($${idx}) OR LOWER(email) LIKE LOWER($${idx}))`;
        params.push(`%${search}%`);
        idx++;
      }
      
      if (statusFilter) {
        if (statusFilter === 'suspended') {
          query += ' AND suspended_until > NOW()';
        } else if (statusFilter === 'active') {
          query += ' AND (suspended_until IS NULL OR suspended_until <= NOW())';
        }
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`;
      params.push(limit, offset);
      
      const res = await pool.query(query, params);
      return res.rows;
    } else {
      const data = readJsonDb();
      let list = data.users;
      if (search) {
        list = list.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || (u.email && u.email.toLowerCase().includes(search.toLowerCase())));
      }
      if (statusFilter) {
        if (statusFilter === 'suspended') {
          list = list.filter(u => u.suspended_until && new Date(u.suspended_until) > new Date());
        } else if (statusFilter === 'active') {
          list = list.filter(u => !u.suspended_until || new Date(u.suspended_until) <= new Date());
        }
      }
      list = [...list].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return list.slice(offset, offset + limit).map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role || 'user',
        is_active: true,
        created_at: u.created_at,
        suspended_until: u.suspended_until,
        lifetime_reports: u.lifetime_reports || 0
      }));
    }
  },

  async getReportsWithDetails() {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM reports ORDER BY created_at DESC LIMIT 100');
      return res.rows;
    } else {
      const data = readJsonDb();
      return [...data.reports].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100);
    }
  },

  async getReportsCount() {
    if (usePostgres) {
      const res = await pool.query('SELECT COUNT(*) FROM reports');
      return parseInt(res.rows[0].count, 10);
    } else {
      const data = readJsonDb();
      return data.reports.length;
    }
  },

  async getBansCount() {
    if (usePostgres) {
      const res = await pool.query('SELECT COUNT(*) FROM ip_bans');
      return parseInt(res.rows[0].count, 10);
    } else {
      const data = readJsonDb();
      return data.ip_bans.length;
    }
  },

  async getAdminMetrics() {
    const data = readJsonDb();
    let totalUsersCount = 0;
    let registeredUsersCount = 0;
    let reportsCount = 0;
    let activeBansCount = 0;
    let feedbackCount = 0;

    if (usePostgres) {
      const uRes = await pool.query('SELECT COUNT(*) FROM users');
      totalUsersCount = parseInt(uRes.rows[0].count, 10);
      registeredUsersCount = totalUsersCount;
      const rRes = await pool.query('SELECT COUNT(*) FROM reports');
      reportsCount = parseInt(rRes.rows[0].count, 10);
      const bRes = await pool.query('SELECT COUNT(*) FROM ip_bans');
      activeBansCount = parseInt(bRes.rows[0].count, 10);
      const fRes = await pool.query('SELECT COUNT(*) FROM contact_inquiries');
      feedbackCount = parseInt(fRes.rows[0].count, 10);
    } else {
      totalUsersCount = data.users.length;
      registeredUsersCount = data.users.filter(u => u.password).length;
      reportsCount = data.reports.length;
      activeBansCount = data.ip_bans.length;
      feedbackCount = data.contact_inquiries.length;
    }

    return {
      totalUsers: totalUsersCount,
      registeredUsers: registeredUsersCount,
      anonymousUsers: Math.max(0, totalUsersCount - registeredUsersCount),
      reportsCount,
      activeBans: activeBansCount,
      feedbacksCount: feedbackCount
    };
  }
};

module.exports = {
  db,
  initDb
};
