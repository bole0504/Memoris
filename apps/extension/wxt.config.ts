import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// WXT — Manifest V3 framework. See https://wxt.dev
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Memoris',
    description: 'Your second brain for working in a second language.',
    // Phase 0: only what we need to read a selection on any page.
    permissions: ['storage', 'activeTab'],
    host_permissions: ['<all_urls>'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
