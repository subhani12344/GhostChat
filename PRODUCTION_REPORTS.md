# GhostChat Production Deployment & Operation Guide

This document contains full operational, architectural, and security guides for deploying and managing **GhostChat** in a production environment.

---

## 1. Domain & DNS Configuration Guide

To prepare GhostChat for a custom `.com` domain (e.g., `ghostchat.com`), follow the DNS configuration rules below.

### Recommended Infrastructure Architecture

```
                  ┌────────────────────────┐
                  │   User Browser / App   │
                  └───────────┬────────────┘
                              │ HTTPS / WSS
                              ▼
                  ┌────────────────────────┐
                  │      Cloudflare DNS    │
                  │ (SSL/TLS termination)  │
                  └─────┬────────────┬─────┘
                        │            │
            HTTPS (WSS) │            │ HTTPS (REST)
                        ▼            ▼
         ┌──────────────────┐    ┌──────────────────┐
         │  Render Web App  │    │  Vercel Frontend │
         │ (NodeJS Server)  │    │  (NextJS App)    │
         └────────┬─────────┘    └──────────────────┘
                  │ PostgreSQL
                  ▼
         ┌──────────────────┐
         │ Render Database  │
         └──────────────────┘
```

### DNS Records Setup
Configure these records in your DNS provider (e.g., Cloudflare, Namecheap, GoDaddy):

1. **Vercel Frontend (root domain: `ghostchat.com`)**:
   - **Type**: `A`
   - **Name**: `@`
   - **Value**: `76.76.21.21` (Vercel IP address)
   - **TTL**: Auto / 3600

2. **Vercel Frontend (subdomain: `www.ghostchat.com`)**:
   - **Type**: `CNAME`
   - **Name**: `www`
   - **Value**: `cname.vercel-dns.com`
   - **TTL**: Auto / 3600

3. **Render Backend (subdomain: `api.ghostchat.com`)**:
   - **Type**: `CNAME`
   - **Name**: `api`
   - **Value**: `ghostchat-backend.onrender.com` (Your Render deployment URL)
   - **Proxied**: Proxy through Cloudflare (Orange Cloud) to enable CDN caching, DDoS protection, and SSL termination.

---

## 2. HTTPS, SSL, and Security Headers

### SSL Configuration
- **Cloudflare**: Set SSL/TLS encryption mode to **Full** or **Full (Strict)**. This ensures that connection traffic is encrypted from the client browser to Cloudflare, and from Cloudflare to Vercel/Render servers.
- **Vercel & Render**: Both platforms auto-provision Let's Encrypt SSL certificates dynamically on host connection.

---

## 3. Production Authentication & rate limit controls

### Authentication Flow
- **Guests**: Secure, high-entropy Guest IDs (e.g., `Guest-A8C3D2`) are cryptographically generated on request using NodeJS `crypto.randomBytes(3)`. JWT tokens signed with `JWT_SECRET` are issued with a 1-day expiration and stored securely in client browser localStorage.
- **Registered Users**: User accounts utilize `bcryptjs` with 10 salt rounds for password hashes. Authentication issues a JWT signed with `JWT_SECRET` valid for 7 days.

---

## 4. API Documentation

### Authentication APIs

#### 1. Anonymous Login
- **Endpoint**: `POST /api/auth/anonymous`
- **Payload**: None
- **Response (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "username": "Guest-A8C3D2"
  }
  ```

#### 2. Register Account
- **Endpoint**: `POST /api/auth/register`
- **Payload**:
  ```json
  {
    "username": "user123",
    "email": "user@example.com",
    "password": "SecurePassword1!"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "username": "user123"
  }
  ```
