import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePageVisibility } from '../contexts/PageVisibilityContext';
import { PROFILE_GATE_ENABLED } from '../config/featureFlags';

function ProtectedRoute() {
  const { user, isAuthenticated, isLoading, profileComplete } = useAuth();
  const { canViewLocation } = usePageVisibility();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Accounts created with a shared temporary password (e.g. the onboarding
  // bulk-import) must set a real one before touching anything else.
  if (user?.mustChangePassword && location.pathname !== '/force-change-password') {
    return <Navigate to="/force-change-password" replace />;
  }

  // Required Personal Details / Emergency Contact & Family fields (see
  // utils/profileCompletion.ts) must be filled in before anything else is
  // reachable — everything but the Profile page itself bounces back there.
  // PROFILE_GATE_ENABLED stages the rollout: flipping it on doesn't take
  // effect for an already-open tab until profileComplete is (re)computed,
  // which happens on next login/app-load, so pair it with force-logout-all.
  if (PROFILE_GATE_ENABLED && !profileComplete && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  if (location.pathname !== '/profile' && !canViewLocation(location.pathname, location.search)) {
    return <Navigate to="/profile" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
