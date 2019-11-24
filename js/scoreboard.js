var config = {
    apiKey: "AIzaSyD4rlX0sNaezoSpksuH3kk3SQ-QenicK24",
    authDomain: "volleyball-7a4da.firebaseapp.com",
    databaseURL: "https://volleyball-7a4da.firebaseio.com",
    projectId: "volleyball-7a4da",
    storageBucket: "volleyball-7a4da.appspot.com",
    messagingSenderId: "418301534847",
    appId: "1:418301534847:web:1a7a8d7c622374e3d2154a"
  };

var updateLoop;
var scoreboard_data={};
firebase.initializeApp(config);
db=firebase.firestore();
scoreboard_collection=db.collection('volleyball')
scoreboard_query=scoreboard_collection.doc(token)
scoreboard_query.onSnapshot(
  function(documentSnapshot){
    var pdata=scoreboard_data;
    scoreboard_data=documentSnapshot.data();
    if(pdata['show'] != scoreboard_data['show']){
      if(scoreboard_data.show == 2){
        $(".big-table").animate({"left":80},1000)
      }else{
        $(".big-table").animate({"left":-800},1000)
      }

      if(scoreboard_data.show==1){
        $("table#top").animate({"margin-top":0},1000)
      }else{
        $("table#top").animate({"margin-top":-80},1000)
      }
    }
    $('.away_team').html(scoreboard_data['away_team'])
    $('.away_score').html(scoreboard_data['away_score'])
    $('.away_fouls').html(scoreboard_data['away_fouls'])
    $(".away_color").css("background-color",scoreboard_data['away_color'])
    $('.home_team').html(scoreboard_data['home_team'])
    $('.home_score').html(scoreboard_data['home_score'])
    $('.home_fouls').html(scoreboard_data['home_fouls'])
    $(".home_color").css("background-color",scoreboard_data['home_color'])
    $('.timeval').html(scoreboard_data['current_period'])
  });

