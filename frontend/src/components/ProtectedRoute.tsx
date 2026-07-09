import React from 'react';
import { Outlet } from 'react-router-dom';

// All login/access-verification logic removed. This just lets everyone
// through — no redirects, no checks, nothing to loop.
function ProtectedRoute() {
  return <Outlet />;
}

export default ProtectedRoute;