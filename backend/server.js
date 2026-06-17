const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { db, initDb } = require('./db');

// Base32 Decode for TOTP
function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = str.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) throw new Error('Invalid base32 character');
    bits += val.toString(2).padStart(5, '0');
  }
  const buffer = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    buffer.push(parseInt(bits.substr(i, 8), 2));
  }
  return Buffer.from(buffer);
}

// Generate TOTP code dynamically via HMAC-SHA1
function generateTOTP(secret, time = Date.now()) {
  const crypto = require('crypto');
  const key = base32Decode(secret);
  const epoch = Math.floor(time / 1000);
  const counter = Math.floor(epoch / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 0xf;
  const binary = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
  const otp = binary % 1000000;
  return String(otp).padStart(6, '0');
}

// Validate TOTP code with time step tolerance window of 30 seconds
function verifyTOTP(secret, code) {
  const time = Date.now();
  for (let i = -1; i <= 1; i++) {
    if (generateTOTP(secret, time + i * 30 * 1000) === code) {
      return true;
    }
  }
  return false;
}

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://ghost-chat-taupe.vercel.app',
  'https://ghostchat.vercel.app',
  // Allow all vercel.app preview URLs:
  /\.vercel\.app$/,
  // Allow all render.com URLs:
  /\.onrender\.com$/
];

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow server-to-server
    if (
      ALLOWED_ORIGINS.some(o =>
        typeof o === 'string' ? o === origin : o.test(origin)
      )
    ) {
      return callback(null, true);
    }
    // Fall-through: allow all for now (remove in paid tier)
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const JWT_SECRET = process.env.JWT_SECRET || 'ghostchat_secure_secret_key';

// Transporter setup for email OTP dispatch (mock/production)
let transporter;
if (process.env.SMTP_SERVICE) {
  transporter = nodemailer.createTransport({
    service: process.env.SMTP_SERVICE,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

// Unified dispatchEmail helper supporting Resend, Postmark, Mailgun APIs, with SMTP and Console fallbacks
async function dispatchEmail({ to, subject, text, html }) {
  const emailFrom = process.env.EMAIL_FROM || process.env.SMTP_USER || 'GhostChat <no-reply@ghostchat.com>';

  // 1. Resend API Integration
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [to],
          subject: subject,
          text: text,
          html: html || `<p>${text}</p>`
        })
      });
      const data = await response.json();
      if (response.ok) {
        console.log(`✉️ [Resend] Email successfully sent to ${to}. Message ID: ${data.id}`);
        return true;
      } else {
        throw new Error(data.message || JSON.stringify(data));
      }
    } catch (err) {
      console.error('❌ [Resend] Failed to dispatch email:', err.message);
    }
  }

  // 2. Postmark API Integration
  if (process.env.POSTMARK_SERVER_TOKEN) {
    try {
      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN
        },
        body: JSON.stringify({
          From: emailFrom,
          To: to,
          Subject: subject,
          TextBody: text,
          HtmlBody: html || `<p>${text}</p>`
        })
      });
      const data = await response.json();
      if (response.ok) {
        console.log(`✉️ [Postmark] Email successfully sent to ${to}. Message ID: ${data.MessageID}`);
        return true;
      } else {
        throw new Error(data.Message || JSON.stringify(data));
      }
    } catch (err) {
      console.error('❌ [Postmark] Failed to dispatch email:', err.message);
    }
  }

  // 3. Mailgun API Integration
  if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
    try {
      const domain = process.env.MAILGUN_DOMAIN;
      const apiKey = process.env.MAILGUN_API_KEY;
      const auth = Buffer.from(`api:${apiKey}`).toString('base64');
      const form = new URLSearchParams();
      form.append('from', emailFrom);
      form.append('to', to);
      form.append('subject', subject);
      form.append('text', text);
      if (html) form.append('html', html);

      const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: form.toString()
      });
      const data = await response.json();
      if (response.ok) {
        console.log(`✉️ [Mailgun] Email successfully sent to ${to}. Message: ${data.message}`);
        return true;
      } else {
        throw new Error(data.message || JSON.stringify(data));
      }
    } catch (err) {
      console.error('❌ [Mailgun] Failed to dispatch email:', err.message);
    }
  }

  // 4. Nodemailer SMTP Fallback
  if (transporter) {
    try {
      await transporter.sendMail({
        from: emailFrom,
        to,
        subject,
        text,
        html: html || `<p>${text}</p>`
      });
      console.log(`✉️ [SMTP] Email successfully sent to ${to}`);
      return true;
    } catch (err) {
      console.error('❌ [SMTP] Failed to send email via SMTP:', err.message);
    }
  }

  // 5. Console Logging Fallback (Local Development)
  console.log(`
┌────────────────────────────────────────────────────────┐
│                                                        │
│   📧 [CONSOLE FALLBACK] GHOSTCHAT EMAIL NOTIFICATION  │
│   👉 TO: ${to.toUpperCase()}                           │
│   👉 SUBJECT: ${subject}                               │
│   👉 BODY: ${text.substring(0, Math.min(text.length, 120))}...                 │
│                                                        │
└────────────────────────────────────────────────────────┘
  `);
  return false;
}

// Helper: send OTP
async function sendOtpEmail(email, code) {
  const messageText = `Your GhostChat verification code is: ${code}. This code expires in 2 minutes.`;
  
  // Print OTP to Node server logs in a big banner for local testing
  console.log(`
┌────────────────────────────────────────────────────────┐
│                                                        │
│   📧 GHOSTCHAT OTP CODE FOR ${email.toUpperCase()}    │
│   👉 CODE:  ${code}                                    │
│   ⏱️  EXPIRES IN: 2 MINUTES                            │
│   ⚠️  (Fallback code printed in Node console logs)      │
│                                                        │
└────────────────────────────────────────────────────────┘
  `);

  await dispatchEmail({
    to: email,
    subject: 'GhostChat Account Verification Code',
    text: messageText,
    html: `
      <div style="font-family: sans-serif; background-color: #060606; color: #ffffff; padding: 30px; border-radius: 20px; max-width: 480px; margin: 0 auto; border: 1px solid #333;">
        <h2 style="color: #f43f5e; text-align: center; font-weight: bold; margin-bottom: 20px;">GhostChat Verification</h2>
        <p style="font-size: 14px; color: #ccc; text-align: center;">Your verification OTP code is:</p>
        <div style="background-color: #1a1a1a; padding: 15px; border-radius: 10px; font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 5px; color: #ffffff; margin: 20px 0; border: 1px solid #444;">
          ${code}
        </div>
        <p style="font-size: 12px; color: #888; text-align: center; margin-top: 20px;">This code is valid for 2 minutes. If you did not request this, you can safely ignore this email.</p>
      </div>
    `
  });
}

// Generic Helper: Send email notifications
async function sendEmail(to, subject, text) {
  await dispatchEmail({
    to,
    subject,
    text,
    html: `
      <div style="font-family: sans-serif; background-color: #060606; color: #ffffff; padding: 30px; border-radius: 20px; max-width: 480px; margin: 0 auto; border: 1px solid #333;">
        <h2 style="color: #f43f5e; text-align: center; font-weight: bold; margin-bottom: 20px;">GhostChat Alert</h2>
        <p style="font-size: 14px; color: #ccc; line-height: 1.6;">${text}</p>
        <p style="font-size: 11px; color: #666; text-align: center; margin-top: 30px; border-top: 1px solid #222; padding-top: 15px;">&copy; 2026 GhostChat Administration. All rights reserved.</p>
      </div>
    `
  });
}

