import { getEffectiveRule } from '@/utils/rules';
import { getRules } from '@/utils/storage';
import { buildSpoofScript } from '@/utils/spoofScript';
import type { ExtensionMessage } from '@/utils/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  async main() {
    const rules = await getRules();
    const matchedRule = getEffectiveRule(rules, location.hostname);
    if (!matchedRule) return;

    const message: ExtensionMessage = {
      type: 'APPLY_PAGE_SPOOF',
      language: matchedRule.language,
      timezone: matchedRule.timezone,
    };
    void chrome.runtime.sendMessage(message).catch(() => {});

    if (chrome.runtime.getManifest().manifest_version === 2) {
      const script = document.createElement('script');
      script.textContent = buildSpoofScript(matchedRule.timezone, matchedRule.language);
      document.documentElement.prepend(script);
      script.remove();
    }
  },
});
