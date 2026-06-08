/**
 * Spoofs timezone and navigator language fields in the page context (MAIN world).
 * Keep this self-contained: chrome.scripting.executeScript serializes only this
 * function body, not module-level helpers.
 */
export function installPageSpoof(timezone: string, language: string) {
  'use strict';

  const TZ = timezone;
  const langParts = language.split(',').map((s) => s.trim().split(';')[0].trim());
  const primaryLang = langParts[0] || 'en-US';
  const filteredLanguages = langParts.filter(Boolean);
  const languages = filteredLanguages.length > 0 ? filteredLanguages : [primaryLang];

  function defineNavigatorGetter<T>(property: 'language' | 'languages', getter: () => T) {
    const descriptor = {
      get: getter,
      configurable: true,
    };

    try {
      Object.defineProperty(navigator, property, descriptor);
      return;
    } catch {
      // Some browsers expose navigator fields on the prototype instead.
    }

    const navigatorPrototype = Object.getPrototypeOf(navigator);
    if (navigatorPrototype) {
      Object.defineProperty(navigatorPrototype, property, descriptor);
    }
  }

  const OrigDTF = Intl.DateTimeFormat;

  function getOffset(date?: Date) {
    const d = date || new Date();
    const utcStr = new OrigDTF('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
    const tzStr = new OrigDTF('en-US', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);

    function parse(value: string) {
      const parts = value.match(/(\d+)/g);
      if (!parts) {
        return new Date(NaN);
      }

      return new Date(Date.UTC(
        Number(parts[2]),
        Number(parts[0]) - 1,
        Number(parts[1]),
        Number(parts[3]) % 24,
        Number(parts[4]),
        Number(parts[5])
      ));
    }

    return (parse(utcStr).getTime() - parse(tzStr).getTime()) / 60000;
  }

  function SpoofedDTF(this: unknown, locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    if (!(this instanceof SpoofedDTF)) {
      return new (SpoofedDTF as typeof Intl.DateTimeFormat)(locales, options);
    }

    const opts = Object.assign({}, options);
    if (!opts.timeZone) {
      opts.timeZone = TZ;
    }

    return new OrigDTF(locales, opts);
  }

  SpoofedDTF.prototype = OrigDTF.prototype;
  SpoofedDTF.supportedLocalesOf = OrigDTF.supportedLocalesOf.bind(OrigDTF);
  Object.defineProperty(SpoofedDTF, 'name', { value: 'DateTimeFormat' });
  (Intl as unknown as { DateTimeFormat: typeof Intl.DateTimeFormat }).DateTimeFormat =
    SpoofedDTF as typeof Intl.DateTimeFormat;

  const origToString = Date.prototype.toString;
  const origToTimeString = Date.prototype.toTimeString;
  const origToDateString = Date.prototype.toDateString;

  Date.prototype.getTimezoneOffset = function() {
    return getOffset(this);
  };

  Date.prototype.toString = function() {
    try {
      const datePart = new OrigDTF('en-US', {
        timeZone: TZ,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(this);
      const tzName = new OrigDTF('en-US', {
        timeZone: TZ,
        timeZoneName: 'long',
      }).formatToParts(this).find((part) => part.type === 'timeZoneName');
      const offset = -getOffset(this);
      const sign = offset >= 0 ? '+' : '-';
      const absOff = Math.abs(offset);
      const hh = String(Math.floor(absOff / 60)).padStart(2, '0');
      const mm = String(absOff % 60).padStart(2, '0');

      return datePart + ' GMT' + sign + hh + mm + (tzName ? ' (' + tzName.value + ')' : '');
    } catch {
      return origToString.call(this);
    }
  };

  Date.prototype.toTimeString = function() {
    try {
      const timePart = new OrigDTF('en-US', {
        timeZone: TZ,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(this);
      const offset = -getOffset(this);
      const sign = offset >= 0 ? '+' : '-';
      const absOff = Math.abs(offset);
      const hh = String(Math.floor(absOff / 60)).padStart(2, '0');
      const mm = String(absOff % 60).padStart(2, '0');

      return timePart + ' GMT' + sign + hh + mm;
    } catch {
      return origToTimeString.call(this);
    }
  };

  Date.prototype.toDateString = function() {
    try {
      return new OrigDTF('en-US', {
        timeZone: TZ,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).format(this);
    } catch {
      return origToDateString.call(this);
    }
  };

  defineNavigatorGetter('language', function() { return primaryLang; });
  defineNavigatorGetter('languages', function() { return Object.freeze(languages.slice()); });
}

/**
 * Build a self-contained JS script string for MV2 fallback injection.
 */
export function buildSpoofScript(timezone: string, language: string): string {
  return `(${installPageSpoof.toString()})(${JSON.stringify(timezone)}, ${JSON.stringify(language)});`;
}
