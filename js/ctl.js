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
var scoreboard_data;
firebase.initializeApp(config);
db=firebase.firestore();
scoreboard_collection=db.collection('basketball')
scoreboard_query=scoreboard_collection.where("token",'==',token).limit(1)
scoreboard_query.onSnapshot(
  function(querySnapshot){
    querySnapshot.docs.map(
      function(documentSnapshot){
        scoreboard_data=documentSnapshot.data();
        console.log(scoreboard_data);
        $('.away_team').html(scoreboard_data['away_team'])
        var disp=scoreboard_data['show'];
        if(disp == false) disp=0; else if(disp == true) disp=1;

        $(".show-select").removeClass("btn-info");
        if(disp == 0){
          $(".show-select[data-val='0']").addClass("btn-info");
        }else if(disp == 1){
          $(".show-select[data-val='1']").addClass("btn-info");
        }else if(disp == 2){
          $(".show-select[data-val='2']").addClass("btn-info");
        }

        //$("#show").prop("checked",(scoreboard_data['show']));
        $('#away_score').html(scoreboard_data['away_score'])
        $('#away_fouls').html(scoreboard_data['away_fouls'])
        $('.home_team').html(scoreboard_data['home_team'])
        $('#in_home_team').val(scoreboard_data['home_team'])
        $('#in_away_team').val(scoreboard_data['away_team'])
        $('#col_home_team').val(scoreboard_data['home_color'])
        $('#col_away_team').val(scoreboard_data['away_color'])
        $('#home_score').html(scoreboard_data['home_score'])
        $('#home_fouls').html(scoreboard_data['home_fouls'])
        $('#period').html(scoreboard_data['current_period'])
      });
  });

function update_db(data){
  console.log("Update1 ",data);
  scoreboard_query.get().then(
    function(querySnapshot){
      querySnapshot.docs.map(
        function(documentSnapshot){
          db.collection('basketball').doc(documentSnapshot.id).update(data)});
    }).catch(
      function(error) {
        console.log("Failed!", error);
      }
    );
}
$(document).ready(function(){
  $(".show-select").click(function(){
    var button=$(this).data('val');
    update_db({show:button})
  });

  $(".score-btn").click(function(){
    var button=$(this);
    delta=parseInt(button.text())
    if(button.data('team')=='home'){
      if(delta>0 || (scoreboard_data['home_score']+delta)>=0)
        update_db({home_score:scoreboard_data['home_score']+delta})
    }else{
      if(delta>0 || (scoreboard_data['away_score']+delta)>=0)
        update_db({away_score:scoreboard_data['away_score']+delta})
    }
  });
  $(".foul-btn").click(function(){var button=$(this);delta=parseInt(button.text())
    if(button.data('team')=='home'){
      if(delta>0 || (scoreboard_data['home_fouls']+delta)>=0)
        update_db({home_fouls:scoreboard_data['home_fouls']+delta})
    }else{
      if(delta>0 || (scoreboard_data['away_fouls']+delta)>=0)
        update_db({away_fouls:scoreboard_data['away_fouls']+delta})
    }
  });

  $(".names-btn").click(function(){
    var update={
      away_team: $("#in_away_team").val(),
      away_color: $("#col_away_team").val(),
      home_team: $("#in_home_team").val(),
      home_color: $("#col_home_team").val(),
    };
    console.log(update);
    update_db(update);
  });
  $(".reset-btn").click(function(){
    update_db({home_score:0,
      home_fouls:0,
      away_score:0,
      away_fouls:0,
      current_period:1});
  });
  $(".period-btn").click(function(){
    var button=$(this);
    delta=parseInt(button.text())
    new_period=scoreboard_data['current_period']+delta
    max_period=scoreboard_data['period_count']
    var hs=scoreboard_data['home_score']
    var as=scoreboard_data['away_score']
    var hf=scoreboard_data['home_fouls']
    var af=scoreboard_data['away_fouls']
    if(hs>as){hf++}
    if(as>hs){af++}
    if((new_period>0)&&(new_period<=5)){
      var update={
        current_period:scoreboard_data['current_period']+delta,
        away_fouls:af,
        home_fouls:hf,
        home_score:0,
        away_score:0
      };
      console.log(update);
      update_db(update)
    }else{
      console.log("Period not allowed: "+new_period)
    }
  });

});

