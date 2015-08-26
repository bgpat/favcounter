'use strict';

module.exports = function(proto) {
  var data = Object.create([].slice.call(proto, 0), {
    trim: {get: () => this.length && this[0].temporary ? this.slice(1) : this},
    last: {get: () => this.length ? this.trim[0] : null},
    statistics: {get: () => {
      var now = new Date();
      var base = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
        23, 59, 59, 999).getTime();
      var arr = [];
      this.trim.forEach(d => {
        arr[(base - d.timestamp) / (1000 * 60 * 60 * 24) | 0] = d;
      });
      return arr;
    }},
    toJSON: {value: () => [].slice.call(this, 0)}
  });
  return data;
};
