// SitOut waitlist API
// GET               -> { spots_left }
// GET ?challenge=1  -> a proof-of-work puzzle { algorithm, salt, challenge, maxnumber, signature }
// POST              -> { email, monthly_loss?, pow: { salt, number, challenge, signature }, website (honeypot) }
// Public endpoint (no login). Protected by: origin allowlist, honeypot, size limit,
// per-IP + site-wide rate limits in Postgres, an invisible proof-of-work check
// (single-use, expires in 10 minutes), and hard caps on the list size.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SALT = Deno.env.get("IP_HASH_SALT") ?? SERVICE_KEY.slice(-24);
const POW_KEY = Deno.env.get("POW_HMAC_KEY") ?? ("pow:" + SERVICE_KEY);
const POW_MAX = Number(Deno.env.get("POW_MAXNUMBER") ?? "75000"); // higher = harder puzzle
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://getsitout.com,https://www.getsitout.com,https://ebaisden-create.github.io,http://localhost:8080")
  .split(",").map((s) => s.trim()).filter(Boolean);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const enc = new TextEncoder();

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
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
let hmacKey: CryptoKey | null = null;
async function hmac(s: string) {
  hmacKey ??= await crypto.subtle.importKey("raw", enc.encode(POW_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", hmacKey, enc.encode(s)));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Puzzle: find `number` in [0, maxnumber] so that sha256(salt + number) == challenge.
// The server signs the challenge, so it can check answers without storing puzzles.
async function newChallenge() {
  const rand = hex(crypto.getRandomValues(new Uint8Array(12)).buffer);
  const expires = Math.floor(Date.now() / 1000) + 600;
  const salt = `${rand}?expires=${expires}`;
  const number = crypto.getRandomValues(new Uint32Array(1))[0] % (POW_MAX + 1);
  const challenge = await sha256(salt + number);
  return { algorithm: "SHA-256", salt, challenge, maxnumber: POW_MAX, signature: await hmac(challenge) };
}
async function checkPow(p: unknown): Promise<string | null> {
  if (!p || typeof p !== "object") return "verification_required";
  const { salt, number, challenge, signature } = p as Record<string, unknown>;
  if (typeof salt !== "string" || typeof challenge !== "string" || typeof signature !== "string" ||
      !Number.isInteger(number) || salt.length > 100 || challenge.length !== 64 || signature.length !== 64) {
    return "verification_failed";
  }
  const m = salt.match(/\?expires=(\d+)$/);
  const expires = m ? Number(m[1]) : 0;
  if (expires * 1000 < Date.now()) return "verification_expired";
  if (!safeEqual(await hmac(challenge), signature)) return "verification_failed";
  if (!safeEqual(await sha256(salt + number), challenge)) return "verification_failed";
  const fresh = await rpc("claim_pow", { p_sig: signature, p_expires: new Date(expires * 1000).toISOString() });
  return fresh === true ? null : "verification_expired";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (origin && !ALLOWED.includes(origin)) return json({ error: "origin_not_allowed" }, 403, origin);

  try {
    if (req.method === "GET") {
      if (new URL(req.url).searchParams.has("challenge")) {
        return json(await newChallenge(), 200, origin, { "Cache-Control": "no-store" });
      }
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
    if (!body.pow) return json({ error: "verification_required" }, 400, origin);

    // Rate limits first, so floods are cheap to turn away
    const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    const limit = await rpc("check_signup_rate", { p_ip_hash: await sha256(SALT + ip) });
    if (limit !== "ok") return json({ error: limit }, 429, origin, { "Retry-After": "600" });

    // Invisible human check: a solved, signed, unexpired, never-used puzzle
    const powError = await checkPow(body.pow);
    if (powError) return json({ error: powError }, 403, origin);

    const result = await rpc("join_waitlist", { p_email: email, p_monthly_loss: loss, p_source: "landing" });
    return json(result, 200, origin);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500, origin);
  }
});
