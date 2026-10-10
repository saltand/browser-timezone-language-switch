import { matchesDomain, patternToHostRegexSource } from './domainMatch';
import type { CompiledRule, Rule } from './types';

function getValidUpdatedAt(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

export function getDomainPatternKey(domainPattern: string): string {
  return domainPattern.trim().toLowerCase();
}

export function normalizeRules(rules: Rule[]): { rules: Rule[]; changed: boolean } {
  const fallbackStart = Date.now() - rules.length;
  let changed = false;

  const normalizedRules = rules.map((rule, index) => {
    const normalizedUpdatedAt = getValidUpdatedAt(rule.updatedAt, fallbackStart + index);
    if (normalizedUpdatedAt !== rule.updatedAt) {
      changed = true;
      return {
        ...rule,
        updatedAt: normalizedUpdatedAt,
      };
    }

    return rule;
  });

  return {
    rules: normalizedRules,
    changed,
  };
}

export function sortRulesByPriority(rules: Rule[]): Rule[] {
  return [...rules].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function getEffectiveRule(rules: Rule[], hostname: string): Rule | undefined {
  return sortRulesByPriority(
    rules.filter((rule) => rule.enabled && matchesDomain(rule.domainPattern, hostname))
  )[0];
}

export function sortRulesForDisplay(rules: Rule[], hostname: string | null): Rule[] {
  return rules
    .map((rule, index) => ({
      rule,
      index,
      matchesCurrentHostname: hostname ? matchesDomain(rule.domainPattern, hostname) : false,
    }))
    .sort((left, right) => {
      if (left.matchesCurrentHostname !== right.matchesCurrentHostname) {
        return left.matchesCurrentHostname ? -1 : 1;
      }

      if (getDomainPatternKey(left.rule.domainPattern) === getDomainPatternKey(right.rule.domainPattern)) {
        return right.rule.updatedAt - left.rule.updatedAt;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.rule);
}

export function getDuplicateRuleMeta(rules: Rule[]): {
  duplicateCounts: Map<string, number>;
  effectiveRuleIdByDomain: Map<string, string>;
} {
  const duplicateCounts = new Map<string, number>();
  const effectiveRuleIdByDomain = new Map<string, string>();
  const effectiveUpdatedAtByDomain = new Map<string, number>();

  for (const rule of rules) {
    const domainKey = getDomainPatternKey(rule.domainPattern);
    duplicateCounts.set(domainKey, (duplicateCounts.get(domainKey) ?? 0) + 1);

    if (!rule.enabled) {
      continue;
    }

    const currentEffectiveUpdatedAt = effectiveUpdatedAtByDomain.get(domainKey) ?? Number.NEGATIVE_INFINITY;
    if (rule.updatedAt >= currentEffectiveUpdatedAt) {
      effectiveUpdatedAtByDomain.set(domainKey, rule.updatedAt);
      effectiveRuleIdByDomain.set(domainKey, rule.id);
    }
  }

  return {
    duplicateCounts,
    effectiveRuleIdByDomain,
  };
}

/**
 * Enabled rules in priority order, with domain patterns pre-compiled to regex
 * sources so they can be shipped into page / user script code as plain JSON.
 */
export function compileRules(rules: Rule[]): CompiledRule[] {
  return sortRulesByPriority(rules.filter((rule) => rule.enabled)).map((rule) => ({
    hostRegex: patternToHostRegexSource(rule.domainPattern),
    language: rule.language,
    timezone: rule.timezone,
  }));
}

/**
 * Pick the rule for a frame: the top-level site wins so the whole page agrees
 * on one locale; fall back to the frame's own host when the top has no rule.
 */
export function getEffectiveRuleForFrame(
  rules: Rule[],
  topHostname: string | undefined,
  frameHostname: string | undefined
): Rule | undefined {
  return (topHostname ? getEffectiveRule(rules, topHostname) : undefined)
    ?? (frameHostname ? getEffectiveRule(rules, frameHostname) : undefined);
}
