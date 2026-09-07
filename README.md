# Linager 🔗

A lightweight, high-performance, and passwordless **Link Manager** running globally at the edge on **Cloudflare Workers** with **Turso DB** (libSQL edge SQLite) and **Passkey (WebAuthn / FIDO2)** authentication.

🌐 **Live Production**: [https://linager.pavneet1804.workers.dev](https://linager.pavneet1804.workers.dev)  
📦 **Repository**: [https://github.com/pavnxet/linager](https://github.com/pavnxet/linager)

---

## ✨ Features

- 🔑 **Passkey Authentication (FIDO2 / WebAuthn)**: Biometric passwordless login across all devices (Proton Pass, 1Password, Bitwarden, Windows Hello, Touch ID, Face ID, iCloud Keychain).
- 📌 **Pin & Archive**: Pin your daily essentials to the top; archive completed bookmarks to keep your workspace tidy.
- 🏷️ **Tags & Tag Badges**: Add comma-separated tags to any link. Click any tag chip (`#dev`, `#youtube`) to filter instantly.
- ⚡ **Instant Search**: Real-time fuzzy filtering across titles, URLs, tags, and notes. Press `/` anywhere to focus the search box.
- 📈 **Click Tracking & Short Redirects**: Built-in `/r/:id` redirection route that counts clicks automatically.
- 📋 **One-Click URL Copy**: Copy links to your clipboard with a single click.
- 💾 **JSON Export**: One-click download of all saved links in formatted JSON for local backups.
- 🎨 **Minimal Dark UI**: High-contrast, developer-first aesthetic inspired by GitHub's dark theme. Zero heavy frontend frameworks.

---

## 🛠️ Architecture & Tech Stack

- **Edge Compute**: [Cloudflare Workers](https://workers.cloudflare.com/) (ephemeral, multi-datacenter V8 isolates).
- **Database**: [Turso Cloud](https://turso.tech/) (libSQL distributed edge SQLite over HTTP via `@libsql/client/web`).
- **Auth**: Stateless WebAuthn challenge signing via Web Crypto HMAC-SHA256 HTTP-only cookies (`@simplewebauthn/server` & `@simplewebauthn/browser`).
- **Frontend**: Zero-build vanilla HTML5, CSS custom properties, and modern JavaScript embedded directly into the Worker.

---

## 📁 Project Structure

```text
Linager/
├── AGENTS.md                  # Master agent & project guidelines
├── learning/                  # Project memory & history
│   ├── learning.md            # Technical domain notes & quirks
│   ├── DECISIONS.md           # Architecture Decision Records (ADRs)
│   ├── EXECUTION_FLOW.md      # Entry points and route maps
│   └── summary.md             # Running execution log
├── scripts/
│   ├── schema.sql             # Turso SQLite schema
│   └── init-db.mjs            # Turso database migration script
├── src/
│   ├── index.ts               # Worker router, API, & WebAuthn logic
│   ├── html-template.ts       # Compiled single-page UI template
│   └── ui.html                # Responsive minimal frontend
├── .gitignore
├── package.json
├── tsconfig.json
└── wrangler.jsonc             # Cloudflare Worker configuration
```

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/pavnxet/linager.git
cd linager
npm install
```

### 2. Configure Turso Database
1. Create a Turso database:
   ```bash
   turso db create linager
   turso db show linager --url
   turso db tokens create linager
   ```
2. Create your local environment file `.dev.vars`:
   ```ini
   TURSO_DATABASE_URL="https://your-db-name.turso.io"
   TURSO_AUTH_TOKEN="your-turso-auth-token"
   ```
3. Initialize the database schema:
   ```bash
   npm run db:init
   ```

### 3. Local Development
```bash
npm run dev
```
Open `http://localhost:8787` in your browser.

### 4. Deploy to Cloudflare Workers
```bash
npx wrangler secret put TURSO_AUTH_TOKEN
npm run deploy
```

---

## 🛡️ Passkey Support (e.g. Proton Pass)

Linager works natively with all WebAuthn-compliant password managers:
1. Open your browser with **Proton Pass** (or your preferred passkey manager extension).
2. Enter your desired username on Linager and click **Register**.
3. Proton Pass will display a popup: *"Save passkey for linager.pavneet1804.workers.dev"*.
4. Click **Save**.
5. When logging in from any other synced device, click **Sign In** and authenticate with a single tap.

---

## 📄 License

MIT © [pavnxet](https://github.com/pavnxet)