// OAuth 2.0 Callback Authentication (Exchanges Code for Session token)
app.post('/api/auth/oauth/callback', async (req, res) => {
  const { code, provider } = req.body;
  if (!code || !provider) {
    return res.status(400).json({ message: 'Code and provider are required' });
  }

  try {
    let email = '';
    let username = '';
    let displayName = '';

    // Derives callbackUrl dynamically based on request origin to support both localhost and vercel domains
    const origin = req.headers.origin || 'https://ghost-chat-taupe.vercel.app';
    const callbackUrl = `${origin}/auth/callback`;

    if (provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).json({ message: 'Google OAuth is not configured on the backend server.' });
      }

      // Exchange code for tokens
      console.log("===== GOOGLE OAUTH DEBUG =====");
console.log("clientId:", clientId);
console.log("clientSecret:", clientSecret);
console.log("callbackUrl:", callbackUrl);
console.log("==============================");
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code'
        }).toString()
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenData.error_description || 'Failed to exchange Google OAuth code.');
      }

      // Fetch user info
      const infoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${tokenData.access_token}`);
      const infoData = await infoRes.json();
      if (!infoRes.ok) {
        throw new Error('Failed to fetch Google user profile.');
      }

      email = infoData.email;
      displayName = infoData.name || infoData.given_name || 'Google User';
      username = (email.split('@')[0] + '_google').toLowerCase().replace(/[^a-z0-9_]/g, '');
    } 
    else if (provider === 'github') {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).json({ message: 'GitHub OAuth is not configured on the backend server.' });
      }

      // Exchange code for token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        throw new Error(tokenData.error_description || 'Failed to exchange GitHub OAuth code.');
      }

      const accessToken = tokenData.access_token;

      // Fetch GitHub profile info
      const infoRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'GhostChat-OAuth-Client'
        }
      });
      const infoData = await infoRes.json();
      if (!infoRes.ok) {
        throw new Error('Failed to fetch GitHub user profile.');
      }

      // Fetch GitHub emails if not public
      let githubEmail = infoData.email;
      if (!githubEmail) {
        const emailsRes = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'GhostChat-OAuth-Client'
          }
        });
        if (emailsRes.ok) {
          const emails = await emailsRes.json();
          const primary = emails.find(e => e.primary) || emails[0];
          if (primary) githubEmail = primary.email;
        }
      }

      email = githubEmail || `${infoData.login}@github.ghostchat.local`;
      displayName = infoData.name || infoData.login;
      username = (infoData.login + '_github').toLowerCase().replace(/[^a-z0-9_]/g, '');
    } else {
      return res.status(400).json({ message: 'Unsupported OAuth provider' });
    }

    // Authenticate or register user dynamically
    let user = await db.getUserByEmail(email);
    if (!user) {
      // Create user
      const randomPassword = require('crypto').randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await db.createUser(username, email, hashedPassword, 'user');
      await db.updateUserProfile(user.id, { display_name: displayName });
      
      // Emit to admin panel
      emitToAdmins('user:registered', { id: user.id, username: user.username, email: user.email, role: user.role, created_at: user.created_at });
    }

    // Issue JWT session token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    console.error('OAuth callback execution error:', err);
    res.status(500).json({ message: err.message || 'OAuth authentication sequence failed.' });
  }
});

// Direct User Registration (No verification code, enforces email unique, checks strength)
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Password strength validation
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message: 'Password must be at least 8 characters, contain at least one capital letter, one lowercase letter, one number, and one symbol.'
    });
  }

  try {
    // Check if username already exists
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    // Check if email already registered
    const existingEmail = await db.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ message: 'Email address is already registered to another account' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user directly
    const newUser = await db.createUser(username, email, hashedPassword, 'user');

    // Emit to admin panel
    emitToAdmins('user:registered', { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role, created_at: newUser.created_at });

    // Create JWT Token
    const token = jwt.sign({ userId: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: newUser.username });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// User Registration Request (Generates OTP)
app.post('/api/auth/register-request', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if username already exists in verified users
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    // Check if email already registered to an account
    const existingEmail = await db.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ message: 'Email address is already registered to another account' });
    }

    // Check if email has active lockout
    const existingVerification = await db.getOtpVerification(email);
    if (existingVerification && existingVerification.locked_until) {
      const lockDate = new Date(existingVerification.locked_until);
      if (lockDate > new Date()) {
        const remainingHours = Math.ceil((lockDate - new Date()) / (1000 * 60 * 60));
        return res.status(403).json({
          message: `Too many code attempts. Account creation is locked. Please try again after ${remainingHours} hours.`
        });
      }
    }

    // Generate random 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes expiry

    // Hash the password now so we save it securely in verification state
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save/overwrite verification state
    await db.createOtpVerification(email, username, hashedPassword, otpCode, expiresAt);

    // Dispatch OTP (SMTP or Console)
    await sendOtpEmail(email, otpCode);

    res.json({ message: 'Verification code sent to email' });
  } catch (err) {
    console.error('Registration request error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify OTP & Complete Registration
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    const record = await db.getOtpVerification(email);
    if (!record) {
      return res.status(400).json({ message: 'Verification record not found. Please sign up again.' });
    }

    // Check Lockout
    if (record.locked_until && new Date(record.locked_until) > new Date()) {
      return res.status(403).json({ message: 'Account creation is locked. Try again later.' });
    }

    // Check Expiration
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ message: 'Verification code has expired. Request a new code.' });
    }

    // Validate Code
    if (record.otp_code !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    // Complete User Creation
    const newUser = await db.createUser(record.username, email, record.password, 'user');

    // Emit to admin panel
    emitToAdmins('user:registered', { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role, created_at: newUser.created_at });

    // Clean up OTP record
    await db.deleteOtpVerification(email);

    // Create JWT Token
    const token = jwt.sign({ userId: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: newUser.username });
  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Resend OTP Code
app.post('/api/auth/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const record = await db.getOtpVerification(email);
    if (!record) {
      return res.status(400).json({ message: 'No registration session found. Sign up again.' });
    }

    // Check Lockout
    if (record.locked_until && new Date(record.locked_until) > new Date()) {
      return res.status(403).json({ message: 'Account creation is locked.' });
    }

    // Verify limit (max 3 resends)
    if (record.resend_count >= 3) {
      // Exceeded! Lock out for 18 hours
      const lockedUntil = new Date(Date.now() + 18 * 60 * 60 * 1000);
      await db.updateOtpVerification(email, record.otp_code, new Date(record.expires_at), record.resend_count, lockedUntil);
      return res.status(403).json({
        message: 'Resend limit reached (3 times). Registration is locked. Try again in 18 hours.'
      });
    }

    // Generate new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes expiry
    const newCount = record.resend_count + 1;

    // Save update
    await db.updateOtpVerification(email, newOtp, newExpiry, newCount, null);

    // Dispatch
    await sendOtpEmail(email, newOtp);

    res.json({ message: 'Verification code resent successfully', resend_count: newCount });
  } catch (err) {
    console.error('OTP resend error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const deletionHoldActive = !!user.deletion_hold_until;

    // Check and restore account deletion hold
    if (deletionHoldActive) {
      await db.setUserDeletionHold(user.username, null);
      console.log(`♻️ Cancelled account deletion hold for user: ${user.username}`);
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, accountRestored: deletionHoldActive });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Request Password Reset OTP
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email address is required' });
  }

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Email address not registered to any account.' });
    }

    // Check lockout on password resets
    const existingReset = await db.getPasswordReset(email);
    if (existingReset && existingReset.locked_until) {
      const lockDate = new Date(existingReset.locked_until);
      if (lockDate > new Date()) {
        const remainingHours = Math.ceil((lockDate - new Date()) / (1000 * 60 * 60));
        return res.status(403).json({
          message: `Too many failed attempts. Password recovery is locked. Try again after ${remainingHours} hours.`
        });
      }
    }

    // Generate random 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes expiry

    // Save reset state in database
    await db.createPasswordReset(email, otpCode, expiresAt);

    // Dispatch OTP
    await sendOtpEmail(email, otpCode);

    res.json({ message: 'Verification code sent to email' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify Password Reset OTP
app.post('/api/auth/verify-reset-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    const record = await db.getPasswordReset(email);
    if (!record) {
      return res.status(400).json({ message: 'Verification record not found. Please try again.' });
    }

    // Check Lockout
    if (record.locked_until && new Date(record.locked_until) > new Date()) {
      return res.status(403).json({ message: 'Password recovery is locked. Try again later.' });
    }

    // Check Expiry
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ message: 'Verification code has expired. Request a new code.' });
    }

    // Check Code
    if (record.otp_code !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    // OTP verified successfully. Issue a temporary 15-minute reset token.
    const resetToken = jwt.sign(
      { email: record.email, purpose: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ message: 'OTP verified successfully', resetToken });
  } catch (err) {
    console.error('Verify reset OTP error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Resend Password Reset OTP
app.post('/api/auth/resend-reset-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const record = await db.getPasswordReset(email);
    if (!record) {
      return res.status(400).json({ message: 'No active recovery session found. Submit your email again.' });
    }

    // Check Lockout
    if (record.locked_until && new Date(record.locked_until) > new Date()) {
      return res.status(403).json({ message: 'Password recovery is locked.' });
    }

    // Check resend limit (max 3 resends)
    if (record.resend_count >= 3) {
      const lockedUntil = new Date(Date.now() + 18 * 60 * 60 * 1000); // 18 hrs lockout
      await db.updatePasswordReset(email, record.otp_code, new Date(record.expires_at), record.resend_count, lockedUntil);
      return res.status(403).json({
        message: 'Resend limit reached (3 times). Password recovery is locked. Try again in 18 hours.'
      });
    }

    // Generate new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
    const newCount = record.resend_count + 1;

    // Save
    await db.updatePasswordReset(email, newOtp, newExpiry, newCount, null);

    // Dispatch
    await sendOtpEmail(email, newOtp);

    res.json({ message: 'Verification code resent successfully', resend_count: newCount });
  } catch (err) {
    console.error('Resend reset OTP error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reset User Password
app.post('/api/auth/reset-password', async (req, res) => {
  const { resetToken, password } = req.body;
  if (!resetToken || !password) {
    return res.status(400).json({ message: 'Reset token and new password are required' });
  }

  try {
    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid or expired password reset session. Start over.' });
    }

    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ message: 'Invalid authorization token' });
    }

    const email = decoded.email;

    // Password strength check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters, contain at least one capital letter, one lowercase letter, one number, and one symbol.'
      });
    }

    // Hash & update
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.updateUserPassword(email, hashedPassword);

    // Clear reset OTP record
    await db.deletePasswordReset(email);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Password reset endpoint error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Anonymous Guest Login
app.post('/api/auth/anonymous', (req, res) => {
  try {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const guestUsername = `Guest_${randomSuffix}`;
    const guestUserId = `guest_${Math.random().toString(36).substring(2, 11)}`;
    
    const token = jwt.sign(
      { userId: guestUserId, username: guestUsername, isAnonymous: true },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, username: guestUsername });
  } catch (err) {
    console.error('Anonymous auth error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Feedback & Data Deletion requests
app.post('/api/feedback', async (req, res) => {
  const { name, email, requestType, message } = req.body;
  if (!email || !message) {
    return res.status(400).json({ message: 'Email and message are required' });
  }

  try {
    const formattedType = (requestType || 'general').toLowerCase();
    const feedback = await db.createFeedback(name || 'Anonymous', email, `[Request Type: ${formattedType.toUpperCase()}] ${message}`);

    // Send notification email to subhani25052005@gmail.com
    await sendEmail(
      'subhani25052005@gmail.com',
      `GhostChat Contact Query: [${formattedType.toUpperCase()}]`,
      `You received a new message from GhostChat:\n\nSender: ${name || 'Anonymous'} (${email})\nType: ${formattedType.toUpperCase()}\nMessage: ${message}`
    );

    if (formattedType === 'deletion') {
      // Find user matching this email
      const user = await db.getUserByEmail(email);
      if (user) {
        // Place account on hold for 30 days
        const holdUntil = new Date();
        holdUntil.setDate(holdUntil.getDate() + 30);
        await db.setUserDeletionHold(user.username, holdUntil);

        // Send confirmation email to user
        await sendEmail(
          email,
          'GhostChat Account Deletion Scheduled (30-day Hold)',
          `Hello ${user.username},\n\nWe received your request to delete your account. Your account has been put on a 30-day hold.\n\nYou can restore and return to your account at any time within the next 30 days simply by logging back in. If you do not log in within 30 days, your account and all associated data will be permanently deleted.`
        );

        // Create deletion request record for Admin command centre
        const delReq = await db.createDeletionRequest(user.id, user.username, message);
        emitToAdmins('deletion:requested', delReq);
      }
    } else {
      // Create contact inquiry record for Admin command centre
      const inq = await db.createContactInquiry(name || 'Anonymous', email, formattedType, message);
      emitToAdmins('contact:new', inq);
    }

    res.status(201).json({ message: 'Feedback recorded successfully', feedback });
  } catch (err) {
    console.error('Feedback recording error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reports Submit (from public reports page or chat)
// Reports Submit
app.post('/api/reports', async (req, res) => {
  const { reporter_username, reported_username, reason, details, fingerprint } = req.body;
  const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();

  try {
    // Check if anonymous reporter is already banned
    const ipBanned = await db.isIpBanned(ip);
    if (ipBanned) {
      return res.status(403).json({ message: 'You are currently banned from this platform.' });
    }

    const report = await db.createReport({
      reporter_ip: ip,
      reported_ip: ip,
      reporter_username: reporter_username || 'Anonymous',
      reported_username: reported_username || 'Stranger',
      reason,
      details
    });

    // Notify admins about the new report
    emitToAdmins('report:submitted', report);

    // Notify reporter
    if (reporter_username && !reporter_username.startsWith('Guest') && !reporter_username.startsWith('Anonymous')) {
      const reporterNotif = await db.createNotification(reporter_username, 'system', 'report_confirmed', `Your report about ${reported_username || 'a user'} has been received.`);
      const reporterSocketId = onlineUsers.get(reporter_username);
      if (reporterSocketId) {
        io.to(reporterSocketId).emit('new_notification', reporterNotif);
      }
    }

    if (reported_username && reported_username !== 'Stranger' && !reported_username.startsWith('Guest') && !reported_username.startsWith('Anonymous')) {
      const user = await db.getUserByUsername(reported_username);
      if (user) {
        // Increment lifetime reports
        const lifetimeReports = await db.incrementLifetimeReports(reported_username);

        // Find the reported user's socket to notify them
        const reportedSocketId = onlineUsers.get(reported_username);

        if (lifetimeReports >= 15) {
          // PERMANENT DELETE at 15 lifetime reports
          const banExpires = new Date();
          banExpires.setFullYear(banExpires.getFullYear() + 99);
          await db.createBan(reported_username, `Permanently banned: ${lifetimeReports} total abuse reports.`, banExpires);
          await db.deleteUser(reported_username);

          emitToAdmins('ban:applied', { username: reported_username, reason: `Permanently banned: ${lifetimeReports} total abuse reports.` });

          if (reportedSocketId) {
            io.to(reportedSocketId).emit('account_action', {
              type: 'permanent_ban',
              message: 'Your account has been permanently deleted due to repeated abuse violations (15+ reports).'
            });
            const sock = io.sockets.sockets.get(reportedSocketId);
            if (sock) sock.disconnect(true);
          }
          if (user.email) await sendEmail(user.email, 'GhostChat Account Permanently Deleted', `Hello ${reported_username},\n\nYour GhostChat account has been permanently deleted due to accumulating 15 or more abuse reports.`);
        } else if (lifetimeReports >= 10 && lifetimeReports < 15) {
          // Second 20-day suspension at 10 reports
          const suspendUntil = new Date();
          suspendUntil.setDate(suspendUntil.getDate() + 20);
          await db.setUserSuspension(reported_username, suspendUntil);
          const suspendNotif = await db.createNotification(reported_username, 'system', 'suspension', `Second suspension issued (${lifetimeReports} total reports). Account suspended for 20 days until ${suspendUntil.toLocaleDateString()}.`);
          
          emitToAdmins('ban:applied', { username: reported_username, reason: `Suspended 20 days (${lifetimeReports} total reports)`, duration: '20 days' });
          
          if (reportedSocketId) {
            io.to(reportedSocketId).emit('new_notification', suspendNotif);
            io.to(reportedSocketId).emit('account_action', { type: 'suspended', until: suspendUntil.toISOString(), message: `Your account has been suspended for 20 days due to repeated reports.` });
          }
          if (user.email) await sendEmail(user.email, 'GhostChat Account Suspended (20 days)', `Hello ${reported_username},\n\nYour account has been suspended for 20 days (${lifetimeReports} total reports). It will be restored on ${suspendUntil.toLocaleDateString()}.`);
        } else if (lifetimeReports >= 5 && lifetimeReports < 10) {
          // First 20-day suspension at 5 reports
          const suspendUntil = new Date();
          suspendUntil.setDate(suspendUntil.getDate() + 20);
          await db.setUserSuspension(reported_username, suspendUntil);
          const suspendNotif = await db.createNotification(reported_username, 'system', 'suspension', `Your account has been suspended for 20 days (${lifetimeReports} reports received). Suspended until ${suspendUntil.toLocaleDateString()}.`);
          
          emitToAdmins('ban:applied', { username: reported_username, reason: `Suspended 20 days (${lifetimeReports} total reports)`, duration: '20 days' });

          if (reportedSocketId) {
            io.to(reportedSocketId).emit('new_notification', suspendNotif);
            io.to(reportedSocketId).emit('account_action', { type: 'suspended', until: suspendUntil.toISOString(), message: `Your account has been suspended for 20 days.` });
          }
          if (user.email) await sendEmail(user.email, 'GhostChat Account Suspended', `Hello ${reported_username},\n\nYour account has been suspended for 20 days due to ${lifetimeReports} abuse reports. You can return on ${suspendUntil.toLocaleDateString()}.`);
        } else {
          // Warning (< 5 reports)
          const warnNotif = await db.createNotification(reported_username, 'system', 'report_warning', `Warning: You have received ${lifetimeReports} abuse report(s). Reason: ${reason}. Accumulating 5 reports will result in a 20-day suspension.`);
          if (reportedSocketId) {
            io.to(reportedSocketId).emit('new_notification', warnNotif);
          }
          if (user.email) await sendEmail(user.email, 'GhostChat Abuse Warning', `Hello ${reported_username},\n\nYou have received ${lifetimeReports}/5 abuse reports. Reason: ${reason}. 5 reports = 20-day suspension. 15 total = permanent ban.`);
        }
      }
    } else if (reported_username && (reported_username.startsWith('Guest') || reported_username.startsWith('Anonymous'))) {
      // Anonymous user abuse: ban their IP and fingerprint
      const banExpires = new Date();
      banExpires.setDate(banExpires.getDate() + 20);
      await db.createIpBan('ip', ip, `Anonymous abuse report: ${reason}`, banExpires);
      emitToAdmins('ban:applied', { username: reported_username, reason: `Anonymous abuse report: ${reason} (IP Banned)` });
      if (fingerprint) {
        await db.createIpBan('fingerprint', fingerprint, `Anonymous abuse report: ${reason}`, banExpires);
      }
    }

    res.status(201).json({ message: 'Report recorded successfully', report });
  } catch (err) {
    console.error('Report filing error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Middleware: Authenticate REST requests
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
}

// REST: Get User Profile
app.get('/api/users/:username/profile', async (req, res) => {
  const { username } = req.params;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let requester = null;
  if (token) {
    try {
      requester = jwt.verify(token, JWT_SECRET);
    } catch (err) {}
  }

  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followersCount = await db.getFollowersCount(username);
    const followingCount = await db.getFollowingCount(username);

    let relation = 'none';
    if (requester && requester.username !== username) {
      const relOut = await db.getFollowRelationship(requester.username, username);
      const relIn = await db.getFollowRelationship(username, requester.username);
      
      if (relOut && relOut.status === 'accepted') {
        relation = 'accepted';
      } else if (relOut && relOut.status === 'pending') {
        relation = 'pending';
      } else if (relIn && relIn.status === 'pending') {
        relation = 'incoming_pending';
      }
    }

    let isMutual = false;
    if (requester && requester.username !== username) {
      const relOut = await db.getFollowRelationship(requester.username, username);
      const relIn = await db.getFollowRelationship(username, requester.username);
      isMutual = !!(relOut && relOut.status === 'accepted' && relIn && relIn.status === 'accepted');
    }

    res.json({
      username: user.username,
      nickname: user.nickname || '',
      bio: user.bio || '',
      profile_img: user.profile_img || '',
      followersCount,
      followingCount,
      relation,
      isMutual
    });
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Update User Profile
app.put('/api/profile', authenticateToken, async (req, res) => {
  if (req.user.isAnonymous) {
    return res.status(403).json({ message: 'Guest profiles cannot be modified' });
  }

  const { nickname, bio, profile_img } = req.body;
  try {
    const updated = await db.updateUserProfile(req.user.username, nickname, bio, profile_img);

    // Emit to admin panel
    emitToAdmins('user:updated', { id: req.user.userId, username: req.user.username, nickname, bio, profile_img });

    res.json({
      message: 'Profile updated successfully',
      user: {
        username: updated.username,
        nickname: updated.nickname,
        bio: updated.bio,
        profile_img: updated.profile_img
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Send Follow Request
app.post('/api/follow/request', authenticateToken, async (req, res) => {
  if (req.user.isAnonymous) {
    return res.status(403).json({ message: 'Guests cannot perform follow actions' });
  }

  const { targetUsername } = req.body;
  if (!targetUsername || targetUsername === req.user.username) {
    return res.status(400).json({ message: 'Invalid target username' });
  }

  try {
    const targetUser = await db.getUserByUsername(targetUsername);
    if (!targetUser) return res.status(404).json({ message: 'Target user not found' });

    const relationship = await db.sendFollowRequest(req.user.username, targetUsername);
    const notif = await db.createNotification(targetUsername, req.user.username, 'follow_request');

    const targetSocketId = onlineUsers.get(targetUsername);
    if (targetSocketId) {
      io.to(targetSocketId).emit('new_notification', {
        id: notif.id,
        sender_username: req.user.username,
        type: 'follow_request',
        status: 'unread',
        created_at: notif.created_at
      });
    }

    res.json({ message: 'Follow request sent', relationship });
  } catch (err) {
    console.error('Follow request error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Accept Follow Request
app.post('/api/follow/accept', authenticateToken, async (req, res) => {
  if (req.user.isAnonymous) {
    return res.status(403).json({ message: 'Guests cannot perform follow actions' });
  }

  const { targetUsername } = req.body;
  if (!targetUsername) return res.status(400).json({ message: 'Target username is required' });

  try {
    const relationship = await db.acceptFollowRequest(targetUsername, req.user.username);
    await db.deleteFollowRequestNotification(targetUsername, req.user.username);
    const notif = await db.createNotification(targetUsername, req.user.username, 'follow_accept');

    const targetSocketId = onlineUsers.get(targetUsername);
    if (targetSocketId) {
      io.to(targetSocketId).emit('new_notification', {
        id: notif.id,
        sender_username: req.user.username,
        type: 'follow_accept',
        status: 'unread',
        created_at: notif.created_at
      });
      io.to(targetSocketId).emit('follow_update');
    }

    // Emit follow_back_prompt to the accepter so they see a "Follow Back?" popup
    const accepterSocketId = onlineUsers.get(req.user.username);
    if (accepterSocketId) {
      io.to(accepterSocketId).emit('follow_back_prompt', { targetUsername });
    }

    res.json({ message: 'Follow request accepted', relationship });
  } catch (err) {
    console.error('Accept follow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Decline Follow Request
app.post('/api/follow/decline', authenticateToken, async (req, res) => {
  if (req.user.isAnonymous) {
    return res.status(403).json({ message: 'Guests cannot perform follow actions' });
  }
  const { targetUsername } = req.body;
  if (!targetUsername) return res.status(400).json({ message: 'Target username is required' });
  try {
    await db.declineFollowRequest(targetUsername, req.user.username);
    res.json({ message: 'Follow request declined' });
  } catch (err) {
    console.error('Decline follow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Decline Follow Request
app.post('/api/follow/decline', authenticateToken, async (req, res) => {
  if (req.user.isAnonymous) {
    return res.status(403).json({ message: 'Guests cannot perform follow actions' });
  }

  const { targetUsername } = req.body;
  if (!targetUsername) return res.status(400).json({ message: 'Target username is required' });

  try {
    await db.unfollowUser(targetUsername, req.user.username);
    await db.deleteFollowRequestNotification(targetUsername, req.user.username);
    res.json({ message: 'Follow request declined' });
  } catch (err) {
    console.error('Decline follow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Unfollow User
app.delete('/api/follow/unfollow', authenticateToken, async (req, res) => {
  if (req.user.isAnonymous) {
    return res.status(403).json({ message: 'Guests cannot perform follow actions' });
  }

  const { targetUsername } = req.body;
  if (!targetUsername) return res.status(400).json({ message: 'Target username is required' });

  try {
    await db.unfollowUser(req.user.username, targetUsername);
    await db.deleteFollowRequestNotification(req.user.username, targetUsername);
    res.json({ message: 'Unfollowed successfully' });
  } catch (err) {
    console.error('Unfollow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Get Followers List
app.get('/api/followers', authenticateToken, async (req, res) => {
  try {
    const list = await db.getFollowers(req.user.username);
    res.json(list);
  } catch (err) {
    console.error('Get followers list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Get Following List
app.get('/api/following', authenticateToken, async (req, res) => {
  try {
    const list = await db.getFollowing(req.user.username);
    res.json(list);
  } catch (err) {
    console.error('Get following list error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Get Notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const list = await db.getNotifications(req.user.username);
    res.json(list);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Mark Notifications Read
app.put('/api/notifications/read', authenticateToken, async (req, res) => {
  try {
    await db.markNotificationsRead(req.user.username);
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    console.error('Mark read notifications error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Delete Notification
app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.deleteNotification(id);
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Online Mutual Followers
app.get('/api/followers/mutual-online', authenticateToken, async (req, res) => {
  try {
    const followers = await db.getFollowers(req.user.username);
    const following = await db.getFollowing(req.user.username);
    const followingNames = following.map(u => u.username);
    const mutuals = followers.filter(u => followingNames.includes(u.username));
    
    const list = mutuals.map(u => ({
      ...u,
      online: onlineUsers.has(u.username)
    }));
    res.json(list);
  } catch (err) {
    console.error('Fetch mutual online error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// REST: Assign Anonymous Sequential ID
app.post('/api/anonymous/assign', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
  const { fingerprint } = req.body;

  // Check if IP is banned
  const ipBanned = await db.isIpBanned(ip);
  if (ipBanned) {
    const until = ipBanned.expires_at ? new Date(ipBanned.expires_at).toLocaleDateString() : 'indefinitely';
    return res.status(403).json({ message: `Access denied. Your network is banned until ${until}.`, banned: true });
  }

  // Check if fingerprint is banned
  if (fingerprint) {
    const fpBanned = await db.isFingerprintBanned(fingerprint);
    if (fpBanned) {
      const until = fpBanned.expires_at ? new Date(fpBanned.expires_at).toLocaleDateString() : 'indefinitely';
      return res.status(403).json({ message: `Access denied. Your device is banned until ${until}.`, banned: true });
    }
  }

  try {
    const num = await db.getNextAnonId();
    const anonId = String(num).padStart(6, '0');
    const anonUsername = `Anonymous_${anonId}`;
    const token = jwt.sign({ username: anonUsername, isAnonymous: true, anonNum: num }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ username: anonUsername, displayName: `Anonymous #${anonId}`, token });
  } catch (err) {
    console.error('Anon assign error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Release Anonymous Sequential ID
app.all('/api/anonymous/release', (req, res) => {
  res.json({ message: 'Anonymous ID released' });
});

// REST: Check IP ban status
app.get('/api/bans/check', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
  const { fingerprint } = req.query;
  const ipBanned = await db.isIpBanned(ip);
  if (ipBanned) return res.json({ banned: true, reason: ipBanned.reason, expires_at: ipBanned.expires_at });
  if (fingerprint) {
    const fpBanned = await db.isFingerprintBanned(fingerprint);
    if (fpBanned) return res.json({ banned: true, reason: fpBanned.reason, expires_at: fpBanned.expires_at });
  }
  return res.json({ banned: false });
});

// REST: Profile sync broadcast (called after profile update)
app.post('/api/profile/sync', authenticateToken, async (req, res) => {
  const { nickname, bio, profile_img } = req.body;
  const username = req.user.username;
  // Broadcast to all sockets of this user
  const socketId = onlineUsers.get(username);
  if (socketId) {
    io.to(socketId).emit('profile_updated', { username, nickname, bio, profile_img });
  }
  // Also broadcast to all users who follow them (so their peer profile cards update)
  try {
    const followers = await db.getFollowers(username);
    followers.forEach(follower => {
      const followerSocketId = onlineUsers.get(follower.username);
      if (followerSocketId) {
        io.to(followerSocketId).emit('peer_profile_updated', { username, nickname, bio, profile_img });
      }
    });
  } catch { /* ignore */ }
  res.json({ message: 'Profile sync broadcast sent' });
});

// Map of online registered usernames -> socketId
const onlineUsers = new Map();

// Map of roomId -> socketId for private matches
const privateRooms = new Map();

// Admin socket namespace
const adminIo = io.of('/admin');

// Middleware: Authenticate Admin Socket connection
adminIo.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return next(new Error('Authentication error: Invalid token'));
    const admin = await db.getAdminById(decoded.adminId);
    if (!admin || !admin.is_active) {
      return next(new Error('Authentication error: Admin account deactivated or missing'));
    }
    socket.admin = admin;
    next();
  });
});

