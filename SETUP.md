# Setup guide (about 1.5 hours, do it in this order)

## 1. Supabase (database + login)
1. supabase.com -> New project. Save the DB password.
2. Project Settings -> API: copy Project URL, `anon public` key, `service_role` key.
3. SQL Editor -> paste all of `sql/schema.sql` -> Run. Expect "Success" and 5 tables.
4. Authentication -> URL Configuration: Site URL `http://localhost:3000`; Redirect URLs add `http://localhost:3000/**` (later your live URL + `/**`).
5. Authentication -> Providers: enable Google (step 2), turn Email sign-up off.

## 2. Google Cloud (Google login)
1. console.cloud.google.com -> new project -> APIs & Services -> OAuth consent screen: app name "Engage 6.0", support email.
2. **Publish the app (In production).** In "Testing" only listed test users can log in. This is the #1 trap.
3. Credentials -> Create OAuth client ID -> Web application. Authorized redirect URI = the Callback URL shown in Supabase (`https://<ref>.supabase.co/auth/v1/callback`).
4. Paste Client ID + Secret into Supabase -> Providers -> Google.

## 3. Razorpay
Use TEST keys first (`rzp_test_...`): Dashboard -> Account & Settings -> API Keys. Ask the account owner to confirm automatic capture is on. Webhook is optional (needs a public https URL): `https://YOUR-DOMAIN/api/webhooks/razorpay`, events `payment.captured` + `order.paid`, secret = `RAZORPAY_WEBHOOK_SECRET`.

## 4. Run locally
```
npm install
cp .env.example .env     # fill SUPABASE_*, RAZORPAY_*, ADMIN_EMAILS
npm start                # http://localhost:3000   (/healthz must return {"ok":true})
```
`.env` keeps FEE_PER_HEAD_RUPEES=250, MIN_TEAM=2, MAX_TEAM=4, REG_DEADLINE=2026-10-27T18:00:00+05:30. Never commit `.env`; the service_role key and Razorpay secret live only there.

## 5. Test before announcing (Razorpay test mode, two Google accounts A and B)
1. A: click Register -> Google -> lands on /app.html -> fill profile -> Team step.
2. B: same, profile done, leave on Team step.
3. A: create team, invite B's email. B: sees invite, Join.
4. A: total becomes Rs 500, button "Pay Rs 500 & lock team".
5. Pay with test card 4111 1111 1111 1111 (any future date, any CVV) or UPI `success@razorpay`.
6. Both see "You're in". Landing buttons now read "You're in. View team".
7. Try `failure@razorpay`: error toast, can retry or Back to team.
Phones: open the link in Chrome/Safari, not inside Instagram/WhatsApp.

## 6. Deploy on Vercel (files `api/index.js` and `vercel.json` are already set up)
1. Push the folder to a GitHub repo (`.env` is git-ignored, keep it that way). Vercel -> Add New Project -> import the repo. Framework: Other. Leave build settings empty.
2. Settings -> Environment Variables: add every value from `.env` (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, FEE_PER_HEAD_RUPEES, MIN_TEAM, MAX_TEAM, REG_DEADLINE, ADMIN_EMAILS). Redeploy after adding them.
3. Open `https://YOUR-APP.vercel.app/healthz` -> `{"ok":true}`. Then use that URL in Supabase (Site URL + Redirect URLs `/**`), Google (JavaScript origin) and the Razorpay webhook.

(Any Node host such as Render or Railway also works with `npm start` and no extra files.)

## 6b. Other hosts
Start command `npm start`, add the `.env` values as environment variables. Then: Supabase Site URL + Redirect URL = live URL; add the webhook; swap to live Razorpay keys; make one real Rs 500 payment with two own accounts; delete test teams/users; set ADMIN_EMAILS (they get "Export CSV").

## Trouble
- "Access blocked" from Google -> consent screen still in Testing.
- Lands on a Supabase error page -> Site URL / Redirect URLs mismatch (http vs https, trailing slash).
- `redirect_uri_mismatch` -> Supabase callback not added to the Google client exactly.
- Paid but shows pending -> wait 2-3 min or press Back to team (asks Razorpay).
- Many 429s on college Wi-Fi -> raise the rate limits at the top of server/server.js.
