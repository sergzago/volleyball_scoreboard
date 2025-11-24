var BEACH_SETS_TO_WIN = 2;
var BEACH_MAX_SETS = 3;
var CLASSIC_POINTS_TO_WIN = 25;
var CLASSIC_SETS_TO_WIN = 3;
var MAX_CLASSIC_SETS = 5;

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

    var beachMode=isBeachMode();
    $('#beach_mode_toggle').prop('checked', beachMode);
    $('.beach-hint').toggleClass('hidden', !beachMode);
    $(".foul-btn").prop('disabled', beachMode);
    $(".period-btn").prop('disabled', beachMode);

    var reminder=scoreboard_data['beach_switch_message'];
    if(beachMode && reminder){
      $(".beach-switch-alert").removeClass("hidden");
      $(".beach-switch-alert .switch-text").text(reminder);
    }else{
      $(".beach-switch-alert").addClass("hidden");
    }
    var beachFinished = beachMode && scoreboard_data['beach_match_finished'];
    if(beachFinished){
      $(".beach-match-status").removeClass("hidden").text("Матч завершён");
    }else{
      $(".beach-match-status").addClass("hidden").text("");
    }
    var classicFinished = (!beachMode) && scoreboard_data['classic_match_finished'];
    var matchFinished = beachFinished || classicFinished;
    $(".score-btn").prop('disabled', !!matchFinished);

    //$("#show").prop("checked",(scoreboard_data['show']));
    $('#away_score').html(scoreboard_data['away_score'])
    $('#away_fouls').html(beachMode ? ensureNumber(scoreboard_data['away_sets']) : scoreboard_data['away_fouls'])
    $('.home_team').html(scoreboard_data['home_team'])
    $('#in_home_team').val(scoreboard_data['home_team'])
    $('#in_away_team').val(scoreboard_data['away_team'])
    $('#col_home_team').val(scoreboard_data['home_color'])
    $('#col_away_team').val(scoreboard_data['away_color'])
    $('#home_score').html(scoreboard_data['home_score'])
    $('#home_fouls').html(beachMode ? ensureNumber(scoreboard_data['home_sets']) : scoreboard_data['home_fouls'])
    $('#period').html(scoreboard_data['current_period'])
    $('#custom_label').val(scoreboard_data['custom_label'])
    updateSideLayout();
  });

function update_db(data){
  scoreboard_query.update(data);
}

function ensureNumber(value){
  var parsed=parseInt(value,10);
  if(isNaN(parsed))
    return 0;
  return parsed;
}

function getOppositeSide(side){
  return side==='right'?'left':'right';
}

function getHomeSide(){
  return scoreboard_data['home_side'] || 'left';
}

function getTeamSide(team){
  if(team==='home')
    return getHomeSide();
  return getOppositeSide(getHomeSide());
}

function flipSidesPayload(extra){
  var newHomeSide=getOppositeSide(getHomeSide());
  var payload={
    home_side:newHomeSide,
    away_side:getOppositeSide(newHomeSide)
  };
  if(extra)
    Object.assign(payload, extra);
  return payload;
}

function sideLabelText(side){
  return side==='left'?'Слева от судьи':'Справа от судьи';
}

function updateSideLayout(){
  if(typeof scoreboard_data['home_side']==='undefined'){
    scoreboard_data['home_side']='left';
    scoreboard_data['away_side']='right';
    update_db({home_side:'left', away_side:'right'});
  }
  var homeSide=getHomeSide();
  var awaySide=getTeamSide('away');
  var homeOrder=homeSide==='left'?1:2;
  var awayOrder=homeOrder===1?2:1;
  $(".score-row .home-col").css('order',homeOrder);
  $(".score-row .away-col").css('order',awayOrder);
  $(".home_side_label").text(sideLabelText(homeSide));
  $(".away_side_label").text(sideLabelText(awaySide));
  $("input[name='side_control'][value='home']").prop('checked', homeSide==='left');
  $("input[name='side_control'][value='away']").prop('checked', homeSide!=='left');
}

