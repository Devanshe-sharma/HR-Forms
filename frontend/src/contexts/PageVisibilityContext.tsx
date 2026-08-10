import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { VISIBILITY_ROLES, VisibilityRole, matchPageKeyForPath } from '../config/pageVisibility';

const API_URL = process.env.REACT_APP_API_URL || '/api';

type VisibilityMap = Record<string, boolean>;
type Settings = Record<VisibilityRole, VisibilityMap>;

interface PageVisibilityContextType {
  canViewKey: (key: string) => boolean;
  canViewPath: (pathname: string) => boolean;
  loading: boolean;
}

const PageVisibilityContext = createContext<PageVisibilityContextType | undefined>(undefined);

export const usePageVisibility = () => {
  const context = useContext(PageVisibilityContext);
  if (context === undefined) {
    throw new Error('usePageVisibility must be used within a PageVisibilityProvider');
  }
  return context;
};

function isVisibilityRole(role: string | undefined): role is VisibilityRole {
  return !!role && (VISIBILITY_ROLES as readonly string[]).includes(role);
}

interface PageVisibilityProviderProps {
  children: ReactNode;
}

export const PageVisibilityProvider: React.FC<PageVisibilityProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !isVisibilityRole(user?.role)) {
      setSettings(null);
      return;
    }

    setLoading(true);
    axios
      .get(`${API_URL}/rbac/page-visibility`)
      .then((res) => setSettings(res.data?.data || null))
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, [isAuthenticated, user?.role]);

  const canViewKey = (key: string): boolean => {
    if (!isVisibilityRole(user?.role)) return true;
    if (loading || !settings) return true; // fail open while loading/unavailable
    const roleSettings = settings[user.role];
    if (!roleSettings || !(key in roleSettings)) return true;
    return roleSettings[key] !== false;
  };

  const canViewPath = (pathname: string): boolean => {
    const key = matchPageKeyForPath(pathname);
    if (!key) return true; // pages not in the configurable list are always allowed
    return canViewKey(key);
  };

  return (
    <PageVisibilityContext.Provider value={{ canViewKey, canViewPath, loading }}>
      {children}
    </PageVisibilityContext.Provider>
  );
};
