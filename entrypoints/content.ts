import { getEffectiveRule } from '@/utils/rules';
import { getRules } from '@/utils/storage';
import { buildSpoofScript } from '@/utils/spoofScript';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  async main() {
    const rules = await getRules();
    const matchedRule = getEffectiveRule(rules, location.hostname);
    if (!matchedRule) return;

    const script = document.createElement('script');
    script.textContent = buildSpoofScript(matchedRule.timezone, matchedRule.language);
    document.documentElement.prepend(script);
    script.remove();
  },
});
