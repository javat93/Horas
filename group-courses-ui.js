(function() {
  'use strict';
  const C = window.GroupCourses, G = window.GroupIdentity;
  window.createGroupCoursesUI = function({ session, connect, endpoint, invalidateSession }) {
    let filters = { curso: C.currentCourse(), estado: 'active', tipo: 'habitual' }, currentToken = '', blocked = false, cooldown = 0, notice = '', dialog = null, dialogHost = null, draft = null, draftCourse = '', saving = false, filtersOpen = false;
    const subscribers = new Set();
    function el(tag, props = {}, children = []) { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k in n) n[k] = v; else n.setAttribute(k, v); } for (const c of children) if (c) n.append(typeof c === 'string' ? document.createTextNode(c) : c); return n; }
    const button = (text, action, disabled = false, primary = false) => el('button', { type: 'button', className: 'gc-button' + (primary ? ' gc-primary' : ''), textContent: text, onclick: action, disabled });
    function select(label, choices, value, change, disabled = false) { const s = el('select', { 'aria-label': label, disabled, onchange: e => change(e.target.value) }, choices.map(([value, textContent]) => el('option', { value, textContent }))); s.value = value; return el('label', { className: 'gc-field' }, [el('span', { textContent: label }), s]); }
    function emit() { subscribers.forEach(fn => fn()); const save = dialog?.querySelector('[data-gc-save]'); if (save && !saving) save.disabled = !draft?.size || !eligible(); }
    async function json(payload) {
      const shared = session(); if (!shared) throw Object.assign(Error('Conecta Google para organizar los grupos.'), { status: 401 });
      const r = await fetch(endpoint + (payload ? '' : '?api=environment'), { ...(payload ? { method: 'POST', body: JSON.stringify(payload) } : {}), headers: { Authorization: 'Bearer ' + shared.token, 'Content-Type': 'application/json' } });
      let d; try { d = await r.json(); } catch { throw Object.assign(Error('Respuesta pendiente de verificar.'), { code: 'UNVERIFIED_RESPONSE', status: 502 }); }
      if (!r.ok) {
        if (r.status === 401) invalidateSession();
        if (r.status === 429 || /quota|cuota|rate.?limit/i.test(d.error || '')) { cooldown = Date.now() + 60000; setTimeout(() => { emit(); const retry = dialog?.querySelector('[data-gc-reload]'); if (retry && !saving) retry.disabled = false; }, 60050); }
        throw Object.assign(Error(d.error || 'No se pudo completar la operación.'), { status: r.status, code: d.code });
      }
      return d;
    }
    const store = C.createStore({ transport: json, environment: () => json(), onChange: emit });
    const data = () => store.state().data;
    const eligible = () => !blocked && !saving && !!session() && store.state().canWrite && Date.now() >= cooldown;
    function label(group) { const r = C.classification(data()?.records || [], group, filters.curso); return !r ? 'Sin clasificar' : (r.tipo === 'habitual' ? 'Habitual' : 'Puntual') + (r.activo ? '' : ' · Inactivo'); }
    function visible(groups) { return data() && session() ? C.filter(groups, data().records, filters) : []; }
    async function refresh(force = false) {
      if (Date.now() < cooldown) return;
      try { await store.load(force); notice = force ? 'Organización actualizada. Revisa tu selección antes de guardar.' : ''; }
      catch (e) { notice = e.message; } emit();
    }
    async function refreshSession() {
      const token = session()?.token || '';
      if (!token) { currentToken = ''; if (!store.state().busy) store.clear(); return; }
      if (document.getElementById('tab-maestros').classList.contains('hidden') && document.getElementById('tab-repertorio').classList.contains('hidden')) return;
      if (token !== currentToken) { currentToken = token; if (store.state().busy) return; store.clear(); await refresh(); }
      else if (!data() && !store.state().error) await refresh();
    }
    function change(key, value) { if (key === 'tipo') filtersOpen = true; filters = { ...filters, [key]: value }; emit(); }
    function panel() {
      const s = store.state(), root = el('section', { className: 'gc-panel', 'aria-label': 'Organización de grupos por curso' });
      const years = new Set([C.currentCourse(), C.previous(C.currentCourse()), filters.curso, ...(data()?.records || []).map(r => r.curso)]);
      const next = +C.currentCourse().slice(0, 4) + 1; years.add(`${next}–${next + 1}`);
      const management = el('details', { className: 'gc-management' }, [el('summary', { textContent: 'Organizar', 'aria-label': 'Opciones de organización del curso' }), el('div', { className: 'gc-management-actions' }, [button('Organizar este curso', openEditor, !eligible(), true), button('Actualizar organización', () => refresh(true), s.busy || blocked || Date.now() < cooldown)])]);
      root.append(el('div', { className: 'gc-top' }, [select('Curso', [...years].sort().reverse().map(y => [y, y]), filters.curso, v => change('curso', v), s.busy), management]));
      const details = el('details', { className: 'gc-filters', open: filtersOpen, ontoggle: () => { if (details.isConnected) filtersOpen = details.open; } });
      details.append(el('summary', { textContent: 'Filtros · ' + ({ active: 'Activos', inactive: 'Inactivos', all: 'Todos', unclassified: 'Sin clasificar' }[filters.estado]) + ' · ' + ({ habitual: 'Habituales', puntual: 'Puntuales', all: 'Todos los tipos' }[filters.tipo]) }), el('div', { className: 'gc-filter-fields' }, [select('Estado', [['active', 'Activos'], ['inactive', 'Inactivos'], ['unclassified', 'Sin clasificar'], ['all', 'Todos']], filters.estado, v => { filtersOpen = true; filters = { ...filters, estado: v, ...(v === 'unclassified' ? { tipo: 'all' } : {}) }; emit(); }, s.busy), select('Tipo', [['habitual', 'Habituales'], ['puntual', 'Puntuales'], ['all', 'Todos los tipos']], filters.tipo, v => change('tipo', v), s.busy || filters.estado === 'unclassified')]));
      root.append(details);
      if (!session()) root.append(el('p', { className: 'gc-message', textContent: 'Usa la conexión de Google de la aplicación.' }), button('Conectar Google', connect));
      else if (s.busy) root.append(el('p', { className: 'gc-message', role: 'status', textContent: saving ? 'Guardando el lote y verificando…' : 'Cargando organización por curso…' }));
      else if (s.error) root.append(el('p', { className: 'gc-message', role: 'alert', textContent: notice || s.error.message }), button(Date.now() < cooldown ? 'Espera un minuto para actualizar' : 'Actualizar organización', () => refresh(true), Date.now() < cooldown));
      else if (data()) {
        const unclassified = data().groups.filter(g => !C.classification(data().records, g, filters.curso)).length;
        const count = visible(data().groups).length;
        root.append(el('p', { className: 'gc-message', textContent: `${count} ${count === 1 ? 'grupo' : 'grupos'} con estos filtros` + (unclassified ? ` · ${unclassified} sin clasificar` : '') }));
        if (unclassified) root.append(button('Ver sin clasificar', () => { filters = { ...filters, estado: 'unclassified', tipo: 'all' }; emit(); }));
        if (data().issues.length) root.append(el('p', { role: 'alert', className: 'gc-message', textContent: data().issues.join(' · ') }));
        if (notice) root.append(el('p', { role: 'status', className: 'gc-message', textContent: notice }));

      }
      return root;
    }
    function openEditor() {
      if (!eligible()) return;
      draftCourse = filters.curso; draft = new Map();
      const editorData = data(), editData = () => data() || editorData;
      dialog = el('dialog', { className: 'gc-dialog', 'aria-labelledby': 'gc-dialog-title' });
      dialogHost = el('div'); const shadow = dialogHost.attachShadow({ mode: 'open' }); shadow.append(el('link', { rel: 'stylesheet', href: 'group-courses.css?v=courses-20261116' }), dialog);
      const close = () => { if (saving) return; if (draft.size && !window.confirm('¿Descartar la selección sin guardar?')) return; dialog.close(); dialogHost.remove(); dialog = null; dialogHost = null; draft = null; };
      const heading = el('div', { className: 'gc-dialog-heading' }, [el('div', {}, [el('p', { className: 'gc-kicker', textContent: 'ORGANIZAR ' + draftCourse }), el('h2', { id: 'gc-dialog-title', textContent: 'Tus grupos de este curso' })]), button('Cerrar', close)]);
      const error = el('p', { className: 'gc-message', role: 'alert' }), counter = el('p', { className: 'gc-message', 'aria-live': 'polite' });
      let query = '';
      const list = el('div', { className: 'gc-editor-list' });
      const selected = () => { counter.textContent = draft.size + ' grupos seleccionados · máximo 100'; save.disabled = !draft.size || !eligible(); };
      function draw() {
        list.replaceChildren();
        const groups = editData().groups.filter(g => !query || G.matches(g.nombre, query)).slice().sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base', numeric: true }));
        for (const g of groups) {
          const existing = C.classification(editData().records, g, draftCourse), value = draft.get(g.id);
          const box = el('input', { type: 'checkbox', checked: !!value, 'aria-label': 'Seleccionar ' + g.label, onchange: e => { if (e.target.checked) { if (draft.size >= 100) { e.target.checked = false; error.textContent = 'Puedes guardar hasta 100 grupos por lote.'; return; } draft.set(g.id, { grupo: g.nombre, activo: existing?.activo ?? true, tipo: existing?.tipo || 'habitual' }); } else draft.delete(g.id); options(); selected(); } });
          const row = el('article', { className: 'gc-editor-row' }, [el('label', { className: 'gc-group-choice' }, [box, el('span', {}, [el('strong', { textContent: g.label }), el('small', { textContent: existing ? `${existing.tipo === 'habitual' ? 'Habitual' : 'Puntual'} · ${existing.activo ? 'Activo' : 'Inactivo'}` : 'Sin clasificar en este curso' })])])]);
          function options() { row.querySelector('.gc-filter-fields')?.remove(); const current = draft.get(g.id); if (current) row.append(el('div', { className: 'gc-filter-fields' }, [select('Estado de ' + g.label, [['true', 'Activo'], ['false', 'Inactivo']], String(current.activo), v => { current.activo = v === 'true'; }), select('Tipo de ' + g.label, [['habitual', 'Habitual'], ['puntual', 'Puntual']], current.tipo, v => { current.tipo = v; })])); }
          options();
          list.append(row);
        }
        if (!groups.length) list.append(el('p', { textContent: 'No hay grupos con esa búsqueda.' })); selected();
      }
      const search = el('input', { type: 'search', placeholder: 'Buscar grupo…', 'aria-label': 'Buscar grupos para organizar', oninput: e => { query = e.target.value; draw(); } });
      const pickVisible = button('Seleccionar visibles', () => { for (const g of editData().groups.filter(g => !query || G.matches(g.nombre, query))) { if (draft.size >= 100) break; if (!draft.has(g.id)) { const r = C.classification(editData().records, g, draftCourse); draft.set(g.id, { grupo: g.nombre, activo: r?.activo ?? true, tipo: r?.tipo || 'habitual' }); } } draw(); });
      const clear = button('Quitar selección', () => { draft.clear(); draw(); });
      const copy = button('Copiar del ' + C.previous(draftCourse), () => {
        const copies = C.copyPrevious(editData().groups, editData().records, draftCourse);
        if (!copies.length) { error.textContent = 'No hay grupos del curso anterior pendientes de clasificar aquí.'; return; }
        let added = 0; for (const r of copies) if (!draft.has(G.id(r.grupo)) && draft.size < 100) { draft.set(G.id(r.grupo), r); added++; }
        error.textContent = `${added} grupos preparados desde el curso anterior. Revisa los puntuales; el curso actual no se sobrescribe.`; draw();
      });
      const reload = button('Actualizar y conservar selección', async () => { reload.disabled = true; await refresh(true); reload.disabled = Date.now() < cooldown; error.textContent = store.state().needsReload ? 'No se pudo actualizar. La selección se conserva.' : 'Selección conservada. Revisa los cambios antes de volver a guardar.'; draw(); }); reload.hidden = true; reload.setAttribute('data-gc-reload', '');
      const save = button('Guardar selección', async () => {
        if (!draft.size || !eligible()) return; saving = true; error.textContent = 'Guardando y verificando…';
        dialog.querySelectorAll('button,input,select').forEach(n => { n.disabled = true; });
        try {
          await store.save(draftCourse, [...draft.values()]); notice = 'Organización guardada y verificada.'; dialog.close(); dialogHost.remove(); dialog = null; dialogHost = null; draft = null;
        } catch (e) {
          error.textContent = e.message + ' La selección se conserva. Actualiza y revisa antes de reenviar.';
          reload.hidden = false; reload.disabled = Date.now() < cooldown;
        } finally {
          saving = false; if (dialog) { dialog.querySelectorAll('button,input,select').forEach(n => { n.disabled = false; }); reload.disabled = Date.now() < cooldown; selected(); } emit();
        }
      }, false, true);
      save.setAttribute('data-gc-save', '');
      dialog.append(heading, el('p', { className: 'gc-message', textContent: 'Selecciona grupos y ajusta su estado y tipo. Cada curso conserva su propia organización.' }), search, el('div', { className: 'gc-bulk-actions' }, [pickVisible, clear]), copy, list, error, reload, el('div', { className: 'gc-dialog-footer' }, [counter, save]));
      dialog.addEventListener('cancel', e => { e.preventDefault(); close(); }); document.body.append(dialogHost); draw(); dialog.showModal(); search.focus();
    }
    window.addEventListener('beforeunload', e => { if (saving || draft?.size) { e.preventDefault(); e.returnValue = ''; } });
    return { panel, visible, label, refreshSession, refresh, subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }, setBlocked(value) { if (blocked !== value) { blocked = value; emit(); } } };
  };
  document.addEventListener('DOMContentLoaded', async () => {
    await window.horasConfigReady; if (CONFIG.DATA_MODE !== 'production') return;
    if (!await window.horasEnvironmentReady) return;
    const shared = RepertoireIntegration.createSession({ config: CONFIG, read: () => savedSession().read(), accessToken: () => window.horasAccessToken(), connect: () => handleAuthClick() });
    const ui = window.horasGroupCourses = window.createGroupCoursesUI({ ...shared, endpoint: new URL('/api/grupos-curso', CONFIG.DAILY_API_URL).href, invalidateSession: () => expireGoogleConnection() });
    const mount = document.getElementById('group-course-controls');
    ui.subscribe(() => { mount.replaceChildren(ui.panel()); renderGrupos(); }); mount.replaceChildren(ui.panel());
    new MutationObserver(() => ui.refreshSession()).observe(document.getElementById('auth-btn'), { attributes: true, attributeFilter: ['class'] });
    document.getElementById('btn-maestros').addEventListener('click', () => ui.refreshSession());
    document.getElementById('repertoire-entry').addEventListener('click', () => ui.refreshSession());
    window.addEventListener('storage', () => ui.refreshSession());
    await ui.refreshSession(); window.dispatchEvent(new Event('group-courses-ready'));
  });
})();