adminIo.on('connection', (socket) => {
  console.log(`🔑 Admin socket connected: ${socket.id} (User: ${socket.admin.username}, Role: ${socket.admin.role})`);
  
  socket.on('disconnect', () => {
    console.log(`🔒 Admin socket disconnected: ${socket.id}`);
  });
});

function emitToAdmins(event, payload) {
  adminIo.emit(event, payload);
}

// --- ADMIN PANEL API CONFIGURATIONS & ENDPOINTS ---

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce((acc, c) => {
    const [key, ...val] = c.trim().split('=');
    acc[key] = val.join('=');
    return acc;
  }, {});
  return cookies[name] || null;
}

function setAdminCookies(res, accessToken, refreshToken) {
  res.cookie('admin_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 mins
  });
  res.cookie('admin_refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

function clearAdminCookies(res) {
  res.clearCookie('admin_access_token');
  res.clearCookie('admin_refresh_token');
}

// Middleware: Authenticate Admin Access
function authenticateAdminToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    token = getCookie(req, 'admin_access_token');
  }

  if (!token) return res.status(401).json({ message: 'Admin access token required' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired admin token' });
    
    // Verify session in DB/JSON
    const session = await db.getAdminSession(token);
    if (!session || !session.is_active) {
      return res.status(403).json({ message: 'Admin session terminated or inactive' });
    }

    const admin = await db.getAdminById(decoded.adminId);
    if (!admin || !admin.is_active) {
      return res.status(403).json({ message: 'Admin account deactivated or missing' });
    }

    req.admin = admin;
    req.adminToken = token;
    next();
  });
}

