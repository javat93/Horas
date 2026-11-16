const { test } = require('node:test'), assert = require('node:assert/strict');
const I = require('../repertoire-integration.js'), C = require('../protected-config.js');
const config = C.create('production');
test('reutiliza la sesión principal sin conectar ni persistir otra sesión y lee su renovación', () => {
  let current = { token: 'session-one', expiresAt: Date.now() + 3600000, expired: false }, connections = 0, reads = 0;
  const shared = I.createSession({ config, read: () => current, accessToken: () => { reads++; return current.token; }, connect: () => { connections++; } });
  assert.equal(shared.session().token, 'session-one');
  current = { ...current, token: 'session-renewed' };
  assert.equal(shared.session().token, 'session-renewed');
  assert.equal(connections, 0); assert.equal(reads, 2);
  shared.connect(); assert.equal(connections, 1);
});
test('rechaza sesión vacía, vencida, sin caducidad, incompatible o invalidada por el principal', () => {
  for (const current of [{ token: '' }, { token: 'old', expiresAt: Date.now()-1 }, { token: 'old', expired: true, expiresAt: Date.now()+3600000 }, { token: 'legacy', expiresAt: null }]) {
    const shared=I.createSession({ config, read: () => current, accessToken: () => current.token, connect: () => assert.fail('No debe abrir OAuth automáticamente') });
    assert.equal(shared.session(), null);
  }
  for (const accessToken of [() => 'different-token', () => { throw Error('invalid session'); }]) {
    const shared=I.createSession({ config, read: () => ({token:'stored',expiresAt:Date.now()+3600000}), accessToken, connect() {} });
    assert.equal(shared.session(), null);
  }
});
test('no reutiliza conexiones de desarrollo, otro libro ni permisos sin Sheets', () => {
  let reads=0;
  for (const bad of [C.create('test'),C.create('rehearsal'),{...config,SPREADSHEET_ID:'other'},{...config,SCOPES:'https://www.googleapis.com/auth/calendar.events.owned'}]) {
    assert.throws(() => I.createSession({config:bad,read(){reads++;},accessToken(){},connect(){}}));
  }
  assert.equal(reads,0);
});
test('los enlaces de grupo conservan identidad, caracteres y ruta integrada', () => {
  for (const group of ['nombre:slap lunes','nombre:la maquinista','nombre:àngels & diables']) {
    assert.equal(I.groupFromHash(I.repertoireHash(group)),group);
    assert.equal(I.groupFromHash('#grupo='+encodeURIComponent(group)),group);
  }
  assert.equal(I.repertoireHash(),'#repertorio');
});
