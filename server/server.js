'use strict';
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const { z } = require('zod');
 
/* ------------------------------------------------------------------ config */
const need = (k) => { const v = process.env[k]; if (!v) throw new Error('Missing env var ' + k); return v; };
const opt = (k, d = '') => process.env[k] || d;
 
const CFG = {
  port: Number(opt('PORT', '3000')),
  supabaseUrl: need('SUPABASE_URL'),
  anonKey: need('SUPABASE_ANON_KEY'),
  serviceKey: need('SUPABASE_SERVICE_ROLE_KEY'),
  rzpKeyId: need('RAZORPAY_KEY_ID'),
  rzpSecret: need('RAZORPAY_KEY_SECRET'),
  rzpWebhookSecret: opt('RAZORPAY_WEBHOOK_SECRET'),
  feePaise: Math.round(Number(opt('FEE_PER_HEAD_RUPEES', '250')) * 100),
  minTeam: Number(opt('MIN_TEAM', '2')),
  maxTeam: Number(opt('MAX_TEAM', '4')),
  deadline: opt('REG_DEADLINE'),
  admins: new Set(opt('ADMIN_EMAILS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)),
  staleMinutes: 20,
};
 
const admin = createClient(CFG.supabaseUrl, CFG.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const rzp = new Razorpay({ key_id: CFG.rzpKeyId, key_secret: CFG.rzpSecret });
 
/* ----------------------------------------------------------------- helpers */
const rpc = async (name, args) => { const { data, error } = await admin.rpc(name, args); if (error) throw error; return data; };
const q = async (promise) => { const { data, error } = await promise; if (error) throw error; return data; };
const safeEq = (a, b) => { const A = Buffer.from(String(a)); const B = Buffer.from(String(b)); return A.length === B.length && crypto.timingSafeEqual(A, B); };
const uuid = z.string().uuid();
const registrationClosed = () => CFG.deadline && Date.now() > Date.parse(CFG.deadline);
 
const KNOWN = {
  PROFILE_REQUIRED: [400, 'Complete your profile first.'],
  ALREADY_IN_TEAM: [409, 'You are already in a team.'],
  NAME_TAKEN: [409, 'That team name is taken. Try another.'],
  TEAM_NOT_FOUND: [404, 'Team not found.'],
  NOT_LEADER: [403, 'Only the team leader can do that.'],
  TEAM_LOCKED: [409, 'This team is locked for payment or already paid.'],
  SELF_INVITE: [400, 'You cannot invite yourself.'],
  NOT_REGISTERED: [404, 'That email has not signed up and completed a profile yet. Ask them to register first.'],
  INVITEE_IN_TEAM: [409, 'That person is already in a team.'],
  TEAM_FULL: [409, 'The team is full.'],
  ALREADY_INVITED: [409, 'You already invited that person.'],
  INVITE_NOT_FOUND: [404, 'Invite not found.'],
  INVITE_CLOSED: [409, 'That invite is no longer active.'],
  LEADER_CANNOT_LEAVE: [409, 'The leader cannot leave. Disband the team instead.'],
  NOT_A_MEMBER: [404, 'That person is not in this team.'],
  ALREADY_PAID: [409, 'This team has already paid.'],
  TEAM_TOO_SMALL: [409, `A team needs at least ${CFG.minTeam} members before paying.`],
  ORDER_NOT_FOUND: [404, 'Order not found.'],
  REG_CLOSED: [403, 'Registrations are closed.'],
  FORBIDDEN: [403, 'Not allowed.'],
};
const DUP = [
  ['profiles_phone_key', 'PHONE_TAKEN', 'That phone number is already registered.'],
  ['profiles_college_roll_key', 'ROLL_TAKEN', 'That roll number is already registered for this college.'],
  ['profiles_email_key', 'EMAIL_TAKEN', 'That email already has a profile.'],
  ['team_members_user_id_key', 'ALREADY_IN_TEAM', 'You are already in a team.'],
  ['teams_name_key', 'NAME_TAKEN', 'That team name is taken. Try another.'],
];
 
function fail(res, e) {
  if (e instanceof z.ZodError) {
    const i = e.issues[0];
    return res.status(400).json({ error: 'VALIDATION', field: i.path[0], message: i.message });
  }
  const code = String((e && e.message) || '').trim();
  if (KNOWN[code]) return res.status(KNOWN[code][0]).json({ error: code, message: KNOWN[code][1] });
  if (e && e.code === '23505') {
    const hit = DUP.find(([c]) => code.includes(c));
    if (hit) return res.status(409).json({ error: hit[1], message: hit[2] });
  }
  if (e && e.code === '23503') return res.status(409).json({ error: 'HAS_RECORDS', message: 'This team has payment records. Contact the organisers.' });
  if (e && e.error && e.error.description) {            // Razorpay SDK error shape
    console.error('razorpay error', e.statusCode, e.error);
    return res.status(502).json({ error: 'PAYMENT_PROVIDER', message: 'Payment provider error. Please try again in a moment.' });
  }
  if (e && e.type === 'entity.parse.failed') return res.status(400).json({ error: 'BAD_JSON', message: 'Bad request.' });
  console.error(e);
  return res.status(500).json({ error: 'SERVER', message: 'Something went wrong. Please try again.' });
}
const h = (fn) => (req, res) => fn(req, res).catch((e) => fail(res, e));
 
/* -------------------------------------------------------------------- app */
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));   // see doc section 10 for adding a CSP later
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
const strict = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
 
/* ---- Razorpay webhook: MUST be registered BEFORE express.json() (needs the raw body) ---- */
app.post('/api/webhooks/razorpay', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  try {
    if (!CFG.rzpWebhookSecret) return res.status(503).end();
    const sig = req.get('x-razorpay-signature') || '';
    const expected = crypto.createHmac('sha256', CFG.rzpWebhookSecret).update(req.body).digest('hex');
    if (!safeEq(expected, sig)) return res.status(400).end();
    const ev = JSON.parse(req.body.toString('utf8'));
    if (ev.event === 'payment.captured' || ev.event === 'order.paid') {
      const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
      const orderId = (pay && pay.order_id) || (ev.payload && ev.payload.order && ev.payload.order.entity && ev.payload.order.entity.id);
      if (orderId && pay && pay.id) {
        try { await markPaid(orderId, pay.id); }
        catch (e) { if (String(e.message).trim() !== 'ORDER_NOT_FOUND') throw e; /* not our order: ignore */ }
      }
    }
    res.json({ ok: true });
  } catch (e) { console.error('webhook error', e); res.status(500).end(); }
});
 
