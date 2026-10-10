export interface Rule {
  id: string;
  domainPattern: string;
  language: string;
  timezone: string;
  enabled: boolean;
  updatedAt: number;
}

export interface CompiledRule {
  hostRegex: string;
  language: string;
  timezone: string;
}

export type RuleDraft = Omit<Rule, 'id' | 'updatedAt'>;

// `timezone` is the zone suggested when the language is picked in the form.
export const LANGUAGES: { value: string; label: string; timezone: string }[] = [
  { value: 'en-US,en;q=0.9', label: 'English (US)', timezone: 'America/New_York' },
  { value: 'en-GB,en;q=0.9', label: 'English (UK)', timezone: 'Europe/London' },
  { value: 'zh-CN,zh;q=0.9', label: '简体中文', timezone: 'Asia/Shanghai' },
  { value: 'zh-TW,zh;q=0.9', label: '繁體中文', timezone: 'Asia/Taipei' },
  { value: 'ja,en-US;q=0.9', label: '日本語', timezone: 'Asia/Tokyo' },
  { value: 'ko,en-US;q=0.9', label: '한국어', timezone: 'Asia/Seoul' },
  { value: 'fr,en-US;q=0.9', label: 'Français', timezone: 'Europe/Paris' },
  { value: 'de,en-US;q=0.9', label: 'Deutsch', timezone: 'Europe/Berlin' },
  { value: 'es,en-US;q=0.9', label: 'Español', timezone: 'Europe/Madrid' },
  { value: 'pt-BR,pt;q=0.9', label: 'Português (BR)', timezone: 'America/Sao_Paulo' },
  { value: 'ru,en-US;q=0.9', label: 'Русский', timezone: 'Europe/Moscow' },
  { value: 'ar,en-US;q=0.9', label: 'العربية', timezone: 'Asia/Dubai' },
  { value: 'hi,en-US;q=0.9', label: 'हिन्दी', timezone: 'Asia/Kolkata' },
  { value: 'it,en-US;q=0.9', label: 'Italiano', timezone: 'Europe/Rome' },
  { value: 'nl,en-US;q=0.9', label: 'Nederlands', timezone: 'Europe/Amsterdam' },
  { value: 'th,en-US;q=0.9', label: 'ไทย', timezone: 'Asia/Bangkok' },
  { value: 'vi,en-US;q=0.9', label: 'Tiếng Việt', timezone: 'Asia/Ho_Chi_Minh' },
  { value: 'tr,en-US;q=0.9', label: 'Türkçe', timezone: 'Europe/Istanbul' },
];

export const TIMEZONES: { group: string; zones: { value: string; label: string }[] }[] = [
  { group: 'America', zones: [
    { value: 'America/New_York', label: 'New York (ET)' },
    { value: 'America/Chicago', label: 'Chicago (CT)' },
    { value: 'America/Denver', label: 'Denver (MT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
    { value: 'America/Anchorage', label: 'Anchorage (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Honolulu (HT)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
    { value: 'America/Toronto', label: 'Toronto (ET)' },
    { value: 'America/Vancouver', label: 'Vancouver (PT)' },
    { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
  ]},
  { group: 'Europe', zones: [
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)' },
    { value: 'Europe/Madrid', label: 'Madrid (CET)' },
    { value: 'Europe/Rome', label: 'Rome (CET)' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
    { value: 'Europe/Istanbul', label: 'Istanbul (TRT)' },
    { value: 'Europe/Athens', label: 'Athens (EET)' },
    { value: 'Europe/Helsinki', label: 'Helsinki (EET)' },
  ]},
  { group: 'Asia', zones: [
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
    { value: 'Asia/Taipei', label: 'Taipei (CST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'Kolkata (IST)' },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
    { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh (ICT)' },
    { value: 'Asia/Jakarta', label: 'Jakarta (WIB)' },
  ]},
  { group: 'Oceania', zones: [
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'Australia/Melbourne', label: 'Melbourne (AEST)' },
    { value: 'Australia/Perth', label: 'Perth (AWST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  ]},
  { group: 'Africa', zones: [
    { value: 'Africa/Cairo', label: 'Cairo (EET)' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
    { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
  ]},
];
