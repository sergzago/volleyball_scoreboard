/**
 * Конфигурация базы данных
 *
 * Поддерживаемые провайдеры:
 * - 'firebase'   — Firebase Firestore + Auth
 * - 'pocketbase' — PocketBase (self-hosted)
 *
 * Для переключения измените DB_CONFIG.provider
 */

// ============================================================================
// ВЫБОР ПРОВАЙДЕРА БАЗЫ ДАННЫХ
// ============================================================================

var DB_CONFIG = {
  // Текущий провайдер: 'firebase' | 'pocketbase'
  provider: 'pocketbase',

  // ============================================================================
  // FIREBASE КОНФИГУРАЦИЯ
  // ============================================================================
  firebase: {
    apiKey: "AIzaSyBCezRf1nI1dlLFwDgW8LDcHZ-ocQEBx30",
    authDomain: "myvolleyscore.firebaseapp.com",
    projectId: "myvolleyscore",
    storageBucket: "myvolleyscore.firebasestorage.app",
    messagingSenderId: "102858014506",
    appId: "1:102858014506:web:aa67a16c0c281b06f3e853",
    measurementId: "G-6MQ6ZLE52N"
  },

  // ============================================================================
  // POCKETBASE КОНФИГУРАЦИЯ
  // ============================================================================
  pocketbase: {
    url: 'http://zago.my.to:8090',
    // Опции авторизации администратора (для серверных операций)
    adminEmail: 'supervisor@volleyball.local',
    adminPassword: 'Mer1in00'
  },

  // ============================================================================
  // НАЗВАНИЯ КОЛЛЕКЦИЙ (отдельно для каждого провайдера)
  // ============================================================================
  firebaseCollections: {
    VOLLEYBALL: 'volleyball',
    MATCHES: 'matches',
    USERS: 'users',
    AUTH_LOG: 'auth_log'
  },
  pocketbaseCollections: {
    VOLLEYBALL: 'volleyball',
    MATCHES: 'matches',
    USERS: 'scoreusers',
    AUTH_LOG: 'auth_log'
  },

  // ============================================================================
  // КОНСТАНТЫ МАТЧА
  // ============================================================================
  constants: {
    BEACH_SETS_TO_WIN: 2,
    BEACH_MAX_SETS: 3,
    CLASSIC_POINTS_TO_WIN: 25,
    CLASSIC_SETS_TO_WIN: 3,
    CLASSIC_MAX_SETS: 5,
    CLASSIC_SETS_TO_WIN_TWO: 2,
    CLASSIC_MAX_SETS_TWO: 3,
    CLASSIC_TIEBREAK_POINTS_TO_WIN: 15
  },

  // ============================================================================
  // ПАРАМЕТРЫ АВТОРИЗАЦИИ
  // ============================================================================
  ENABLE_AUTH: 0, // 1 — включить, 0 — отключить

  // ============================================================================
  // НАСТРОЙКИ ЛОГОТИПА
  // ============================================================================
  LOGO_FILE_NAME: 'logo_base64.txt',
  LOGO_BASE64: ''
};

// ============================================================================
// ОБРАТНАЯ СОВМЕСТИМОСТЬ — псевдонимы для старого кода
// ============================================================================

// Определяем коллекции в зависимости от провайдера
DB_CONFIG.collections = DB_CONFIG.provider === 'pocketbase'
  ? DB_CONFIG.pocketbaseCollections
  : DB_CONFIG.firebaseCollections;

var COLLECTIONS = DB_CONFIG.collections;
var VOLLEYBALL_COLLECTION = COLLECTIONS.VOLLEYBALL;
var MATCHES_COLLECTION = COLLECTIONS.MATCHES;
var USERS_COLLECTION = COLLECTIONS.USERS;
var GAME_CONSTANTS = DB_CONFIG.constants;
var ENABLE_AUTH = DB_CONFIG.ENABLE_AUTH;
var LOGO_FILE_NAME = DB_CONFIG.LOGO_FILE_NAME;
var LOGO_BASE64 = DB_CONFIG.LOGO_BASE64;

// Для обратной совместимости со старым кодом
var firebaseConfig = DB_CONFIG.firebase;

// ============================================================================
// ЭКСПОРТ ДЛЯ BACKEND (Node.js/CommonJS)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  var fs = require('fs');
  var path = require('path');
  try {
    LOGO_BASE64 = fs.readFileSync(path.join(__dirname, '..', LOGO_FILE_NAME), 'utf8').trim();
  } catch (e) {
    LOGO_BASE64 = '';
  }

  module.exports = {
    DB_CONFIG: DB_CONFIG,
    COLLECTIONS: COLLECTIONS,
    VOLLEYBALL_COLLECTION: VOLLEYBALL_COLLECTION,
    MATCHES_COLLECTION: MATCHES_COLLECTION,
    GAME_CONSTANTS: GAME_CONSTANTS,
    ENABLE_AUTH: ENABLE_AUTH,
    LOGO_BASE64: LOGO_BASE64,
    LOGO_FILE_NAME: LOGO_FILE_NAME,
    firebaseConfig: firebaseConfig // для обратной совместимости
  };
}

// ============================================================================
// ЗАГРУЗКА ЛОГОТИПА (браузер)
// ============================================================================

function loadLogo(callback) {
  fetch(LOGO_FILE_NAME)
    .then(function(response) {
      if (response.ok) return response.text();
      throw new Error('Файл логотипа не найден');
    })
    .then(function(text) {
      LOGO_BASE64 = text.trim();
      DB_CONFIG.LOGO_BASE64 = LOGO_BASE64;
      if (callback) callback(LOGO_BASE64);
    })
    .catch(function(error) {
      console.error('Ошибка загрузки логотипа:', error);
      if (callback) callback('');
    });
}
