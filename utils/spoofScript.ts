import type { CompiledRule } from './types';

/**
 * Pick the effective rule for the current frame. The top-level site wins so
 * that every frame on a page agrees on one locale; the frame's own host is the
 * fallback. Keep this self-contained: it is serialized into injected code.
 */
export function pickRule(rules: CompiledRule[]): CompiledRule | null {
  function getTopHostname(): string {
    try {
      if (window.top && window.top !== window) {
        return window.top.location.hostname;
      }
    } catch {
      // Cross-origin top; fall through to ancestorOrigins.
    }

    const ancestors = location.ancestorOrigins;
    if (ancestors && ancestors.length > 0) {
      try {
        return new URL(ancestors[ancestors.length - 1]).hostname;
      } catch {
        // Opaque origin such as "null".
      }
    }

    return location.hostname;
  }

  function find(hostname: string): CompiledRule | null {
    if (!hostname) {
      return null;
    }

    for (const rule of rules) {
      try {
        if (new RegExp('^' + rule.hostRegex + '$', 'i').test(hostname)) {
          return rule;
        }
      } catch {
        // Ignore malformed patterns.
      }
    }

    return null;
  }

  return find(getTopHostname()) || find(location.hostname);
}

/**
 * Spoofs timezone and language related APIs in the page context (MAIN world),
 * including same-origin child frames the page reaches through
 * iframe.contentWindow / contentDocument (e.g. a fresh about:blank iframe).
 * Keep this self-contained: chrome.scripting.executeScript serializes only this
 * function body, not module-level helpers.
 */
