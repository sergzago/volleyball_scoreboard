var BEACH_SETS_TO_WIN = 2;
var BEACH_MAX_SETS = 3;
var CLASSIC_POINTS_TO_WIN = 25;
var CLASSIC_SETS_TO_WIN = 3;
var MAX_CLASSIC_SETS = 5;
// Константы для режима до двух побед
var CLASSIC_SETS_TO_WIN_TWO = 2;
var CLASSIC_MAX_SETS_TWO = 3;
var CLASSIC_TIEBREAK_POINTS_TO_WIN = 15;

// Данные для отложенного завершения матча (ожидание подтверждения пользователя)
var pendingMatchFinish = null;
// Запоминваем, был ли матч уже завершён ПРЕЖДЕ чем мы начали играть
var matchWasAlreadyFinished = false;
// Счётчик обновлений подписки — для определения первой загрузки
var _subscribeCallCount = 0;

// scoreboard_data определена в common.js

// Получение информации о текущем пользователе
function getCurrentUserInfo() {
  // Через DB интерфейс (работает для обоих провайдеров)
  if (DB.getProvider() === 'firebase') {
    const user = firebase.auth().currentUser;
    if (!user) return {};
    return {
      username: user.email.split('@')[0],
      displayname: user.displayName || user.email.split('@')[0]
    };
  }

  // PocketBase
  if (DB.auth.getAuthInstance && DB.auth.getAuthInstance()) {
    const pb = typeof PocketBase !== 'undefined' ? new PocketBase(DB_CONFIG.pocketbase.url) : null;
    if (pb && pb.authStore.isValid && pb.authStore.model) {
      const record = pb.authStore.model;
      return {
        username: record.username || record.email.split('@')[0],
        displayname: record.displayName || record.username || record.email.split('@')[0]
      };
    }
  }
  return {};
}

/**
 * Показать модальное окно подтверждения завершения матча.
 * Сохраняет pending-данные и ждёт выбора пользователя.
 * НЕ показывает диалог, если матч уже был завершён до текущего действия.
 */
function showMatchFinishDialog(update, setHistory, overallHome, overallAway, mode) {
  console.log('[MATCH] showMatchFinishDialog вызван. mode:', mode, 'matchWasAlreadyFinished:', matchWasAlreadyFinished,
    'beach_match_finished:', scoreboard_data['beach_match_finished'], 'classic_match_finished:', scoreboard_data['classic_match_finished']);

  // Не показываем диалог, если матч уже был завершён при загрузке страницы
  if (matchWasAlreadyFinished) {
    // Матч уже завершён — просто обновляем БД без диалога
    console.log('[MATCH] Диалог пропущен — матч загружен завершённым');
    saveMatchResult(setHistory, overallHome, overallAway);
    update_db(update);
    return;
  }

  var homeTeam = scoreboard_data['home_team'] || 'Команда 1';
  var awayTeam = scoreboard_data['away_team'] || 'Команда 2';
  var scoreText = overallHome + ':' + overallAway;
  var winner = overallHome > overallAway ? homeTeam : awayTeam;

  $('#matchFinishText').html(
    'Игра завершена!<br>' +
    'Победитель: <b>' + winner + '</b> (' + scoreText + ')<br><br>' +
    'Завершить игру?'
  );

  // Сохраняем данные для последующего использования
  pendingMatchFinish = {
    update: update,
    setHistory: setHistory,
    overallHome: overallHome,
    overallAway: overallAway,
    mode: mode
  };

  $('#matchFinishModal').removeClass('dialog-hidden');
}

/**
 * Подтвердить завершение матча — сохранить результат и обновить БД.
 */
function confirmMatchFinish() {
  if (!pendingMatchFinish) return;

  var data = pendingMatchFinish;
  saveMatchResult(data.setHistory, data.overallHome, data.overallAway);
  update_db(data.update);

  // Обновляем UI кнопок
  var matchFinished = true;
  var pendingNewSet = false;
  $(".score-btn").prop('disabled', true);
  $(".new-set-btn").prop('disabled', true);
  $(".beach-match-status").removeClass("hidden").text("Матч завершён");

  pendingMatchFinish = null;
  $('#matchFinishModal').addClass('dialog-hidden');
}

/**
 * Отменить завершение матча — НЕ фиксировать счёт и результат сета.
 * Возвращаем игру в состояние до выигрышного очка.
 */
function cancelMatchFinish() {
  if (!pendingMatchFinish) return;

  // НЕ вызываем update_db — счёт и результат сета НЕ фиксируются.
  // Очко, которое привело к завершению матча, не засчитывается.
  // Кнопки очков разблокируются, игра продолжается с текущим счётом.

  // Обновляем UI — сбрасываем статус ожидания
  $(".score-btn").prop('disabled', false);
  $(".new-set-btn").prop('disabled', true);
  $(".beach-match-status").addClass("hidden").text("");

  // Сбрасываем флаг — теперь диалог может снова появиться при завершении
  matchWasAlreadyFinished = false;

  pendingMatchFinish = null;
  $('#matchFinishModal').addClass('dialog-hidden');
}

