import { createRoot, type Root } from 'react-dom/client';
import type { Source } from '@memoris/shared';
import { getSettings } from '../../lib/storage.js';
import { uuid } from '../../lib/uuid.js';
import { CaptureWidget } from './CaptureWidget.js';
import './style.css';

/**
 * Capture surface: on a text selection, show a small Memoris icon (Shadow DOM, host CSS can't break
 * it). Clicking the icon opens the popover and calls the gateway. Clicking outside / Esc closes it
 * (and aborts any in-flight request).
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
        id: uuid(),
        app: url.hostname.replace(/^www\./, ''),
        domain: url.hostname,
        url: location.href,
        title: document.title || undefined,
      };
    }

    function surroundingContext(range: Range): string | undefined {
      const text = range.startContainer.parentElement?.textContent?.replace(/\s+/g, ' ').trim();
      if (!text) return undefined;
      return text.length > 280 ? text.slice(0, 280) + '…' : text;
    }

    function dismiss() {
      ui?.remove();
      ui = undefined;
    }

    /** Did this event happen inside our own widget? Then don't treat it as page interaction. */
    function insideWidget(target: EventTarget | null): boolean {
      return !!ui && !!ui.shadowHost && ui.shadowHost.contains(target as Node);
    }

    async function onMouseUp(e: MouseEvent) {
      if (insideWidget(e.target)) return; // clicking our icon/popover — ignore

      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!sel || text.length < MIN_LEN || sel.rangeCount === 0) return;

      const settings = await getSettings();
      const source = describeSource();
      if (settings.privateDomains.includes(source.domain)) return; // privacy: never leave the page

      const range = sel.getRangeAt(0);
      const r = range.getBoundingClientRect();
      const rect = { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
      const context = surroundingContext(range);

      dismiss();
      ui = await createShadowRootUi(ctx, {
        name: 'memoris-widget',
        position: 'overlay',
        anchor: 'body',
        onMount: (container): Root => {
          const root = createRoot(container);
          root.render(
            <CaptureWidget
              selection={text}
              context={context}
              source={source}
              rect={rect}
              onClose={dismiss}
            />,
          );
          return root;
        },
        onRemove: (root) => root?.unmount(),
      });
      ui.mount();
    }

    document.addEventListener('mouseup', (e) => void onMouseUp(e));
    document.addEventListener('mousedown', (e) => {
      if (ui && !insideWidget(e.target)) dismiss(); // click outside → close + cancel
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dismiss();
    });

    console.info('[Memoris] capture surface ready on', location.host);
  },
});
