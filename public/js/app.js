(() => {
'use strict';
 
/* ---------------------------------------------------------------- utilities */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupee = (n) => '₹' + Number(n).toLocaleString('en-IN');
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const G = () => (typeof gsap !== 'undefined' && !reduced ? gsap : null);
 
const STEPS = ['profile', 'team', 'pay', 'done'];
const S = { sb: null, cfg: null, me: null, step: null, sig: '', lastTotal: 0, justPaid: false, busy: false, payError: '' };
 
/* ---------------------------------------------------------------------- api */
async function api(path, opts = {}) {
  const { data: { session } } = await S.sb.auth.getSession();
  if (!session) { location.replace('/'); throw new Error('AUTH'); }
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) { await S.sb.auth.signOut(); location.replace('/'); throw new Error('AUTH'); }
  if (!res.ok) { const e = new Error(j.message || 'Request failed'); e.code = j.error; e.field = j.field; throw e; }
  return j;
}
 
/* ---------------------------------------------------------------- feedback UI */
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'error' ? 'error' : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  const g = G();
  if (g) g.from(el, { y: 30, opacity: 0, duration: 0.5, ease: 'expo.out' });                       // A07
  setTimeout(() => {
    if (g) g.to(el, { y: 20, opacity: 0, duration: 0.3, onComplete: () => el.remove() }); else el.remove();
  }, type === 'error' ? 5500 : 3200);
}
function setLoading(btn, on) { if (!btn) return; btn.classList.toggle('is-loading', on); btn.disabled = on; }  // A06
function shake(el) { if (!el || reduced) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } // A05
function showFieldError(form, name, msg) {
  $$('label.f', form).forEach((l) => l.classList.remove('has-err'));
  $$('.err', form).forEach((e) => (e.textContent = ''));
  const input = form.elements[name];
  if (!input) { toast(msg, 'error'); return; }
  const wrap = input.closest('label.f');
  if (wrap) { wrap.classList.add('has-err'); $('.err', wrap).textContent = msg; shake(wrap); }
  input.focus();
}
 
/* ------------------------------------------------------------------- views */
function field(name, label, value, o = {}) {
  const attrs = [
    o.readonly ? 'readonly tabindex="-1"' : '', o.placeholder ? `placeholder="${esc(o.placeholder)}"` : '',
    o.inputmode ? `inputmode="${o.inputmode}"` : '', o.maxlength ? `maxlength="${o.maxlength}"` : '',
    o.autocomplete ? `autocomplete="${o.autocomplete}"` : 'autocomplete="off"', o.list ? `list="${o.list}"` : '',
    o.type ? `type="${o.type}"` : 'type="text"',
  ].join(' ');
  return `<label class="f ${o.span === 2 ? 'span2' : ''}"><span>${esc(label)}${o.optional ? ' (optional)' : ''}</span>
    <div class="ctl" ${o.readonly ? 'data-ro' : ''}>${o.prefix ? `<span class="pre">${o.prefix}</span>` : ''}
    <input name="${name}" value="${value}" ${attrs}></div><small class="err" role="alert"></small></label>`;
}
 
