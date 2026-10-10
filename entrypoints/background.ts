import { compileRules, getEffectiveRule, getEffectiveRuleForFrame, sortRulesByPriority } from '@/utils/rules';
import { getRules, watchRules } from '@/utils/storage';
import { patternToDnrCondition } from '@/utils/domainMatch';
import { isApplyPageSpoofMessage } from '@/utils/messages';
import { buildIsolatedWorldScript, buildMainWorldScript, installPageSpoof } from '@/utils/spoofScript';
import type { CompiledRule, Rule } from '@/utils/types';

const ALL_RESOURCE_TYPES = Object.values(
  chrome.declarativeNetRequest.ResourceType
) as chrome.declarativeNetRequest.ResourceType[];

// Tab rules must not touch the top-level navigation itself: its target host
// decides the header there (via the dynamic per-domain rules).
const SUBRESOURCE_TYPES = ALL_RESOURCE_TYPES.filter(
  (type) => type !== chrome.declarativeNetRequest.ResourceType.MAIN_FRAME
);

// Above any per-domain rule, so every request a page makes (including
// third-party APIs / CDNs) follows the language of the site in the tab.
const TAB_RULE_PRIORITY = 1_000_000;

const USER_SCRIPT_ID = 'page-spoof';

let rulesCache: Promise<Rule[]> | undefined;
let userScriptsActive = false;
let userScriptsSyncing: Promise<void> | undefined;

function loadRules(): Promise<Rule[]> {
  rulesCache ??= getRules();
  return rulesCache;
}

function hostnameOf(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).hostname || undefined;
  } catch {
    return undefined;
  }
}

function setLanguageHeader(language: string): chrome.declarativeNetRequest.RuleAction {
  return {
    type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
    requestHeaders: [
      {
        header: 'Accept-Language',
        operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
        value: language,
      },
    ],
  };
}

async function syncDnrRules(rules: Rule[]) {
  const enabledRules = sortRulesByPriority(rules.filter((rule) => rule.enabled));

  // Remove all existing dynamic rules
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  // Build new DNR rules
  const addRules: chrome.declarativeNetRequest.Rule[] = enabledRules.map(
    (rule, index) => ({
      id: index + 1,
      priority: enabledRules.length - index,
      action: setLanguageHeader(rule.language),
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

function buildTabRule(tabId: number, rule: Rule): chrome.declarativeNetRequest.Rule {
  return {
    id: tabId + 1,
    priority: TAB_RULE_PRIORITY,
    action: setLanguageHeader(rule.language),
    condition: {
      tabIds: [tabId],
      resourceTypes: SUBRESOURCE_TYPES,
    },
  };
}

// Session rule updates for the same tab can race (onBeforeNavigate followed by
// onCommitted); run them one at a time.
let sessionRuleQueue: Promise<void> = Promise.resolve();

function enqueueSessionRuleUpdate(task: () => Promise<void>) {
  sessionRuleQueue = sessionRuleQueue.then(task).catch(() => {});
  return sessionRuleQueue;
}

function updateTabRule(tabId: number, url: string | undefined) {
  return enqueueSessionRuleUpdate(async () => {
    const hostname = hostnameOf(url);
    const rule = hostname ? getEffectiveRule(await loadRules(), hostname) : undefined;

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tabId + 1],
      addRules: rule ? [buildTabRule(tabId, rule)] : [],
    });
  });
}

function syncAllTabRules(rules: Rule[]) {
  return enqueueSessionRuleUpdate(async () => {
    const [existing, tabs] = await Promise.all([
      chrome.declarativeNetRequest.getSessionRules(),
      chrome.tabs.query({}),
    ]);

    const addRules: chrome.declarativeNetRequest.Rule[] = [];
    for (const tab of tabs) {
      const hostname = hostnameOf(tab.url);
      const rule = hostname ? getEffectiveRule(rules, hostname) : undefined;
      if (typeof tab.id === 'number' && tab.id >= 0 && rule) {
        addRules.push(buildTabRule(tab.id, rule));
      }
    }

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: existing.map((rule) => rule.id),
      addRules,
    });
  });
}

/**
 * chrome.userScripts only exists once the user allows it ("Allow User Scripts"
 * toggle on the extension details page, or developer mode before Chrome 138).
 */
