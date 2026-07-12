/**
 * Gateway URL is configured in CODE (not shown to the user). Dev build → localhost; a production
 * build (`wxt build`, e.g. the committed release/) → the hosted gateway. Change here to repoint.
 */
export const GATEWAY_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://api.flashcard.io.vn';

/** Public privacy policy URL (shown in the consent screen + store listing). */
export const PRIVACY_URL = 'https://api.flashcard.io.vn/privacy';

/**
 * Google OAuth Web client id (public — safe in the client). Empty = Google sign-in hidden, dev
 * email login used. Fill after creating the OAuth client (see docs/SECURITY.md → Google OAuth).
 */
export const GOOGLE_CLIENT_ID = '';