function profileView(me) {
  const p = me.profile || {}; const v = (k, d = '') => esc(p[k] != null ? p[k] : d);
  const yr = (n) => `<option value="${n}" ${Number(p.year_of_study) === n ? 'selected' : ''}>${n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th'} year</option>`;
  return `<div class="panel" data-anim="panel">
    <p class="eyebrow">[01] YOUR PROFILE</p>
    <h1 class="h1">Tell us who you <em>are</em>.</h1>
    <p class="lede">One-time setup. This goes on your hackathon pass and certificate, so spell it the way you want it printed.</p>
    <form data-form="profile" class="form grid2" novalidate>
      ${field('full_name', 'Full name', esc(p.full_name || me.user.name), { autocomplete: 'name', span: 2 })}
      ${field('email', 'Google email', esc(me.user.email), { readonly: true, span: 2 })}
      ${field('roll_no', 'Roll number', v('roll_no'), { placeholder: 'e.g. 24CSU000' })}
      ${field('phone', 'Mobile number', v('phone'), { inputmode: 'numeric', maxlength: 10, prefix: '+91', autocomplete: 'tel-national' })}
      ${field('college', 'College / University', v('college', 'The NorthCap University'), { list: 'colleges', span: 2 })}
      ${field('course', 'Course & branch', v('course'), { list: 'courses', placeholder: 'B.Tech CSE' })}
      <label class="f"><span>Year of study</span><div class="ctl"><select name="year_of_study"><option value="">Select</option>${[1, 2, 3, 4, 5].map(yr).join('')}</select></div><small class="err" role="alert"></small></label>
      ${field('github_url', 'GitHub link', v('github_url'), { optional: true, placeholder: 'https://github.com/you', type: 'url' })}
      ${field('linkedin_url', 'LinkedIn link', v('linkedin_url'), { optional: true, placeholder: 'https://linkedin.com/in/you', type: 'url' })}
      <div class="actions span2"><button class="btn btn--primary btn--lg" type="submit">${me.profile ? 'Save changes' : 'Save and continue'}</button>
      ${me.profile ? '<button class="btn" type="button" data-act="goto-team">Back to team</button>' : ''}</div>
    </form>
    <datalist id="colleges"><option value="The NorthCap University"><option value="Other"></datalist>
    <datalist id="courses"><option value="B.Tech CSE"><option value="B.Tech CSE (Cyber Security)"><option value="B.Tech CSE (AI & ML)"><option value="B.Tech ECE"><option value="BCA"><option value="MCA"><option value="M.Tech"></datalist>
  </div>`;
}
 
function memberRow(m, me, canRemove) {
  const p = m.profiles || {};
  const av = p.avatar_url ? `<img class="avatar" src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc(initials(p.full_name))}</span>`;
  return `<li class="member" data-uid="${m.user_id}">${av}
    <div class="member__main"><div class="member__name">${esc(p.full_name)}</div><div class="member__sub">${esc(p.roll_no)} · ${esc(p.college)}</div></div>
    <span class="tag">${m.role === 'leader' ? 'Leader' : 'Member'}</span>
    ${canRemove && m.role !== 'leader' ? `<button class="btn btn--sm btn--danger" data-act="remove" data-uid="${m.user_id}" type="button">Remove</button>` : ''}</li>`;
}
 
function noTeamView(me) {
  const inv = me.incomingInvites;
  return `<div class="panel" data-anim="panel">
    <p class="eyebrow">[02] YOUR TEAM</p>
    <h1 class="h1">Start a team, or <em>get picked</em>.</h1>
    <p class="lede">Teams need at least ${me.limits.minTeam} people (max ${me.limits.maxTeam}). Create one and invite friends who have already signed up here, or wait for a friend to invite you.</p>
    <div class="cols">
      <div class="card"><h2 class="h2">Create a team</h2>
        <form data-form="create-team" class="form" novalidate style="margin-top:16px">
          ${field('name', 'Team name', '', { placeholder: 'e.g. Null Pointers' })}
          <button class="btn btn--primary" type="submit">Create team &amp; be leader</button>
        </form></div>
      <div class="card"><h2 class="h2">Invites for you</h2>
        <div class="members" style="margin-top:16px">${inv.length ? inv.map((i) => `
          <div class="member" data-inv="${i.id}"><div class="member__main"><div class="member__name">${esc(i.teams && i.teams.name)}</div>
          <div class="member__sub">from ${esc(i.inviter && i.inviter.full_name)}</div></div>
          <button class="btn btn--sm btn--primary" data-act="accept" data-id="${i.id}" type="button">Join</button>
          <button class="btn btn--sm" data-act="decline" data-id="${i.id}" type="button">No</button></div>`).join('')
          : '<div class="empty">No invites yet. Tell your friend to invite <b>' + esc(me.user.email) + '</b></div>'}</div>
        <p style="margin-top:14px"><button class="link" data-act="copy-email" type="button">Copy my email</button> &middot; <button class="link" data-act="goto-profile" type="button">Edit profile</button></p>
      </div>
    </div>
  </div>`;
}
 
