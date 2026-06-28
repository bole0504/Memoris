import type { Source } from '@memoris/shared';

/**
 * Phase 0 content script: detect a text selection on any page and log it.
 *
 * Exit criterion (docs/ROADMAP.md Phase 0): "extension loads in Chrome and logs a selection."
 * Phase 1 replaces the console.log with a Shadow-DOM popover + a call to the AI gateway.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const MIN_LEN = 2;

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

    function onSelection(): void {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      if (text.length < MIN_LEN) return;

      const source = describeSource();
      // Phase 0: just prove capture works. The shape mirrors a future Encounter.
      console.info('[Memoris] selection captured', {
        selection: text,
        source,
        capturedAt: new Date().toISOString(),
      });
    }

    // mouseup catches drag-selection; selectionchange is debounced to avoid log spam.
    let t: ReturnType<typeof setTimeout> | undefined;
    document.addEventListener('mouseup', onSelection);
    document.addEventListener('selectionchange', () => {
      if (t) clearTimeout(t);
      t = setTimeout(onSelection, 400);
    });

    console.info('[Memoris] content script loaded on', location.host);
  },
});
