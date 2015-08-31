'use strict';

var parseFormat = function(format, data) {
  return format.replace(/\{((?:\\.|[^\\}])+)\}/g, function(a, b){
    var m = b.match(/^(?:(id|tag|url)|(?:(now|prev)\.)?(fav|tweet|follow|follower|date\(((?:\\.|[^\\)])+)\)))$/);
    if (m) {
      if (m[1] != null) {
        return data[m[1]];
      }
      if (m[2] == null) {
        return data.now[m[3]] - data.prev[m[3]];
      } else if (m[4] == null) {
        return data[m[2]][m[3]];
      } else {
        var d = new Date(data[m[2]].timestamp);
        return m[4].replace(/([YMDhms])\1{0,3}/g, function(f, c){
          var fn = {
            Y: function(){ return d.getFullYear(); },
            M: function(){ return d.getMonth() + 1; },
            D: function(){ return d.getDate(); },
            h: function(){ return d.getHours(); },
            m: function(){ return d.getMinutes(); },
            s: function(){ return d.getSeconds(); }
          };
          var s = fn[c]() + '';
          var z = new Array(Math.max(0, f.length - s.length) + 1).join(0);
          return z + s;
        });
      }
    }
    return a;
  }).replace(/\\(\s|\S)/g, '$1').slice(0, 140);
}

if (typeof module === 'object') {
  module.exports = parseFormat;
}
