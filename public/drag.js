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
      $(this).css({
        position: 'absolute',
        left: $('td', dragging).eq(i).position().left - left
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
        url: '/update',
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
      dragging.siblings().andSelf().each(function(i, e){
        $('td:eq(0)', e).text(i + 1);
      });
      $('td:eq(0)', ghost).text($('td:eq(0)', dragging).text());
    }
  }

  $('tbody.draggable > tr')
  .on('mousedown', function(e){
    if (dragging == null) {
      beginDrag(e);
    }
    e.preventDefault();
  })
  .on('touchstart', function(e){
    e.pageY = e.originalEvent.touches[0].pageY;
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
});
