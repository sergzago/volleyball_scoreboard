/**
 * Единый интерфейс работы с базой данных
 *
 * Абстрактный слой, скрывающий реализацию (Firebase / PocketBase).
 * Все клиентские страницы и модули работают только через этот интерфейс.
 *
 * Использование:
 *   DB.init().then(function() {
 *     DB.auth.login('admin', 'password').then(...);
 *     DB.scoreboard.subscribe('game123', onData);
 *     DB.scoreboard.update('game123', { home_score: 5 });
 *   });
 */

(function(global) {
  'use strict';

  var provider = DB_CONFIG.provider;
  var client = null; // PocketBase client или Firebase app
  var initialized = false;

  // ============================================================================
  // FIELDS UTILITIES
  // ============================================================================

  function serverTimestamp() {
    if (provider === 'firebase') {
      return firebase.firestore.FieldValue.serverTimestamp();
    }
    // PocketBase — возвращаем текущую дату в ISO формате
    return new Date().toISOString();
  }

  function deleteField() {
    if (provider === 'firebase') {
      return firebase.firestore.FieldValue.delete();
    }
    // PocketBase: используем специальный маркер
    return '__PB_DELETE_FIELD__';
  }

  // ============================================================================
  // UTILS
  // ============================================================================

  var utils = {
    /**
     * Преобразует данные от любого провайдера в простой JS-объект.
     * @param {Object|Record} data - Данные от Firebase (объект) или PocketBase (Record).
     * @returns {Object}
     */
    getPlainObject: function(data) {
      if (!data) return {};
      // PocketBase `data` is a Record object with a get() method.
      if (typeof data.get === 'function') {
        var plainData = data.get();
        // PocketBase system id shadows custom id field — use get('id') for custom game ID
        var customId = data.get('id');
        if (customId) plainData['id'] = customId;
        return plainData;
      }
      // Firebase data is already a plain object.
      return data;
    }
  };

  /**
   * Конвертирует Date в строку формата PocketBase (с пробелом вместо T)
   */
  function toPbDate(date) {
    return date.toISOString().replace('T', ' ');
  }

  // ============================================================================
  // PASSWORD HASHING (Web Crypto API — PBKDF2 + SHA-256)
  // ============================================================================

  var SALT_LENGTH = 16;
  var ITERATIONS = 100000;

  function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(function(b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  function hexToArrayBuffer(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes.buffer;
  }

  function generateSalt() {
    return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  }

  // Проверка доступности Web Crypto API (crypto.subtle доступен только в secure context:
  // HTTPS или localhost). На мобильных устройствах при доступе по HTTP crypto.subtle
  // отсутствует, поэтому используем чистую JS-реализацию PBKDF2-SHA256.
  function isCryptoSubtleAvailable() {
    return typeof crypto !== 'undefined' &&
      crypto.subtle &&
      typeof crypto.subtle.importKey === 'function' &&
      typeof crypto.subtle.deriveBits === 'function';
  }

  function hashPassword(password, salt) {
    if (isCryptoSubtleAvailable()) {
      var encoder = new TextEncoder();
      var keyMaterial = crypto.subtle.importKey(
        'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
      );
      return keyMaterial.then(function(key) {
        return crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: salt, iterations: ITERATIONS, hash: 'SHA-256' },
          key, 256
        );
      }).then(function(hash) {
        return arrayBufferToHex(salt.buffer) + ':' + arrayBufferToHex(hash);
      });
    }
    // Fallback: чистая JS-реализация PBKDF2-SHA256 (для не-secure контекстов)
    return Promise.resolve().then(function() {
      var derived = pbkdf2Sha256(password, salt, ITERATIONS, 32);
      return arrayBufferToHex(salt.buffer) + ':' + arrayBufferToHex(derived.buffer);
    });
  }

  function verifyPassword(password, stored) {
    var parts = stored.split(':');
    var salt = new Uint8Array(hexToArrayBuffer(parts[0]));
    return hashPassword(password, salt).then(function(computed) {
      return computed === stored;
    });
  }

  // ----------------------------------------------------------------------------
  // PURE-JS PBKDF2-SHA256 (fallback, когда crypto.subtle недоступен)
  // Реализация совместима с серверной (Node crypto.pbkdf2, SHA-256, 100000 итераций)
  // ----------------------------------------------------------------------------

  var _SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function _rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function _sha256(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length;
    var bitLen = l * 8;
    var paddedLen = (((l + 8) >> 6) + 1) << 6;
    var padded = new Uint8Array(paddedLen);
    padded.set(bytes);
    padded[l] = 0x80;
    var dv = new DataView(padded.buffer);
    dv.setUint32(paddedLen - 4, bitLen >>> 0, false);
    dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
    var w = new Int32Array(64);
    var i, t, t2, t3, j;
    for (i = 0; i < paddedLen; i += 64) {
      for (t = 0; t < 16; t++) {
        w[t] = dv.getInt32(i + t * 4, false);
      }
      for (t2 = 16; t2 < 64; t2++) {
        var s0 = _rotr(w[t2 - 15], 7) ^ _rotr(w[t2 - 15], 18) ^ (w[t2 - 15] >>> 3);
        var s1 = _rotr(w[t2 - 2], 17) ^ _rotr(w[t2 - 2], 19) ^ (w[t2 - 2] >>> 10);
        w[t2] = (w[t2 - 16] + s0 + w[t2 - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t3 = 0; t3 < 64; t3++) {
        var S1 = _rotr(e, 6) ^ _rotr(e, 11) ^ _rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + _SHA256_K[t3] + w[t3]) | 0;
        var S0 = _rotr(a, 2) ^ _rotr(a, 13) ^ _rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = new Uint8Array(32);
    var outDv = new DataView(out.buffer);
    for (j = 0; j < 8; j++) outDv.setUint32(j * 4, H[j] >>> 0, false);
    return out;
  }

  function _hmacSha256(key, message) {
    var blockSize = 64;
    var keyBytes = key;
    if (keyBytes.length > blockSize) {
      keyBytes = _sha256(keyBytes);
    }
    var ipad = new Uint8Array(blockSize);
    var opad = new Uint8Array(blockSize);
    for (var i = 0; i < blockSize; i++) {
      ipad[i] = (i < keyBytes.length ? keyBytes[i] : 0) ^ 0x36;
      opad[i] = (i < keyBytes.length ? keyBytes[i] : 0) ^ 0x5c;
    }
    var inner = new Uint8Array(ipad.length + message.length);
    inner.set(ipad);
    inner.set(message, ipad.length);
    var innerHash = _sha256(inner);
    var outer = new Uint8Array(opad.length + innerHash.length);
    outer.set(opad);
    outer.set(innerHash, opad.length);
    return _sha256(outer);
  }

  function pbkdf2Sha256(password, salt, iterations, dkLen) {
    var passwordBytes = new TextEncoder().encode(password);
    var saltBytes = salt; // Uint8Array
    var hLen = 32;
    var numBlocks = Math.ceil(dkLen / hLen);
    var dk = new Uint8Array(numBlocks * hLen);
    var block = new Uint8Array(saltBytes.length + 4);
    block.set(saltBytes);
    var i, j, k;
    for (i = 1; i <= numBlocks; i++) {
      block[saltBytes.length] = (i >>> 24) & 0xff;
      block[saltBytes.length + 1] = (i >>> 16) & 0xff;
      block[saltBytes.length + 2] = (i >>> 8) & 0xff;
      block[saltBytes.length + 3] = i & 0xff;
      var u = _hmacSha256(passwordBytes, block);
      var t = new Uint8Array(u);
      for (j = 1; j < iterations; j++) {
        u = _hmacSha256(passwordBytes, u);
        for (k = 0; k < hLen; k++) t[k] ^= u[k];
      }
      dk.set(t, (i - 1) * hLen);
    }
    return dk.slice(0, dkLen);
  }

  // ============================================================================
  // POCKETBASE CLIENT LAZY-LOAD
  // ============================================================================

  function getPocketBaseClient() {
    if (client) return client;

    // SDK должен быть загружен через init()
    if (typeof PocketBase === 'undefined') {
      throw new Error('PocketBase SDK не загружен. Вызовите DB.init() перед использованием.');
    }

    client = new PocketBase(DB_CONFIG.pocketbase.url);
    return client;
  }

  // ============================================================================
  // DYNAMIC SCRIPT LOADER
  // ============================================================================

  var loadingScripts = {};

  function loadScript(src) {
    if (loadingScripts[src]) {
      return loadingScripts[src];
    }
    loadingScripts[src] = new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return loadingScripts[src];
  }

  /**
   * Загрузить Firebase SDK если ещё не загружены
   */
  function loadFirebaseSdk() {
    if (typeof firebase !== 'undefined' && typeof firebase.firestore !== 'undefined') {
      return Promise.resolve();
    }
    return loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js')
      .then(function() {
        if (typeof firebase !== 'undefined' && typeof firebase.firestore !== 'undefined') return;
        return loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js');
      })
      .then(function() {
        if (typeof firebase !== 'undefined' && typeof firebase.firestore !== 'undefined') return;
        return loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js');
      });
  }

  /**
   * Загрузить PocketBase SDK если ещё не загружен
   */
  function loadPocketBaseSdk() {
    if (typeof PocketBase !== 'undefined') {
      return Promise.resolve();
    }
    return loadScript('https://cdn.jsdelivr.net/npm/pocketbase@0.26.8/dist/pocketbase.umd.min.js');
  }

  // ============================================================================
  // INIT
  // ============================================================================

  function init() {
    if (initialized) return Promise.resolve();

    return new Promise(function(resolve, reject) {
      try {
        if (provider === 'firebase') {
          // Динамически загружаем Firebase SDK если нужно
          loadFirebaseSdk().then(function() {
            if (!firebase.apps.length) {
              firebase.initializeApp(DB_CONFIG.firebase);
            }
            initialized = true;
            resolve();
          }).catch(reject);
        } else if (provider === 'pocketbase') {
          // Динамически загружаем PocketBase SDK если нужно
          loadPocketBaseSdk().then(function() {
              // Создаём клиент сразу после загрузки SDK
              if (typeof PocketBase !== 'undefined') {
                client = new PocketBase(DB_CONFIG.pocketbase.url);
                // Отключаем автоматическую отмену запросов (если метод доступен)
                if (typeof client.autoCancellation === 'function') {
                  client.autoCancellation(false);
                }
              }
            initialized = true;
            resolve();
          }).catch(reject);
        } else {
          reject(new Error('Неизвестный провайдер БД: ' + provider));
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  // ============================================================================
  // AUTH MODULE
  // ============================================================================

  var auth = {

    /**
     * Вход по username/password
     * @param {string} username
     * @param {string} password
     * @returns {Promise<{username: string, role: string, email: string}>}
     */
    login: function(username, password) {
      // Сначала убедимся что DB инициализирован
      return init().then(function() {
        if (provider === 'firebase') {
          var usersCollection = DB_CONFIG.collections.USERS;
          return firebase.firestore().collection(usersCollection).doc(username.toLowerCase()).get()
            .then(function(doc) {
              if (!doc.exists || !doc.data().password) {
                throw new Error('Пользователь не найден');
              }
              var userData = doc.data();
              return verifyPassword(password, userData.password).then(function(valid) {
                if (!valid) {
                  throw new Error('Неверный пароль');
                }
                var token = crypto.getRandomValues(new Uint8Array(32)).reduce(function(a, b) {
                  return a + b.toString(16).padStart(2, '0');
                }, '');
                var expiresAt = new Date(Date.now() + DB_CONFIG.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
                var sessionsCollection = 'sessions';
                var userInfo = {
                  username: username.toLowerCase(),
                  role: userData.role || 'user',
                  email: userData.email,
                  uid: doc.id,
                  displayname: userData.displayname || userData.displayName || username
                };
                return firebase.firestore().collection(sessionsCollection).doc(token).set({
                  uid: doc.id,
                  email: userData.email,
                  role: userData.role || 'user',
                  expiresAt: expiresAt,
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then(function() {
                  localStorage.setItem('firebase_token', token);
                  localStorage.setItem('firebase_user', JSON.stringify(userInfo));
                  return userInfo;
                });
              });
            });
        }

        // PocketBase — авторизуемся через настраиваемую коллекцию (scoreusers)
        var pb = getPocketBaseClient();
        var loginUsername = username.toLowerCase();
        var usersCollection = DB_CONFIG.collections.USERS;

        // Для PocketBase: если коллекция — auth (scoreusers), используем authWithPassword
        // Если коллекция не auth, используем поиск + проверку хеша
        return pb.collection(usersCollection).authWithPassword(loginUsername, password)
          .then(function(authData) {
            return {
              username: authData.record.username || loginUsername,
              role: authData.record.role || 'user',
              email: authData.record.email,
              uid: authData.record.id,
              displayname: authData.record.name || authData.record.username || loginUsername
            };
          })
          .catch(function(firstError) {
            // Fallback: пробуем войти по email
            var loginEmail = username.toLowerCase() + '@volleyball.local';
            return pb.collection(usersCollection).authWithPassword(loginEmail, password)
              .then(function(authData) {
                return {
                  username: loginUsername,
                  role: authData.record.role || 'user',
                  email: authData.record.email,
                  uid: authData.record.id,
                  displayname: authData.record.name || loginUsername
                };
              })
              .catch(function(secondError) {
                // Обе попытки не удались — выбрасываем понятную ошибку
                var message = 'Пользователь не найден или неверный пароль';
                if (firstError && (firstError.message || '').toString().includes('Failed to fetch')) {
                  message = 'Ошибка сети. Проверьте интернет-соединение или доступность сервера.';
                } else if (secondError && (secondError.message || '').toString().includes('Failed to fetch')) {
                  message = 'Ошибка сети. Проверьте интернет-соединение или доступность сервера.';
                }
                throw new Error(message);
              });
          });
      });
    },

    /**
     * Выход
     */
    logout: function() {
      if (provider === 'firebase') {
        var token = localStorage.getItem('firebase_token');
        localStorage.removeItem('firebase_token');
        localStorage.removeItem('firebase_user');
        if (token) {
          var sessionsCollection = 'sessions';
          return firebase.firestore().collection(sessionsCollection).doc(token).delete()
            .catch(function() {});
        }
        return Promise.resolve();
      }
      var pb = getPocketBaseClient();
      pb.authStore.clear();
      return Promise.resolve();
    },

    /**
     * Подписка на изменение состояния авторизации
     * @param {function(Object|null)} callback — user info или null
     */
    onAuthStateChanged: function(callback) {
      if (provider === 'firebase') {
        var storedUser = null;
        try {
          storedUser = JSON.parse(localStorage.getItem('firebase_user'));
        } catch (e) {}
        callback(storedUser);
        return;
      }

      // PocketBase — подписываемся на изменения authStore (реактивно)
      var pb = getPocketBaseClient();
      var unsubscribe = pb.authStore.onChange(function(token, model) {
        if (model) {
          callback({
            username: model.username || (model.email ? model.email.split('@')[0] : ''),
            email: model.email,
            uid: model.id,
            role: model.role || 'user',
            displayname: model.name || model.username
          });
        } else {
          callback(null);
        }
      });

      // Вызываем callback немедленно с текущим состоянием
      // (как Firebase onAuthStateChanged — срабатывает сразу при подписке)
      if (pb.authStore.isValid && pb.authStore.model) {
        var record = pb.authStore.model;
        callback({
          username: record.username || (record.email ? record.email.split('@')[0] : ''),
          email: record.email,
          uid: record.id,
          role: record.role || 'user',
          displayname: record.name || record.username
        });
      } else {
        // Важно: вызываем callback(null) для совместимости с AuthModule.checkAuth()
        // и страницами, которые ожидают немедленного ответа при отсутствии сессии
        callback(null);
      }
    },

    /**
     * Создание пользователя (админ)
     */
    createUser: function(username, password, displayName, role) {
      var email = username.toLowerCase() + '@volleyball.local';

      if (provider === 'firebase') {
        var salt = generateSalt();
        return hashPassword(password, salt).then(function(hashedPassword) {
          return firebase.firestore().collection(DB_CONFIG.collections.USERS).doc(username.toLowerCase()).set({
            email: email,
            username: username.toLowerCase(),
            password: hashedPassword,
            displayname: displayName,
            role: role || 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }).then(function() {
          return { username: username.toLowerCase(), role: role || 'user' };
        });
      }

      // PocketBase — создаём пользователя в настраиваемой коллекции
      var pb = getPocketBaseClient();
      var usersCollection = DB_CONFIG.collections.USERS;
      // Авторизуемся как обычный пользователь приложения
      return pb.collection('app_users').authWithPassword(
        DB_CONFIG.pocketbase.user_email,
        DB_CONFIG.pocketbase.user_password
      ).then(function() {
          return pb.collection(usersCollection).create({
            username: username.toLowerCase(),
            email: email,
            password: password,
            passwordConfirm: password,
            name: displayName,
            role: role || 'user',
            emailVisibility: true
          });
        });
    },

    /**
     * Удаление пользователя (админ)
     */
    deleteUser: function(username) {
      if (provider === 'firebase') {
        var usersCollection = DB_CONFIG.collections.USERS;
        return firebase.firestore().collection(usersCollection).doc(username.toLowerCase()).delete();
      }

      // PocketBase — удаляем пользователя из настраиваемой коллекции
      var pb = getPocketBaseClient();
      var usersCollection = DB_CONFIG.collections.USERS;
      // Авторизуемся как обычный пользователь приложения
      return pb.collection('app_users').authWithPassword(
        DB_CONFIG.pocketbase.user_email,
        DB_CONFIG.pocketbase.user_password
      ).then(function() {
          return pb.collection(usersCollection).getFirstListItem('username="' + username.toLowerCase() + '"');
        })
        .then(function(record) {
          return pb.collection(usersCollection).delete(record.id);
        });
    },

    /**
     * Получение роли пользователя
     */
    getUserRole: function(username) {
      if (provider === 'firebase') {
        return firebase.firestore().collection(DB_CONFIG.collections.USERS).doc(username.toLowerCase()).get()
          .then(function(doc) {
            if (doc.exists && doc.data().role) return doc.data().role;
            return 'user';
          });
      }

      var pb = getPocketBaseClient();
      var usersCollection = DB_CONFIG.collections.USERS;
      return pb.collection(usersCollection).getFirstListItem('username="' + username.toLowerCase() + '"')
        .then(function(record) {
          return record.role || 'user';
        })
        .catch(function() { return 'user'; });
    },

    /**
     * Запись в лог авторизаций
     */
    logAuthEvent: function(data) {
      if (provider === 'firebase') {
        return firebase.firestore().collection(DB_CONFIG.collections.AUTH_LOG).add(data);
      }
      var pb = getPocketBaseClient();
      return pb.collection(DB_CONFIG.collections.AUTH_LOG).create(data);
    },

    /**
     * Auth object (для обратной совместимости)
     */
    getAuthInstance: function() {
      if (provider === 'firebase') {
        try {
          var stored = JSON.parse(localStorage.getItem('firebase_user'));
          return stored ? { currentUser: { email: stored.email } } : null;
        } catch (e) { return null; }
      }
      return null;
    }
  };

  // ============================================================================
  // SCOREBOARD MODULE
  // ============================================================================

  /**
   * Поиск записи в volleyball по полю id (кастомному, не системному).
   * PocketBase getOne/getFirstListItem используют системный id, а не кастомное поле.
   */
  function findRecordByCustomId(pb, collectionName, customIdField, customId) {
    return pb.collection(collectionName)
      .getFirstListItem(customIdField + '="' + customId + '"')
      .catch(function(err) {
        // getFirstListItem выбрасывает ошибку, если ничего не найдено
        return null;
      });
  }

  var scoreboard = {

    /**
     * Получить данные игры (однократно)
     */
    get: function(gameId) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.VOLLEYBALL)
          .doc(gameId)
          .get()
          .then(function(doc) {
            return doc.exists ? doc.data() : null;
          });
      }

      var pb = getPocketBaseClient();
      return findRecordByCustomId(pb, DB_CONFIG.collections.VOLLEYBALL, 'id', gameId)
        .then(function(record) {
          // Возвращаем простой объект, чтобы вызывающий код мог использовать
          // Object.keys() и прямые обращения к полям (Record не перечисляет данные)
          return record ? utils.getPlainObject(record) : null;
        })
        .catch(function() {
          return null;
        });
    },

    /**
     * Подписка на изменения документа (real-time)
     * @param {string} gameId
     * @param {function(Object)} onUpdate — вызывается при каждом изменении
     * @param {function(Error)} onError — ошибка
     * @returns {function()} — функция отписки
     */
    subscribe: function(gameId, onUpdate, onError) {
      if (provider === 'firebase') {
        var unsubscribe = firebase.firestore()
          .collection(DB_CONFIG.collections.VOLLEYBALL)
          .doc(gameId)
          .onSnapshot(function(snapshot) {
            if (snapshot.exists) onUpdate(snapshot.data());
          }, function(err) {
            if (onError) onError(err);
          });
        return unsubscribe;
      }

      // PocketBase — сначала загружаем текущие данные, потом подписываемся
      var pb = getPocketBaseClient();
      var subscriptionKey = DB_CONFIG.collections.VOLLEYBALL + '_' + gameId;

      // Сначала получаем текущие данные
      findRecordByCustomId(pb, DB_CONFIG.collections.VOLLEYBALL, 'id', gameId)
        .then(function(record) {
          if (record) onUpdate(utils.getPlainObject(record));
        })
        .catch(function(err) {
          if (onError) onError(err);
        });

      // Подписываемся на все изменения коллекции, фильтруем по кастомному полю id
      pb.collection(DB_CONFIG.collections.VOLLEYBALL)
        .subscribe('*', function(e) {
          if (e.action === 'update' || e.action === 'create') {
            var record = e.record;
            if (!record) return;
            var recordGameId = typeof record.get === 'function' ? record.get('id') : record.id;
            if (recordGameId && recordGameId === gameId) {
              onUpdate(utils.getPlainObject(record));
            }
          }
        })
        .catch(function(err) {
          if (onError) onError(err);
        });

      // Функция отписки
      return function() {
        pb.collection(DB_CONFIG.collections.VOLLEYBALL).unsubscribe(subscriptionKey);
      };
    },

    /**
     * Обновить данные игры (upsert — создаёт если не существует)
     * @param {string} gameId
     * @param {Object} data
     */
    update: function(gameId, data) {
      if (provider === 'firebase') {
        // Используем set с merge:true для upsert-поведения.
        // Это создает документ, если он не существует, и обновляет, если существует.
        // FieldValue.delete() поддерживается в этом режиме.
        return firebase.firestore()
          .collection(DB_CONFIG.collections.VOLLEYBALL)
          .doc(gameId)
          .set(data, { merge: true })
          // После обновления получаем и возвращаем обновленный документ
          .then(() => scoreboard.get(gameId));
      }

      var pb = getPocketBaseClient();
      // PocketBase: обрабатываем маркеры удаления полей
      var updateData = {};
      var deleteFields = [];
      Object.keys(data).forEach(function(key) {
        if (data[key] === '__PB_DELETE_FIELD__') {
          deleteFields.push(key);
        } else {
          updateData[key] = data[key];
        }
      });

      // PocketBase: сначала ищем запись по полю id, потом обновляем по системному ID
      return findRecordByCustomId(pb, DB_CONFIG.collections.VOLLEYBALL, 'id', gameId)
        .then(function(record) {
          if (record) {
            return pb.collection(DB_CONFIG.collections.VOLLEYBALL).update(record.id, updateData)
              .then(function(updated) {
                if (deleteFields.length > 0) {
                  var deleteData = {};
                  deleteFields.forEach(function(f) { deleteData[f] = null; });
                  return pb.collection(DB_CONFIG.collections.VOLLEYBALL).update(record.id, deleteData);
                }
                return updated;
              });
          }
          // Запись не найдена — создаём
          return pb.collection(DB_CONFIG.collections.VOLLEYBALL).create(
            Object.assign({ id: gameId }, updateData)
          );
        });
    },

    /**
     * Создать новую игру
     */
    create: function(gameId, initialData) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.VOLLEYBALL)
          .doc(gameId)
          .set(initialData)
          .then(function() {
            return Object.assign({ id: gameId }, initialData);
          });
      }

      var pb = getPocketBaseClient();
      return pb.collection(DB_CONFIG.collections.VOLLEYBALL).create(
        Object.assign({ id: gameId }, initialData)
      );
    },

    /**
     * Сброс игры к начальному состоянию.
     * @param {string} gameId
     * @param {Object} initialData - Начальные данные (названия команд и т.д.).
     * @param {Object} userInfo - Информация о пользователе.
     */
    reset: function(gameId, initialData, userInfo) {
      var resetData = Object.assign({}, initialData, {
        show: 1,
        home_score: 0,
        home_fouls: 0,
        away_score: 0,
        away_fouls: 0,
        current_period: 1,
        custom_label: "Таймаут",
        home_sets: 0,
        away_sets: 0,
        home_timeouts: 0,
        away_timeouts: 0,
        beach_mode: false,
        beach_current_set: 1,
        beach_switch_message: '',
        beach_match_finished: false,
        period_count: 5,
        set_history: [],
        classic_match_finished: false,
        home_side: 'left',
        away_side: 'right',
        classic_tiebreak_switch_done: true,
        invert_tablo: false,
        unlimited_score: false,
        two_wins_mode: false,
        custom_mode: false,
        matchmode: '00000',
        pending_new_set: deleteField(),
        next_period: deleteField(),
        next_beach_set: deleteField(),
        pending_home_side: deleteField(),
        pending_away_side: deleteField(),
        pending_classic_tiebreak_switch_done: deleteField(),
        classic_switch_needed: deleteField(),
        classic_switch_shown: deleteField(),
        classic_switch_message: deleteField(),
        lastEdited: serverTimestamp(),
        username: userInfo.username || '',
        displayname: userInfo.displayname || ''
      });

      // Для Firebase используем set с merge:true, который работает как upsert
      // и корректно обрабатывает FieldValue.delete().
      if (provider === 'firebase') {
        return this.update(gameId, resetData);
      }
      // Для PocketBase используем update, который работает как upsert.
      return this.update(gameId, resetData);
    },

    /**
     * Запрос активных игр (за сегодня)
     */
    queryActive: function() {
      var today = new Date();
      today.setHours(0, 0, 0, 0);

      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.VOLLEYBALL)
          .where('lastEdited', '>=', today)
          .get()
          .then(function(snapshot) {
            var results = [];
            snapshot.forEach(function(doc) {
              results.push({ id: doc.id, ...doc.data() });
            });
            return results;
          });
      }

      var pb = getPocketBaseClient();
      // PocketBase хранит даты с пробелом вместо T
      var todayStr = toPbDate(today);
      return pb.collection(DB_CONFIG.collections.VOLLEYBALL).getFullList({
        filter: 'lastEdited >= "' + todayStr + '"',
        sort: '-lastEdited'
      });
    },

    /**
     * Получить все записи из коллекции volleyball (без фильтров)
     */
    queryAll: function() {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.VOLLEYBALL)
          .get()
          .then(function(snapshot) {
            var results = [];
            snapshot.forEach(function(doc) {
              results.push({ id: doc.id, ...doc.data() });
            });
            return results;
          });
      }

      var pb = getPocketBaseClient();
      return pb.collection(DB_CONFIG.collections.VOLLEYBALL).getFullList({
        sort: '-lastEdited'
      });
    },

    /**
     * Подписка на все активные игры (для online.html)
     */
    subscribeActive: function(onUpdate, onError) {
      if (provider === 'firebase') {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var query = firebase.firestore()
          .collection(DB_CONFIG.collections.VOLLEYBALL)
          .where('lastEdited', '>=', today);

        var unsubscribe = query.onSnapshot(function(snapshot) {
          var results = [];
          snapshot.forEach(function(doc) {
            results.push({ id: doc.id, ...doc.data() });
          });
          onUpdate(results);
        }, function(err) {
          if (onError) onError(err);
        });
        return unsubscribe;
      }

      // PocketBase — подписка на коллекцию с фильтром
      var pb = getPocketBaseClient();
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var todayStr = toPbDate(today);

      pb.collection(DB_CONFIG.collections.VOLLEYBALL)
        .subscribe('*', function(e) {
          // При любом изменении перечитываем все активные
          pb.collection(DB_CONFIG.collections.VOLLEYBALL).getFullList({
            filter: 'lastEdited >= "' + todayStr + '"',
            sort: '-lastEdited'
          }).then(function(results) {
            onUpdate(results);
          });
        })
        .catch(function(err) {
          if (onError) onError(err);
        });

      // Начальная загрузка
      pb.collection(DB_CONFIG.collections.VOLLEYBALL).getFullList({
        filter: 'lastEdited >= "' + todayStr + '"',
        sort: '-lastEdited'
      }).then(function(results) {
        onUpdate(results);
      });

      return function() {
        pb.collection(DB_CONFIG.collections.VOLLEYBALL).unsubscribe('*');
      };
    },

    /**
     * Удалить игру из коллекции volleyball
     */
    delete: function(gameId) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.VOLLEYBALL)
          .doc(gameId)
          .delete();
      }

      var pb = getPocketBaseClient();
      return findRecordByCustomId(pb, DB_CONFIG.collections.VOLLEYBALL, 'id', gameId)
        .then(function(record) {
          if (record) {
            return pb.collection(DB_CONFIG.collections.VOLLEYBALL).delete(record.id);
          }
        });
    }
  };

  // ============================================================================
  // MATCHES MODULE
  // ============================================================================

  var matches = {

    /**
     * Добавить запись матча
     */
    add: function(data) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.MATCHES)
          .add(data);
      }

      var pb = getPocketBaseClient();
      return pb.collection(DB_CONFIG.collections.MATCHES).create(data);
    },

    /**
     * Запрос матчей по фильтру
     * @param {Object} filters — { dateFrom, dateTo, team, ... }
     */
    query: function(filters) {
      filters = filters || {};

      if (provider === 'firebase') {
        var query = firebase.firestore().collection(DB_CONFIG.collections.MATCHES);
        if (filters.dateFrom) {
          query = query.where('date_time', '>=', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.where('date_time', '<=', filters.dateTo);
        }
        query = query.orderBy('date_time', 'desc');
        return query.get().then(function(snapshot) {
          var results = [];
          snapshot.forEach(function(doc) {
            var data = doc.data();
            if (data.is_deleted) return; // Пропускаем удалённые
            // Фильтр по команде (клиентская фильтрация для Firebase)
            if (filters.team) {
              var teamLower = filters.team.toLowerCase();
              var homeTeam = (data.home_team || '').toLowerCase();
              var awayTeam = (data.away_team || '').toLowerCase();
              if (!homeTeam.includes(teamLower) && !awayTeam.includes(teamLower)) {
                return;
              }
            }
            results.push({ id: doc.id, ...data });
          });
          return results;
        });
      }

      // PocketBase
      var pb = getPocketBaseClient();
      var filterStr = 'is_deleted = false';
      if (filters.dateFrom) {
        filterStr += ' && date_time >= "' + toPbDate(filters.dateFrom) + '"';
      }
      if (filters.dateTo) {
        filterStr += ' && date_time <= "' + toPbDate(filters.dateTo) + '"';
      }
      if (filters.team) {
        var teamEscaped = filters.team.replace(/"/g, '\\"');
        filterStr += ' && (home_team ~ "' + teamEscaped + '" || away_team ~ "' + teamEscaped + '")';
      }

      return pb.collection(DB_CONFIG.collections.MATCHES).getFullList({
        filter: filterStr,
        sort: '-date_time'
      });
    },

    /**
     * Мягкое удаление матча
     */
    softDelete: function(matchId) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.MATCHES)
          .doc(matchId)
          .update({
            is_deleted: true,
            deleted_at: firebase.firestore.FieldValue.serverTimestamp()
          });
      }

      var pb = getPocketBaseClient();
      return pb.collection(DB_CONFIG.collections.MATCHES).update(matchId, {
        is_deleted: true,
        deleted_at: toPbDate(new Date())
      });
    },

    /**
     * Удалить матч из коллекции matches
     */
    delete: function(matchId) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.MATCHES)
          .doc(matchId)
          .delete();
      }

      var pb = getPocketBaseClient();
      return pb.collection(DB_CONFIG.collections.MATCHES).delete(matchId);
    }
  };

  // ============================================================================
  // USERS MODULE
  // ============================================================================

  var users = {

    /**
     * Получить данные пользователя
     */
    get: function(username) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.USERS)
          .doc(username.toLowerCase())
          .get()
          .then(function(doc) {
            return doc.exists ? doc.data() : null;
          });
      }

      var pb = getPocketBaseClient();
      var usersCollection = DB_CONFIG.collections.USERS;
      return pb.collection(usersCollection).getFirstListItem('username="' + username.toLowerCase() + '"')
        .catch(function() { return null; });
    },

    /**
     * Обновить данные пользователя
     */
    update: function(username, data) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.USERS)
          .doc(username.toLowerCase())
          .update(data);
      }

      var pb = getPocketBaseClient();
      var usersCollection = DB_CONFIG.collections.USERS;
      return pb.collection(usersCollection).getFirstListItem('username="' + username.toLowerCase() + '"')
        .then(function(record) {
          return pb.collection(usersCollection).update(record.id, data);
        });
    },

    /**
     * Сменить пароль пользователя
     * Для Firebase — хешируем и обновляем в Firestore
     * Для PocketBase — напрямую через SDK (обновление с password + passwordConfirm)
     */
    updatePassword: function(uid, newPassword) {
      if (provider === 'firebase') {
        var usersCollection = DB_CONFIG.collections.USERS;
        var salt = generateSalt();
        return hashPassword(newPassword, salt).then(function(hashedPassword) {
          return firebase.firestore().collection(usersCollection).doc(uid).update({
            password: hashedPassword
          });
        });
      }

      var pb = getPocketBaseClient();
      var usersCollection = DB_CONFIG.collections.USERS;
      return pb.collection(usersCollection).update(uid, {
        password: newPassword,
        passwordConfirm: newPassword
      });
    },

    /**
     * Удалить запись пользователя
     */
    delete: function(username) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.USERS)
          .doc(username.toLowerCase())
          .delete();
      }

      var pb = getPocketBaseClient();
      var usersCollection = DB_CONFIG.collections.USERS;
      return pb.collection(usersCollection).getFirstListItem('username="' + username.toLowerCase() + '"')
        .then(function(record) {
          return pb.collection(usersCollection).delete(record.id);
        });
    }
  };

  // ============================================================================
  // TEMPLATES MODULE
  // ============================================================================

  /**
   * Дефолтная цветовая схема для шаблонов табло
   * Используется когда документ шаблона ещё не создан в БД
   * Все цвета соответствуют sb.html (нижнее табло)
   */
  var DEFAULT_TEMPLATE_DATA = {
        // Фон страницы (sb.html: body без фона, но табло на #1a2b3c)
    body_bg: '#1a2b3c',
    // Фон блока логотипа (sb.html: .logo-area; если не задан — используется фон зон команд)
    logo_bg: '#1a2b3c',
    // Лейбл custom_label вверху табло (sb.html: .top_label)
    label_bg: '#595959',
    label_text: '#ffffff',
    // Блок истории сетов под табло (sb.html: .set-history-block, #set-history-scoreboard1)
    // По умолчанию фон и цвет шрифта совпадают с зоной команд (teams-area)
    set_history_bg: '#1a2b3c',
    set_history_text: '#ffffff',
    // Имя команды (sb.html: .teams-area background #1a2b3c, color white)
    top_team_name_bg: '#1a2b3c',
    top_team_name_text: '#ffffff',
    // Основной счёт (sb.html: .points-score background #d65a98, color white)
    top_primary_score_bg: '#d65a98',
    top_primary_score_text: '#ffffff',
    // Сеты (sb.html: .total-score background #5aa0c4, color white)
    top_secondary_score_bg: '#5aa0c4',
    top_secondary_score_text: '#ffffff',
    // Период (sb.html: не используется отдельно, как имя команды)
    top_period_bg: '#1a2b3c',
    top_period_text: '#ffffff',
    // Нижнее табло (sb.html) — имя команды (sb.html: .teams-area background #1a2b3c, color white)
    bottom_team_name_bg: '#1a2b3c',
    bottom_team_name_text: '#ffffff',
    // Нижнее табло — основной счёт (sb.html: .points-score background #d65a98)
    bottom_primary_score_bg: '#d65a98',
    bottom_primary_score_text: '#ffffff',
    // Нижнее табло — сеты (sb.html: .total-score background #5aa0c4)
    bottom_secondary_score_bg: '#5aa0c4',
    bottom_secondary_score_text: '#ffffff',
    // Нижнее табло — время/история (sb.html: .set-history background #1a2b3c)
    bottom_time_bg: '#1a2b3c',
    bottom_time_text: '#ffffff',
    // Бейдж Сетбола (sb.html: --setball-bg #5aa0c4)
    setball_bg: '#5aa0c4',
    setball_text: '#ffffff',
    // Бейдж Матчбола (sb.html: --matchball-bg #d65a98)
    matchball_bg: '#d65a98',
    matchball_text: '#ffffff'
  };

  /**
   * Поиск записи шаблона в PocketBase по кастомному полю template_id
   */
  function findTemplateRecord(pb, templateId) {
    return findRecordByCustomId(pb, DB_CONFIG.collections.TEMPLATES, 'template_id', templateId);
  }

  var templates = {

    /**
     * Получить данные шаблона (однократно)
     * @param {string} templateId - ID шаблона ('default_classic' или 'default_beach')
     * @returns {Promise<Object|null>}
     */
    get: function(templateId) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.TEMPLATES)
          .doc(templateId)
          .get()
          .then(function(doc) {
            return doc.exists ? doc.data() : null;
          });
      }

      var pb = getPocketBaseClient();
      return findTemplateRecord(pb, templateId)
        .then(function(record) {
          // Возвращаем простой объект, чтобы поля (в т.ч. name) были доступны
          // как обычные свойства, а не через метод Record.get()
          if (!record) return null;
          var data = utils.getPlainObject(record);
          // PocketBase — строго-схемная БД. Если в коллекции templates не настроены
          // новые поля (например, set_history_bg/set_history_text), сервер просто
          // не вернёт их и не сохранит. Дозаполняем недостающие поля значениями
          // по умолчанию, чтобы редактор и табло корректно работали даже до
          // добавления этих полей в схему коллекции.
          var defaults = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_DATA));
          Object.keys(defaults).forEach(function(key) {
            if (data[key] === undefined || data[key] === null || data[key] === '') {
              data[key] = defaults[key];
            }
          });
          return data;
        })
        .catch(function() {
          return null;
        });
    },

    /**
     * Подписка на изменения шаблона (real-time)
     * @param {string} templateId
     * @param {function(Object)} onUpdate — вызывается при каждом изменении
     * @param {function(Error)} onError — ошибка
     * @returns {function()} — функция отписки
     */
    subscribe: function(templateId, onUpdate, onError) {
      if (provider === 'firebase') {
        var unsubscribe = firebase.firestore()
          .collection(DB_CONFIG.collections.TEMPLATES)
          .doc(templateId)
          .onSnapshot(function(snapshot) {
            if (snapshot.exists) {
              onUpdate(snapshot.data());
            } else {
              // Документ не существует — передаём null, вызывающий код применит дефолты
              onUpdate(null);
            }
          }, function(err) {
            if (onError) onError(err);
          });
        return unsubscribe;
      }

      // PocketBase
      var pb = getPocketBaseClient();
      var subscriptionKey = DB_CONFIG.collections.TEMPLATES + '_' + templateId;

      // Сначала получаем текущие данные
      findTemplateRecord(pb, templateId)
        .then(function(record) {
          if (record) {
            onUpdate(utils.getPlainObject(record));
          } else {
            onUpdate(null);
          }
        })
        .catch(function(err) {
          if (onError) onError(err);
        });

      // Подписываемся на изменения коллекции templates
      try {
        pb.collection(DB_CONFIG.collections.TEMPLATES)
          .subscribe('*', function(e) {
            if (e.action === 'update' || e.action === 'create') {
              var record = e.record;
              if (!record) return;
              var recordTemplateId = typeof record.get === 'function'
                ? record.get('template_id')
                : record.template_id;
              if (recordTemplateId && recordTemplateId === templateId) {
                onUpdate(utils.getPlainObject(record));
              }
            }
          })
          .catch(function(err) {
            if (onError) onError(err);
          });
      } catch (e) {
        if (onError) onError(e);
      }

      // Функция отписки
      return function() {
        try {
          pb.collection(DB_CONFIG.collections.TEMPLATES).unsubscribe(subscriptionKey);
        } catch (e) {}
      };
    },

    /**
     * Сохранить или обновить шаблон (upsert)
     * @param {string} templateId
     * @param {Object} data - цветовая схема
     * @returns {Promise}
     */
    update: function(templateId, data) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.TEMPLATES)
          .doc(templateId)
          .set(data, { merge: true });
      }

      if (provider === 'pocketbase') {
        // PocketBase: Если logo_base64 - это Rich Editor, он ожидает HTML.
        // Если есть base64-строка, оборачиваем ее в img-тег.
        // Если логотип удален (null), отправляем пустую строку.
        if (data.logo_base64 && data.logo_base64.startsWith('data:')) {
          data.logo_base64 = '<img src="' + data.logo_base64 + '" alt="Logo">';
        } else if (data.logo_base64 === null || typeof data.logo_base64 === 'undefined') {
          data.logo_base64 = ''; // Пустая строка для удаления/отсутствия логотипа
        }
      }

      var pb = getPocketBaseClient();
      return findTemplateRecord(pb, templateId)
        .then(function(record) {
          var collection;
          try {
            collection = pb.collection(DB_CONFIG.collections.TEMPLATES);
          } catch (e) {
            throw new Error('Коллекция ' + DB_CONFIG.collections.TEMPLATES + ' не существует: ' + e.message);
          }
          if (record) {
            return collection.update(record.id, data);
          }
          // Запись не найдена — создаём
          // PocketBase сам сгенерирует системный 'id'. Наш 'template_id' уже есть в 'data'.
          // Мы не можем передавать наш 'templateId' как системный 'id', так как
          // он может не соответствовать формату системного ID PocketBase.
          // Поэтому просто создаём запись с переданными данными.
          return collection.create(data);
        });
    },

    /**
     * Получить список всех шаблонов
     * @returns {Promise<Array<{id: string, name: string}>>}
     */
    list: function() {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.TEMPLATES)
          .get()
          .then(function(snapshot) {
            var results = [];
            snapshot.forEach(function(doc) {
              var data = doc.data();
              results.push({
                id: doc.id,
                name: data.name || doc.id
              });
            });
            return results;
          });
      }

      var pb = getPocketBaseClient();
      // Коллекция templates может отсутствовать — не даём синхронной ошибке
      // прервать загрузку данных игры
      var collection;
      try {
        collection = pb.collection(DB_CONFIG.collections.TEMPLATES);
      } catch (e) {
        return Promise.resolve([]);
      }
      return collection.getFullList()
        .then(function(records) {
          return records.map(function(record) {
            var data = record;
            // PocketBase Record может иметь метод get()
            var templateId = typeof data.get === 'function' ? data.get('template_id') : data.template_id;
            var name = typeof data.get === 'function' ? (data.get('name') || templateId) : (data.name || templateId);
            return { id: templateId, name: name };
          });
        })
        .catch(function() {
          return [];
        });
    },

    /**
     * Удалить шаблон
     * @param {string} templateId
     * @returns {Promise}
     */
    'delete': function(templateId) {
      if (provider === 'firebase') {
        return firebase.firestore()
          .collection(DB_CONFIG.collections.TEMPLATES)
          .doc(templateId)
          .delete();
      }

      var pb = getPocketBaseClient();
      return findTemplateRecord(pb, templateId)
        .then(function(record) {
          if (record) {
            var collection;
            try {
              collection = pb.collection(DB_CONFIG.collections.TEMPLATES);
            } catch (e) {
              return Promise.resolve();
            }
            return collection.delete(record.id);
          }
          return Promise.resolve();
        });
    },

    /**
     * Вернуть дефолтную цветовую схему
     * @param {string} [templateId] - опционально, для future use
     * @returns {Object}
     */
    getDefaultTemplate: function(templateId) {
      return JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_DATA));
    }
  };

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  global.DB = {
    init: init,
    serverTimestamp: serverTimestamp,
    deleteField: deleteField,
    utils: utils,
    auth: auth,
    scoreboard: scoreboard,
    matches: matches,
    users: users,
    templates: templates,
    // Получение текущего провайдера
    getProvider: function() { return provider; },
    // Проверка инициализации
    isInitialized: function() { return initialized; },
    // Получение данных текущего пользователя
    getCurrentUser: function() {
      if (provider === 'firebase') {
        try {
          var stored = JSON.parse(localStorage.getItem('firebase_user'));
          if (!stored) return null;
          return { username: stored.username, displayname: stored.displayname || stored.displayName || stored.username };
        } catch (e) { return null; }
      }
      if (provider === 'pocketbase') {
        try {
          var pb = getPocketBaseClient();
          if (pb.authStore.isValid && pb.authStore.model) {
            var record = pb.authStore.model;
            return { username: record.username || record.email.split('@')[0], displayname: record.name || record.username || record.email.split('@')[0] };
          }
        } catch (e) {}
      }
      return null;
    }
  };

})(typeof window !== 'undefined' ? window : global);