function teamView(me) {
  const t = me.team; const L = me.limits; const leader = t.myRole === 'leader';
  const n = me.members.length; const total = n * L.feeRupees; const ready = n >= L.minTeam;
  return `<div class="panel" data-anim="panel">
    <p class="eyebrow">[02] YOUR TEAM</p>
    <div class="actions" style="justify-content:space-between"><h1 class="h1">${esc(t.name)}</h1><span class="badge"><i></i>Forming</span></div>
    <div class="cols">
      <div class="card">
        <div class="meter-row mono"><span>${n} / ${L.maxTeam} members</span><span>min ${L.minTeam}</span></div>
        <div class="meter"><i data-meter="${Math.round((n / L.maxTeam) * 100)}"></i></div>
        <ul class="members" style="margin-top:18px">${me.members.map((m) => memberRow(m, me, leader)).join('')}
          ${me.sentInvites.map((i) => `<li class="member" data-inv="${i.id}"><span class="avatar">${esc(initials(i.invitee && i.invitee.full_name))}</span>
            <div class="member__main"><div class="member__name">${esc(i.invitee && i.invitee.full_name)}</div><div class="member__sub">${esc(i.invitee && i.invitee.email)}</div></div>
            <span class="tag tag--wait">Invited</span><button class="btn btn--sm" data-act="cancel-invite" data-id="${i.id}" type="button">Cancel</button></li>`).join('')}</ul>
        ${leader && n < L.maxTeam ? `
        <form data-form="invite" class="form" style="margin-top:18px" novalidate>
          <label class="f"><span>Invite a teammate by email</span><div class="invite-row"><div class="ctl"><input name="email" type="email" inputmode="email" autocomplete="off" placeholder="friend@gmail.com"></div>
          <button class="btn btn--primary" type="submit">Send invite</button></div><small class="err" role="alert"></small></label>
          <small class="mono" style="color:var(--mute)">They must sign in here with Google and finish their profile first.</small>
        </form>` : ''}
      </div>
      <div class="card" style="display:grid;gap:14px;align-content:start">
        <span class="mono" style="color:var(--mute)">Team fee</span>
        <div class="total" data-total="${total}">${rupee(total)}</div>
        <span class="mono" style="color:var(--mute)">${n} × ${rupee(L.feeRupees)} per head</span>
        ${leader ? `<button class="btn btn--primary btn--lg" data-act="pay" type="button" ${ready ? '' : 'disabled'}>${ready ? 'Pay ' + rupee(total) + ' &amp; lock team' : 'Add ' + (L.minTeam - n) + ' more to continue'}</button>
          <p class="note" style="display:${ready ? 'block' : 'none'}">Paying locks the roster. Nobody can join or leave after that.</p>`
        : '<p class="note">Only the team leader can pay. Once they pay, your team is locked in.</p>'}
        <p class="poll mono"><i></i>Live. Updates automatically.</p>
        <p>${leader ? '<button class="link" data-act="disband" type="button">Disband team</button>' : '<button class="link" data-act="leave" type="button">Leave team</button>'}</p>
      </div>
    </div>
  </div>`;
}
 
