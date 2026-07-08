import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// This page exists so that an external site (like operations.briskolive.com)
// can link here with just a plain, unsigned ?email=... — this page does the
// actual signing server-side via generate-access-link, then redirects to the
// real, properly-signed /company-orientation URL that ProtectedRoute will
// accept. This is the ONE entry point that must stay public (not wrapped in
// ProtectedRoute) — everything after this redirect is fully protected as
// before.
export default function Bridge() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const email = searchParams.get('email');

    if (!email) {
      setStatus('error');
      setErrorMsg('No email provided.');
      return;
    }

    axios
      .get(`${API_BASE}/onboarding/generate-access-link`, { params: { email } })
      .then((res) => {
        if (res.data?.success && res.data.link) {
          window.location.href = res.data.link;
        } else {
          setStatus('error');
          setErrorMsg(res.data?.message || 'Could not generate access link.');
        }
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err?.response?.data?.message || 'Could not verify this employee.');
      });
  }, [searchParams]);

  if (status === 'error') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
        textAlign: 'center', fontFamily: 'sans-serif',
      }}>
        <h2 style={{ color: '#dc2626', margin: 0 }}>Access Not Granted</h2>
        <p style={{ color: '#6b7280', maxWidth: 420, margin: 0 }}>{errorMsg}</p>
        <a
          href="https://operations.briskolive.com/"
          style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
        >
          Return to Operations Portal
        </a>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'sans-serif', color: '#6b7280',
    }}>
      Verifying access…
    </div>
  );
}