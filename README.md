# Engage 6.0 — landing page + registration app

NCU x InfraOne School of AI. Landing page (GSAP/Lenis), Google sign-in (Supabase), profile, teams + invites, Rs 250 per head through Razorpay.

```
package.json, .env.example, .gitignore
sql/schema.sql          run once in Supabase SQL Editor
server/server.js        Express API + serves public/ (one origin, no CORS)
public/index.html       landing page (all Register buttons carry data-cta)
public/app.html         dashboard: Profile -> Team -> Payment -> You're in
public/css/style.css    landing styles        public/css/app.css  dashboard styles
public/js/main.js       landing animations + CONFIG (event details)
public/js/auth.js       shared Supabase client (E6)
public/js/landing-auth.js  CTA labels/clicks + live team count
public/js/app.js        dashboard logic
```

Setup, keys, deploy and the test script: see **SETUP.md**.

Event details live in `CONFIG` at the top of `public/js/main.js` (dates, 4 hours, prizes, Rs 1,55,000*). The fee must match in two places: `CONFIG.feePerHead` (display) and `FEE_PER_HEAD_RUPEES` in `.env` (what is actually charged).
