/**
 * Heuristic: does a selection look like a secret we should NOT send to the cloud?
 * Conservative — the popover blocks-with-override, so a rare false positive is recoverable.
 */
const PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // PEM private keys
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/, // OpenAI / Stripe / OpenRouter style keys
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bAIza[0-9A-Za-z_-]{35}\b/, // Google API key
  /\bghp_[A-Za-z0-9]{20,}\b/, // GitHub token
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, // Slack token
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/, // JWT
  /(password|passwd|pwd|secret|api[_-]?key|token|authorization)\s*[:=]\s*\S+/i, // assignments
  /\b(?:\d[ -]?){13,19}\b/, // card-like long digit run
  /\b[0-9a-f]{32,}\b/i, // long hex (hashes / keys)
];

export function looksLikeSecret(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return false;
  return PATTERNS.some((re) => re.test(t));
}