// Подписка на изменения после загрузки DOM
$(document).ready(function() {
  // Инициализируем DB
  DB.init().then(function() {
    // Подписка на изменения через DB интерфейс
    DB.scoreboard.subscribe(
      game_id,
      function(data) {
        if (!data) {
          console.warn('Document does not exist:', game_id);
          return;
        }
        $(".hidden").removeClass("hidden");
        scoreboard_data = data;

        // Проверяем завершение матча ТОЛЬКО при первой загрузке (не при каждом обновлении)
        _subscribeCallCount++;
        if (_subscribeCallCount === 1) {
          var beachMode = !!scoreboard_data['beach_mode'];
          var beachFinished = beachMode && scoreboard_data['beach_match_finished'];
          var classicFinished = (!beachMode) && scoreboard_data['classic_match_finished'];
          if (beachFinished || classicFinished) {
            matchWasAlreadyFinished = true;
            console.log('[MATCH] Матч загружен в завершённом состоянии. beachFinished:', beachFinished, 'classicFinished:', classicFinished, 'matchWasAlreadyFinished:', matchWasAlreadyFinished);
          }
        }

      $('.away_team').html(scoreboard_data['away_team'])
      $('.home_team').html(scoreboard_data['home_team'])
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
    }

    var beachMode=isBeachMode();
    $('#beach_mode_toggle').prop('checked', beachMode);
    $('.beach-hint').toggleClass('hidden', !beachMode);
    // Кнопки foul и period доступны всегда
    var invertTablo = !!scoreboard_data['invert_tablo'];
    $('#invert_tablo_toggle').prop('checked', invertTablo);
    var unlimitedScore = !!scoreboard_data['unlimited_score'];
    $('#unlimited_score_toggle').prop('checked', unlimitedScore);
    var twoWinsMode = !!scoreboard_data['two_wins_mode'];
    $('#two_wins_mode_toggle').prop('checked', twoWinsMode);
    
    // Блокировка чекбоксов: beach_mode и two_wins_mode не могут быть выбраны одновременно
    $('#two_wins_mode_toggle').prop('disabled', beachMode);
    $('#beach_mode_toggle').prop('disabled', twoWinsMode);
    
    // Добавляем класс для стилизации заблокированных label
    $('#two_wins_mode_toggle').parent('label').toggleClass('disabled-label', beachMode);
    $('#beach_mode_toggle').parent('label').toggleClass('disabled-label', twoWinsMode);

    var reminder=scoreboard_data['beach_switch_message'];
    var sideSwitchBtn=$(".side-switch-btn");
    var classicSwitchNeeded = !!scoreboard_data['classic_switch_needed'];
    if((beachMode && reminder) || classicSwitchNeeded){
      sideSwitchBtn.css('background-color', '#ff0000').css('color', '#ffffff');
    }else{
      sideSwitchBtn.css('background-color', '').css('color', '');
    }
    var beachFinished = beachMode && scoreboard_data['beach_match_finished'];
    var classicFinished = (!beachMode) && scoreboard_data['classic_match_finished'];
    // Учитываем pendingMatchFinish — матч в процессе подтверждения
    var matchPending = !!pendingMatchFinish;
    if(beachFinished || classicFinished || matchPending){
      $(".beach-match-status").removeClass("hidden").text(matchPending ? "Ожидание подтверждения..." : "Матч завершён");
    }else{
      $(".beach-match-status").addClass("hidden").text("");
    }
    var matchFinished = beachFinished || classicFinished || matchPending;
    var pendingNewSet = !!scoreboard_data['pending_new_set'];
    var startOfSet = (ensureNumber(scoreboard_data['home_score'])===0) && (ensureNumber(scoreboard_data['away_score'])===0);

    // Блокировка кнопок в блоке "Сет" (очки) после завершения сета или при ожидании подтверждения
    var scoreButtonsDisabled = pendingNewSet || matchFinished;

    // Блокировка кнопок в блоке "Счёт" (фолы) в середине сета
    var foulButtonsDisabled = !startOfSet && !pendingNewSet && !matchFinished;

    // Disable score buttons after set finished (pending new set)
    $(".score-btn").prop('disabled', scoreButtonsDisabled);

    // Disable foul buttons in middle of set
    $(".foul-btn").filter(function(){
      return parseInt($(this).text(),10) > 0;
    }).prop('disabled', matchFinished || pendingNewSet || foulButtonsDisabled);

    $(".foul-btn").filter(function(){
      return parseInt($(this).text(),10) < 0;
    }).prop('disabled', matchFinished || foulButtonsDisabled);

    // New Set button enabled only when there's a pending new set (and not waiting for confirmation)
    $(".new-set-btn").prop('disabled', !pendingNewSet || matchFinished);
    // Highlight button with red background when pending new set
    if(pendingNewSet && !matchFinished){
      $(".new-set-btn").css('background-color', '#ff0000').css('color', '#ffffff');
    }else{
      $(".new-set-btn").css('background-color', '').css('color', '');
    }
    // Period buttons: enable only at initial moment or after set/match end (but not during confirmation)
    var unlimitedScore = !!scoreboard_data['unlimited_score'];
    var enablePeriodButtons = (unlimitedScore || startOfSet || pendingNewSet || !!scoreboard_data['classic_match_finished'] || !!scoreboard_data['beach_match_finished']) && !matchPending;
    var periodDisabled = !enablePeriodButtons;
    $(".period-btn").prop('disabled', periodDisabled);

    //$("#show").prop("checked",(scoreboard_data['show']));
    $('#away_score').html(scoreboard_data['away_score'])
    $('#away_fouls').html(beachMode ? ensureNumber(scoreboard_data['away_sets']) : scoreboard_data['away_fouls'])
    $('.home_team').html(scoreboard_data['home_team'])
    $('#in_home_team').val(scoreboard_data['home_team'])
    $('#in_away_team').val(scoreboard_data['away_team'])
    $('#in_tournament').val(scoreboard_data['tournament_name'] || 'НВЛ');
    if(typeof scoreboard_data['tournament_name'] === 'undefined'){
      update_db({tournament_name: 'НВЛ'});
    }
    if(typeof scoreboard_data['venue'] === 'undefined'){
      update_db({venue: ''});
    }
    $('#in_venue').val(scoreboard_data['venue'] || '');
    $('#col_home_team').val(scoreboard_data['home_color'])
    $('#col_away_team').val(scoreboard_data['away_color'])
    $('#home_score').html(scoreboard_data['home_score'])
    $('#home_fouls').html(beachMode ? ensureNumber(scoreboard_data['home_sets']) : scoreboard_data['home_fouls'])
    $('#period').html(scoreboard_data['current_period'])
    $('#custom_label').val(scoreboard_data['custom_label'])
    updateSideLayout();
    renderSetHistoryCtl(scoreboard_data['set_history']);
      },
      function(error) {
        console.error('Error listening to scoreboard:', error);
      }
    );
  }).catch(function(err) {
    console.error('DB initialization failed:', err);
  });
});

