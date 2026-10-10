import { LANGUAGES, TIMEZONES } from './types';

/** First language tag of an Accept-Language value, e.g. "ja" for "ja,en-US;q=0.9". */
export function getPrimaryLanguageTag(value: string): string {
  return value.split(',')[0]?.split(';')[0]?.trim() || value;
}

/** Short code for the toolbar badge, e.g. "JA", "ZH". */
export function getBadgeText(language: string): string {
  return getPrimaryLanguageTag(language).split('-')[0].slice(0, 3).toUpperCase();
}

export function getSuggestedTimezone(language: string): string | undefined {
  const exact = LANGUAGES.find((item) => item.value === language);
  if (exact) {
    return exact.timezone;
  }

  // Custom values: match the preset with the same primary tag ("ja-JP" → "ja").
  const tag = getPrimaryLanguageTag(language).toLowerCase();
  const base = tag.split('-')[0];
  return (
    LANGUAGES.find((item) => getPrimaryLanguageTag(item.value).toLowerCase() === tag)
    ?? LANGUAGES.find((item) => getPrimaryLanguageTag(item.value).toLowerCase().split('-')[0] === base)
  )?.timezone;
}

function isValidLanguageTag(tag: string): boolean {
  try {
    return Intl.getCanonicalLocales(tag).length === 1;
  } catch {
    return false;
  }
}

/**
 * Turn free text into an Accept-Language value, or null if invalid.
 * "pt-PT" becomes "pt-PT,pt;q=0.9"; full Accept-Language strings are kept.
 */
export function parseLanguageInput(text: string): string | null {
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  for (const part of parts) {
    const [tag, ...params] = part.split(';').map((item) => item.trim());
    if (!isValidLanguageTag(tag)) {
      return null;
    }
    if (params.some((param) => !/^q=(0(\.\d{1,3})?|1(\.0{1,3})?)$/.test(param))) {
      return null;
    }
  }

  if (parts.length === 1 && !parts[0].includes(';')) {
    const [tag] = Intl.getCanonicalLocales(parts[0]);
    const base = tag.split('-')[0];
    return base !== tag ? `${tag},${base};q=0.9` : tag;
  }

  return parts.join(',');
}

let languageNames: Intl.DisplayNames | null | undefined;

/** English name for a language tag not in the preset list. */
export function describeLanguageTag(tag: string): string {
  if (languageNames === undefined) {
    try {
      languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
      languageNames = null;
    }
  }

  try {
    return languageNames?.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

let allTimezones: string[] | undefined;

/** Every IANA zone the browser knows, falling back to the preset list. */
export function getAllTimezones(): string[] {
  if (!allTimezones) {
    const presets = TIMEZONES.flatMap((group) => group.zones.map((zone) => zone.value));
    let supported: string[] = [];
    try {
      supported = Intl.supportedValuesOf('timeZone');
    } catch {
      supported = [];
    }
    allTimezones = [...new Set([...presets, ...supported])];
  }

  return allTimezones;
}

/** Canonical IANA zone for free text (case-insensitive), or null if invalid. */
export function parseTimezoneInput(text: string): string | null {
  const trimmed = text.trim().replace(/\s+/g, '_');
  if (!trimmed) {
    return null;
  }

  const known = getAllTimezones().find((zone) => zone.toLowerCase() === trimmed.toLowerCase());
  if (known) {
    return known;
  }

  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}
