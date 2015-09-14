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

  var graph = $('#accounts-graph .graph');
  var chart;
  var diffCheckbox = $('#accounts-graph .graph-diff').on('click', function(){
    $('#accounts-graph > .nav-tabs > li.active > a').click();
  });
  $('#accounts-graph > .nav-tabs a').on('click', function(e){
    e.preventDefault();
    $(this).tab('show');
    var len = 0;
    var id = graph.data('id');
    var adata = graph.data('data').map(function(a){
      if (len < a.length) {
        len = a.length;
      }
      return a.map(function(d){
        return d ? d[$(this).attr('href').slice(1) + '_count'] : null;
      }.bind(this))
    }.bind(this));
    var base = new Date(graph.data('date'));
    if (diffCheckbox.prop('checked')) {
      adata = adata.map(function(a){
        var prev = a.shift();
        return a.map(function(n){
          var res = prev - n;
          prev = n;
          return res;
        });
      });
      base -= 24 * 60 * 60 * 1000;
    }
    var data = [];
    for (var i = 0; i < len; i++) {
      data[i] = adata.map(function(a){ return a[i]; });
      data[i].unshift(new Date(base - i * 24 * 60 * 60 * 1000));
    }
    data.unshift(['date']);
    data[0].push.apply(data[0], id);
    var options = {
      legend: { position: 'bottom' },
      hAxis: {
        title: 'date',
        titleTextStyle: { color: '#333' }
      }
    };
    chart.draw(google.visualization.arrayToDataTable(data), options);
  });
  google.setOnLoadCallback(function(){
    chart = new google.visualization.LineChart(graph.get(0));
    graph.data('chart', chart);
    $('#accounts-graph > .nav-tabs li.active a').click();
  });
});
