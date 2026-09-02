/**
 * Учетные данные провайдеров базы данных
 *
 * ⚠️  ЭТОТ ФАЙЛ СИНХРОНИЗИРУЕТСЯ ЧЕРЕЗ GIT
 *      НЕ ХРАНИТЕ ЗДЕСЬ СЕКРЕТЫ В ПРОДАКШЕНЕ!
 *
 * Для продакшена используйте переменные окружения
 * или локальный файл credentials.local.js (добавлен в .gitignore) 
 */

var CREDENTIALS = {
  // ============================================================================
  // СЕРВЕР (Node.js API, используется для Firebase Admin операций)
  // ============================================================================
  server: {
    url: ''
  },

  // ============================================================================
  // FIREBASE УЧЕТНЫЕ ДАННЫЕ
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
  // POCKETBASE УЧЕТНЫЕ ДАННЫЕ
  // ============================================================================
  pocketbase: {
    url: 'https://zago.my.to/pb/',
    // SSE-realtime подписка. На реверс-прокси без поддержки SSE (proxy_buffering off,
    // HTTP/1.1) подписка POST /api/realtime падает с 404 — в этом случае установите
    // realtime: false, приложение будет работать через страховочный опрос (2 сек).
    realtime: false,
    // Администратор приложения (для управления пользователями, смена паролей)
    // appAdminEmail: 'aapp@volleyball.local',
    // appAdminPassword: 'iakWTB2IabF-r00',

    // Обычный пользователь (для чтения/записи данных в коллекциях)
    user_email: 'app@volleyball.local',
    user_password: 'iakWTB2IabF-r00'
  }
};

// Экспорт для Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CREDENTIALS;
}
