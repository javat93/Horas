(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else document.addEventListener('DOMContentLoaded', () => api.mount(document, MutationObserver));
})(function () {
  'use strict';
  function connectionView({ connected, ready, renewal }) {
    if (connected) return { label: 'Google conectado', state: 'connected' };
    if (renewal) return { label: 'Renovar Google', state: 'renewal' };
    return ready ? { label: 'Google sin conectar', state: 'disconnected' }
      : { label: 'Preparando Google', state: 'preparing' };
  }
  function mount(doc, Observe) {
    const badge = doc.getElementById('pm-google-state');
    const auth = doc.getElementById('auth-btn');
    const text = doc.getElementById('auth-text');
    if (!badge || !auth || !text) return;
    const update = () => {
      const view = connectionView({
        connected: auth.hidden || auth.classList.contains('hidden'),
        ready: auth.dataset.googleReady === 'true',
        renewal: /renovar/i.test(text.textContent)
      });
      badge.textContent = view.label;
      badge.dataset.connection = view.state;
    };
    const observer = new Observe(update);
    observer.observe(auth, { attributes: true, attributeFilter: ['class', 'hidden', 'data-google-ready'] });
    observer.observe(text, { childList: true, characterData: true, subtree: true });
    update();
    return observer;
  }
  return { connectionView, mount };
});
