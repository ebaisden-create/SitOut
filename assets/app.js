// SitOut launch page: Motion choreography, live phone demo, money calculator, sign-up form.
(function () {
  const cfg = window.SITOUT_CONFIG || {};
  const M = window.Motion;
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const EASE = [0.22, 1, 0.36, 1];
  const WIPE = [0.76, 0, 0.24, 1];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const animOK = !!M && !reduce;
  let entranceStarted = false;

  function showEverything() { root.classList.add("anim-done"); const i = $("#intro"); if (i) i.remove(); }

  // ---------- 1. Brand intro ----------
  async function intro() {
    const box = $("#intro");
    if (!animOK || root.classList.contains("seen") || !box) { if (box) box.remove(); return heroEntrance(0); }
    const sw = box.querySelector(".intro-switch"), knob = sw.querySelector(".knob");
    M.animate(sw, { opacity: [0, 1], scale: [0.6, 1] }, { type: "spring", stiffness: 380, damping: 22 });
    await sleep(380);
    // the click: knob snaps left, the track empties, a little squash
    M.animate(knob, { transform: ["translateX(68px)", "translateX(0px)"], backgroundColor: ["#0A110E", "#3EE08F"] },
      { type: "spring", stiffness: 520, damping: 24 });
    M.animate(sw, { backgroundColor: ["rgba(62,224,143,1)", "rgba(62,224,143,0)"], scale: [1, 0.93, 1] }, { duration: 0.34 });
    await sleep(240);
    M.animate(".intro-word span", { transform: ["translateY(110%)", "translateY(0%)"] },
      { delay: M.stagger(0.045), duration: 0.55, ease: EASE });
    await sleep(820);
    heroEntrance(0.18);
    await M.animate(box, { clipPath: ["inset(0% 0% 0% 0%)", "inset(0% 0% 100% 0%)"] }, { duration: 0.75, ease: WIPE });
    box.remove();
    try { sessionStorage.setItem("sitout-intro", "1"); } catch (e) {}
  }

  // ---------- 2. Hero entrance ----------
  function heroEntrance(d) {
    if (entranceStarted) return; entranceStarted = true;
    if (!animOK) { showEverything(); phoneDemo(0); return; }
    M.animate(".headline .word", { transform: ["translateY(108%)", "translateY(0%)"] },
      { delay: M.stagger(0.08, { startDelay: d }), duration: 0.95, ease: EASE });
    M.animate(".hero .reveal", { opacity: [0, 1], transform: ["translateY(18px)", "translateY(0px)"] },
      { delay: M.stagger(0.08, { startDelay: d + 0.3 }), duration: 0.8, ease: EASE });
    M.animate("#phone", { opacity: [0, 1], transform: ["translateY(70px) rotate(7deg) scale(.95)", "translateY(0px) rotate(0deg) scale(1)"] },
      { delay: d + 0.35, duration: 1.2, ease: EASE });
    phoneDemo(d + 1.0);
    // gentle float, forever
    sleep((d + 1.6) * 1000).then(() => M.animate(".hero-visual", { transform: ["translateY(0px)", "translateY(-10px)"] },
      { duration: 3.2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }));
  }

  // ---------- 3. Live phone demo ----------
  function countTo(el, to, dur, delay) {
    if (!animOK) { el.textContent = fmt(to); return; }
    M.animate(0, to, { duration: dur, delay, ease: EASE, onUpdate: (v) => (el.textContent = fmt(v)) });
  }
  function phoneDemo(d) {
    const ring = $("#ring"), C = 314.16, target = C * (1 - 21 / 30);
    countTo($("#streak"), 21, 1.6, d);
    countTo($("#kept"), 1260, 2.0, d + 0.2);
    if (!animOK) { ring.style.strokeDashoffset = target; $("#spark").style.strokeDashoffset = 0; return; }
    M.animate(ring, { strokeDashoffset: [C, target] }, { duration: 1.6, delay: d, ease: EASE });
    M.animate("#spark", { strokeDashoffset: [140, 0] }, { duration: 1.4, delay: d + 0.4, ease: EASE });
    const toast = $("#toast");
    const cycle = async () => {
      await M.animate(toast, { transform: ["translateY(-140%)", "translateY(0%)"], opacity: [0, 1] }, { type: "spring", stiffness: 300, damping: 26 });
      await sleep(4200);
      await M.animate(toast, { transform: ["translateY(0%)", "translateY(-140%)"], opacity: [1, 0] }, { duration: 0.45, ease: WIPE });
      await sleep(3200); cycle();
    };
    sleep((d + 1.8) * 1000).then(cycle);
  }

  // ---------- 4. Scroll reveals + nav ----------
  function scrollBits() {
    const nav = $("#nav");
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    if (!animOK) return;
    M.inView(".reveal-on-scroll", (el) => {
      const sibs = Array.from(el.parentElement.children).filter((c) => c.classList.contains("reveal-on-scroll"));
      const i = Math.max(0, sibs.indexOf(el));
      M.animate(el, { opacity: [0, 1], transform: ["translateY(28px)", "translateY(0px)"] }, { duration: 0.85, delay: i * 0.09, ease: EASE });
    }, { margin: "0px 0px -10% 0px" });
  }

  // ---------- 5. Founding spots ----------
  let spotsShown = 250;
  function showSpots(left) {
    left = Math.max(0, Math.min(250, left | 0));
    const from = spotsShown; spotsShown = left;
    if (animOK) M.animate(from, left, { duration: 1.2, ease: EASE, onUpdate: (v) => ($("#spots").textContent = Math.round(v)) });
    else $("#spots").textContent = left;
    const w = ((250 - left) / 250) * 100;
    if (animOK) M.animate("#bar", { width: ["0%", Math.max(w, 1.5) + "%"] }, { duration: 1.2, delay: 0.4, ease: EASE });
    else $("#bar").style.width = w + "%";
    if (left === 0) $(".founding-row strong").textContent = "All 250 free spots are taken. Join for the founding price.";
  }
  async function loadSpots() {
    if (!cfg.apiUrl) return;
    try {
      const r = await fetch(cfg.apiUrl);
      if (r.ok) { const d = await r.json(); if (typeof d.spots_left === "number") showSpots(d.spots_left); }
    } catch (_) {}
  }

  // ---------- 6. Money calculator ----------
  let lossTouched = false, shown = { yr: 2400, fy: 12000, i5: 0, i10: 0 };
  // Future value of a monthly contribution at ~10%/yr, compounded monthly
  const grow = (perMonth, years) => { const r = 0.10 / 12, n = years * 12; return perMonth * ((Math.pow(1 + r, n) - 1) / r); };
  function setMoney(id, to, sign) {
    const el = $("#" + id), from = shown[id]; shown[id] = to;
    const paint = (v) => (el.textContent = (sign || "−") + "$" + fmt(v));
    if (animOK) M.animate(from, to, { duration: 0.45, ease: EASE, onUpdate: paint }); else paint(to);
  }
  function calc() {
    const v = +$("#loss").value;
    $("#loss-out").textContent = "$" + fmt(v);
    setMoney("yr", v * 12); setMoney("fy", v * 60);
    setMoney("i5", grow(v, 5), "+"); setMoney("i10", grow(v, 10), "+");
  }

  // ---------- 7. Invisible human check (proof of work) ----------
  // The browser solves a small puzzle from the server (a second or two, while the visitor types).
  let pow = null, powJob = null;
  async function sha256hex(str) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
  }
  async function solvePow() {
    const r = await fetch(cfg.apiUrl + "?challenge=1", { cache: "no-store" });
    if (!r.ok) throw new Error("challenge");
    const c = await r.json();
    for (let n = 0; n <= c.maxnumber; n++) {
      if ((await sha256hex(c.salt + n)) === c.challenge) return { salt: c.salt, number: n, challenge: c.challenge, signature: c.signature };
      if (n % 2000 === 0) await new Promise((res) => setTimeout(res, 0));
    }
    throw new Error("unsolved");
  }
  function startPow() {
    if (!cfg.apiUrl || powJob) return powJob;
    powJob = solvePow().then((p) => (pow = p)).catch(() => { powJob = null; pow = null; });
    return powJob;
  }
  function resetPow() { pow = null; powJob = null; startPow(); }

  // ---------- 8. Form ----------
  const ERR = {
    invalid_email: "That email doesn't look right. Check it and try again.",
    verification_required: "Still checking your connection. Tap the button again in a second.",
    verification_failed: "The quick check didn't go through. Tap the button again.",
    verification_expired: "That took a while, so we refreshed the check. Tap the button again.",
    ip_limited: "Too many tries from this connection. Wait about 10 minutes.",
    global_limited: "Lots of sign-ups right now. Try again in a minute.",
    origin_not_allowed: "Sign-ups only work from the SitOut site.",
  };
  function say(text, kind) { const m = $("#msg"); m.textContent = text; m.className = "msg " + (kind || ""); }
  function setBtn(text) { $("#submit .btn-label").textContent = text; }
  function shake() { if (animOK) M.animate("#form", { transform: ["translateX(0)", "translateX(-8px)", "translateX(7px)", "translateX(-4px)", "translateX(0)"] }, { duration: 0.4 }); }
  async function submit(e) {
    e.preventDefault();
    const email = $("#email").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { shake(); return say(ERR.invalid_email, "err"); }
    if (!cfg.apiUrl) return say("Sign-ups open soon. Check back shortly.", "err");
    const btn = $("#submit"); btn.disabled = true; say("");
    try {
      if (!pow) { setBtn("Checking you're human..."); startPow(); await powJob; }
      if (!pow) { shake(); return say("Couldn't reach the server. Check your connection and try again.", "err"); }
      setBtn("Saving your spot...");
      const r = await fetch(cfg.apiUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pow, website: $("#website").value, monthly_loss: lossTouched ? +$("#loss").value : null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { shake(); say(ERR[d.error] || "Something went wrong. Try again in a minute.", "err"); resetPow(); return; }
      done(d);
    } catch (_) {
      shake(); say("Couldn't reach the server. Check your connection and try again.", "err"); resetPow();
    } finally { btn.disabled = false; setBtn("Claim my free spot"); }
  }
  async function done(d) {
    let title = "You're in.", body = "";
    if (d.status === "joined" && d.founding) { title = `You're #${d.spot} of 250.`; body = "Your free spot is saved. We'll email you the day SitOut launches."; }
    else if (d.status === "joined") { body = "All 250 free spots are gone, but you're on the list for the founding price. We'll email you at launch."; }
    else if (d.status === "exists") { title = "You're already on the list."; body = "Nothing else to do. We'll email you at launch."; }
    else if (d.status === "full") { title = "The list is full."; body = "Thanks for the interest. Follow @sitoutapp for launch news."; }
    if (typeof d.spots_left === "number") showSpots(d.spots_left);
    $("#done-title").textContent = title; $("#done-body").textContent = body;
    const form = $("#form"), card = $("#done");
    if (animOK) await M.animate(form, { opacity: [1, 0], transform: ["scale(1)", "scale(.97)"] }, { duration: 0.22 });
    form.hidden = true; card.hidden = false;
    if (!animOK) return;
    M.animate(card, { opacity: [0, 1], transform: ["translateY(10px) scale(.97)", "translateY(0) scale(1)"] }, { type: "spring", stiffness: 360, damping: 26 });
    const k = card.querySelector(".knob"), s = card.querySelector(".mini-switch");
    M.animate(k, { transform: ["translateX(24px)", "translateX(0px)"], backgroundColor: ["#0A110E", "#3EE08F"] }, { delay: 0.35, type: "spring", stiffness: 520, damping: 22 });
    M.animate(s, { backgroundColor: ["rgba(62,224,143,1)", "rgba(62,224,143,0)"] }, { delay: 0.35, duration: 0.3 });
  }

  function start() {
    if (!animOK) showEverything();
    // Safety net: if the entrance never starts (blocked script, odd browser), show the page anyway.
    setTimeout(() => { if (!entranceStarted) { showEverything(); phoneDemo(0); } }, 4500);
    setTimeout(() => { const i = $("#intro"); if (i) i.remove(); }, 6000); // the intro can never block the page
    intro(); scrollBits(); calc(); loadSpots(); startPow();
    $("#loss").addEventListener("input", () => { lossTouched = true; calc(); });
    $("#form").addEventListener("submit", submit);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
