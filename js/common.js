function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

var scoreboard_data={};

// Глобальные алиасы для обратной совместимости (старый код использует scoreboard_query.update())
// Теперь они не зависят от глобального game_id
scoreboard_query = {
    update: function(data, gameId) {
        if (!gameId) {
            console.error('scoreboard_query.update: gameId is not provided!');
            return Promise.reject('gameId is not provided');
        }
        console.log('scoreboard_query.update called with:', data);
        return DB.scoreboard.update(gameId, data);
    },
    get: function(gameId) {
        if (!gameId) return Promise.reject('gameId is not provided');
        return DB.scoreboard.get(gameId);
    }
};

matches_collection = {
    add: function(data) {
        return DB.matches.add(data);
    }
};

scoreboard_collection = {
    doc: function(id) {
        return {
            set: function(data, options) {
                // В ctl.js .set() используется для сброса игры.
                // Наш DB.scoreboard.reset() делает то же самое, но более явно.
                // Перенаправляем вызов на него для консистентности.
                return scoreboard_query.update(data, id);
            },
            get: function() {
                return scoreboard_query.get(id);
            }
        };
    }
};

db = {
    collection: function(name) {
        return {
            doc: function(id) {
                return {
                    get: function() {
                        if (name === DB_CONFIG.collections.VOLLEYBALL) {
                            return DB.scoreboard.get(id);
                        }
                        return Promise.resolve(null);
                    },
                    update: function(data) {
                        if (name === DB_CONFIG.collections.VOLLEYBALL) {
                            return DB.scoreboard.update(id, data);
                        }
                        return Promise.resolve();
                    }
                };
            },
            add: function(data) {
                if (name === DB_CONFIG.collections.MATCHES) {
                    return DB.matches.add(data);
                }
                return Promise.resolve();
            }
        };
    }
};

/**
 * Транслитерация кириллицы в латиницу
 * @param {string} text - текст для транслитерации
 * @returns {string} - транслитерированный текст
 */
function transliterate(text) {
    var map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
        'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    };
    return text.replace(/[а-яёА-ЯЁ]/g, function(ch) {
        return map[ch] || ch;
    });
}

/**
 * Сгенерировать template_id из названия шаблона
 * Если название на латинице — используется как есть,
 * если на кириллице — транслитерируется.
 * @param {string} name - название шаблона
 * @returns {string} - template_id
 */
function generateTemplateId(name) {
    var translitName = transliterate(name);
    var id = translitName.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');
    if (!id) id = 'template_' + Date.now();
    return id;
}
