import React from 'react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Temporarily allow everyone
  return <>{children}</>;
}

export default ProtectedRoute;