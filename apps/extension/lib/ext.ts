/**
 * Resolve the extension API object that actually exposes the members we use.
 *
 * In Chrome content scripts the WXT `browser` shim can be present but missing `.storage`
 * (`browser.storage.local` → "Cannot read properties of undefined"). The raw `chrome` global is
 * reliable there and returns promises under MV3. Prefer whichever global has both storage+runtime.
 */
type AnyApi = {
  storage: {
    local: {
      get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
    session: {
      get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
  runtime: {
    id?: string;
    sendMessage(message: unknown): Promise<unknown>;
    onMessage: {
      addListener(
        cb: (msg: unknown, sender: unknown, sendResponse: (r: unknown) => void) => boolean | void,
      ): void;
    };
  };
};

const g = globalThis as unknown as { browser?: AnyApi; chrome?: AnyApi };

export const ext: AnyApi =
  g.browser && g.browser.storage && g.browser.runtime ? g.browser : (g.chrome as AnyApi);
