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

## Recent Changes (2026-09-28)
- **Pin / Archive Quoting Fix (`src/ui.html`)**: Wrapped `onclick`, `class`, and `title` attributes in quotes to fix JavaScript syntax error from whitespace splitting.
- **Data Normalization (`src/index.ts` & `src/ui.html`)**: Sanitized `is_pinned` and `is_archived` to integer values (`0` or `1`) on link creation and update.
- **Toast Notifications**: Added explicit notifications when links are pinned, unpinned, archived, or unarchived.
- **Click Count Tracking (`src/index.ts` & `src/ui.html`)**: Awaited atomic database increment in `/r/:id` using `COALESCE(click_count, 0) + 1` with HEAD/GET support; made both title and URL clickable with real-time optimistic badge incrementing and tab visibility synchronization.