function payView(me) {
  const t = me.team; const leader = t.myRole === 'leader'; const L = me.limits; const n = me.members.length;
  const rows = me.members.map((m) => `<tr data-row><td>${esc(m.profiles && m.profiles.full_name)}</td><td>${rupee(L.feeRupees)}</td></tr>`).join('');
  return `<div class="panel" data-anim="panel">
    <p class="eyebrow">[03] PAYMENT</p>
    <div class="actions" style="justify-content:space-between"><h1 class="h1">Almost <em>there</em>.</h1><span class="badge pay"><i></i>Awaiting payment</span></div>
    <div class="card"><table class="table"><tbody>${rows}<tr class="sum"><td>Total for ${esc(t.name)}</td><td>${rupee(n * L.feeRupees)}</td></tr></tbody></table></div>
    ${S.payError ? `<p class="note">${esc(S.payError)}</p>` : ''}
    ${leader ? `<div class="actions"><button class="btn btn--primary btn--lg" data-act="resume-pay" type="button">Pay ${rupee(n * L.feeRupees)} securely</button>
      <button class="btn" data-act="back" type="button">Back to team</button></div>
      <p class="mono" style="color:var(--mute)">Powered by Razorpay. UPI, cards, netbanking. If money is deducted but this page does not update, do not pay again: it confirms automatically within a minute.</p>`
    : '<p class="note">Your leader is completing the payment. This page updates by itself.</p>'}
  </div>`;
}
 
function doneView(me) {
  const t = me.team; const pay = me.payment;
  return `<div class="panel" data-anim="panel" style="justify-items:start">
    <div class="stamp" id="stamp"><svg viewBox="0 0 64 64"><path id="check" d="M14 34 L27 47 L50 18"/></svg></div>
    <p class="eyebrow">[04] CONFIRMED</p>
    <h1 class="h1">You're <em>in</em>, ${esc(t.name)}.</h1>
    <p class="lede">Payment received. Your team is locked. Keep an eye on your email for the schedule, problem statements and venue details.</p>
    <div class="card" style="width:100%"><ul class="members">${me.members.map((m) => memberRow(m, me, false)).join('')}</ul>
      ${pay && pay.razorpay_payment_id ? `<p class="mono" style="color:var(--mute);margin-top:16px">Receipt: ${esc(pay.razorpay_payment_id)} · ${rupee(pay.amount_paise / 100)}</p>` : ''}</div>
    <div class="actions"><a class="btn btn--primary" href="/">Back to event page</a><button class="btn" data-act="goto-profile" type="button">Edit my profile</button></div>
  </div>`;
}
 
/* ------------------------------------------------------------ render + anim */
function stepOf(me) {
  if (!me.profile) return 'profile';
  if (me.profile && S.editProfile) return 'profile';
  if (!me.team) return 'team';
  if (me.team.status === 'paid') return 'done';
  if (me.team.status === 'payment_pending') return 'pay';
  return 'team';
}
 
function paintStepper(step) {
  const idx = STEPS.indexOf(step);
  $$('#stepper li').forEach((li, i) => { li.classList.toggle('is-done', i < idx || (step === 'done' && i === idx)); li.classList.toggle('is-active', i === idx && step !== 'done'); });
  const target = idx / (STEPS.length - 1);
  const g = G();
  if (g) g.to('#stepper', { '--p': target, duration: 0.9, ease: 'power3.out' }); else $('#stepper').style.setProperty('--p', target); // A02
}
 
