// Функциональный smoke-тест DB.scoreboard для провайдеров pocketbase и firebase
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadSandbox(provider) {
  const sandbox = { console, setTimeout, setInterval, clearInterval, clearTimeout, Date, JSON, Promise, Object, Array, isNaN, parseInt, String, Number };
  sandbox.global = sandbox;
  vm.createContext(sandbox);

  let cfg = fs.readFileSync(path.join(__dirname, 'js/db-config.js'), 'utf8');
  cfg = cfg.replace("provider: 'firebase'", "provider: '" + provider + "'");
  // убираем node-ветку (require credentials) — не нужна для теста
  cfg = cfg.replace(/if \(typeof module[\s\S]*?\n}\n/, '');
  vm.runInContext(cfg, sandbox);

  const iface = fs.readFileSync(path.join(__dirname, 'js/db-interface.js'), 'utf8');
  vm.runInContext(iface, sandbox);
  return sandbox;
}

function assert(cond, msg) {
  if (!cond) { console.error('FAIL: ' + msg); process.exitCode = 1; }
  else { console.log('OK: ' + msg); }
}
(async function main() {
  // ============ POCKETBASE ============
  {
    const sandbox = loadSandbox('pocketbase');

    const records = {};   // systemId -> data
    const listeners = []; // {collection, topic, cb}
    let sysCounter = 0;

    class FakeRecord {
      // shadowId=true — эмуляция затенения кастомного поля 'id' системным
      constructor(data, shadowId) {
        this._shadow = shadowId !== false;
        this._sys = data.__sysId; delete data.__sysId;
        this._customId = data.id; delete data.id;
        Object.assign(this, data);
      }
      get(field) {
        if (field === undefined) {
          const o = {};
          for (const k in this) { if (typeof this[k] !== 'function') o[k] = this[k]; }
          return o;
        }
        if (field === 'id') return this._shadow ? this._sys : this._customId;
        return this[field];
      }
      get id() { return this._sys; }
    }

    sandbox.global.PocketBase = class {
      constructor() { this.autoCancellation = true; }
      collection(name) {
        return {
          getFirstListItem: (filter) => {
            const m = filter.match(/^id="(.*)"$/);
            const found = Object.keys(records).map(k => records[k]).filter(d => d.id === (m ? m[1] : null))[0];
            return found ? Promise.resolve(new FakeRecord(JSON.parse(JSON.stringify(found)))) : Promise.reject(new Error('404'));
          },
          update: (sysId, data) => {
            if (!records[sysId]) return Promise.reject(new Error('404'));
            Object.keys(data).forEach(k => {
              if (data[k] === null && records[sysId][k] !== undefined) records[sysId][k] = null;
              else records[sysId][k] = data[k];
            });
            return Promise.resolve(new FakeRecord(JSON.parse(JSON.stringify(records[sysId]))));
          },
          create: (data) => {
            const sysId = 'sys' + (++sysCounter);
            records[sysId] = Object.assign({}, data, { __sysId: sysId });
            return Promise.resolve(new FakeRecord(JSON.parse(JSON.stringify(records[sysId]))));
          },
          subscribe: (topic, cb) => { listeners.push({ collection: name, topic, cb }); return Promise.resolve(); },
          unsubscribe: () => Promise.resolve()
        };
      }
    };
    // --- тесты записи ---
    await sandbox.DB.scoreboard.update('game1', { home_score: 5, show: 1 });
    const created = Object.values(records)[0];
    assert(created && created.id === 'game1', 'PB: upsert создал запись с кастомным id=game1');
    assert(created.home_score === 5, 'PB: home_score=5 записан');

    await sandbox.DB.scoreboard.update('game1', { home_score: 10 });
    assert(Object.values(records)[0].home_score === 10, 'PB: home_score=10 обновлён по кастомному id');

    await sandbox.DB.scoreboard.update('game1', { show: 2, show_before_timeout: sandbox.DB.deleteField() });
    const afterDel = Object.values(records)[0];
    assert(afterDel.show === 2, 'PB: show=2 записан');
    assert(afterDel.show_before_timeout === null, 'PB: deleteField -> show_before_timeout занулено');

    // --- тесты подписки ---
    let got = null;
    sandbox.DB.scoreboard.subscribe('game1', (data) => { got = data; });
    await new Promise(r => setTimeout(r, 20));
    const sub = listeners.find(l => l.collection === 'volleyball' && l.topic === '*');
    assert(!!sub, 'PB: подписка на volleyball/* зарегистрирована');
    assert(got && got.home_score === 10, 'PB: первичная загрузка данных при подписке');

    const sysId = Object.keys(records)[0];
    // Кастомный id доступен в событии (shadowId=false) — прямая доставка
    sub.cb({ action: 'update', record: new FakeRecord(JSON.parse(JSON.stringify(Object.assign({}, records[sysId], { home_score: 11 }))), false) });
    await new Promise(r => setTimeout(r, 20));
    assert(got && got.home_score === 11, 'PB: событие с кастомным id доставлено');

    got = null;
    const foreignRec = new FakeRecord(JSON.parse(JSON.stringify(Object.assign({}, records[sysId], { home_score: 12 }))));
    foreignRec._sys = 'zzz_other'; // чужая запись: кастомный id недоступен, системный не совпадает
    sub.cb({ action: 'update', record: foreignRec });
    await new Promise(r => setTimeout(r, 60));
    assert(got === null, 'PB: чужая запись (другой системный id) не доставлена');

    got = null;
    const ourRec = new FakeRecord(JSON.parse(JSON.stringify(Object.assign({}, records[sysId], { home_score: 13 }))));
    ourRec._sys = sysId; // наша запись, но кастомный id затенён -> путь фолбэка
    sub.cb({ action: 'update', record: ourRec });
    await new Promise(r => setTimeout(r, 60));
    // Фолбэк перепроверяет запись запросом к серверу и доставляет АКТУАЛЬНОЕ состояние из БД
    assert(got !== null && got.home_score === 10, 'PB: запись игры с затенённым id доставлена через фолбэк (данные из БД)');
  }

  // ============ FIREBASE ============
  {
    const sandbox = loadSandbox('firebase');

    const docs = {};
    const listeners = [];
    const fvDelete = { __delete: true };

    const fbApi = {
      FieldValue: { serverTimestamp: () => ({ __ts: true }), delete: () => fvDelete }
    };
    sandbox.global.firebase = {
      apps: [],
      initializeApp: () => {},
      firestore: Object.assign(() => ({
        collection: (name) => ({
          doc: (id) => ({
            set: (data) => {
              docs[id] = Object.assign({}, docs[id] || {});
              Object.keys(data).forEach(k => {
                if (data[k] === fvDelete) delete docs[id][k];
                else docs[id][k] = data[k];
              });
              return Promise.resolve();
            },
            get: () => Promise.resolve({ exists: !!docs[id], data: () => docs[id] ? JSON.parse(JSON.stringify(docs[id])) : null }),
            onSnapshot: (cb) => { listeners.push({ collection: name, doc: id, cb }); return () => {}; }
          })
        })
      }), fbApi)
    };

    await sandbox.DB.scoreboard.update('game1', { home_score: 5, show: 1, show_before_timeout: 2 });
    assert(docs['game1'] && docs['game1'].home_score === 5, 'FB: upsert создал документ с home_score=5');
    assert(docs['game1'].show_before_timeout === 2, 'FB: show_before_timeout=2 записан');

    await sandbox.DB.scoreboard.update('game1', { show: 2, show_before_timeout: sandbox.DB.deleteField() });
    assert(docs['game1'].show === 2, 'FB: show=2 записан');
    assert(!('show_before_timeout' in docs['game1']), 'FB: deleteField удалил show_before_timeout');

    let got = null;
    sandbox.DB.scoreboard.subscribe('game1', (data) => { got = data; });
    const sub = listeners.find(l => l.collection === 'volleyball1' && l.doc === 'game1');
    assert(!!sub, 'FB: подписка на volleyball1/game1 зарегистрирована');
    docs['game1'].home_score = 20;
    sub.cb({ exists: true, data: () => JSON.parse(JSON.stringify(docs['game1'])) });
    assert(got && got.home_score === 20, 'FB: onSnapshot доставил данные подписчику');

    let got2 = 'init';
    sandbox.DB.scoreboard.subscribe('missing', (data) => { got2 = data; });
    const sub2 = listeners.find(l => l.doc === 'missing');
    sub2.cb({ exists: false });
    assert(got2 === 'init', 'FB: отсутствующий документ не доставляется');
  }

  console.log(process.exitCode ? '\n=== ЕСТЬ ОШИБКИ ===' : '\n=== ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ ===');
  process.exit(process.exitCode || 0);
})().catch(e => { console.error('CRASH:', e); process.exit(1); });