function update_db(data){
  // Добавляем информацию о пользователе, который редактирует
  var userInfo = getCurrentUserInfo();
  if (userInfo.username) {
    data.username = userInfo.username;
    data.displayname = userInfo.displayname;
  }
  data.lastEdited = DB.serverTimestamp();
  scoreboard_query.update(data);
}

function saveMatchResult(setHistory, overallHome, overallAway){
  var isBeach = isBeachMode();
  var twoWinsMode = !!scoreboard_data['two_wins_mode'];
  var userInfo = getCurrentUserInfo();

  if(typeof overallHome === 'undefined' || typeof overallAway === 'undefined'){
    if(isBeach){
      overallHome = ensureNumber(scoreboard_data['home_sets']);
      overallAway = ensureNumber(scoreboard_data['away_sets']);
    }else{
      overallHome = ensureNumber(scoreboard_data['home_fouls']);
      overallAway = ensureNumber(scoreboard_data['away_fouls']);
    }
  }

  var matchData = {
    date_time: DB.serverTimestamp(),
    home_team: scoreboard_data['home_team'],
    away_team: scoreboard_data['away_team'],
    tournament_name: scoreboard_data['tournament_name'] || 'НВЛ',
    venue: scoreboard_data['venue'] || '', // Сохраняем значение поля "Зал"
    overall_score: overallHome + ':' + overallAway,
    sets_score: setHistory || scoreboard_data['set_history'] || [],
    game_type: isBeach ? 'beach' : 'classic',
    two_wins_mode: twoWinsMode, // Режим до двух побед
    game_id: game_id,
    username: userInfo.username || '',
    displayname: userInfo.displayname || '',
    is_deleted: false // Флаг удаления (для возможности отмены)
  };

  matches_collection.add(matchData).then(function(docRef) {
    console.log('Match result saved with ID: ', docRef.id);
    // Сохраняем ID последнего матча в scoreboard для возможности удаления при сбросе
    scoreboard_collection.doc(game_id).update({
      last_match_id: docRef.id
    }).catch(function(error) {
      console.error('Error saving last_match_id: ', error);
    });
  }).catch(function(error) {
    console.error('Error saving match result: ', error);
  });
}

