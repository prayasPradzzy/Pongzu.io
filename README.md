# 🏓 Pongzu.io

Face Pong is a real-time multiplayer Pong game where players can upload a face, crop it, and turn it into the game ball.

Play against an AI opponent or challenge friends online through room-based multiplayer.

Built with React, Phaser, Socket.io, and MediaPipe

---

## 🎮 Features

### 🧠 Face Ball System

* Upload any face image
* Automatic face detection using MediaPipe
* Crop and adjust the face
* Convert the face into the game ball

The uploaded face becomes the actual Pong ball used during matches.

---

### 🤖 Play vs CPU

* Multiple difficulty levels
* Responsive AI opponent
* Match statistics tracking
* Instant play without multiplayer setup

---

### 🌐 Online Multiplayer

* Create private game rooms
* Join using room codes
* Invite friends using shareable links
* Real-time gameplay powered by Socket.io
* Server-authoritative game state
* Ready-up lobby system
* Countdown and synchronized match flow

---

### ⚡ Smooth Gameplay

* Phaser 3 game engine
* Real-time collision system
* Authoritative multiplayer architecture
* Input synchronization
* State reconciliation
* Countdown and point pause systems

---

### 📊 Statistics

Track:

* Matches played
* Wins and losses
* Longest rally
* Game history
* Performance metrics

---

## 🏗️ Tech Stack

### Frontend

* React
* TypeScript
* Phaser 3
* Vite

### Backend

* Node.js (built-in `http` server)
* Socket.io

### Computer Vision

* MediaPipe Face Detection

---

## 🧩 Architecture

### Frontend

```text
React
│
├── Main Menu
├── CPU Mode
├── Multiplayer Lobby
├── Face Upload
├── Face Crop
└── Phaser Game
```

### Backend

```text
Node.js
│
├── Room Manager
├── Match State Manager
├── Authoritative Physics
├── Score Manager
└── Socket.io Server
```

---

## 🔄 Multiplayer Flow

```text
Create Room
      ↓
Share Room Code / Invite Link
      ↓
Friend Joins
      ↓
Ready Up
      ↓
Countdown
      ↓
Match Start
      ↓
Real-Time Gameplay
      ↓
Results Screen
```

---

## 🎯 Why This Project?

Most Pong clones simply change colors or graphics.

Pongzu introduces:

* Face-based gameplay personalization
* Real-time multiplayer architecture
* Computer vision integration
* Server-authoritative synchronization

The goal was to combine game development, computer vision, and multiplayer networking into a single browser-based experience.

---

## 🚀 Running Locally

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:3001
```

---

## 🌍 Deploying

The frontend is a static site; the multiplayer server is a long-running Node process. They are deployed separately.

### Frontend (Netlify)

`netlify.toml` already sets the build command, publish directory and the SPA fallback that makes invite links (`/join/ABCD`) work.

Set one environment variable in Netlify, then redeploy:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | Origin of your server, e.g. `https://your-server.onrender.com` (no trailing slash) |

### Server (Render, Railway, Fly, …)

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| `CLIENT_ORIGIN` | Comma-separated list of sites allowed to connect, e.g. `https://pongzu.netlify.app` |

`PORT` is provided by the host. `GET /healthz` returns `{ ok: true }` for uptime checks.

Free-tier hosts put the server to sleep when idle, so the first connection of the day can take up to a minute. The game shows a "server is waking up" message while that happens.

> Client and server share gameplay constants (`src/game/config/pongConfig.ts` and `server/src/game/ServerBallSimulator.ts`) and the socket protocol (`src/protocol/events.ts` and `server/src/protocol/events.ts`). Change both copies together and deploy both sides.

---

## 🎮 Controls

* **Keyboard:** `A` / `D` or `←` / `→`
* **Touch / mouse:** press and hold — the paddle glides to your finger
* Moving your paddle as you hit the ball adds spin and sharpens the angle

---

## 📸 How To Play

### CPU Mode

1. Enter your name
2. Optionally upload a face
3. Choose difficulty
4. Start playing

### Multiplayer

1. Create a room
2. Share the room code or invite link
3. Friend joins
4. Both players ready up
5. Match begins

---

## 🔮 Future Improvements

* Spectator mode
* Ranked matchmaking
* Replays
* Mobile-first controls
* Match sharing cards
* Global leaderboards

---

## 👨‍💻 Author

Built by Pradzzy :)

If you enjoyed the project, feel free to star the repository and share feedback.
