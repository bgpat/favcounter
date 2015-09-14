'use strict';

const aday = 24 * 60 * 60 * 1000;

var _Date = function(date) {
  if (date == null) {
    this._date = new Date();
  } else {
    this._date = new Date(date);
  }
};

Object.defineProperties(_Date, {
  aday: { value: aday },
  now: { get: function() { return new _Date(); } },
  today: { get: function() {
    var res = new _Date();
    res._date.setHours(0);
    res._date.setMinutes(0);
    res._date.setSeconds(0);
    res._date.setMilliseconds(0);
    return res;
  }}
});

_Date.prototype = Object.create({}, {
  time: {
    enumerable: true,
    get: function() { return this._date.getTime(); },
    set: function(value) { return this._date.setTime(value); }
  },
  year: {
    enumerable: true,
    get: function() { return this._date.getFullYear(); },
    set: function(value) { return this._date.setFullYear(value); }
  },
  month: {
    enumerable: true,
    get: function() { return this._date.getMonth() + 1; },
    set: function(value) { return this._date.setMonth(value - 1); }
  },
  date: {
    enumerable: true,
    get: function() { return this._date.getDate(); },
    set: function(value) { return this._date.setDate(value); }
  },
  hour: {
    enumerable: true,
    get: function() { return this._date.getHours(); },
    set: function(value) { return this._date.setHours(value); }
  },
  minute: {
    enumerable: true,
    get: function() { return this._date.getMinutes(); },
    set: function(value) { return this._date.setMinutes(value); }
  },
  second: {
    enumerable: true,
    get: function() { return this._date.getSeconds(); },
    set: function(value) { return this._date.setSeconds(value); }
  },
  toString: {
    value: function(format) {
      if (format == null) {
        return this._date.toString();
      }
      var regexp = /\\(.)|(Y{2,4})|(([MDhms])\4?)/g;
      return format.replace(regexp, function(_, escape, year, count, char){
        if (escape) {
          return escape;
        }
        if (year) {
          return this.year.toString().slice(-year.length);
        }
        var res = this[({
          M: 'month',
          D: 'date',
          h: 'hour',
          m: 'minute',
          s: 'second'
        })[char]];
        if (count !== char && res < 10) {
          res = '0' + res;
        }
        return res;
      }.bind(this));
    }
  },
  nextDay: {
    value: function(n) {
      if (n == null) {
        n = 1;
      }
      return new _Date(this.time + aday * n);
    }
  },
  prevDay: {
    value: function(n) {
      if (n == null) {
        n = 1;
      }
      return this.nextDay(-n);
    }
  }
});

module.exports = {Date: _Date};
