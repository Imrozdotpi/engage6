gsap.registerPlugin(ScrollTrigger, SplitText);

/* =====================================================================
   ENGAGE 6.0  /  main.js
   Config + ALL animation code. Every animation ID from the blueprint's
   catalogue (S01-S04, SC01-SC13, M01-M08, L01-L11) is tagged with a
   comment, so `grep -n "SC05" js/main.js` finds it.
   ===================================================================== */

/* ---------------------------------------------------------------------
   CONFIG: the ONLY place event details live. Replace the placeholders.
   draft:true shows a "Draft / placeholder data" tag on the page.
   --------------------------------------------------------------------- */
const CONFIG = {
  draft: false,                      // set to false when every value below is real (still open: registration open date, eligibility, refund policy, judging criteria, socials)
  eventName: 'Engage 6.0',
  tagline: 'Code with AI Hackathon',
  
startsAt: '2026-10-27T22:00:00+05:30', // REGISTRATION DEADLINE: 27 Oct 2026, 10:00 PM IST.

  dateLabel: '28 Oct 2026',         // event day (MOU), shown in the hero meta row
  city: 'Gurugram',
  venue: 'The NorthCap University, Gurugram',
  hours: 4,                          // build window: four hours, topic given on the spot
  feePerHead: 250,                   // Rs, per head. Must equal FEE_PER_HEAD_RUPEES in .env
  minTeam: 2,
  maxTeam: 4,
  finalists: 10,                     // top 10 projects present in the auditorium (MOU)
  prizePool: 155000,                 // Rs 15,000 cash + Rs 1,40,000 bootcamp value. Shown with an asterisk + footnote
  prizes: { first: 7500, second: 5000, third: 2500 },   // cash, per team
  perks: ['Internship interview for every member of the top 3 teams', '50% bootcamp voucher for every participant', 'Refreshments by InfraOne'],   // "Also winning" row. Only list what is true.
  organisedBy: '',                   // e.g. 'Organised by SOCER and student chapters'. Empty = hidden
  credit: 'Designed and built by Ajay Kumar | 24CSU353',
  socials: {                         // empty string = hidden
    website: '',                     // e.g. 'https://www.ncuindia.edu'
    instagram: '', linkedin: '', github: '', x: ''
  },
  timeline: [                        // `when` is shown on the page; `at` (ISO) lets the page pulse the next milestone
    { when: 'Until 27 Oct', at: null },                       // Registrations open (open date not confirmed)
    
{ when: '27 Oct, 10:00 PM IST', at: '2026-10-27T22:00:00+05:30' },

    { when: '28 Oct 2026', at: null },                        // Hackathon kickoff (start time to be confirmed)
    { when: 'Four hours', at: null },                         // Build window
    { when: '28 Oct 2026', at: null },                        // Top 10 present
    { when: '28 Oct 2026', at: null }                         // Results
  ],
};

