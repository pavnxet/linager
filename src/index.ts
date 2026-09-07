import { createClient } from "@libsql/client/web";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { UI_HTML } from "./html-template";

export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  APP_NAME?: string;
}

// In-memory challenge store per worker isolate
const activeChallenges = new Map<string, { challenge: string; username?: string; timestamp: number }>();

function cleanupChallenges() {
  const now = Date.now();
  for (const [key, val] of activeChallenges.entries()) {
    if (now - val.timestamp > 10 * 60 * 1000) {
      activeChallenges.delete(key);
    }
  }
}

function getDb(env: Env) {
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}

function getRpID(url: URL): string {
  return url.hostname;
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((pair) => {
    const [name, ...val] = pair.trim().split("=");
    if (name) {
      cookies[name] = decodeURIComponent(val.join("="));
    }
  });
  return cookies;
}

async function createSessionToken(userId: string, username: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const data = userId + ":" + username + ":" + Date.now();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return btoa(data) + "." + sigB64;
}

async function createSignedChallengeToken(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const data = payload + ":" + Date.now();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return btoa(data) + "." + sigB64;
}

async function verifySignedChallengeToken(token: string | undefined, secret: string): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const data = atob(parts[0]);
    const sigB64 = parts[1];
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(data));
    if (!valid) return null;

    const lastColon = data.lastIndexOf(":");
    if (lastColon === -1) return null;
    const payload = data.substring(0, lastColon);
    const timeStr = data.substring(lastColon + 1);
    const created = parseInt(timeStr, 10);
    // 5 minutes expiry for WebAuthn challenges
    if (isNaN(created) || Date.now() - created > 5 * 60 * 1000) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

async function verifySessionToken(token: string | undefined, secret: string): Promise<{ userId: string; username: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const data = atob(parts[0]);
    const sigB64 = parts[1];
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(data));
    if (!valid) return null;

    const [userId, username, timeStr] = data.split(":");
    const created = parseInt(timeStr, 10);
    if (Date.now() - created > 30 * 24 * 60 * 60 * 1000) return null;
    return { userId, username };
  } catch (err) {
    return null;
  }
}

