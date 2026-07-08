import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';

// Simple, direct check: if there's no jwtToken (set by Login.tsx after a
// real backend authentication), send them to the login page. If there is
// one, let them through. No cross-domain assumptions, no signed-link
// scheme — just the one thing that was actually asked for.
export default function ProtectedRoute() {
  const token = localStorage.getItem('jwtToken');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}