(function () {
  'use strict';

  /* ---------- helpers (6.1) ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const mq = (q) => window.matchMedia(q).matches;
  const isDesktop = () => mq('(min-width: 900px)');
  const fine = () => mq('(hover:hover) and (pointer:fine)');
  const reduced = () => false;   // always play full animations, even if the OS says 'reduce motion'
  const fmt = (n) => Number(n).toLocaleString('en-IN');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const safe = (name, fn) => { try { return fn(); } catch (e) { console.error('[Engage] ' + name + ' failed:', e); } };

  try { history.scrollRestoration = 'manual'; } catch (e) { /* ignore */ }
  window.scrollTo(0, 0);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- shared UI bridge, used by auth.js ---------- */
  const ENGAGE = (window.ENGAGE = window.ENGAGE || {});

  /* =====================================================================
     SC01  Smooth scroll: Lenis driven by ONE gsap ticker
     ===================================================================== */
  let lenis;
  if (!reduced()) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);               // keep ScrollTrigger in sync
    gsap.ticker.add((t) => lenis.raf(t * 1000));            // ONE loop drives Lenis
    gsap.ticker.lagSmoothing(0);
  } else {
    lenis = {                                                // native-scroll shim for reduced motion
      on() {}, stop() {}, start() {}, get scroll() { return window.scrollY; }, get direction() { return 0; },
      scrollTo(t, o) {
        const el = typeof t === 'string' ? $(t) : t;
        const y = typeof t === 'number' ? t : el.getBoundingClientRect().top + window.scrollY + ((o && o.offset) || 0);
        window.scrollTo({ top: y, behavior: 'auto' });
      }
    };
  }

  function go(target) {                                     // anchor links use lenis.scrollTo
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (target === '#top') { lenis.scrollTo(0, { duration: 1.4 }); return; }
    const pt = parseFloat(getComputedStyle(el).paddingTop) || 0;
    lenis.scrollTo(el, { offset: pt < 60 ? -96 : 0, duration: 1.4 });
  }

  /* ---------- config -> DOM ---------- */
  function applyConfig() {
    const C = CONFIG;
    const map = {
      eventName: C.eventName, tagline: C.tagline, dateLabel: C.dateLabel, city: C.city, venue: C.venue,
      hours: String(C.hours), hoursLabel: C.hours + ' hours', hrsMeta: C.hours + ' HRS',
      fee: fmt(C.feePerHead), minTeam: String(C.minTeam), maxTeam: String(C.maxTeam),
      teamRange: C.minTeam + ' to ' + C.maxTeam, teamRangeMeta: C.minTeam + '-' + C.maxTeam,
      cashTotal: fmt(C.prizes.first + C.prizes.second + C.prizes.third), prize1: fmt(C.prizes.first), prize2: fmt(C.prizes.second), prize3: fmt(C.prizes.third),
      credit: C.credit
    };
    $$('[data-cfg]').forEach((el) => { const k = el.dataset.cfg; if (k in map) el.textContent = map[k]; });
    $$('[data-count-key]').forEach((el) => { const v = C[el.dataset.countKey]; el.dataset.count = v; el.textContent = fmt(v); });
    $$('[data-tl]').forEach((el) => { const t = C.timeline[+el.dataset.tl]; if (t) el.textContent = t.when; });

    const fb = $('#feebox');                                // fee example: 2 members = Rs 500, 3 = Rs 750 ...
    if (fb) {
      let html = '';
      for (let n = C.minTeam; n <= C.maxTeam; n++) html += (n === C.minTeam ? '<b>' + n + ' members</b>' : '<b>' + n + '</b>') + ' = Rs ' + fmt(n * C.feePerHead) + ' ';
      fb.innerHTML = html.trim();
    }
    const pk = $('#perks');
    if (pk) pk.hidden = !C.perks.length, pk.innerHTML = '<b>Also winning:</b> ' + C.perks.map((p) => '<span>' + p + '</span>').join('');
    const ob = $('#organisedBy');
    if (ob && C.organisedBy) { ob.textContent = C.organisedBy; ob.hidden = false; }

    const ICON = {
      website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
      instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><path d="M17.5 6.5h.01"/>',
      linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
      github: '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
      x: '<path d="M4 4l16 16M20 4L4 20"/>'
    };
    const soc = $('#social');
    if (soc) {
      soc.innerHTML = Object.keys(C.socials).filter((k) => C.socials[k]).map((k) =>
        '<a href="' + C.socials[k] + '" target="_blank" rel="noopener" aria-label="' + k + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg></a>').join('');
      if (!soc.children.length) soc.parentElement.hidden = true;
    }
    const dt = $('.draft-tag');
    if (dt) dt.hidden = !C.draft;
    document.body.classList.toggle('is-draft', !!C.draft);
  }

  /* ---------- CTA states (blueprint 8.1) ---------- */
  const CTA = {
    out:     { long: 'Claim your team slot',   short: 'Register',        sticky: 'Register - Rs {fee}/head' },
    profile: { long: 'Finish your profile',    short: 'Finish profile',  sticky: 'Finish your profile' },
    team:    { long: 'Create or join a team',  short: 'Join a team',     sticky: 'Create or join a team' },
    pay:     { long: 'Pay Rs {total}',         short: 'Pay Rs {total}',  sticky: 'Pay Rs {total}' },
    paid:    { long: 'You are in. View team',  short: 'My team',         sticky: 'You are in. View team' }
  };
  ENGAGE.state = 'out';
  ENGAGE.members = CONFIG.minTeam;
  ENGAGE.setCta = function (state, opts) {
    if (!CTA[state]) return;
    ENGAGE.state = state;
    if (opts && opts.members) ENGAGE.members = opts.members;
    const total = fmt(CONFIG.feePerHead * ENGAGE.members);
    $$('[data-cta]').forEach((a) => {
      const size = a.dataset.ctaSize || 'long';
      const label = $('[data-cta-label]', a);
      if (!label) return;
      label.textContent = CTA[state][size].replace('{fee}', fmt(CONFIG.feePerHead)).replace('{total}', total);
      a.dataset.state = state;
    });
  };
  let toastTimer;
  ENGAGE.toast = function (msg) {
    const t = $('.toast'); if (!t) return;
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-on'), 4200);
  };
  function initCtas() {
    ENGAGE.setCta('out');
    if (!window.E6) $$('[data-cta]').forEach((a) => a.addEventListener('click', (e) => {   // with the backend (auth.js -> E6) landing-auth.js owns the click
      e.preventDefault();
      go('#how');                                            // static preview, no backend: show how to register
    }));
    $$('[data-scroll]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = a.getAttribute('data-scroll') || a.getAttribute('href');
      if (menuOpen) { closeMenu(); lenis.start(); setTimeout(() => go(t), 450); } else go(t);   // Lenis must be running to scroll
    }));
  }

  /* =====================================================================
     S01  Preloader counter + curtain (failsafe at 4s)   then   S02/S03 hero entrance
     ===================================================================== */
  let heroSplit = null, heroPlayed = false;

  function runPreloader(built) {
    const pre = $('.preloader');
    if (!pre || reduced()) { if (pre) pre.remove(); built.then(heroIn); return; }
    const num = $('.preloader__num', pre), msg = $('.preloader__msg', pre);
    const state = { v: 0 };
    lenis.stop();
    const done = () => {
      if (pre.dataset.done) return;
      pre.dataset.done = '1';
      pre.remove();
      lenis.start();
      ScrollTrigger.refresh();
    };
    setTimeout(done, 4000);                                  // failsafe
    const tl = gsap.timeline({ onComplete: done });
    tl.to(state, {                                           // S01 counter 0 -> 100
      v: 100, duration: 1.6, ease: 'power2.inOut',
      onUpdate: () => {
        num.textContent = String(Math.round(state.v)).padStart(3, '0');
        msg.textContent = state.v < 35 ? 'loading fonts' : state.v < 80 ? 'warming up models' : 'ready';
      }
    })
    .add(() => {
      tl.pause();
      Promise.race([built, wait(1200)]).then(() => { heroIn(); tl.resume(); });
    })
    .to(pre, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, '+=0.1');   // S01 curtain lifts
  }

  function heroIn() {
    if (heroPlayed) return;
    heroPlayed = true;
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.nav', { y: -100, opacity: 0, duration: 0.8, ease: 'power3.out' }, 0)                         // S03 nav slide-down
      .from('.hero__meta > *', { y: 16, opacity: 0, stagger: 0.06, duration: 0.7 }, 0.1)
      .from('.hero__eyebrow', { y: 14, opacity: 0, duration: 0.7 }, 0.1);
    if (heroSplit) tl.from(heroSplit.chars, { yPercent: 110, stagger: 0.035, duration: 1.1 }, 0.15);       // S02 hero char reveal
    tl.from('.hero__sub, .hero__info, .hero .countdown', { y: 24, opacity: 0, stagger: 0.12, duration: 0.9 }, 0.7)
      .from('.hero .btn, .hero .fee', { scale: 0.8, opacity: 0, stagger: 0.1, duration: 0.7, ease: 'back.out(1.7)' }, 1.0)
      .from('.hero .chip, .hero .badge', { scale: 0, opacity: 0, stagger: 0.08, duration: 0.9, ease: 'elastic.out(1,.6)' }, 1.1)
      .fromTo('.l2__txt .serif', { filter: 'drop-shadow(0 0 0 rgba(200,255,46,0))' },                       // one-time acid flash on AI
        { filter: 'drop-shadow(0 0 22px rgba(200,255,46,.95))', duration: 0.45, yoyo: true, repeat: 1, ease: 'power2.inOut',
          onComplete() { gsap.set('.l2__txt .serif', { clearProps: 'filter' }); } }, 1.1);
  }

  /* =====================================================================
     L06  Countdown with digit flip
     ===================================================================== */
  function initCountdown() {
    let target = Date.parse(CONFIG.startsAt);
    if (!Number.isFinite(target)) {
      target = Date.now() + (14 * 24 + 6) * 36e5;            // demo: counts to 14 days from now
      console.info('[Engage] CONFIG.startsAt is not set. The countdown is running in demo mode.');
    }
    const last = {};
    function set(k, val) {
      const v = String(val).padStart(2, '0');
      if (last[k] === v) return;
      const first = last[k] === undefined;
      last[k] = v;
      $$('[data-cd="' + k + '"]').forEach((el) => {
        const cur = el.lastElementChild;
        if (first || reduced()) { cur.textContent = v; return; }
        const next = document.createElement('span');
        next.textContent = v;
        el.append(next);
        gsap.to(cur, { yPercent: -100, duration: 0.35, ease: 'power3.out' });                              // old out
        gsap.fromTo(next, { yPercent: 100 }, { yPercent: 0, duration: 0.35, ease: 'power3.out', onComplete: () => cur.remove() }); // new in
      });
    }
    function tick() {
      const diff = Math.max(0, target - Date.now());
      if (diff === 0) $$('[data-cd-label]').forEach((l) => (l.textContent = 'Registration closed'));
      set('d', Math.floor(diff / 864e5)); set('h', Math.floor(diff % 864e5 / 36e5));
      set('m', Math.floor(diff % 36e5 / 6e4)); set('s', Math.floor(diff % 6e4 / 1e3));
    }
    tick(); setInterval(tick, 1000);
  }

  /* =====================================================================
     L04 typewriter + L05 caret (CSS)
     ===================================================================== */
  function initTyper() {
    const el = $('.typer');
    if (!el || reduced()) return;
    const words = ['Build with AI.', 'Four hours. Ship it.', 'Team up. Break things.', 'Demo. Win.'];
    let wi = 0, ci = el.textContent.length, del = true;      // starts by erasing the static sentence
    (function tick() {
      const w = words[wi];
      el.textContent = w.slice(0, ci);
      if (!del && ci === w.length) { del = true; return setTimeout(tick, 1400); }
      if (del && ci === 0) { del = false; wi = (wi + 1) % words.length; }
      ci += del ? -1 : 1;
      setTimeout(tick, del ? 28 : 55);
    })();
  }

  /* =====================================================================
     M05 hero canvas mesh (reacts to cursor, pauses off-screen)  +  L09 blobs
     ===================================================================== */
  function initCanvas() {
    const c = $('#bg'); if (!c) return;
    const ctx = c.getContext('2d');
    let w, h, dpr, pts = [], mouse = { x: -999, y: -999 }, running = true, raf = 0;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(110, Math.max(35, (w * h) / 16000)));   // fewer on phones
      pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3 }));
      if (reduced()) draw();
    }
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 150); });
    const host = c.closest('.hero') || c.parentElement;
    host.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    host.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });
    new IntersectionObserver(([e]) => { running = e.isIntersecting; if (running && !raf && !reduced()) raf = requestAnimationFrame(loop); }).observe(c);   // pauses off-screen
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 120 && d > 0.01) { p.x += (dx / d) * 1.6; p.y += (dy / d) * 1.6; }   // M05 repel
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.fillStyle = 'rgba(200,255,46,.6)'; ctx.fillRect(p.x, p.y, 2, 2);
      }
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 130) {
          ctx.strokeStyle = 'rgba(241,238,228,' + (0.12 * (1 - d / 130)) + ')';
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
        }
      }
    }
    function loop() { raf = 0; if (!running) return; draw(); raf = requestAnimationFrame(loop); }
    size();
    if (!reduced()) raf = requestAnimationFrame(loop);
  }

  /* =====================================================================
     M01 cursor, M02 magnetic, M03 tilt + spotlight, M04 button fill origin  (pointer devices only)
     ===================================================================== */
  function initPointer() {
    $$('.btn').forEach((b) => {                              // M04 fill wipe grows from the pointer's entry point
      const set = (e) => { const r = b.getBoundingClientRect(); b.style.setProperty('--bx', (e.clientX - r.left) + 'px'); b.style.setProperty('--by', (e.clientY - r.top) + 'px'); };
      b.addEventListener('pointerenter', set); b.addEventListener('pointerleave', set);
    });
    if (!(fine() && !reduced())) return;
    document.documentElement.classList.add('has-cursor');
    const cur = $('.cursor');
    gsap.set(cur, { opacity: 0 });                                               // stays hidden until the first pointer move
    window.addEventListener('pointermove', () => gsap.to(cur, { opacity: 1, duration: 0.3, overwrite: 'auto' }), { once: true });
    const cx = gsap.quickTo(cur, 'x', { duration: 0.15, ease: 'power3' });      // M01
    const cy = gsap.quickTo(cur, 'y', { duration: 0.15, ease: 'power3' });
    window.addEventListener('pointermove', (e) => { cx(e.clientX); cy(e.clientY); });
    $$('a,button,[data-cursor]').forEach((el) => {
      el.addEventListener('pointerenter', () => cur.classList.add('is-big'));
      el.addEventListener('pointerleave', () => cur.classList.remove('is-big'));
    });
    $$('[data-magnetic]').forEach((el) => {                                      // M02
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1,.4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1,.4)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.35);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
    $$('[data-tilt]').forEach((el) => {                                          // M03
      gsap.set(el, { transformPerspective: 800 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.4 });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.4 });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 10); rx((0.5 - py) * 10);
        el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%');
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  /* =====================================================================
     M06 FAQ accordion (one open at a time)
     ===================================================================== */
  function initFaq() {
    const items = $$('.faq-item');
    items.forEach((item) => {
      const btn = $('button', item), body = $('.faq-body', item);
      gsap.set(body, { height: 0, autoAlpha: 0 });
      btn.addEventListener('click', () => {
        const open = item.classList.contains('is-open');
        items.forEach((o) => {
          if (o === item || !o.classList.contains('is-open')) return;
          o.classList.remove('is-open'); $('button', o).setAttribute('aria-expanded', 'false');
          gsap.to($('.faq-body', o), { height: 0, autoAlpha: 0, duration: reduced() ? 0 : 0.5, ease: 'power3.inOut' });
        });
        if (open) {
          item.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false');
          gsap.to(body, { height: 0, autoAlpha: 0, duration: reduced() ? 0 : 0.5, ease: 'power3.inOut', onComplete: () => ScrollTrigger.refresh() });
        } else {
          item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true');
          gsap.to(body, { height: 'auto', autoAlpha: 1, duration: reduced() ? 0 : 0.6, ease: 'power3.out', onComplete: () => ScrollTrigger.refresh() });
        }
      });
    });
  }

  /* =====================================================================
     M07 mobile menu overlay (circle expand + masked link stagger)
     ===================================================================== */
  let menuOpen = false;
  const burger = $('.nav__burger'), menu = $('#menu');
  function openMenu() {
    if (menuOpen || !menu) return;
    menuOpen = true;
    burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu'); menu.setAttribute('aria-hidden', 'false');
    lenis.stop();
    const r = burger.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 20;
    gsap.killTweensOf([menu, '.menu__link span', '.menu__foot']);
    gsap.set(menu, { visibility: 'visible' });
    gsap.fromTo(menu, { clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' }, { clipPath: 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)', duration: reduced() ? 0 : 0.9, ease: 'expo.inOut' });
    gsap.fromTo('.menu__link span', { yPercent: 110 }, { yPercent: 0, stagger: 0.07, duration: reduced() ? 0 : 0.9, ease: 'expo.out', delay: reduced() ? 0 : 0.3 });
    gsap.fromTo('.menu__foot', { opacity: 0 }, { opacity: 1, duration: 0.6, delay: reduced() ? 0 : 0.7 });
    gsap.to('.nav', { yPercent: 0, duration: 0.2, overwrite: 'auto' });
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu'); menu.setAttribute('aria-hidden', 'true');
    const r = burger.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 20;
    gsap.killTweensOf(menu);
    gsap.fromTo(menu, { clipPath: 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)' }, {
      clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)', duration: reduced() ? 0 : 0.7, ease: 'expo.inOut',
      onComplete: () => { gsap.set(menu, { visibility: 'hidden' }); lenis.start(); }
    });
  }
  function initMenu() {
    if (!burger || !menu) return;
    burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { closeMenu(); burger.focus(); } });
    window.addEventListener('resize', () => { if (menuOpen && isDesktop()) { closeMenu(); } });
  }

  /* =====================================================================
     SC13 nav hide/show + SC12 marquee velocity skew (Lenis velocity) + active link
     ===================================================================== */
  function initScrollChrome() {
    const nav = $('.nav');
    let hidden = false;
    const skewTo = reduced() ? null : gsap.quickTo('.marquee', 'skewX', { duration: 0.4, ease: 'power3' });
    lenis.on('scroll', ({ velocity, direction }) => {
      if (skewTo) skewTo(gsap.utils.clamp(-8, 8, velocity * -0.6));                                        // SC12
      if (reduced() || menuOpen) return;
      const shouldHide = direction === 1 && lenis.scroll > 200;                                             // SC13
      if (shouldHide !== hidden) { hidden = shouldHide; gsap.to(nav, { yPercent: hidden ? -130 : 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' }); }
    });
    nav.addEventListener('focusin', () => { if (hidden) { hidden = false; gsap.to(nav, { yPercent: 0, duration: 0.3, overwrite: 'auto' }); } });

    const ids = ['about', 'format', 'timeline', 'prizes', 'faq'];
    const links = $$('.nav__links .link');
    let ticking = false;
    function mark() {
      ticking = false;
      const mid = innerHeight * 0.5;
      let active = null;
      ids.forEach((id) => { const s = document.getElementById(id); if (!s) return; const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) active = id; });
      links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + active));
    }
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
    ScrollTrigger.addEventListener('refresh', mark);
    mark();
  }

  /* =====================================================================
     L02 floating chips, L10 scroll cue, L09 blobs, tracks index drift
     ===================================================================== */
  function initLoops() {
    if (reduced()) return;
    gsap.utils.toArray('.chip').forEach((el) =>                                                           // L02
      gsap.to(el, { y: gsap.utils.random(-14, 14), rotate: gsap.utils.random(-4, 4), duration: gsap.utils.random(3, 5), repeat: -1, yoyo: true, ease: 'sine.inOut' }));
    gsap.to('.scroll-cue', { y: 10, repeat: -1, yoyo: true, duration: 0.9, ease: 'power1.inOut' });        // L10
    gsap.utils.toArray('.blob').forEach((b) =>                                                            // L09
      gsap.to(b, { x: gsap.utils.random(-80, 80), y: gsap.utils.random(-60, 60), duration: gsap.utils.random(12, 20), repeat: -1, yoyo: true, ease: 'sine.inOut' }));
    gsap.utils.toArray('.tcard__idx').forEach((el, i) =>                                                  // L02 variant: index numbers drift 6px, out of phase
      gsap.to(el, { y: i % 2 ? -6 : 6, duration: 2.6 + i * 0.35, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
  }

  /* =====================================================================
     L01 marquee: top up the duplicated groups so they always overfill the band
     ===================================================================== */
  function buildMarquee() {
    const m = $('.marquee'); if (!m) return;
    const need = Math.max(window.innerWidth, window.screen.width || 0) * 1.2;
    $$('.marquee__group', m).forEach((g) => {
      const items = $$('.marquee__item', g);
      let guard = 0;
      while (g.scrollWidth < need && guard++ < 8) items.forEach((it) => { const c = it.cloneNode(true); c.setAttribute('aria-hidden', 'true'); g.append(c); });
    });
  }

  /* =====================================================================
     L11 live registration count (Supabase via auth.js, demo value otherwise)
     ===================================================================== */
  function initLive() {
    /* The number itself is driven by landing-auth.js (GET /api/stats). Hidden until the backend answers: no fake counts. */
    const el = $('#teams-live'); if (!el) return;
    const lc = el.closest('.live-count'); if (!lc) return;
    lc.hidden = true;
    if (window.E6) E6.ready.then(() => fetch('/api/stats')).then((r) => { if (r && r.ok) lc.hidden = false; }).catch(() => {});
  }

  /* =====================================================================
     Step 2 illustration: looping typed form fields
     ===================================================================== */
  function initFormTyping() {
    const fields = $$('.ff [data-type]');
    if (!fields.length) return;
    if (reduced()) { fields.forEach((f) => (f.textContent = f.dataset.type)); return; }
    let alive = false, run = 0;
    const caret = document.createElement('i'); caret.className = 'caret'; caret.textContent = '|';
    async function play(id) {
      while (alive && id === run) {
        fields.forEach((f) => { f.textContent = ''; f.classList.remove('is-typing'); });
        for (const f of fields) {
          if (!alive || id !== run) return;
          f.classList.add('is-typing'); f.append(caret);
          const txt = f.dataset.type;
          for (let i = 1; i <= txt.length; i++) { if (!alive || id !== run) return; f.textContent = txt.slice(0, i); f.append(caret); await wait(55); }
          f.classList.remove('is-typing'); caret.remove(); await wait(260);
        }
        await wait(2200);
      }
    }
    new IntersectionObserver(([e]) => { alive = e.isIntersecting; if (alive) play(++run); else run++; }, { threshold: 0.4 }).observe($('.step[data-step="2"] .ill'));
  }

  /* Final headline: fit "READY TO ENGAGE?" edge to edge on one line (>=1100px), wrap on smaller screens */
  function fitFinal() {
    const h = $('.final__h'); if (!h) return;
    if (window.innerWidth < 1100) { h.style.fontSize = ''; return; }
    const wrap = h.closest('.wrap'), cs = getComputedStyle(wrap);
    const avail = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const prevLS = h.style.getPropertyValue('--ls'), prevFS = h.style.fontSize;
    h.style.fontSize = '100px'; h.style.setProperty('--ls', '-.05em');         // measure at the END state of SC11
    const w = h.offsetWidth;
    if (prevLS) h.style.setProperty('--ls', prevLS); else h.style.removeProperty('--ls');
    h.style.fontSize = (w ? Math.min(220, (100 * avail) / w * 0.995) : parseFloat(prevFS) || 144) + 'px';
  }

  /* =====================================================================
     Hero split (S02 setup) + all scroll-driven animation (SC02-SC11) inside gsap.matchMedia
     ===================================================================== */
  function buildAll() {
    safe('fitFinal', fitFinal);
    let frt; window.addEventListener('resize', () => { clearTimeout(frt); frt = setTimeout(() => { fitFinal(); ScrollTrigger.refresh(); }, 200); });
    safe('hero split', () => {
      if (reduced()) return;
      heroSplit = SplitText.create('[data-hero] .line', { type: 'chars', mask: 'chars', maskClass: 'ch-mask', charsClass: 'ch' });   // S02 (played in heroIn)
    });

    const mm = gsap.matchMedia();
    mm.add({
      desktop: '(min-width: 900px)',
      motion: 'all',
      reduce: 'not all'
    }, (ctx) => {
      const { desktop, motion, reduce } = ctx.conditions;
      const splits = [];
      const wipe = (el) => {                                                                              // SC08
        if (!motion) return;
        const side = el.dataset.wipe;
        const from = side === 'left' ? 'inset(0 0 0 100%)' : side === 'right' ? 'inset(0 100% 0 0)' : 'inset(0 0 100% 0)';
        gsap.fromTo(el, { clipPath: from }, { clipPath: 'inset(0 0 0% 0)', duration: 1.2, ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 80%' }, onComplete: () => gsap.set(el, { clearProps: 'clipPath' }) });
      };
      const rise = (g) => {                                                                               // SC10
        if (!motion) return;
        gsap.from($$('[data-anim="rise"]', g), { y: 80, opacity: 0, rotate: 3, stagger: 0.1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: g, start: 'top 85%' } });
      };

      /* --- SC02 scroll progress --- */
      safe('SC02', () => gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } }));

      /* --- hero: headline scrub-away + SC07 parallax layers --- */
      safe('hero scrub', () => {
        if (!motion) return;
        gsap.to('.hero__title', { scale: 0.9, opacity: 0.12, yPercent: -8, transformOrigin: '0 100%', ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
        $$('[data-speed]').forEach((el) => {                                                              // SC07
          const sp = parseFloat(el.dataset.speed) || 0.5;
          gsap.to(el, { yPercent: -15 * sp, ease: 'none',
            scrollTrigger: { trigger: el.closest('section') || el.parentElement, start: el.dataset.speedStart || 'top bottom', end: 'bottom top', scrub: true } });
        });
      });

      /* --- SC03 manifesto word-by-word light-up --- */
      safe('SC03', () => {
        const txt = $('.manifesto__text'); if (!txt) return;
        if (!motion) return;
        const s = SplitText.create(txt, { type: 'words', wordsClass: 'w' }); splits.push(s);
        txt.classList.add('is-split');
        gsap.fromTo(s.words, { opacity: 0.15 }, { opacity: 1, ease: 'none', stagger: 0.05,
          scrollTrigger: { trigger: '.manifesto', start: 'top 75%', end: 'bottom 55%', scrub: true } });
      });

      /* --- SC04 stat counters + SC10 tile rise --- */
      safe('SC04', () => {
        $$('[data-count]').forEach((el) => {
          const end = +el.dataset.count;
          if (!motion) { el.textContent = fmt(end); return; }
          const o = { v: 0 };
          el.textContent = '0';
          gsap.to(o, { v: end, duration: 2, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            onUpdate: () => (el.textContent = fmt(Math.round(o.v))) });
        });
        rise($('.bento'));
      });

      /* --- SC08 headline wipes + SC10 / SC05 tracks --- */
      safe('tracks', () => {
        wipe($('.tracks__head .h2'));
        const track = $('.tracks__track');
        if (!desktop || !motion) { rise(track); return; }                                                 // mobile: stacked, rise reveal
        rise(track);                                                                                      // created BEFORE the pin so it is measured pre-pin
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const pin = gsap.to(track, { x: () => -dist(), ease: 'none',                                      // SC05 pinned horizontal travel
          scrollTrigger: { trigger: '.tracks', pin: true, scrub: 1, anticipatePin: 1, start: 'top top', end: () => '+=' + dist(), invalidateOnRefresh: true } });
        gsap.to('.tracks__bar', { scaleX: 1, ease: 'none',
          scrollTrigger: { trigger: '.tracks', start: 'top top', end: () => '+=' + dist(), scrub: true, invalidateOnRefresh: true } });
        return pin;
      });

      /* --- SC06 timeline draw + node pop --- */
      safe('SC06', () => {
        wipe($('.timeline .h2'));
        const tl = $('#tl'), path = $('.tl-path'), items = $$('.tl-item');
        const pops = items.map((it, i) => {
          const node = $('.tl-node', it), body = $('.tl-body', it);
          const dir = desktop ? (i % 2 === 0 ? -1 : 1) : 1;
          if (!motion) return null;
          gsap.set(body, { opacity: 0, x: 40 * dir });
          return gsap.timeline({ paused: true })
            .fromTo($('i', node), { scale: 0.6 }, { scale: 1, duration: 0.6, ease: 'back.out(2)' }, 0)
            .to(body, { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' }, 0.05);
        });
        let ys = [], H = 0, y0 = 0, len = 0, last = -1;
        const now = Date.now();
        const nextIdx = CONFIG.timeline.findIndex((t) => t.at && Date.parse(t.at) > now);
        const upcoming = nextIdx >= 0 ? nextIdx : (CONFIG.timeline.some((t) => t.at) ? -1 : 0);
        items.forEach((it, i) => it.classList.toggle('is-next', i === upcoming));
        function layout() {
          H = tl.offsetHeight;
          const tr = tl.getBoundingClientRect().top;
          ys = items.map((it) => { const r = $('.tl-node', it).getBoundingClientRect(); return r.top - tr + r.height / 2; });
          y0 = ys[0]; len = ys[ys.length - 1] - y0;
          path.setAttribute('d', 'M1 ' + y0 + ' V' + ys[ys.length - 1]);
          tl.style.setProperty('--tl-top', y0 + 'px');
          tl.style.setProperty('--tl-bottom', (H - ys[ys.length - 1]) + 'px');
          gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
          last = -1;
          if (!motion) { gsap.set(path, { strokeDashoffset: 0 }); items.forEach((it) => it.classList.add('is-reached')); }
        }
        layout();
        if (!motion) return;
        ScrollTrigger.create({
          trigger: tl, start: 'top 55%', end: 'bottom 65%', invalidateOnRefresh: true,
          onRefresh: layout,
          onUpdate: (self) => {                                                                           // scrub: dashoffset follows scroll
            const y = self.progress * H;
            gsap.set(path, { strokeDashoffset: gsap.utils.clamp(0, len, len - (y - y0)) });
            let reachedCount = 0;
            ys.forEach((ny, i) => { if (y >= ny - 4) reachedCount = i + 1; });
            if (reachedCount === last) return;
            items.forEach((it, i) => {
              const r = i < reachedCount;
              if (it.classList.contains('is-reached') !== r) { it.classList.toggle('is-reached', r); if (pops[i]) (r ? pops[i].play() : pops[i].reverse()); }
            });
            last = reachedCount;
          }
        });
      });

      /* --- prizes: SC08 + SC10 --- */
      safe('prizes', () => { wipe($('.prizes .h2')); rise($('.podium')); });

      /* --- SC09 steps: stepper highlight + line fill + illustrations --- */
      safe('SC09', () => {
        wipe($('.steps .h2'));
        const steps = $$('.step'), lis = $$('.stepper li');
        const activate = (i) => { lis.forEach((li, j) => li.classList.toggle('is-active', j === i)); steps.forEach((s, j) => s.classList.toggle('is-active', j === i)); };
        steps.forEach((s, i) => ScrollTrigger.create({ trigger: s, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && activate(i) }));
        activate(0);
        if (desktop && motion) gsap.to('.stepper__fill', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.panels', start: 'top 55%', end: 'bottom 55%', scrub: true } });
        else gsap.set('.stepper__fill', { scaleY: 1 });
        if (!motion) return;

        // step 3: avatars join
        const join = gsap.timeline({ paused: true })
          .from('.av--a', { x: -70, opacity: 0, duration: 0.9, ease: 'expo.out' }, 0)
          .from('.av--b', { x: 70, opacity: 0, duration: 0.9, ease: 'expo.out' }, 0.1)
          .from('.avs__link', { scaleX: 0, duration: 0.6, ease: 'power3.out' }, 0.5)
          .from('.avs__tag', { opacity: 0, y: 8, duration: 0.5 }, 0.8)
          .add(() => { gsap.to('.av', { y: -5, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.3 }); });
        ScrollTrigger.create({ trigger: '.step[data-step="3"]', start: 'top 65%', once: true, onEnter: () => join.play() });

        // step 4: PAID stamp thuds in, then wobbles
        const stamp = $('.stamp'), card = $('.paycard');
        gsap.set(stamp, { opacity: 0 });
        ScrollTrigger.create({ trigger: '.step[data-step="4"]', start: 'top 65%', once: true, onEnter: () => {
          gsap.timeline()
            .fromTo(stamp, { scale: 2.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'power4.in' })
            .fromTo(card, { y: 0 }, { y: 6, duration: 0.07, yoyo: true, repeat: 3, ease: 'none' })
            .to(stamp, { rotation: 3, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        } });
      });

      /* --- orgs: SC08 wipe from the centre line outward --- */
      safe('orgs', () => { $$('.org').forEach((o) => wipe(o)); });

      /* --- faq: rise --- */
      safe('faq', () => { wipe($('.faq .h2')); rise($('.faq-list')); });

      /* --- SC11 final CTA text scale + sticky mobile bar + nav chrome --- */
      safe('SC11', () => {
        const h = $('.final__h');
        if (motion) gsap.fromTo(h, { scale: 0.7, '--ls': '-0.02em' }, { scale: 1, '--ls': '-0.05em', ease: 'none',     // letter-spacing via CSS var (GSAP cannot tween em letter-spacing reliably)
          scrollTrigger: { trigger: '.final', start: 'top 80%', end: 'top 20%', scrub: true } });

        const bar = $('.sticky-cta');
        if (bar && !desktop) {
          gsap.set(bar, { yPercent: 120 });
          let past = false, inFinal = false, shown = false;
          const upd = () => { const s = past && !inFinal; if (s !== shown) { shown = s; gsap.to(bar, { yPercent: s ? 0 : 120, duration: reduced() ? 0 : 0.5, ease: 'power3.out', overwrite: 'auto' }); } };
          ScrollTrigger.create({ trigger: '.hero', start: 'bottom 25%', end: 'max', onToggle: (s) => { past = s.isActive; upd(); } });
          ScrollTrigger.create({ trigger: '.final', start: 'top 70%', end: 'max', onToggle: (s) => { inFinal = s.isActive; upd(); } });
        }
        return () => { if (bar) gsap.set(bar, { clearProps: 'transform' }); };
      });

      return () => splits.forEach((s) => s.revert());
    });
  }

  /* =====================================================================
     Boot
     ===================================================================== */
  applyConfig();
  buildMarquee();
  safe('ctas', initCtas);
  safe('menu', initMenu);
  safe('faq-init', initFaq);
  safe('countdown', initCountdown);
  safe('typer', initTyper);
  safe('canvas', initCanvas);
  safe('pointer', initPointer);
  safe('loops', initLoops);
  safe('form typing', initFormTyping);
  safe('scroll chrome', initScrollChrome);

  const fontsReady = Promise.race([(document.fonts && document.fonts.ready) || Promise.resolve(), wait(1800)]);
  const built = fontsReady.then(() => { buildAll(); safe('live', initLive); ScrollTrigger.refresh(); }).catch((e) => console.error('[Engage] build failed', e));
  runPreloader(built);

  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
  ENGAGE.refresh = () => ScrollTrigger.refresh();
  ENGAGE.go = go;
})();
