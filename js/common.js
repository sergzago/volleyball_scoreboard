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
            update: function(data) {
                return scoreboard_query.update(data, id); // Передаем id в update
            },
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