function performNewSetUpdate(){
  var update = {
    home_score: 0,
    away_score: 0,
    beach_switch_message: ''
  };
  if(isBeachMode()){
    var nextSet = scoreboard_data['next_beach_set'];
    if(!nextSet){
      nextSet = ensureNumber(scoreboard_data['beach_current_set']) + 1;
    }
    update['beach_current_set'] = nextSet;
    update['current_period'] = nextSet;
    update['next_beach_set'] = DB.deleteField();
    update['pending_new_set'] = DB.deleteField();
    update_db(update);
    return;
  }
  var nextPeriod = scoreboard_data['next_period'];
  if(!nextPeriod){
    nextPeriod = ensureNumber(scoreboard_data['current_period']) + 1;
  }
  update['current_period'] = nextPeriod;
  if(typeof scoreboard_data['pending_home_side'] !== 'undefined' && scoreboard_data['pending_home_side'] !== null){
    update['home_side'] = scoreboard_data['pending_home_side'];
  }
  if(typeof scoreboard_data['pending_away_side'] !== 'undefined' && scoreboard_data['pending_away_side'] !== null){
    update['away_side'] = scoreboard_data['pending_away_side'];
  }
  if(typeof scoreboard_data['pending_classic_tiebreak_switch_done'] !== 'undefined' && scoreboard_data['pending_classic_tiebreak_switch_done'] !== null){
    update['classic_tiebreak_switch_done'] = scoreboard_data['pending_classic_tiebreak_switch_done'];
  }
  // clear pending fields
  update['next_period'] = DB.deleteField();
  update['pending_home_side'] = DB.deleteField();
  update['pending_away_side'] = DB.deleteField();
  update['pending_classic_tiebreak_switch_done'] = DB.deleteField();
  update['pending_new_set'] = DB.deleteField();
  update_db(update);
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
  $("input[name='side_control'][value='home']").prop('checked', homeSide==='left');
  $("input[name='side_control'][value='away']").prop('checked', homeSide!=='left');
}

function shouldClassicMidSwitch(homeAfter, awayAfter){
  if(isBeachMode())
    return false;
  
  var twoWinsMode = !!scoreboard_data['two_wins_mode'];
  var currentPeriod = ensureNumber(scoreboard_data['current_period']);
  
  // Определяем номер сета, в котором нужна смена сторон
  var tiebreakSet = twoWinsMode ? 3 : 5;
  
  if(currentPeriod != tiebreakSet)
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
  // Проверка завершенности матча для обоих режимов
  if(scoreboard_data['beach_match_finished'] || scoreboard_data['classic_match_finished'] || pendingMatchFinish)
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
    applySetWin(team, homeAfterScore, awayAfterScore, update);
  }else{
    update_db(update);
  }
}

function applySetWin(team, homeScore, awayScore, baseUpdate){
  var beachMode = !!scoreboard_data['beach_mode'];

  if(beachMode) {
    // Логика пляжного волейбола
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
      update['home_score']=homeScore;
      update['away_score']=awayScore;
      update['next_beach_set']=nextSet;
      update['pending_new_set']=true;
    }
    var updatedHistory = nextSetHistory(homeScore, awayScore);
    update['set_history']=updatedHistory;

    if(matchFinished && !matchWasAlreadyFinished) {
      // Показываем диалог подтверждения завершения матча
      console.log('[MATCH] applySetWin (beach): matchFinished=true, показываем диалог');
      showMatchFinishDialog(update, updatedHistory, homeSets, awaySets, 'beach');
    } else {
      update_db(update);
      if(matchFinished) {
        console.log('[MATCH] applySetWin (beach): matchFinished=true, но matchWasAlreadyFinished=true — диалог пропущен');
      }
    }
  } else {
    // Логика классического волейбола - используем fouls для подсчета сетов
    var homeFouls=ensureNumber(scoreboard_data['home_fouls']);
    var awayFouls=ensureNumber(scoreboard_data['away_fouls']);
    if(team=='home'){
      homeFouls++;
    }else{
      awayFouls++;
    }
    var matchFinished=(homeFouls>=CLASSIC_SETS_TO_WIN)||(awayFouls>=CLASSIC_SETS_TO_WIN);
    var currentPeriod=ensureNumber(scoreboard_data['current_period'])||1;
    var maxPeriod=ensureNumber(scoreboard_data['period_count'])||5;
    var nextPeriod=currentPeriod<maxPeriod?currentPeriod+1:currentPeriod;
    var update=Object.assign({}, baseUpdate, {
      home_fouls:homeFouls,
      away_fouls:awayFouls,
      current_period: currentPeriod,
      classic_match_finished:matchFinished
    });
    if(!matchFinished){
      var flip = flipSidesPayload({
        classic_tiebreak_switch_done: nextPeriod==5 ? false : true
      });
      update['pending_home_side'] = flip.home_side;
      update['pending_away_side'] = flip.away_side;
      update['pending_classic_tiebreak_switch_done'] = flip.classic_tiebreak_switch_done;
      update['next_period'] = nextPeriod;
      update['pending_new_set'] = true;
    }else{
      update['classic_tiebreak_switch_done']=true;
    }
    update['home_score']=homeScore;
    update['away_score']=awayScore;
    var updatedHistory = nextSetHistory(homeScore, awayScore);
    update['set_history']=updatedHistory;

    if(matchFinished && !matchWasAlreadyFinished) {
      // Показываем диалог подтверждения завершения матча
      console.log('[MATCH] applySetWin (classic): matchFinished=true, показываем диалог');
      showMatchFinishDialog(update, updatedHistory, homeFouls, awayFouls, 'classic');
    } else if(matchFinished && matchWasAlreadyFinished) {
      // Матч уже был завершён — просто сохраняем и обновляем
      console.log('[MATCH] applySetWin (classic): matchFinished=true, но matchWasAlreadyFinished=true — диалог пропущен');
      saveMatchResult(updatedHistory, homeFouls, awayFouls);
      update_db(update);
    } else {
      update_db(update);
    }
  }
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
    update['two_wins_mode']=false; // Отключаем режим до 2 побед если включили пляжный
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

