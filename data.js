'use strict';

var Date = require('./date').Date;

module.exports = function(proto) {
  var data = Object.create([].slice.call(proto, 0), {
    recent: {get: () => this[0]},
    trim: {get: () => this.length && this[0].temporary ? this.slice(1) : this},
    last: {get: () => this.length ? this.trim[0] : null},
    statistics: {get: () => {
      var base = Date.today.nextDay().time - 1;
      var arr = [];
      this.trim.forEach(d => {
        arr[(base - d.timestamp) / Date.aday | 0] = d;
      });
      arr.reduceRight((c, d, i) => {
        if (d == null) {
          return arr[i] = c;
        }
        return d;
      }, null);
      arr.push({});
      return arr;
    }},
    toJSON: {value: () => [].slice.call(this, 0)}
  });
  return data;
};