function shouldClassicMidSwitch(homeAfter, awayAfter){
  if(isBeachMode())
    return false;
  if(ensureNumber(scoreboard_data['current_period'])!=5)
    return false;
  if(scoreboard_data['classic_tiebreak_switch_done'])
    return false;
  if(Math.max(homeAfter, awayAfter)<8)
    return false;
  return true;
}

function isBeachMode(){
  return !!scoreboard_data['beach_mode'];
}

function getBeachSetNumber(){
  var setNumber=ensureNumber(scoreboard_data['beach_current_set']);
  if(!setNumber){
    setNumber=ensureNumber(scoreboard_data['current_period']);
  }
  if(setNumber<=0)
    setNumber=1;
  if(setNumber>BEACH_MAX_SETS)
    setNumber=BEACH_MAX_SETS;
  return setNumber;
}

function getBeachTarget(setNumber){
  if(setNumber>=3)
    return 15;
  return 21;
}

function getBeachSwitchInterval(setNumber){
  if(setNumber>=3)
    return 5;
  return 7;
}

function formatScore(homeScore, awayScore){
  return homeScore+":"+awayScore;
}

function hasTeamWonSet(team, homeScore, awayScore, target){
  var diff=Math.abs(homeScore-awayScore);
  if(team=='home')
    return (homeScore>=target)&&(diff>=2);
  return (awayScore>=target)&&(diff>=2);
}

function cloneSetHistory(){
  var history=scoreboard_data['set_history'];
  if(!Array.isArray(history))
    return [];
  return history.slice(0, MAX_CLASSIC_SETS);
}

function nextSetHistory(homeScore, awayScore){
  var history=cloneSetHistory();
  history.push({home:homeScore, away:awayScore});
  if(history.length>MAX_CLASSIC_SETS){
    history.shift();
  }
  return history;
}

function handleBeachScore(team, delta){
  if(scoreboard_data['beach_match_finished'])
    return;
  var scoreKey=team+'_score';
  var otherKey=team=='home'?'away_score':'home_score';
  var currentScore=ensureNumber(scoreboard_data[scoreKey]);
  var newScore=currentScore+delta;
  if(newScore<0)
    return;
  var otherScore=ensureNumber(scoreboard_data[otherKey]);
  var update={};
  update[scoreKey]=newScore;

  var setNumber=getBeachSetNumber();
  var target=getBeachTarget(setNumber);
  var interval=getBeachSwitchInterval(setNumber);
  var homeBefore=ensureNumber(scoreboard_data['home_score']);
  var awayBefore=ensureNumber(scoreboard_data['away_score']);
  var totalBefore=homeBefore+awayBefore;
  var totalAfter=totalBefore+delta;

  if(delta>0 && Math.floor(totalAfter/interval)>Math.floor(totalBefore/interval)){
    var homeAfter = team=='home'?newScore:otherScore;
    var awayAfter = team=='home'?otherScore:newScore;
    update['beach_switch_message']='Смена площадок — '+setNumber+' сет, счёт '+formatScore(homeAfter, awayAfter);
  }

  var homeAfterScore=team=='home'?newScore:otherScore;
  var awayAfterScore=team=='home'?otherScore:newScore;
  if(delta>0 && hasTeamWonSet(team, homeAfterScore, awayAfterScore, target)){
    applyBeachSetWin(team, homeAfterScore, awayAfterScore, update);
  }else{
    update_db(update);
  }
}

