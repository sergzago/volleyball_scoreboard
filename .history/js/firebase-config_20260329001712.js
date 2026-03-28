/**
 * Конфигурация Firebase
 *
 * Этот файл содержит все настройки Firebase:
 * - Параметры подключения
 * - Названия коллекций Firestore
 * - Псевдонимы (алиасы) для коллекций
 */

// ============================================================================
// НАСТРОЙКИ ПОДКЛЮЧЕНИЯ FIREBASE
// ============================================================================

var firebaseConfig = {
  apiKey: "AIzaSyBCezRf1nI1dlLFwDgW8LDcHZ-ocQEBx30",
  authDomain: "myvolleyscore.firebaseapp.com",
  projectId: "myvolleyscore",
  storageBucket: "myvolleyscore.firebasestorage.app",
  messagingSenderId: "102858014506",
  appId: "1:102858014506:web:aa67a16c0c281b06f3e853",
  measurementId: "G-6MQ6ZLE52N"
};

// ============================================================================
// КОЛЛЕКЦИИ FIRESTORE
// ============================================================================

var COLLECTIONS = {
  VOLLEYBALL: 'volleyball',
  MATCHES: 'matches',
  USERS: 'users'
};

// ============================================================================
// ПСЕВДОНИМЫ (АЛИАСЫ) ДЛЯ КОЛЛЕКЦИЙ
// ============================================================================

var VOLLEYBALL_COLLECTION = COLLECTIONS.VOLLEYBALL;
var MATCHES_COLLECTION = COLLECTIONS.MATCHES;
var USERS_COLLECTION = COLLECTIONS.USERS;

// ============================================================================
// КОНСТАНТЫ МАТЧА
// ============================================================================

var GAME_CONSTANTS = {
  BEACH_SETS_TO_WIN: 2,
  BEACH_MAX_SETS: 3,
  CLASSIC_POINTS_TO_WIN: 25,
  CLASSIC_SETS_TO_WIN: 3,
  CLASSIC_MAX_SETS: 5
};

// ============================================================================
// НОВЫЙ ПАРАМЕТ ДЛЯ АВТОРИЗАЦИИ
// ============================================================================

var ENABLE_AUTH = 0; // 1 - включить авторизацию, 0 - отключить

// ============================================================================
// НАСТРОЙКИ ЛОГОТИПА
// ============================================================================
// Имя файла с base64 логотипом (файл должен лежать в корне проекта)
var LOGO_FILE_NAME = 'logo_base64.txt';
var LOGO_BASE64 = ''; // Загружается динамически через fetch

// ============================================================================
// ЭКСПОРТ ДЛЯ BACKEND (Node.js/CommonJS)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  // Для Node.js читаем файл напрямую
  var fs = require('fs');
  var path = require('path');
  try {
    LOGO_BASE64 = fs.readFileSync(path.join(__dirname, '..', '..', LOGO_FILE_NAME), 'utf8').trim();
  } catch (e) {
    LOGO_BASE64 = '';
  }
  
  module.exports = {
    firebaseConfig: firebaseConfig,
    COLLECTIONS: COLLECTIONS,
    VOLLEYBALL_COLLECTION: VOLLEYBALL_COLLECTION,
    MATCHES_COLLECTION: MATCHES_COLLECTION,
    USERS_COLLECTION: USERS_COLLECTION,
    GAME_CONSTANTS: GAME_CONSTANTS,
    LOGO_BASE64: LOGO_BASE64,
    LOGO_FILE_NAME: LOGO_FILE_NAME,
    ENABLE_AUTH: ENABLE_AUTH
  };
}

// ============================================================================
// ФУНКЦИЯ ЗАГРУЗКИ ЛОГОТИПА (для браузера)
// ============================================================================
// Загружает base64 из файла при инициализации

function loadLogo(callback) {
  fetch(LOGO_FILE_NAME)
    .then(function(response) {
      if (response.ok) {
        return response.text();
      }
      throw new Error('Файл логотипа не найден');
    })
    .then(function(text) {
      LOGO_BASE64 = text.trim();
      if (callback) callback(LOGO_BASE64);
    })
    .catch(function(error) {
      console.error('Ошибка загрузки логотипа:', error);
      if (callback) callback('');
    });
}