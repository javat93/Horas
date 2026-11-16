// Presentation only: no API calls, storage, input changes or session/Calendar operations.
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('app-navigation');
  if (nav) {
    const buttons = nav.querySelectorAll('button');
    const markCurrent = () => buttons.forEach(button => {
      if (button.classList.contains('tab-active')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    markCurrent();
    new MutationObserver(markCurrent).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
    buttons.forEach(button => button.addEventListener('click', () => window.scrollTo(0, 0)));
  }
  const summary = document.getElementById('session-filter-summary');
  const payment = document.getElementById('filter-cobrados');
  const performed = document.getElementById('filter-realizados');
  if (summary && payment && performed) {
    const describeFilters = () => {
      const labels = { all: 'Todos los cobros', cobrado: 'Cobrados', pendiente: 'Cobros pendientes' };
      const states = { all: '', realizado: ' · Realizados', futuro: ' · Sin realizar' };
      summary.textContent = labels[payment.value] + states[performed.value] + ' · Filtros';
    };
    payment.addEventListener('change', describeFilters);
    performed.addEventListener('change', describeFilters);
    describeFilters();
  }
  const previousFocus = new WeakMap();
  const focusable = modal => [...modal.querySelectorAll('button, input:not([type=hidden]), select, textarea, a[href], [tabindex="0"]')]
    .filter(element => !element.disabled && element.getClientRects().length);
  document.querySelectorAll('.glass-modal').forEach(modal => {
    new MutationObserver(() => {
      if (!modal.classList.contains('hidden')) {
        previousFocus.set(modal, document.activeElement);
        focusable(modal)[0]?.focus({ preventScroll: true });
      } else {
        const previous = previousFocus.get(modal);
        if (previous?.isConnected) previous.focus({ preventScroll: true });
      }
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  });
  document.addEventListener('keydown', event => {
    const modal = document.querySelector('.glass-modal:not(.hidden)');
    if (modal && !document.querySelector('dialog[open]')) {
      const items = focusable(modal);
      if (event.key === 'Escape') {
        const close = modal.querySelector('button[aria-label="Cerrar formulario"]');
        if (close) { event.preventDefault(); close.click(); return; }
      }
      if (event.key === 'Tab' && items.length) {
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    }
    if (!['Enter', ' '].includes(event.key) || event.target.getAttribute('role') !== 'button') return;
    if (!event.target.matches('.session-card-main, .group-card-main')) return;
    event.preventDefault();
    event.target.click();
  });
});
