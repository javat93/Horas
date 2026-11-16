(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.RepertoireIntegration = api; document.addEventListener('DOMContentLoaded', () => api.install()); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TARGET = '1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60';
  function createSession({ config, read, accessToken, connect }) {
    if (config?.DATA_MODE !== 'production' || config.SPREADSHEET_ID !== TARGET ||
        !config.SCOPES.split(/\s+/).includes('https://www.googleapis.com/auth/spreadsheets')) throw Error('Repertorio requiere la conexión del original.');
    return {
      session() {
        try {
          const stored = read();
          if (!stored.token) return null;
          const token = accessToken();
          if (stored.expired || !Number.isFinite(stored.expiresAt) || Date.now() >= stored.expiresAt - 30000) return null;
          return token === stored.token ? { token, expires: stored.expiresAt - 30000 } : null;
        } catch { return null; }
      },
      connect() { return connect(); }
    };
  }
  function groupFromHash(hash) { return new URLSearchParams(hash.replace(/^#/, '')).get('grupo') || ''; }
  function repertoireHash(group = '') { return '#repertorio' + (group ? '&grupo=' + encodeURIComponent(group) : ''); }
  function install() {
    const entry = document.getElementById('repertoire-entry'), panel = document.getElementById('tab-repertorio');
    if (!entry || !panel) return;
    let mounted = null, mounting = null;
    const start = async () => {
      if (mounted) return mounted.refreshSession();
      if (mounting) return mounting;
      mounting = (async () => {
        await window.horasConfigReady;
        if (!await window.horasEnvironmentReady) throw Error('Primero hay que verificar la conexión de la aplicación.');
        const shared = createSession({ config: CONFIG, read: () => savedSession().read(), accessToken: () => window.horasAccessToken(), connect: () => handleAuthClick() });
        const shadow = panel.attachShadow({ mode: 'open' });
        shadow.append(document.getElementById('repertoire-template').content.cloneNode(true));
        mounted = window.mountRepertoire(shadow, {
          ...shared,
          invalidateSession() { expireGoogleConnection(); },
          onState({ busy, connected }) { document.getElementById('repertoire-refresh').disabled = busy || !connected; window.horasGroupCourses?.setBlocked(busy); },
          groupCourses: () => window.horasGroupCourses,
          page: { profile: 'production', endpoint: new URL('/api/repertorio', CONFIG.DAILY_API_URL).href },
          groupId: groupFromHash(location.hash),
          selectGroup(id) { history.replaceState(null, '', repertoireHash(id)); },
          bottomInset() { const nav = document.getElementById('app-navigation'); return getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().height : 0; }
        });
        return mounted.ready;
      })().catch(error => { panel.textContent = error.message; mounting = null; });
      return mounting;
    };
    entry.addEventListener('click', event => {
      event.preventDefault();
      switchTab('repertorio');
      history.replaceState(null, '', repertoireHash(mounted?.groupId() || groupFromHash(location.hash)));
      window.scrollTo(0, 0);
      start();
    });
    document.getElementById('repertoire-refresh').addEventListener('click', () => mounted?.refreshData());
    document.querySelectorAll('#app-navigation button').forEach(button => button.addEventListener('click', () => {
      if (location.hash.startsWith('#repertorio')) history.replaceState(null, '', location.pathname + location.search);
    }));
    new MutationObserver(() => mounted?.refreshSession()).observe(document.getElementById('auth-btn'), { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', () => mounted?.refreshSession());
    const openLink = () => { if (location.hash.startsWith('#repertorio')) entry.click(); };
    window.addEventListener('hashchange', openLink);
    openLink();
  }
  return { TARGET, createSession, groupFromHash, repertoireHash, install };
});