function paintUser(me) {
  const chip = $('#userChip'); const u = me.user;
  chip.hidden = false;
  chip.innerHTML = (u.avatar ? `<img src="${esc(u.avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc(initials(u.name || u.email))}</span>`) + `<span>${esc(u.name || u.email)}</span>`;
  $('#feeNote').textContent = me.limits.feeRupees;
  if (me.isAdmin && !$('#exportBtn')) {                     // organisers only: download paid participants
    const b = document.createElement('button'); b.id = 'exportBtn'; b.type = 'button'; b.className = 'btn btn--ghost btn--sm'; b.textContent = 'Export CSV';
    b.addEventListener('click', exportCsv); $('.topbar__right').insertBefore(b, $('#signOut'));
  }
}
async function exportCsv() {
  const { data: { session } } = await S.sb.auth.getSession();
  const r = await fetch('/api/admin/export.csv', { headers: { Authorization: 'Bearer ' + session.access_token } });
  if (!r.ok) { toast('Export failed', 'error'); return; }
  const url = URL.createObjectURL(await r.blob()); const a = document.createElement('a');
  a.href = url; a.download = 'engage6-participants.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
 
function view(step, me) {
  if (step === 'profile') return profileView(me);
  if (step === 'pay') return payView(me);
  if (step === 'done') return doneView(me);
  return me.team ? teamView(me) : noTeamView(me);
}
 
function animateIn(step) {
  const g = G(); const stage = $('#stage');
  const total = $('[data-total]', stage);
  if (total) {
    const to = Number(total.dataset.total); const o = { v: S.lastTotal };
    if (g) g.to(o, { v: to, duration: 0.8, ease: 'power2.out', onUpdate: () => (total.textContent = rupee(Math.round(o.v))) }); // A10
    S.lastTotal = to;
  }
  const meter = $('[data-meter]', stage);
  if (meter) { if (g) g.to(meter, { width: meter.dataset.meter + '%', duration: 0.9, ease: 'expo.out' }); else meter.style.width = meter.dataset.meter + '%'; } // A11
  if (!g) { if (step === 'done') afterDone(); return; }
  g.from(stage.querySelectorAll('.panel > *'), { y: 24, opacity: 0, duration: 0.7, stagger: 0.06, ease: 'expo.out', clearProps: 'all' }); // A03
  g.from(stage.querySelectorAll('.member'), { x: -16, opacity: 0, duration: 0.5, stagger: 0.07, delay: 0.25, ease: 'power3.out', clearProps: 'all' }); // A08/A09
  if (step === 'pay') g.from(stage.querySelectorAll('[data-row]'), { opacity: 0, x: -12, stagger: 0.08, delay: 0.3, clearProps: 'all' });   // A16
  if (step === 'done') afterDone();
}
 
function afterDone() {
  const g = G(); const check = $('#check'); const stamp = $('#stamp');
  if (g && check && stamp) {                                                                                     // A12
    const len = check.getTotalLength(); g.set(check, { strokeDasharray: len, strokeDashoffset: len });
    g.timeline().from(stamp, { scale: 2.2, opacity: 0, rotate: -18, duration: 0.55, ease: 'power4.in' })
      .to(check, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, '-=0.05')
      .to(stamp, { scale: 1.06, yoyo: true, repeat: 1, duration: 0.12 });
  }
  if (S.justPaid) { S.justPaid = false; confetti(); }
}
 
function render(step, me) {
  const stage = $('#stage'); const g = G();
  const draw = () => { stage.innerHTML = view(step, me); paintStepper(step); paintUser(me); animateIn(step); S.step = step; };
  if (g && S.step && stage.firstElementChild) g.to(stage, { opacity: 0, y: -8, duration: 0.18, onComplete: () => { draw(); g.to(stage, { opacity: 1, y: 0, duration: 0.2, clearProps: 'all' }); } });
  else draw();
}
 
async function refresh(force = false) {
  const me = await api('/me');
  const step = stepOf(me);
  const sig = JSON.stringify([step, me.profile && me.profile.updated_at, me.team, me.members.map((m) => m.user_id), me.sentInvites.map((i) => i.id), me.incomingInvites.map((i) => i.id), S.payError]);
  S.me = me;
  if (!force && sig === S.sig) return;
  const a = document.activeElement;
  const typing = a && $('#stage').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName);
  if (!force && typing) return;                    // never wipe a form the user is typing in; next poll retries
  S.sig = sig; render(step, me);
}
 