// Middleware: Restrict by role claims
function requireAdminRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ message: 'Admin auth required' });
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ message: 'Permission denied: Insufficient role permissions' });
    }
    next();
  };
}

// REST: Admin Login
console.log("🔥 ADMIN LOGIN ROUTE LOADED");
app.post('/api/admin/auth/login', async (req, res) => {
  const { username, password, deviceFingerprint } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const admin = await db.getAdminByUsername(username);
    if (!admin || !admin.is_active) {
      return res.status(400).json({ message: 'Invalid credentials or inactive account' });
    }

    // Check Lockout
    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      return res.status(403).json({ message: 'Account is locked. Please try again later.' });
    }

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      const attempts = (admin.login_attempts || 0) + 1;
      const updates = { login_attempts: attempts };
      if (attempts >= 10) {
        updates.locked_until = new Date(Date.now() + 15 * 60 * 1000); // lock 15 mins
      }
      await db.updateAdminUser(admin.id, updates);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Reset login attempts
    await db.updateAdminUser(admin.id, { login_attempts: 0, locked_until: null });

    // If 2FA is enabled, require code challenge
    if (admin.twofa_enabled) {
      const tempToken = jwt.sign({ adminId: admin.id, pending2FA: true }, JWT_SECRET, { expiresIn: '5m' });
      return res.json({ requires2FA: true, tempToken, adminId: admin.id });
    }

    // Otherwise proceed (forces 2FA setup on client side)
    const accessToken = jwt.sign({ adminId: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: '7d' });

    // Save session
    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.createAdminSession(admin.id, accessToken, refreshToken, new Date(Date.now() + 15 * 60 * 1000), ip, ua, deviceFingerprint || 'unknown');
    
    // Log login
    await db.writeAuditLog(admin.id, admin.username, admin.role, ip, ua, deviceFingerprint || 'unknown', 'LOGIN', 'admin_users', admin.id, null, null);

    setAdminCookies(res, accessToken, refreshToken);
    res.json({
      requires2FA: false,
      setup2FA: true,
      token: accessToken,
      admin: { id: admin.id, username: admin.username, role: admin.role, password_changed: admin.password_changed }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Verify TOTP Code
app.post('/api/admin/auth/2fa/verify', async (req, res) => {
  const { code, tempToken, adminId, setupSecret } = req.body;
  if (!code) return res.status(400).json({ message: 'Verification code is required' });

  try {
    let resolvedAdminId = adminId;
    if (tempToken) {
      try {
        const decoded = jwt.verify(tempToken, JWT_SECRET);
        resolvedAdminId = decoded.adminId;
      } catch {
        return res.status(400).json({ message: 'Invalid or expired login session' });
      }
    }

    if (!resolvedAdminId) return res.status(400).json({ message: 'Admin ID required' });

    const admin = await db.getAdminById(resolvedAdminId);
    if (!admin) return res.status(400).json({ message: 'Administrator not found' });

    const secret = setupSecret || admin.twofa_secret;
    if (!secret) return res.status(400).json({ message: 'No 2FA secret set up yet' });

    const verified = verifyTOTP(secret, code);
    if (!verified) {
      return res.status(400).json({ message: 'Invalid authenticator code' });
    }

    // If this is setup enrollment
    if (setupSecret) {
      await db.updateAdmin2FA(admin.id, setupSecret, true);
      const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
      const ua = req.headers['user-agent'] || 'unknown';
      await db.writeAuditLog(admin.id, admin.username, admin.role, ip, ua, 'unknown', '2FA_SETUP', 'admin_users', admin.id, null, null);
      return res.json({ message: '2FA setup verified successfully!' });
    }

    // Complete login session
    const accessToken = jwt.sign({ adminId: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: '7d' });

    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.createAdminSession(admin.id, accessToken, refreshToken, new Date(Date.now() + 15 * 60 * 1000), ip, ua, 'unknown');
    
    // Log login
    await db.writeAuditLog(admin.id, admin.username, admin.role, ip, ua, 'unknown', 'LOGIN_2FA', 'admin_users', admin.id, null, null);

    setAdminCookies(res, accessToken, refreshToken);
    res.json({
      token: accessToken,
      admin: { id: admin.id, username: admin.username, role: admin.role, password_changed: admin.password_changed }
    });
  } catch (err) {
    console.error('2FA verification failure:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Initiate 2FA Setup secret
app.post('/api/admin/auth/2fa/setup', authenticateAdminToken, async (req, res) => {
  const crypto = require('crypto');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 16; i++) {
    secret += alphabet[crypto.randomInt(0, alphabet.length)];
  }

  const qrUri = `otpauth://totp/GhostChat:${req.admin.username}?secret=${secret}&issuer=GhostChat`;
  res.json({ secret, qrUri });
});

// REST: Refresh admin session
app.post('/api/admin/auth/refresh', async (req, res) => {
  let token = getCookie(req, 'admin_refresh_token');
  if (!token) return res.status(401).json({ message: 'Refresh token required' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid refresh token' });
    const admin = await db.getAdminById(decoded.adminId);
    if (!admin || !admin.is_active) return res.status(403).json({ message: 'Admin inactive' });

    const accessToken = jwt.sign({ adminId: admin.id, username: admin.username, role: admin.role }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: '7d' });

    setAdminCookies(res, accessToken, refreshToken);
    res.json({ token: accessToken });
  });
});

// REST: Admin Logout
app.post('/api/admin/auth/logout', authenticateAdminToken, async (req, res) => {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.deactivateAdminSession(req.adminToken);
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'LOGOUT', 'admin_users', req.admin.id, null, null);
    clearAdminCookies(res);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Current admin user profile
app.get('/api/admin/auth/me', authenticateAdminToken, (req, res) => {
  res.json({
    id: req.admin.id,
    username: req.admin.username,
    role: req.admin.role,
    password_changed: req.admin.password_changed,
    twofa_enabled: req.admin.twofa_enabled
  });
});

// REST: Super Admin users management CRUD
app.get('/api/admin/users', authenticateAdminToken, requireAdminRole(['super_admin']), async (req, res) => {
  try {
    const list = await db.getAdminUsers();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/users', authenticateAdminToken, requireAdminRole(['super_admin']), async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const newAdmin = await db.createAdminUser(username, email, hash, role);
    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'CREATE_ADMIN', 'admin_users', newAdmin.id, null, { username, role });
    res.status(201).json({ message: 'Admin user created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/admin/users/:id', authenticateAdminToken, requireAdminRole(['super_admin']), async (req, res) => {
  const { id } = req.params;
  const { role, is_active, password } = req.body;
  try {
    const updates = {};
    if (role) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
      updates.password_changed = false; // force change
    }

    const previous = await db.getAdminById(id);
    const updated = await db.updateAdminUser(id, updates);
    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'UPDATE_ADMIN', 'admin_users', id, previous, updated);
    res.json({ message: 'Admin updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/admin/users/:id', authenticateAdminToken, requireAdminRole(['super_admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const previous = await db.getAdminById(id);
    await db.deleteAdminUser(id);
    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'DELETE_ADMIN', 'admin_users', id, previous, null);
    res.json({ message: 'Admin deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Change Password (forced or manual)
app.post('/api/admin/auth/change-password', authenticateAdminToken, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 20) {
    return res.status(400).json({ message: 'Password must be at least 20 characters long.' });
  }

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await db.updateAdminUser(req.admin.id, { password_hash: hash, password_changed: true });
    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'CHANGE_PASSWORD', 'admin_users', req.admin.id, null, null);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: List platform users with filters
app.get('/api/admin/platform/users', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'moderator']), async (req, res) => {
  const { search, status, offset, limit } = req.query;
  try {
    const list = await db.getPlatformUsersFiltered(search, status, null, parseInt(offset || '0'), parseInt(limit || '50'));
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Suspend Platform User
app.post('/api/admin/platform/users/:id/suspend', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'moderator']), async (req, res) => {
  const { id } = req.params; // username
  const { durationDays, reason } = req.body;

  try {
    const user = await db.getUserByUsername(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const expires = new Date();
    expires.setDate(expires.getDate() + parseInt(durationDays || '20'));

    await db.setUserSuspension(id, expires);

    // Disconnect user socket if online
    const socketId = onlineUsers.get(id);
    if (socketId) {
      io.to(socketId).emit('account_action', { type: 'suspended', until: expires.toISOString(), message: `Your account is suspended for repeated abuse: ${reason}.` });
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.disconnect(true);
    }

    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'USER_SUSPEND', 'users', id, null, { expires, reason });

    emitToAdmins('ban:applied', { username: id, reason, duration: `${durationDays || 20} days` });

    res.json({ message: 'User suspended successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Ban platform user
app.post('/api/admin/platform/users/:id/ban', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'moderator']), async (req, res) => {
  const { id } = req.params; // username
  const { reason } = req.body;

  try {
    const user = await db.getUserByUsername(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await db.createBan(id, reason, null);

    // Disconnect user socket if online
    const socketId = onlineUsers.get(id);
    if (socketId) {
      io.to(socketId).emit('account_action', { type: 'permanent_ban', message: `Your account is permanently banned: ${reason}.` });
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.disconnect(true);
    }

    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'USER_BAN', 'users', id, null, { reason });

    emitToAdmins('ban:applied', { username: id, reason });

    res.json({ message: 'User banned successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Unban platform user
app.post('/api/admin/platform/users/:id/unban', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'moderator']), async (req, res) => {
  const { id } = req.params; // username
  try {
    await db.deleteBan(id);
    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'USER_UNBAN', 'users', id, null, null);

    emitToAdmins('ban:lifted', { username: id });

    res.json({ message: 'User unbanned successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Unsuspend platform user
app.post('/api/admin/platform/users/:id/unsuspend', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'moderator']), async (req, res) => {
  const { id } = req.params; // username
  try {
    await db.unsuspendUser(id);
    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'USER_UNSUSPEND', 'users', id, null, null);

    emitToAdmins('ban:lifted', { username: id });

    res.json({ message: 'User unsuspended successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Delete Platform User permanently
app.delete('/api/admin/platform/users/:id', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin']), async (req, res) => {
  const { id } = req.params; // username
  try {
    const user = await db.getUserByUsername(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Disconnect user if online
    const socketId = onlineUsers.get(id);
    if (socketId) {
      io.to(socketId).emit('account_action', { type: 'permanent_ban', message: 'Your account has been deleted permanently.' });
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.disconnect(true);
    }

    await db.executeUserDeletion(id);

    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'USER_DELETE', 'users', id, null, null);

    emitToAdmins('deletion:executed', { username: id });

    res.json({ message: 'User deleted permanently' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Force Logout User
app.post('/api/admin/platform/users/:id/force-logout', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'moderator']), async (req, res) => {
  const { id } = req.params; // username
  try {
    const socketId = onlineUsers.get(id);
    if (socketId) {
      io.to(socketId).emit('account_action', { type: 'force_logout', message: 'An administrator forced your session to terminate.' });
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.disconnect(true);
    }

    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'USER_FORCE_LOGOUT', 'users', id, null, null);

    res.json({ message: 'User force-logged out' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Send Warning Message
app.post('/api/admin/platform/users/:id/warn', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'moderator']), async (req, res) => {
  const { id } = req.params; // username
  const { message } = req.body;

  try {
    const notif = await db.createNotification(id, 'system', 'report_warning', `Warning: Admin message: ${message}`);
    const socketId = onlineUsers.get(id);
    if (socketId) {
      io.to(socketId).emit('new_notification', notif);
    }

    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'USER_WARN', 'users', id, null, { message });

    res.json({ message: 'Warning sent successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Send System Notification
app.post('/api/admin/platform/users/:id/notify', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'moderator']), async (req, res) => {
  const { id } = req.params; // username
  const { message } = req.body;

  try {
    const notif = await db.createNotification(id, 'system', 'system_alert', message);
    const socketId = onlineUsers.get(id);
    if (socketId) {
      io.to(socketId).emit('new_notification', notif);
    }

    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'USER_NOTIFY', 'users', id, null, { message });

    res.json({ message: 'Notification sent successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: List Reports
app.get('/api/admin/reports', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'moderator']), async (req, res) => {
  try {
    const list = await db.getReportsWithDetails();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Resolve Report
app.put('/api/admin/reports/:id/resolve', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'moderator']), async (req, res) => {
  const { id } = req.params;
  try {
    // mark resolved
    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'REPORT_RESOLVE', 'reports', id, null, null);
    res.json({ message: 'Report resolved' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Contacts
app.get('/api/admin/contacts', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'support_admin']), async (req, res) => {
  try {
    const list = await db.getContactInquiries();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/contacts/:id', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'support_admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const details = await db.getContactInquiryById(id);
    res.json(details);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/contacts/:id/reply', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'support_admin']), async (req, res) => {
  const { id } = req.params;
  const { reply } = req.body;

  try {
    await db.createContactReply(id, req.admin.id, reply);
    await db.updateContactInquiryStatus(id, 'resolved', req.admin.id);

    // If inquirer user is online, emit WS update
    const inquiry = await db.getContactInquiryById(id);
    if (inquiry && inquiry.username) {
      const userSocketId = onlineUsers.get(inquiry.username);
      if (userSocketId) {
        io.to(userSocketId).emit('contact_reply', { inquiryId: id, reply });
      }
    }

    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'CONTACT_REPLY', 'contact_inquiries', id, null, { reply });

    emitToAdmins('contact:replied', { inquiryId: id, reply });

    res.json({ message: 'Reply sent and inquiry marked resolved' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Deletion Requests list
app.get('/api/admin/deletion-requests', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin', 'support_admin']), async (req, res) => {
  try {
    const list = await db.getDeletionRequests();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/admin/deletion-requests/:id/execute', authenticateAdminToken, requireAdminRole(['super_admin', 'platform_admin']), async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  try {
    await db.executeUserDeletion(username);
    await db.resolveDeletionRequest(id, 'deleted', req.admin.id);

    const ip = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
    const ua = req.headers['user-agent'] || 'unknown';
    await db.writeAuditLog(req.admin.id, req.admin.username, req.admin.role, ip, ua, 'unknown', 'DELETION_EXECUTE', 'deletion_requests', id, null, { username });

    emitToAdmins('deletion:executed', { username });

    res.json({ message: 'User data purged successfully!' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Metrics analytics
app.get('/api/admin/analytics/metrics', authenticateAdminToken, async (req, res) => {
  try {
    const metrics = await db.getAdminMetrics();
    // Add real-time online count
    metrics.onlineCount = totalOnline;
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Audit trail log search
app.get('/api/admin/audit', authenticateAdminToken, requireAdminRole(['super_admin']), async (req, res) => {
  try {
    const list = await db.getAuditLogs();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// REST: Server Health status
app.get('/api/admin/health', authenticateAdminToken, (req, res) => {
  const os = require('os');
  res.json({
    status: 'healthy',
    cpuUsage: os.loadavg()[0] * 100 / os.cpus().length,
    freeMemPercent: os.freemem() * 100 / os.totalmem(),
    uptime: os.uptime(),
    dbStatus: 'connected',
    onlineSockets: totalOnline
  });
});

// Map of socketId → User state
const users = new Map();

// Queue: [{ socketId, interests, mode, language, country }]
const waitingQueue = [];

let totalOnline = 0;

function broadcastOnlineCount() {
  io.emit('online_count', totalOnline);
}

// Scored matchmaking
function findBestMatch(newUser) {
  let bestIndex = -1;
  let bestScore = -1;

  for (let i = 0; i < waitingQueue.length; i++) {
    const candidate = waitingQueue[i];
    if (candidate.socketId === newUser.socketId) continue;

    const candUser = users.get(candidate.socketId);
    const newU = users.get(newUser.socketId);
    if (!candUser || !newU) continue;

    // Check block list
    if (candUser.blockedList.includes(newU.ip) || candUser.blockedList.includes(newU.username)) continue;
    if (newU.blockedList.includes(candUser.ip) || newU.blockedList.includes(candUser.username)) continue;

    let score = 0;

    // Mode Match (Video vs Text) — critical constraint
    if (candidate.mode !== newUser.mode) continue;

    // Country Filter Constraint
    if (newUser.country !== 'all' && candidate.country !== newUser.country) continue;
    if (candidate.country !== 'all' && newUser.country !== candidate.country) continue;

    // Language Filter Constraint
    if (newUser.language !== 'all' && candidate.language !== newUser.language) continue;
    if (candidate.language !== 'all' && newUser.language !== candidate.language) continue;

    // Interest overlapping score
    const commonInterests = candidate.interests.filter(tag =>
      newUser.interests.includes(tag)
    );
    score += commonInterests.length * 10;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function pairUsers(socketIdA, socketIdB) {
  const userA = users.get(socketIdA);
  const userB = users.get(socketIdB);

  if (!userA || !userB) return;

  userA.partner = socketIdB;
  userB.partner = socketIdA;

  // A is initiator (makes offer)
  userA.socket.emit('matched', { initiator: true, partnerId: socketIdB, partnerUsername: userB.username });
  userB.socket.emit('matched', { initiator: false, partnerId: socketIdA, partnerUsername: userA.username });

  console.log(`✅ Paired: ${userA.username || socketIdA} ↔ ${userB.username || socketIdB}`);
}

function removeFromQueue(socketId) {
  const idx = waitingQueue.findIndex(u => u.socketId === socketId);
  if (idx !== -1) waitingQueue.splice(idx, 1);
}

function disconnectFromPartner(socketId) {
  const user = users.get(socketId);
  if (!user || !user.partner) return;

  const partner = users.get(user.partner);
  if (partner) {
    partner.partner = null;
    partner.socket.emit('stranger_disconnected');
  }

  user.partner = null;
}

// Socket Middleware: Validate JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: Token required'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', async (socket) => {
  // Check IP Ban
  const rawIp = socket.handshake.address || socket.conn.remoteAddress || '127.0.0.1';
  const ip = rawIp.replace('::ffff:', '');

  const ipBanned = await db.isIpBanned(ip);
  if (ipBanned) {
    socket.emit('account_action', { type: 'ip_banned', message: `Your network has been temporarily banned. Reason: ${ipBanned.reason}` });
    socket.disconnect(true);
    return;
  }

  // Check username ban / suspension
  if (socket.user && !socket.user.isAnonymous) {
    const userBan = await db.isBanned(socket.user.username);
    if (userBan) {
      socket.emit('account_action', { type: 'permanent_ban', message: `Your account has been permanently banned. Reason: ${userBan.reason}` });
      socket.disconnect(true);
      return;
    }
    const suspended = await db.isUserSuspended(socket.user.username);
    if (suspended) {
      const until = new Date(suspended.suspended_until).toLocaleDateString();
      socket.emit('account_action', { type: 'suspended', until: suspended.suspended_until, message: `Your account is suspended until ${until}.` });
      socket.disconnect(true);
      return;
    }
  }

  totalOnline++;
  broadcastOnlineCount();

  const connUsername = socket.user?.username || 'Guest_' + Math.floor(1000 + Math.random() * 9000);

  // Emit to admin panel
  emitToAdmins('user:online', { username: connUsername, status: 'online' });
  emitToAdmins('metrics:update', { onlineCount: totalOnline });

  if (socket.user && !socket.user.isAnonymous) {
    onlineUsers.set(socket.user.username, socket.id);
  }

  users.set(socket.id, {
    socket,
    ip,
    username: connUsername,
    interests: [],
    partner: null,
    mode: 'video',
    language: 'all',
    country: 'all',
    blockedList: []
  });

  console.log(`🟢 Connected: ${socket.id} (${ip}) | Total: ${totalOnline} | User: ${connUsername}`);

  // Find Stranger matching
  socket.on('find_stranger', async ({ interests = [], language = 'all', country = 'all', mode = 'video', username }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const targetUsername = socket.user?.username || username || user.username;
    // Check Username Ban
    const userBanned = await db.isBanned(targetUsername);
    if (userBanned) {
      socket.emit('chat_message', { text: `🔴 Access Denied: Your account has been permanently banned. Reason: ${userBanned.reason}`, from: 'system' });
      socket.disconnect(true);
      return;
    }
    user.username = targetUsername;

    if (user.partner) {
      disconnectFromPartner(socket.id);
    }

    user.interests = interests;
    user.language = language;
    user.country = country;
    user.mode = mode;
    user.partner = null;

    removeFromQueue(socket.id);

    const bestIdx = findBestMatch({ socketId: socket.id, interests, language, country, mode });

    if (bestIdx !== -1) {
      const matched = waitingQueue.splice(bestIdx, 1)[0];
      pairUsers(socket.id, matched.socketId);
    } else {
      waitingQueue.push({ socketId: socket.id, interests, language, country, mode });
      socket.emit('waiting');
      console.log(`⏳ Waiting: ${socket.id} | Queue: ${waitingQueue.length}`);
    }
  });

  // Join Private Room Matching
  socket.on('join_private_room', ({ roomId, username }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const targetUsername = socket.user?.username || username || user.username;
    user.username = targetUsername;

    if (user.partner) {
      disconnectFromPartner(socket.id);
    }
    user.partner = null;

    removeFromQueue(socket.id);

    if (socket.user && !socket.user.isAnonymous) {
      onlineUsers.set(socket.user.username, socket.id);
    }

    if (privateRooms.has(roomId)) {
      const partnerSocketId = privateRooms.get(roomId);
      if (partnerSocketId === socket.id) return;

      privateRooms.delete(roomId);
      pairUsers(socket.id, partnerSocketId);
    } else {
      privateRooms.set(roomId, socket.id);
      socket.emit('waiting');
      console.log(`⏳ Private match waiting in room ${roomId} for: ${socket.id} (User: ${targetUsername})`);
    }
  });

  // Follow Realtime updates
  socket.on('follow_request', ({ targetUsername }) => {
    const sender = socket.user?.username;
    if (!sender || sender === targetUsername) return;

    const targetSocketId = onlineUsers.get(targetUsername);
    if (targetSocketId) {
      io.to(targetSocketId).emit('follow_request_incoming', { senderUsername: sender });
    }
  });

  socket.on('follow_accept', ({ targetUsername }) => {
    const accepter = socket.user?.username;
    if (!accepter) return;

    const targetSocketId = onlineUsers.get(targetUsername);
    if (targetSocketId) {
      io.to(targetSocketId).emit('follow_accepted_incoming', { accepterUsername: accepter });
      io.to(targetSocketId).emit('follow_update');
    }
    // Also emit follow_back_prompt to the accepter
    io.to(socket.id).emit('follow_back_prompt', { targetUsername });
  });

  // Direct calls
  socket.on('private_invite', async ({ targetUsername }) => {
    const sender = socket.user?.username;
    if (!sender || sender === targetUsername) return;

    const targetSocketId = onlineUsers.get(targetUsername);
    const roomId = `private_${Math.random().toString(36).substring(2, 9)}`;
    const notif = await db.createNotification(targetUsername, sender, 'invite', roomId);

    if (targetSocketId) {
      io.to(targetSocketId).emit('private_invite_incoming', {
        id: notif.id,
        senderUsername: sender,
        roomId
      });
    }
  });

  socket.on('private_invite_accept', ({ targetUsername, roomId }) => {
    const accepter = socket.user?.username;
    if (!accepter) return;

    const targetSocketId = onlineUsers.get(targetUsername);
    if (targetSocketId) {
      io.to(targetSocketId).emit('private_invite_accepted', {
        accepterUsername: accepter,
        roomId
      });
    }
  });

  // Relay WebRTC events
  socket.on('offer', ({ offer }) => {
    const user = users.get(socket.id);
    if (!user?.partner) return;
    const partnerSocket = users.get(user.partner)?.socket;
    partnerSocket?.emit('offer', { offer });
  });

  socket.on('answer', ({ answer }) => {
    const user = users.get(socket.id);
    if (!user?.partner) return;
    const partnerSocket = users.get(user.partner)?.socket;
    partnerSocket?.emit('answer', { answer });
  });

  socket.on('ice_candidate', ({ candidate }) => {
    const user = users.get(socket.id);
    if (!user?.partner) return;
    const partnerSocket = users.get(user.partner)?.socket;
    partnerSocket?.emit('ice_candidate', { candidate });
  });

  // Relay typing indicators
  socket.on('typing', () => {
    const user = users.get(socket.id);
    if (!user?.partner) return;
    const partnerSocket = users.get(user.partner)?.socket;
    partnerSocket?.emit('typing');
  });

  socket.on('stop_typing', () => {
    const user = users.get(socket.id);
    if (!user?.partner) return;
    const partnerSocket = users.get(user.partner)?.socket;
    partnerSocket?.emit('stop_typing');
  });

  // Relay Chat message
  socket.on('chat_message', ({ text }) => {
    const user = users.get(socket.id);
    if (!user?.partner) return;
    const partnerSocket = users.get(user.partner)?.socket;
    partnerSocket?.emit('chat_message', { text });
  });

  // Skip Match
  socket.on('next_stranger', () => {
    disconnectFromPartner(socket.id);
    removeFromQueue(socket.id);

    const user = users.get(socket.id);
    if (user) {
      const bestIdx = findBestMatch({
        socketId: socket.id,
        interests: user.interests,
        language: user.language,
        country: user.country,
        mode: user.mode
      });
      if (bestIdx !== -1) {
        const matched = waitingQueue.splice(bestIdx, 1)[0];
        pairUsers(socket.id, matched.socketId);
      } else {
        waitingQueue.push({
          socketId: socket.id,
          interests: user.interests,
          language: user.language,
          country: user.country,
          mode: user.mode
        });
        socket.emit('waiting');
      }
    }
  });

  // Block User
  socket.on('block_stranger', () => {
    const user = users.get(socket.id);
    if (!user || !user.partner) return;

    const partner = users.get(user.partner);
    if (partner) {
      user.blockedList.push(partner.ip);
      user.blockedList.push(partner.username);
    }
    
    disconnectFromPartner(socket.id);
    socket.emit('stopped');
  });

  // Stop Matchmaking
  socket.on('stop', () => {
    disconnectFromPartner(socket.id);
    removeFromQueue(socket.id);
    socket.emit('stopped');
  });

  // Disconnection
  socket.on('disconnect', () => {
    const userVal = users.get(socket.id);
    const connUsername = userVal ? userVal.username : 'Unknown';
    totalOnline--;
    broadcastOnlineCount();

    // Emit to admin panel
    emitToAdmins('user:online', { username: connUsername, status: 'offline' });
    emitToAdmins('metrics:update', { onlineCount: totalOnline });

    disconnectFromPartner(socket.id);
    removeFromQueue(socket.id);
    users.delete(socket.id);
    
    if (socket.user && !socket.user.isAnonymous) {
      onlineUsers.delete(socket.user.username);
    }

    for (const [roomId, socketId] of privateRooms.entries()) {
      if (socketId === socket.id) {
        privateRooms.delete(roomId);
      }
    }
    
    console.log(`🔴 Disconnected: ${socket.id} | Total: ${totalOnline}`);
  });
});

// Root route - quick alive check
app.get('/', (req, res) => {
  res.json({ service: 'GhostChat Signaling Server', status: 'online', version: '2.0.0' });
});

// Health metrics
app.get('/health', async (req, res) => {
  try {
    const reports = await db.getReportsCount();
    const bans = await db.getBansCount();
    res.json({
      status: 'ok',
      online: totalOnline,
      waiting: waitingQueue.length,
      reports,
      bans
    });
  } catch (err) {
    res.json({
      status: 'ok',
      online: totalOnline,
      waiting: waitingQueue.length,
      reports: 0,
      bans: 0
    });
  }
});

// Run Init Db, then start Server
const PORT = process.env.PORT || 4000;
initDb().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Signaling server running on port ${PORT}`);

    // Keep-alive self-ping: prevents Render free-tier from sleeping (14 min interval)
    if (process.env.NODE_ENV === 'production') {
      const SELF_URL = process.env.RENDER_EXTERNAL_URL || `https://strangerlink-backend.onrender.com`;
      setInterval(async () => {
        try {
          const https = require('https');
          https.get(`${SELF_URL}/health`, (res) => {
            console.log(`💓 Keep-alive ping: ${res.statusCode}`);
          }).on('error', (e) => {
            console.warn(`Keep-alive ping failed: ${e.message}`);
          });
        } catch (e) {
          console.warn('Keep-alive error:', e.message);
        }
      }, 14 * 60 * 1000); // every 14 minutes
    }
  });
});
