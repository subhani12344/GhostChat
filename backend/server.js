const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const { db, initDb } = require('./db');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'ghostchat_secure_secret_key';

// Transporter setup for email OTP dispatch (mock/production)
let transporter;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
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
│                                                        │
└────────────────────────────────────────────────────────┘
  `);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"GhostChat Security" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'GhostChat Account Verification Code',
        text: messageText,
        html: `<p>${messageText}</p>`
      });
      console.log(`✉️ Email OTP sent to ${email}`);
    } catch (err) {
      console.error('Failed to send SMTP email, using console logging fallback:', err.message);
    }
  }
}

// ─── HTTP Endpoints ──────────────────────────────────────────────────────────

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
    const newUser = await db.createUser(record.username, record.password, 'user');

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

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Feedback & Data Deletion requests
app.post('/api/feedback', async (req, res) => {
  const { name, email, message } = req.body;
  if (!email || !message) {
    return res.status(400).json({ message: 'Email and message are required' });
  }

  try {
    const feedback = await db.createFeedback(name || 'Anonymous', email, message);
    res.status(201).json({ message: 'Feedback recorded successfully', feedback });
  } catch (err) {
    console.error('Feedback recording error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reports Submit (from public reports page or chat)
app.post('/api/reports', async (req, res) => {
  const { reporter_username, reported_username, reason, details } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

  try {
    const report = await db.createReport({
      reporter_ip: ip,
      reported_ip: ip, // Mocking same IP or resolving from sessions
      reporter_username: reporter_username || 'Anonymous',
      reported_username: reported_username || 'Stranger',
      reason,
      details
    });

    // AI/Auto-moderation simulation
    if (reported_username && reported_username !== 'Stranger') {
      const banExpires = new Date();
      banExpires.setHours(banExpires.getHours() + 24); // 24-hour warning ban
      await db.createBan(reported_username, `Auto-moderation ban due to user reports: ${reason}`, banExpires);
      console.log(`🔨 Auto-banned user: ${reported_username} for 24h`);
    }

    res.status(201).json({ message: 'Report recorded successfully', report });
  } catch (err) {
    console.error('Report filing error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// ─── Socket Matching State ───────────────────────────────────────────────────

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
  userA.socket.emit('matched', { initiator: true, partnerId: socketIdB });
  userB.socket.emit('matched', { initiator: false, partnerId: socketIdA });

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

// ─── Socket Events ────────────────────────────────────────────────────────────

io.on('connection', async (socket) => {
  const ip = socket.handshake.address || socket.conn.remoteAddress || '127.0.0.1';

  // Check IP Ban
  const banned = await db.isBanned(ip);
  if (banned) {
    socket.emit('chat_message', { text: `🔴 Access Denied: You are permanently banned. Reason: ${banned.reason}`, from: 'system' });
    console.log(`🚫 Banned connection rejected: ${ip}`);
    socket.disconnect(true);
    return;
  }

  totalOnline++;
  broadcastOnlineCount();

  users.set(socket.id, {
    socket,
    ip,
    username: 'Guest_' + Math.floor(1000 + Math.random() * 9000),
    interests: [],
    partner: null,
    mode: 'video',
    language: 'all',
    country: 'all',
    blockedList: []
  });

  console.log(`🟢 Connected: ${socket.id} (${ip}) | Total: ${totalOnline}`);

  // Find Stranger matching
  socket.on('find_stranger', ({ interests = [], language = 'all', country = 'all', mode = 'video' }) => {
    const user = users.get(socket.id);
    if (!user) return;

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
    totalOnline--;
    broadcastOnlineCount();
    disconnectFromPartner(socket.id);
    removeFromQueue(socket.id);
    users.delete(socket.id);
    console.log(`🔴 Disconnected: ${socket.id} | Total: ${totalOnline}`);
  });
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
  server.listen(PORT, () => {
    console.log(`🚀 Signaling server running on port ${PORT}`);
  });
});
