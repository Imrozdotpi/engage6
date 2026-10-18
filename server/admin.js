'use strict';
/* Admin API: email+password login (from Vercel env vars) + full management. Mounted from server.js */
const crypto = require('crypto');

module.exports = function mountAdmin({ app, admin, CFG, rateLimit }) {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const dig = (s) => crypto.createHash('sha256').update(String(s)).digest();
  const same = (a, b) => crypto.timingSafeEqual(dig(a), dig(b));
  const SECRET = process.env.ADMIN_SESSION_SECRET || dig('engage6-admin|' + CFG.serviceKey).toString('hex');
  const mac = (body) => crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const bad = (http, code, message) => Object.assign(new Error(message), { http, code });
  const q = async (p) => { const { data, error } = await p; if (error) throw error; return data; };
  const log = (who, what) => console.log('[ADMIN] ' + who + ' ' + what);
  const nowIso = () => new Date().toISOString();

  function accounts() {            // ADMIN1_EMAIL / ADMIN1_PASSWORD ... ADMIN10_*
    const out = [];
    for (let i = 1; i <= 10; i++) {
      const email = String(process.env['ADMIN' + i + '_EMAIL'] || '').trim().toLowerCase();
      const pass = String(process.env['ADMIN' + i + '_PASSWORD'] || '');
      if (email && pass) out.push({ email, pass });
    }
    return out;
  }
  function sign(p) { const body = Buffer.from(JSON.stringify(p)).toString('base64url'); return body + '.' + mac(body); }
  function verify(t) {
    const parts = String(t || '').split('.');
    if (parts.length !== 2 || !same(parts[1], mac(parts[0]))) return null;
    try {
      const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      return p && typeof p.e === 'string' && typeof p.x === 'number' && Date.now() < p.x ? p : null;
    } catch (e) { return null; }
  }
  const wrap = (fn) => (req, res) => Promise.resolve().then(() => fn(req, res)).catch((e) => {
    if (e && e.http) return res.status(e.http).json({ error: e.code || 'ERROR', message: e.message });
    console.error('admin error', e);
    if (e && e.code === '23503') return res.status(409).json({ error: 'HAS_RECORDS', message: 'Blocked by linked records: ' + (e.details || e.message) });
    return res.status(500).json({ error: 'SERVER', message: 'Server error: ' + String((e && (e.message || e.details)) || 'unknown') });
  });
  function auth(req, res, next) {
    const p = verify(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (!p || !accounts().some((a) => a.email === p.e)) return res.status(401).json({ error: 'ADMIN_AUTH', message: 'Admin session expired. Please sign in again.' });
    req.adminEmail = p.e; next();
  }
  const id = (v) => { if (!UUID.test(String(v || ''))) throw bad(400, 'BAD_ID', 'Invalid id.'); return String(v).toLowerCase(); };

  async function all(table, cols, order) {
    const out = [];
    for (let from = 0; from < 100000; from += 1000) {
      const rows = await q(admin.from(table).select(cols).order(order, { ascending: true }).range(from, from + 999));
      out.push(...rows);
      if (rows.length < 1000) break;
    }
    return out;
  }
  async function signups() {
    const out = [];
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const users = (data && data.users) || [];
      users.forEach((u) => out.push({ id: u.id, email: String(u.email || '').toLowerCase(), name: (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || '', created_at: u.created_at, last_sign_in_at: u.last_sign_in_at || null }));
      if (users.length < 1000) break;
    }
    return out;
  }
  async function getTeam(teamId) {
    const t = await q(admin.from('teams').select('id,name,leader_id,status').eq('id', teamId).maybeSingle());
    if (!t) throw bad(404, 'NOT_FOUND', 'Team not found (maybe already deleted).');
    return t;
  }
  async function deleteTeamFully(teamId) {
    await q(admin.from('payments').delete().eq('team_id', teamId));
    await q(admin.from('teams').delete().eq('id', teamId));
  }
  async function unfreeze(teamId) {
    await q(admin.from('payments').update({ status: 'cancelled' }).eq('team_id', teamId).eq('status', 'created'));
    await q(admin.from('teams').update({ status: 'forming' }).eq('id', teamId).eq('status', 'payment_pending'));
  }
  /* removes one member; promotes the next member if the leader leaves. Returns {last:true} if they are the only member. */
  async function removeFromTeam(teamId, uid) {
    const team = await getTeam(teamId);
    const members = await q(admin.from('team_members').select('user_id,role,joined_at').eq('team_id', teamId).order('joined_at', { ascending: true }));
    if (!members.some((m) => m.user_id === uid)) throw bad(404, 'NOT_MEMBER', 'That person is not in this team.');
    const others = members.filter((m) => m.user_id !== uid);
    if (!others.length) return { last: true };
    if (team.leader_id === uid) {
      const next = others[0].user_id;
      await q(admin.from('teams').update({ leader_id: next }).eq('id', teamId));
      await q(admin.from('team_members').update({ role: 'leader' }).eq('team_id', teamId).eq('user_id', next));
      await q(admin.from('payments').update({ created_by: next }).eq('team_id', teamId).eq('created_by', uid));
    }
    await q(admin.from('team_members').delete().eq('team_id', teamId).eq('user_id', uid));
    await q(admin.from('team_invites').update({ status: 'cancelled', responded_at: nowIso() }).eq('team_id', teamId).eq('invited_by', uid).eq('status', 'pending'));
    if (team.status === 'payment_pending') await unfreeze(teamId);
    return { last: false };
  }

  app.use('/api/admin', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  const limiter = rateLimit ? rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true,
    message: { error: 'TOO_MANY', message: 'Too many attempts. Try again in 15 minutes.' } }) : (req, res, next) => next();

  app.post('/api/admin/login', limiter, wrap(async (req, res) => {
    const list = accounts();
    if (!list.length) return res.status(503).json({ error: 'NOT_CONFIGURED', message: 'Admin login is not set up. Add ADMIN1_EMAIL and ADMIN1_PASSWORD in Vercel, then redeploy.' });
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const pass = String((req.body || {}).password || '');
    let ok = false;
    list.forEach((a) => { const e = same(a.email, email); const p = same(a.pass, pass); if (e && p) ok = true; });
    if (!ok) { await new Promise((r) => setTimeout(r, 600)); return res.status(401).json({ error: 'BAD_LOGIN', message: 'Wrong email or password.' }); }
    const exp = Date.now() + 8 * 3600 * 1000;
    log(email, 'logged in');
    res.json({ token: sign({ e: email, x: exp }), email, expiresAt: exp });
  }));

  app.get('/api/admin/data', auth, wrap(async (req, res) => {
    const [profiles, teams, members, invites, payments] = await Promise.all([
      all('profiles', 'id,email,full_name,roll_no,college,course,year_of_study,phone,github_url,linkedin_url,created_at', 'id'),
      all('teams', 'id,name,leader_id,status,created_at,paid_at', 'id'),
      all('team_members', 'team_id,user_id,role,joined_at', 'user_id'),
      all('team_invites', 'id,team_id,invitee_id,invited_by,status,created_at,responded_at', 'id'),
      all('payments', 'id,team_id,created_by,razorpay_order_id,razorpay_payment_id,amount_paise,members_count,status,created_at,paid_at', 'id'),
    ]);
    let users = []; let warning = '';
    try { users = await signups(); } catch (e) { warning = 'Could not load the sign-ups list: ' + String((e && e.message) || e); }
    payments.forEach((p) => { p.amount_rupees = p.amount_paise / 100; });
    const paidIds = new Set(teams.filter((t) => t.status === 'paid').map((t) => t.id));
    const stats = {
      signups: users.length, profiles: profiles.length, teams: teams.length,
      forming: teams.filter((t) => t.status === 'forming').length,
      pending: teams.filter((t) => t.status === 'payment_pending').length,
      paidTeams: paidIds.size, paidPeople: members.filter((m) => paidIds.has(m.team_id)).length,
      revenue: payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount_paise, 0) / 100,
      review: payments.filter((p) => p.status === 'review').length,
      pendingInvites: invites.filter((i) => i.status === 'pending').length,
    };
    res.json({ profiles, teams, members, invites, payments, users, stats, warning, limits: { fee: CFG.feePaise / 100, min: CFG.minTeam, max: CFG.maxTeam } });
  }));

  app.delete('/api/admin/teams/:id', auth, wrap(async (req, res) => {
    const t = await getTeam(id(req.params.id));
    await deleteTeamFully(t.id);
    log(req.adminEmail, 'deleted team ' + t.name);
    res.json({ ok: true });
  }));

  app.delete('/api/admin/teams/:id/members/:uid', auth, wrap(async (req, res) => {
    const r = await removeFromTeam(id(req.params.id), id(req.params.uid));
    if (r.last) throw bad(409, 'LAST_MEMBER', 'This is the only member. Use "Delete team" to remove the whole team.');
    log(req.adminEmail, 'removed member ' + req.params.uid + ' from team ' + req.params.id);
    res.json({ ok: true });
  }));

  app.delete('/api/admin/people/:id', auth, wrap(async (req, res) => {
    const uid = id(req.params.id);
    const m = await q(admin.from('team_members').select('team_id').eq('user_id', uid).maybeSingle());
    if (m) { const r = await removeFromTeam(m.team_id, uid); if (r.last) await deleteTeamFully(m.team_id); }
    const stray = await q(admin.from('payments').select('id,team_id').eq('created_by', uid));
    for (const p of stray) {
      const o = await q(admin.from('team_members').select('user_id').eq('team_id', p.team_id).neq('user_id', uid).limit(1));
      if (!o.length) throw bad(409, 'HAS_PAYMENTS', 'This person owns payment records of a team with no other members. Delete that team first.');
      await q(admin.from('payments').update({ created_by: o[0].user_id }).eq('id', p.id));
    }
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) await q(admin.from('profiles').delete().eq('id', uid));
    log(req.adminEmail, 'deleted person ' + uid);
    res.json({ ok: true });
  }));

  app.post('/api/admin/teams/:id/mark-paid', auth, wrap(async (req, res) => {
    const t = await getTeam(id(req.params.id));
    if (t.status === 'paid') throw bad(409, 'ALREADY_PAID', 'This team is already marked paid.');
    const mem = await q(admin.from('team_members').select('user_id').eq('team_id', t.id));
    if (!mem.length) throw bad(409, 'EMPTY', 'This team has no members.');
    const tag = 'manual_' + crypto.randomBytes(6).toString('hex');
    await q(admin.from('payments').update({ status: 'cancelled' }).eq('team_id', t.id).eq('status', 'created'));
    await q(admin.from('payments').insert({ team_id: t.id, created_by: t.leader_id, razorpay_order_id: tag, razorpay_payment_id: tag + '_pay',
      amount_paise: mem.length * CFG.feePaise, members_count: mem.length, status: 'paid', paid_at: nowIso() }));
    await q(admin.from('teams').update({ status: 'paid', paid_at: nowIso() }).eq('id', t.id));
    await q(admin.from('team_invites').update({ status: 'cancelled', responded_at: nowIso() }).eq('team_id', t.id).eq('status', 'pending'));
    log(req.adminEmail, 'marked team paid ' + t.name);
    res.json({ ok: true });
  }));

  app.post('/api/admin/teams/:id/reset', auth, wrap(async (req, res) => {
    const t = await getTeam(id(req.params.id));
    await q(admin.from('payments').update({ status: 'cancelled' }).eq('team_id', t.id).eq('status', 'created'));
    await q(admin.from('payments').update({ status: 'review' }).eq('team_id', t.id).eq('status', 'paid'));   // keep record, flag for refund check
    await q(admin.from('teams').update({ status: 'forming', paid_at: null }).eq('id', t.id));
    log(req.adminEmail, 'reset team ' + t.name);
    res.json({ ok: true });
  }));

  app.delete('/api/admin/invites/:id', auth, wrap(async (req, res) => {
    await q(admin.from('team_invites').delete().eq('id', id(req.params.id)));
    res.json({ ok: true });
  }));
};
