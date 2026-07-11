/**
 * Gateway URL is configured in CODE (not shown to the user). Dev build → localhost; a production
 * build (`wxt build`, e.g. the committed release/) → the hosted gateway. Change here to repoint.
 */
export const GATEWAY_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://api.flashcard.io.vn';