function applyBeachSetWin(team, homeScore, awayScore, baseUpdate){
  var homeSets=ensureNumber(scoreboard_data['home_sets']);
  var awaySets=ensureNumber(scoreboard_data['away_sets']);
  if(team=='home'){
    homeSets++;
  }else{
    awaySets++;
  }
  var matchFinished=(homeSets>=BEACH_SETS_TO_WIN)||(awaySets>=BEACH_SETS_TO_WIN);
  var currentSet=getBeachSetNumber();
  var update=Object.assign({}, baseUpdate || {});
  update['home_sets']=homeSets;
  update['away_sets']=awaySets;
  if(!('beach_switch_message' in update)){
    update['beach_switch_message']='';
  }

  if(matchFinished || currentSet>=BEACH_MAX_SETS){
    update['beach_match_finished']=true;
    update['home_score']=homeScore;
    update['away_score']=awayScore;
    update['current_period']=currentSet;
    update['beach_current_set']=currentSet;
  }else{
    var nextSet=currentSet+1;
    update['beach_current_set']=nextSet;
    update['current_period']=nextSet;
    update['home_score']=0;
    update['away_score']=0;
  }
  update['set_history']=nextSetHistory(homeScore, awayScore);
  update_db(update);
}

function toggleBeachMode(enabled){
  var update={
    beach_mode:enabled,
    beach_match_finished:false,
    set_history:[],
    classic_match_finished:false,
    classic_tiebreak_switch_done:true
  };
  if(enabled){
    update['home_sets']=0;
    update['away_sets']=0;
    update['home_score']=0;
    update['away_score']=0;
    update['beach_current_set']=1;
    update['current_period']=1;
    update['beach_switch_message']='';
    update['period_count']=3;
    update['classic_match_finished']=false;
  }else{
    update['beach_switch_message']='';
    update['home_sets']=0;
    update['away_sets']=0;
    update['beach_current_set']=1;
    update['period_count']=5;
    update['home_score']=0;
    update['away_score']=0;
  }
  update_db(update);
}

function classicSetWon(teamScore, opponentScore){
  if(teamScore<CLASSIC_POINTS_TO_WIN)
    return false;
  return (teamScore-opponentScore)>=2;
}

function applyClassicSetWin(team, teamScore, opponentScore, baseUpdate){
  var homeFouls=ensureNumber(scoreboard_data['home_fouls']);
  var awayFouls=ensureNumber(scoreboard_data['away_fouls']);
  if(team=='home'){
    homeFouls++;
  }else{
    awayFouls++;
  }
  var currentPeriod=ensureNumber(scoreboard_data['current_period'])||1;
  var maxPeriod=ensureNumber(scoreboard_data['period_count'])||5;
  var nextPeriod=currentPeriod<maxPeriod?currentPeriod+1:currentPeriod;
  var homeFinal = team=='home'?teamScore:opponentScore;
  var awayFinal = team=='home'?opponentScore:teamScore;
  var matchFinished=(homeFouls>=CLASSIC_SETS_TO_WIN)||(awayFouls>=CLASSIC_SETS_TO_WIN);
  var update=Object.assign({}, baseUpdate, {
    home_fouls:homeFouls,
    away_fouls:awayFouls,
    current_period:matchFinished?currentPeriod:nextPeriod,
    classic_match_finished:matchFinished
  });
  if(!matchFinished){
    Object.assign(update, flipSidesPayload({
      classic_tiebreak_switch_done: nextPeriod==5 ? false : true
    }));
  }else{
    update['classic_tiebreak_switch_done']=true;
  }
  if(matchFinished){
    update['home_score']=homeFinal;
    update['away_score']=awayFinal;
  }else{
    update['home_score']=0;
    update['away_score']=0;
  }
  update['set_history']=nextSetHistory(homeFinal, awayFinal);
  update_db(update);
}

