/**
 * Общий модуль авторизации для клиентских страниц
 * Работает через единый DB интерфейс (Firebase / PocketBase)
 * Подключается после db-config.js и db-interface.js
 */

// Глобальные переменные
window.AuthModule = (function() {
    // Проверка включена ли авторизация
    const isAuthEnabled = (typeof ENABLE_AUTH !== 'undefined') ? ENABLE_AUTH === 1 : true;

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
        // Если авторизация отключена, всегда возвращаем true
        if (!isAuthEnabled) {
            currentRole = requiredRole === 'admin' ? 'admin' : 'user';
            return true;
        }

        // Инициализируем DB
        await DB.init();

        return new Promise((resolve, reject) => {
            DB.auth.onAuthStateChanged(async (user) => {
                if (!user) {
                    if (redirectUrl) {
                        window.location.href = redirectUrl;
                    }
                    resolve(false);
                    return;
                }

                currentUser = user;
                currentRole = user.role || 'user';

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
        // Если авторизация отключена, просто перенаправляем на главную
        if (!isAuthEnabled) {
            window.location.href = 'index.html';
            return;
        }

        try {
            // Убедимся что DB инициализирован
            await DB.init();
            await DB.auth.logout();
            currentUser = null;
            currentRole = null;
            idToken = null;
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            // Даже при ошибке перенаправляем
            window.location.href = 'login.html';
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

    /**
     * Firebase auth object (для обратной совместимости)
     * Lazy getter — возвращает null если DB ещё не инициализирован
     */
    function getAuth() {
        try {
            return DB.auth.getAuthInstance();
        } catch (e) {
            return null;
        }
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
        get auth() {
            return getAuth();
        }
    };
})();
