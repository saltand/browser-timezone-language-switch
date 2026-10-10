export type HeaderIconName = 'add-round' | 'search' | 'edit' | 'trash';

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
  search: {
    width: 24,
    height: 24,
    body: '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="m20 20l-3-3"/></g>',
  },
  edit: {
    width: 24,
    height: 24,
    body: '<mask id="SVG8dJ0oeeE" width="15" height="15" x="4" y="5" fill="#000" maskUnits="userSpaceOnUse"><path fill="#fff" d="M4 5h15v15H4z"/><path d="m13.586 7.414l-7.194 7.194c-.195.195-.292.292-.36.41c-.066.119-.1.252-.166.52l-.664 2.654c-.09.36-.135.541-.035.641s.28.055.641-.035l2.655-.664c.267-.066.4-.1.518-.167c.119-.067.216-.164.41-.359l7.195-7.194c.667-.666 1-1 1-1.414s-.333-.748-1-1.414l-.172-.172c-.667-.666-1-1-1.414-1s-.748.334-1.414 1"/></mask><g fill="none"><path stroke="currentColor" stroke-width="2" d="m13.586 7.414l-7.194 7.194c-.195.195-.292.292-.36.41c-.066.119-.1.252-.166.52l-.664 2.654c-.09.36-.135.541-.035.641s.28.055.641-.035l2.655-.664c.267-.066.4-.1.518-.167c.119-.067.216-.164.41-.359l7.195-7.194c.667-.666 1-1 1-1.414s-.333-.748-1-1.414l-.172-.172c-.667-.666-1-1-1.414-1s-.748.334-1.414 1Z" mask="url(#SVG8dJ0oeeE)"/><path fill="currentColor" d="m12.5 7.5l3-2l3 3l-2 3z"/></g>',
  },
  trash: {
    width: 24,
    height: 24,
    body: '<path fill="none" stroke="currentColor" stroke-linecap="round" d="M9.5 14.5v-3m5 3v-3M3 6.5h18c-1.404 0-2.107 0-2.611.337a2 2 0 0 0-.552.552C17.5 7.893 17.5 8.596 17.5 10v5.5c0 1.886 0 2.828-.586 3.414s-1.528.586-3.414.586h-3c-1.886 0-2.828 0-3.414-.586S6.5 17.386 6.5 15.5V10c0-1.404 0-2.107-.337-2.611a2 2 0 0 0-.552-.552C5.107 6.5 4.404 6.5 3 6.5Zm6.5-3s.5-1 2.5-1s2.5 1 2.5 1"/>',
  },
};
