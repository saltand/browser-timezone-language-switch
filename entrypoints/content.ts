import { rulesStorage } from '@/utils/storage';
import { matchesDomain } from '@/utils/domainMatch';
import { buildSpoofScript } from '@/utils/spoofScript';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  async main() {
    const rules = await rulesStorage.getValue();
    const hostname = location.hostname;

    const matched = rules.find(
      (r) => r.enabled && matchesDomain(r.domainPattern, hostname)
    );
    if (!matched) return;

    const script = document.createElement('script');
    script.textContent = buildSpoofScript(matched.timezone, matched.language);
    document.documentElement.prepend(script);
    script.remove();
  },
});
