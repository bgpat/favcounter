function createGraphData(base, column, data) {
  var aday = 24 * 60 * 60 * 1000;
  var res = [];
  var len = data.reduce(function(max, now){
    return max < now.length ? now.length : max;
  }, 0);
  for (var i = 0; i < len; i++) {
    res[i] = data.map(function(a){
      var v = a[i];
      if (v == null) {
        v = NaN;
      }
      return v;
    });
    res[i].unshift(new Date(base - i * aday));
  }
  res.unshift(['date']);
  res[0] = res[0].concat(column);
  return res;
}

function calcDifference(data) {
  if (data.length < 2) {
    return data.length ? [0] : [];
  }
  var res = [];
  var prev = data[0];
  for (var i = 1; i < data.length; i++) {
    res.push(prev - data[i]);
    prev = data[i];
  }
  return res;
}

$(function(){
  google.setOnLoadCallback(function(){
    var graph = $('.graph').each(function(){
      $(this).data('chart', new google.visualization.ComboChart(this));
    }).on('draw', function(e, data, option){
      data = google.visualization.arrayToDataTable(data);
      $(this).data('chart').draw(data, option);
    }).trigger('load');
  });
});
