# Linager Architecture Decision Records (ADRs)

## ADR 1: Ponytail Minimalist Single-Worker Architecture
- **Context**: Need a pure, fast, working link manager for multi-device usage without bloated frontends or heavy dependencies.
- **Decision**: Embed modern, responsive, high-contrast minimal HTML/CSS/JS directly in Cloudflare Worker response.
- **Consequence**: Zero frontend build pipeline, instant cold starts, single-file deployable.

## ADR 2: Turso libSQL Edge SQLite
- **Context**: Persistent storage needed globally with ultra-low latency.
- **Decision**: Turso Cloud DB with @libsql/client/web HTTP client.
- **Consequence**: Compatible with Workers V8 isolates, fast connection times.

## ADR 3: WebAuthn Passkeys (FIDO2)
- **Context**: Passwordless login across phones, laptops, and desktop.
- **Decision**: Standard WebAuthn using @simplewebauthn/server for challenge verification and session cookies.

## ADR 4: Stateless Edge Challenge Persistence via Signed Cookies
- **Context**: Cloudflare Worker isolates are ephemeral; multi-step WebAuthn requests (`options` -> user authenticator -> `verify`) hit different isolates across Cloudflare's global edge network, losing in-memory challenge maps.
- **Decision**: Sign challenges using HMAC-SHA256 and store them in short-lived HTTP-only cookies (`linager_reg_challenge`, `linager_auth_challenge`).
- **Consequence**: Zero database round trips for challenges, 100% reliability across any edge isolate globally.
