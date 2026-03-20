import { storage } from 'wxt/utils/storage';
import type { Rule } from './types';

export const rulesStorage = storage.defineItem<Rule[]>('local:rules', {
  fallback: [],
});

export async function addRule(rule: Rule): Promise<void> {
  const rules = await rulesStorage.getValue();
  await rulesStorage.setValue([...rules, rule]);
}

export async function updateRule(id: string, updates: Partial<Omit<Rule, 'id'>>): Promise<void> {
  const rules = await rulesStorage.getValue();
  await rulesStorage.setValue(
    rules.map((r) => (r.id === id ? { ...r, ...updates } : r))
  );
}

export async function deleteRule(id: string): Promise<void> {
  const rules = await rulesStorage.getValue();
  await rulesStorage.setValue(rules.filter((r) => r.id !== id));
}

export async function toggleRule(id: string): Promise<void> {
  const rules = await rulesStorage.getValue();
  await rulesStorage.setValue(
    rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
  );
}