function toggleTwoWinsMode(enabled){
  var update={
    two_wins_mode:enabled,
    classic_match_finished:false,
    set_history:[],
    beach_match_finished:false
  };
  if(enabled){
    update['home_fouls']=0;
    update['away_fouls']=0;
    update['home_score']=0;
    update['away_score']=0;
    update['current_period']=1;
    update['period_count']=3; // Максимум 3 сета
    update['classic_tiebreak_switch_done']=true;
    update['beach_mode']=false; // Отключаем пляжный режим если включили до 2 побед
  }else{
    update['home_fouls']=0;
    update['away_fouls']=0;
    update['home_score']=0;
    update['away_score']=0;
    update['current_period']=1;
    update['period_count']=5; // Возвращаем к стандартным 5 сетам
  }
  update_db(update);
}

function classicSetWon(teamScore, opponentScore){
  // В режиме до 2 побед играем до 2 сетов (максимум 3 сета)
  // В 3-м сете (тай-брейк) игра идет до 15 очков
  var period = ensureNumber(scoreboard_data['current_period']);
  var twoWinsMode = !!scoreboard_data['two_wins_mode'];
  
  // Определяем целевое количество очков для текущего сета
  var target;
  if (twoWinsMode) {
    // Режим до 2 побед: 3-й сет (тай-брейк) играется до 15
    target = (period === 3) ? CLASSIC_TIEBREAK_POINTS_TO_WIN : CLASSIC_POINTS_TO_WIN;
  } else {
    // Стандартный режим: 5-й сет (тай-брейк) играется до 15
    target = (period === 5) ? 15 : CLASSIC_POINTS_TO_WIN;
  }
  
  if(teamScore < target)
    return false;
  return (teamScore - opponentScore) >= 2;
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
  var twoWinsMode = !!scoreboard_data['two_wins_mode'];
  
  // Определяем условие завершения матча
  var setsToWin = twoWinsMode ? CLASSIC_SETS_TO_WIN_TWO : CLASSIC_SETS_TO_WIN;
  var matchFinished=(homeFouls>=setsToWin)||(awayFouls>=setsToWin);
  
  var nextPeriod=currentPeriod<maxPeriod?currentPeriod+1:currentPeriod;
  var homeFinal = team=='home'?teamScore:opponentScore;
  var awayFinal = team=='home'?opponentScore:teamScore;
  var update=Object.assign({}, baseUpdate, {
    home_fouls:homeFouls,
    away_fouls:awayFouls,
    // Не увеличиваем current_period автоматически — оставляем текущий номер сета
    current_period: currentPeriod,
    classic_match_finished:matchFinished
  });
  if(!matchFinished){
    // Не переключаем период автоматически — откладываем переключение и смену сторон
    // В режиме до 2 побед тай-брейк это 3-й сет
    var tiebreakSet = twoWinsMode ? 3 : 5;
    var flip = flipSidesPayload({
      classic_tiebreak_switch_done: nextPeriod==tiebreakSet ? false : true
    });
    update['pending_home_side'] = flip.home_side;
    update['pending_away_side'] = flip.away_side;
    update['pending_classic_tiebreak_switch_done'] = flip.classic_tiebreak_switch_done;
    update['next_period'] = nextPeriod;
    update['pending_new_set'] = true;
  }else{
    update['classic_tiebreak_switch_done']=true;
  }
  // После выигрыша сета оставляем текущий (финальный) счёт видимым.
  // Сброс очков в новый сет происходит по нажатию кнопки "Новый сет".
  update['home_score']=homeFinal;
  update['away_score']=awayFinal;
  var updatedHistory = nextSetHistory(homeFinal, awayFinal);
  update['set_history']=updatedHistory;

  if(matchFinished && !matchWasAlreadyFinished) {
    // Показываем диалог подтверждения завершения матча
    console.log('[MATCH] applyClassicSetWin: matchFinished=true, показываем диалог');
    showMatchFinishDialog(update, updatedHistory, homeFouls, awayFouls, 'classic');
  } else if(matchFinished && matchWasAlreadyFinished) {
    // Матч уже был завершён — просто сохраняем и обновляем
    console.log('[MATCH] applyClassicSetWin: matchFinished=true, но matchWasAlreadyFinished=true — диалог пропущен');
    saveMatchResult(updatedHistory, homeFouls, awayFouls);
    update_db(update);
  } else {
    update_db(update);
  }
}

