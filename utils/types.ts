export interface Rule {
  id: string;
  domainPattern: string;
  language: string;
  timezone: string;
  enabled: boolean;
  updatedAt: number;
}

export type RuleDraft = Omit<Rule, 'id' | 'updatedAt'>;

export const LANGUAGES: { value: string; label: string }[] = [
  { value: 'en-US,en;q=0.9', label: 'English (US)' },
  { value: 'en-GB,en;q=0.9', label: 'English (UK)' },
  { value: 'zh-CN,zh;q=0.9', label: '简体中文' },
  { value: 'zh-TW,zh;q=0.9', label: '繁體中文' },
  { value: 'ja,en-US;q=0.9', label: '日本語' },
  { value: 'ko,en-US;q=0.9', label: '한국어' },
  { value: 'fr,en-US;q=0.9', label: 'Français' },
  { value: 'de,en-US;q=0.9', label: 'Deutsch' },
  { value: 'es,en-US;q=0.9', label: 'Español' },
  { value: 'pt-BR,pt;q=0.9', label: 'Português (BR)' },
  { value: 'ru,en-US;q=0.9', label: 'Русский' },
  { value: 'ar,en-US;q=0.9', label: 'العربية' },
  { value: 'hi,en-US;q=0.9', label: 'हिन्दी' },
  { value: 'it,en-US;q=0.9', label: 'Italiano' },
  { value: 'nl,en-US;q=0.9', label: 'Nederlands' },
  { value: 'th,en-US;q=0.9', label: 'ไทย' },
  { value: 'vi,en-US;q=0.9', label: 'Tiếng Việt' },
  { value: 'tr,en-US;q=0.9', label: 'Türkçe' },
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
