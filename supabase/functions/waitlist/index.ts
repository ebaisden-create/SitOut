// SitOut waitlist API
// GET  -> { spots_left }
// POST -> { email, monthly_loss?, token (Turnstile), website (honeypot, must be empty) }
// Public endpoint (no login), protected by: origin allowlist, honeypot, size limit,
// per-IP + global rate limits in Postgres, Cloudflare Turnstile captcha, and a hard row cap.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET") ?? "";
const SALT = Deno.env.get("IP_HASH_SALT") ?? SERVICE_KEY.slice(-24);
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://getsitout.com,https://www.getsitout.com,https://ebaisden-create.github.io,https://sitout.app,https://www.sitout.app,http://localhost:8080")
  .split(",").map((s) => s.trim()).filter(Boolean);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function cors(origin: string | null): Record<string, string> {
  const ok = origin && ALLOWED.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin! : ALLOWED[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}
function json(body: unknown, status: number, origin: string | null, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin), ...extra },
  });
}
async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${fn} ${r.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}
async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (origin && !ALLOWED.includes(origin)) return json({ error: "origin_not_allowed" }, 403, origin);

  try {
    if (req.method === "GET") {
      const left = await rpc("waitlist_spots_left", {});
      return json({ spots_left: left }, 200, origin, { "Cache-Control": "public, max-age=30" });
    }
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

    const raw = await req.text();
    if (raw.length > 2000) return json({ error: "too_large" }, 413, origin);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json({ error: "bad_request" }, 400, origin); }

    // Honeypot: real people never see or fill this field. Pretend success so bots learn nothing.
    if (typeof body.website === "string" && body.website.length > 0) {
      return json({ status: "joined", founding: false }, 200, origin);
    }
    const email = String(body.email ?? "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400, origin);
    const loss = Number.isInteger(body.monthly_loss) ? body.monthly_loss as number : null;
    const token = String(body.token ?? "");
    if (!token || token.length > 4096) return json({ error: "captcha_required" }, 400, origin);

    // Rate limits (checked before the captcha so floods are cheap to reject)
    const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    const limit = await rpc("check_signup_rate", { p_ip_hash: await sha256(SALT + ip) });
    if (limit !== "ok") return json({ error: limit }, 429, origin, { "Retry-After": "600" });

    // Captcha. Fails closed: no secret configured means no signups.
    if (!TURNSTILE_SECRET) return json({ error: "captcha_not_configured" }, 503, origin);
    const form = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip });
    const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const verdict = await v.json();
    if (!verdict.success || (verdict.action && verdict.action !== "waitlist")) {
      return json({ error: "captcha_failed" }, 403, origin);
    }

    const result = await rpc("join_waitlist", { p_email: email, p_monthly_loss: loss, p_source: "landing" });
    return json(result, 200, origin);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500, origin);
  }
});