function isUserScriptsAvailable(): boolean {
  try {
    void chrome.userScripts.getScripts().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Primary page-spoof path on Chromium: a MAIN-world user script with the rules
 * baked in runs synchronously at document_start, before any page script.
 */
async function syncUserScripts(compiled: CompiledRule[]) {
  if (!isUserScriptsAvailable()) {
    userScriptsActive = false;
    return;
  }

  const existing = await chrome.userScripts.getScripts({ ids: [USER_SCRIPT_ID] });
  if (existing.length > 0) {
    await chrome.userScripts.unregister({ ids: [USER_SCRIPT_ID] });
  }

  if (compiled.length > 0) {
    await chrome.userScripts.register([{
      id: USER_SCRIPT_ID,
      matches: ['<all_urls>'],
      js: [{ code: buildMainWorldScript(compiled) }],
      runAt: 'document_start',
      world: chrome.userScripts.ExecutionWorld.MAIN,
      allFrames: true,
    }]);
  }

  userScriptsActive = true;
}

interface FirefoxRegisteredContentScript {
  unregister(): Promise<void>;
}

interface FirefoxContentScriptsApi {
  register(options: {
    matches: string[];
    js: { code: string }[];
    runAt: 'document_start';
    allFrames: boolean;
    matchAboutBlank: boolean;
  }): Promise<FirefoxRegisteredContentScript>;
}

let firefoxRegistration: FirefoxRegisteredContentScript | undefined;

/**
 * Primary page-spoof path on Firefox MV2: a registered content script with the
 * rules baked in, which injects into the page synchronously at document_start.
 */
async function syncFirefoxContentScript(compiled: CompiledRule[]) {
  const api = (globalThis as { browser?: { contentScripts?: FirefoxContentScriptsApi } })
    .browser?.contentScripts;
  if (!api) {
    return;
  }

  await firefoxRegistration?.unregister();
  firefoxRegistration = undefined;

  if (compiled.length > 0) {
    firefoxRegistration = await api.register({
      matches: ['<all_urls>'],
      js: [{ code: buildIsolatedWorldScript(compiled) }],
      runAt: 'document_start',
      allFrames: true,
      matchAboutBlank: true,
    });
  }
}

function syncEarlyInjection(rules: Rule[]) {
  const compiled = compileRules(rules);
  userScriptsSyncing = Promise.all([
    syncUserScripts(compiled).catch(() => {
      userScriptsActive = false;
    }),
    syncFirefoxContentScript(compiled).catch(() => {}),
  ]).then(() => {
    userScriptsSyncing = undefined;
  });
  return userScriptsSyncing;
}

async function executePageSpoof(
  target: chrome.scripting.InjectionTarget,
  timezone: string,
  language: string
) {
  if (!chrome.scripting?.executeScript) {
    return;
  }

  await chrome.scripting.executeScript({
    target,
    world: chrome.scripting.ExecutionWorld.MAIN,
    injectImmediately: true,
    func: installPageSpoof,
    args: [timezone, language],
  });
}

/**
 * Fallback when user scripts are not allowed: inject as soon as the browser
 * reports the navigation committed, which is earlier than the content script
 * round trip. Still racy against inline page scripts, hence "fallback".
 */
async function injectOnCommit(details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) {
  if (!userScriptsActive && !userScriptsSyncing && isUserScriptsAvailable()) {
    // The user enabled user scripts since the last sync.
    void loadRules().then(syncEarlyInjection);
  }

  if (userScriptsActive || !chrome.scripting?.executeScript) {
    return;
  }

  const rules = await loadRules();
  const frameHostname = hostnameOf(details.url);
  const topHostname = details.frameId === 0
    ? frameHostname
    : hostnameOf((await chrome.tabs.get(details.tabId)).url);
  const rule = getEffectiveRuleForFrame(rules, topHostname, frameHostname);
  if (!rule) {
    return;
  }

  const target: chrome.scripting.InjectionTarget = details.documentId
    ? { tabId: details.tabId, documentIds: [details.documentId] }
    : { tabId: details.tabId, frameIds: [details.frameId] };
  await executePageSpoof(target, rule.timezone, rule.language);
}

async function syncAll(rules: Rule[]) {
  await Promise.all([
    syncDnrRules(rules).catch(() => {}),
    syncAllTabRules(rules),
    syncEarlyInjection(rules),
  ]);
}

export default defineBackground({
  // Firefox unregisters contentScripts.register() scripts when the background
  // page unloads, so keep it alive (ignored for MV3 service workers).
  persistent: true,

  main() {
    void loadRules().then(syncAll);

    watchRules((rules) => {
      rulesCache = Promise.resolve(rules);
      void syncAll(rules);
    });

    chrome.webNavigation.onBeforeNavigate.addListener((details) => {
      if (details.frameId === 0 && details.tabId >= 0) {
        void updateTabRule(details.tabId, details.url);
      }
    });

    chrome.webNavigation.onCommitted.addListener((details) => {
      if (details.tabId < 0) {
        return;
      }

      if (details.frameId === 0) {
        void updateTabRule(details.tabId, details.url);
      }
      void injectOnCommit(details).catch(() => {});
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      void enqueueSessionRuleUpdate(() => chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [tabId + 1],
      }));
    });

    chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
      void enqueueSessionRuleUpdate(() => chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [removedTabId + 1],
      }));
      void chrome.tabs.get(addedTabId).then((tab) => updateTabRule(addedTabId, tab.url)).catch(() => {});
    });

    chrome.runtime.onMessage.addListener((message, sender) => {
      if (!isApplyPageSpoofMessage(message) || userScriptsActive) {
        return;
      }

      const tabId = sender.tab?.id;
      if (typeof tabId !== 'number') {
        return;
      }

      const target: chrome.scripting.InjectionTarget = sender.documentId
        ? { tabId, documentIds: [sender.documentId] }
        : typeof sender.frameId === 'number'
          ? { tabId, frameIds: [sender.frameId] }
          : { tabId };
      void executePageSpoof(target, message.timezone, message.language).catch(() => {});
    });
  },
});
