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
  apiKey: "AIzaSyBCezRf1nI1dlLFwDgW8LDcHZ-ocQEBx30",
  authDomain: "myvolleyscore.firebaseapp.com",
  projectId: "myvolleyscore",
  storageBucket: "myvolleyscore.firebasestorage.app",
  messagingSenderId: "102858014506",
  appId: "1:102858014506:web:aa67a16c0c281b06f3e853",
  measurementId: "G-6MQ6ZLE52N"
};


var scoreboard_data={};
firebase.initializeApp(config);
db=firebase.firestore();
scoreboard_collection=db.collection('volleyball')
matches_collection=db.collection('matches')
var game_id=getParameterByName('game');
if(!game_id) game_id='test1';
console.log(game_id);
scoreboard_query=scoreboard_collection.doc(game_id)
