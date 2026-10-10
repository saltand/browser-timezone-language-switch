import { useState, useEffect, useCallback, useRef } from 'react';
import {
  addRule,
  deleteRule,
  getRules,
  mergeRules,
  pausedStorage,
  restoreRule,
  setPaused,
  toggleRule,
  updateRule,
  watchRules,
} from '@/utils/storage';
import {
  getDuplicateRuleMeta,
  getDomainPatternKey,
  getEffectiveRule,
  sortRulesForDisplay,
} from '@/utils/rules';
import { matchesDomain, suggestDomainPattern } from '@/utils/domainMatch';
import {
  describeLanguageTag,
  getAllTimezones,
  getPrimaryLanguageTag,
  getSuggestedTimezone,
  parseLanguageInput,
  parseTimezoneInput,
} from '@/utils/locale';
import { LANGUAGES, TIMEZONES } from '@/utils/types';
import { Combobox } from './Combobox';
import { HEADER_ICONS } from './headerIcons';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import type { Rule, RuleDraft } from '@/utils/types';
import type { ComboboxOption } from './Combobox';
import type { HeaderIconName } from './headerIcons';
import './App.css';

const DEFAULT_LANGUAGE = LANGUAGES[0]?.value ?? 'en-US,en;q=0.9';
const DEFAULT_TIMEZONE = LANGUAGES[0]?.timezone ?? 'America/New_York';

type ImportExportPayload = {
  version: number;
  exportedAt: string;
  rules: Rule[];
};

type ToastState = {
  tone: 'error' | 'success' | 'info';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};


