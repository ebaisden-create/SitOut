// SitOut waitlist page: Motion animations + signup form
(function () {
  const cfg = window.SITOUT_CONFIG || {};
  const M = window.Motion;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const anim = (el, kf, opt) => (M && !reduce ? M.animate(el, kf, opt) : (Object.assign(el.style, lastFrame(kf)), null));
  function lastFrame(kf) { const o = {}; for (const k in kf) o[k] = Array.isArray(kf[k]) ? kf[k][kf[k].length - 1] : kf[k]; return o; }

  // ---- Hero: the switch clicks off, then the headline lands ----
  function flipOff(sw, delay) {
    const knob = sw.querySelector(".knob");
    const travel = sw.clientWidth - knob.offsetWidth - 14; // 7px gap each side
    if (!M || reduce) { sw.classList.add("off"); return; }
    M.animate(knob, { transform: [`translateX(${travel}px)`, "translateX(0px)"], backgroundColor: ["#0A110E", "#3EE08F"] },
      { delay, type: "spring", stiffness: 520, damping: 26 });
    M.animate(sw, { backgroundColor: ["rgba(62,224,143,1)", "rgba(62,224,143,0)"], scale: [1, 0.94, 1] },
      { delay, duration: 0.35 });
  }
  function intro() {
    const sw = $(".hero .switch");
    flipOff(sw, 0.45);
    if (!M || reduce) return;
    M.animate(sw, { opacity: [0, 1], y: [12, 0] }, { duration: 0.35 });
    M.animate(".headline span, .headline em", { opacity: [0, 1], y: [28, 0] },
      { delay: M.stagger(0.12, { startDelay: 0.75 }), type: "spring", stiffness: 300, damping: 24 });
    M.animate(".lede, .founding, #form", { opacity: [0, 1], y: [16, 0] },
      { delay: M.stagger(0.08, { startDelay: 1.0 }), duration: 0.5, ease: [0.22, 1, 0.36, 1] });
    M.inView(".calc, .features article, .faq", (el) => {
      M.animate(el, { opacity: [0, 1], y: [24, 0] }, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    }, { margin: "0px 0px -10% 0px" });
  }

  // ---- Founding spots counter ----
  let spotsShown = 500;
  function showSpots(left) {
    left = Math.max(0, Math.min(500, left | 0));
    const el = $("#spots"), bar = $("#bar");
    const from = spotsShown; spotsShown = left;
    if (M && !reduce) M.animate(from, left, { duration: 1.2, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => (el.textContent = Math.round(v)) });
    else el.textContent = left;
    anim(bar, { width: ["0%", ((500 - left) / 500) * 100 + "%"] }, { duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] });
    if (left === 0) $(".founding-row strong").textContent = "All 500 free spots are taken. Join for the founding price.";
  }
  async function loadSpots() {
    if (!cfg.apiUrl) return;
    try {
      const r = await fetch(cfg.apiUrl, { method: "GET" });
      if (r.ok) { const d = await r.json(); if (typeof d.spots_left === "number") showSpots(d.spots_left); }
    } catch (_) { /* keep the default */ }
  }

  // ---- Money calculator (nothing is sent unless they sign up) ----
  let lossTouched = false;
  function calc() {
    const v = +$("#loss").value;
    $("#loss-out").textContent = fmt(v);
    $("#yr").textContent = fmt(v * 12);
    $("#fy").textContent = fmt(v * 60);
  }

  // ---- Captcha (Cloudflare Turnstile) ----
  let token = "", widget = null;
  function renderCaptcha() {
    if (!cfg.turnstileSiteKey) return;
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.defer = true;
    s.onload = () => {
      widget = window.turnstile.render("#captcha", {
        sitekey: cfg.turnstileSiteKey, action: "waitlist", theme: "dark", appearance: "interaction-only",
        callback: (t) => { token = t; },
        "expired-callback": () => { token = ""; },
        "error-callback": () => { token = ""; },
      });
    };
    document.head.appendChild(s);
  }
  function resetCaptcha() { token = ""; if (widget !== null && window.turnstile) window.turnstile.reset(widget); }

  // ---- Form ----
  function say(text, kind) { const m = $("#msg"); m.textContent = text; m.className = "msg " + (kind || ""); }
  const ERR = {
    invalid_email: "That email doesn't look right. Check it and try again.",
    captcha_required: "Finish the quick check below, then tap the button again.",
    captcha_failed: "The quick check didn't go through. Try again.",
    ip_limited: "Too many tries from this connection. Wait about 10 minutes.",
    global_limited: "Lots of sign-ups right now. Try again in a minute.",
    captcha_not_configured: "Sign-ups open soon. Check back shortly.",
    origin_not_allowed: "Sign-ups only work from the SitOut site.",
  };
  async function submit(e) {
    e.preventDefault();
    const email = $("#email").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say(ERR.invalid_email, "err");
    if (!cfg.apiUrl) return say("Sign-ups open soon. Check back shortly.", "err");
    if (cfg.turnstileSiteKey && !token) return say(ERR.captcha_required, "err");
    const btn = $("#submit"); btn.disabled = true; btn.textContent = "Saving your spot...";
    say("");
    try {
      const r = await fetch(cfg.apiUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, website: $("#website").value, monthly_loss: lossTouched ? +$("#loss").value : null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { say(ERR[d.error] || "Something went wrong. Try again in a minute.", "err"); resetCaptcha(); return; }
      done(d);
    } catch (_) {
      say("Couldn't reach the server. Check your connection and try again.", "err"); resetCaptcha();
    } finally { btn.disabled = false; btn.textContent = "Claim my free spot"; }
  }
  function done(d) {
    let title = "You're in.", body = "";
    if (d.status === "joined" && d.founding) { title = `You're #${d.spot} of 500.`; body = "Your free spot is saved. We'll email you the day SitOut launches."; }
    else if (d.status === "joined") { body = "All 500 free spots are gone, but you're on the list for the founding price. We'll email you at launch."; }
    else if (d.status === "exists") { title = "You're already on the list."; body = "Nothing else to do. We'll email you at launch."; }
    else if (d.status === "full") { title = "The list is full."; body = "Thanks for the interest. Follow along for launch news."; }
    if (typeof d.spots_left === "number") showSpots(d.spots_left);
    $("#done-title").textContent = title; $("#done-body").textContent = body;
    const form = $("#form"), card = $("#done");
    form.hidden = true; card.hidden = false;
    if (M && !reduce) M.animate(card, { opacity: [0, 1], scale: [0.96, 1] }, { type: "spring", stiffness: 380, damping: 26 });
  }

  function start() {
    intro(); calc(); loadSpots(); renderCaptcha();
    $("#loss").addEventListener("input", () => { lossTouched = true; calc(); });
    $("#form").addEventListener("submit", submit);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
