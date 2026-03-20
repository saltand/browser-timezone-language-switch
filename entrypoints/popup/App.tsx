import { useState, useEffect, useCallback, useRef } from 'react';
import {
  addRule,
  deleteRule,
  getRules,
  mergeRules,
  toggleRule,
  updateRule,
  watchRules,
} from '@/utils/storage';
import { getDuplicateRuleMeta, getDomainPatternKey, sortRulesForDisplay } from '@/utils/rules';
import { suggestDomainPattern } from '@/utils/domainMatch';
import { LANGUAGES, TIMEZONES } from '@/utils/types';
import { HEADER_ICONS } from './headerIcons';
import type { ChangeEvent } from 'react';
import type { Rule, RuleDraft } from '@/utils/types';
import type { HeaderIconName } from './headerIcons';
import './App.css';

const DEFAULT_LANGUAGE = LANGUAGES[0]?.value ?? 'en-US,en;q=0.9';
const DEFAULT_TIMEZONE = 'America/New_York';

type ImportExportPayload = {
  version: number;
  exportedAt: string;
  rules: Rule[];
};

type StatusState = {
  tone: 'error';
  message: string;
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

const timezoneOffsetCache = new Map<string, string>();

function getPrimaryLanguageCode(value: string): string {
  return value.split(',')[0] ?? value;
}

function formatLanguageDisplay(label: string, value: string): string {
  return `${label} (${getPrimaryLanguageCode(value)})`;
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

function App() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [currentHostname, setCurrentHostname] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<StatusState | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Form state
  const [domainPattern, setDomainPattern] = useState('');
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);

  const getActiveTabHostname = useCallback(async (): Promise<string | null> => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url;
      if (!url) {
        return null;
      }

      return new URL(url).hostname || null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    getRules().then(setRules);
    const unwatch = watchRules(setRules);
    return unwatch;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const hostname = await getActiveTabHostname();
      if (!cancelled) {
        setCurrentHostname(hostname);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getActiveTabHostname]);

  useEffect(() => {
    if (!status) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatus(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [status]);

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

  const resetForm = useCallback(() => {
    setDomainPattern('');
    setLanguage(DEFAULT_LANGUAGE);
    setTimezone(DEFAULT_TIMEZONE);
    setEditingRule(null);
    setShowForm(false);
  }, []);

  const handleAdd = async () => {
    const hostname = currentHostname ?? await getActiveTabHostname();

    if (hostname !== currentHostname) {
      setCurrentHostname(hostname);
    }

    setIsSearchOpen(false);
    setSearchQuery('');
    setStatus(null);
    setEditingRule(null);
    setDomainPattern(hostname ? suggestDomainPattern(hostname) : '');
    setLanguage(DEFAULT_LANGUAGE);
    setTimezone(DEFAULT_TIMEZONE);
    setShowForm(true);
  };

  const handleEdit = (rule: Rule) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setStatus(null);
    setEditingRule(rule);
    setDomainPattern(rule.domainPattern);
    setLanguage(rule.language);
    setTimezone(rule.timezone);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!domainPattern.trim()) return;

    if (editingRule) {
      await updateRule(editingRule.id, {
        domainPattern: domainPattern.trim(),
        language,
        timezone,
      });
    } else {
      await addRule({
        domainPattern: domainPattern.trim(),
        language,
        timezone,
        enabled: true,
      });
    }

    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteRule(id);
  };

  const handleToggle = async (id: string) => {
    await toggleRule(id);
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

    setStatus(null);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.';
      setStatus({ tone: 'error', message });
    }
  };

  const getLangLabel = (val: string) =>
    (() => {
      const languageOption = LANGUAGES.find((languageItem) => languageItem.value === val);
      if (languageOption) {
        return formatLanguageDisplay(languageOption.label, languageOption.value);
      }

      const code = getPrimaryLanguageCode(val);
      return code === val ? val : code;
    })();

  const getTzLabel = (val: string) => {
    for (const group of TIMEZONES) {
      const zone = group.zones.find((timezoneItem) => timezoneItem.value === val);
      if (zone) return formatTimezoneDisplay(zone.label, zone.value);
    }

    return formatTimezoneDisplay(val, val);
  };

  const { duplicateCounts, effectiveRuleIdByDomain } = getDuplicateRuleMeta(rules);
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

  const showEmptyState = rules.length === 0 && !showForm;
  const showSearchEmptyState = rules.length > 0 && visibleRules.length === 0;
  const showSearchBar = !showForm && rules.length > 0 && isSearchOpen;

  return (
    <div className="popup">
      <header className="popup-header">
        <h1>TZ & Lang Switcher</h1>
        <div className="header-actions">
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
          <button
            className="btn-header-icon"
            onClick={handleImportButtonClick}
            title="Import rules"
            aria-label="Import rules"
          >
            <Icon name="import" />
          </button>
          <button
            className="btn-header-icon"
            onClick={handleExport}
            title="Export rules"
            aria-label="Export rules"
            disabled={rules.length === 0}
          >
            <Icon name="export" />
          </button>
          <button className="btn-add" onClick={handleAdd} title="Add rule" aria-label="Add rule">
            <Icon name="add-round" />
          </button>
        </div>
      </header>

      {showSearchBar && (
        <div className="toolbar">
          <div className="toolbar-row">
            <input
              ref={searchInputRef}
              className="search-input"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
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

      {status && (
        <div className={`status-banner ${status.tone}`} role="alert" aria-live="assertive">
          {status.message}
        </div>
      )}

      {showForm && (
        <div className="form-section">
          <div className="form-group">
            <label>Domain Pattern</label>
            <input
              type="text"
              value={domainPattern}
              onChange={(e) => setDomainPattern(e.target.value)}
              placeholder="*.example.com"
              autoFocus
            />
            <span className="hint">
              Supports: example.com, *.example.com, *google*
            </span>
          </div>
          <div className="form-group">
            <label>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {formatLanguageDisplay(l.label, l.value)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Timezone</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.zones.map((z) => (
                    <option key={z.value} value={z.value}>
                      {formatTimezoneDisplay(z.label, z.value)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button className="btn-save" onClick={handleSave}>
              {editingRule ? 'Update' : 'Add'}
            </button>
            <button className="btn-cancel" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
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

      <ul className="rule-list">
        {visibleRules.map((rule) => {
          const domainKey = getDomainPatternKey(rule.domainPattern);
          const isDuplicate = (duplicateCounts.get(domainKey) ?? 0) > 1;
          const isEffective = effectiveRuleIdByDomain.get(domainKey) === rule.id;

          return (
            <li key={rule.id} className={`rule-item ${!rule.enabled ? 'disabled' : ''}`}>
              <div className="rule-info">
                <div className="rule-domain-row">
                  <span className="rule-domain">{rule.domainPattern}</span>
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
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggle(rule.id)}
                  />
                  <span className="toggle-slider" />
                </label>
                <button className="btn-icon" onClick={() => handleEdit(rule)} title="Edit">
                  &#9998;
                </button>
                <button className="btn-icon btn-delete" onClick={() => handleDelete(rule.id)} title="Delete">
                  &#10005;
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default App;
