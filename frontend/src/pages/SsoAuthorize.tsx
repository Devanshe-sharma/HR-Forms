import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { isAllowedSsoRedirect } from '../config/sso';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// Public entry point a partner app (e.g. the renewals/admin portal) sends
// the browser to when it needs to know "is this person already logged
// into HR-Forms?". If yes, we silently mint a one-time code and bounce
// back to redirect_uri with it — no second login. If not, the normal
// login form runs first (state carries this page + its query string as
// the post-login destination), then the same thing happens.
export default function SsoAuthorize() {
  const [searchParams] = useSearchParams();
  const { user, token, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');

  const redirectUri = searchParams.get('redirect_uri') || '';
  const state = searchParams.get('state') || '';

  useEffect(() => {
    if (isLoading) return;

    if (!redirectUri || !isAllowedSsoRedirect(redirectUri)) {
      setError('This app is not authorized to use single sign-on with HR-Forms.');
      return;
    }

    if (!user || !token) {
      navigate('/login', {
        replace: true,
        state: { from: { pathname: location.pathname, search: location.search } },
      });
      return;
    }

    axios
      .post(`${API_BASE}/auth/sso/code`)
      .then((res) => {
        const code = res.data?.code;
        if (!code) throw new Error('No code returned');
        const url = new URL(redirectUri);
        url.searchParams.set('code', code);
        if (state) url.searchParams.set('state', state);
        window.location.href = url.toString();
      })
      .catch(() => setError('Could not complete single sign-on. Please try again.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, token]);

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
        textAlign: 'center', fontFamily: 'sans-serif',
      }}>
        <h2 style={{ color: '#dc2626', margin: 0 }}>Sign-in Failed</h2>
        <p style={{ color: '#6b7280', maxWidth: 420, margin: 0 }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'sans-serif', color: '#6b7280',
    }}>
      Signing you in…
    </div>
  );
}
