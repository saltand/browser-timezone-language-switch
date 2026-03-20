import { storage } from 'wxt/utils/storage';
import { normalizeRules } from './rules';
import type { Rule, RuleDraft } from './types';

export const rulesStorage = storage.defineItem<Rule[]>('local:rules', {
  fallback: [],
});

function createRuleId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createUniqueRuleId(usedIds: Set<string>): string {
  let nextId = createRuleId();

  while (usedIds.has(nextId)) {
    nextId = createRuleId();
  }

  usedIds.add(nextId);
  return nextId;
}

async function setNormalizedRules(rules: Rule[]): Promise<void> {
  const { rules: normalizedRules } = normalizeRules(rules);
  await rulesStorage.setValue(normalizedRules);
}

export async function getRules(): Promise<Rule[]> {
  const storedRules = await rulesStorage.getValue();
  const { rules, changed } = normalizeRules(storedRules);

  if (changed) {
    await rulesStorage.setValue(rules);
  }

  return rules;
}

export function watchRules(listener: (rules: Rule[]) => void): () => void {
  return rulesStorage.watch((newRules) => {
    if (!newRules) {
      return;
    }

    const { rules, changed } = normalizeRules(newRules);
    listener(rules);

    if (changed) {
      void rulesStorage.setValue(rules);
    }
  });
}

export async function addRule(rule: RuleDraft): Promise<void> {
  const rules = await getRules();
  const nextRule: Rule = {
    ...rule,
    id: createRuleId(),
    updatedAt: Date.now(),
  };

  await setNormalizedRules([...rules, nextRule]);
}

export async function updateRule(id: string, updates: Partial<RuleDraft>): Promise<void> {
  const rules = await getRules();
  const updatedAt = Date.now();

  await setNormalizedRules(
    rules.map((rule) => (
      rule.id === id
        ? { ...rule, ...updates, updatedAt }
        : rule
    ))
  );
}

export async function deleteRule(id: string): Promise<void> {
  const rules = await getRules();
  await setNormalizedRules(rules.filter((rule) => rule.id !== id));
}

export async function toggleRule(id: string): Promise<void> {
  const rules = await getRules();

  await setNormalizedRules(
    rules.map((rule) => (
      rule.id === id
        ? { ...rule, enabled: !rule.enabled }
        : rule
    ))
  );
}

export async function mergeRules(importedRules: RuleDraft[]): Promise<void> {
  const existingRules = await getRules();
  const usedIds = new Set(existingRules.map((rule) => rule.id));
  let nextUpdatedAt = Math.max(Date.now(), ...existingRules.map((rule) => rule.updatedAt));

  const mergedImportedRules: Rule[] = importedRules.map((rule) => {
    nextUpdatedAt += 1;

    return {
      ...rule,
      id: createUniqueRuleId(usedIds),
      updatedAt: nextUpdatedAt,
    };
  });

  await setNormalizedRules([...existingRules, ...mergedImportedRules]);
}
