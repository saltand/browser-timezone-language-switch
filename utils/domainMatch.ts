/**
 * Convert a user-specified glob-like domain pattern to a regex test.
 * Supported patterns:
 *   example.com      — exact match
 *   *.example.com    — any subdomain
 *   *google*         — contains "google"
 *   example*         — starts with "example"
 */
export function matchesDomain(pattern: string, hostname: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const re = new RegExp(`^${escaped}$`, 'i');
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
  // Simple domain (no wildcards) — use requestDomains (auto-matches subdomains)
  if (!pattern.includes('*')) {
    return { requestDomains: [pattern] };
  }

  // *.example.com — matches subdomains; requestDomains handles this
  if (pattern.startsWith('*.') && !pattern.slice(2).includes('*')) {
    return { requestDomains: [pattern.slice(2)] };
  }

  // Complex wildcard — fall back to regexFilter
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return { regexFilter: `^https?://([^/]*\\.)?${regexStr}(/|$)`, isUrlFilterCaseSensitive: false };
}
