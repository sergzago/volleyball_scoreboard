var scoreboard_data={};
scoreboard_query.onSnapshot(
  function(documentSnapshot){
    var pdata=scoreboard_data;
    if(!documentSnapshot.exists){
      pdata={show:0};
      scoreboard_data={
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
    }else{
      scoreboard_data=documentSnapshot.data();
    }
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
    var currentPeriod = scoreboard_data['current_period'] || 1;
    $('.timeval').html(currentPeriod)
    var showTop = !!(scoreboard_data.show & 1);
    var showBottom = !!(scoreboard_data.show & 2);
    renderSetHistory(scoreboard_data['set_history'], showTop, showBottom);
    // Обновляем порядок на табло (функция сама проверит наличие элементов)
    updateTabloSides();
  });

function renderSetHistory(history, showTop, showBottom){
  var items=Array.isArray(history)?history:[];
  var text='';
  if(items.length>0){
    var parts=[];
    for(var i=0;i<items.length;i++){
      var entry=items[i]||{};
      var home=(entry.home!=null)?entry.home:'-';
      var away=(entry.away!=null)?entry.away:'-';
      parts.push(home+':'+away);
    }
    text=parts.join(' ');
  }
  var hasHistory = text.length>0;
  updateHistoryElement('#set-history-top', showTop && hasHistory, text);
  updateHistoryElement('#set-history-bottom', showBottom && hasHistory, text);
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
    teamContainer.css('display','flex');
    teamContainer.find('.home_team').css('order', homeOrder);
    teamContainer.find('.away_team').css('order', awayOrder);
    var teamSep = teamContainer.find('.teams-separator');
    if(teamSep.length){
      teamSep.css('order', separatorOrder);
    }
  }
}

