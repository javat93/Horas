(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./group-identity.js'), require('./locale-data.js'));
  else root.RepertoireModel = factory(root.GroupIdentity, root.LocaleData);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G, D) {
  'use strict';
  const TYPE_FIELDS = Object.freeze(['temaGaleta', 'temaSlap', 'temaPropio']);
  const THEME_FIELDS = Object.freeze(['id', 'nombre', 'numeroOrden', ...TYPE_FIELDS, 'activo', 'notas']);
  const ASSIGNMENT_FIELDS = Object.freeze(['id', 'grupo', 'temaId', 'realizado', 'repasando', 'fechaRealizado', 'ultimoRepaso', 'proximoObjetivo', 'motivoRepaso', 'notas', 'actualizadoEn', 'activo']);
  const HEADERS = Object.freeze({
    Temas: Object.freeze(['TemaID', 'Nombre', 'NumeroOrden', 'TemaGaleta', 'TemaSlap', 'TemaPropio', 'Activo', 'Notas']),
    GrupoTemas: Object.freeze(['VinculoID', 'Grupo', 'TemaID', 'NombreTema', 'Realizado', 'Repasando', 'FechaRealizado', 'UltimoRepaso', 'ProximoObjetivo', 'MotivoRepaso', 'Notas', 'ActualizadoEn', 'Activo'])
  });
  function fail(message, code = 'INVALID_INPUT', status = 400) { throw Object.assign(new Error(message), { code, status }); }
  function object(value, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) fail('Campos no permitidos.');
    return value;
  }
  function text(value, max = 2000, required = false) {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('Texto no válido.');
    value = value.trim();
    if (required && !value) fail('Falta un texto obligatorio.');
    return value;
  }
  function uuid(value) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) fail('Identificador UUID no válido.');
    return value;
  }
  function bool(value) { if (typeof value !== 'boolean') fail('Se requiere un booleano real.'); return value; }
  function date(value) { if (value === '') return ''; if (typeof value !== 'string' || !D.validISO(value)) fail('Fecha ISO no válida.'); return value; }
  function theme(input) {
    object(input, THEME_FIELDS);
    const out = { id: uuid(input.id), nombre: text(input.nombre, 200, true), numeroOrden: input.numeroOrden };
    if (!Number.isSafeInteger(out.numeroOrden) || out.numeroOrden < 1) fail('El orden debe ser un entero positivo.');
    for (const field of [...TYPE_FIELDS, 'activo']) out[field] = bool(input[field]);
    out.notas = text(input.notas === undefined ? '' : input.notas);
    if (out.activo && !TYPE_FIELDS.some(f => out[f])) fail('Un tema activo debe tener al menos un tipo.');
    return out;
  }
  function assignment(input) {
    object(input, ASSIGNMENT_FIELDS);
    text(input.grupo, 200, true);
    // Preserve the exact Coles label, including historical trailing spaces, for native validation.
    const out = { id: uuid(input.id), grupo: input.grupo, temaId: uuid(input.temaId) };
    for (const field of ['realizado', 'repasando', 'activo']) out[field] = bool(input[field]);
    for (const field of ['fechaRealizado', 'ultimoRepaso']) out[field] = date(input[field]);
    for (const field of ['proximoObjetivo', 'motivoRepaso', 'notas']) out[field] = text(input[field]);
    out.actualizadoEn = text(input.actualizadoEn, 40);
    if (out.actualizadoEn && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(out.actualizadoEn) || !D.validISO(out.actualizadoEn.slice(0, 10)) || new Date(out.actualizadoEn).toISOString() !== out.actualizadoEn)) fail('Fecha de actualización no válida.');
    return out;
  }
  function group(groups, name) {
    text(name, 200, true);
    const found = groups.filter(g => G.same(g, name));
    if (found.length !== 1) fail(found.length ? 'Grupo ambiguo en Coles.' : 'El grupo ya no existe en Coles.', 'INVALID_GROUP', 409);
    return found[0];
  }
  const assignmentKey = a => G.id(a.grupo) + '|' + a.temaId;
  function integrity(themes, assignments, groups) {
    const issues = [], themeIds = new Set(), assignmentIds = new Set(), keys = new Set(), orders = new Map();
    for (const t of themes) {
      if (themeIds.has(t.id)) issues.push({ code: 'DUPLICATE_THEME_ID', id: t.id });
      themeIds.add(t.id);
      if (t.activo) for (const type of TYPE_FIELDS.filter(f => t[f])) {
        const key = type + ':' + t.numeroOrden;
        if (orders.has(key)) issues.push({ code: 'ORDER_CONFLICT', id: t.id, otherId: orders.get(key), type, order: t.numeroOrden });
        orders.set(key, t.id);
      }
    }
    const groupIds = new Set();
    for (const g of groups) { const key = G.id(g); if (groupIds.has(key)) issues.push({ code: 'AMBIGUOUS_GROUP', grupo: g }); groupIds.add(key); }
    for (const a of assignments) {
      if (assignmentIds.has(a.id)) issues.push({ code: 'DUPLICATE_ASSIGNMENT_ID', id: a.id });
      assignmentIds.add(a.id);
      const key = assignmentKey(a);
      if (keys.has(key)) issues.push({ code: 'DUPLICATE_ASSIGNMENT', id: a.id });
      keys.add(key);
      if (!themeIds.has(a.temaId)) issues.push({ code: 'ORPHAN_THEME', id: a.id });
      try { group(groups, a.grupo); } catch (e) { issues.push({ code: e.code, id: a.id }); }
    }
    return issues;
  }
  function value(cell) {
    const v = cell?.userEnteredValue || cell?.effectiveValue || {};
    return v.boolValue ?? v.numberValue ?? v.stringValue ?? '';
  }
  function placeholder(row, booleanColumns) {
    return row.every((cell, i) => (i === 3 && booleanColumns.includes(12) && !!cell?.userEnteredValue?.formulaValue) || (!cell?.userEnteredValue?.formulaValue && (value(cell) === '' || (booleanColumns.includes(i) && value(cell) === false))));
  }
  function fromCells(sheets) {
    const issues = [], themes = [], assignments = [];
    for (const name of ['Temas', 'GrupoTemas']) {
      const rows = sheets[name];
      if (!Array.isArray(rows) || HEADERS[name].some((h, i) => value(rows[0]?.[i]) !== h)) fail('Cabeceras no reconocidas: ' + name, 'SCHEMA_MISMATCH', 409);
      rows.slice(1).forEach((row, i) => {
        if (placeholder(row, name === 'Temas' ? [3, 4, 5, 6] : [4, 5, 12])) return;
        const rowIdx = i + 2;
        try {
          if (!value(row[0])) fail('Fila parcial sin ID: revisar antes de importar.', 'IMPORT_CANDIDATE');
          if (row.some((c, j) => c?.userEnteredValue?.formulaValue && !(name === 'GrupoTemas' && j === 3))) fail('Fórmula en un campo de entrada.', 'INPUT_FORMULA');
          const v = row.map(value);
          if (name === 'Temas') themes.push({ ...theme({ id: v[0], nombre: v[1], numeroOrden: v[2], temaGaleta: v[3], temaSlap: v[4], temaPropio: v[5], activo: v[6], notas: v[7] ?? '' }), rowIdx });
          else {
            const asDate = x => x === '' ? '' : typeof x === 'number' ? D.fromSerial(x) || fail('Fecha numérica no válida.') : date(x);
            // ActualizadoEn is an ISO string written by this module, not an audit guarantee.
            assignments.push({ ...assignment({ id: v[0], grupo: v[1], temaId: v[2], realizado: v[4], repasando: v[5], fechaRealizado: asDate(v[6] ?? ''), ultimoRepaso: asDate(v[7] ?? ''), proximoObjetivo: v[8] ?? '', motivoRepaso: v[9] ?? '', notas: v[10] ?? '', actualizadoEn: v[11] ?? '', activo: v[12] }), rowIdx });
          }
        } catch (error) { issues.push({ sheet: name, rowIdx, code: error.code || 'INVALID_ROW', message: error.message }); }
      });
    }
    return { themes, assignments, issues };
  }
  function state(a) { return a.realizado ? (a.repasando ? 'Realizado · En repaso' : 'Realizado') : (a.repasando ? 'Repasando para completar' : 'Pendiente'); }
  function summary(assignments) { return { asignados: assignments.length, realizados: assignments.filter(a => a.realizado).length, repasando: assignments.filter(a => a.repasando).length }; }
  return { TYPE_FIELDS, THEME_FIELDS, ASSIGNMENT_FIELDS, HEADERS, fail, object, text, uuid, bool, date, theme, assignment, group, assignmentKey, integrity, value, placeholder, fromCells, state, summary };
});
