# Linager Execution Flow

## Overview
1. **Request arrives at Cloudflare Worker src/index.ts (etch handler)**.
2. **Router checks path**:
   - GET /: Serves embedded single-page link manager application.
   - GET /api/auth/me: Validates session cookie or returns 401.
   - POST /api/auth/register-options: Generates WebAuthn registration challenge.
   - POST /api/auth/register-verify: Verifies attestation, stores passkey credential in Turso, sets session cookie.
   - POST /api/auth/login-options: Generates WebAuthn authentication challenge.
   - POST /api/auth/login-verify: Verifies assertion signature against stored public key, sets session cookie.
   - POST /api/auth/logout: Clears session cookie.
   - GET /api/links: Fetches user's saved links from Turso with tag/search filters.
   - POST /api/links: Inserts new link (fetches page title automatically if omitted).
   - PUT /api/links/:id: Updates link details (pin, archive, tags, title, url).
   - DELETE /api/links/:id: Deletes link.
   - GET /r/:id: Public/authenticated redirect that increments click count and redirects to destination URL.
