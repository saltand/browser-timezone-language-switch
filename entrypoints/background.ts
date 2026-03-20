import { sortRulesByPriority } from '@/utils/rules';
import { getRules, watchRules } from '@/utils/storage';
import { patternToDnrCondition } from '@/utils/domainMatch';

const ALL_RESOURCE_TYPES: chrome.declarativeNetRequest.ResourceType[] = [
  chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
  chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
  chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
  chrome.declarativeNetRequest.ResourceType.SCRIPT,
  chrome.declarativeNetRequest.ResourceType.STYLESHEET,
  chrome.declarativeNetRequest.ResourceType.IMAGE,
  chrome.declarativeNetRequest.ResourceType.FONT,
  chrome.declarativeNetRequest.ResourceType.MEDIA,
  chrome.declarativeNetRequest.ResourceType.OTHER,
];

async function syncDnrRules() {
  const rules = await getRules();
  const enabledRules = sortRulesByPriority(rules.filter((rule) => rule.enabled));

  // Remove all existing dynamic rules
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  // Build new DNR rules
  const addRules: chrome.declarativeNetRequest.Rule[] = enabledRules.map(
    (rule, index) => ({
      id: index + 1,
      priority: enabledRules.length - index,
      action: {
        type: 'modifyHeaders' as const,
        requestHeaders: [
          {
            header: 'Accept-Language',
            operation: 'set' as const,
            value: rule.language,
          },
        ],
      },
      condition: {
        ...patternToDnrCondition(rule.domainPattern),
        resourceTypes: ALL_RESOURCE_TYPES,
      },
    })
  );

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });
}

export default defineBackground(() => {
  void syncDnrRules();

  watchRules(() => {
    void syncDnrRules();
  });
});
