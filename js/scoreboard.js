var scoreboard_data={};
var _unsubscribe = null;

// Дефолтные данные (если документ ещё не создан)
var DEFAULT_SCOREBOARD_DATA = {
  "show": 1,
  "away_color": "#000000",
  "away_fouls": '-',
  "away_score": '-',
  "away_team": "--------",
  "current_period": '0',
  "home_color": "#000000",
  "home_fouls": '-',
  "home_score": '-',
  "home_team": "--------",
  "home_sets": 0,
  "away_sets": 0,
  "beach_mode": false,
  "beach_switch_message": "",
  "beach_current_set": 1,
  "set_history": [],
  "classic_match_finished": false,
  "home_side": "left",
  "away_side": "right",
  "classic_tiebreak_switch_done": true,
  "invert_tablo": false
};

/**
 * Определяет тип бейджа для команды
 * @param {string} team - 'home' или 'away'
 * @param {object} data - данные табло
 * @returns {string|null} - 'matchball', 'setball' или null
 */
function getMatchBadgeType(team, data) {
  var homeScore = parseInt(data.home_score, 10);
  var awayScore = parseInt(data.away_score, 10);
  var homeSets = data.home_sets || 0;
  var awaySets = data.away_sets || 0;
  var beachMode = data.beach_mode || false;
  var currentSet = data.beach_current_set || 1;
  
  console.log('getMatchBadgeType: team=', team, 'homeScore=', homeScore, 'awayScore=', awayScore, 'homeSets=', homeSets, 'awaySets=', awaySets, 'beachMode=', beachMode);
  
  // Если счет не числовой (между сетами) - бейдж не нужен
  if (isNaN(homeScore) || isNaN(awayScore)) {
    console.log('getMatchBadgeType: scores are NaN');
    return null;
  }
  
  // Проверяем, завершен ли текущий сет (счет показывает '-' или match_finished)
  if (data.classic_match_finished) {
    console.log('getMatchBadgeType: match finished');
    return null;
  }
  
  // Определяем очки для победы в сете
  var pointsToWin;
  var setsToWinMatch;
  
  if (beachMode) {
    // Пляжный волейбол: до 21 очка, до 2 сетов
    pointsToWin = 21;
    setsToWinMatch = 2;
  } else {
    // Классический волейбол
    // Проверяем, это тай-брейк (5-й сет)?
    var totalSetsPlayed = (data.set_history || []).length;
    var isTiebreak = totalSetsPlayed === 4; // 5-й сет
    
    if (isTiebreak) {
      pointsToWin = GAME_CONSTANTS.CLASSIC_TIEBREAK_POINTS_TO_WIN || 15;
    } else {
      pointsToWin = GAME_CONSTANTS.CLASSIC_POINTS_TO_WIN || 25;
    }
    setsToWinMatch = 3; // Классический - до 3 сетов
  }
  
  console.log('getMatchBadgeType: pointsToWin=', pointsToWin, 'setsToWinMatch=', setsToWinMatch, 'isTiebreak=', (data.set_history || []).length === 4);
  
  // Проверяем сетбол - команда близка к победе в сете
  var teamScore = team === 'home' ? homeScore : awayScore;
  var opponentScore = team === 'home' ? awayScore : homeScore;
  var teamSets = team === 'home' ? homeSets : awaySets;
  
  // Сетбол/матчбол возможен только если сет еще идет
  // (ни одна команда еще не достигла очков для победы)
  if (homeScore >= pointsToWin || awayScore >= pointsToWin) {
    // Сет уже завершен, бейдж не показываем
    console.log('getMatchBadgeType: set finished');
    return null;
  }
  
  var isSetball = false;
  var isMatchball = false;
  
  // Сетбол: команда может выиграть сет следующим очком
  if (teamScore >= pointsToWin - 1 && teamScore > opponentScore) {
    isSetball = true;
  }
  
  // Матчбол: команда может выиграть матч следующим выигранным сетом
  if (isSetball && (teamSets + 1) >= setsToWinMatch) {
    isMatchball = true;
  }
  
  console.log('getMatchBadgeType: isSetball=', isSetball, 'isMatchball=', isMatchball);
  
  if (isMatchball) {
    return 'matchball';
  } else if (isSetball) {
    return 'setball';
  }
  
  return null;
}

