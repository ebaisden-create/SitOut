// Public settings for the waitlist page. Nothing secret goes in this file.
window.SITOUT_CONFIG = {
  // Supabase edge function that handles sign-ups (captcha + rate limits live there)
  apiUrl: "https://yvjzgdvtqcjfrnggrqhn.supabase.co/functions/v1/waitlist",
  // Cloudflare Turnstile SITE key (public). Paste yours here; see README step 3.
  turnstileSiteKey: ""
};
