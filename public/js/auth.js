/* Shared by index.html and app.html. Load AFTER the supabase-js CDN script. */
(function () {
  const state = { cfg: null, sb: null };
  const ready = (async () => {
    const r = await fetch('/api/config');
    if (!r.ok) throw new Error('Could not load config');
    state.cfg = await r.json();
    state.sb = window.supabase.createClient(state.cfg.supabaseUrl, state.cfg.supabaseAnonKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return state;
  })();
 
  window.E6 = {
    ready,
    async session() { const s = await ready; const { data } = await s.sb.auth.getSession(); return data.session; },
    async signIn() {
      const s = await ready;
      const { error } = await s.sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + '/app.html', queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;                 // on success the browser is redirected to Google
    },
    async signOut() { const s = await ready; await s.sb.auth.signOut(); },
  };
})();