function Icon({ name }: { name: HeaderIconName }) {
  const icon = HEADER_ICONS[name];

  return (
    <svg
      className="header-icon-svg"
      viewBox={`0 0 ${icon.width} ${icon.height}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeImportedRules(input: unknown): RuleDraft[] {
  const rawRules = Array.isArray(input)
    ? input
    : isRecord(input) && Array.isArray(input.rules)
      ? input.rules
      : null;

  if (!rawRules) {
    throw new Error('Invalid import file.');
  }

  return rawRules.map((rawRule, index) => {
    if (!isRecord(rawRule)) {
      throw new Error(`Rule ${index + 1} is invalid.`);
    }

    const domainPattern = typeof rawRule.domainPattern === 'string'
      ? rawRule.domainPattern.trim()
      : '';
    if (!domainPattern) {
      throw new Error(`Rule ${index + 1} is missing domainPattern.`);
    }

    const language = typeof rawRule.language === 'string' && rawRule.language.trim()
      ? rawRule.language
      : DEFAULT_LANGUAGE;
    const timezone = typeof rawRule.timezone === 'string' && rawRule.timezone.trim()
      ? rawRule.timezone
      : DEFAULT_TIMEZONE;

    return {
      domainPattern,
      language,
      timezone,
      enabled: typeof rawRule.enabled === 'boolean' ? rawRule.enabled : true,
    };
  });
}

/**
 * Chromium hides chrome.userScripts until the user allows it; without it the
 * page spoof falls back to a late (racy) injection.
 */
function isUserScriptsDisabled(): boolean {
  if (!chrome.scripting) {
    return false;
  }

  try {
    void chrome.userScripts.getScripts().catch(() => {});
    return false;
  } catch {
    return true;
  }
}

const timezoneOffsetCache = new Map<string, string>();

function formatLanguageDisplay(label: string, value: string): string {
  return `${label} (${getPrimaryLanguageTag(value)})`;
}

function getTimezoneOffsetLabel(timezone: string): string {
  const cached = timezoneOffsetCache.get(timezone);
  if (cached != null) {
    return cached;
  }

  let offset = '';

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const timezoneName = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';

    if (timezoneName === 'GMT' || timezoneName === 'UTC') {
      offset = '+0';
    } else {
      const match = timezoneName.match(/(?:GMT|UTC)([+-]\d{1,2})(?::?(\d{2}))?/i);
      if (match) {
        offset = match[2] && match[2] !== '00' ? `${match[1]}:${match[2]}` : match[1];
      }
    }
  } catch {
    offset = '';
  }

  timezoneOffsetCache.set(timezone, offset);
  return offset;
}

function formatTimezoneDisplay(label: string, value: string): string {
  const offset = getTimezoneOffsetLabel(value);
  return offset ? `${label} ${offset}` : label;
}

function getLangLabel(value: string): string {
  const option = LANGUAGES.find((item) => item.value === value);
  if (option) {
    return formatLanguageDisplay(option.label, value);
  }

  const tag = getPrimaryLanguageTag(value);
  return formatLanguageDisplay(describeLanguageTag(tag), value);
}

const PRESET_TIMEZONE_LABELS = new Map(
  TIMEZONES.flatMap((group) => group.zones.map((zone) => [zone.value, zone.label] as const))
);

function getTimezoneCity(value: string): string {
  return value.split('/').pop()?.replace(/_/g, ' ') ?? value;
}

function getTzLabel(value: string): string {
  return formatTimezoneDisplay(PRESET_TIMEZONE_LABELS.get(value) ?? getTimezoneCity(value), value);
}

const LANGUAGE_OPTIONS: ComboboxOption[] = LANGUAGES.map((item) => ({
  value: item.value,
  label: formatLanguageDisplay(item.label, item.value),
}));

let timezoneOptions: ComboboxOption[] | undefined;

// Built lazily: formatting offsets for every IANA zone is only needed once the form opens.
function getTimezoneOptions(): ComboboxOption[] {
  timezoneOptions ??= getAllTimezones().map((zone) => ({
    value: zone,
    label: getTzLabel(zone),
    detail: zone.includes('/') ? zone.split('/')[0] : undefined,
  }));
  return timezoneOptions;
}

function getRuleSignature(rule: Rule | undefined): string {
  return rule ? `${rule.language}|${rule.timezone}` : '';
}

type ActiveTab = {
  id: number;
  hostname: string | null;
  isWebPage: boolean;
};

async function getActiveTab(): Promise<ActiveTab | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof tab?.id !== 'number') {
      return null;
    }

    const url = tab.url ? new URL(tab.url) : null;
    return {
      id: tab.id,
      hostname: url?.hostname || null,
      isWebPage: url?.protocol === 'http:' || url?.protocol === 'https:',
    };
  } catch {
    return null;
  }
}


function App() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [paused, setPausedState] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null);
  const [loaded, setLoaded] = useState(false);
  // What the open page was loaded with, to tell when a reload is needed.
  const [appliedSignature, setAppliedSignature] = useState('');
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [userScriptsDisabled, setUserScriptsDisabled] = useState(isUserScriptsDisabled);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Form state
  const [domainPattern, setDomainPattern] = useState('');
  const [patternError, setPatternError] = useState(false);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [timezoneTouched, setTimezoneTouched] = useState(false);

  const currentHostname = activeTab?.hostname ?? null;

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getRules(), pausedStorage.getValue(), getActiveTab()]).then(
      ([initialRules, initialPaused, tab]) => {
        if (cancelled) {
          return;
        }

        setRules(initialRules);
        setPausedState(initialPaused);
        setActiveTab(tab);
        setAppliedSignature(getRuleSignature(
          !initialPaused && tab?.hostname ? getEffectiveRule(initialRules, tab.hostname) : undefined
        ));
        setLoaded(true);
      }
    );

    const unwatchRules = watchRules(setRules);
    const unwatchPaused = pausedStorage.watch((value) => setPausedState(value ?? false));

    return () => {
      cancelled = true;
      unwatchRules();
      unwatchPaused();
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, toast.action ? 6000 : 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  // The "Allow User Scripts" toggle has no change event; poll while the notice shows.
  useEffect(() => {
    if (!userScriptsDisabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!isUserScriptsDisabled()) {
        setUserScriptsDisabled(false);
      }
    }, 1500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [userScriptsDisabled]);

  useEffect(() => {
    if (isSearchOpen && !showForm) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen, showForm]);

  useEffect(() => {
    if (rules.length === 0 && (isSearchOpen || searchQuery)) {
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  }, [isSearchOpen, rules.length, searchQuery]);

  const currentRule = !paused && currentHostname ? getEffectiveRule(rules, currentHostname) : undefined;
  const needsReload = loaded
    && activeTab?.isWebPage === true
    && getRuleSignature(currentRule) !== appliedSignature;

  const resetForm = useCallback(() => {
    setDomainPattern('');
    setPatternError(false);
    setLanguage(DEFAULT_LANGUAGE);
    setTimezone(DEFAULT_TIMEZONE);
    setTimezoneTouched(false);
    setEditingRule(null);
    setShowForm(false);
  }, []);

  const openForm = (rule: Rule | null, pattern: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setToast(null);
    setEditingRule(rule);
    setDomainPattern(pattern);
    setPatternError(false);
    setLanguage(rule?.language ?? DEFAULT_LANGUAGE);
    setTimezone(rule?.timezone ?? DEFAULT_TIMEZONE);
    setTimezoneTouched(false);
    setShowForm(true);
  };

  const handleAdd = () => {
    openForm(null, currentHostname ? suggestDomainPattern(currentHostname) : '');
  };

  const handleEdit = (rule: Rule) => {
    openForm(rule, rule.domainPattern);
  };

  const { duplicateCounts, effectiveRuleIdByDomain } = getDuplicateRuleMeta(rules);

  const trimmedPattern = domainPattern.trim();
  const trimmedPatternKey = getDomainPatternKey(trimmedPattern);
  const conflictingRules = trimmedPattern
    ? rules.filter((rule) => rule.id !== editingRule?.id && getDomainPatternKey(rule.domainPattern) === trimmedPatternKey)
    : [];
  const conflictingRule = conflictingRules.find((rule) => rule.id === effectiveRuleIdByDomain.get(trimmedPatternKey))
    ?? conflictingRules[0];
  const patternMatchesCurrentSite = trimmedPattern && currentHostname && activeTab?.isWebPage
    ? matchesDomain(trimmedPattern, currentHostname)
    : null;

  const handleLanguageChange = (nextLanguage: string) => {
    // Follow the language with its usual timezone, unless the user picked one.
    const suggested = getSuggestedTimezone(nextLanguage);
    if (suggested && (!timezoneTouched || timezone === getSuggestedTimezone(language))) {
      setTimezone(suggested);
    }
    setLanguage(nextLanguage);
  };

  const handleTimezoneChange = (nextTimezone: string) => {
    setTimezone(nextTimezone);
    setTimezoneTouched(true);
  };

  const handleSave = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!trimmedPattern) {
      setPatternError(true);
      return;
    }

    if (editingRule) {
      await updateRule(editingRule.id, {
        domainPattern: trimmedPattern,
        language,
        timezone,
      });
    } else if (conflictingRule) {
      // Same pattern already exists: update it instead of stacking a duplicate.
      await updateRule(conflictingRule.id, {
        domainPattern: trimmedPattern,
        language,
        timezone,
        enabled: true,
      });
    } else {
      await addRule({
        domainPattern: trimmedPattern,
        language,
        timezone,
        enabled: true,
      });
    }

    resetForm();
  };

  const handleFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      resetForm();
    }
  };

  const handleDelete = async (rule: Rule) => {
    const index = rules.findIndex((item) => item.id === rule.id);
    if (editingRule?.id === rule.id) {
      resetForm();
    }

    await deleteRule(rule.id);
    setToast({
      tone: 'info',
      message: `Deleted ${rule.domainPattern}`,
      action: {
        label: 'Undo',
        onClick: () => {
          setToast(null);
          void restoreRule(rule, index);
        },
      },
    });
  };

  const handleToggle = async (id: string) => {
    await toggleRule(id);
  };

  const handleTogglePaused = async () => {
    await setPaused(!paused);
  };

  const handleReload = () => {
    if (!activeTab) {
      return;
    }

    void chrome.tabs.reload(activeTab.id);
    setAppliedSignature(getRuleSignature(currentRule));
  };

  const handleOpenExtensionSettings = () => {
    void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  };

  const handleExport = () => {
    const payload: ImportExportPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      rules,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `tz-lang-rules-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setToast({
      tone: 'success',
      message: `Exported ${rules.length} rule${rules.length === 1 ? '' : 's'}.`,
    });
  };

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleToggleSearch = () => {
    if (showForm || rules.length === 0) {
      return;
    }

    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery('');
      return;
    }

    setToast(null);
    setIsSearchOpen(true);
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as unknown;
      const importedRules = normalizeImportedRules(parsed);
      const confirmed = window.confirm(
        `Merge ${importedRules.length} imported rule${importedRules.length === 1 ? '' : 's'} into the current ${rules.length} rule${rules.length === 1 ? '' : 's'}? Duplicate domains will be kept, and newer rules will take effect.`,
      );

      if (!confirmed) {
        return;
      }

      await mergeRules(importedRules);
      setSearchQuery('');
      resetForm();
      setToast({
        tone: 'success',
        message: `Imported ${importedRules.length} rule${importedRules.length === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.';
      setToast({ tone: 'error', message });
    }
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleRules = sortRulesForDisplay(rules, currentHostname).filter((rule) => {
    if (!normalizedSearchQuery) {
      return true;
    }

    const searchableText = [
      rule.domainPattern,
      rule.language,
      rule.timezone,
      getLangLabel(rule.language),
      getTzLabel(rule.timezone),
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedSearchQuery);
  });

  const showEmptyState = loaded && rules.length === 0 && !showForm;
  const showSearchEmptyState = rules.length > 0 && visibleRules.length === 0;
  const showSearchBar = !showForm && rules.length > 0 && isSearchOpen;

  const renderSiteCard = () => {
    if (!loaded || showForm) {
      return null;
    }

    if (!activeTab?.isWebPage) {
      return (
        <section className="site-card">
          <div className="site-card-status is-muted">Rules only apply to http(s) pages.</div>
        </section>
      );
    }

    const matchingRule = currentHostname ? getEffectiveRule(rules, currentHostname) : undefined;

    return (
      <section className={`site-card ${currentRule ? 'is-active' : ''}`} aria-label="Current site">
        <div className="site-card-row">
          <div className="site-card-info">
            <div className="site-card-host" title={currentHostname ?? ''}>{currentHostname}</div>
            {paused ? (
              <div className="site-card-status is-muted">Paused · all rules are off</div>
            ) : currentRule ? (
              <div className="site-card-status">
                {getLangLabel(currentRule.language)} · {getTzLabel(currentRule.timezone)}
              </div>
            ) : (
              <div className="site-card-status is-muted">No rule for this site</div>
            )}
          </div>
          {paused ? (
            <button type="button" className="btn-text" onClick={handleTogglePaused}>
              Resume
            </button>
          ) : matchingRule ? (
            <button type="button" className="btn-text" onClick={() => handleEdit(matchingRule)}>
              Edit
            </button>
          ) : (
            <button type="button" className="btn-text is-primary" onClick={handleAdd}>
              Add rule
            </button>
          )}
        </div>
        {needsReload && (
          <div className="site-card-reload" role="status">
            <span>Reload the page to apply changes.</span>
            <button type="button" className="btn-text is-primary" onClick={handleReload}>
              Reload
            </button>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="popup">
      <header className="popup-header">
        <h1>TZ & Lang Switcher</h1>
        <div className="header-actions">
          <label
            className="toggle"
            title={paused ? 'All rules are paused' : 'Pause all rules'}
          >
            <input
              type="checkbox"
              checked={!paused}
              onChange={handleTogglePaused}
              aria-label="Apply rules"
            />
            <span className="toggle-slider" />
          </label>
          <button
            className={`btn-header-icon ${isSearchOpen ? 'is-active' : ''}`}
            onClick={handleToggleSearch}
            title="Search rules"
            aria-label="Search rules"
            aria-pressed={isSearchOpen}
            disabled={rules.length === 0 || showForm}
          >
            <Icon name="search" />
          </button>
          <button className="btn-add" onClick={handleAdd} title="Add rule" aria-label="Add rule">
            <Icon name="add-round" />
          </button>
        </div>
      </header>

      {userScriptsDisabled && (
        <div className="notice">
          <span>
            Turn on "Allow User Scripts" for this extension so language spoofing applies
            before the page's own scripts run.
          </span>
          <button type="button" className="btn-text is-primary" onClick={handleOpenExtensionSettings}>
            Open settings
          </button>
        </div>
      )}

      {renderSiteCard()}

      {showSearchBar && (
        <div className="toolbar">
          <div className="toolbar-row">
            <input
              ref={searchInputRef}
              className="search-input"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && searchQuery) {
                  event.preventDefault();
                  setSearchQuery('');
                }
              }}
              placeholder="Search domain, language, timezone"
            />
            <span className="toolbar-count">
              {visibleRules.length}/{rules.length}
            </span>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        accept="application/json,.json"
        onChange={handleImportFile}
      />

      {toast && (
        <div
          className={`status-banner ${toast.tone} ${toast.action ? 'has-action' : ''}`}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button type="button" className="btn-text is-primary" onClick={toast.action.onClick}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form className="form-section" onSubmit={handleSave} onKeyDown={handleFormKeyDown} noValidate>
          <div className="form-group">
            <label htmlFor="domain-pattern">Domain Pattern</label>
            <input
              id="domain-pattern"
              type="text"
              value={domainPattern}
              onChange={(e) => {
                setDomainPattern(e.target.value);
                setPatternError(false);
              }}
              placeholder="*.example.com"
              aria-invalid={patternError}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            {patternError ? (
              <span className="hint is-error">Enter a domain pattern.</span>
            ) : patternMatchesCurrentSite === true ? (
              <span className="hint is-success">✓ Matches {currentHostname}</span>
            ) : patternMatchesCurrentSite === false ? (
              <span className="hint">Doesn't match {currentHostname}</span>
            ) : (
              <span className="hint">Supports: example.com, *.example.com, *google*</span>
            )}
            {conflictingRule && (
              <span className="hint is-warning">
                {editingRule
                  ? 'Another rule uses this pattern; the one saved last takes effect.'
                  : 'A rule for this pattern exists. Saving will update it.'}
              </span>
            )}
          </div>
          <Combobox
            label="Language"
            value={language}
            options={LANGUAGE_OPTIONS}
            formatValue={getLangLabel}
            parseCustom={parseLanguageInput}
            onChange={handleLanguageChange}
            placeholder="Search or type a language tag, e.g. pt-PT"
            customHint="Use a language tag like pt-PT."
          />
          <Combobox
            label="Timezone"
            value={timezone}
            options={getTimezoneOptions()}
            formatValue={getTzLabel}
            parseCustom={parseTimezoneInput}
            onChange={handleTimezoneChange}
            placeholder="Search city or IANA zone"
            customHint="Use an IANA zone like Europe/Lisbon."
          />
          <div className="form-actions">
            <button type="submit" className="btn-save">
              {editingRule || conflictingRule ? 'Update' : 'Add'}
            </button>
            <button type="button" className="btn-cancel" onClick={resetForm}>
              Cancel
            </button>
          </div>
          <span className="hint form-shortcuts">Enter to save · Esc to cancel</span>
        </form>
      )}

      {showEmptyState && (
        <div className="empty-state">
          No rules yet. Click + to add one.
        </div>
      )}

      {showSearchEmptyState && (
        <div className="empty-state">
          No rules match "{searchQuery.trim()}".
        </div>
      )}

      <ul className={`rule-list ${paused ? 'is-paused' : ''}`}>
        {visibleRules.map((rule) => {
          const domainKey = getDomainPatternKey(rule.domainPattern);
          const isDuplicate = (duplicateCounts.get(domainKey) ?? 0) > 1;
          const isEffective = effectiveRuleIdByDomain.get(domainKey) === rule.id;
          const isCurrent = currentRule?.id === rule.id;

          return (
            <li
              key={rule.id}
              className={`rule-item ${!rule.enabled ? 'disabled' : ''} ${isCurrent ? 'is-current' : ''}`}
            >
              <div className="rule-info">
                <div className="rule-domain-row">
                  <span className="rule-domain" title={rule.domainPattern}>{rule.domainPattern}</span>
                  {isCurrent && <span className="rule-badge is-current">This site</span>}
                  {isDuplicate && (
                    <span className={`rule-badge ${isEffective ? 'is-effective' : ''}`}>
                      {isEffective ? 'Effective' : 'Duplicate'}
                    </span>
                  )}
                </div>
                <span className="rule-meta">
                  {getLangLabel(rule.language)} · {getTzLabel(rule.timezone)}
                </span>
              </div>
              <div className="rule-actions">
                <label className="toggle" title={rule.enabled ? 'Disable rule' : 'Enable rule'}>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggle(rule.id)}
                    aria-label={`Enable rule for ${rule.domainPattern}`}
                  />
                  <span className="toggle-slider" />
                </label>
                <button
                  className="btn-icon"
                  onClick={() => handleEdit(rule)}
                  title="Edit"
                  aria-label={`Edit rule for ${rule.domainPattern}`}
                >
                  <Icon name="edit" />
                </button>
                <button
                  className="btn-icon btn-delete"
                  onClick={() => handleDelete(rule)}
                  title="Delete"
                  aria-label={`Delete rule for ${rule.domainPattern}`}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="popup-footer">
        <button type="button" className="btn-text" onClick={handleImportButtonClick}>
          Import
        </button>
        <button type="button" className="btn-text" onClick={handleExport} disabled={rules.length === 0}>
          Export
        </button>
      </footer>
    </div>
  );
}

export default App;
