/**
 * Convert a user-specified glob-like domain pattern to a hostname regex source
 * (without anchors). Supported patterns:
 *   example.com      — exact match
 *   *.example.com    — example.com itself and any subdomain
 *   *google*         — contains "google"
 *   example*         — starts with "example"
 *
 * The same source is used for page-side matching and for DNR regexFilter, so
 * request headers and page APIs always agree on which hosts a rule covers.
 */
export function patternToHostRegexSource(pattern: string): string {
  const normalized = pattern.trim().toLowerCase();
  const escape = (value: string) => value
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/?#@]*');

  if (normalized.startsWith('*.') && !normalized.slice(2).includes('*')) {
    return `(?:[^/?#@]*\\.)?${escape(normalized.slice(2))}`;
  }

  return escape(normalized);
}

export function matchesDomain(pattern: string, hostname: string): boolean {
  const re = new RegExp(`^${patternToHostRegexSource(pattern)}$`, 'i');
  return re.test(hostname);
}

const COMMON_SECOND_LEVEL_SUFFIXES = new Set([
  'ac',
  'co',
  'com',
  'edu',
  'gov',
  'mil',
  'net',
  'org',
]);

function isIpHostname(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
}

/**
 * Best-effort suggestion for a broad rule that still matches the current host.
 */
export function suggestDomainPattern(hostname: string): string {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized || normalized === 'localhost' || isIpHostname(normalized)) {
    return normalized;
  }

  const labels = normalized.split('.').filter(Boolean);
  if (labels.length <= 2) {
    return normalized;
  }

  const topLevel = labels[labels.length - 1];
  const secondLevel = labels[labels.length - 2];
  const useThreeLabelBase =
    labels.length >= 3 &&
    topLevel.length === 2 &&
    COMMON_SECOND_LEVEL_SUFFIXES.has(secondLevel);

  const baseSize = useThreeLabelBase ? 3 : 2;
  const base = labels.slice(-baseSize).join('.');

  return `*.${base}`;
}

/**
 * Convert a domain pattern to a declarativeNetRequest rule condition.
 */
export function patternToDnrCondition(pattern: string): chrome.declarativeNetRequest.RuleCondition {
  return {
    regexFilter: `^[a-z][a-z0-9+.-]*://(?:[^/?#@]*@)?${patternToHostRegexSource(pattern)}(?::\\d+)?(?:[/?#]|$)`,
    isUrlFilterCaseSensitive: false,
  };
}
