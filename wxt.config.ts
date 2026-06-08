import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'Timezone & Language Switcher',
    description: 'Spoof timezone and language per domain with fuzzy matching',
    permissions: [
      'declarativeNetRequest',
      'storage',
      ...(browser === 'firefox' ? [] : ['scripting']),
    ],
    host_permissions: ['<all_urls>'],
  }),
});
