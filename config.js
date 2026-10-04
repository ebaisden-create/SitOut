// Public settings for the waitlist page. Nothing secret goes in this file.
window.SITOUT_CONFIG = {
  // Supabase edge function that handles sign-ups (human check + rate limits live there)
  apiUrl: "https://yvjzgdvtqcjfrnggrqhn.supabase.co/functions/v1/waitlist"
};
