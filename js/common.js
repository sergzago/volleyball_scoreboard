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

// Инициализация Firebase (если ещё не инициализирован)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
db=firebase.firestore();
scoreboard_collection=db.collection(COLLECTIONS.VOLLEYBALL)
matches_collection=db.collection(COLLECTIONS.MATCHES)
var game_id=getParameterByName('game');
if(!game_id) game_id='test1';
console.log('game_id:', game_id);
scoreboard_query=scoreboard_collection.doc(game_id)