// Подписка на изменения через DB интерфейс (вызывается после DB.init)
function startScoreboardSubscription() {
console.log('sb/ctl: startScoreboardSubscription called, game_id:', game_id);
DB.scoreboard.subscribe(
  game_id,
  function(data){
    console.log('sb/ctl: scoreboard data received, show:', data ? data.show : 'null');
    var pdata = scoreboard_data;
    // Если данные не пришли — используем дефолтные
    scoreboard_data = data || DEFAULT_SCOREBOARD_DATA;
    if(pdata['show'] != scoreboard_data['show']){
      if(scoreboard_data.show & 2){
        $(".big-table").animate({"left":80},1000)
        if(scoreboard_data.show & 8){
          $(".big-table div.time").css("opacity",0);
          $(".big-table div.team div.bottom").css("opacity",0);
        }else{
          $(".big-table div.time").css("opacity",1);
          $(".big-table div.team div.bottom").css("opacity",1);
        }
      }else{
        $(".big-table").animate({"left":-800},1000)
      }

      if(scoreboard_data.show & 1){
        $("table#top").removeClass('top-hidden').animate({"margin-top":0},1000)
      }else{
        $("table#top").addClass('top-hidden').css({"margin-top":-80})
      }

      if(scoreboard_data.show & 4){
        $("div.top_label").animate({"left":50,'opacity':1},1000)
      }else{
        $("div.top_label").animate({"left":-500,"opacity":0},1000,
        "linear", function(X){})
      }
    }
    if(scoreboard_data.show & 4 && pdata.show & 4 &&
      scoreboard_data['custom_label'] != pdata['custom_label']){
      console.log("rehide");
      $("div.top_label").animate({"opacity":0},500,
        "swing", function(X){
          $('.top_label').html(scoreboard_data['custom_label']);
          $("div.top_label").animate({"opacity":1},500);
        })
    }else{
      $('.top_label').html(scoreboard_data['custom_label'])
    }
    $('.away_team').html(scoreboard_data['away_team'])
    $('.away_score').html(scoreboard_data['away_score'])
    var beachMode = !!scoreboard_data['beach_mode'];
    var homeSets = scoreboard_data['home_sets'] || 0;
    var awaySets = scoreboard_data['away_sets'] || 0;
    $('.away_fouls').html(beachMode ? awaySets : scoreboard_data['away_fouls'])
    $(".away_color").css("background-color",scoreboard_data['away_color'])
    $('.home_team').html(scoreboard_data['home_team'])
    $('.home_score').html(scoreboard_data['home_score'])
    $('.home_fouls').html(beachMode ? homeSets : scoreboard_data['home_fouls'])
    $(".home_color").css("background-color",scoreboard_data['home_color'])

    // Обновляем общий счет по сетам на табло
    $('.away_sets').html(awaySets);
    $('.home_sets').html(homeSets);
    var currentPeriod = scoreboard_data['current_period'] || 1;
    $('.timeval').html(currentPeriod)
    var showTop = !!(scoreboard_data.show & 1);
    var showBottom = !!(scoreboard_data.show & 2);
    renderSetHistory(scoreboard_data['set_history'], showTop, showBottom);
    // Обновляем историю сетов для scoreboard1.html
    updateScoreboard1History(scoreboard_data['set_history']);
    // Обновляем отображение для scoreboard1.html (top_label, show/hide табло)
    if (typeof updateScoreboard1Display === 'function') {
      updateScoreboard1Display();
    }
    // Обновляем блоки счета по сетам для sb.html
    if (typeof updateBottomSetsDisplay === 'function') {
      updateBottomSetsDisplay(scoreboard_data['set_history']);
    }
    // Обновляем бейджи сетбола/матчбола для sb.html
    if (typeof updateMatchBadges === 'function') {
      updateMatchBadges(scoreboard_data);
    }
    // Обновляем порядок на табло (функция сама проверит наличие элементов)
    updateTabloSides();
  });
}

/**
 * Обновляет бейджи сетбола/матчбола на табло
 * @param {object} data - данные табло
 */
function updateMatchBadges(data) {
  var homeBadgeType = getMatchBadgeType('home', data);
  var awayBadgeType = getMatchBadgeType('away', data);
  
  console.log('updateMatchBadges: homeBadgeType=', homeBadgeType, 'awayBadgeType=', awayBadgeType);
  
  // Обновляем только верхнее табло
  updateSingleScoreboardBadges('.scoreboard > .match-badges-container', homeBadgeType, awayBadgeType);
}

/**
 * Обновляет бейджи для одного табло
 * @param {string} containerSelector - селектор контейнера
 * @param {string|null} homeBadgeType - тип бейджа домашней команды
 * @param {string|null} awayBadgeType - тип бейджа гостевой команды
 */