/* --------------------------------------------------------------------- forms */
const FORM_RULES = {
  profile(d) {
    if (d.full_name.trim().length < 2) return ['full_name', 'Enter your full name'];
    if (d.roll_no.trim().length < 2) return ['roll_no', 'Enter your roll number'];
    if (!/^[6-9]\d{9}$/.test(d.phone.trim())) return ['phone', 'Enter a valid 10-digit mobile number'];
    if (d.college.trim().length < 2) return ['college', 'Enter your college / university'];
    if (d.course.trim().length < 2) return ['course', 'Enter your course and branch'];
    if (!d.year_of_study) return ['year_of_study', 'Choose your year'];
    for (const k of ['github_url', 'linkedin_url']) if (d[k] && !/^https?:\/\/\S+$/i.test(d[k].trim())) return [k, 'Enter a full link starting with https://'];
    return null;
  },
  'create-team'(d) { return /^[A-Za-z0-9][A-Za-z0-9 _.\-]{1,28}[A-Za-z0-9]$/.test(d.name.trim()) ? null : ['name', 'Team name: 3-30 letters, numbers, spaces, - _ .']; },
  invite(d) { return /^\S+@\S+\.\S+$/.test(d.email.trim()) ? null : ['email', 'Enter a valid email']; },
};
 
async function submitForm(form) {
  const kind = form.dataset.form; const btn = $('button[type=submit]', form);
  const d = Object.fromEntries(new FormData(form).entries());
  const bad = FORM_RULES[kind](d);
  if (bad) return showFieldError(form, bad[0], bad[1]);
  setLoading(btn, true);
  try {
    if (kind === 'profile') { await api('/profile', { method: 'PUT', body: d }); S.editProfile = false; toast('Profile saved'); }
    if (kind === 'create-team') { await api('/teams', { method: 'POST', body: { name: d.name.trim() } }); toast('Team created. Now invite your friends.'); }
    if (kind === 'invite') { await api('/teams/' + S.me.team.id + '/invites', { method: 'POST', body: { email: d.email.trim() } }); toast('Invite sent'); }
    await refresh(true);
  } catch (e) {
    if (e.message !== 'AUTH') { if (e.field) showFieldError(form, e.field, e.message); else showFieldError(form, kind === 'create-team' ? 'name' : kind === 'invite' ? 'email' : 'full_name', e.message); }
  } finally { setLoading(btn, false); }
}
 
/* ------------------------------------------------------------------- actions */
const ACTIONS = {
  async accept(btn) { await api('/invites/' + btn.dataset.id + '/accept', { method: 'POST' }); toast('You joined the team'); },
  async decline(btn) { await api('/invites/' + btn.dataset.id + '/decline', { method: 'POST' }); },
  async 'cancel-invite'(btn) { await api('/invites/' + btn.dataset.id, { method: 'DELETE' }); },
  async remove(btn) { if (!confirm('Remove this member from the team?')) return; await api('/teams/' + S.me.team.id + '/members/' + btn.dataset.uid, { method: 'DELETE' }); },
  async leave() { if (!confirm('Leave this team?')) return; await api('/teams/' + S.me.team.id + '/leave', { method: 'POST' }); toast('You left the team'); },
  async disband() { if (!confirm('Disband this team? Pending invites will be removed.')) return; await api('/teams/' + S.me.team.id, { method: 'DELETE' }); toast('Team disbanded'); },
  async pay(btn) { await startPayment(btn); return 'skip-refresh'; },
  async 'resume-pay'(btn) { await startPayment(btn); return 'skip-refresh'; },
  async back(btn) { const r = await api('/payments/cancel', { method: 'POST', body: { teamId: S.me.team.id } }); S.payError = ''; if (r.result === 'paid') toast('Your payment had already gone through.'); },
  async 'copy-email'() { try { await navigator.clipboard.writeText(S.me.user.email); toast('Email copied. Send it to your team leader.'); } catch (e) { toast(S.me.user.email); } return 'skip-refresh'; },
  async 'goto-profile'() { S.editProfile = true; },
  async 'goto-team'() { S.editProfile = false; },
};
 
