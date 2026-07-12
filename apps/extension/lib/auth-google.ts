import { ext } from './ext.js';
import { GATEWAY_URL, GOOGLE_CLIENT_ID } from './config.js';
import { setAuth } from './storage.js';
import { uuid } from './uuid.js';

/** Is Google sign-in available (client id compiled in + identity API present)? */
export function googleConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID && !!ext.identity;
}

/**
 * Sign in with Google via chrome.identity: open Google's consent, get an ID token, and exchange it
 * at the gateway for our own JWT. The Google OAuth client must list this extension's redirect URL
 * (`ext.identity.getRedirectURL()`) — see docs/SECURITY.md.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!ext.identity) throw new Error('identity API unavailable');
  const redirectUri = ext.identity.getRedirectURL();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: 'id_token',
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    nonce: uuid(),
    prompt: 'select_account',
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const resultUrl = await ext.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
  if (!resultUrl) throw new Error('sign-in cancelled');

  const fragment = resultUrl.split('#')[1] ?? '';
  const idToken = new URLSearchParams(fragment).get('id_token');
  if (!idToken) throw new Error('no id_token returned');

  const res = await fetch(`${GATEWAY_URL}/v1/auth/google`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error(`gateway rejected Google sign-in (${res.status})`);
  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
    user: { email: string };
  };
  await setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken, email: data.user.email });
}
