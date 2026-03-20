import { useState, useEffect, useCallback } from 'react';
import { rulesStorage, addRule, deleteRule, toggleRule, updateRule } from '@/utils/storage';
import { matchesDomain, suggestDomainPattern } from '@/utils/domainMatch';
import { LANGUAGES, TIMEZONES } from '@/utils/types';
import type { Rule } from '@/utils/types';
import './App.css';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function sortRulesByHostname(rules: Rule[], hostname: string | null): Rule[] {
  if (!hostname) return rules;

  const matchedRules: Rule[] = [];
  const unmatchedRules: Rule[] = [];

  for (const rule of rules) {
    if (matchesDomain(rule.domainPattern, hostname)) {
      matchedRules.push(rule);
    } else {
      unmatchedRules.push(rule);
    }
  }

  return [...matchedRules, ...unmatchedRules];
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

  // Form state
  const [domainPattern, setDomainPattern] = useState('');
  const [language, setLanguage] = useState(LANGUAGES[0].value);
  const [timezone, setTimezone] = useState('America/New_York');

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
    rulesStorage.getValue().then(setRules);
    const unwatch = rulesStorage.watch((newRules) => {
      if (newRules) setRules(newRules);
    });
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

  const resetForm = useCallback(() => {
    setDomainPattern('');
    setLanguage(LANGUAGES[0].value);
    setTimezone('America/New_York');
    setEditingRule(null);
    setShowForm(false);
  }, []);

  const handleAdd = async () => {
    const hostname = currentHostname ?? await getActiveTabHostname();

    if (hostname !== currentHostname) {
      setCurrentHostname(hostname);
    }

    setEditingRule(null);
    setDomainPattern(hostname ? suggestDomainPattern(hostname) : '');
    setLanguage(LANGUAGES[0].value);
    setTimezone('America/New_York');
    setShowForm(true);
  };

  const handleEdit = (rule: Rule) => {
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
        id: generateId(),
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

  const getLangLabel = (val: string) =>
    (() => {
      const language = LANGUAGES.find((l) => l.value === val);
      if (language) {
        return formatLanguageDisplay(language.label, language.value);
      }

      const code = getPrimaryLanguageCode(val);
      return code === val ? val : code;
    })();

  const getTzLabel = (val: string) => {
    for (const g of TIMEZONES) {
      const z = g.zones.find((z) => z.value === val);
      if (z) return formatTimezoneDisplay(z.label, z.value);
    }
    return formatTimezoneDisplay(val, val);
  };

  const visibleRules = sortRulesByHostname(rules, currentHostname);

  return (
    <div className="popup">
      <header className="popup-header">
        <h1>TZ & Lang Switcher</h1>
        <button className="btn-add" onClick={handleAdd} title="Add rule">
          +
        </button>
      </header>

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

      {rules.length === 0 && !showForm && (
        <div className="empty-state">
          No rules yet. Click + to add one.
        </div>
      )}

      <ul className="rule-list">
        {visibleRules.map((rule) => (
          <li key={rule.id} className={`rule-item ${!rule.enabled ? 'disabled' : ''}`}>
            <div className="rule-info">
              <span className="rule-domain">{rule.domainPattern}</span>
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
        ))}
      </ul>
    </div>
  );
}

export default App;
