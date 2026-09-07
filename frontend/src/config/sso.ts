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