function handleClassicScore(team, delta){
  if(scoreboard_data['classic_match_finished'] || pendingMatchFinish)
    return;
  var scoreKey=team+'_score';
  var otherKey=team=='home'?'away_score':'home_score';
  var currentScore=ensureNumber(scoreboard_data[scoreKey]);
  var newScore=currentScore+delta;
  if(newScore<0)
    return;
  var update={};
  update[scoreKey]=newScore;
  var otherScore=ensureNumber(scoreboard_data[otherKey]);
  var homeAfter=team=='home'?newScore:ensureNumber(scoreboard_data['home_score']);
  var awayAfter=team=='home'?otherScore:newScore;

  // If condition for manual mid‑set switch is met, set the flag and message.
  if(shouldClassicMidSwitch(homeAfter, awayAfter)){
    // Only set the visual request once per match/set: if we haven't shown it yet
    if(!scoreboard_data['classic_switch_shown']){
      var twoWinsMode = !!scoreboard_data['two_wins_mode'];
      var tiebreakSet = twoWinsMode ? 3 : 5;
      update['classic_switch_needed'] = true;
      update['classic_switch_message'] = 'Смена площадок — ' + tiebreakSet + '-й сет, счёт '+formatScore(homeAfter, awayAfter);
      update['classic_switch_shown'] = true;
    }
  } else {
    // If condition is no longer met, remove only the 'needed' visual flag/message
    if(scoreboard_data['classic_switch_needed']){
      var DEL = DB.deleteField();
      update['classic_switch_needed'] = DEL;
      update['classic_switch_message'] = DEL;
      // keep 'classic_switch_shown' to avoid re-triggering highlight again
    }
  }

  // In unlimited score mode, don't auto-finalize sets; only update score
  var unlimitedScore = !!scoreboard_data['unlimited_score'];
  if(delta>0 && !unlimitedScore){
    if(classicSetWon(newScore, otherScore)){
      applyClassicSetWin(team, newScore, otherScore, update);
      return;
    }
  }
  update_db(update);
}

function renderSetHistoryCtl(history){
  var items=Array.isArray(history)?history:[];
  var text='';
  if(items.length>0){
    var homeTeam=scoreboard_data['home_team'] || 'Home';
    var awayTeam=scoreboard_data['away_team'] || 'Away';
    var header=homeTeam + ' - ' + awayTeam + ':';
    var scoresParts=[];
    for(var i=0;i<items.length;i++){
      var entry=items[i]||{};
      var homeScore=(entry.home!=null)?entry.home:'-';
      var awayScore=(entry.away!=null)?entry.away:'-';
      scoresParts.push(homeScore + ':' + awayScore);
    }
    var scoresLine=scoresParts.join(' ');
    text=header + '\n' + scoresLine;
  }
  var hasHistory = text.length>0;
  updateHistoryElementCtl('#set-history-ctl', hasHistory, text);
}

function updateHistoryElementCtl(selector, shouldShow, text){
  var el=$(selector);
  if(!el.length)
    return;
  if(!shouldShow){
    el.css('display','none').html('');
    return;
  }
  el.css('display', 'block').html(text.replace(/\n/g, '<br>'));
}