function jsonResponse(data: any, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const secret = (env.TURSO_AUTH_TOKEN || "linager-default-edge-secret").slice(0, 32);
    const db = getDb(env);
    const cookies = parseCookies(request.headers.get("Cookie"));
    const session = await verifySessionToken(cookies["linager_session"], secret);

    // 1. Single-Page Link Manager UI
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(UI_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 2. Auth: Get Current Session
    if (url.pathname === "/api/auth/me" && request.method === "GET") {
      if (!session) return jsonResponse({ error: "Unauthorized" }, 401);
      return jsonResponse({ user: session });
    }

    // 3. Auth: Registration Options
    if (url.pathname === "/api/auth/register-options" && request.method === "POST") {
      cleanupChallenges();
      const body = await request.json() as { username: string };
      const username = (body.username || "").trim().toLowerCase();
      if (!username) return jsonResponse({ error: "Username is required" }, 400);

      let userRes = await db.execute({
        sql: "SELECT id, username FROM users WHERE username = ? LIMIT 1",
        args: [username],
      });

      let userId = userRes.rows[0]?.id as string;
      if (!userId) {
        userId = crypto.randomUUID();
        await db.execute({
          sql: "INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)",
          args: [userId, username, username],
        });
      }

      const credsRes = await db.execute({
        sql: "SELECT id, transports FROM passkey_credentials WHERE user_id = ?",
        args: [userId],
      });

      const rpID = getRpID(url);
      const options = await generateRegistrationOptions({
        rpName: env.APP_NAME || "Linager",
        rpID,
        userID: new TextEncoder().encode(userId),
        userName: username,
        attestationType: "none",
        excludeCredentials: credsRes.rows.map((r) => ({
          id: r.id as string,
          transports: r.transports ? JSON.parse(r.transports as string) : undefined,
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

      const challengePayload = JSON.stringify({ userId, challenge: options.challenge });
      const challengeToken = await createSignedChallengeToken(challengePayload, secret);
      const isHttps = url.protocol === "https:";
      const cookie = "linager_reg_challenge=" + challengeToken + "; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=300" + (isHttps ? "; Secure" : "");

      return jsonResponse(options, 200, {
        "Set-Cookie": cookie,
      });
    }

    // 4. Auth: Register Verify
    if (url.pathname === "/api/auth/register-verify" && request.method === "POST") {
      const data = await request.json() as any;
      const rpID = getRpID(url);
      const origin = url.origin;

      let matchedUserId: string | null = null;
      let expectedChallenge = "";

      const regCookie = cookies["linager_reg_challenge"];
      const rawPayload = await verifySignedChallengeToken(regCookie, secret);
      if (rawPayload) {
        try {
          const parsed = JSON.parse(rawPayload);
          matchedUserId = parsed.userId;
          expectedChallenge = parsed.challenge;
        } catch (e) {}
      }

      // Fallback to activeChallenges if cookie was not passed
      if (!matchedUserId || !expectedChallenge) {
        for (const [uid, record] of activeChallenges.entries()) {
          if (record.challenge) {
            matchedUserId = uid;
            expectedChallenge = record.challenge;
            break;
          }
        }
      }

      if (!matchedUserId || !expectedChallenge) {
        return jsonResponse({ error: "Challenge expired or not found. Please try registering again." }, 400);
      }

      const verification = await verifyRegistrationResponse({
        response: data,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return jsonResponse({ error: "Passkey verification failed" }, 400);
      }

      const {
        credentialID,
        credentialPublicKey,
        counter,
        credentialDeviceType,
        credentialBackedUp,
      } = verification.registrationInfo;

      const pubKey = btoa(String.fromCharCode(...credentialPublicKey))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      await db.execute({
        sql: "INSERT OR REPLACE INTO passkey_credentials (id, user_id, public_key, counter, device_type, backed_up, transports) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [
          credentialID,
          matchedUserId,
          pubKey,
          counter,
          credentialDeviceType,
          credentialBackedUp ? 1 : 0,
          JSON.stringify(data.response.transports || []),
        ],
      });

      const userRow = await db.execute({
        sql: "SELECT username FROM users WHERE id = ?",
        args: [matchedUserId],
      });
      const username = userRow.rows[0]?.username as string;

      activeChallenges.delete(matchedUserId);

      const sessionToken = await createSessionToken(matchedUserId, username, secret);
      const isHttps = url.protocol === "https:";
      const cookie = "linager_session=" + sessionToken + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000" + (isHttps ? "; Secure" : "");

      return jsonResponse({ success: true, user: { id: matchedUserId, username } }, 200, {
        "Set-Cookie": cookie,
      });
    }

    // 5. Auth: Login Options
    if (url.pathname === "/api/auth/login-options" && request.method === "POST") {
      cleanupChallenges();
      const body = await request.json() as { username?: string };
      const rpID = getRpID(url);

      let allowCredentials: any[] | undefined = undefined;
      let targetUserId = "";

      if (body.username) {
        const username = body.username.trim().toLowerCase();
        const userRes = await db.execute({
          sql: "SELECT id FROM users WHERE username = ? LIMIT 1",
          args: [username],
        });
        if (userRes.rows.length > 0) {
          targetUserId = userRes.rows[0].id as string;
          const credsRes = await db.execute({
            sql: "SELECT id, transports FROM passkey_credentials WHERE user_id = ?",
            args: [targetUserId],
          });
          allowCredentials = credsRes.rows.map((r) => ({
            id: r.id as string,
            transports: r.transports ? JSON.parse(r.transports as string) : undefined,
          }));
        }
      }

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials,
        userVerification: "preferred",
      });

      const challengeToken = await createSignedChallengeToken(options.challenge, secret);
      const isHttps = url.protocol === "https:";
      const cookie = "linager_auth_challenge=" + challengeToken + "; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=300" + (isHttps ? "; Secure" : "");

      return jsonResponse(options, 200, {
        "Set-Cookie": cookie,
      });
    }

    // 6. Auth: Login Verify
    if (url.pathname === "/api/auth/login-verify" && request.method === "POST") {
      const data = await request.json() as any;
      const rpID = getRpID(url);
      const origin = url.origin;

      const credRes = await db.execute({
        sql: "SELECT * FROM passkey_credentials WHERE id = ? LIMIT 1",
        args: [data.id],
      });

      if (credRes.rows.length === 0) {
        return jsonResponse({ error: "Passkey not recognized. Please register first." }, 404);
      }

      const storedCred = credRes.rows[0];
      const userId = storedCred.user_id as string;

      let expectedChallenge = "";
      const authCookie = cookies["linager_auth_challenge"];
      const rawChallenge = await verifySignedChallengeToken(authCookie, secret);
      if (rawChallenge) {
        expectedChallenge = rawChallenge;
      }

      // Fallback to activeChallenges
      if (!expectedChallenge) {
        for (const [key, val] of activeChallenges.entries()) {
          if (val.challenge) {
            expectedChallenge = val.challenge;
            break;
          }
        }
      }

      if (!expectedChallenge) {
        return jsonResponse({ error: "Challenge expired. Please try signing in again." }, 400);
      }

      const pubKeyBase64 = (storedCred.public_key as string).replace(/-/g, "+").replace(/_/g, "/");
      const pubKeyBytes = Uint8Array.from(atob(pubKeyBase64), (c) => c.charCodeAt(0));

      const verification = await verifyAuthenticationResponse({
        response: data,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: storedCred.id as string,
          credentialPublicKey: pubKeyBytes,
          counter: Number(storedCred.counter),
        },
      });

      if (!verification.verified) {
        return jsonResponse({ error: "Authentication failed" }, 400);
      }

      await db.execute({
        sql: "UPDATE passkey_credentials SET counter = ? WHERE id = ?",
        args: [verification.authenticationInfo.newCounter, storedCred.id as string],
      });

      const userRow = await db.execute({
        sql: "SELECT username FROM users WHERE id = ?",
        args: [userId],
      });
      const username = userRow.rows[0]?.username as string;

      const sessionToken = await createSessionToken(userId, username, secret);
      const isHttps = url.protocol === "https:";
      const cookie = "linager_session=" + sessionToken + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000" + (isHttps ? "; Secure" : "");

      return jsonResponse({ success: true, user: { id: userId, username } }, 200, {
        "Set-Cookie": cookie,
      });
    }

    // 7. Auth: Logout
    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      return jsonResponse({ success: true }, 200, {
        "Set-Cookie": "linager_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
      });
    }

    // 8. Public Redirect: /r/:id (with atomic click counter)
    if (url.pathname.startsWith("/r/") && request.method === "GET") {
      const linkId = url.pathname.slice(3);
      const res = await db.execute({
        sql: "SELECT url FROM links WHERE id = ? LIMIT 1",
        args: [linkId],
      });
      if (res.rows.length === 0) {
        return new Response("Link not found", { status: 404 });
      }
      db.execute({
        sql: "UPDATE links SET click_count = click_count + 1 WHERE id = ?",
        args: [linkId],
      }).catch(console.error);

      return Response.redirect(res.rows[0].url as string, 302);
    }

    // Guard: Routes below require authenticated user session
    if (!session) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // 9. Links: List All
    if (url.pathname === "/api/links" && request.method === "GET") {
      const res = await db.execute({
        sql: "SELECT * FROM links WHERE user_id = ? ORDER BY is_pinned DESC, created_at DESC",
        args: [session.userId],
      });
      return jsonResponse(res.rows);
    }

    // 10. Links: Create
    if (url.pathname === "/api/links" && request.method === "POST") {
      try {
        const body = await request.json() as { url: string; title?: string; description?: string; tags?: string };
        if (!body.url) return jsonResponse({ error: "URL is required" }, 400);

        let title = (body.title || "").trim();
        if (!title) {
          try {
            title = new URL(body.url).hostname;
          } catch {
            title = body.url;
          }
        }

        const id = crypto.randomUUID().slice(0, 8);
        await db.execute({
          sql: "INSERT INTO links (id, user_id, url, title, description, tags) VALUES (?, ?, ?, ?, ?, ?)",
          args: [id, session.userId, body.url, title, body.description || "", body.tags || ""],
        });

        return jsonResponse({ success: true, id, title }, 201);
      } catch (err: any) {
        console.error("Create link error:", err);
        return jsonResponse({ error: err.message || "Failed to create link" }, 500);
      }
    }

    // 11. Links: Update
    if (url.pathname.startsWith("/api/links/") && request.method === "PUT") {
      const id = url.pathname.slice(11);
      const body = await request.json() as any;

      const fields: string[] = [];
      const args: any[] = [];

      if (body.title !== undefined) { fields.push("title = ?"); args.push(body.title); }
      if (body.url !== undefined) { fields.push("url = ?"); args.push(body.url); }
      if (body.description !== undefined) { fields.push("description = ?"); args.push(body.description); }
      if (body.tags !== undefined) { fields.push("tags = ?"); args.push(body.tags); }
      if (body.is_pinned !== undefined) { fields.push("is_pinned = ?"); args.push(body.is_pinned ? 1 : 0); }
      if (body.is_archived !== undefined) { fields.push("is_archived = ?"); args.push(body.is_archived ? 1 : 0); }

      if (fields.length === 0) return jsonResponse({ error: "No fields to update" }, 400);

      fields.push("updated_at = CURRENT_TIMESTAMP");
      args.push(id, session.userId);

      await db.execute({
        sql: "UPDATE links SET " + fields.join(", ") + " WHERE id = ? AND user_id = ?",
        args,
      });

      return jsonResponse({ success: true });
    }

    // 12. Links: Delete
    if (url.pathname.startsWith("/api/links/") && request.method === "DELETE") {
      const id = url.pathname.slice(11);
      await db.execute({
        sql: "DELETE FROM links WHERE id = ? AND user_id = ?",
        args: [id, session.userId],
      });
      return jsonResponse({ success: true });
    }

    return new Response("Not Found", { status: 404 });
  },
};