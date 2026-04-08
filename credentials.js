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
  // FIREBASE УЧЕТНЫЕ ДАННЫЕ
  // ============================================================================
  firebase: {
    apiKey: "AIzaSyBCezRf1nI1SSFw8LDcHZ-ocQEBx30",
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
