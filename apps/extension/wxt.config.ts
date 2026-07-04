import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// WXT — Manifest V3 framework. See https://wxt.dev
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Memoris',
    description: 'Your second brain for working in a second language.',
    // storage + unlimitedStorage so the IndexedDB brain resists eviction (Nấc 0 durability).
    permissions: ['storage', 'activeTab', 'unlimitedStorage'],
    host_permissions: ['<all_urls>'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
