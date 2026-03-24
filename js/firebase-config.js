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
// ЭКСПОРТ ДЛЯ BACKEND (Node.js/CommonJS)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    firebaseConfig: firebaseConfig,
    COLLECTIONS: COLLECTIONS,
    VOLLEYBALL_COLLECTION: VOLLEYBALL_COLLECTION,
    MATCHES_COLLECTION: MATCHES_COLLECTION,
    USERS_COLLECTION: USERS_COLLECTION,
    GAME_CONSTANTS: GAME_CONSTANTS
  };
}
