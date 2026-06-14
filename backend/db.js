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
  otp_verifications: [],
  followers: [],
  notifications: []
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
    if (!parsed.otp_verifications) {
      parsed.otp_verifications = [];
    }
    if (!parsed.followers) {
      parsed.followers = [];
    }
    if (!parsed.notifications) {
      parsed.notifications = [];
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
      const user = res.rows[0];
      if (user) {
        const pruned = await db.pruneExpiredDeletion(user);
        if (pruned) return null;
      }
      return user;
    } else {
      const data = readJsonDb();
      const user = data.users.find(u => u.username === username);
      if (user) {
        const pruned = await db.pruneExpiredDeletion(user);
        if (pruned) return null;
      }
      return user;
    }
  },

  async getUserByEmail(email) {
    if (usePostgres) {
      const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = res.rows[0];
      if (user) {
        const pruned = await db.pruneExpiredDeletion(user);
        if (pruned) return null;
      }
      return user;
    } else {
      const data = readJsonDb();
      const user = data.users.find(u => u.email === email);
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

  async setUserDeletionHold(username, holdUntil) {
    const holdUntilStr = holdUntil ? holdUntil.toISOString() : null;
    if (usePostgres) {
      await pool.query('UPDATE users SET deletion_hold_until = $2 WHERE username = $1', [username, holdUntil]);
    } else {
      const data = readJsonDb();
      const idx = data.users.findIndex(u => u.username === username);
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
  },

  // --- PROFILE UPDATES ---
  async updateUserProfile(username, nickname, bio, profile_img) {
    if (usePostgres) {
      const res = await pool.query(
        'UPDATE users SET nickname = $2, bio = $3, profile_img = $4 WHERE username = $1 RETURNING *',
        [username, nickname, bio, profile_img]
      );
      return res.rows[0];
    } else {
      const data = readJsonDb();
      const idx = data.users.findIndex(u => u.username === username);
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
  }
};

module.exports = {
  db,
  initDb
};
