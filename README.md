# SitOut

The landing page for SitOut, the app for quitting sports betting. It collects emails, and the first 500 sign-ups get SitOut free for life.

- **Site:** plain HTML, CSS and JS, with animations from [Motion](https://motion.dev) (bundled in `assets/motion.min.js`, no build step). It's hosted free on GitHub Pages.
- **Backend:** the Supabase project **sitout**. One edge function (`waitlist`) handles every sign-up. Visitors can't read or write the database directly.

## How it's protected

Every sign-up goes through these checks, in this order:

| Layer | What it does |
|---|---|
| Origin allowlist | Sign-ups only work from the SitOut site, not from other websites. |
| Honeypot | A hidden field only bots fill in. They get a fake "success" and nothing is saved. |
| Size limit | Requests over 2 KB are rejected. |
| Rate limit, per visitor | 5 tries per 10 minutes and 20 per day from one connection. IPs are stored only as a scrambled hash and deleted after 24 hours. |
| Rate limit, whole site | 60 tries per minute across everyone. Anything above that is turned away before it touches the list. |
| Human check | Invisible proof of work: the browser solves a small puzzle from the server (about 1 to 3 seconds, while the visitor types). Each puzzle is signed, expires in 10 minutes and works once. No third-party captcha and nothing to click. |
| Hard caps | Free spots can never go past 500 (sign-ups are processed one at a time). The list stops at 50,000 emails. Rate-limit records are pruned daily. |
| Locked database | Visitors can't read, change or delete anything. Re-entering an email never reveals whether it's already on the list. |

What this can't fully stop: someone with many real email addresses, many internet connections and computing time to burn could still add some fake sign-ups, slowly. The caps mean they can never crash or fill the database. Before launch, skim the list for obvious junk. Sending a confirmation email is the next upgrade if you need it.

## Setup (about 20 minutes)

### 1–2. GitHub and Pages (done)
The code lives at github.com/ebaisden-create/SitOut. GitHub Pages deploys it with the included workflow on every commit to `main`.

Until the domain is connected, the site is at `https://ebaisden-create.github.io/SitOut/`.

### 3. Human check (done)
Built in, nothing to set up. To make the puzzle harder, add a Supabase secret `POW_MAXNUMBER` (default 75000; higher means more work per sign-up).

### 4. Finish the setup
- **Remove the test sign-up:** in Supabase **SQL Editor**, run:
  ```sql
  delete from public.waitlist where email = 'claude-test@example.com';
  ```
- **Add your contact email:** replace `CONTACT_EMAIL` in `privacy.html` (it appears twice).
- **Custom domain (getsitout.com):**
  1. Add a file named `CNAME` containing `getsitout.com`.
  2. Point the domain's DNS at GitHub Pages: A records to 185.199.108.153, 185.199.109.153, 185.199.110.153 and 185.199.111.153, plus a `www` CNAME to `ebaisden-create.github.io`.
  3. Then, in **Settings → Pages**, turn on **Enforce HTTPS**.
  4. `getsitout.com` and `www.getsitout.com` are already allowed by the function. For any other domain, add a Supabase secret `ALLOWED_ORIGINS`: a comma-separated list of every site address that's allowed.

## Seeing your sign-ups
Go to Supabase **Table Editor → waitlist** (you can export it to CSV), or use the SQL Editor:

```sql
select count(*) filter (where founding) as founding, count(*) as total from public.waitlist;
select spot, email, monthly_loss, created_at from public.waitlist order by created_at;
```

## Files
- `index.html`, `privacy.html`, `config.js`, `assets/`: the site
- `supabase/migrations/`: database tables and functions, including the proof-of-work check (already applied)
- `supabase/functions/waitlist/index.ts`: the sign-up function (already deployed)
- `.github/workflows/pages.yml`: deploys to GitHub Pages

Struggling right now? Call or text 1-800-GAMBLER, free and 24/7.