export function installPageSpoof(timezone: string, language: string) {
  'use strict';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Loose = any;

  const MARK = Symbol.for('browser-timezone-language-switch');
  const TZ = timezone;
  const langParts = language.split(',').map((s) => s.trim().split(';')[0].trim()).filter(Boolean);

  function isValidLocale(value: string) {
    try {
      return Intl.getCanonicalLocales(value).length > 0;
    } catch {
      return false;
    }
  }

  const validLangs = langParts.filter(isValidLocale);
  const primaryLang = validLangs[0] || langParts[0] || 'en-US';
  const languages = langParts.length > 0 ? langParts : [primaryLang];
  // Locale used as the default for Intl / toLocale* when the page passes none.
  const defaultLocale = validLangs[0];

  const NativeDTF = Intl.DateTimeFormat;
  let tzValid = true;
  try {
    new NativeDTF('en-US', { timeZone: TZ });
  } catch {
    tzValid = false;
  }

  function getOffset(date?: Date) {
    const d = date || new Date();
    const utcStr = new NativeDTF('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
    const tzStr = new NativeDTF('en-US', {
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

  function formatOffset(date: Date) {
    const offset = -getOffset(date);
    const sign = offset >= 0 ? '+' : '-';
    const absOff = Math.abs(offset);
    const hh = String(Math.floor(absOff / 60)).padStart(2, '0');
    const mm = String(absOff % 60).padStart(2, '0');
    return ' GMT' + sign + hh + mm;
  }

  function withLocale(locales: unknown) {
    if (!defaultLocale) {
      return locales;
    }

    if (locales === undefined || (Array.isArray(locales) && locales.length === 0)) {
      return defaultLocale;
    }

    return locales;
  }

  function withTimeZone(options: unknown) {
    if (!tzValid) {
      return options;
    }

    const opts = Object.assign({}, options) as Intl.DateTimeFormatOptions;
    if (opts.timeZone === undefined) {
      opts.timeZone = TZ;
    }
    return opts;
  }

  function defineGetter(target: object, property: string, getter: () => unknown) {
    const existing = Object.getOwnPropertyDescriptor(target, property);
    Object.defineProperty(target, property, {
      get: getter,
      configurable: true,
      enumerable: existing ? existing.enumerable : true,
    });
  }

  function patchNavigator(win: Loose) {
    const frozenLanguages = Object.freeze(languages.slice());
    const getLanguage = function() { return primaryLang; };
    const getLanguages = function() { return frozenLanguages; };

    const proto = win.Navigator && win.Navigator.prototype;
    try {
      if (!proto) {
        throw new Error('no Navigator.prototype');
      }
      defineGetter(proto, 'language', getLanguage);
      defineGetter(proto, 'languages', getLanguages);
    } catch {
      defineGetter(win.navigator, 'language', getLanguage);
      defineGetter(win.navigator, 'languages', getLanguages);
    }
  }

  function wrapIntlConstructor(intl: Loose, name: string, mapOptions?: (options: unknown) => unknown) {
    const Orig = intl[name];
    if (typeof Orig !== 'function') {
      return;
    }

    const Wrapped = function(this: unknown, locales?: unknown, options?: unknown) {
      const args = [withLocale(locales), mapOptions ? mapOptions(options) : options];
      return new.target
        ? Reflect.construct(Orig, args, new.target)
        : Orig(...args);
    } as Loose;

    Wrapped.prototype = Orig.prototype;
    Object.defineProperty(Wrapped, 'name', { value: name });
    Object.defineProperty(Wrapped, 'length', { value: 0 });
    for (const key of Object.getOwnPropertyNames(Orig)) {
      if (key !== 'prototype' && key !== 'name' && key !== 'length') {
        const descriptor = Object.getOwnPropertyDescriptor(Orig, key);
        if (descriptor) {
          Object.defineProperty(Wrapped, key, descriptor);
        }
      }
    }
    try {
      Object.defineProperty(Orig.prototype, 'constructor', {
        value: Wrapped,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch {
      // Non-configurable in some engines; harmless.
    }

    intl[name] = Wrapped;
  }

  function patchIntl(win: Loose) {
    const intl = win.Intl;
    if (!intl) {
      return;
    }

    wrapIntlConstructor(intl, 'DateTimeFormat', withTimeZone);
    if (!defaultLocale) {
      return;
    }

    for (const name of [
      'NumberFormat',
      'Collator',
      'PluralRules',
      'RelativeTimeFormat',
      'ListFormat',
      'DisplayNames',
      'Segmenter',
      'DurationFormat',
    ]) {
      wrapIntlConstructor(intl, name);
    }
  }

  function patchMethod(proto: Loose, name: string, make: (orig: Loose) => Loose) {
    if (!proto || typeof proto[name] !== 'function') {
      return;
    }

    const orig = proto[name];
    const replacement = make(orig);
    Object.defineProperty(replacement, 'name', { value: name });
    Object.defineProperty(replacement, 'length', { value: orig.length });
    proto[name] = replacement;
  }

  function patchLocaleMethods(win: Loose) {
    const dateProto = win.Date && win.Date.prototype;
    for (const name of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString']) {
      patchMethod(dateProto, name, (orig) => function(this: Date, locales?: unknown, options?: unknown) {
        return orig.call(this, withLocale(locales), withTimeZone(options));
      });
    }

    if (!defaultLocale) {
      return;
    }

    for (const ctor of [win.Number, win.BigInt]) {
      patchMethod(ctor && ctor.prototype, 'toLocaleString', (orig) => function(this: unknown, locales?: unknown, options?: unknown) {
        return orig.call(this, withLocale(locales), options);
      });
    }

    const stringProto = win.String && win.String.prototype;
    patchMethod(stringProto, 'localeCompare', (orig) => function(this: string, that: string, locales?: unknown, options?: unknown) {
      return orig.call(this, that, withLocale(locales), options);
    });
    for (const name of ['toLocaleUpperCase', 'toLocaleLowerCase']) {
      patchMethod(stringProto, name, (orig) => function(this: string, locales?: unknown) {
        return orig.call(this, withLocale(locales));
      });
    }
  }

  function patchDate(win: Loose) {
    if (!tzValid) {
      return;
    }

    const proto = win.Date.prototype;
    const origToString = proto.toString;
    const origToTimeString = proto.toTimeString;
    const origToDateString = proto.toDateString;

    proto.getTimezoneOffset = function(this: Date) {
      return getOffset(this);
    };

    proto.toString = function(this: Date) {
      try {
        const datePart = new NativeDTF('en-US', {
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
        const tzName = new NativeDTF('en-US', {
          timeZone: TZ,
          timeZoneName: 'long',
        }).formatToParts(this).find((part) => part.type === 'timeZoneName');

        return datePart + formatOffset(this) + (tzName ? ' (' + tzName.value + ')' : '');
      } catch {
        return origToString.call(this);
      }
    };

    proto.toTimeString = function(this: Date) {
      try {
        const timePart = new NativeDTF('en-US', {
          timeZone: TZ,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(this);

        return timePart + formatOffset(this);
      } catch {
        return origToTimeString.call(this);
      }
    };

    proto.toDateString = function(this: Date) {
      try {
        return new NativeDTF('en-US', {
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
  }

  /**
   * A page can create an about:blank iframe and read the untouched navigator /
   * Intl from it before any content script runs there. Patch same-origin child
   * windows the moment the page gets hold of them.
   */
  function patchFrameAccess(win: Loose) {
    for (const ctorName of ['HTMLIFrameElement', 'HTMLFrameElement']) {
      const proto = win[ctorName] && win[ctorName].prototype;
      if (!proto) {
        continue;
      }

      for (const prop of ['contentWindow', 'contentDocument']) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
        if (!descriptor || !descriptor.get) {
          continue;
        }

        const origGet = descriptor.get;
        Object.defineProperty(proto, prop, {
          ...descriptor,
          get: function(this: unknown) {
            const value = origGet.call(this);
            if (value) {
              patchWindow(prop === 'contentWindow' ? value : value.defaultView);
            }
            return value;
          },
        });
      }
    }
  }

  function patchWindow(win: Loose) {
    try {
      // Throws for cross-origin windows; those get their own content script.
      if (!win || win[MARK]) {
        return;
      }
      Object.defineProperty(win, MARK, { value: true });
    } catch {
      return;
    }

    for (const patch of [patchNavigator, patchIntl, patchLocaleMethods, patchDate, patchFrameAccess]) {
      try {
        patch(win);
      } catch {
        // Keep going: one failing patch must not leave the rest unapplied.
      }
    }
  }

  patchWindow(window);
}

/**
 * Code that runs in the MAIN world at document_start: picks the rule for the
 * current frame and installs the spoof synchronously. Used for user scripts.
 */
export function buildMainWorldScript(rules: CompiledRule[]): string {
  return `(function () {
  var rule = (${pickRule.toString()})(${JSON.stringify(rules)});
  if (rule) {
    (${installPageSpoof.toString()})(rule.timezone, rule.language);
  }
})();`;
}

/**
 * Code that runs in an isolated content script world at document_start
 * (Firefox MV2 registered content script): picks the rule and synchronously
 * injects the spoof into the page through an inline script element.
 */
export function buildIsolatedWorldScript(rules: CompiledRule[]): string {
  return `(function () {
  var rule = (${pickRule.toString()})(${JSON.stringify(rules)});
  if (!rule) {
    return;
  }
  var script = document.createElement('script');
  script.textContent = '(' + ${JSON.stringify(installPageSpoof.toString())} + ')('
    + JSON.stringify(rule.timezone) + ', ' + JSON.stringify(rule.language) + ');';
  (document.documentElement || document).prepend(script);
  script.remove();
})();`;
}

/**
 * Build a self-contained JS script string for MV2 fallback injection.
 */
export function buildSpoofScript(timezone: string, language: string): string {
  return `(${installPageSpoof.toString()})(${JSON.stringify(timezone)}, ${JSON.stringify(language)});`;
}