/* ------------------------------------------------------------------- payment */
async function startPayment(btn) {
  setLoading(btn, true); S.payError = '';
  try {
    const o = await api('/payments/order', { method: 'POST', body: { teamId: S.me.team.id } });
    await refresh(true);                                  // team is now payment_pending -> pay screen
    openCheckout(o);
  } catch (e) { if (e.message !== 'AUTH') toast(e.message, 'error'); await refresh(true).catch(() => {}); }
  finally { setLoading(btn, false); }
}
 
function openCheckout(o) {
  const { profile, team } = S.me;
  if (typeof Razorpay === 'undefined') { toast('Payment window failed to load. Check your connection and retry.', 'error'); return; }
  const rz = new Razorpay({
    key: o.keyId, order_id: o.orderId, amount: o.amount, currency: 'INR',
    name: 'Engage 6.0', description: 'Team ' + team.name + ' (' + o.members + ' members)',
    prefill: { name: profile.full_name, email: profile.email, contact: '+91' + profile.phone },
    notes: { team: team.name }, theme: { color: '#C8FF2E' },
    modal: { confirm_close: true, ondismiss: () => toast('Payment window closed. You can pay again any time.') },
    handler: async (resp) => {
      const stage = $('#stage');
      stage.innerHTML = '<div class="panel"><p class="eyebrow">VERIFYING</p><h1 class="h1">Confirming your <em>payment</em>…</h1><div class="skeleton"><i></i></div></div>';
      try {
        await api('/payments/verify', { method: 'POST', body: { razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature } });
        S.justPaid = true; S.payError = '';
      } catch (e) {
        S.payError = 'We could not confirm the payment yet. If money was deducted, do NOT pay again. It will be confirmed automatically; refresh in a minute.';
      }
      await refresh(true);
    },
  });
  rz.on('payment.failed', (r) => toast((r.error && r.error.description) || 'Payment failed. Please try again.', 'error'));
  rz.open();
}
 
/* ------------------------------------------------------------------ confetti */
function confetti() {
  if (reduced) return;
  const c = $('#confetti'); const ctx = c.getContext('2d');
  c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio);
  const colors = ['#C8FF2E', '#F1EEE4', '#FF4D2E'];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.4, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4, s: Math.random() * 7 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * 3) | 0] }));
  let f = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach((p) => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (++f < 150) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}
 
/* ---------------------------------------------------------------------- boot */
function bind() {
  $('#stage').addEventListener('submit', (e) => { const f = e.target.closest('form[data-form]'); if (f) { e.preventDefault(); submitForm(f); } });
  $('#stage').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b || S.busy) return;
    const fn = ACTIONS[b.dataset.act]; if (!fn) return;
    S.busy = true; if (!b.classList.contains('link')) setLoading(b, true);
    try { const r = await fn(b); if (r !== 'skip-refresh') await refresh(true); }
    catch (err) { if (err.message !== 'AUTH') toast(err.message, 'error'); }
    finally { S.busy = false; setLoading(b, false); }
  });
  $('#signOut').addEventListener('click', async () => { await S.sb.auth.signOut(); location.replace('/'); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh().catch(() => {}); });
  setInterval(() => { if (!document.hidden && !S.busy) refresh().catch(() => {}); }, 8000);          // A14: live polling
}
 
(async function boot() {
  try {
    const s = await E6.ready; S.sb = s.sb; S.cfg = s.cfg;
    const qs = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
    if (qs.get('error_description')) toast(qs.get('error_description'), 'error');
    const { data: { session } } = await S.sb.auth.getSession();
    if (!session) { location.replace('/'); return; }
    history.replaceState({}, '', '/app.html');            // clean ?code= from the URL
    S.sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.replace('/'); });
    bind();
    await refresh(true);
  } catch (e) {
    if (e.message !== 'AUTH') $('#stage').innerHTML = '<div class="panel"><h1 class="h1">Something <em>broke</em>.</h1><p class="lede">' + esc(e.message) + '</p><button class="btn btn--primary" onclick="location.reload()">Reload</button></div>';
  }
})();
})();