$(document).ready(function(){
  $(".show-select").click(function(){
    var button=$(this).data('val');
    update_db({show:button})
  });

  $(".score-btn").click(function(){
    // Блокировка при ожидании подтверждения завершения матча
    if(pendingMatchFinish) return;

    var button=$(this);
    var delta=parseInt(button.text(),10)
    if(isNaN(delta))
      delta=0;
    var pendingNewSet = !!scoreboard_data['pending_new_set'];
    // If waiting for New Set and operator presses - for the winning team => revert the set
    if(delta < 0 && pendingNewSet){
      var history = Array.isArray(scoreboard_data['set_history'])?scoreboard_data['set_history']:[];
      var last = history.length? history[history.length-1] : null;
      if(last){
        var homeLast = ensureNumber(last.home);
        var awayLast = ensureNumber(last.away);
        var winner = (homeLast > awayLast)? 'home' : (awayLast > homeLast ? 'away' : null);
        if(winner && button.data('team') === winner){
          var update = {};
          if(isBeachMode()){
            // decrement beach sets
            if(winner === 'home'){
              update['home_sets'] = Math.max(0, ensureNumber(scoreboard_data['home_sets']) - 1);
              update['home_score'] = Math.max(0, ensureNumber(scoreboard_data['home_score']) - 1);
            }else{
              update['away_sets'] = Math.max(0, ensureNumber(scoreboard_data['away_sets']) - 1);
              update['away_score'] = Math.max(0, ensureNumber(scoreboard_data['away_score']) - 1);
            }
            // remove last history entry
            var newHist = cloneSetHistory(); newHist.pop();
            update['set_history'] = newHist;
            // clear pending flags
            update['next_beach_set'] = null;
            update['pending_new_set'] = null;
            update['beach_match_finished'] = false;
          }else{
            // classic revert: decrement sets counter stored in fouls field and reduce winner's score by 1
            if(winner === 'home'){
              update['home_fouls'] = Math.max(0, ensureNumber(scoreboard_data['home_fouls']) - 1);
              update['home_score'] = Math.max(0, ensureNumber(scoreboard_data['home_score']) - 1);
            }else{
              update['away_fouls'] = Math.max(0, ensureNumber(scoreboard_data['away_fouls']) - 1);
              update['away_score'] = Math.max(0, ensureNumber(scoreboard_data['away_score']) - 1);
            }
            var newHist2 = cloneSetHistory(); newHist2.pop();
            update['set_history'] = newHist2;
            // clear pending fields
            update['next_period'] = null;
            update['pending_home_side'] = null;
            update['pending_away_side'] = null;
            update['pending_classic_tiebreak_switch_done'] = null;
            update['pending_new_set'] = null;
            update['classic_match_finished'] = false;
          }
          update_db(update);
          return;
        }
      }
    }
    // Используем логику пляжного или классического волейбола в зависимости от режима
    if(isBeachMode()){
      handleBeachScore(button.data('team'), delta);
    }else{
      handleClassicScore(button.data('team'), delta);
    }
  });
  $(".foul-btn").click(function(){
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
      tournament_name: $("#in_tournament").val() || "НВЛ",
      venue: $("#in_venue").val() || "",
    };
    console.log(update);
    update_db(update);
  });

  // Обработчики кнопок модального окна подтверждения завершения матча
  $("#matchFinishYes").click(function(){
    confirmMatchFinish();
  });

  $("#matchFinishNo").click(function(){
    cancelMatchFinish();
  });

  $(".reset-btn").click(function(){
    // Блокировка при ожидании подтверждения завершения матча
    if(pendingMatchFinish) return;

    var beachEnabled=isBeachMode();
    var invertTablo = !!scoreboard_data['invert_tablo'];
    var userInfo = getCurrentUserInfo();

    // Получаем последнюю запись о матче для этой игры
    var lastMatchId = scoreboard_data['last_match_id'];

    // Формируем данные для сброса
    var resetData = {
      show:1, // По умолчанию верхнее табло активно
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
      tournament_name: $("#in_tournament").val(),
      venue: $("#in_venue").val() || "",
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
      classic_tiebreak_switch_done:true,
      invert_tablo:invertTablo,
      unlimited_score:false,
      two_wins_mode:false,
      // Сбрасываем все pending-поля, чтобы разблокировать кнопки "Смена сторон" и "Новый сет"
      pending_new_set: DB.deleteField(),
      next_period: DB.deleteField(),
      next_beach_set: DB.deleteField(),
      pending_home_side: DB.deleteField(),
      pending_away_side: DB.deleteField(),
      pending_classic_tiebreak_switch_done: DB.deleteField(),
      classic_switch_needed: DB.deleteField(),
      classic_switch_shown: DB.deleteField(),
      classic_switch_message: DB.deleteField(),
      lastEdited: DB.serverTimestamp(),
      username: userInfo.username || '',
      displayname: userInfo.displayname || ''
    };

    // Сбрасываем флаг — новая игра, диалог должен снова появиться
    matchWasAlreadyFinished = false;

    scoreboard_collection.doc(game_id).set(resetData)
      .then(function(result) {
        console.log('Scoreboard reset complete:', result);
        // НЕ удаляем последний матч — он должен отображаться в завершенных
        // на странице online.html для просмотра результатов
        // Принудительно обновляем UI из результата
        if (result) {
          scoreboard_data = result;
          $(".hidden").removeClass("hidden");
          $('.away_team').html(scoreboard_data['away_team'] || '');
          $('.home_team').html(scoreboard_data['home_team'] || '');
          $('#in_home_team').val(scoreboard_data['home_team'] || '');
          $('#in_away_team').val(scoreboard_data['away_team'] || '');
          $('#in_tournament').val(scoreboard_data['tournament_name'] || 'НВЛ');
          $('#in_venue').val(scoreboard_data['venue'] || '');
          $('#col_home_team').val(scoreboard_data['home_color'] || '');
          $('#col_away_team').val(scoreboard_data['away_color'] || '');
          $('#home_score').html('0');
          $('#away_score').html('0');
          $('#home_fouls').html('0');
          $('#away_fouls').html('0');
          $('#period').html('1');
        }
      })
      .catch(function(err) {
        console.error('Scoreboard reset failed:', err);
        alert('Ошибка при сбросе: ' + err.message);
      });
  });
  $(".period-btn").click(function(){
    // Блокировка при ожидании подтверждения завершения матча
    if(pendingMatchFinish) return;

    var button=$(this);
    var delta=parseInt(button.text(),10)
    if(isNaN(delta))
      return;
    // If score in set is 0:0 (start of set), period buttons simply change the period number.
    var startOfSet = (ensureNumber(scoreboard_data['home_score'])===0) && (ensureNumber(scoreboard_data['away_score'])===0);
    if(startOfSet){
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
      return;
    }

    // If not startOfSet: +1 behaves like New Set (apply pending new set and reset scores), -1 keeps previous behaviour
    if(delta>0){
      // In unlimited score mode, check if score meets threshold for auto-finalize
      var unlimitedScore = !!scoreboard_data['unlimited_score'];
      var homeScore = ensureNumber(scoreboard_data['home_score']);
      var awayScore = ensureNumber(scoreboard_data['away_score']);
      var currentPeriod = ensureNumber(scoreboard_data['current_period']);
      var target = (currentPeriod === 5) ? 15 : 25;
      
      if(unlimitedScore && homeScore >= target && homeScore - awayScore >= 2){
        // Home team wins with score homeScore:awayScore
        applySetWin('home', homeScore, awayScore, {});
      } else if(unlimitedScore && awayScore >= target && awayScore - homeScore >= 2){
        // Away team wins with score homeScore:awayScore
        applySetWin('away', awayScore, homeScore, {});
      }
      performNewSetUpdate();
      return;
    }
    // -1 pressed: decrement period if allowed
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
    var beachMode = $(this).is(':checked');
    toggleBeachMode(beachMode);
    // Блокируем/разблокируем чекбокс two_wins_mode
    $('#two_wins_mode_toggle').prop('disabled', beachMode);
    $('#two_wins_mode_toggle').parent('label').toggleClass('disabled-label', beachMode);
  });

  $("#invert_tablo_toggle").change(function(){
    update_db({invert_tablo: $(this).is(':checked')});
  });

  $("#unlimited_score_toggle").change(function(){
    update_db({unlimited_score: $(this).is(':checked')});
  });

  $("#two_wins_mode_toggle").change(function(){
    var twoWinsMode = $(this).is(':checked');
    toggleTwoWinsMode(twoWinsMode);
    // Блокируем/разблокируем чекбокс beach_mode
    $('#beach_mode_toggle').prop('disabled', twoWinsMode);
    $('#beach_mode_toggle').parent('label').toggleClass('disabled-label', twoWinsMode);
  });

  $(".side-switch-btn").click(function(){
    var update = {};
    Object.assign(update, flipSidesPayload());
    // Clear classic switch flags and beach switch message by deleting fields
    var DEL = DB.deleteField();
    update['classic_switch_needed'] = DEL;
    update['classic_switch_message'] = DEL;
    update['beach_switch_message'] = DEL;
    update['lastEdited'] = DB.serverTimestamp();
    scoreboard_query.update(update).then(function(){
      // Немедленно возвращаем белый фон кнопки после успешной записи
      $(".side-switch-btn").css('background-color', '').css('color', '');
    }).catch(function(err){
      console.error('Error updating side switch:', err);
      // В любом случае сбросим визуально
      $(".side-switch-btn").css('background-color', '').css('color', '');
    });
  });
  $(".new-set-btn").click(function(){
    // Сбросить счёт для начала нового сета. Остальные параметры (period/set number)
    // уже устанавливаются при фиксации выигрыша сета.
    var update = {
      home_score: 0,
      away_score: 0,
      beach_switch_message: ''
    };
    // Если пляжный режим — выставляем следующий beach set, если он отложен
    if(isBeachMode()){
      var nextSet = scoreboard_data['next_beach_set'];
      if(!nextSet){
        nextSet = ensureNumber(scoreboard_data['beach_current_set']) + 1;
      }
      update['beach_current_set'] = nextSet;
      update['current_period'] = nextSet;
      // Убираем флаг ожидания
      update['next_beach_set'] = null;
      update['pending_new_set'] = null;
      update_db(update);
      return;
    }

    // Классический режим — применяем отложенное переключение периода/сторон, если есть
    var nextPeriod = scoreboard_data['next_period'];
    if(!nextPeriod){
      nextPeriod = ensureNumber(scoreboard_data['current_period']) + 1;
    }
    update['current_period'] = nextPeriod;
    // Применяем отложенную смену сторон и флаг tiebreak, если они записаны
    if(typeof scoreboard_data['pending_home_side'] !== 'undefined' && scoreboard_data['pending_home_side'] !== null){
      update['home_side'] = scoreboard_data['pending_home_side'];
    }
    if(typeof scoreboard_data['pending_away_side'] !== 'undefined' && scoreboard_data['pending_away_side'] !== null){
      update['away_side'] = scoreboard_data['pending_away_side'];
    }
    if(typeof scoreboard_data['pending_classic_tiebreak_switch_done'] !== 'undefined' && scoreboard_data['pending_classic_tiebreak_switch_done'] !== null){
      update['classic_tiebreak_switch_done'] = scoreboard_data['pending_classic_tiebreak_switch_done'];
    }
    // Очищаем отложенные поля
    update['next_period'] = null;
    update['pending_home_side'] = null;
    update['pending_away_side'] = null;
    update['pending_classic_tiebreak_switch_done'] = null;
    update['pending_new_set'] = null;

    update_db(update);
  });
});