function handleClassicScore(team, delta){
  if(scoreboard_data['classic_match_finished'])
    return;
  var scoreKey=team+'_score';
  var otherKey=team=='home'?'away_score':'home_score';
  var currentScore=ensureNumber(scoreboard_data[scoreKey]);
  var newScore=currentScore+delta;
  if(newScore<0)
    return;
  var update={};
  update[scoreKey]=newScore;
  if(delta>0){
    var otherScore=ensureNumber(scoreboard_data[otherKey]);
    var homeAfter=team=='home'?newScore:ensureNumber(scoreboard_data['home_score']);
    var awayAfter=team=='home'?otherScore:newScore;
    if(shouldClassicMidSwitch(homeAfter, awayAfter)){
      Object.assign(update, flipSidesPayload({classic_tiebreak_switch_done:true}));
    }
    if(classicSetWon(newScore, otherScore)){
      applyClassicSetWin(team, newScore, otherScore, update);
      return;
    }
  }
  update_db(update);
}

$(document).ready(function(){
  $(".show-select").click(function(){
    var button=$(this).data('val');
    update_db({show:button})
  });

  $(".score-btn").click(function(){
    var button=$(this);
    var delta=parseInt(button.text(),10)
    if(isNaN(delta))
      delta=0;
    if(isBeachMode()){
      handleBeachScore(button.data('team'), delta);
      return;
    }
    handleClassicScore(button.data('team'), delta);
  });
  $(".foul-btn").click(function(){
    if(isBeachMode())
      return;
    var button=$(this);
    var delta=parseInt(button.text(),10)
    if(isNaN(delta))
      return;
    if(button.data('team')=='home'){
      var newHomeFouls=ensureNumber(scoreboard_data['home_fouls'])+delta;
      if(delta>0 || newHomeFouls>=0)
        update_db({home_fouls:newHomeFouls})
    }else{
      var newAwayFouls=ensureNumber(scoreboard_data['away_fouls'])+delta;
      if(delta>0 || newAwayFouls>=0)
        update_db({away_fouls:newAwayFouls})
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
    var beachEnabled=isBeachMode();
    scoreboard_collection.doc(game_id).set({
      show:0,
      home_score:0,
      home_fouls:0,
      away_score:0,
      away_fouls:0,
      current_period:1,
      custom_label: "Таймаут",
      away_team: $("#in_away_team").val(),
      away_color: $("#col_away_team").val(),
      home_team: $("#in_home_team").val(),
      home_color: $("#col_home_team").val(),
      home_sets:0,
      away_sets:0,
      beach_mode:beachEnabled,
      beach_current_set:1,
      beach_switch_message:'',
      beach_match_finished:false,
      period_count: beachEnabled ? 3 : 5,
      set_history:[],
      classic_match_finished:false,
      home_side:'left',
      away_side:'right',
      classic_tiebreak_switch_done:true
    });
  });
  $(".period-btn").click(function(){
    if(isBeachMode())
      return;
    var button=$(this);
    var delta=parseInt(button.text(),10)
    if(isNaN(delta))
      return;
    var currentPeriod=ensureNumber(scoreboard_data['current_period']);
    var new_period=currentPeriod+delta
    var max_period=ensureNumber(scoreboard_data['period_count'])||5
    var hs=ensureNumber(scoreboard_data['home_score'])
    var as=ensureNumber(scoreboard_data['away_score'])
    var hf=ensureNumber(scoreboard_data['home_fouls'])
    var af=ensureNumber(scoreboard_data['away_fouls'])
    if(hs>as){hf++}
    if(as>hs){af++}
    if((new_period>0)&&(new_period<=max_period)){
      var update={
        current_period:new_period,
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

  $("#beach_mode_toggle").change(function(){
    toggleBeachMode($(this).is(':checked'));
  });

  $(".beach-switch-reset").click(function(){
    var update={beach_switch_message:''};
    if(isBeachMode()){
      Object.assign(update, flipSidesPayload());
    }
    update_db(update);
  });

  $("input[name='side_control']").change(function(){
    var val=$(this).val();
    if(val==='home'){
      update_db({home_side:'left', away_side:'right'});
    }else if(val==='away'){
      update_db({home_side:'right', away_side:'left'});
    }
  });
});
