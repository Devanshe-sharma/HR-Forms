import React, { useEffect, useState } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

// Cached in sessionStorage so internal navigation (clicking sidebar links,
// which won't carry the original ?name=&email= query string) doesn't force
// a re-check on every single click — only a fresh link with those params,
// or a new browser tab/session, triggers re-verification.
const SESSION_KEY = 'verifiedEmployee';

interface VerifiedEmployee {
  name: string;
  officialEmail: string;
  dept: string;
  designation: string;
}

type Status = 'checking' | 'allowed' | 'denied';

function ProtectedRoute() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const urlEmail = searchParams.get('email');

    // A fresh link with ?email=... always re-verifies against Onboarding,
    // even if a session was already cached — this is the actual source of
    // truth check, not just a formality.
    if (urlEmail) {
      axios
        .get(`${API_BASE}/onboarding/verify-access`, { params: { email: urlEmail } })
        .then((res) => {
          if (res.data?.allowed) {
            const verified: VerifiedEmployee = res.data.employee;
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(verified));
            setStatus('allowed');
          } else {
            sessionStorage.removeItem(SESSION_KEY);
            setStatus('denied');
          }
        })
        .catch(() => {
          sessionStorage.removeItem(SESSION_KEY);
          setStatus('denied');
        });
      return;
    }

    // No fresh params on this navigation (e.g. clicked a sidebar link) —
    // fall back to whatever was verified earlier this browser session.
    const cached = sessionStorage.getItem(SESSION_KEY);
    setStatus(cached ? 'allowed' : 'denied');
  }, [searchParams]);

  useEffect(() => {
    if (status === 'denied') {
      // This is a different domain entirely, so a full browser navigation
      // is required here — React Router's navigate() only handles routes
      // within this same app.
      window.location.href = 'https://operations.briskolive.com/';
    }
  }, [status]);

  if (status === 'checking') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
        Verifying access…
      </div>
    );
  }

  if (status === 'denied') {
    // The redirect effect above handles denied access — render nothing in the meantime.
    return null;
  }

  return <Outlet />;
}

export default ProtectedRoute;