function updateSingleScoreboardBadges(containerSelector, homeBadgeType, awayBadgeType) {
  var $container = $(containerSelector);
  console.log('updateSingleScoreboardBadges: selector=', containerSelector, 'found=', $container.length);
  
  if (!$container.length) {
    console.warn('Container not found for:', containerSelector);
    return;
  }

  // Верхний бейдж (home)
  var $homeBadge = $container.find('.home-match-badge');
  console.log('home badge found:', $homeBadge.length, 'type:', homeBadgeType);
  if ($homeBadge.length) {
    updateSingleBadge($homeBadge, homeBadgeType);
  }

  // Нижний бейдж (away)
  var $awayBadge = $container.find('.away-match-badge');
  console.log('away badge found:', $awayBadge.length, 'type:', awayBadgeType);
  if ($awayBadge.length) {
    updateSingleBadge($awayBadge, awayBadgeType);
  }

  // Скрываем/показываем контейнер бейджей в зависимости от наличия активных бейджей
  if (homeBadgeType === null && awayBadgeType === null) {
    console.log('Hiding container');
    $container.css('display', 'none');
  } else {
    console.log('Showing container');
    $container.css('display', 'flex');
  }
}

/**
 * Обновляет один бейдж
 * @param {jQuery} $badge - элемент бейджа
 * @param {string|null} badgeType - тип бейджа
 */
function updateSingleBadge($badge, badgeType) {
  console.log('updateSingleBadge: badgeType=', badgeType, 'element:', $badge.attr('class'));
  
  if (badgeType === null) {
    $badge.css('display', 'none').removeClass('badge-setball badge-matchball').text('');
  } else {
    $badge.removeClass('badge-setball badge-matchball');
    
    if (badgeType === 'matchball') {
      $badge.addClass('badge-matchball').text('МАТЧБОЛ');
    } else if (badgeType === 'setball') {
      $badge.addClass('badge-setball').text('СЕТБОЛ');
    }
    
    $badge.css('display', 'inline-block');
    console.log('Badge shown with type:', badgeType, 'classes:', $badge.attr('class'));
  }
}

function renderSetHistory(history, showTop, showBottom){
  var items=Array.isArray(history)?history:[];
  
  // История для scoreboard.html (верхняя панель) - всегда стандартный порядок
  var topText='';
  if(items.length>0){
    var parts=[];
    for(var i=0;i<items.length;i++){
      var entry=items[i]||{};
      var home=(entry.home!=null)?entry.home:'-';
      var away=(entry.away!=null)?entry.away:'-';
      // Всегда домашняя команда слева, гостевая справа
      parts.push(home+':'+away);
    }
    topText=parts.join(' ');
  }
  
  // История для tablo.html (нижняя панель) - с учетом invert_tablo
  var bottomText='';
  if(items.length>0){
    var parts=[];
    for(var i=0;i<items.length;i++){
      var entry=items[i]||{};
      var home=(entry.home!=null)?entry.home:'-';
      var away=(entry.away!=null)?entry.away:'-';

      // Проверяем текущее расположение команд для правильного отображения истории
      var homeSide = scoreboard_data['home_side'] || 'left';
      var invertTablo = !!scoreboard_data['invert_tablo'];
      // XOR: home слева если (home физически слева) XOR (инверсия включена)
      var homeIsLeft = (homeSide === 'left') !== invertTablo;
      if(homeIsLeft){
        // Домашняя команда слева, гостевая справа - стандартный порядок
        parts.push(home+':'+away);
      } else {
        // Домашняя команда справа, гостевая слева - меняем порядок в истории
        parts.push(away+':'+home);
      }
    }
    bottomText=parts.join(' ');
  }
  
  var hasTopHistory = topText.length>0;
  var hasBottomHistory = bottomText.length>0;
  updateHistoryElement('#set-history-top', showTop && hasTopHistory, topText);
  // set-history-bottom обновляется всегда (используется в tablo.html), видимость управляется через CSS/JS в tablo.html
  updateHistoryElement('#set-history-bottom', hasBottomHistory, bottomText);

  // Обновляем общий счет по сетам на табло на основе set_history
  updateGeneralScoreFromHistory(history);
}

// Функция для подсчета сетов из истории и обновления общего счета
function updateGeneralScoreFromHistory(history){
  var items=Array.isArray(history)?history:[];
  var homeSets = 0;
  var awaySets = 0;
  
  // Подсчитываем выигранные сеты каждой командой
  for(var i=0;i<items.length;i++){
    var entry=items[i]||{};
    var homeScore = parseInt(entry.home, 10);
    var awayScore = parseInt(entry.away, 10);
    
    // Проверяем, что это числовые значения
    if(!isNaN(homeScore) && !isNaN(awayScore)){
      if(homeScore > awayScore){
        homeSets++;
      } else if(awayScore > homeScore){
        awaySets++;
      }
    }
  }
  
  // Обновляем отображение на табло в зависимости от текущего расположения команд
  var homeSide = scoreboard_data['home_side'] || 'left';
  var invertTablo = !!scoreboard_data['invert_tablo'];
  
  // XOR: home слева если (home физически слева) XOR (инверсия включена)
  var homeIsLeft = (homeSide === 'left') !== invertTablo;
  if(homeIsLeft){
    // Домашняя команда слева, гостевая справа
    $('.home_sets').html(homeSets);
    $('.away_sets').html(awaySets);
  } else {
    // Домашняя команда справа, гостевая слева
    // Меняем местами значения, чтобы счет соответствовал расположению команд
    $('.home_sets').html(awaySets);
    $('.away_sets').html(homeSets);
  }
}

