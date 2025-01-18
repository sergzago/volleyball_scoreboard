function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

var config = {
  apiKey: "AIzaSyCoyoP7omkMI7hVHLfztBoyONe3jnbgrO0",
  authDomain: "myhome-6a0de.firebaseapp.com",
  databaseURL: "https://myhome-6a0de.firebaseio.com",
  projectId: "myhome-6a0de",
  storageBucket: "myhome-6a0de.firebasestorage.app",
  messagingSenderId: "306306485057",
  appId: "1:306306485057:web:4eb724d75f7ad55825efc0"
};


var scoreboard_data={};
firebase.initializeApp(config);
db=firebase.firestore();
scoreboard_collection=db.collection('volleyball')
var game_id=getParameterByName('game');
if(!game_id) game_id='test1';
console.log(game_id);
scoreboard_query=scoreboard_collection.doc(game_id)