app.use(express.json({ limit: '20kb' }));
 
/* ------------------------------------------------------------ public routes */
app.get('/healthz', (req, res) => res.json({ ok: true }));
 
app.get('/api/config', (req, res) => res.json({
  supabaseUrl: CFG.supabaseUrl,
  supabaseAnonKey: CFG.anonKey,          // public by design; protected by RLS
  razorpayKeyId: CFG.rzpKeyId,           // public key id (NEVER the secret)
  feeRupees: CFG.feePaise / 100,
  minTeam: CFG.minTeam,
  maxTeam: CFG.maxTeam,
  deadline: CFG.deadline || null,
}));
 
let statsCache = { at: 0, data: { teams: 0, participants: 0, registered: 0 } };
app.get('/api/stats', h(async (req, res) => {
  if (Date.now() - statsCache.at > 30000) {
    const [t, p, m] = await Promise.all([
      admin.from('teams').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('team_members').select('user_id, teams!inner(status)', { count: 'exact', head: true }).eq('teams.status', 'paid'),
    ]);
    statsCache = { at: Date.now(), data: { teams: t.count || 0, participants: m.count || 0, registered: p.count || 0 } };
  }
  res.json(statsCache.data);
}));
 
/* -------------------------------------------------------------------- auth */
async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'NO_TOKEN', message: 'Please sign in.' });
    const { data, error } = await admin.auth.getUser(token);      // verifies the JWT with Supabase
    if (error || !data || !data.user || !data.user.email) return res.status(401).json({ error: 'BAD_TOKEN', message: 'Session expired. Please sign in again.' });
    const u = data.user; const md = u.user_metadata || {};
    req.user = { id: u.id, email: u.email.toLowerCase(), name: md.full_name || md.name || '', avatar: md.avatar_url || md.picture || null };
    next();
  } catch (e) { fail(res, e); }
}
 
