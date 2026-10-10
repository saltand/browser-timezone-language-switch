import { compileRules } from '@/utils/rules';
import { getRules, pausedStorage } from '@/utils/storage';
import { buildSpoofScript, pickRule } from '@/utils/spoofScript';
import type { ExtensionMessage } from '@/utils/messages';

/**
 * Fallback path. The primary path injects synchronously at document_start
 * (chrome.userScripts on Chromium, contentScripts.register on Firefox) and
 * marks the page as patched, so a late second install here is a no-op.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  async main() {
    const [rules, paused] = await Promise.all([getRules(), pausedStorage.getValue()]);
    if (paused) return;

    const matchedRule = pickRule(compileRules(rules));
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
      (document.documentElement || document).prepend(script);
      script.remove();
    }
  },
});
