'use strict';

var Date = require('./date').Date;

var parseFormat = function(format, data) {
  return format.replace(/\{((?:\\.|[^\\}])+)\}/g, function(a, b){
    var m = b.match(/^(?:(id|tag|url)|(?:(now|prev)\.)?(fav|tweet|follow|follower|date\(((?:\\.|[^\\)])+)\)))$/);
    if (m) {
      if (m[1] != null) {
        return data[m[1]];
      }
      if (m[2] == null) {
        var diff = data.now[m[3]] - data.prev[m[3]];
        if (diff > 0) {
          diff = '+' + diff;
        }
        return diff;
      } else if (m[4] == null) {
        return data[m[2]][m[3]];
      } else {
        return new Date(data[m[2]].timestamp).toString(m[4]);
      }
    }
    return a;
  }).replace(/\\(\s|\S)/g, '$1').slice(0, 140);
}

if (typeof module === 'object') {
  module.exports = parseFormat;
}