/* ------------------------------------------------------------ data loaders */
async function loadTeam(uid) {
  const tm = await q(admin.from('team_members').select('role, teams(id,name,status,leader_id,paid_at)').eq('user_id', uid).maybeSingle());
  return tm && tm.teams ? { ...tm.teams, myRole: tm.role } : null;
}
 
async function markPaid(orderId, paymentId) {
  return rpc('mark_team_paid', { p_order_id: orderId, p_payment_id: paymentId, p_fee_paise: CFG.feePaise, p_min: CFG.minTeam });
}
 
/* Ask Razorpay what really happened before un-freezing a team. */
async function settleOpenPayment(teamId, cancelIfUnpaid = true) {
  const pay = await q(admin.from('payments').select('*').eq('team_id', teamId).eq('status', 'created').maybeSingle());
  if (!pay) return 'none';
  const order = await rzp.orders.fetch(pay.razorpay_order_id);
  if (order.status === 'paid') {
    const list = await rzp.orders.fetchPayments(pay.razorpay_order_id);
    const cap = ((list && list.items) || []).find((p) => p.status === 'captured');
    if (cap) { await markPaid(pay.razorpay_order_id, cap.id); return 'paid'; }
  }
  if (!cancelIfUnpaid) return 'pending';
  await rpc('cancel_payment', { p_team: teamId });
  return 'cancelled';
}
 
/* ---------------------------------------------------------------------- me */
app.get('/api/me', auth, h(async (req, res) => {
  const uid = req.user.id;
  const profile = await q(admin.from('profiles').select('*').eq('id', uid).maybeSingle());
  const out = {
    user: req.user, isAdmin: CFG.admins.has(req.user.email), profile: profile || null, team: null, members: [], sentInvites: [], incomingInvites: [], payment: null,
    limits: { feeRupees: CFG.feePaise / 100, minTeam: CFG.minTeam, maxTeam: CFG.maxTeam, deadline: CFG.deadline || null },
  };
  if (!profile) return res.json(out);
 
  out.incomingInvites = await q(admin.from('team_invites')
    .select('id, created_at, teams(name), inviter:profiles!team_invites_invited_by_fkey(full_name)')
    .eq('invitee_id', uid).eq('status', 'pending').order('created_at', { ascending: false }));
 
  let team = await loadTeam(uid);
  if (team && team.status === 'payment_pending') {
    // Recover lost callbacks / closed tabs: after 2 minutes ask Razorpay what really happened.
    // Paid -> confirm it. Unpaid for 20+ minutes -> release the roster.
    const open = await q(admin.from('payments').select('created_at').eq('team_id', team.id).eq('status', 'created').maybeSingle());
    const age = open ? Date.now() - Date.parse(open.created_at) : 0;
    if (open && age > 120000) {
      await settleOpenPayment(team.id, age > CFG.staleMinutes * 60000).catch((e) => console.error('settle', e));
      team = await loadTeam(uid);
    }
  }
  if (!team) return res.json(out);
  out.team = team;
  out.members = await q(admin.from('team_members')
    .select('role, user_id, joined_at, profiles(full_name, email, roll_no, college, avatar_url)').eq('team_id', team.id).order('joined_at'));
  if (team.myRole === 'leader' && team.status === 'forming') {
    out.sentInvites = await q(admin.from('team_invites')
      .select('id, created_at, invitee:profiles!team_invites_invitee_id_fkey(full_name, email)')
      .eq('team_id', team.id).eq('status', 'pending').order('created_at'));
  }
  out.payment = await q(admin.from('payments').select('razorpay_order_id, razorpay_payment_id, amount_paise, members_count, status, paid_at')
    .eq('team_id', team.id).in('status', ['created', 'paid', 'review']).order('created_at', { ascending: false }).limit(1).maybeSingle());
  res.json(out);
}));
 
