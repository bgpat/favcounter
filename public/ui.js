function hsv2rgb(h, s, v){
  var i, f;
  h = [v, v - (f = v * s * ((f = h / 60 % 6) - (i = f ^ 0))),
    h = v - v * s, h, f + h, v];
  var rgb = (h[i] << 16) | (h[(i + 4) % 6] << 8) | h[(i + 2) % 6];
  return'#' + ('000000' + rgb.toString(16)).slice(-6);
}

google.load('visualization', '1', {'packages':['corechart']});

$(function(){
  var dragging = null;

  function offsetTop(e) {
    if (e.offsetParent == null) {
      return e.offsetTop;
    }
    return e.offsetTop + offsetTop(e.offsetParent);
  }

  function createGhost(e) {
    var ghost = dragging.clone().appendTo(dragging.parents('tbody'));
    var left = dragging.position().left;
    $('td', ghost).each(function(i){
      var td = $('td', dragging).eq(i);
      $(this).css({
        position: 'absolute',
        width: td.width(),
        left: td.position().left - left
      });
    });
    ghost
    .css({
      left: left,
      top: e.pageY - dragging.pos,
      width: dragging.width(),
      height: dragging.height()
    })
    .addClass('dragging-ghost')
    .removeClass('draggable-item');
  }

  function beginDrag(e) {
    dragging = $(e.currentTarget);
    dragging.pos = e.offsetY;
    createGhost(e);
    dragging.addClass('dragging');
  }

  function endDrag(e) {
    if (dragging) {
      $('.dragging-ghost').remove();
      var accounts = dragging.siblings().andSelf();
      $.ajax({
        type: 'POST',
        url: '/sort',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({
          accounts: accounts.toArray().map(function(e){
            return $(e).data('id') + '';
          })
        }),
        success: function(data){
          //console.log(data);
        }
      });
      dragging.removeClass('dragging');
      dragging = null;
    }
  }

  function holdDrag(e) {
    if (dragging != null) {
      var ghost = $('.dragging-ghost');
      var tbody = dragging.parents('tbody');
      var prev = dragging.prev('.draggable-item');
      var next = dragging.next('.draggable-item');
      prev = (prev.length || null) && prev.position().top + prev.height() * 0.5;
      next = (next.length || null) && next.position().top - next.height() * 0.5;
      var y = e.pageY - dragging.pos;
      var tbpos = tbody.position().top;
      y = Math.max(y, tbpos);
      y = Math.min(y, tbpos + tbody.height() - dragging.height());
      ghost.css('top', y);
      if (prev != null && y < prev) {
        dragging.prev().before(dragging);
      }
      if (next != null && next < y) {
        dragging.next().after(dragging);
      }
    }
  }


  $('.account.dummy').on('mousedown', function(e){
    var tr = $(this).parent();
    var id = tr.data('id').toString();
    console.log(tr);
    if (confirm(id)) {
      $.ajax({
        type: 'POST',
        url: '/remove',
        data: JSON.stringify({id: id}),
        contentType:'application/json'
      });
      tr.remove();
      e.stopPropagation();
    }
  });


  $('.config-table :input').on('change', function(e){
    $.ajax({
      type: 'POST',
      url: '/config',
      data: JSON.stringify({
        tweet: $('#config-tweet').prop('checked'),
        public: $('#config-public').prop('checked'),
        format: $('#config-format').val()
      }),
      contentType: 'application/json',
      dataType: 'json'
    });
  });

  $('#config-format').on('change', function(e){
    $.ajax({
      type: 'POST',
      url: '/parse',
      data: JSON.stringify({
        format: $(this).val()
      }),
      contentType: 'application/json',
      dataType: 'json',
      success: function(data){
        $('.config-format-preview').text(data.text);
      }
    });
  }).trigger('change');

  $('tbody.draggable td.account-grip')
  .on('mousedown', function(e){
    if (dragging == null) {
      e.currentTarget = e.currentTarget.parentNode;
      e.offsetY = e.pageY - offsetTop(e.currentTarget);
      beginDrag(e);
    }
    e.preventDefault();
  })
  .on('touchstart', function(e){
    e.pageY = e.originalEvent.touches[0].pageY;
    e.currentTarget = e.currentTarget.parentNode;
    e.offsetY = e.pageY - offsetTop(e.currentTarget);
    beginDrag(e);
  });

  $(document)
  .on('mouseup', endDrag)
  .on('mousemove', holdDrag)
  .on('touchend', function(e){
    endDrag(e);
  })
  .on('touchmove', function(e){
    if (dragging != null) {
      e.pageY = e.originalEvent.touches[0].pageY;
      holdDrag(e);
      e.preventDefault();
    }
  });

  $('.remove-account').on('click', function(e){
    if (confirm('本当に削除してもよろしいですか？')) {
      $.ajax({
        type: 'POST',
        url: '/remove',
        data: JSON.stringify({
          id: $(this).data('id')
        }),
        contentType: 'application/json',
        dataType: 'json',
        success: function(data){
          alert('アカウントを削除しました');
          location.href = '/';
        }
      });
    }
  });

  $('#accounts-graph').each(function(){
    var graph = $('.graph', this);
    graph.first().on('load', function(){
      $('.nav-tabs a:first').trigger('click');
    });
    var date = new Date(graph.data('date'));
    var column = [].concat.apply([], graph.data('id').map(function(c){
      return [c, c];
    }));
    var src = graph.data('data');
    $('.nav-tabs a').on('click', function(e){
      e.preventDefault();
      $(this).tab('show');
      var name = $(this).attr('href').slice(1) + '_count';
      var series = [];
      var hue = Math.random() * 360 ^ 0;
      var data = [].concat.apply([], src.map(function(a, i){
        var total = a.map(function(d){ return d[name]; });
        var diff = calcDifference(total);
        series.push({
          color: hsv2rgb((hue + i / src.length * 360) % 360, 0.3, 0xef),
          visibleInLegend: false
        }, {
          color: hsv2rgb((hue + i / src.length * 360) % 360, 0.8, 0xcf),
          type: 'line',
          targetAxisIndex: 1,
        });
          return [total, diff];
        }.bind(this)));
        data = createGraphData(date, column, data);
        graph.trigger('draw', [data, {
          isStacked: true,
          legend: {
            position: 'bottom'
          },
          hAxis: {
            title: 'date',
            titleTextStyle: { color: '#333' }
          },
          vAxis: { minValue: 0 },
          opacity: 0.3,
          seriesType: 'bars',
          series: series
        }]);
      });
    });

    $('#account-graph').each(function(){
      var graph = $('.graph', this);
      graph.first().on('load', function(){
        $('.nav-tabs a:first').trigger('click');
      });
      var date = new Date(graph.data('date'));
      var column = ['total', 'difference'];
      var src = graph.data('data');
      $('.nav-tabs a').on('click', function(e){
        e.preventDefault();
        $(this).tab('show');
        var name = $(this).attr('href').slice(1) + '_count';
        var data = src.map(function(a){ return a[name]; });
        var hue = Math.random() * 360 ^ 0;
        data = createGraphData(date, column, [data, calcDifference(data)]);
        graph.trigger('draw', [data, {
          legend: {
            position: 'bottom'
          },
          hAxis: {
            title: 'date',
            titleTextStyle: { color: '#333' }
          },
          vAxis: { minValue: 0 },
          seriesType: 'bars',
          series: [
            { color: hsv2rgb(hue, 0.3, 0xef) },
            {
              color: hsv2rgb(hue, 0.8, 0xcf),
              targetAxisIndex: 1,
              type: 'line'
            }
          ]
        }]);
      });
    });
  });
