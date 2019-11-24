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
  apiKey: "AIzaSyD4rlX0sNaezoSpksuH3kk3SQ-QenicK24",
  authDomain: "volleyball-7a4da.firebaseapp.com",
  databaseURL: "https://volleyball-7a4da.firebaseio.com",
  projectId: "volleyball-7a4da",
  storageBucket: "volleyball-7a4da.appspot.com",
  messagingSenderId: "418301534847",
  appId: "1:418301534847:web:1a7a8d7c622374e3d2154a"
};


var scoreboard_data={};
firebase.initializeApp(config);
db=firebase.firestore();
scoreboard_collection=db.collection('volleyball')
var game_id=getParameterByName('game');
if(!game_id) game_id='test1';
console.log(game_id);
scoreboard_query=scoreboard_collection.doc(game_id)

