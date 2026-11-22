/* global RepertoireClient, RepertoireModel, GroupIdentity */
(function () {
  'use strict';
  window.mountRepertoire = function (root = document, host = null) {
  const page = host?.page || window.RepertoirePage || { profile: 'development', endpoint: '/api/repertorio-test' };
  const C = RepertoireClient.forProfile(page.profile), M = RepertoireModel, G = GroupIdentity;
  const endpoint = page.endpoint, production = page.profile === 'production';
  const $ = id => root.getElementById(id), dialog = $('editor'), form = $('editor-form');
  let client, progress, hadPending = false, env, token = '', expires = 0, view = 'repertoire', groupId = '', search = '', type = '', filter = 'all', archived = false;
  let draftMeta = null, recoveringForm = false;
  let selected = new Set(), draft = null, initialForm = '', dirty = false, connecting = false, oauthClient = null, filtersOpen = false, selecting = false;
  groupId = host?.groupId || new URLSearchParams(window.location.hash.slice(1)).get('grupo') || '';
  const types = [['temaGaleta', 'Galeta'], ['temaSlap', 'Slap'], ['temaPropio', 'Propio']];
  const uid = () => crypto.randomUUID();
  function el(tag, props = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v); else if (k in n && !k.startsWith('aria-')) n[k] = v; else n.setAttribute(k, v); }
    for (const c of children) if (c !== null && c !== undefined) n.append(typeof c === 'string' ? document.createTextNode(c) : c);
    return n;
  }
  function button(text, action, cls = '', disabled = false, allowPending = false) { return el('button', { type: 'button', class: 'button ' + cls, textContent: text, disabled: disabled || (!allowPending && !!progress?.state().pending), onclick: action }); }
  function icon(name) {
    const paths = { plus: 'M12 5v14M5 12h14', more: 'M5 12h.01M12 12h.01M19 12h.01', filters: 'M4 7h16M7 12h10M10 17h4' };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'aria-hidden': 'true' })) svg.setAttribute(key, value);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', paths[name]); svg.append(path); return svg;
  }
  function actionMenu(label, actions) {
    const menu = el('details', { class: 'action-menu' });
    menu.append(el('summary', { role: 'button', 'aria-label': label, title: label }, [icon('more')]), el('div', { class: 'menu-items' }, actions.map(([label, action, disabled = false]) => button(label, () => { menu.open = false; action(); }, 'subtle', disabled))));
    menu.addEventListener('toggle', () => {
      if (!menu.open) return;
      const summary = menu.querySelector('summary').getBoundingClientRect(), panel = menu.querySelector('.menu-items');
      const nav = root.querySelector('.tabs'), reserved = host ? host.bottomInset() : getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().height : 0;
      menu.classList.toggle('opens-up', window.innerHeight - reserved - summary.bottom < panel.offsetHeight + 12 && summary.top > panel.offsetHeight + 12);
    });
    return menu;
  }
  function chooseGroup(id) { groupId = id; selected.clear(); selecting = false; if (host) host.selectGroup(id); else window.history.replaceState(null, '', '#grupo=' + encodeURIComponent(id)); render(); window.scrollTo(0, 0); }
  const canWrite = () => !!client?.state().canWrite && !progress?.state().saving && authenticated();
  function authenticated() { const session = host ? host.session() : { token, expires }; return !!session?.token && Date.now() < session.expires; }
  const data = () => { const d = client?.state().data; return d && progress ? { ...d, assignments: d.assignments.map(a => ({ ...a, ...progress.changes(a.id) })) } : d; };
  const currentGroup = () => data()?.groups.find(g => g.id === groupId);
  const sortedGroups = () => [...(host?.groupCourses?.()?.visible(data()?.groups || []) || (host?.groupCourses ? [] : data()?.groups || []))].sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id));
  const themeById = id => data()?.themes.find(t => t.id === id);
  const sortThemes = (a, b) => a.numeroOrden - b.numeroOrden || a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id);
  function matching(t) { return (!type || t[type]) && (!search || G.normalize(t.nombre).includes(G.normalize(search))); }
  function say(message, error = false) {
    $('status').replaceChildren(document.createTextNode(message)); $('status').className = 'status' + (error ? ' error' : ''); $('status').hidden = !message;
    if (client?.state().needsReload && !progress?.state().pending) $('status').append(button('Actualizar datos', () => reload(true), '', client.state().busy));
  }
  function progressNotice() {
    const s = progress?.state(); if (!s) return;
    if (!s.pending) { if (s.saved) { progress.acknowledge(); say('Marcados guardados y verificados.'); } else if (hadPending) say('No quedan marcados pendientes.'); hadPending = false; return; }
    hadPending = true;
    const busy = s.saving || client.state().busy;
    say(s.retryInMs ? 'Google ha limitado las lecturas. Tus marcados se conservan; espera aproximadamente un minuto antes de actualizar.' : s.error ? message(s.error) + ' Tus marcados se conservan sin reenviarse automáticamente.' : busy ? 'Guardando el lote y verificando los marcados…' : s.paused ? 'Revisa los marcados conservados y pulsa Guardar marcados.' : s.pending === 1 ? 'Un tema con marcados pendientes. Se guardará en breve.' : s.pending + ' temas con marcados pendientes. Se guardarán juntos en breve.', !!s.error);
    if (client.state().needsReload) $('status').append(button('Actualizar y revisar marcados', async () => { await reload(true); if (!client.state().needsReload) progress.reviewed(); }, '', busy || !!s.retryInMs, true));
    $('status').append(button(s.paused ? 'Guardar marcados' : 'Guardar ahora', () => progress.flush().catch(() => {}), '', busy || !authenticated() || client.state().needsReload || !!s.retryInMs, true));
    $('status').append(button('Descartar marcados', () => { if (window.confirm('¿Descartar los marcados que todavía no se han confirmado?')) { progress.discard(); say('Marcados locales descartados.'); } }, 'subtle', busy, true));
  }
  function mark(id, changes) { try { progress.set(id, changes); } catch (error) { say(error.message, true); } }
  function message(error) {
    if (error.status === 401) return 'Vuelve a conectar Google. El formulario y sus cambios se conservan.';
    if (error.code === 'REVIEW_EXPIRED') return 'Los datos han cambiado en la hoja. Tu formulario se conserva. Actualiza los datos y revisa los cambios antes de guardar.';
    if (error.code === 'WRITE_UNCERTAIN' || error.code === 'UNVERIFIED_RESPONSE' || !error.status) return 'No se ha podido confirmar el guardado. Actualiza y comprueba el resultado antes de volver a guardar.';
    if (error.code === 'ORDER_CONFLICT') return 'Ese número ya está ocupado dentro de uno de los tipos elegidos. Cambia el número o los tipos.';
    return error.message;
  }
  async function json(url, options) {
    const r = await (window.horasGoogleRequests?.fetch(url, options) || fetch(url, options)); let d;
    try { d = await r.json(); } catch { throw Object.assign(Error('El servidor no ha devuelto una respuesta válida.'), { status: r.status, code: 'UNVERIFIED_RESPONSE' }); }
    if (!r.ok) throw Object.assign(Error(d.error || 'No se ha podido completar la operación.'), { status: r.status, code: d.code });
    return d;
  }
  async function transport(payload) {
    if (!authenticated()) throw Object.assign(Error('La sesión ha caducado. Vuelve a conectar Google; tus cambios sin guardar se conservan.'), { status: 401, code: 'AUTH_REQUIRED' });
    try { return await json(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (host ? host.session()?.token : token) }, body: JSON.stringify(payload) }); }
    catch (error) { if (error.status === 401) { token = ''; expires = 0; host?.invalidateSession(); } throw error; }
  }
  async function reload(keepDraft = false) {
    if (!client || client.state().busy) return;
    try {
      await client.load();
      if (!groupId || !currentGroup()) groupId = sortedGroups()[0]?.id || '';
      selected.clear(); render();
      say(env.preview ? 'Simulación local: todos los cambios se guardan solo en memoria.' : production ? 'Repertorio actualizado.' : 'Datos de la copia actualizados.');
      if (keepDraft && draft) {
        // Rebase explicitly against the fresh version while preserving only fields the user edited.
        draft.rebased = true; $('dialog-error').hidden = false;
        $('dialog-error').textContent = 'Datos actualizados. Revisa el formulario conservado antes de volver a guardar. Si el guardado anterior sí se aplicó, los mismos identificadores evitan duplicarlo.';
      }
    } catch (error) { say(message(error), true); } finally { controls(); }
  }
  async function mutate(payload, success) {
    if (progress?.state().pending) { progressNotice(); return false; }
    say('Guardando cambios…');
    try { await client.save(payload); selected.clear(); render(); say(success); return true; }
    catch (error) { say(message(error), true); return false; }
  }
  function controls() {
    const busy = !!client?.state().busy || !!progress?.state().saving;
    host?.onState({ busy: busy || !!progress?.state().pending, connected: authenticated() });
    $('workspace').setAttribute('aria-busy', String(busy));
    $('connect').disabled = !env || busy || connecting;
    $('connect').hidden = authenticated(); $('disconnect').hidden = !authenticated(); $('disconnect').disabled = busy;
    $('connection-label').textContent = busy ? 'Guardando o consultando…' : authenticated() ? (env?.preview ? 'Datos simulados' : 'Google conectado') : 'Sin conexión';
    root.querySelectorAll('.tabs button').forEach(b => { b.disabled = busy; });
    if (busy) $('workspace').querySelectorAll('input,select,textarea,button').forEach(n => { n.disabled = true; });
    if (dialog.open) {
      form.querySelectorAll('input,select,textarea,button').forEach(n => { n.disabled = busy; });
      $('save-dialog').disabled = !canWrite() || !!progress?.state().pending;
      $('dirty-label').textContent = busy ? 'Comprobando el guardado…' : dirty ? 'Cambios sin guardar' : '';
    }
    progressNotice();
  }
  function render() {
    const focused = root.activeElement || document.activeElement, focusId = focused?.id;
    const caret = focused instanceof HTMLInputElement && focused.type === 'search' ? focused.selectionStart : null;
    root.querySelectorAll('.tabs button').forEach(b => { if (b.dataset.tab === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const workspace = $('workspace'); workspace.replaceChildren();
    $('issue-panel').hidden = true;
    if (!data()) { workspace.append(empty('Todo tu repertorio en un lugar', authenticated() ? 'Cargando el repertorio…' : production ? 'Usa la conexión de Google de la aplicación para consultar tus temas.' : 'Conecta Google para consultar los temas de la copia de desarrollo.', host && !authenticated() ? button('Conectar Google', () => host.connect(), 'primary') : null)); controls(); return; }
    if (!groupId) groupId = sortedGroups()[0]?.id || '';
    if (data().issues.length) {
      const p = $('issue-panel'); p.hidden = false; p.replaceChildren(el('strong', { textContent: 'Hay datos que necesitan revisión. Los guardados están pausados.' }));
      p.append(el('ul', {}, data().issues.map(i => el('li', { textContent: [i.sheet, i.rowIdx ? 'fila ' + i.rowIdx : '', i.message || i.code].filter(Boolean).join(' · ') }))));
    }
    if (!env.writeEnabled) workspace.append(el('p', { class: 'readonly-note', textContent: 'Este acceso está en modo de consulta.' }));
    const vault = window.horasDraftVault, savedMarks = vault?.read('repertoire-marks'), savedForm = vault?.read('repertoire-form');
    if (savedMarks?.length && !progress?.state().pending) workspace.append(el('div', { class:'status' }, [el('p',{textContent:'Hay marcados recuperables en este dispositivo. Revisa los datos antes de guardarlos.'}), button('Recuperar marcados',async()=>{await reload(true);if(client.state().canWrite){const first=savedMarks.map(u=>data().assignments.find(a=>a.id===u.vinculoId&&a.activo)).find(Boolean);if(first){view='repertoire';groupId=G.id(first.grupo);host?.groupCourses?.()?.revealGroup(groupId);host?.selectGroup(groupId);}progress.restore(savedMarks);if(!progress.state().pending){vault.remove('repertoire-marks');say('Los marcados ya están confirmados o las relaciones ya no están activas.');}}},'',!canWrite()),button('Descartar borrador',()=>{vault.remove('repertoire-marks');render();},'subtle')]));
    if (savedForm && !dialog.open) workspace.append(el('div', { class:'status' }, [button('Recuperar formulario de repertorio',()=>recoverForm(savedForm),'',!canWrite()),button('Descartar formulario',()=>{vault.remove('repertoire-form');render();},'subtle')]));
    if (view !== 'catalog' && host?.groupCourses) {
      const courses = host.groupCourses();
      if (courses) workspace.append(courses.panel());
      if (!sortedGroups().some(g => g.id === groupId)) groupId = sortedGroups()[0]?.id || '';
    }
    if (view === 'catalog') renderCatalog(workspace);
    else if (view === 'groups') renderGroups(workspace);
    else renderRepertoire(workspace);
    controls();
    if (focusId && root.getElementById(focusId) && root.getElementById(focusId) !== focused && !dialog.open) { const n = root.getElementById(focusId); n.focus(); if (caret !== null) n.setSelectionRange(caret, caret); }
  }
  function empty(title, text, action) { return el('div', { class: 'empty' }, [el('span', { class: 'empty-symbol', 'aria-hidden': 'true', textContent: '♫' }), el('h2', { textContent: title }), el('p', { textContent: text }), action]); }
  function tags(t) { return el('div', { class: 'types' }, types.filter(([k]) => t[k]).map(([, label]) => el('span', { class: 'tag', textContent: label }))); }
  function selectControl(options, value, label, action, cls = 'control') {
    const s = el('select', { class: cls, 'aria-label': label, onchange: e => action(e.target.value) }, options.map(([v, text]) => el('option', { value: v, textContent: text })));
    s.value = value; return s;
  }
  function checkbox(text, checked, action, disabled = false, id = '') {
    return el('label', { class: 'check-label' + (checked ? ' is-checked' : '') + (disabled ? ' is-disabled' : '') }, [el('input', { type: 'checkbox', checked, disabled, ...(id ? { id } : {}), onchange: e => action(e.target.checked) }), el('span', { textContent: text })]);
  }
  function filters(root, withArchived = true) {
    const primary = el('div', { class: 'filter-search' }, [el('input', { id: 'theme-search', class: 'control search', type: 'search', placeholder: view === 'groups' ? 'Buscar grupo…' : 'Buscar tema…', 'aria-label': view === 'groups' ? 'Buscar grupo' : 'Buscar tema', value: search, oninput: e => { search = e.target.value; selected.clear(); render(); } })]);
    const bar = el('div', { class: 'filters' }, [primary]);
    if (view !== 'groups') {
      const count = Number(!!type) + Number(archived);
      const toggle = button('', () => { filtersOpen = !filtersOpen; render(); }, 'filter-toggle');
      toggle.id = 'filter-toggle'; toggle.setAttribute('aria-expanded', String(filtersOpen)); toggle.setAttribute('aria-controls', 'advanced-filters'); toggle.setAttribute('aria-label', 'Filtros' + (count ? ': ' + count + ' activos' : ''));
      toggle.append(icon('filters'), el('span', { textContent: 'Filtros' + (count ? ' · ' + count : '') })); primary.append(toggle);
      const advanced = el('div', { id: 'advanced-filters', class: 'advanced-filters', hidden: !filtersOpen }, [selectControl([['', 'Todos los tipos'], ...types], type, 'Filtrar por tipo', v => { type = v; selected.clear(); render(); })]);
      if (withArchived) advanced.append(checkbox('Mostrar archivados', archived, v => { archived = v; selected.clear(); render(); }));
      if (count) advanced.append(button('Restablecer filtros', () => { type = ''; archived = false; selected.clear(); render(); }, 'subtle'));
      bar.append(advanced);
    }
    root.append(bar);
  }
  function refreshButton() { return button('Actualizar', () => reload(), '', client.state().busy); }
  function renderCatalog(root) {
    root.append(el('div', { class: 'toolbar' }, [el('h2', { textContent: 'Catálogo de temas' }), el('div', { class: 'toolbar-actions' }, [refreshButton(), button('Nuevo tema', () => editTheme(), 'primary', !canWrite())])]));
    filters(root);
    const rows = data().themes.filter(t => (archived || t.activo) && matching(t)).sort(sortThemes);
    if (!rows.length) { root.append(empty(data().themes.length ? 'No hay temas con estos filtros' : 'Empieza por el primer tema', 'Cada tema se crea una sola vez y después se asigna a los grupos que lo trabajan.', button('Crear un tema', () => editTheme(), 'primary', !canWrite()))); return; }
    const list = el('div', { class: 'list' });
    for (const t of rows) {
      const count = new Set(data().assignments.filter(a => a.temaId === t.id && a.activo).map(a => G.id(a.grupo))).size;
      list.append(el('article', { class: 'song catalog-row', 'aria-label': t.nombre }, [el('span', { class: 'order', textContent: String(t.numeroOrden).padStart(2, '0') }), el('div', { class: 'song-main' }, [el('div', { class: 'song-title', textContent: t.nombre }), tags(t), !t.activo ? el('p', { class: 'status-copy', textContent: 'Archivado' }) : null]), el('p', { class: 'muted', textContent: count + (count === 1 ? ' grupo' : ' grupos') }), el('div', { class: 'song-action' }, [button('Editar', () => editTheme(t), 'subtle', !canWrite()), button(t.activo ? 'Archivar' : 'Recuperar', () => confirmAction(t.activo ? 'Archivar tema' : 'Recuperar tema', t.nombre, t.activo ? 'Se conserva su seguimiento en todos los grupos. Podrás recuperarlo desde el catálogo.' : 'Se comprobará que su orden esté disponible en los tipos elegidos.', { action: 'archiveTheme', temaId: t.id, activo: !t.activo }), 'subtle', !canWrite())])]));
    }
    root.append(list);
  }
  function activeForGroup(id) { return data().assignments.filter(a => G.id(a.grupo) === id && a.activo && themeById(a.temaId)?.activo); }
  function renderGroups(root) {
    root.append(el('div', { class: 'toolbar' }, [el('h2', { textContent: 'Tus grupos' }), refreshButton()])); filters(root, false);
    const groups = sortedGroups().filter(g => !search || G.matches(g.nombre, search));
    if (!groups.length) { root.append(empty('No se han encontrado grupos', host?.groupCourses ? 'Revisa los filtros o pulsa Organizar este curso para clasificar tus grupos.' : 'Los grupos se consultan desde el catálogo de la copia.')); return; }
    root.append(el('div', { class: 'group-grid' }, groups.map(g => { const s = M.summary(activeForGroup(g.id)); return el('article', { class: 'group-card' }, [el('h3', { textContent: g.label }), el('p', { textContent: `${s.asignados} temas · ${s.realizados} ya los saben · ${s.asignados - s.realizados} por aprender · ${s.repasando} repasando` }), button('Ver repertorio', () => { view = 'repertoire'; search = ''; chooseGroup(g.id); }, '')]); })));
  }
  function renderRepertoire(root) {
    const g = currentGroup();
    if (!g) { root.append(empty(host?.groupCourses ? 'No hay grupos con estos filtros' : 'Todavía no hay grupos', host?.groupCourses ? 'Revisa los filtros o pulsa Organizar este curso. Los grupos sin clasificar conservan todo su repertorio.' : 'Primero necesitas un grupo en el catálogo de la copia.')); return; }
    const groupPicker = selectControl(sortedGroups().map(g => [g.id, g.label]), g.id, 'Seleccionar grupo', chooseGroup, 'group-picker');
    groupPicker.id = 'group-picker';
    const add = button('', assignThemes, 'primary add-themes', !canWrite()); add.setAttribute('aria-label', 'Añadir temas'); add.append(icon('plus'), el('span', { class: 'button-label', textContent: 'Añadir temas' }));
    root.append(el('div', { class: 'toolbar repertoire-toolbar' }, [el('div', { class: 'toolbar-title' }, [el('span', { class: 'picker-label', textContent: client.state().busy ? 'ACTUALIZANDO…' : 'GRUPO' }), groupPicker]), el('div', { class: 'toolbar-actions' }, [add, actionMenu('Opciones del repertorio', [['Compartir resumen', async()=>{try{const rows=ReportTools.repertoire(data().themes,data().assignments,g.nombre,G.same);await ReportTools.share(ReportTools.repertoireText(g.label,rows));}catch(error){say(error.message,true);}},false],['Descargar repertorio CSV',()=>ReportTools.download('repertorio.csv',['Orden','Tema','Tipos','Aprendizaje','Repaso','Notas'],ReportTools.repertoire(data().themes,data().assignments,g.nombre,G.same)),false],['Exportar grupos del curso',()=>{const groups=sortedGroups();ReportTools.download('grupos-del-curso.csv',['Grupo','Clasificación','Temas','Ya saben','Pendientes','Repasando'],groups.map(group=>{const s=M.summary(activeForGroup(group.id));return[group.label,host?.groupCourses?.()?.label(group)||'',s.asignados,s.realizados,s.asignados-s.realizados,s.repasando];}));},false],['Actualizar datos', () => reload(), client.state().busy], [selecting ? 'Terminar selección' : 'Seleccionar varios temas', () => { selecting = !selecting; selected.clear(); render(); }, !canWrite()]])])]));
    if (host?.groupCourses?.()) root.append(el('span', { class: 'gc-badge', textContent: host.groupCourses().label(g) }));
    const summary = M.summary(activeForGroup(g.id)); summary.pendientes = summary.asignados - summary.realizados;
    root.append(el('div', { class: 'stats', 'aria-label': 'Filtrar repertorio por estado' }, [['asignados', 'Temas', 'Temas del grupo', 'all'], ['realizados', 'Ya saben', 'Ya lo saben', 'done'], ['pendientes', 'Por aprender', 'Aún no lo saben', 'pending'], ['repasando', 'En repaso', 'Repasando', 'review']].map(([key, short, label, value]) => el('button', { type: 'button', id: 'repertoire-filter-' + value, class: 'stat stat-' + value, 'aria-label': label + ': ' + summary[key], 'aria-pressed': String(filter === value), onclick: () => { filter = value; selected.clear(); render(); } }, [el('strong', { textContent: String(summary[key]) }), el('span', { textContent: short })]))));
    root.append(el('p', { class: 'stat-note', textContent: 'Toca un estado para filtrar. También puedes repasar un tema que ya saben.' }));
    filters(root);
    const rows = data().assignments.filter(a => {
      const t = themeById(a.temaId);
      return G.id(a.grupo) === g.id && t && (archived || (a.activo && t.activo)) && matching(t) && (filter === 'all' || (filter === 'pending' && !a.realizado) || (filter === 'done' && a.realizado) || (filter === 'review' && a.repasando));
    }).sort((a, b) => sortThemes(themeById(a.temaId), themeById(b.temaId)));
    if (!rows.length) { const hasThemes = activeForGroup(g.id).length > 0; root.append(empty(hasThemes ? 'No hay temas con estos filtros' : 'Este grupo aún no tiene repertorio', hasThemes ? 'Elige otro filtro para ver los demás temas del grupo.' : 'Añade los temas que trabaja este grupo y marca los que ya sabe.', hasThemes ? null : button('Añadir temas', assignThemes, 'primary', !canWrite()))); return; }
    const eligible = rows.filter(a => a.activo && themeById(a.temaId).activo);
    if (selecting) root.append(el('div', { class: 'selection-heading' }, [checkbox('Seleccionar visibles', !!eligible.length && eligible.every(a => selected.has(a.id)), checked => { for (const a of eligible) { if (checked) selected.add(a.id); else selected.delete(a.id); } render(); }, !canWrite() || !eligible.length), button('Terminar', () => { selecting = false; selected.clear(); render(); }, 'subtle', client.state().busy)]));
    if (selected.size) root.append(el('div', { class: 'selection-bar' }, [el('span', { textContent: selected.size + (selected.size === 1 ? ' tema seleccionado' : ' temas seleccionados') + (selected.size > 50 ? ' · Selecciona como máximo 50 por lote.' : '') }), button('Marcar como repasando', () => mutate({ action: 'markForReview', ids: [...selected] }, 'Temas marcados como repasando.'), '', !canWrite() || selected.size > 50), button('Limpiar selección', () => { selected.clear(); render(); }, 'subtle', client.state().busy)]));
    const list = el('div', { class: 'list' });
    for (const a of rows) {
      const t = themeById(a.temaId), enabled = canWrite() && a.activo && t.activo;
      const pick = selecting ? el('input', { type: 'checkbox', checked: selected.has(a.id), disabled: !enabled, 'aria-label': 'Seleccionar ' + t.nombre, onchange: e => { if (e.target.checked) selected.add(a.id); else selected.delete(a.id); render(); } }) : null;
      const checks = el('div', { class: 'song-checks' }, [checkbox('Ya lo saben', a.realizado, v => mark(a.id, { realizado: v }), !enabled, 'realizado-' + a.id), checkbox('Repasando', a.repasando, v => mark(a.id, { repasando: v }), !enabled, 'repasando-' + a.id)]);
      const state = (a.realizado ? 'Ya lo saben' : 'Aún no lo saben') + (a.repasando ? ' · Repasando' : '') + (Object.keys(progress?.changes(a.id) || {}).length ? ' · Pendiente de guardar' : '');
      const name = el('div', { class: 'song-main' }, [el('div', { class: 'song-title' }, [el('span', { class: 'order', textContent: String(t.numeroOrden).padStart(2, '0') }), el('span', { textContent: t.nombre })]), tags(t), el('p', { class: 'status-copy', textContent: !a.activo ? 'Relación archivada' : !t.activo ? 'Tema archivado en el catálogo' : state })]);
      list.append(el('article', { class: 'song' + (selecting ? ' is-selecting' : '') + (a.repasando ? ' is-reviewing' : a.realizado ? ' is-learned' : ''), 'aria-label': t.nombre }, [pick, name, checks, el('div', { class: 'song-action' }, [actionMenu('Opciones de ' + t.nombre, [['Notas', () => editProgress(a), !enabled], [a.activo ? 'Archivar' : 'Recuperar', () => confirmAction(a.activo ? 'Retirar del repertorio' : 'Recuperar relación', t.nombre, 'Se conservarán sus estados y notas.', { action: 'archiveAssignment', vinculoId: a.id, activo: !a.activo }), !canWrite() || (!a.activo && !t.activo)]])])]));
    }
    root.append(list);
  }
  function field(label, name, value = '', typeName = 'text', options = {}) {
    const input = el(typeName === 'textarea' ? 'textarea' : 'input', { class: 'control', name, id: 'field-' + name, ...(typeName !== 'textarea' ? { type: typeName } : {}), value, ...options });
    return el('label', { class: 'field' + (typeName === 'textarea' ? ' full' : '') }, [el('span', { textContent: label }), input]);
  }
  const readForm = () => JSON.stringify([...new FormData(form).entries()]);
  function openDialog(title, kicker, body, submit, label = 'Guardar') {
    if (!canWrite()) return;
    draft = { submit, rebased: false }; dirty = false;
    $('dialog-title').textContent = title; $('dialog-kicker').textContent = kicker;
    $('dialog-body').replaceChildren(...body); $('dialog-error').hidden = true; $('dialog-error').replaceChildren(); $('save-dialog').textContent = label;
    $('cancel-dialog').textContent = 'Cancelar'; initialForm = readForm(); $('dirty-label').textContent = ''; dialog.showModal(); controls();
  }
  function closeDialog() {
    if (client?.state().busy) return;
    if ((dirty || progress?.state().pending) && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')) return;
    window.horasDraftVault?.remove('repertoire-form'); dialog.close(); draft = null; dirty = false;
  }
  function editTheme(t, restoredId = null) {
    const id = t?.id || restoredId || uid(); draftMeta = { type:'theme', id, existing:!!t };
    const grid = el('div', { class: 'form-grid' }, [field('Nombre del tema', 'nombre', t?.nombre || '', 'text', { required: true, maxLength: 200 }), field('Número de orden', 'numeroOrden', t?.numeroOrden || 1, 'number', { required: true, min: 1, step: 1 })]);
    const choices = el('fieldset', { class: 'fieldset field full' }, [el('legend', { textContent: 'Tipos de tema' }), el('div', { class: 'type-options' }, types.map(([k, label]) => { const check = checkbox(label, !!t?.[k], () => {}); check.querySelector('input').name = k; return check; })), el('p', { class: 'explanation', textContent: 'Puedes marcar varios. El número se aplica a todos los tipos elegidos y puede repetirse entre tipos distintos.' })]);
    grid.append(choices, field('Notas generales del tema', 'notas', t?.notas || '', 'textarea', { maxLength: 2000 }));
    openDialog(t ? 'Editar tema' : 'Nuevo tema', 'CATÁLOGO COMÚN', [grid], values => {
      let input = { id, nombre: values.get('nombre'), numeroOrden: Number(values.get('numeroOrden')), temaGaleta: values.has('temaGaleta'), temaSlap: values.has('temaSlap'), temaPropio: values.has('temaPropio'), activo: t ? t.activo : true, notas: values.get('notas') };
      if (draft.rebased && t) {
        const latest = themeById(id); if (!latest) throw Object.assign(Error('El tema ya no está disponible. Cierra el formulario y revisa el catálogo.'), { status: 409 });
        for (const key of Object.keys(input).filter(k => k !== 'id')) if (input[key] === t[key]) input[key] = latest[key];
      }
      const theme = M.theme(input);
      const other = data().themes.filter(x => x.id !== id);
      if (M.integrity([...other, theme], [], []).some(i => i.code === 'ORDER_CONFLICT')) throw Object.assign(Error('Ese número ya está ocupado dentro de uno de los tipos elegidos.'), { code: 'ORDER_CONFLICT', status: 400 });
      return { action: 'saveTheme', theme };
    });
  }
  function editProgress(a) {
    draftMeta = { type:'progress', id:a.id };
    const t = themeById(a.temaId), original = { notas: a.notas };
    const grid = el('div', { class: 'form-grid' }, [field('Notas de este grupo', 'notas', a.notas, 'textarea', { maxLength: 2000 })]);
    openDialog(t.nombre, currentGroup().label, [grid], values => {
      const changes = {}; for (const k of Object.keys(original)) if (values.get(k) !== original[k]) changes[k] = values.get(k);
      if (!Object.keys(changes).length) throw Object.assign(Error('No hay cambios en el formulario.'), { status: 400 });
      return { action: 'updateProgress', vinculoId: a.id, changes };
    });
  }
  let templateData = null;
  async function templateRequest(payload) {
    if(!authenticated())throw Error('Conecta Google para consultar las plantillas.');
    const target=new URL('/api/plantillas',new URL(endpoint,window.location.href));
    const result=await json(target.href,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(host?host.session()?.token:token)},body:JSON.stringify(payload)});
    if(result.mode!=='templates-production'||result.spreadsheetId!==C.TARGET||result.legacyModified!==false||result.calendarModified!==false||!Array.isArray(result.templates)||!/^[a-f0-9]{64}$/.test(result.version))throw Error('No se pudo verificar la plantilla. Actualiza antes de repetir.');
    templateData=result;return result;
  }
  function assignThemes() {
    const g = currentGroup(); if (!g) return; draftMeta = {type:'assign', groupId:g.id};
    const choices = new Set(), ids = new Map(), candidates = data().themes.filter(t => t.activo && !data().assignments.some(a => G.id(a.grupo) === g.id && a.temaId === t.id && a.activo)).sort(sortThemes);
    const list = el('div', { class: 'assign-list' });
    const presets = el('details', {class:'template-options'},[el('summary',{textContent:'Usar una plantilla o el repertorio de otro grupo'})]);
    const templateStatus=el('p',{class:'explanation',role:'status'}),savedTemplates=el('div',{class:'template-list'});
    function chooseTemplate(ids){const available=RepertoireTemplates.candidates(ids,data().themes,data().assignments,g.nombre,G.same);choices.clear();for(const id of available)choices.add(id);dirty=!!choices.size;fill();if(dirty)persistForm();else window.horasDraftVault?.remove('repertoire-form');templateStatus.textContent=available.length+' temas preparados para revisar. Solo se copian temas; los estados aprendidos no se copian.';}
    for(const preset of RepertoireTemplates.builtins(data().themes))presets.append(button(preset.nombre,()=>chooseTemplate(preset.temaIds),'subtle'));
    presets.append(selectControl([['','Copiar temas de otro grupo…'],...data().groups.filter(other=>other.id!==g.id).sort((a,b)=>a.label.localeCompare(b.label,'es')).map(other=>[other.id,other.label])],'','Grupo del que copiar temas',id=>{if(id)chooseTemplate(data().assignments.filter(a=>G.id(a.grupo)===id&&a.activo).map(a=>a.temaId));}));
    const name=el('input',{class:'control',placeholder:'Nombre de la plantilla personalizada',maxLength:100,'aria-label':'Nombre de plantilla'});
    function showSaved(){savedTemplates.replaceChildren();for(const t of templateData?.templates.filter(t=>t.activo)||[])savedTemplates.append(el('div',{},[button(t.nombre,()=>chooseTemplate(t.temaIds)),button('Archivar '+t.nombre,async()=>{try{await templateRequest({action:'save',template:{id:t.id,nombre:t.nombre,temaIds:t.temaIds,activo:false},expectedVersion:templateData.version});showSaved();templateStatus.textContent='Plantilla archivada y verificada.';}catch(e){templateData=null;templateStatus.textContent=e.message;}},'subtle')]));}
    presets.append(button('Cargar o actualizar plantillas guardadas',async()=>{try{await templateRequest({action:'load'});showSaved();templateStatus.textContent='Plantillas actualizadas.';}catch(e){templateData=null;templateStatus.textContent=e.message;}}),savedTemplates,name,button('Guardar selección como plantilla',async()=>{if(!choices.size||choices.size>50||!name.value.trim()){templateStatus.textContent='Escribe un nombre y selecciona entre 1 y 50 temas.';return;}try{if(!templateData)await templateRequest({action:'load'});await templateRequest({action:'save',template:{id:uid(),nombre:name.value.trim(),temaIds:[...choices],activo:true},expectedVersion:templateData.version});showSaved();templateStatus.textContent='Plantilla guardada y verificada. No se ha cambiado el repertorio del grupo.';}catch(e){templateData=null;templateStatus.textContent=e.message;}}),templateStatus);
    if(templateData)showSaved();
    const filterText = el('input', { class: 'control', type: 'search', placeholder: 'Buscar temas para añadir…', 'aria-label': 'Buscar temas para añadir' });
    const typeFilter = selectControl([['', 'Todos los tipos'], ...types], '', 'Tipo para asignar', () => fill());
    function fill() {
      list.replaceChildren();
      const visible = candidates.filter(t => (!typeFilter.value || t[typeFilter.value]) && (!filterText.value || G.normalize(t.nombre).includes(G.normalize(filterText.value))));
      for (const t of visible) {
        const recovering = data().assignments.some(a => G.id(a.grupo) === g.id && a.temaId === t.id && !a.activo);
        list.append(el('label', { class: 'assign-option' }, [el('input', { type: 'checkbox', name: 'assign-choice', value: t.id, checked: choices.has(t.id), onchange: e => { if (e.target.checked) choices.add(t.id); else choices.delete(t.id); dirty = true; $('dirty-label').textContent = choices.size + ' temas seleccionados'; } }), el('span', { textContent: `${t.numeroOrden}. ${t.nombre}` }, [el('small', { textContent: types.filter(([k]) => t[k]).map(([, label]) => label).join(' · ') + (recovering ? ' · Recuperará el seguimiento anterior' : '') })]) ]));
      }
      if (!visible.length) list.append(el('p', { class: 'explanation', textContent: 'No quedan temas disponibles con este filtro.' }));
    }
    filterText.oninput = fill;
    fill();
    openDialog('Añadir temas', g.label, [el('p', { class: 'explanation', textContent: 'Después de añadirlos, marca los que ya sabe el grupo. Los temas recuperados conservan sus estados anteriores.' }), presets, filterText, typeFilter, list], () => {
      if (!choices.size || choices.size > 50) throw Object.assign(Error('Selecciona entre 1 y 50 temas.'), { status: 400 });
      for (const id of choices) if (!ids.has(id)) ids.set(id, uid());
      return { action: 'assignThemes', grupo: g.nombre, assignments: [...choices].map(temaId => ({ id: ids.get(temaId), temaId })) };
    }, 'Añadir seleccionados');
  }
  function confirmAction(title, name, explanation, payload) { openDialog(title, name, [el('p', { class: 'explanation', textContent: explanation })], () => payload, title.startsWith('Recuperar') ? 'Recuperar' : 'Archivar'); }
  function persistForm() { if (!recoveringForm && dirty && draftMeta) window.horasDraftVault?.save('repertoire-form', { ...draftMeta, values:[...new FormData(form).entries()] }); }
  async function recoverForm(record) {
    await reload(true); if (!client.state().canWrite) return;
    recoveringForm = true;
    try {
      if(record.type==='theme'){const theme=themeById(record.id);if(record.existing&&!theme)throw Error('El tema ya no está disponible.');editTheme(theme,record.id);}
      else if(record.type==='progress'){const a=data().assignments.find(a=>a.id===record.id);if(!a)throw Error('La relación ya no está disponible.');groupId=G.id(a.grupo);host?.groupCourses?.()?.revealGroup(groupId);editProgress(a);}
      else if(record.type==='assign'){groupId=record.groupId;host?.groupCourses?.()?.revealGroup(groupId);if(!currentGroup())throw Error('El grupo ya no está disponible.');assignThemes();}else throw Error('Borrador no válido.');
      const values=Array.isArray(record.values)?record.values:[];
      for(const n of form.querySelectorAll('input[name],select[name],textarea[name]')){const matches=values.filter(([k])=>k===n.name);if(n.type==='checkbox'){n.checked=n.name==='assign-choice'?matches.some(([,v])=>v===n.value):!!matches.length;n.dispatchEvent(new Event('change',{bubbles:true}));}else if(matches.length)n.value=String(matches[0][1]);}
      dirty=true;$('dirty-label').textContent='Borrador recuperado. Revisa antes de guardar.';
    }catch(error){say(error.message,true);}finally{recoveringForm=false;persistForm();}
  }
  form.oninput = () => { dirty = readForm() !== initialForm; $('dirty-label').textContent = dirty ? 'Cambios sin guardar' : ''; persistForm(); };
  form.onchange = form.oninput;
  form.onsubmit = async e => {
    e.preventDefault(); if (!draft || client.state().busy || progress?.state().pending) return;
    try {
      const payload = draft.submit(new FormData(form));
      await client.save(payload); window.horasDraftVault?.remove('repertoire-form'); dialog.close(); draft = null; dirty = false; selected.clear(); render(); say('Cambios guardados y verificados.');
    } catch (error) {
      const errorBox = $('dialog-error'); errorBox.hidden = false; errorBox.replaceChildren(document.createTextNode(message(error)));
      if (client.state().needsReload) errorBox.append(button('Actualizar y conservar formulario', () => reload(true)));
      if (error.status === 401) errorBox.append(button('Reconectar Google', () => $('connect').click()));
      say(message(error), true); controls();
    }
  };
  $('close-dialog').onclick = closeDialog; $('cancel-dialog').onclick = closeDialog;
  dialog.addEventListener('cancel', e => { e.preventDefault(); closeDialog(); });
  root.querySelectorAll('.tabs button').forEach(b => { b.onclick = () => { if (client?.state().busy) return; view = b.dataset.tab; search = ''; type = ''; filter = 'all'; archived = false; selected.clear(); selecting = false; render(); window.scrollTo(0, 0); }; });
  root.addEventListener('click', e => { root.querySelectorAll('.action-menu[open]').forEach(menu => { if (!menu.contains(e.target)) menu.open = false; }); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') root.querySelectorAll('.action-menu[open]').forEach(menu => { menu.open = false; }); });
  window.addEventListener('beforeunload', e => { if (dirty || client?.state().busy || progress?.state().pending) { e.preventDefault(); e.returnValue = ''; } });
  $('disconnect').onclick = () => { if (client?.state().busy || ((dirty || progress?.state().pending) && !window.confirm('Hay cambios sin guardar. ¿Quieres desconectar y descartarlos?'))) return; if (dialog.open) dialog.close(); token = ''; expires = 0; draft = null; dirty = false; progress?.discard(); selected.clear(); client.clear(); say('Sesión cerrada.'); };
  async function prepareOAuth() {
    const config = await json(endpoint + '?api=oauth');
    if (config.sessionKey !== 'horas-repertoire-' + page.profile + '-token' || config.scopes !== 'https://www.googleapis.com/auth/spreadsheets') throw Error('Sesión de repertorio no reconocida.');
    if (!window.google?.accounts?.oauth2) await new Promise((resolve, reject) => { const script = el('script', { src: 'https://accounts.google.com/gsi/client', onload: resolve, onerror: () => reject(Error('No se pudo cargar el acceso de Google.')) }); document.head.append(script); });
    oauthClient = window.google.accounts.oauth2.initTokenClient({ client_id: config.clientId, scope: config.scopes, include_granted_scopes: false,
      callback: async r => { connecting = false; const seconds = Number(r.expires_in); if (r.error || !r.access_token || !Number.isFinite(seconds) || seconds <= 30 || !(r.scope || '').split(' ').includes(config.scopes)) { say(r.error || 'Falta el permiso de Sheets.', true); controls(); return; } token = r.access_token; expires = Date.now() + (seconds - 30) * 1000; await reload(true); },
      error_callback: error => { connecting = false; controls(); const kind = error?.type || 'unknown'; say(kind === 'popup_failed_to_open' ? 'Google no ha podido abrir su ventana. Abre este acceso en Chrome y vuelve a pulsar Conectar Google.' : kind === 'popup_closed' ? 'La ventana de Google se ha cerrado antes de completar la conexión.' : 'No se pudo completar la conexión con Google (' + kind + ').', true); }
    });
  }
  $('connect').onclick = async () => {
    if (host) return host.connect();
    if (connecting) return; connecting = true; controls();
    let awaitingGoogle = false;
    try {
      if (env.preview) { const session = await json('/api/preview-session'); token = session.token; expires = Date.now() + 3600000; await reload(true); return; }
      if (!oauthClient) { await prepareOAuth(); say('Google está preparado. Vuelve a pulsar Conectar Google.'); return; }
      // Called synchronously within the click gesture, after SDK/config initialization.
      oauthClient.requestAccessToken({ prompt: '' });
      awaitingGoogle = true;
    } catch (error) { say(error.message, true); } finally { if (!awaitingGoogle) connecting = false; controls(); }
  };
  async function refreshSession() {
    if (!host || !client || client.state().busy) return;
    if (progress?.state().pending) { controls(); return; }
    const shared = host.session();
    if (!shared) { token = ''; expires = 0; controls(); return; }
    const changed = token !== shared.token; token = shared.token; expires = shared.expires;
    if (changed || !data()) await reload(true); else controls();
  }
  const ready = json(endpoint + '?api=environment').then(async e => {
    env = C.verifyEnvironment(e); client = C.create({ transport, writeEnabled: env.writeEnabled && env.progressBatch === true, onChange: render });
    progress = C.createProgressQueue({ client, onChange: () => { const vault = window.horasDraftVault; if (vault) { if (progress.state().pending) vault.save('repertoire-marks', progress.entries()); else vault.remove('repertoire-marks'); } render(); } });
    if (env.preview) { $('mode-badge').textContent = 'SIMULACIÓN'; $('copy-link').hidden = true; $('connect').textContent = 'Abrir simulación'; say('Datos ficticios en memoria. Esta vista no escribe en Google Sheets.'); }
    else if (!host) prepareOAuth().catch(error => say(error.message, true));
    if (host) { render(); await refreshSession(); }
    if (env.writeEnabled && !env.progressBatch) say('El guardado agrupado se está actualizando. Recarga en unos instantes para habilitar los cambios.');
    controls();
  }).catch(error => say(error.message, true));
  let courseSubscribed = false;
  const subscribeCourses = () => { const courses = host?.groupCourses?.(); if (courses && !courseSubscribed) { courseSubscribed = true; const style = el('link', { rel: 'stylesheet', href: 'group-courses.css?v=improvements-20261122' }); root.append(style); courses.subscribe(render); render(); } };
  if (host?.groupCourses) { subscribeCourses(); window.addEventListener('group-courses-ready', subscribeCourses); }
  return { ready, refreshSession, refreshData: () => reload(true), groupId: () => groupId };
  };
  if (document.getElementById('editor') && !document.getElementById('repertoire-template')) window.mountRepertoire();
})();