/* ----------------------------------------------------------------- profile */
const optUrl = z.string().trim().max(200).refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Enter a full link starting with https://').optional();
const ProfileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(80),
  roll_no: z.string().trim().min(2, 'Enter your roll number').max(30),
  college: z.string().trim().min(2, 'Enter your college / university').max(120),
  course: z.string().trim().min(2, 'Enter your course and branch').max(80),
  year_of_study: z.coerce.number({ invalid_type_error: 'Choose your year' }).int().min(1, 'Choose your year').max(6, 'Choose your year'),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  github_url: optUrl,
  linkedin_url: optUrl,
});
app.put('/api/profile', auth, h(async (req, res) => {
  const p = ProfileSchema.parse(req.body);
  const row = {
    id: req.user.id, email: req.user.email, ...p,
    github_url: p.github_url || null, linkedin_url: p.linkedin_url || null,
    avatar_url: req.user.avatar, updated_at: new Date().toISOString(),
  };
  await q(admin.from('profiles').upsert(row, { onConflict: 'id' }));
  res.json({ ok: true });
}));
 
/* ------------------------------------------------------------------- teams */
const TeamName = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9 _.\-]{1,28}[A-Za-z0-9]$/, 'Team name: 3-30 letters, numbers, spaces, - _ .');
 
app.post('/api/teams', auth, strict, h(async (req, res) => {
  if (registrationClosed()) throw new Error('REG_CLOSED');
  const { name } = z.object({ name: TeamName }).parse(req.body);
  const id = await rpc('create_team', { p_user: req.user.id, p_name: name });
  res.json({ id });
}));
 
app.post('/api/teams/:id/invites', auth, strict, h(async (req, res) => {
  if (registrationClosed()) throw new Error('REG_CLOSED');
  const teamId = uuid.parse(req.params.id);
  const { email } = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email') }).parse(req.body);
  const invitee = await q(admin.from('profiles').select('id').eq('email', email).maybeSingle());
  if (!invitee) throw new Error('NOT_REGISTERED');
  const id = await rpc('send_invite', { p_leader: req.user.id, p_team: teamId, p_invitee: invitee.id, p_max: CFG.maxTeam });
  res.json({ id });
}));
 
app.post('/api/invites/:id/accept', auth, strict, h(async (req, res) => {
  if (registrationClosed()) throw new Error('REG_CLOSED');
  const teamId = await rpc('accept_invite', { p_user: req.user.id, p_invite: uuid.parse(req.params.id), p_max: CFG.maxTeam });
  res.json({ teamId });
}));
 
