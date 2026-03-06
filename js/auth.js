/**
 * Общий модуль авторизации для клиентских страниц
 * Подключается после firebase-app.js и firebase-auth.js
 */

// Глобальные переменные
window.AuthModule = (function() {
    const firebaseConfig = {
        apiKey: "AIzaSyBCezRf1nI1dlLFwDgW8LDcHZ-ocQEBx30",
        authDomain: "myvolleyscore.firebaseapp.com",
        projectId: "myvolleyscore",
        storageBucket: "myvolleyscore.firebasestorage.app",
        messagingSenderId: "102858014506",
        appId: "1:102858014506:web:aa67a16c0c281b06f3e853",
        measurementId: "G-6MQ6ZLE52N"
    };

    // Инициализация Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    const auth = firebase.auth();
    let currentUser = null;
    let currentRole = null;
    let idToken = null;

    /**
     * Проверка авторизации пользователя
     * @param {string} requiredRole - Требуемая роль ('user' или 'admin')
     * @param {string} redirectUrl - URL для перенаправления если не авторизован (null для возврата false)
     * @returns {Promise<boolean>} - true если авторизован
     */
    async function checkAuth(requiredRole = 'user', redirectUrl = 'login.html') {
        return new Promise((resolve, reject) => {
            auth.onAuthStateChanged(async (user) => {
                if (!user) {
                    if (redirectUrl) {
                        window.location.href = redirectUrl;
                    }
                    resolve(false);
                    return;
                }

                currentUser = user;

                try {
                    idToken = await user.getIdToken();

                    // Получаем роль из Firestore
                    const db = firebase.firestore();
                    const username = user.email.split('@')[0];
                    const userDoc = await db.collection('users').doc(username).get();
                    
                    currentRole = 'user';
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        currentRole = userData.role === 'admin' ? 'admin' : 'user';
                    }

                    // Проверяем роль
                    if (requiredRole === 'admin' && currentRole !== 'admin') {
                        // Если требуется админ, а у пользователя роль user
                        if (redirectUrl) {
                            window.location.href = 'ctl.html';
                        }
                        resolve(false);
                        return;
                    }

                    resolve(true);
                } catch (error) {
                    console.error('Auth check error:', error);
                    if (redirectUrl) {
                        window.location.href = redirectUrl;
                    }
                    resolve(false);
                }
            });
        });
    }

    /**
     * Получение текущего пользователя
     * @returns {Object|null}
     */
    function getCurrentUser() {
        return currentUser;
    }

    /**
     * Получение текущей роли пользователя
     * @returns {string|null}
     */
    function getCurrentRole() {
        return currentRole;
    }

    /**
     * Получение ID токена
     * @returns {string|null}
     */
    function getIdToken() {
        return idToken;
    }

    /**
     * Выход из системы
     * @returns {Promise<void>}
     */
    async function logout() {
        try {
            await auth.signOut();
            currentUser = null;
            currentRole = null;
            idToken = null;
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    }

    /**
     * Получение заголовков для API запросов
     * @returns {Object}
     */
    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken || ''}`
        };
    }

    /**
     * Авторизованный fetch запрос
     * @param {string} url 
     * @param {Object} options 
     * @returns {Promise<Response>}
     */
    async function fetch(url, options = {}) {
        options.headers = {
            ...options.headers,
            ...getAuthHeaders()
        };
        return window.fetch(url, options);
    }

    // Публичный API модуля
    return {
        checkAuth,
        getCurrentUser,
        getCurrentRole,
        getIdToken,
        logout,
        getAuthHeaders,
        fetch,
        auth
    };
})();
