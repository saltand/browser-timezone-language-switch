/**
 * Build a self-contained JS script string that spoofs timezone and language
 * when injected into the page context (MAIN world).
 */
export function buildSpoofScript(timezone: string, language: string): string {
  // Parse Accept-Language string into primary language and languages array
  const langParts = language.split(',').map((s) => s.trim().split(';')[0].trim());
  const primaryLang = langParts[0] || 'en-US';
  const languagesJson = JSON.stringify(langParts);

  return `(function() {
  'use strict';
  var TZ = ${JSON.stringify(timezone)};
  var PRIMARY_LANG = ${JSON.stringify(primaryLang)};
  var LANGUAGES = ${languagesJson};

  // --- Timezone spoofing ---

  var OrigDTF = Intl.DateTimeFormat;

  // Helper: get timezone offset in minutes for a given date
  function getOffset(date) {
    var d = date || new Date();
    var utcStr = new OrigDTF('en-US', {
      timeZone: 'UTC',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(d);
    var tzStr = new OrigDTF('en-US', {
      timeZone: TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(d);
    function parse(s) {
      var p = s.match(/(\\d+)/g);
      return new Date(Date.UTC(+p[2], +p[0]-1, +p[1], +p[3]%24, +p[4], +p[5]));
    }
    return (parse(utcStr) - parse(tzStr)) / 60000;
  }

  // Override Intl.DateTimeFormat
  function SpoofedDTF(locales, options) {
    if (!(this instanceof SpoofedDTF)) {
      return new SpoofedDTF(locales, options);
    }
    var opts = Object.assign({}, options);
    if (!opts.timeZone) opts.timeZone = TZ;
    return new OrigDTF(locales, opts);
  }
  SpoofedDTF.prototype = OrigDTF.prototype;
  SpoofedDTF.supportedLocalesOf = OrigDTF.supportedLocalesOf.bind(OrigDTF);
  Object.defineProperty(SpoofedDTF, 'name', { value: 'DateTimeFormat' });
  Intl.DateTimeFormat = SpoofedDTF;

  // Override Date.prototype.getTimezoneOffset
  var origGetTZO = Date.prototype.getTimezoneOffset;
  Date.prototype.getTimezoneOffset = function() {
    return getOffset(this);
  };

  // Override Date.prototype.toString and toTimeString
  var origToString = Date.prototype.toString;
  Date.prototype.toString = function() {
    try {
      var d = this;
      var datePart = new OrigDTF('en-US', {
        timeZone: TZ, weekday: 'short', year: 'numeric', month: 'short',
        day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      }).format(d);
      var tzName = new OrigDTF('en-US', {
        timeZone: TZ, timeZoneName: 'long'
      }).formatToParts(d).find(function(p) { return p.type === 'timeZoneName'; });
      var offset = -getOffset(d);
      var sign = offset >= 0 ? '+' : '-';
      var absOff = Math.abs(offset);
      var hh = String(Math.floor(absOff / 60)).padStart(2, '0');
      var mm = String(absOff % 60).padStart(2, '0');
      return datePart + ' GMT' + sign + hh + mm + (tzName ? ' (' + tzName.value + ')' : '');
    } catch(e) {
      return origToString.call(this);
    }
  };

  Date.prototype.toTimeString = function() {
    try {
      var d = this;
      var timePart = new OrigDTF('en-US', {
        timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      }).format(d);
      var offset = -getOffset(d);
      var sign = offset >= 0 ? '+' : '-';
      var absOff = Math.abs(offset);
      var hh = String(Math.floor(absOff / 60)).padStart(2, '0');
      var mm = String(absOff % 60).padStart(2, '0');
      return timePart + ' GMT' + sign + hh + mm;
    } catch(e) {
      return origToString.call(this);
    }
  };

  Date.prototype.toDateString = function() {
    try {
      return new OrigDTF('en-US', {
        timeZone: TZ, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit'
      }).format(this);
    } catch(e) {
      return origToString.call(this);
    }
  };

  // --- Language spoofing ---
  Object.defineProperty(navigator, 'language', {
    get: function() { return PRIMARY_LANG; },
    configurable: true
  });
  Object.defineProperty(navigator, 'languages', {
    get: function() { return Object.freeze(LANGUAGES.slice()); },
    configurable: true
  });
})();`;
}
