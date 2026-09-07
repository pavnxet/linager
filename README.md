# Linager 🔗

A lightweight, zero-bloat, high-performance **Link Manager** designed to run globally on **Cloudflare Workers** with **Turso DB** (libSQL edge SQLite) storage and **Passkey (WebAuthn / FIDO2)** passwordless authentication.

Built using the /ponytail philosophy:
- **No heavy frontend bundles**: Zero frontend dependencies, vanilla HTML5/CSS/JS served directly from the Worker isolate.
- **Fast & Edge-native**: Powered by Turso libSQL over HTTP.
- **Passwordless Passkeys**: Hardware key / FaceID / TouchID / Windows Hello authentication using WebAuthn.
- **Multi-Device Ready**: Works smoothly across phone, tablet, laptop, and desktop browsers.

---

## Features
- 🔑 **Passkey Login**: Biometric passwordless authentication (WebAuthn / FIDO2).
- 📌 **Pinning & Archiving**: Keep important bookmarks on top, tuck older ones into the archive.
- 🏷️ **Tags & Tag Badges**: Categorize links and filter instantly with clickable tag chips.
- ⚡ **Instant Search**: Filter links in real time; press / anywhere to focus search.
- 📈 **Click Tracking & Short Links**: /r/:id public redirection route that tracks click counts.
- 📋 **One-Click Copy**: Fast clipboard copy button for URLs.
- 💾 **JSON Export**: Back up all your links locally anytime.
- 🎨 **Minimal Dark UI**: High-contrast, clean developer-first aesthetic.

---

## Project Structure
`
Linager/
├── AGENTS.md                  # Subproject instructions pointing to root protocol
├── learning/                  # Isolated project memory
│   ├── learning.md            # Technical domain notes & quirks
│   ├── DECISIONS.md           # Architecture Decision Records
│   ├── EXECUTION_FLOW.md      # Entry points and call paths
│   └── summary.md             # Running execution log
├── scripts/
│   ├── schema.sql             # Turso SQLite schema
│   └── init-db.mjs            # Turso database migration script
├── src/
│   ├── index.ts               # Worker router, API, & WebAuthn logic
│   ├── html-template.ts       # Compiled single-page UI template
│   └── ui.html                # Responsive minimal frontend
├── .dev.vars                  # Local environment secrets for Wrangler
├── package.json
├── tsconfig.json
└── wrangler.jsonc             # Cloudflare Worker configuration
`

---

## Quick Start

### 1. Prerequisites
- Node.js (v20+)
- Turso DB database token & URL

### 2. Database Setup
`ash
npm run db:init
`

### 3. Local Development
`ash
npm run dev
`
Open http://localhost:8787 in your browser.

### 4. Deployment to Cloudflare Workers
`ash
npx wrangler secret put TURSO_AUTH_TOKEN
npm run deploy
`