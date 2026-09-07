# Linager Learnings & Bugfixes

- **Passkeys on Cloudflare Workers**: Using @simplewebauthn/server works cleanly with Web Crypto API available natively in Cloudflare Workers.
- **RP ID (Relying Party ID)**: In production, RP ID must match the domain hostname (e.g. linager.workers.dev or localhost during local dev). We extract RP ID dynamically from the Request.headers.get('host') (stripping port for localhost).
- **Turso DB / libSQL on CF Workers**: @libsql/client/web must be used (not the default native @libsql/client with node-gyp or node:fs bindings).
- **Ponytail Architecture**: Single worker script bundles backend REST API + serves clean, zero-dependency responsive frontend directly as HTML response. No bundlers or separate static hosting needed.
- **Edge Stateless WebAuthn Challenges**: In-memory maps fail on Cloudflare Workers because `register-options` and `register-verify` hit different ephemeral isolates. Challenges are signed via HMAC-SHA256 and stored in short-lived HTTP-only cookies (`linager_reg_challenge` and `linager_auth_challenge`), guaranteeing 100% reliability across all global edge nodes.
- **Proton Pass & Extension Compatibility**: Using standard `@simplewebauthn/browser` bundle ensures full compatibility with browser extension authenticators (Proton Pass, Bitwarden, 1Password, etc.) without manual ArrayBuffer conversions.
