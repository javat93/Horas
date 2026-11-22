(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./group-identity.js') : root.GroupIdentity);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.GroupCourses = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(G) {
  'use strict';
  const TARGET = '1sjXj8LYRWHNCp9X43nl-Cn5LSFLcFy42j2QB24Zxh60', SHEET_ID = 155111503;
  const HEADERS = ['IdGrupo', 'Grupo', 'Curso', 'Activo', 'Tipo', 'ActualizadoEn'];
  function fail(message, code = 'INVALID_INPUT', status = 400) { throw Object.assign(Error(message), { code, status }); }
  function course(value) { if (typeof value !== 'string' || !/^(19|20|21)\d{2}–(19|20|21)\d{2}$/.test(value) || +value.slice(5) !== +value.slice(0, 4) + 1) fail('Curso escolar no válido.'); return value; }
  function currentCourse(date = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' }).formatToParts(date).map(p => [p.type, p.value]));
    const start = +parts.year - (+parts.month < 9 ? 1 : 0); return `${start}–${start + 1}`;
  }
  function previous(value) { course(value); const year = +value.slice(0, 4) - 1; return `${year}–${year + 1}`; }
  const key = r => r.curso + '|' + r.id;
  function classification(records, group, curso) { const id = typeof group === 'string' ? G.id(group) : group.id || G.id(group.nombre); return records.find(r => r.id === id && r.curso === curso) || null; }
  function filter(groups, records, filters) {
    return groups.filter(g => { const r = classification(records, g, filters.curso); return (filters.estado === 'all' || (filters.estado === 'unclassified' ? !r : !!r && r.activo === (filters.estado === 'active'))) && (filters.tipo === 'all' || (!!r && r.tipo === filters.tipo)); })
      .slice().sort((a, b) => G.catalogLabel(a.nombre).localeCompare(G.catalogLabel(b.nombre), 'es', { sensitivity: 'base', numeric: true }));
  }
  function sessionGroups(groups, records, selected = '', all = false, curso = currentCourse()) {
    const selectedId = G.id(selected);
    return groups.filter(g => { const r = classification(records, g, curso); return all || G.id(g.nombre) === selectedId || !!r && r.activo && r.tipo === 'habitual'; }).slice().sort((a,b)=>G.catalogLabel(a.nombre).localeCompare(G.catalogLabel(b.nombre),'es',{sensitivity:'base',numeric:true}));
  }
  function copyPrevious(groups, records, curso) {
    return groups.flatMap(g => { const r = classification(records, g, previous(curso)); return r && !classification(records, g, curso) ? [{ grupo: g.nombre, activo: r.activo, tipo: r.tipo }] : []; });
  }
  function validateUpdates(updates) {
    if (!Array.isArray(updates) || !updates.length || updates.length > 100) fail('Selecciona entre 1 y 100 grupos.');
    const ids = new Set();
    for (const r of updates) {
      if (!r || Object.keys(r).some(k => !['grupo', 'activo', 'tipo'].includes(k)) || typeof r.grupo !== 'string' || !r.grupo.trim() || r.grupo.length > 200 || typeof r.activo !== 'boolean' || !['habitual', 'puntual'].includes(r.tipo)) fail('Clasificación de grupo no válida.');
      const id = G.id(r.grupo); if (ids.has(id)) fail('Grupo repetido.'); ids.add(id);
    }
  }
  function createStore({ transport, environment, onChange = () => {} }) {
    let data = null, busy = false, needsReload = false, error = null, loading = null;
    const state = () => ({ data, busy, needsReload, error, canWrite: !!data && !busy && !needsReload && !data.issues.length });
    const verify = d => { if (d?.mode !== 'group-courses-production' || d.spreadsheetId !== TARGET || d.legacyModified !== false || d.calendarModified !== false || !/^[a-f0-9]{64}$/.test(d.version) || !['groups', 'records', 'issues'].every(k => Array.isArray(d[k]))) fail('No se ha podido verificar la organización por curso.', 'UNVERIFIED_RESPONSE', 502); return d; };
    function notify() { onChange(state()); }
    async function load(force = false) {
      if (loading) return loading; if (busy) fail('Espera al guardado.'); if (data && !force) return data;
      loading = (async () => { busy = true; error = null; notify(); try {
        const e = await environment(); if (e.mode !== 'group-courses-production' || e.spreadsheetId !== TARGET || e.sheetId !== SHEET_ID || e.calendarAccess !== false || e.writeEnabled !== true || JSON.stringify(e.writableSheets) !== JSON.stringify(['GruposCurso'])) fail('Destino de cursos no verificado.');
        data = verify(await transport({ action: 'load' })); needsReload = false; return data;
      } catch (e) { error = e; needsReload = true; throw e; } finally { busy = false; loading = null; notify(); } })(); return loading;
    }
    async function save(curso, updates) {
      course(curso); validateUpdates(updates); if (!state().canWrite) fail('Actualiza y revisa antes de guardar.');
      busy = true; error = null; notify(); try { data = verify(await transport({ action: 'save', curso, updates, expectedVersion: data.version })); return data; }
      catch (e) { error = e; needsReload = true; throw e; } finally { busy = false; notify(); }
    }
    return { state, load, save, clear() { if (!busy) { data = null; needsReload = false; error = null; notify(); } } };
  }
  return { TARGET, SHEET_ID, HEADERS, fail, course, currentCourse, previous, key, classification, filter, sessionGroups, copyPrevious, validateUpdates, createStore };
});
