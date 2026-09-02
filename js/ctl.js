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
// Данные для отложенного завершения сета
var pendingSetFinish = null;
// Запоминваем, был ли матч уже завершён ПРЕЖДЕ чем мы начали играть
var matchWasAlreadyFinished = false;
// Счётчик обновлений подписки — для определения первой загрузки
var _subscribeCallCount = 0;

var timeoutTimerInterval = null;
var timeoutRemainingSeconds = 0;
var timeoutTeam = null; // команда, взявшая таймаут ('home' или 'away')
var pendingTimeout = null;

// Локальный game_id для этой сессии, чтобы избежать конфликтов между вкладками
var local_game_id = null;

var _currentUserInfo = null;

// Получение информации о текущем пользователе
function getCurrentUserInfo() {
  if (_currentUserInfo) {
    return _currentUserInfo;
  }
  // Fallback to DB interface if not initialized
  var user = DB.getCurrentUser();
  if (user) _currentUserInfo = user;
  return _currentUserInfo || {};
}

// ========================================================================
// ШАБЛОН ОФОРМЛЕНИЯ
// ========================================================================

/**
 * Загружает список шаблонов и заполняет select
 */
function loadTemplateSelect() {
  // Оборачиваем в try/catch, чтобы синхронная ошибка (например, отсутствие
  // коллекции templates в PocketBase) не прерывала загрузку данных игры
  var listPromise;
  try {
    listPromise = DB.templates.list();
  } catch (e) {
    console.error('[CTL] Sync error loading template list:', e);
    $('#template_select').val('');
    return;
  }
  if (!listPromise || typeof listPromise.then !== 'function') {
    $('#template_select').val('');
    return;
  }
  listPromise.then(function(list) {
    var $select = $('#template_select');
    var currentVal = $select.val() || (scoreboard_data && scoreboard_data['template_id']) || '';
    $select.find('option:not([value=""])').remove();
    list.forEach(function(item) {
      $select.append($('<option>').val(item.id).text(item.name));
    });
    $select.val(currentVal);
  }).catch(function(err) {
    console.error('[CTL] Error loading template list:', err);
    $('#template_select').val('');
  });
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

/**
 * Показать модальное окно подтверждения завершения сета.
 */
function showSetFinishDialog(update) {
  console.log('[SET] showSetFinishDialog вызван.');

  // Сохраняем данные для последующего использования
  pendingSetFinish = {
    update: update
  };

  $('#setFinishModal').removeClass('dialog-hidden');
  // Блокируем кнопки на время подтверждения
  $(".score-btn").prop('disabled', true);
}

/**
 * Подтвердить завершение сета — обновить БД.
 */
function confirmSetFinish() {
  if (!pendingSetFinish) return;

  update_db(pendingSetFinish.update);

  pendingSetFinish = null;
  $('#setFinishModal').addClass('dialog-hidden');
  // Разблокировка кнопок произойдет при следующем обновлении данных из БД
}

/**
 * Отменить завершение сета — НЕ фиксировать счёт.
 * Очко, которое привело к завершению сета, не засчитывается.
 */
function cancelSetFinish() {
  if (!pendingSetFinish) return;

  // НЕ вызываем update_db — счёт и результат сета НЕ фиксируются.
  pendingSetFinish = null;
  $('#setFinishModal').addClass('dialog-hidden');
  // Разблокируем кнопки, чтобы можно было продолжить
  $(".score-btn").prop('disabled', false);
}

// Подписка на изменения после загрузки DOM
$(document).ready(function() {
  // Инициализируем DB
  local_game_id = getParameterByName('game');
  if (!local_game_id) local_game_id = 'test1';

  AuthModule.checkAuth('user', 'login.html').then(function(isAuth) {
    if (isAuth) {
      _currentUserInfo = AuthModule.getCurrentUser();
    }
  });
  DB.init().then(function() {
    // Подписка на изменения через DB интерфейс, используя локальный game_id
    DB.scoreboard.subscribe(
      local_game_id,
      function(data) {
        if (!data) {
          console.warn('Document does not exist:', local_game_id);
          return;
        }
        $(".hidden").removeClass("hidden");
        // Merge instead of replace — PocketBase SSE may omit fields
        // (как в мобильном интерфейсе: частичное событие не должно затирать состояние)
        if (typeof data.get === 'function') data = DB.utils.getPlainObject(data);
        Object.keys(data).forEach(function(key) {
          scoreboard_data[key] = data[key];
        });

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

    // Обновляем выбор шаблона — подгружаем список, если ещё не загружен
    var templateId = scoreboard_data['template_id'] || '';
    if ($('#template_select option').length <= 1) {
      // Список ещё не загружен — загружаем и восстанавливаем значение
      loadTemplateSelect();
    } else {
      $('#template_select').val(templateId);
    }

    var reminder=scoreboard_data['beach_switch_message'];
    var sideSwitchBtn=$(".side-switch-btn");
    var classicSwitchNeeded = !!scoreboard_data['classic_switch_needed'];
    sideSwitchBtn.toggleClass('blinking', (beachMode && !!reminder) || classicSwitchNeeded);
    var beachFinished = beachMode && scoreboard_data['beach_match_finished'];
    var classicFinished = (!beachMode) && scoreboard_data['classic_match_finished'];
    // Учитываем pendingMatchFinish — матч в процессе подтверждения
    var matchPending = !!pendingMatchFinish;
    var setPending = !!pendingSetFinish;
    if(beachFinished || classicFinished || matchPending || setPending){
      $(".beach-match-status").removeClass("hidden").text(matchPending ? "Ожидание подтверждения..." : "Матч завершён");
    }else{
      $(".beach-match-status").addClass("hidden").text("");
    }
    var matchFinished = beachFinished || classicFinished || matchPending || setPending;
    var pendingNewSet = !!scoreboard_data['pending_new_set'];
    var startOfSet = (ensureNumber(scoreboard_data['home_score'])===0) && (ensureNumber(scoreboard_data['away_score'])===0);

    // Блокировка кнопок в блоке "Сет" (очки) после завершения сета или при ожидании подтверждения
    // Также блокируем при активном таймауте
    // Признак активного таймаута — отдельное поле, не связанное с режимом отображения (show).
    // Раньше show===6 означал и "верх надпись+низ", и таймаут, из-за чего выбор этого режима блокировал счёт.
    var isTimeoutActive = !!scoreboard_data['timeout_active'];
    var scoreButtonsDisabled = pendingNewSet || matchFinished || isTimeoutActive;

    // Во время таймаута блокируем кнопки показа табло: случайное нажатие
    // сбрасывает show=6 и «выключает» таймаут, рассинхронизируя страницы
    $(".show-select").prop('disabled', isTimeoutActive);

    // Блокировка кнопок в блоке "Счёт" (фолы) в середине сета
    var foulButtonsDisabled = !startOfSet && !pendingNewSet && !matchFinished;

    // Disable score buttons after set finished (pending new set) or during timeout
    $(".score-btn").prop('disabled', scoreButtonsDisabled);

    // Timeout buttons: disabled at start of set (0:0), after set end, after match end
    // Also disable the other button when one team's timeout is active (show=6)
    // Also disable when team has used all timeouts (classic: 2, beach: 1)
    // Note: timeout buttons should NOT be disabled during timeout (they toggle it off)
    var timeoutBaseDisabled = (pendingNewSet || matchFinished || startOfSet);
    var beachMode = isBeachMode();
    var maxTimeouts = beachMode ? 1 : 2;

    var homeTimeouts = parseInt(scoreboard_data['home_timeouts'], 10) || 0;
    var awayTimeouts = parseInt(scoreboard_data['away_timeouts'], 10) || 0;
    var homeTimeoutsExhausted = homeTimeouts >= maxTimeouts;
    var awayTimeoutsExhausted = awayTimeouts >= maxTimeouts;

    // Handle blinking effect for active timeout buttons
    $(".timeout-btn").removeClass('blinking');
    
    if(isTimeoutActive){
      var currentLabel = scoreboard_data['custom_label'] || '';
      var homeTeam = scoreboard_data['home_team'] || '';
      var awayTeam = scoreboard_data['away_team'] || '';
      var isHomeTimeout = currentLabel === 'Таймаут ' + homeTeam;
      var isAwayTimeout = currentLabel === 'Таймаут ' + awayTeam;
      // Home button: disabled if away timeout is active, or home exhausted limits AND home timeout is NOT currently active
      $(".timeout-btn[data-team='home']").prop('disabled', timeoutBaseDisabled || isAwayTimeout || (homeTimeoutsExhausted && !isHomeTimeout));
      // Away button: disabled if home timeout is active, or away exhausted limits AND away timeout is NOT currently active
      $(".timeout-btn[data-team='away']").prop('disabled', timeoutBaseDisabled || isHomeTimeout || (awayTimeoutsExhausted && !isAwayTimeout));
      
      // Add blinking class to the active timeout button
      if(isHomeTimeout){
        $(".timeout-btn[data-team='home']").addClass('blinking');
      } else if(isAwayTimeout){
        $(".timeout-btn[data-team='away']").addClass('blinking');
      }
    } else {
      // When no timeout is active, check if each team has exhausted their timeouts
      $(".timeout-btn[data-team='home']").prop('disabled', timeoutBaseDisabled || homeTimeoutsExhausted);
      $(".timeout-btn[data-team='away']").prop('disabled', timeoutBaseDisabled || awayTimeoutsExhausted);
    }

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
    var periodDisabled = !enablePeriodButtons || setPending;
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
    $('#col_home_team_hex').val(scoreboard_data['home_color'] || '#ff0000')
    $('#col_away_team_hex').val(scoreboard_data['away_color'] || '#00ff00')
    $('#home_score').html(scoreboard_data['home_score'])
    $('#home_fouls').html(beachMode ? ensureNumber(scoreboard_data['home_sets']) : scoreboard_data['home_fouls'])
    $('#period').html(scoreboard_data['current_period'])
    // Не перезаписываем поле, пока в нём идёт набор текста — иначе
    // подписка/опрос затирает вводимое значение данными из БД
    var $customLabel = $('#custom_label');
    if (!$customLabel.is(':focus')) {
      $customLabel.val(scoreboard_data['custom_label'] || '');
    }
    updateSideLayout();
    renderSetHistoryCtl(scoreboard_data['set_history']);
      },
      function(error) {
        console.error('Error listening to scoreboard:', error);
      }
    );
    // Запускаем страховочный опрос после подписки (как в mobile.js)
    startCtlPolling();
  }).catch(function(err) {
    console.error('DB initialization failed:', err);
  });
});

function update_db(data){
  // Добавляем информацию о пользователе, который редактирует
  var userInfo = getCurrentUserInfo();
  if (userInfo.username) {
    data.username = userInfo.username;
    data.displayname = userInfo.displayname || userInfo.displayName;
  }
  data.lastEdited = DB.serverTimestamp();  
  // Напрямую используем DB.scoreboard.update, чтобы получить Promise с обновленными данными
  DB.scoreboard.update(local_game_id, data)
    .then(function(updatedDoc) {
      if (updatedDoc) {
        // Обновляем локальные данные для консистентности.
        // ВАЖНО: конвертируем Record PocketBase в простой объект,
        // иначе все обращения scoreboard_data['...'] вернут undefined (как в mobile.js)
        scoreboard_data = DB.utils.getPlainObject(updatedDoc) || scoreboard_data;
      }
    }).catch(function(err) {
      console.error("Update failed:", err);
    });
}

// Страховочный опрос каждую секунду (как в мобильном интерфейсе):
// гарантирует синхронизацию состояния, даже если realtime-событие потеряно
var _ctlPollInterval = null;

function startCtlPolling() {
  if (_ctlPollInterval) clearInterval(_ctlPollInterval);
  _ctlPollInterval = setInterval(function() {
    if (!local_game_id) return;
    DB.scoreboard.get(local_game_id).then(function(data) {
      if (!data) return;
      Object.keys(data).forEach(function(key) {
        scoreboard_data[key] = data[key];
      });
    }).catch(function() {});
  }, 1000);
}

function stopCtlPolling() {
  if (_ctlPollInterval) { clearInterval(_ctlPollInterval); _ctlPollInterval = null; }
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
    two_wins_mode: twoWinsMode,
    game_id: local_game_id,
    username: userInfo.username || '',
    displayname: userInfo.displayname || '',
    is_deleted: false, // Флаг удаления (для возможности отмены)
    template_id: scoreboard_data['template_id'] || ''
  };

  matches_collection.add(matchData).then(function(docRef) {
    console.log('Match result saved with ID: ', docRef.id);
    // Сохраняем ID последнего матча в scoreboard для возможности удаления при сбросе
    scoreboard_collection.doc(local_game_id).update({
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
    beach_switch_message: '',
    home_timeouts: 0,
    away_timeouts: 0
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
  update['classic_switch_shown'] = DB.deleteField(); // Сбрасываем флаг показа смены сторон для нового сета
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
      update['home_timeouts']=0;
      update['away_timeouts']=0;
    }
    var updatedHistory = nextSetHistory(homeScore, awayScore);
    update['set_history']=updatedHistory;

    if(matchFinished && !matchWasAlreadyFinished) {
      // Показываем диалог подтверждения завершения матча
      console.log('[MATCH] applySetWin (beach): matchFinished=true, показываем диалог');
      showMatchFinishDialog(update, updatedHistory, homeSets, awaySets, 'beach');
    } else {
      if(matchFinished) {
        console.log('[MATCH] applySetWin (beach): matchFinished=true, но matchWasAlreadyFinished=true — диалог пропущен');
      }
      showSetFinishDialog(update);
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
      showSetFinishDialog(update);
    }
  }
}

function toggleBeachMode(enabled){
  var update={
    beach_mode:enabled,
    beach_match_finished:false,
    set_history:[],
    classic_match_finished:false,
    classic_tiebreak_switch_done:true,
    home_timeouts: 0,
    away_timeouts: 0
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
    beach_match_finished:false,
    home_timeouts: 0,
    away_timeouts: 0
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
    update['home_timeouts'] = 0;
    update['away_timeouts'] = 0;
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
    showSetFinishDialog(update);
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

  // Логика смены сторон
  // Для произвольного режима (custom mode)
  if (scoreboard_data['custom_mode'] && scoreboard_data['score_change'] > 0) {
    var interval = ensureNumber(scoreboard_data['score_change']);
    var homeBefore = team === 'home' ? currentScore : otherScore;
    var awayBefore = team === 'home' ? otherScore : currentScore;
    var totalBefore = homeBefore + awayBefore;
    var totalAfter = homeAfter + awayAfter;

    if (delta > 0 && interval > 0 && Math.floor(totalAfter / interval) > Math.floor(totalBefore / interval)) {
        update['classic_switch_needed'] = true;
        update['classic_switch_message'] = 'Смена площадок — счёт ' + formatScore(homeAfter, awayAfter);
    }
  } else if (!scoreboard_data['custom_mode']) { // Для стандартного режима
    if (shouldClassicMidSwitch(homeAfter, awayAfter) && !scoreboard_data['classic_switch_shown']) {
        update['classic_switch_needed'] = true;
        update['classic_switch_message'] = 'Смена площадок — 5-й сет, счёт ' + formatScore(homeAfter, awayAfter);
        update['classic_switch_shown'] = true;
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
            update['home_timeouts'] = 0;
            update['away_timeouts'] = 0;
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
            update['home_timeouts'] = 0;
            update['away_timeouts'] = 0;
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


  /**
   * Показать модальное окно таймаута с таймером 30 секунд
   */
  function showTimeoutModal(teamName) {
    // Останавливаем предыдущий таймер, если был
    stopTimeoutTimer();

    timeoutRemainingSeconds = 30;
    $('#timeoutTimerDisplay').text(timeoutRemainingSeconds);
    $('#timeoutTeamName').text('⏸️ Таймаут: ' + teamName);
    $('#timeoutModalTitle').text('⏸️ Таймаут - ' + teamName);
    $('#timeoutModal').removeClass('dialog-hidden');

    // Запускаем обратный отсчёт
    timeoutTimerInterval = setInterval(function() {
      timeoutRemainingSeconds--;
      $('#timeoutTimerDisplay').text(timeoutRemainingSeconds);

      // Когда остаётся 5 секунд, меняем цвет на оранжевый для визуального предупреждения
      if (timeoutRemainingSeconds <= 5) {
        $('#timeoutTimerDisplay').css('color', '#e67e22');
      }
      if (timeoutRemainingSeconds <= 3) {
        $('#timeoutTimerDisplay').css('color', '#e74c3c');
      }

      if (timeoutRemainingSeconds <= 0) {
        // Таймер истёк — автоматически закрываем таймаут
        stopTimeoutTimer();
        $('#timeoutModal').addClass('dialog-hidden');
        $('#timeoutTimerDisplay').css('color', '#e74c3c');

        // Отправляем обновление в БД для выключения таймаута
        update_db(endTimeoutUpdate());
      }
    }, 1000);
  }

  /**
   * Остановить таймер таймаута
   */
  function stopTimeoutTimer() {
    if (timeoutTimerInterval) {
      clearInterval(timeoutTimerInterval);
      timeoutTimerInterval = null;
    }
    timeoutRemainingSeconds = 0;
  }

  /**
   * Скрыть модальное окно таймаута и остановить таймер
   */
  function hideTimeoutModal() {
    stopTimeoutTimer();
    $('#timeoutTimerDisplay').css('color', '#e74c3c');
    $('#timeoutModal').addClass('dialog-hidden');
  }

  /**
   * Завершение таймаута: снимаем флаг timeout_active и восстанавливаем
   * режим отображения (show), который был до начала таймаута.
   */
  function endTimeoutUpdate() {
    var prev = parseInt(scoreboard_data['prev_show'], 10) || 0;
    if (!prev || prev === 6) prev = 1;
    return { timeout_active: false, show: prev, custom_label: scoreboard_data['custom_label'] };
  }

  $(".timeout-btn").click(function(){
    // Блокировка при ожидании подтверждения завершения матча
    if(pendingMatchFinish) return;

    var team = $(this).data('team');
    var teamName = team === 'home' ? scoreboard_data['home_team'] : scoreboard_data['away_team'];
    var timeoutLabel = 'Таймаут ' + teamName;
    var currentShow = parseInt(scoreboard_data['show'], 10) || 0;
    var beachMode = isBeachMode();
    var maxTimeouts = beachMode ? 1 : 2;
    var homeTimeouts = parseInt(scoreboard_data['home_timeouts'], 10) || 0;
    var awayTimeouts = parseInt(scoreboard_data['away_timeouts'], 10) || 0;

    if(scoreboard_data['timeout_active']){
      var currentLabel = scoreboard_data['custom_label'] || '';
      var homeTeam = scoreboard_data['home_team'] || '';
      var awayTeam = scoreboard_data['away_team'] || '';
      var isHomeTimeoutActive = currentLabel === 'Таймаут ' + homeTeam;
      var isAwayTimeoutActive = currentLabel === 'Таймаут ' + awayTeam;

      if((team === 'home' && isHomeTimeoutActive) || (team === 'away' && isAwayTimeoutActive)){
        update_db(endTimeoutUpdate());
        hideTimeoutModal();
      }
      return;
    }

    var timeoutKey = team === 'home' ? 'home_timeouts' : 'away_timeouts';
    var currentTimeouts = team === 'home' ? homeTimeouts : awayTimeouts;
    if(currentTimeouts >= maxTimeouts) return;

    pendingTimeout = {
      team: team,
      teamName: teamName,
      timeoutLabel: timeoutLabel,
      timeoutKey: timeoutKey,
      currentTimeouts: currentTimeouts
    };
    $('#timeoutConfirmText').text('Начать таймаут (' + teamName + ')?');
    $('#timeoutConfirmModal').removeClass('dialog-hidden');
  });

    $('#timeoutConfirmYes').click(function(){
    $('#timeoutConfirmModal').addClass('dialog-hidden');
    if (!pendingTimeout) return;
    var pt = pendingTimeout;
    pendingTimeout = null;
    // Запоминаем текущий режим отображения, чтобы восстановить его после таймаута
    var prevShow = parseInt(scoreboard_data['show'], 10) || 0;
    if (!prevShow || prevShow === 6) prevShow = 1;
    var update = { show: 6, prev_show: prevShow, timeout_active: true, custom_label: pt.timeoutLabel };
    update[pt.timeoutKey] = pt.currentTimeouts + 1;
    update_db(update);
    showTimeoutModal(pt.teamName);
  });

  $('#timeoutConfirmNo').click(function(){
    $('#timeoutConfirmModal').addClass('dialog-hidden');
    pendingTimeout = null;
  });

  // Кнопка закрытия таймаута в модальном окне
  $("#timeoutModalClose").click(function(){
    hideTimeoutModal();

    // Отправляем обновление в БД для выключения таймаута
    if (scoreboard_data['timeout_active']) {
      update_db(endTimeoutUpdate());
    }
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

  // Синхронизация hex-кода цвета с color picker'ом (ручной ввод)
  $("#col_home_team").on('input', function() {
    $("#col_home_team_hex").val($(this).val());
  });
  $("#col_away_team").on('input', function() {
    $("#col_away_team_hex").val($(this).val());
  });
  $("#col_home_team_hex").on('input', function() {
    var value = $.trim($(this).val());
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      $("#col_home_team").val(value);
    }
  });
  $("#col_away_team_hex").on('input', function() {
    var value = $.trim($(this).val());
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      $("#col_away_team").val(value);
    }
  });

  // Обработчики кнопок модального окна подтверждения завершения матча
  $("#matchFinishYes").click(function(){
    confirmMatchFinish();
  });

  $("#matchFinishNo").click(function(){
    cancelMatchFinish();
  });

  // Обработчики кнопок модального окна подтверждения завершения сета
  $("#setFinishYes").click(function(){
    confirmSetFinish();
  });

  $("#setFinishNo").click(function(){
    cancelSetFinish();
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
      timeout_active:false,
      prev_show:1,
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
      home_timeouts:0,
      away_timeouts:0,
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

    DB.scoreboard.reset(local_game_id, resetData, userInfo)
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
          $('#col_home_team_hex').val(scoreboard_data['home_color'] || '#ff0000');
          $('#col_away_team_hex').val(scoreboard_data['away_color'] || '#00ff00');
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
    // Этот чекбокс имеет сложную логику, поэтому его click-событие не дублируем
    toggleBeachMode(beachMode);
    // Блокируем/разблокируем чекбокс two_wins_mode
    $('#two_wins_mode_toggle').prop('disabled', beachMode);
    $('#two_wins_mode_toggle').parent('label').toggleClass('disabled-label', beachMode);
  });

  // Дублируем на 'click' для надежности на мобильных устройствах
  $("#beach_mode_toggle").on('click', function(){
    var beachMode = $(this).is(':checked');
    toggleBeachMode(beachMode);
    $('#two_wins_mode_toggle').prop('disabled', beachMode);
    $('#two_wins_mode_toggle').parent('label').toggleClass('disabled-label', beachMode);
  });

  $("#invert_tablo_toggle").change(function(){
    update_db({invert_tablo: $(this).is(':checked')});
  });

  // Дублируем на 'click' для надежности на мобильных устройствах
  $("#invert_tablo_toggle").on('click', function(){
    update_db({invert_tablo: $(this).is(':checked')});
  });

  $("#unlimited_score_toggle").change(function(){
    update_db({unlimited_score: $(this).is(':checked')});
  });

  // При изменении шаблона — сохраняем в БД
  $("#unlimited_score_toggle").on('click', function(){
    update_db({unlimited_score: $(this).is(':checked')});
  });

  // Для select-элемента дублирование не требуется
  $("#template_select").change(function(){
    var templateId = $(this).val() || '';
    update_db({template_id: templateId});
  });

  // Загружаем список шаблонов при старте (после инициализации DB)
  // DB.init() уже мог быть вызван из AuthModule.checkAuth(), но он идемпотентен
  if (typeof DB !== 'undefined' && typeof DB.isInitialized === 'function') {
    if (DB.isInitialized()) {
      loadTemplateSelect();
    } else {
      // Если DB ещё не инициализирован — ждём
      DB.init().then(function() {
        loadTemplateSelect();
      }).catch(function(err) {
        console.error('[CTL] DB init failed, cannot load templates:', err);
      });
    }
  } else {
    console.warn('[CTL] DB not available, cannot load templates');
  }

  // Перезагружаем список шаблонов при каждом обновлении данных (на случай, если
  // шаблон был добавлен/удалён в другом окне)
  var _origUpdateCb = null;
  // Подписываемся на изменения данных, чтобы обновлять список шаблонов
  // (используем существующий callback subscription)

  $("#two_wins_mode_toggle").change(function(){
    var twoWinsMode = $(this).is(':checked');
    // Этот чекбокс имеет сложную логику, поэтому его click-событие не дублируем
    toggleTwoWinsMode(twoWinsMode);
    // Блокируем/разблокируем чекбокс beach_mode
    $('#beach_mode_toggle').prop('disabled', twoWinsMode);
    $('#beach_mode_toggle').parent('label').toggleClass('disabled-label', twoWinsMode);
  });

  // Дублируем на 'click' для надежности на мобильных устройствах
  $("#two_wins_mode_toggle").on('click', function(){
    var twoWinsMode = $(this).is(':checked');
    toggleTwoWinsMode(twoWinsMode);
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
//    update['classic_switch_shown'] = DEL; // Сбрасываем этот флаг при ручной смене сторон
    update['lastEdited'] = DB.serverTimestamp();    
    update_db(update);
  });
  $(".new-set-btn").click(function(){
    // Сбросить счёт для начала нового сета. Остальные параметры (period/set number)
    // уже устанавливаются при фиксации выигрыша сета.
    var update = {
      home_score: 0,
      away_score: 0,
      beach_switch_message: '',
      home_timeouts: 0,
      away_timeouts: 0
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
