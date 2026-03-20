export type HeaderIconName = 'add-round' | 'import' | 'export' | 'search';

export type HeaderIconData = {
  body: string;
  width: number;
  height: number;
};

// Extracted from @iconify-json/lets-icons to avoid bundling the full icon set.
export const HEADER_ICONS: Record<HeaderIconName, HeaderIconData> = {
  'add-round': {
    width: 24,
    height: 24,
    body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M12 6v12m6-6H6"/>',
  },
  import: {
    width: 24,
    height: 24,
    body: '<g fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11c0 .932 0 1.398.152 1.765a2 2 0 0 0 1.083 1.083C4.602 14 5.068 14 6 14h.675c.581 0 .872 0 1.104.134a1 1 0 0 1 .164.118c.2.178.292.453.476 1.005l.125.376c.22.66.33.99.592 1.178c.262.189.61.189 1.306.189h3.117c.695 0 1.043 0 1.305-.189s.372-.518.592-1.178l.125-.376c.184-.552.276-.827.476-1.005a1 1 0 0 1 .164-.118c.232-.134.523-.134 1.104-.134H18c.932 0 1.398 0 1.765-.152a2 2 0 0 0 1.083-1.083C21 12.398 21 11.932 21 11M8.5 9.5L12 12m0 0l3.5-2.5M12 12V6"/><path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2Z"/></g>',
  },
  export: {
    width: 24,
    height: 24,
    body: '<g fill="none"><path fill="currentColor" d="m12 5l-.707-.707l.707-.707l.707.707zm1 9a1 1 0 1 1-2 0zM6.293 9.293l5-5l1.414 1.414l-5 5zm6.414-5l5 5l-1.414 1.414l-5-5zM13 5v9h-2V5z"/><path stroke="currentColor" stroke-width="2" d="M5 16v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1"/></g>',
  },
  search: {
    width: 24,
    height: 24,
    body: '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="m20 20l-3-3"/></g>',
  },
};
