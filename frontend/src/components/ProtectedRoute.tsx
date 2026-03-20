import React from 'react';
import { Outlet } from 'react-router-dom';

function ProtectedRoute() {
  // Temporarily allow everyone
  return <Outlet />;
}

export default ProtectedRoute;