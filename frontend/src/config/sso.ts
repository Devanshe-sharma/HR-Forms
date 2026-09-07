/**
 * Partner apps allowed to redirect here for SSO login (see pages/SsoAuthorize.tsx).
 * Without this allowlist, /sso-authorize would happily bounce a logged-in
 * user's browser to any redirect_uri an attacker crafted a link with.
 */
export const ALLOWED_SSO_REDIRECT_ORIGINS = [
  'http://3.110.162.1:3004',
  'https://renewals.briskolive.com',
  'http://localhost:3004',
];

export function isAllowedSsoRedirect(redirectUri: string): boolean {
  try {
    const origin = new URL(redirectUri).origin;
    return ALLOWED_SSO_REDIRECT_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

/**
 * Partner apps to silently sign out of whenever this app's own session ends
 * (see AuthContext.logout). Each URL is loaded in a hidden iframe on its own
 * origin, where it clears that app's session — this app's logout has no
 * other way to reach a different origin's storage.
 */
export const SSO_PARTNER_LOGOUT_URLS = [
  'http://3.110.162.1:3004/sso-logout',
  'https://renewals.briskolive.com/sso-logout',
];
