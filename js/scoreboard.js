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
        "home_team": "--------"
      };
    }else{
      scoreboard_data=documentSnapshot.data();
    }
    if(pdata['show'] != scoreboard_data['show']){
      if(scoreboard_data.show & 2){
        $(".big-table").animate({"left":80},1000)
      }else{
        $(".big-table").animate({"left":-800},1000)
      }

      if(scoreboard_data.show & 1){
        $("table#top").animate({"margin-top":0},1000)
      }else{
        $("table#top").animate({"margin-top":-80},1000)
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
    $('.away_fouls').html(scoreboard_data['away_fouls'])
    $(".away_color").css("background-color",scoreboard_data['away_color'])
    $('.home_team').html(scoreboard_data['home_team'])
    $('.home_score').html(scoreboard_data['home_score'])
    $('.home_fouls').html(scoreboard_data['home_fouls'])
    $(".home_color").css("background-color",scoreboard_data['home_color'])
    $('.timeval').html(scoreboard_data['current_period'])
  });

