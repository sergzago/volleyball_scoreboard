(function() {
  'use strict';

  var BASE_URL = window.location.href.replace(/\/[^\/]*$/, '/');
  var mobileScoreboardData = {};
  var mobileGameConnected = false;
  var pendingMatchFinish = null;
  var matchWasAlreadyFinished = false;
  var _subscribeCallCount = 0;
  var _initialDataLoaded = false;
  var timeoutTimerInterval = null;
  var timeoutRemainingSeconds = 0;
  var _localCustomMode = false;
  var _localCustomSettings = {
    custom_sets_to_win: 3,
    custom_points_to_win: 25,
    custom_tiebreak_points: 15,
    custom_balance: false,
    custom_side_switch_points: 7,
    custom_max_timeouts: 2
  };

  // ===== HELPERS =====

  function ensureNumber(value) {
    var parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  function generateUUID() {
    if (typeof uuid === 'function') return uuid();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function show(el) { el.style.display = ''; }
  function hide(el) { el.style.display = 'none'; }

  function showControlContent() {
    hide(document.getElementById('controlLoading'));
    show(document.getElementById('controlContent'));
  }

  function getCurrentUserInfo() {
    if (DB.getProvider() === 'firebase') {
      var user = firebase.auth().currentUser;
      if (!user) return {};
      return { username: user.email.split('@')[0], displayname: user.displayName || user.email.split('@')[0] };
    }
    if (DB.auth.getAuthInstance && DB.auth.getAuthInstance()) {
      var pb = typeof PocketBase !== 'undefined' ? new PocketBase(DB_CONFIG.pocketbase.url) : null;
      if (pb && pb.authStore.isValid && pb.authStore.model) {
        var record = pb.authStore.model;
        return { username: record.username || record.email.split('@')[0], displayname: record.displayName || record.username || record.email.split('@')[0] };
      }
    }
    return {};
  }

  function update_db(data) {
    var userInfo = getCurrentUserInfo();
    if (userInfo.username) {
      data.username = userInfo.username;
      data.displayname = userInfo.displayname;
    }
    data.lastEdited = DB.serverTimestamp();
    scoreboard_query.update(data);
  }

  // ===== AUTH =====

  function initAuth() {
    if (typeof ENABLE_AUTH !== 'undefined' && ENABLE_AUTH === 0) {
      showApp();
      document.getElementById('mobileUserInfo').textContent = 'Гость';
      return;
    }

    DB.init().then(function() {
      DB.auth.onAuthStateChanged(function(user) {
        if (!user) {
          showLogin();
          return;
        }

        var username = user.email ? user.email.split('@')[0] : user.username || '';
        DB.users.get(username).then(function(userData) {
          var role = 'user';
          if (userData && userData.role) role = userData.role;
          showApp(user.email || username, role);

          if (role === 'admin') {
            document.querySelectorAll('.admin-tab').forEach(function(el) {
              el.classList.remove('admin-hidden');
            });
          }
        }).catch(function() {
          showApp(user.email || username, 'user');
        });
      });
    }).catch(function(e) {
      console.error('DB init failed:', e);
      showApp('Гость (ошибка БД)', 'user');
    });
  }

  function showLogin() {
    show(document.getElementById('loginPage'));
    hide(document.getElementById('appContainer'));
  }

  function showApp(userInfo, role) {
    hide(document.getElementById('loginPage'));
    show(document.getElementById('appContainer'));
    if (userInfo) {
      document.getElementById('mobileUserInfo').textContent = userInfo + (role === 'admin' ? ' (Админ)' : '');
    }
  }

  function doLogin() {
    var username = document.getElementById('loginUsername').value.trim();
    var password = document.getElementById('loginPassword').value;
    var errorEl = document.getElementById('loginError');
    var btn = document.getElementById('loginBtn');

    if (!username || !password) {
      errorEl.textContent = 'Введите логин и пароль';
      show(errorEl);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Вход...';
    hide(errorEl);

    DB.auth.login(username, password).then(function(userData) {
      btn.disabled = false;
      btn.textContent = 'Войти';
    }).catch(function(err) {
      btn.disabled = false;
      btn.textContent = 'Войти';
      errorEl.textContent = err.message || 'Ошибка авторизации';
      show(errorEl);
    });
  }

  function doLogout() {
    AuthModule.logout().then(function() {
      mobileGameConnected = false;
      showLogin();
    });
  }

  // ===== TABS =====

  function initTabs() {
    var tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var target = this.getAttribute('data-tab');
        tabBtns.forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        document.querySelectorAll('.tab-page').forEach(function(p) { p.classList.remove('active'); });
        document.getElementById(target).classList.add('active');
      });
    });
  }

  // ===== GAME CONNECTION =====

  function connectToGame() {
    var gameId = document.getElementById('mobileGameId').value.trim();
    if (!gameId) {
      alert('Введите Game ID');
      return;
    }

    window.game_id = gameId;
    mobileGameConnected = true;

    show(document.getElementById('settingsModeCard'));
    show(document.getElementById('teamsCard'));
    show(document.getElementById('teamsNamesCard'));
    hide(document.getElementById('teamsLoading'));

    document.getElementById('controlLoading').textContent = 'Загрузка...';
    show(document.getElementById('controlLoading'));
    hide(document.getElementById('controlContent'));

    updateLinks();
    subscribeToGame();

    DB.scoreboard.get(game_id).then(function(data) {
      if (data) {
        applyGameData(data);
      } else {
        document.getElementById('controlLoading').textContent = 'Заполните данные команд';
      }
    }).catch(function() {
      document.getElementById('controlLoading').textContent = 'Заполните данные команд';
    });
  }

  function applyGameData(data) {
    Object.keys(data).forEach(function(key) {
      mobileScoreboardData[key] = data[key];
    });
    updateSettingsUI(mobileScoreboardData);
    updateTeamsUI(mobileScoreboardData);
    updateControlUI(mobileScoreboardData);
    showControlContent();
  }

  // ===== SUBSCRIPTION =====

  var _pollInterval = null;

  function startPolling() {
    if (_pollInterval) clearInterval(_pollInterval);
    _pollInterval = setInterval(function() {
      if (!mobileGameConnected || !game_id) return;
      DB.scoreboard.get(game_id).then(function(data) {
        if (!data) return;
        Object.keys(data).forEach(function(key) {
          mobileScoreboardData[key] = data[key];
        });
        updateSettingsUI(mobileScoreboardData);
        updateControlUI(mobileScoreboardData);
      }).catch(function() {});
    }, 1000);
  }

  function stopPolling() {
    if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
  }

  function subscribeToGame() {
    DB.scoreboard.subscribe(game_id, function(data) {
      if (!data) {
        return;
      }

      // Merge instead of replace — PocketBase SSE may omit fields
      Object.keys(data).forEach(function(key) {
        mobileScoreboardData[key] = data[key];
      });
      // Keep fields that PocketBase SSE might have dropped
      var merged = mobileScoreboardData;

      _subscribeCallCount++;
      if (!_initialDataLoaded) {
        _initialDataLoaded = true;
        var beachMode = !!merged['beach_mode'];
        var beachFinished = beachMode && merged['beach_match_finished'];
        var classicFinished = (!beachMode) && merged['classic_match_finished'];
        if (beachFinished || classicFinished) {
          matchWasAlreadyFinished = true;
        }
      }

      updateSettingsUI(merged);
      updateTeamsUI(merged);
      updateControlUI(merged);
      showControlContent();
    }, function(error) {
      console.error('Error listening to scoreboard:', error);
    });

    startPolling();
  }

  // ===== SETTINGS UI =====

  function updateSettingsUI(data) {
    var beachMode = !!data['beach_mode'];
    var twoWinsMode = !!data['two_wins_mode'];
    var invertTablo = !!data['invert_tablo'];
    var unlimitedScore = !!data['unlimited_score'];
    var customMode = !!data['custom_mode'] || _localCustomMode;

    document.getElementById('mobileBeachMode').checked = beachMode;
    document.getElementById('mobileTwoWinsMode').checked = twoWinsMode;
    document.getElementById('mobileInvertTablo').checked = invertTablo;
    document.getElementById('mobileUnlimitedScore').checked = unlimitedScore;
    document.getElementById('mobileCustomMode').checked = customMode;

    _localCustomMode = customMode;

    document.getElementById('mobileTwoWinsMode').disabled = beachMode || customMode;
    document.getElementById('mobileBeachMode').disabled = twoWinsMode || customMode;
    document.getElementById('mobileUnlimitedScore').disabled = customMode;
    document.getElementById('mobileCustomMode').disabled = beachMode || twoWinsMode;

    // Custom settings card visibility
    var customCard = document.getElementById('customSettingsCard');
    if (customMode) {
      customCard.style.display = '';
      if (data['custom_sets_to_win'] != null) document.getElementById('customSetsToWin').value = ensureNumber(data['custom_sets_to_win']);
      if (data['custom_points_to_win'] != null) document.getElementById('customPointsToWin').value = ensureNumber(data['custom_points_to_win']);
      if (data['custom_tiebreak_points'] != null) document.getElementById('customTiebreakPoints').value = ensureNumber(data['custom_tiebreak_points']);
      if (data['custom_balance'] != null) document.getElementById('customBalance').checked = !!data['custom_balance'];
      if (data['custom_side_switch_points'] != null) document.getElementById('customSideSwitchPoints').value = ensureNumber(data['custom_side_switch_points']);
      if (data['custom_max_timeouts'] != null) document.getElementById('customMaxTimeouts').value = ensureNumber(data['custom_max_timeouts']);
    } else {
      customCard.style.display = 'none';
    }
  }

  // ===== TEAMS UI =====

  function updateTeamsUI(data) {
    document.getElementById('mobileTournament').value = data['tournament_name'] || 'НВЛ';
    document.getElementById('mobileVenue').value = data['venue'] || '';
    document.getElementById('mobileHomeTeam').value = data['home_team'] || '';
    document.getElementById('mobileAwayTeam').value = data['away_team'] || '';
    document.getElementById('mobileHomeColor').value = data['home_color'] || '#ff0000';
    document.getElementById('mobileHomeColorHex').value = data['home_color'] || '#ff0000';
    document.getElementById('mobileAwayColor').value = data['away_color'] || '#00ff00';
    document.getElementById('mobileAwayColorHex').value = data['away_color'] || '#00ff00';

    if (typeof data['tournament_name'] === 'undefined') {
      update_db({ tournament_name: 'НВЛ' });
    }
    if (typeof data['venue'] === 'undefined') {
      update_db({ venue: '' });
    }
  }

  // ===== CONTROL UI =====

  function updateControlUI(data) {
    var beachMode = !!data['beach_mode'];
    var unlimitedScore = !!data['unlimited_score'];

    document.getElementById('mHomeTeam').textContent = data['home_team'] || 'Home';
    document.getElementById('mAwayTeam').textContent = data['away_team'] || 'Away';
    document.getElementById('mHomeTeamFouls').textContent = data['home_team'] || 'Home';
    document.getElementById('mAwayTeamFouls').textContent = data['away_team'] || 'Away';

    document.getElementById('mHomeScore').textContent = ensureNumber(data['home_score']);
    document.getElementById('mAwayScore').textContent = ensureNumber(data['away_score']);
    document.getElementById('mHomeFouls').textContent = beachMode ? ensureNumber(data['home_sets']) : data['home_fouls'];
    document.getElementById('mAwayFouls').textContent = beachMode ? ensureNumber(data['away_sets']) : data['away_fouls'];
    document.getElementById('mPeriod').textContent = data['current_period'];
    document.getElementById('mCustomLabel').value = data['custom_label'] || '';

    var homeSide = data['home_side'] || 'left';
    var homeOrder = homeSide === 'left' ? 1 : 2;
    var awayOrder = homeOrder === 1 ? 2 : 1;
    var scoreCard = document.getElementById('controlScoreCard');
    var homeBlock = scoreCard.querySelector('.team-score-block:first-child');
    var awayBlock = scoreCard.querySelector('.team-score-block:last-child');
    if (homeBlock) homeBlock.style.order = homeOrder;
    if (awayBlock) awayBlock.style.order = awayOrder;

    var beachFinished = beachMode && data['beach_match_finished'];
    var classicFinished = (!beachMode) && data['classic_match_finished'];
    var matchPending = !!pendingMatchFinish;
    var matchFinished = beachFinished || classicFinished || matchPending;

    var statusEl = document.getElementById('mobileMatchStatus');
    if (matchPending) {
      statusEl.className = 'match-status pending';
      statusEl.textContent = 'Ожидание подтверждения...';
      show(statusEl);
    } else if (matchFinished) {
      statusEl.className = 'match-status finished';
      statusEl.textContent = 'Матч завершён';
      show(statusEl);
    } else {
      hide(statusEl);
    }

    var pendingNewSet = !!data['pending_new_set'];
    var startOfSet = ensureNumber(data['home_score']) === 0 && ensureNumber(data['away_score']) === 0;
    var isTimeoutActive = ensureNumber(data['show']) === 6;

    // Highlight active show button
    var currentShow = ensureNumber(data['show']);
    document.querySelectorAll('.show-select').forEach(function(btn) {
      var val = parseInt(btn.getAttribute('data-val'), 10);
      btn.classList.toggle('active', val === currentShow);
    });

    var scoreButtonsDisabled = pendingNewSet || matchFinished || isTimeoutActive;
    document.querySelectorAll('.score-btn').forEach(function(btn) { btn.disabled = scoreButtonsDisabled; });

    var foulButtonsDisabled = !startOfSet && !pendingNewSet && !matchFinished;
    document.querySelectorAll('.foul-btn').forEach(function(btn) { btn.disabled = foulButtonsDisabled; });

    var timeoutBaseDisabled = pendingNewSet || matchFinished || startOfSet;
    if (isCustomMode()) syncCustomSettings();
    var maxTimeouts = isCustomMode() ? getCustomMaxTimeouts() : (beachMode ? 1 : 2);
    var homeTimeouts = ensureNumber(data['home_timeouts']);
    var awayTimeouts = ensureNumber(data['away_timeouts']);

    document.querySelectorAll('.timeout-btn').forEach(function(btn) { btn.classList.remove('blinking'); });

    if (isTimeoutActive) {
      var currentLabel = data['custom_label'] || '';
      var homeTeam = data['home_team'] || '';
      var awayTeam = data['away_team'] || '';
      var isHomeTimeout = currentLabel === 'Таймаут ' + homeTeam;
      var isAwayTimeout = currentLabel === 'Таймаут ' + awayTeam;

      document.querySelector('.timeout-btn[data-team="home"]').disabled = timeoutBaseDisabled || isAwayTimeout || (homeTimeouts >= maxTimeouts && !isHomeTimeout);
      document.querySelector('.timeout-btn[data-team="away"]').disabled = timeoutBaseDisabled || isHomeTimeout || (awayTimeouts >= maxTimeouts && !isAwayTimeout);

      if (isHomeTimeout) document.querySelector('.timeout-btn[data-team="home"]').classList.add('blinking');
      if (isAwayTimeout) document.querySelector('.timeout-btn[data-team="away"]').classList.add('blinking');
    } else {
      document.querySelector('.timeout-btn[data-team="home"]').disabled = timeoutBaseDisabled || homeTimeouts >= maxTimeouts;
      document.querySelector('.timeout-btn[data-team="away"]').disabled = timeoutBaseDisabled || awayTimeouts >= maxTimeouts;
    }

    var newSetBtn = document.querySelector('.new-set-btn');
    var sideSwitchBtn = document.querySelector('.side-switch-btn');
    var resetBtn = document.querySelector('.reset-btn');
    var periodBtns = document.querySelectorAll('.period-btn');

    newSetBtn.disabled = !pendingNewSet || matchFinished;
    sideSwitchBtn.disabled = matchFinished;
    periodBtns.forEach(function(btn) {
      var enablePeriodButtons = (unlimitedScore || startOfSet || pendingNewSet || !!data['classic_match_finished'] || !!data['beach_match_finished']) && !matchPending;
      btn.disabled = !enablePeriodButtons;
    });

    if (pendingNewSet && !matchFinished) {
      newSetBtn.style.background = '#e94560';
      newSetBtn.style.color = 'white';
    } else {
      newSetBtn.style.background = '';
      newSetBtn.style.color = '';
    }

    var classicSwitchNeeded = !!data['classic_switch_needed'];
    var beachSwitchMessage = data['beach_switch_message'];
    if ((beachMode && beachSwitchMessage) || classicSwitchNeeded) {
      sideSwitchBtn.style.background = '#e94560';
      sideSwitchBtn.style.color = 'white';
    } else {
      sideSwitchBtn.style.background = '';
      sideSwitchBtn.style.color = '';
    }

    renderSetHistoryCtl(data['set_history']);
  }

  function renderSetHistoryCtl(history) {
    var items = history;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch(e) { items = []; }
    }
    if (!Array.isArray(items)) items = [];
    var el = document.getElementById('mSetHistory');
    if (!el) return;
    if (items.length === 0) {
      el.innerHTML = '&nbsp;';
      return;
    }
    var homeTeam = mobileScoreboardData['home_team'] || 'Home';
    var awayTeam = mobileScoreboardData['away_team'] || 'Away';
    var scoresParts = [];
    for (var i = 0; i < items.length; i++) {
      var entry = items[i] || {};
      scoresParts.push((entry.home != null ? entry.home : '-') + ':' + (entry.away != null ? entry.away : '-'));
    }
    el.innerHTML = homeTeam + ' - ' + awayTeam + ':<br>' + scoresParts.join(' ');
  }

  // ===== LINKS =====

  function updateLinks() {
    if (!mobileGameConnected) return;
    var gid = document.getElementById('mobileGameId').value.trim();
    if (!gid) return;

    var base = BASE_URL;
    document.getElementById('linkScoreboard').href = base + 'sb.html?game=' + gid;
    document.getElementById('linkScoreboardOld').href = base + 'scoreboard.html?game=' + gid;
    document.getElementById('linkControl').href = base + 'ctl.html?game=' + gid;
    document.getElementById('linkTablo').href = base + 'tablo.html?game=' + gid;
    document.getElementById('linkResults').href = base + 'results.html';
    document.getElementById('linkOnline').href = base + 'online.html';
  }

  // ===== MODALS =====

  function showMatchFinishDialog(update, setHistory, overallHome, overallAway, mode) {
    if (matchWasAlreadyFinished) {
      saveMatchResult(setHistory, overallHome, overallAway);
      update_db(update);
      return;
    }
    var homeTeam = mobileScoreboardData['home_team'] || 'Команда 1';
    var awayTeam = mobileScoreboardData['away_team'] || 'Команда 2';
    var winner = overallHome > overallAway ? homeTeam : awayTeam;
    document.getElementById('mobileMatchFinishText').innerHTML =
      'Игра завершена!<br>Победитель: <b>' + winner + '</b> (' + overallHome + ':' + overallAway + ')<br><br>Завершить игру?';

    pendingMatchFinish = { update: update, setHistory: setHistory, overallHome: overallHome, overallAway: overallAway, mode: mode };
    document.getElementById('mobileMatchFinishModal').classList.remove('hidden');
  }

  function confirmMatchFinish() {
    if (!pendingMatchFinish) return;
    var data = pendingMatchFinish;
    saveMatchResult(data.setHistory, data.overallHome, data.overallAway);
    update_db(data.update);
    pendingMatchFinish = null;
    document.getElementById('mobileMatchFinishModal').classList.add('hidden');
  }

  function cancelMatchFinish() {
    if (!pendingMatchFinish) return;
    matchWasAlreadyFinished = false;
    pendingMatchFinish = null;
    document.getElementById('mobileMatchFinishModal').classList.add('hidden');
  }

  function saveMatchResult(setHistory, overallHome, overallAway) {
    var isBeach = !!mobileScoreboardData['beach_mode'];
    var twoWinsMode = !!mobileScoreboardData['two_wins_mode'];
    var userInfo = getCurrentUserInfo();

    if (typeof overallHome === 'undefined' || typeof overallAway === 'undefined') {
      if (isBeach) {
        overallHome = ensureNumber(mobileScoreboardData['home_sets']);
        overallAway = ensureNumber(mobileScoreboardData['away_sets']);
      } else {
        overallHome = ensureNumber(mobileScoreboardData['home_fouls']);
        overallAway = ensureNumber(mobileScoreboardData['away_fouls']);
      }
    }

    var matchData = {
      date_time: DB.serverTimestamp(),
      home_team: mobileScoreboardData['home_team'],
      away_team: mobileScoreboardData['away_team'],
      tournament_name: mobileScoreboardData['tournament_name'] || 'НВЛ',
      venue: mobileScoreboardData['venue'] || '',
      overall_score: overallHome + ':' + overallAway,
      sets_score: setHistory || mobileScoreboardData['set_history'] || [],
      game_type: isBeach ? 'beach' : 'classic',
      two_wins_mode: twoWinsMode,
      game_id: game_id,
      username: userInfo.username || '',
      displayname: userInfo.displayname || '',
      is_deleted: false
    };

    DB.matches.add(matchData).then(function(docRef) {
      console.log('Match saved:', docRef.id);
      DB.scoreboard.update(game_id, { last_match_id: docRef.id }).catch(function() {});
    }).catch(function(err) {
      console.error('Error saving match:', err);
    });
  }

  // ===== TIMEOUT MODAL =====

  function showTimeoutModal(teamName) {
    stopTimeoutTimer();
    timeoutRemainingSeconds = 30;
    document.getElementById('mobileTimeoutTimer').textContent = '30';
    document.getElementById('mobileTimeoutTimer').style.color = '#e17055';
    document.getElementById('mobileTimeoutTeam').textContent = 'Таймаут: ' + teamName;
    document.getElementById('mobileTimeoutTitle').textContent = '⏸️ Таймаут - ' + teamName;
    document.getElementById('mobileTimeoutModal').classList.remove('hidden');

    timeoutTimerInterval = setInterval(function() {
      timeoutRemainingSeconds--;
      document.getElementById('mobileTimeoutTimer').textContent = timeoutRemainingSeconds;
      if (timeoutRemainingSeconds <= 5) document.getElementById('mobileTimeoutTimer').style.color = '#fdcb6e';
      if (timeoutRemainingSeconds <= 3) document.getElementById('mobileTimeoutTimer').style.color = '#e17055';
      if (timeoutRemainingSeconds <= 0) {
        stopTimeoutTimer();
        document.getElementById('mobileTimeoutModal').classList.add('hidden');
        update_db({ show: 1, custom_label: mobileScoreboardData['custom_label'] });
      }
    }, 1000);
  }

  function stopTimeoutTimer() {
    if (timeoutTimerInterval) { clearInterval(timeoutTimerInterval); timeoutTimerInterval = null; }
    timeoutRemainingSeconds = 0;
  }

  function hideTimeoutModal() {
    stopTimeoutTimer();
    document.getElementById('mobileTimeoutModal').classList.add('hidden');
  }

  // ===== GAME LOGIC =====

  var CLASSIC_POINTS_TO_WIN = 25;
  var CLASSIC_SETS_TO_WIN = 3;
  var CLASSIC_SETS_TO_WIN_TWO = 2;
  var CLASSIC_TIEBREAK_POINTS_TO_WIN = 15;
  var BEACH_SETS_TO_WIN = 2;
  var BEACH_MAX_SETS = 3;

  function isBeachMode() { return !!mobileScoreboardData['beach_mode']; }

  function isCustomMode() { return _localCustomMode; }

  function syncCustomSettings() {
    if (!_localCustomMode) return;
    _localCustomSettings.custom_sets_to_win = ensureNumber(document.getElementById('customSetsToWin').value) || 3;
    _localCustomSettings.custom_points_to_win = ensureNumber(document.getElementById('customPointsToWin').value) || 25;
    _localCustomSettings.custom_tiebreak_points = ensureNumber(document.getElementById('customTiebreakPoints').value) || 15;
    _localCustomSettings.custom_balance = document.getElementById('customBalance').checked;
    _localCustomSettings.custom_side_switch_points = ensureNumber(document.getElementById('customSideSwitchPoints').value) || 7;
    var maxT = document.getElementById('customMaxTimeouts').value;
    _localCustomSettings.custom_max_timeouts = maxT === '' ? 2 : ensureNumber(maxT);
  }

  function getCustomPointsToWin() {
    return _localCustomSettings.custom_points_to_win || CLASSIC_POINTS_TO_WIN;
  }

  function getCustomTiebreakPoints() {
    return _localCustomSettings.custom_tiebreak_points || 15;
  }

  function getCustomSetsToWin() {
    return _localCustomSettings.custom_sets_to_win || CLASSIC_SETS_TO_WIN;
  }

  function getCustomBalance() {
    return _localCustomSettings.custom_balance;
  }

  function getCustomSideSwitch() {
    return _localCustomSettings.custom_side_switch_points > 0;
  }

  function getCustomSideSwitchPoints() {
    return ensureNumber(_localCustomSettings.custom_side_switch_points);
  }

  function getCustomMaxTimeouts() {
    return _localCustomSettings.custom_max_timeouts;
  }

  function getBeachSetNumber() {
    var setNumber = ensureNumber(mobileScoreboardData['beach_current_set']);
    if (!setNumber) setNumber = ensureNumber(mobileScoreboardData['current_period']);
    if (setNumber <= 0) setNumber = 1;
    if (setNumber > BEACH_MAX_SETS) setNumber = BEACH_MAX_SETS;
    return setNumber;
  }

  function getBeachTarget(setNumber) { return setNumber >= 3 ? 15 : 21; }
  function getBeachSwitchInterval(setNumber) { return setNumber >= 3 ? 5 : 7; }
  function formatScore(homeScore, awayScore) { return homeScore + ':' + awayScore; }

  function hasTeamWonSet(team, homeScore, awayScore, target) {
    var diff = Math.abs(homeScore - awayScore);
    if (team === 'home') return (homeScore >= target) && (diff >= 2);
    return (awayScore >= target) && (diff >= 2);
  }

  function cloneSetHistory() {
    var history = mobileScoreboardData['set_history'];
    if (!Array.isArray(history)) return [];
    return history.slice(0, 5);
  }

  function nextSetHistory(homeScore, awayScore) {
    var history = cloneSetHistory();
    history.push({ home: homeScore, away: awayScore });
    if (history.length > 5) history.shift();
    return history;
  }

  function flipSidesPayload(extra) {
    var currentSide = mobileScoreboardData['home_side'] || 'left';
    var newHomeSide = currentSide === 'left' ? 'right' : 'left';
    var payload = { home_side: newHomeSide, away_side: newHomeSide === 'left' ? 'right' : 'left' };
    if (extra) Object.assign(payload, extra);
    return payload;
  }

  function classicSetWon(teamScore, opponentScore) {
    var period = ensureNumber(mobileScoreboardData['current_period']);

    if (isCustomMode()) {
      syncCustomSettings();
      var setsToWin = getCustomSetsToWin();
      var isTiebreak = (period === setsToWin);
      var target = isTiebreak ? getCustomTiebreakPoints() : getCustomPointsToWin();
      if (getCustomBalance()) {
        return teamScore >= target && (teamScore - opponentScore) >= 2;
      }
      return teamScore >= target;
    }

    var twoWinsMode = !!mobileScoreboardData['two_wins_mode'];
    var target2;
    if (twoWinsMode) {
      target2 = (period === 3) ? CLASSIC_TIEBREAK_POINTS_TO_WIN : CLASSIC_POINTS_TO_WIN;
    } else {
      target2 = (period === 5) ? 15 : CLASSIC_POINTS_TO_WIN;
    }
    return teamScore >= target2 && (teamScore - opponentScore) >= 2;
  }

  function applySetWin(team, homeScore, awayScore, baseUpdate) {
    var isBeach = isBeachMode();

    if (isBeach) {
      var homeSets = ensureNumber(mobileScoreboardData['home_sets']);
      var awaySets = ensureNumber(mobileScoreboardData['away_sets']);
      if (team === 'home') homeSets++; else awaySets++;
      var matchFinished = homeSets >= BEACH_SETS_TO_WIN || awaySets >= BEACH_SETS_TO_WIN;
      var currentSet = getBeachSetNumber();
      var update = Object.assign({}, baseUpdate || {});
      update['home_sets'] = homeSets;
      update['away_sets'] = awaySets;
      if (!('beach_switch_message' in update)) update['beach_switch_message'] = '';

      if (matchFinished || currentSet >= BEACH_MAX_SETS) {
        update['beach_match_finished'] = true;
        update['home_score'] = homeScore;
        update['away_score'] = awayScore;
        update['current_period'] = currentSet;
        update['beach_current_set'] = currentSet;
      } else {
        update['home_score'] = homeScore;
        update['away_score'] = awayScore;
        update['next_beach_set'] = currentSet + 1;
        update['pending_new_set'] = true;
        update['home_timeouts'] = 0;
        update['away_timeouts'] = 0;
      }
      update['set_history'] = nextSetHistory(homeScore, awayScore);
      if (matchFinished && !matchWasAlreadyFinished) {
        showMatchFinishDialog(update, update['set_history'], homeSets, awaySets, 'beach');
      } else {
        update_db(update);
      }
    } else {
      var homeFouls = ensureNumber(mobileScoreboardData['home_fouls']);
      var awayFouls = ensureNumber(mobileScoreboardData['away_fouls']);
      if (team === 'home') homeFouls++; else awayFouls++;

      var setsToWin, matchFinished2, currentPeriod, maxPeriod, nextPeriod;

      if (isCustomMode()) {
        setsToWin = getCustomSetsToWin();
        matchFinished2 = homeFouls >= setsToWin || awayFouls >= setsToWin;
        currentPeriod = ensureNumber(mobileScoreboardData['current_period']) || 1;
        maxPeriod = ensureNumber(mobileScoreboardData['period_count']) || 9;
        nextPeriod = currentPeriod < maxPeriod ? currentPeriod + 1 : currentPeriod;
      } else {
        var twoWinsMode = !!mobileScoreboardData['two_wins_mode'];
        setsToWin = twoWinsMode ? CLASSIC_SETS_TO_WIN_TWO : CLASSIC_SETS_TO_WIN;
        matchFinished2 = homeFouls >= setsToWin || awayFouls >= setsToWin;
        currentPeriod = ensureNumber(mobileScoreboardData['current_period']) || 1;
        maxPeriod = ensureNumber(mobileScoreboardData['period_count']) || 5;
        nextPeriod = currentPeriod < maxPeriod ? currentPeriod + 1 : currentPeriod;
      }
      var update2 = Object.assign({}, baseUpdate, {
        home_fouls: homeFouls, away_fouls: awayFouls, current_period: currentPeriod, classic_match_finished: matchFinished2
      });
      if (!matchFinished2) {
        var classic_tiebreak_switch_done;
        if (isCustomMode()) {
          classic_tiebreak_switch_done = true;
        } else {
          var twoWinsMode = !!mobileScoreboardData['two_wins_mode'];
          var tiebreakSet = twoWinsMode ? 3 : 5;
          classic_tiebreak_switch_done = nextPeriod === tiebreakSet ? false : true;
        }
        var flip = flipSidesPayload({ classic_tiebreak_switch_done: classic_tiebreak_switch_done });
        update2['pending_home_side'] = flip.home_side;
        update2['pending_away_side'] = flip.away_side;
        update2['pending_classic_tiebreak_switch_done'] = flip.classic_tiebreak_switch_done;
        update2['next_period'] = nextPeriod;
        update2['pending_new_set'] = true;
        update2['home_timeouts'] = 0;
        update2['away_timeouts'] = 0;
      } else {
        update2['classic_tiebreak_switch_done'] = true;
      }
      update2['home_score'] = team === 'home' ? homeScore : awayScore;
      update2['away_score'] = team === 'home' ? awayScore : homeScore;
      update2['set_history'] = nextSetHistory(update2['home_score'], update2['away_score']);

      if (matchFinished2 && !matchWasAlreadyFinished) {
        showMatchFinishDialog(update2, update2['set_history'], homeFouls, awayFouls, 'classic');
      } else if (matchFinished2 && matchWasAlreadyFinished) {
        saveMatchResult(update2['set_history'], homeFouls, awayFouls);
        update_db(update2);
      } else {
        update_db(update2);
      }
    }
  }

  function handleBeachScore(team, delta) {
    if (mobileScoreboardData['beach_match_finished'] || mobileScoreboardData['classic_match_finished'] || pendingMatchFinish) return;
    var scoreKey = team + '_score';
    var otherKey = team === 'home' ? 'away_score' : 'home_score';
    var currentScore = ensureNumber(mobileScoreboardData[scoreKey]);
    var newScore = currentScore + delta;
    if (newScore < 0) return;
    var otherScore = ensureNumber(mobileScoreboardData[otherKey]);
    var update = {};
    update[scoreKey] = newScore;

    var setNumber = getBeachSetNumber();
    var target = getBeachTarget(setNumber);
    var interval = getBeachSwitchInterval(setNumber);
    var homeBefore = ensureNumber(mobileScoreboardData['home_score']);
    var awayBefore = ensureNumber(mobileScoreboardData['away_score']);
    var totalBefore = homeBefore + awayBefore;
    var totalAfter = totalBefore + delta;

    if (delta > 0 && Math.floor(totalAfter / interval) > Math.floor(totalBefore / interval)) {
      var homeAfter = team === 'home' ? newScore : otherScore;
      var awayAfter = team === 'home' ? otherScore : newScore;
      update['beach_switch_message'] = 'Смена площадок — ' + setNumber + ' сет, счёт ' + formatScore(homeAfter, awayAfter);
      mobileScoreboardData['beach_switch_message'] = update['beach_switch_message'];
      highlightSideSwitch(true);
    }

    var homeAfterScore = team === 'home' ? newScore : otherScore;
    var awayAfterScore = team === 'home' ? otherScore : newScore;
    if (delta > 0 && hasTeamWonSet(team, homeAfterScore, awayAfterScore, target)) {
      applySetWin(team, homeAfterScore, awayAfterScore, update);
    } else {
      update_db(update);
    }
  }

  function highlightSideSwitch(needed, message) {
    var btn = document.querySelector('.side-switch-btn');
    if (needed) {
      btn.style.background = '#e94560';
      btn.style.color = 'white';
    } else {
      btn.style.background = '';
      btn.style.color = '';
    }
  }

  function handleClassicScore(team, delta) {
    if (mobileScoreboardData['classic_match_finished'] || pendingMatchFinish) return;
    var scoreKey = team + '_score';
    var otherKey = team === 'home' ? 'away_score' : 'home_score';
    var currentScore = ensureNumber(mobileScoreboardData[scoreKey]);
    var newScore = currentScore + delta;
    if (newScore < 0) return;
    var update = {};
    update[scoreKey] = newScore;
    var otherScore = ensureNumber(mobileScoreboardData[otherKey]);
    var homeAfter = team === 'home' ? newScore : ensureNumber(mobileScoreboardData['home_score']);
    var awayAfter = team === 'home' ? otherScore : newScore;

    var twoWinsMode = !!mobileScoreboardData['two_wins_mode'];
    var currentPeriod = ensureNumber(mobileScoreboardData['current_period']);

    var sideSwitchTriggered = false;

    if (isCustomMode()) {
      syncCustomSettings();
      if (getCustomSideSwitch()) {
        var interval = getCustomSideSwitchPoints();
        var totalScore = homeAfter + awayAfter;
        var shouldSwitch = totalScore > 0 && totalScore % interval === 0;
        if (shouldSwitch) {
          if (!mobileScoreboardData['classic_switch_shown']) {
            update['classic_switch_needed'] = true;
            update['classic_switch_message'] = 'Смена площадок — счёт ' + formatScore(homeAfter, awayAfter);
            update['classic_switch_shown'] = true;
            mobileScoreboardData['classic_switch_needed'] = true;
            mobileScoreboardData['classic_switch_message'] = update['classic_switch_message'];
            sideSwitchTriggered = true;
          }
        } else if (mobileScoreboardData['classic_switch_needed']) {
          var DEL = DB.deleteField();
          update['classic_switch_needed'] = DEL;
          update['classic_switch_message'] = DEL;
          delete mobileScoreboardData['classic_switch_needed'];
          delete mobileScoreboardData['classic_switch_message'];
        }
      }
    } else if (!isCustomMode()) {
      var tiebreakSet = twoWinsMode ? 3 : 5;
      if (!isBeachMode() && currentPeriod === tiebreakSet && Math.max(homeAfter, awayAfter) >= 8) {
        if (!mobileScoreboardData['classic_switch_shown']) {
          update['classic_switch_needed'] = true;
          update['classic_switch_message'] = 'Смена площадок — ' + tiebreakSet + '-й сет, счёт ' + formatScore(homeAfter, awayAfter);
          update['classic_switch_shown'] = true;
          mobileScoreboardData['classic_switch_needed'] = true;
          mobileScoreboardData['classic_switch_message'] = update['classic_switch_message'];
          sideSwitchTriggered = true;
        }
      } else if (mobileScoreboardData['classic_switch_needed']) {
        var DEL2 = DB.deleteField();
        update['classic_switch_needed'] = DEL2;
        update['classic_switch_message'] = DEL2;
        delete mobileScoreboardData['classic_switch_needed'];
        delete mobileScoreboardData['classic_switch_message'];
      }
    }

    if (sideSwitchTriggered) {
      highlightSideSwitch(true);
    }

    var unlimitedScore = !!mobileScoreboardData['unlimited_score'];
    if (delta > 0 && !unlimitedScore && classicSetWon(newScore, otherScore)) {
      applySetWin(team, newScore, otherScore, update);
      return;
    }
    update_db(update);
  }

  // ===== NEW SET =====

  function performNewSetUpdate() {
    var update = { home_score: 0, away_score: 0, beach_switch_message: '', home_timeouts: 0, away_timeouts: 0 };
    if (isBeachMode()) {
      var nextSet = mobileScoreboardData['next_beach_set'];
      if (!nextSet) nextSet = ensureNumber(mobileScoreboardData['beach_current_set']) + 1;
      update['beach_current_set'] = nextSet;
      update['current_period'] = nextSet;
      update['next_beach_set'] = DB.deleteField();
      update['pending_new_set'] = DB.deleteField();
      update_db(update);
      return;
    }
    var nextPeriod = mobileScoreboardData['next_period'];
    if (!nextPeriod) nextPeriod = ensureNumber(mobileScoreboardData['current_period']) + 1;
    update['current_period'] = nextPeriod;
    if (mobileScoreboardData['pending_home_side'] != null) update['home_side'] = mobileScoreboardData['pending_home_side'];
    if (mobileScoreboardData['pending_away_side'] != null) update['away_side'] = mobileScoreboardData['pending_away_side'];
    if (mobileScoreboardData['pending_classic_tiebreak_switch_done'] != null) update['classic_tiebreak_switch_done'] = mobileScoreboardData['pending_classic_tiebreak_switch_done'];
    update['next_period'] = DB.deleteField();
    update['pending_home_side'] = DB.deleteField();
    update['pending_away_side'] = DB.deleteField();
    update['pending_classic_tiebreak_switch_done'] = DB.deleteField();
    update['pending_new_set'] = DB.deleteField();
    update_db(update);
  }

  // ===== EVENT HANDLERS =====

  function initEventHandlers() {
    // Login
    document.getElementById('loginBtn').addEventListener('click', doLogin);
    document.getElementById('loginPassword').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doLogin();
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', doLogout);

    // Game ID
    document.getElementById('generateGameId').addEventListener('click', function() {
      document.getElementById('mobileGameId').value = generateUUID();
    });

    document.getElementById('connectGameBtn').addEventListener('click', connectToGame);

    // Mode toggles
    document.getElementById('mobileBeachMode').addEventListener('change', function() {
      var enabled = this.checked;
      if (enabled) _localCustomMode = false;
      var update = {
        beach_mode: enabled, beach_match_finished: false, set_history: [], classic_match_finished: false,
        classic_tiebreak_switch_done: true, home_timeouts: 0, away_timeouts: 0
      };
      if (enabled) {
        update['home_sets'] = 0; update['away_sets'] = 0; update['home_score'] = 0; update['away_score'] = 0;
        update['beach_current_set'] = 1; update['current_period'] = 1; update['beach_switch_message'] = '';
        update['period_count'] = 3; update['classic_match_finished'] = false; update['two_wins_mode'] = false;
        update['custom_mode'] = false;
      } else {
        update['beach_switch_message'] = ''; update['home_sets'] = 0; update['away_sets'] = 0;
        update['beach_current_set'] = 1; update['period_count'] = 5; update['home_score'] = 0; update['away_score'] = 0;
      }
      update_db(update);
    });

    document.getElementById('mobileTwoWinsMode').addEventListener('change', function() {
      var enabled = this.checked;
      if (enabled) _localCustomMode = false;
      var update = {
        two_wins_mode: enabled, classic_match_finished: false, set_history: [], beach_match_finished: false,
        home_timeouts: 0, away_timeouts: 0
      };
      if (enabled) {
        update['home_fouls'] = 0; update['away_fouls'] = 0; update['home_score'] = 0; update['away_score'] = 0;
        update['current_period'] = 1; update['period_count'] = 3; update['classic_tiebreak_switch_done'] = true;
        update['beach_mode'] = false; update['custom_mode'] = false;
      } else {
        update['home_fouls'] = 0; update['away_fouls'] = 0; update['home_score'] = 0; update['away_score'] = 0;
        update['current_period'] = 1; update['period_count'] = 5;
      }
      update_db(update);
    });

    document.getElementById('mobileInvertTablo').addEventListener('change', function() {
      update_db({ invert_tablo: this.checked });
    });

    document.getElementById('mobileUnlimitedScore').addEventListener('change', function() {
      update_db({ unlimited_score: this.checked });
    });

    // Custom mode toggle
    document.getElementById('mobileCustomMode').addEventListener('change', function() {
      var enabled = this.checked;
      _localCustomMode = enabled;
      if (enabled) syncCustomSettings();
      var update = {
        custom_mode: enabled, classic_match_finished: false, set_history: [], beach_match_finished: false,
        home_timeouts: 0, away_timeouts: 0
      };
      if (enabled) {
        update['home_fouls'] = 0; update['away_fouls'] = 0; update['home_score'] = 0; update['away_score'] = 0;
        update['current_period'] = 1; update['classic_tiebreak_switch_done'] = true;
        update['beach_mode'] = false; update['two_wins_mode'] = false; update['unlimited_score'] = false;
        update['period_count'] = 9;
        update['custom_sets_to_win'] = _localCustomSettings.custom_sets_to_win;
        update['custom_points_to_win'] = _localCustomSettings.custom_points_to_win;
        update['custom_tiebreak_points'] = _localCustomSettings.custom_tiebreak_points;
        update['custom_balance'] = _localCustomSettings.custom_balance;
        update['custom_side_switch_points'] = _localCustomSettings.custom_side_switch_points;
        update['custom_max_timeouts'] = _localCustomSettings.custom_max_timeouts;
      } else {
        update['home_fouls'] = 0; update['away_fouls'] = 0; update['home_score'] = 0; update['away_score'] = 0;
        update['current_period'] = 1; update['period_count'] = 5;
      }
      update_db(update);
    });

    // Save custom settings
    document.getElementById('saveCustomSettings').addEventListener('click', function() {
      if (!mobileGameConnected) return;
      syncCustomSettings();
      update_db({
        custom_sets_to_win: _localCustomSettings.custom_sets_to_win,
        custom_points_to_win: _localCustomSettings.custom_points_to_win,
        custom_tiebreak_points: _localCustomSettings.custom_tiebreak_points,
        custom_balance: _localCustomSettings.custom_balance,
        custom_side_switch_points: _localCustomSettings.custom_side_switch_points,
        custom_max_timeouts: _localCustomSettings.custom_max_timeouts,
        classic_match_finished: false, beach_match_finished: false, set_history: [],
        home_fouls: 0, away_fouls: 0, home_score: 0, away_score: 0,
        current_period: 1, classic_tiebreak_switch_done: true,
        home_timeouts: 0, away_timeouts: 0, pending_new_set: DB.deleteField(),
        next_period: DB.deleteField(), classic_switch_needed: DB.deleteField(),
        classic_switch_shown: DB.deleteField(), classic_switch_message: DB.deleteField()
      });
    });

    // Teams save
    document.getElementById('saveTeamsBtn').addEventListener('click', function() {
      update_db({
        away_team: document.getElementById('mobileAwayTeam').value,
        away_color: document.getElementById('mobileAwayColor').value,
        home_team: document.getElementById('mobileHomeTeam').value,
        home_color: document.getElementById('mobileHomeColor').value,
        tournament_name: document.getElementById('mobileTournament').value || 'НВЛ',
        venue: document.getElementById('mobileVenue').value || ''
      });
      showControlContent();
    });

    // Color sync
    document.getElementById('mobileHomeColor').addEventListener('input', function() {
      document.getElementById('mobileHomeColorHex').value = this.value;
    });
    document.getElementById('mobileHomeColorHex').addEventListener('input', function() {
      if (/^#[0-9a-f]{6}$/i.test(this.value)) document.getElementById('mobileHomeColor').value = this.value;
    });
    document.getElementById('mobileAwayColor').addEventListener('input', function() {
      document.getElementById('mobileAwayColorHex').value = this.value;
    });
    document.getElementById('mobileAwayColorHex').addEventListener('input', function() {
      if (/^#[0-9a-f]{6}$/i.test(this.value)) document.getElementById('mobileAwayColor').value = this.value;
    });

    // Score buttons
    document.querySelectorAll('.score-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (pendingMatchFinish) return;
        var team = this.getAttribute('data-team');
        var delta = parseInt(this.getAttribute('data-delta'), 10);

        var pendingNewSet = !!mobileScoreboardData['pending_new_set'];
        if (delta < 0 && pendingNewSet) {
          var history = Array.isArray(mobileScoreboardData['set_history']) ? mobileScoreboardData['set_history'] : [];
          var last = history.length ? history[history.length - 1] : null;
          if (last) {
            var winner = (last.home > last.away) ? 'home' : (last.away > last.home ? 'away' : null);
            if (winner && team === winner) {
              var revertUpdate = {};
              if (isBeachMode()) {
                if (winner === 'home') {
                  revertUpdate['home_sets'] = Math.max(0, ensureNumber(mobileScoreboardData['home_sets']) - 1);
                  revertUpdate['home_score'] = Math.max(0, ensureNumber(mobileScoreboardData['home_score']) - 1);
                } else {
                  revertUpdate['away_sets'] = Math.max(0, ensureNumber(mobileScoreboardData['away_sets']) - 1);
                  revertUpdate['away_score'] = Math.max(0, ensureNumber(mobileScoreboardData['away_score']) - 1);
                }
                var newHist = cloneSetHistory(); newHist.pop();
                revertUpdate['set_history'] = newHist;
                revertUpdate['next_beach_set'] = null;
                revertUpdate['pending_new_set'] = null;
                revertUpdate['beach_match_finished'] = false;
                revertUpdate['home_timeouts'] = 0;
                revertUpdate['away_timeouts'] = 0;
              } else {
                if (winner === 'home') {
                  revertUpdate['home_fouls'] = Math.max(0, ensureNumber(mobileScoreboardData['home_fouls']) - 1);
                  revertUpdate['home_score'] = Math.max(0, ensureNumber(mobileScoreboardData['home_score']) - 1);
                } else {
                  revertUpdate['away_fouls'] = Math.max(0, ensureNumber(mobileScoreboardData['away_fouls']) - 1);
                  revertUpdate['away_score'] = Math.max(0, ensureNumber(mobileScoreboardData['away_score']) - 1);
                }
                var newHist2 = cloneSetHistory(); newHist2.pop();
                revertUpdate['set_history'] = newHist2;
                revertUpdate['next_period'] = null;
                revertUpdate['pending_home_side'] = null;
                revertUpdate['pending_away_side'] = null;
                revertUpdate['pending_classic_tiebreak_switch_done'] = null;
                revertUpdate['pending_new_set'] = null;
                revertUpdate['classic_match_finished'] = false;
                revertUpdate['home_timeouts'] = 0;
                revertUpdate['away_timeouts'] = 0;
              }
              update_db(revertUpdate);
              return;
            }
          }
        }

        if (isBeachMode()) {
          handleBeachScore(team, delta);
        } else {
          handleClassicScore(team, delta);
        }
      });
    });

    // Foul buttons
    document.querySelectorAll('.foul-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var team = this.getAttribute('data-team');
        var delta = parseInt(this.getAttribute('data-delta'), 10);
        var key = team + '_fouls';
        var newVal = ensureNumber(mobileScoreboardData[key]) + delta;
        if (delta > 0 || newVal >= 0) {
          var update = {};
          update[key] = newVal;
          update_db(update);
        }
      });
    });

    // Period buttons
    document.querySelectorAll('.period-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (pendingMatchFinish) return;
        var delta = parseInt(this.getAttribute('data-delta'), 10);
        var startOfSet = ensureNumber(mobileScoreboardData['home_score']) === 0 && ensureNumber(mobileScoreboardData['away_score']) === 0;

        if (startOfSet) {
          var currentPeriod = ensureNumber(mobileScoreboardData['current_period']);
          var newPeriod = currentPeriod + delta;
          var maxPeriod = ensureNumber(mobileScoreboardData['period_count']) || (isCustomMode() ? 9 : 5);
          var hs = ensureNumber(mobileScoreboardData['home_score']);
          var as = ensureNumber(mobileScoreboardData['away_score']);
          var hf = ensureNumber(mobileScoreboardData['home_fouls']);
          var af = ensureNumber(mobileScoreboardData['away_fouls']);
          if (hs > as) hf++;
          if (as > hs) af++;
          if (newPeriod > 0 && newPeriod <= maxPeriod) {
            update_db({ current_period: newPeriod, away_fouls: af, home_fouls: hf, home_score: 0, away_score: 0 });
          }
          return;
        }

        if (delta > 0) {
          var unlimitedScore = !!mobileScoreboardData['unlimited_score'];
          var homeScore = ensureNumber(mobileScoreboardData['home_score']);
          var awayScore = ensureNumber(mobileScoreboardData['away_score']);
          var curPeriod = ensureNumber(mobileScoreboardData['current_period']);
          var target;
          if (isCustomMode()) {
            target = getCustomPointsToWin();
          } else {
            target = (curPeriod === 5) ? 15 : 25;
          }
          if (unlimitedScore && homeScore >= target && homeScore - awayScore >= 2) {
            applySetWin('home', homeScore, awayScore, {});
          } else if (unlimitedScore && awayScore >= target && awayScore - homeScore >= 2) {
            applySetWin('away', awayScore, homeScore, {});
          }
          performNewSetUpdate();
          return;
        }

        var currentPeriod2 = ensureNumber(mobileScoreboardData['current_period']);
        var newPeriod2 = currentPeriod2 + delta;
        var maxPeriod2 = ensureNumber(mobileScoreboardData['period_count']) || (isCustomMode() ? 9 : 5);
        var hs2 = ensureNumber(mobileScoreboardData['home_score']);
        var as2 = ensureNumber(mobileScoreboardData['away_score']);
        var hf2 = ensureNumber(mobileScoreboardData['home_fouls']);
        var af2 = ensureNumber(mobileScoreboardData['away_fouls']);
        if (hs2 > as2) hf2++;
        if (as2 > hs2) af2++;
        if (newPeriod2 > 0 && newPeriod2 <= maxPeriod2) {
          update_db({ current_period: newPeriod2, away_fouls: af2, home_fouls: hf2, home_score: 0, away_score: 0 });
        }
      });
    });

    // Timeout buttons
    document.querySelectorAll('.timeout-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (pendingMatchFinish) return;
        var team = this.getAttribute('data-team');
        var teamName = team === 'home' ? mobileScoreboardData['home_team'] : mobileScoreboardData['away_team'];
        var timeoutLabel = 'Таймаут ' + teamName;
        var currentShow = ensureNumber(mobileScoreboardData['show']);
        var beachMode = isBeachMode();
        if (isCustomMode()) syncCustomSettings();
        var maxTimeouts = isCustomMode() ? getCustomMaxTimeouts() : (beachMode ? 1 : 2);
        var timeoutKey = team + '_timeouts';
        var currentTimeouts = ensureNumber(mobileScoreboardData[timeoutKey]);

        var update;
        if (currentShow === 6) {
          var currentLabel = mobileScoreboardData['custom_label'] || '';
          var homeTeam = mobileScoreboardData['home_team'] || '';
          var awayTeam = mobileScoreboardData['away_team'] || '';
          var isHomeTimeout = currentLabel === 'Таймаут ' + homeTeam;
          var isAwayTimeout = currentLabel === 'Таймаут ' + awayTeam;

          if ((team === 'home' && isHomeTimeout) || (team === 'away' && isAwayTimeout)) {
            update = { show: 1, custom_label: mobileScoreboardData['custom_label'] };
          } else {
            return;
          }
        } else {
          if (currentTimeouts >= maxTimeouts) return;
          update = { show: 6, custom_label: timeoutLabel };
          update[timeoutKey] = currentTimeouts + 1;
        }

        update_db(update);
        if (currentShow === 6) {
          hideTimeoutModal();
        } else {
          showTimeoutModal(teamName);
        }
      });
    });

    document.getElementById('mobileTimeoutClose').addEventListener('click', function() {
      hideTimeoutModal();
      var currentShow = ensureNumber(mobileScoreboardData['show']);
      if (currentShow === 6) {
        update_db({ show: 1, custom_label: mobileScoreboardData['custom_label'] });
      }
    });

    // Side switch
    document.querySelector('.side-switch-btn').addEventListener('click', function() {
      var update = flipSidesPayload();
      var DEL = DB.deleteField();
      update['classic_switch_needed'] = DEL;
      update['classic_switch_message'] = DEL;
      update['beach_switch_message'] = DEL;
      update['classic_switch_shown'] = DEL;
      update['lastEdited'] = DB.serverTimestamp();
      delete mobileScoreboardData['classic_switch_needed'];
      delete mobileScoreboardData['classic_switch_message'];
      delete mobileScoreboardData['beach_switch_message'];
      delete mobileScoreboardData['classic_switch_shown'];
      highlightSideSwitch(false);
      scoreboard_query.update(update);
    });

    // New set
    document.querySelector('.new-set-btn').addEventListener('click', function() {
      var update = { home_score: 0, away_score: 0, beach_switch_message: '', home_timeouts: 0, away_timeouts: 0 };
      if (isBeachMode()) {
        var nextSet = mobileScoreboardData['next_beach_set'];
        if (!nextSet) nextSet = ensureNumber(mobileScoreboardData['beach_current_set']) + 1;
        update['beach_current_set'] = nextSet;
        update['current_period'] = nextSet;
        update['next_beach_set'] = null;
        update['pending_new_set'] = null;
        update_db(update);
        return;
      }
      var nextPeriod = mobileScoreboardData['next_period'];
      if (!nextPeriod) nextPeriod = ensureNumber(mobileScoreboardData['current_period']) + 1;
      update['current_period'] = nextPeriod;
      if (mobileScoreboardData['pending_home_side'] != null) update['home_side'] = mobileScoreboardData['pending_home_side'];
      if (mobileScoreboardData['pending_away_side'] != null) update['away_side'] = mobileScoreboardData['pending_away_side'];
      if (mobileScoreboardData['pending_classic_tiebreak_switch_done'] != null) update['classic_tiebreak_switch_done'] = mobileScoreboardData['pending_classic_tiebreak_switch_done'];
      update['next_period'] = null;
      update['pending_home_side'] = null;
      update['pending_away_side'] = null;
      update['pending_classic_tiebreak_switch_done'] = null;
      update['pending_new_set'] = null;
      update_db(update);
    });

    // Show buttons
    document.querySelectorAll('.show-select').forEach(function(btn) {
      btn.addEventListener('click', function() {
        update_db({ show: parseInt(this.getAttribute('data-val'), 10) });
      });
    });

    // Label
    document.querySelector('.label-btn').addEventListener('click', function() {
      update_db({ custom_label: document.getElementById('mCustomLabel').value });
    });

    // Reset
    document.querySelector('.reset-btn').addEventListener('click', function() {
      if (pendingMatchFinish) return;
      if (!confirm('Сбросить игру? Текущий счёт будет потерян.')) return;

      var beachEnabled = isBeachMode();
      var invertTablo = !!mobileScoreboardData['invert_tablo'];
      var userInfo = getCurrentUserInfo();

      var resetData = {
        show: 1, home_score: 0, home_fouls: 0, away_score: 0, away_fouls: 0, current_period: 1,
        custom_label: "Таймаут",
        away_team: document.getElementById('mobileAwayTeam').value,
        away_color: document.getElementById('mobileAwayColor').value,
        home_team: document.getElementById('mobileHomeTeam').value,
        home_color: document.getElementById('mobileHomeColor').value,
        tournament_name: document.getElementById('mobileTournament').value,
        venue: document.getElementById('mobileVenue').value || '',
        home_sets: 0, away_sets: 0, home_timeouts: 0, away_timeouts: 0,
        beach_mode: beachEnabled, beach_current_set: 1, beach_switch_message: '',
        beach_match_finished: false, period_count: beachEnabled ? 3 : 5, set_history: [],
        classic_match_finished: false, home_side: 'left', away_side: 'right',
        classic_tiebreak_switch_done: true, invert_tablo: invertTablo,
        unlimited_score: false, two_wins_mode: false,
        pending_new_set: DB.deleteField(), next_period: DB.deleteField(),
        next_beach_set: DB.deleteField(), pending_home_side: DB.deleteField(),
        pending_away_side: DB.deleteField(), pending_classic_tiebreak_switch_done: DB.deleteField(),
        classic_switch_needed: DB.deleteField(), classic_switch_shown: DB.deleteField(),
        classic_switch_message: DB.deleteField(),
        lastEdited: DB.serverTimestamp(), username: userInfo.username || '', displayname: userInfo.displayname || ''
      };

      matchWasAlreadyFinished = false;
      DB.scoreboard.update(game_id, resetData).catch(function(err) {
        alert('Ошибка при сбросе: ' + err.message);
      });
    });

    // Match finish modal
    document.getElementById('mobileMatchFinishYes').addEventListener('click', confirmMatchFinish);
    document.getElementById('mobileMatchFinishNo').addEventListener('click', cancelMatchFinish);

    // Offline detection
    window.addEventListener('online', function() {
      document.getElementById('offlineBanner').classList.remove('visible');
    });
    window.addEventListener('offline', function() {
      document.getElementById('offlineBanner').classList.add('visible');
    });
  }

  // ===== INIT =====

  function init() {
    initTabs();
    initEventHandlers();
    initAuth();

    // Auto-fill game_id from URL
    var urlGameId = new URLSearchParams(window.location.search).get('game');
    if (urlGameId) {
      document.getElementById('mobileGameId').value = urlGameId;
    } else {
      document.getElementById('mobileGameId').value = generateUUID();
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function() {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
