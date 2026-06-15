# GhostChat — Meet New People Instantly

GhostChat is a real-time anonymous video and text chat platform built with Next.js (frontend) and Node.js/Express with Socket.IO (backend).

## Features

- **Anonymous Matchmaking**: Pair up with random strangers for video or text conversations.
- **Filters**: Match by country, language, or shared interests.
- **Social Upgrade**: User profiles, bio, followers, notifications, and direct/private calling.
- **Reporting & Moderation**: Abusive language detection, report system, and automated banning rules.

---

## 🚀 One-Click Public Deployment (No Tunnels Required)

To host your application publicly on real cloud domains without using local tunnels, follow the simple steps below.

### Step 1: Deploy Backend to Render
Deploy the Node.js signaling and database server to Render (Free Tier with WebSockets support).

[![Deploy to Render](https://render.com/images/deploy-to-render.svg)](https://render.com/deploy?repo=https://github.com/subhani12344/GhostChat)

1. Click the button above to log into Render and create your web service.
2. Render will automatically read the `render.yaml` blueprint from your repository and set up a Node service named `strangerlink-backend`.
3. Under the service environment variables, you can configure your email notifications (SMTP keys) if you want to enable OTP verification.
4. Once deployed, note down your Render service URL (e.g., `https://strangerlink-backend.onrender.com`).

### Step 2: Deploy Frontend to Vercel
Deploy the Next.js frontend to Vercel (Free Hobby Tier).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/subhani12344/GhostChat)

1. Click the button above to import your project into Vercel.
2. Under **Environment Variables**, add the following variable:
   - **Key**: `NEXT_PUBLIC_SERVER_URL`
   - **Value**: Your Render Backend URL (from Step 1, e.g., `https://strangerlink-backend.onrender.com`)
3. Click **Deploy**.
4. Once deployment finishes, Vercel will provide your permanent public domain (e.g., `https://ghostchat-app.vercel.app`).

---

## 💻 Local Development

### 1. Run Backend Server
```bash
cd backend
npm install
npm run dev
```
The backend will run on `http://localhost:4000`.

### 2. Run Frontend App
```bash
npm install
npm run dev
```
The frontend will run on `http://localhost:3000`. Make sure your `.env.local` points to `http://localhost:4000`.
