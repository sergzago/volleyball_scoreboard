scoreboard_query.onSnapshot(
  function(documentSnapshot){
    if(!documentSnapshot.exists)
      return;
    $(".hidden").removeClass("hidden");
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
    }else if(disp == 4){
      $(".show-select[data-val='4']").addClass("btn-info");
    }else if(disp == 6){
      $(".show-select[data-val='6']").addClass("btn-info");
    }else if(disp == 14){
      $(".show-select[data-val='14']").addClass("btn-info");
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
    $('#custom_label').val(scoreboard_data['custom_label'])
  });

function update_db(data){
  scoreboard_query.update(data);
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
  $(".label-btn").click(function(){
    var update={
      custom_label: $("#custom_label").val(),
    };
    console.log(update);
    update_db(update);
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
    scoreboard_collection.doc(game_id).set({
      show:0,
      home_score:0,
      home_fouls:0,
      away_score:0,
      away_fouls:0,
      current_period:1,
      custom_label: "Предматчевая разминка",
      away_team: $("#in_away_team").val(),
      away_color: $("#col_away_team").val(),
      home_team: $("#in_home_team").val(),
      home_color: $("#col_home_team").val(),
    });
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

