/* Add to index.html AFTER auth.js and main.js.
   Every primary CTA on the landing page gets  data-cta  (nav, hero, mobile bar, final CTA). */
(function () {
  const ctas = () => Array.from(document.querySelectorAll('[data-cta]'));
  const setLabel = (t) => ctas().forEach((b) => { const l = b.querySelector('[data-cta-label]') || b; l.textContent = t; });
 
  async function labelFromState() {
    try {
      const s = await E6.session();
      if (!s) return;
      setLabel('Open dashboard');
      const r = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + s.access_token } });
      if (!r.ok) return;
      const me = await r.json();
      if (!me.profile) setLabel('Finish your profile');
      else if (!me.team) setLabel('Create or join a team');
      else if (me.team.status === 'paid') setLabel("You're in. View team");
      else if (me.team.status === 'payment_pending') setLabel('Complete payment');
      else setLabel('Continue to payment');
    } catch (e) { /* keep default label */ }
  }
 
  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-cta]');
    if (!btn) return;
    ev.preventDefault();
    btn.setAttribute('aria-busy', 'true');
    try {
      const s = await E6.session();
      if (s) location.href = '/app.html';
      else await E6.signIn();
    } catch (e) { alert('Could not start sign-in. Please try again.'); btn.removeAttribute('aria-busy'); }
  });
 
  // live "teams registered" tile (L11) and counters
  async function liveStats() {
    const el = document.getElementById('teams-live'); if (!el) return;
    const pull = async () => {
      try {
        const j = await (await fetch('/api/stats')).json();
        const from = Number(el.textContent.replace(/\D/g, '')) || 0;
        if (window.gsap) { const o = { v: from }; gsap.to(o, { v: j.teams, duration: 1.2, ease: 'power2.out', onUpdate: () => (el.textContent = Math.round(o.v)) }); }
        else el.textContent = j.teams;
      } catch (e) { /* ignore */ }
    };
    pull(); setInterval(pull, 30000);
  }
 
  E6.ready.then(() => { labelFromState(); liveStats(); }).catch(() => {});
})();
