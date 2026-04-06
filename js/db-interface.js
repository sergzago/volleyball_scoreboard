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

  /**
   * Конвертирует Date в строку формата PocketBase (с пробелом вместо T)
   */
  function toPbDate(date) {
    return date.toISOString().replace('T', ' ');
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
          var email = username.toLowerCase() + '@volleyball.local';
          return firebase.auth().signInWithEmailAndPassword(email, password)
            .then(function(cred) {
              return firebase.firestore().collection(DB_CONFIG.collections.USERS).doc(username.toLowerCase()).get()
                .then(function(doc) {
                  var role = 'user';
                  if (doc.exists && doc.data().role) {
                    role = doc.data().role;
                  }
                  return {
                    username: username.toLowerCase(),
                    role: role,
                    email: cred.user.email,
                    uid: cred.user.uid,
                    displayName: cred.user.displayName || username
                  };
                });
            });
        }

        // PocketBase — авторизуемся напрямую по username
        var pb = getPocketBaseClient();
        var loginUsername = username.toLowerCase();
        return pb.collection('users').authWithPassword(loginUsername, password)
          .then(function(authData) {
            return {
              username: authData.record.username || loginUsername,
              role: authData.record.role || 'user',
              email: authData.record.email,
              uid: authData.record.id,
              displayName: authData.record.name || authData.record.username || loginUsername
            };
          })
          .catch(function() {
            // Fallback: пробуем войти по email
            return pb.collection('users').authWithPassword(loginUsername + '@volleyball.local', password)
              .then(function(authData) {
                return {
                  username: loginUsername,
                  role: authData.record.role || 'user',
                  email: authData.record.email,
                  uid: authData.record.id,
                  displayName: authData.record.name || loginUsername
                };
              });
          });
      });
    },

    /**
     * Выход
     */
    logout: function() {
      if (provider === 'firebase') {
        return firebase.auth().signOut();
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
        firebase.auth().onAuthStateChanged(function(user) {
          if (!user) { callback(null); return; }
          firebase.firestore().collection(DB_CONFIG.collections.USERS).doc(user.email.split('@')[0]).get()
            .then(function(doc) {
              var role = 'user';
              if (doc.exists && doc.data().role) role = doc.data().role;
              callback({
                username: user.email.split('@')[0],
                email: user.email,
                uid: user.uid,
                role: role,
                displayName: user.displayName
              });
            })
            .catch(function() { callback(null); });
        });
        return;
      }

      // PocketBase — проверяем сессию во встроенной users
      var pb = getPocketBaseClient();
      if (pb.authStore.isValid && pb.authStore.model) {
        var record = pb.authStore.model;
        // Если есть username — используем его, иначе берём из email
        callback({
          username: record.username || record.email.split('@')[0],
          email: record.email,
          uid: record.id,
          role: record.role || 'user',
          displayName: record.name || record.username
        });
      } else {
        callback(null);
      }
    },

    /**
     * Создание пользователя (админ)
     */
    createUser: function(username, password, displayName, role) {
      var email = username.toLowerCase() + '@volleyball.local';

      if (provider === 'firebase') {
        return firebase.auth().createUserWithEmailAndPassword(email, password)
          .then(function(cred) {
            return cred.user.updateProfile({ displayName: displayName })
              .then(function() {
                return firebase.firestore().collection(DB_CONFIG.collections.USERS).doc(username.toLowerCase()).set({
                  uid: cred.user.uid,
                  email: email,
                  username: username.toLowerCase(),
                  displayName: displayName,
                  role: role || 'user',
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
              })
              .then(function() {
                return firebase.auth().signOut();
              })
              .then(function() {
                return { username: username.toLowerCase(), role: role || 'user' };
              });
          });
      }

      // PocketBase — создаём пользователя во встроенной users
      var pb = getPocketBaseClient();
      return pb.admins.authWithPassword(DB_CONFIG.pocketbase.adminEmail, DB_CONFIG.pocketbase.adminPassword)
        .then(function() {
          return pb.collection('users').create({
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
        // Firebase не позволяет удалять чужих пользователей из клиента
        // Нужен Cloud Function или Admin SDK
        return Promise.reject(new Error('Удаление пользователей доступно только через Admin SDK'));
      }

      // PocketBase — удаляем пользователя из встроенной users
      var pb = getPocketBaseClient();
      return pb.admins.authWithPassword(DB_CONFIG.pocketbase.adminEmail, DB_CONFIG.pocketbase.adminPassword)
        .then(function() {
          return pb.collection('users').getFirstListItem('username="' + username.toLowerCase() + '"');
        })
        .then(function(record) {
          return pb.collection('users').delete(record.id);
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
      return pb.collection('users').getFirstListItem('username="' + username.toLowerCase() + '"')
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
     * Firebase auth object (для обратной совместимости)
     */
    getAuthInstance: function() {
      if (provider === 'firebase') return firebase.auth();
      return null;
    }
  };

  // ============================================================================
  // SCOREBOARD MODULE
  // ============================================================================

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
      return pb.collection(DB_CONFIG.collections.VOLLEYBALL).getOne(gameId)
        .catch(function(err) {
          if (err.status === 404) return null;
          throw err;
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
      pb.collection(DB_CONFIG.collections.VOLLEYBALL).getOne(gameId)
        .then(function(record) {
          onUpdate(record);
        })
        .catch(function(err) {
          if (err.status === 404) {
            // Документ не существует — ждём создания
            return;
          }
          if (onError) onError(err);
        });

      // Подписываемся на изменения
      pb.collection(DB_CONFIG.collections.VOLLEYBALL)
        .subscribe(gameId, function(e) {
          if (e.action === 'update' || e.action === 'create') {
            onUpdate(e.record);
          } else if (e.action === 'delete') {
            onUpdate(null);
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
        return firebase.firestore()
          .collection(DB_CONFIG.collections.VOLLEYBALL)
          .doc(gameId)
          .update(data)
          .then(function() {
            return firebase.firestore()
              .collection(DB_CONFIG.collections.VOLLEYBALL)
              .doc(gameId)
              .get()
              .then(function(snapshot) {
                return snapshot.exists ? Object.assign({ id: snapshot.id }, snapshot.data()) : null;
              });
          });
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

      // PocketBase: используем PATCH (upsert) — создаёт или обновляет
      return pb.collection(DB_CONFIG.collections.VOLLEYBALL).update(gameId, updateData)
        .then(function(record) {
          // Если есть поля для удаления — удаляем их отдельным запросом
          if (deleteFields.length > 0) {
            var deleteData = {};
            deleteFields.forEach(function(f) { deleteData[f] = null; });
            return pb.collection(DB_CONFIG.collections.VOLLEYBALL).update(gameId, deleteData);
          }
          return record;
        })
        .catch(function(err) {
          if (err.status === 404) {
            // Документ не существует — создаём
            return pb.collection(DB_CONFIG.collections.VOLLEYBALL).create(
              Object.assign({ id: gameId }, updateData)
            );
          }
          throw err;
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
     * @param {Object} filters — { dateFrom, dateTo, gameId, ... }
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
      return pb.collection('users').getFirstListItem('username="' + username.toLowerCase() + '"')
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
      return pb.collection('users').getFirstListItem('username="' + username.toLowerCase() + '"')
        .then(function(record) {
          return pb.collection('users').update(record.id, data);
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
      return pb.collection('users').getFirstListItem('username="' + username.toLowerCase() + '"')
        .then(function(record) {
          return pb.collection('users').delete(record.id);
        });
    }
  };

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  global.DB = {
    init: init,
    serverTimestamp: serverTimestamp,
    deleteField: deleteField,
    auth: auth,
    scoreboard: scoreboard,
    matches: matches,
    users: users,
    // Получение текущего провайдера
    getProvider: function() { return provider; },
    // Проверка инициализации
    isInitialized: function() { return initialized; }
  };

})(typeof window !== 'undefined' ? window : global);
