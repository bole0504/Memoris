import { createRoot, type Root } from 'react-dom/client';
import type { Source } from '@memoris/shared';
import { getSettings } from '../../lib/storage.js';
import { Popover } from './Popover.js';
import './style.css';

/**
 * Phase 1 capture surface: on a text selection, show a Shadow-DOM popover (host-page CSS can't
 * break it — docs/ARCHITECTURE.md §7) with translation + gloss + worth-remembering units.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const MIN_LEN = 2;
    let ui: Awaited<ReturnType<typeof createShadowRootUi>> | undefined;

    function describeSource(): Source {
      const url = new URL(location.href);
      return {
        id: crypto.randomUUID(),
        app: url.hostname.replace(/^www\./, ''),
        domain: url.hostname,
        url: location.href,
        title: document.title || undefined,
      };
    }

    function surroundingContext(range: Range): string | undefined {
      const node = range.startContainer.parentElement;
      const text = node?.textContent?.replace(/\s+/g, ' ').trim();
      if (!text) return undefined;
      return text.length > 280 ? text.slice(0, 280) + '…' : text;
    }

    async function dismiss() {
      ui?.remove();
      ui = undefined;
    }

    async function onMouseUp() {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!sel || text.length < MIN_LEN || sel.rangeCount === 0) return;

      const settings = await getSettings();
      const source = describeSource();
      // Per-domain privacy: skip cloud entirely on opted-out domains (Phase 2 deepens this).
      if (settings.privateDomains.includes(source.domain)) return;

      const range = sel.getRangeAt(0);
      const r = range.getBoundingClientRect();
      const rect = { top: r.top, left: r.left, bottom: r.bottom };
      const context = surroundingContext(range);

      await dismiss();
      ui = await createShadowRootUi(ctx, {
        name: 'memoris-popover',
        position: 'overlay',
        anchor: 'body',
        onMount: (container): Root => {
          const root = createRoot(container);
          root.render(
            <Popover
              selection={text}
              context={context}
              source={source}
              rect={rect}
              onClose={() => void dismiss()}
            />,
          );
          return root;
        },
        onRemove: (root) => root?.unmount(),
      });
      ui.mount();
    }

    document.addEventListener('mouseup', () => void onMouseUp());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') void dismiss();
    });

    console.info('[Memoris] capture surface ready on', location.host);
  },
});
