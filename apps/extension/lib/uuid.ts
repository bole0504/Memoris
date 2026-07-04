/**
 * UUID that also works in NON-secure contexts. Content scripts run in the page's context, and
 * `crypto.randomUUID()` is only defined on secure (https) origins — on an http page it's undefined
 * and throws, crashing the content script. This falls back to a Math.random-based v4 there.
 */
export function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