function updateHistoryElement(selector, shouldShow, text){
  var el=$(selector);
  if(!el.length)
    return;
  if(!shouldShow){
    el.css('display','none').text('');
    return;
  }
  var displayValue = el.hasClass('set-history-top') ? 'inline-block' : 'block';
  el.css('display', displayValue).text(text);
}

// Обновление истории сетов для scoreboard1.html
function updateScoreboard1History(history){
  var items=Array.isArray(history)?history:[];
  var text='';
  if(items.length>0){
    var parts=[];
    for(var i=0;i<items.length;i++){
      var entry=items[i]||{};
      var home=(entry.home!=null)?entry.home:'-';
      var away=(entry.away!=null)?entry.away:'-';

      // Всегда сперва домашняя команда, затем гостевая
      parts.push(home+':'+away);
    }
    text=parts.join('   ');
  }
  var el=$('#set-history-scoreboard1');
  if(el.length){
    if(text.length > 0){
      el.text(text);
      // Не показываем здесь - управление видимостью в updateScoreboard1Display
    }else{
      el.text('').hide();
    }
  }

  // Вызываем функцию обновления истории сетов в столбик
  if (typeof updateScoreboard1HistoryColumn === 'function') {
    updateScoreboard1HistoryColumn(history);
  }

  // Вызываем функцию обновления отображения для scoreboard1.html
  if (typeof updateScoreboard1Display === 'function') {
    updateScoreboard1Display();
  }
}

function updateTabloSides(){
  var scoreContainer=$('.tablo-score');
  if(!scoreContainer.length)
    return;
  var homeSide=scoreboard_data['home_side'] || 'left';
  var invertTablo = !!scoreboard_data['invert_tablo'];
  // На табло порядок такой же, как на физическом табло (если не инвертировано)
  // Если home физически слева, на табло home слева (order 1), away справа (order 3)
  // При инвертировании порядок противоположный
  var baseHomeOrder = homeSide==='left' ? 1 : 3;
  var baseAwayOrder = homeSide==='left' ? 3 : 1;
  var homeOrder = invertTablo ? baseAwayOrder : baseHomeOrder;
  var awayOrder = invertTablo ? baseHomeOrder : baseAwayOrder;
  var separatorOrder = 2;
  scoreContainer.find('.home_score').css('order', homeOrder);
  scoreContainer.find('.away_score').css('order', awayOrder);
  var sep = scoreContainer.find('.score-separator');
  if(sep.length){
    sep.css('order', separatorOrder);
  }else{
    // Если класс не найден, ищем по тексту
    scoreContainer.children().each(function(){
      if($(this).text().trim() === ':'){
        $(this).css('order', separatorOrder);
      }
    });
  }
  var teamContainer=$('.tablo-teams');
  if(teamContainer.length){
    var leftTeam = teamContainer.find('.tablo-left-team');
    var rightTeam = teamContainer.find('.tablo-right-team');
    if(leftTeam.length && rightTeam.length){
      // homeIsLeft = true, если домашняя команда должна быть слева на табло.
      // Логика: если home физически слева И тablo не инвертировано — home слева.
      //         если home физически справа И tablo инвертировано — тоже home слева.
      // Это XOR: (homeSide==='left') XOR invertTablo
      var homeIsLeft = (homeSide === 'left') !== invertTablo;
      if(homeIsLeft){
        // Домашняя команда слева, гостевая справа
        leftTeam.html(scoreboard_data['home_team'] || '');
        rightTeam.html(scoreboard_data['away_team'] || '');
      } else {
        // Домашняя команда справа, гостевая слева
        leftTeam.html(scoreboard_data['away_team'] || '');
        rightTeam.html(scoreboard_data['home_team'] || '');
      }
    }
  }
  
  
  // Обновляем отображение общего счета и истории сетов в соответствии с текущим расположением
  updateGeneralScoreFromHistory(scoreboard_data['set_history']);

  // При смене сторон обновляем историю сетов, чтобы она соответствовала текущему расположению команд
  var showTop = !!(scoreboard_data.show & 1);
  var showBottom = !!(scoreboard_data.show & 2);
  renderSetHistory(scoreboard_data['set_history'], showTop, showBottom);
}

// Инициализация DB при загрузке
$(document).ready(function() {
  DB.init().then(function() {
    startScoreboardSubscription();
  }).catch(function(err) {
    console.error('DB initialization failed:', err);
  });
});

