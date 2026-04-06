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

// Инициализация DB и получение game_id
var game_id=getParameterByName('game');
if(!game_id) game_id='test1';
console.log('game_id:', game_id);
console.log('DB provider:', DB.getProvider());

// Глобальные алиасы для обратной совместимости (старый код использует scoreboard_query.update())
scoreboard_query = {
    update: function(data) {
        console.log('scoreboard_query.update called with:', data);
        return DB.scoreboard.update(game_id, data);
    },
    get: function() {
        return DB.scoreboard.get(game_id);
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
                return DB.scoreboard.update(id, data);
            },
            set: function(data, options) {
                // Для PocketBase update работает как upsert (создаёт если нет)
                return DB.scoreboard.update(id, data);
            },
            get: function() {
                return DB.scoreboard.get(id);
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