app.post('/api/invites/:id/decline', auth, h(async (req, res) => {
  const rows = await q(admin.from('team_invites').update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', uuid.parse(req.params.id)).eq('invitee_id', req.user.id).eq('status', 'pending').select('id'));
  if (!rows.length) throw new Error('INVITE_NOT_FOUND');
  res.json({ ok: true });
}));
 
app.delete('/api/invites/:id', auth, h(async (req, res) => {
  const inv = await q(admin.from('team_invites').select('id, teams(leader_id, status)').eq('id', uuid.parse(req.params.id)).eq('status', 'pending').maybeSingle());
  if (!inv || !inv.teams || inv.teams.leader_id !== req.user.id) throw new Error('INVITE_NOT_FOUND');
  await q(admin.from('team_invites').update({ status: 'cancelled', responded_at: new Date().toISOString() }).eq('id', inv.id));
  res.json({ ok: true });
}));
 
app.post('/api/teams/:id/leave', auth, h(async (req, res) => {
  await rpc('remove_member', { p_actor: req.user.id, p_team: uuid.parse(req.params.id), p_target: req.user.id });
  res.json({ ok: true });
}));
 
app.delete('/api/teams/:id/members/:uid', auth, h(async (req, res) => {
  await rpc('remove_member', { p_actor: req.user.id, p_team: uuid.parse(req.params.id), p_target: uuid.parse(req.params.uid) });
  res.json({ ok: true });
}));
 
app.delete('/api/teams/:id', auth, h(async (req, res) => {
  await rpc('disband_team', { p_leader: req.user.id, p_team: uuid.parse(req.params.id) });
  res.json({ ok: true });
}));
 
/* ---------------------------------------------------------------- payments */
app.post('/api/payments/order', auth, strict, h(async (req, res) => {
  if (registrationClosed()) throw new Error('REG_CLOSED');
  const { teamId } = z.object({ teamId: uuid }).parse(req.body);
 
  // 1) freeze roster (also checks leader + minimum size + not already paid)
  const members = await rpc('freeze_team', { p_leader: req.user.id, p_team: teamId, p_min: CFG.minTeam });
  const amount = members * CFG.feePaise;                         // server decides the amount, never the browser
  const reply = (orderId) => res.json({ orderId, amount, members, keyId: CFG.rzpKeyId });
 
  // 2) reuse an existing open order (page refresh / double click)
  const open = await q(admin.from('payments').select('*').eq('team_id', teamId).eq('status', 'created').maybeSingle());
  if (open && open.amount_paise === amount) return reply(open.razorpay_order_id);
  if (open) await q(admin.from('payments').update({ status: 'cancelled' }).eq('id', open.id));
 
  // 3) create the Razorpay order
  let order;
  try {
    order = await rzp.orders.create({
      amount, currency: 'INR',
      receipt: ('e6_' + teamId.slice(0, 8) + '_' + Date.now().toString(36)).slice(0, 40),
      notes: { team_id: teamId, members: String(members), event: 'engage6' },
    });
  } catch (e) { await rpc('cancel_payment', { p_team: teamId }); throw e; }
 
  // 4) remember it
  const { error } = await admin.from('payments').insert({
    team_id: teamId, created_by: req.user.id, razorpay_order_id: order.id, amount_paise: amount, members_count: members,
  });
  if (error) { await rpc('cancel_payment', { p_team: teamId }); throw error; }
  reply(order.id);
}));
 
const VerifySchema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(200),
});
app.post('/api/payments/verify', auth, strict, h(async (req, res) => {
  const b = VerifySchema.parse(req.body);
  const expected = crypto.createHmac('sha256', CFG.rzpSecret).update(b.razorpay_order_id + '|' + b.razorpay_payment_id).digest('hex');
  if (!safeEq(expected, b.razorpay_signature)) return res.status(400).json({ error: 'BAD_SIGNATURE', message: 'Payment could not be verified.' });
 
  // the order must be ours AND belong to the caller's team
  const pay = await q(admin.from('payments').select('team_id').eq('razorpay_order_id', b.razorpay_order_id).maybeSingle());
  const team = await loadTeam(req.user.id);
  if (!pay || !team || team.id !== pay.team_id) throw new Error('ORDER_NOT_FOUND');
 
  const result = await markPaid(b.razorpay_order_id, b.razorpay_payment_id);   // 'paid' | 'already' | 'review' | 'duplicate'
  res.json({ result });
}));
 
app.post('/api/payments/cancel', auth, h(async (req, res) => {
  const { teamId } = z.object({ teamId: uuid }).parse(req.body);
  const team = await loadTeam(req.user.id);
  if (!team || team.id !== teamId) throw new Error('TEAM_NOT_FOUND');
  if (team.leader_id !== req.user.id) throw new Error('NOT_LEADER');
  let result = await settleOpenPayment(teamId);                  // asks Razorpay first; may discover it was paid
  if (result === 'none') { await rpc('cancel_payment', { p_team: teamId }); result = 'cancelled'; }
  res.json({ result });
}));
 
/* ------------------------------------------------------------------- admin */
const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
app.get('/api/admin/export.csv', auth, h(async (req, res) => {
  if (!CFG.admins.has(req.user.email)) throw new Error('FORBIDDEN');
  const rows = await q(admin.from('team_members')
    .select('role, teams!inner(name, status, paid_at), profiles(full_name, email, roll_no, college, course, year_of_study, phone)')
    .eq('teams.status', 'paid'));
  const head = ['team', 'role', 'name', 'email', 'roll_no', 'college', 'course', 'year', 'phone', 'paid_at'];
  const lines = [head.join(',')].concat(rows.map((r) => [r.teams.name, r.role, r.profiles.full_name, r.profiles.email, r.profiles.roll_no,
    r.profiles.college, r.profiles.course, r.profiles.year_of_study, r.profiles.phone, r.teams.paid_at].map(csvCell).join(',')));
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="engage6-participants.csv"' });
  res.send(lines.join('\n'));
}));
 
/* ------------------------------------------------------------ static + 404 */
app.use('/api', (req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Not found.' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
app.use((err, req, res, next) => fail(res, err));   // eslint-disable-line no-unused-vars
 
if (require.main === module) {
  app.listen(CFG.port, () => console.log('Engage 6.0 running on http://localhost:' + CFG.port));
}
module.exports = { app, CFG };
