import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { SSO_PARTNER_LOGOUT_URLS } from '../config/sso';
import { isProfileComplete } from '../utils/profileCompletion';

const API_URL = process.env.REACT_APP_API_URL || '/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeId?: string | null;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Whether Onboarding's required Personal Details / Emergency Contact &
  // Family fields (see utils/profileCompletion.ts) are all filled in. `true`
  // until this is actually known (no account yet, or the check hasn't run)
  // so nothing is blocked before there's a definite answer either way —
  // ProtectedRoute is the enforcement point, gated behind PROFILE_GATE_ENABLED.
  profileComplete: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshProfileCompletion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function applyAuthHeader(token: string | null) {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
}

function persistSession(token: string, user: AuthUser) {
  localStorage.setItem('authToken', token);
  localStorage.setItem('authUser', JSON.stringify(user));
  // Keep the pre-existing localStorage 'role' key in sync — frontend/src/config/rbac.ts
  // and a number of scattered localStorage.getItem('role') reads rely on it.
  localStorage.setItem('role', user.role);
}

function clearSession() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
  localStorage.removeItem('role');
}

// Logging out here should also end the session on any SSO partner app —
// each one's own storage lives on its own origin, so the only way in is to
// load its /sso-logout page and let it clear itself. This uses a small,
// off-screen popup rather than a hidden iframe: an iframe is a subresource
// of this (HTTPS) page, so browsers block it as mixed content when the
// partner app is still plain HTTP — a popup is its own top-level browsing
// context and isn't subject to that restriction (same reason the SSO login
// redirect already works fine across HTTP/HTTPS).
function signOutOfPartnerApps() {
  for (const url of SSO_PARTNER_LOGOUT_URLS) {
    const popup = window.open(url, '_blank', 'width=100,height=100,left=-1000,top=-1000');
    if (popup) setTimeout(() => popup.close(), 3000);
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(true);

  // Checks the same Onboarding record Profile.tsx edits, against the same
  // required-fields rule (utils/profileCompletion.ts) it validates against.
  // Best-effort: any failure (no linked record, request error) leaves
  // profileComplete at its current/default value rather than blocking on it.
  const checkProfileCompletion = async (email: string) => {
    try {
      const res = await axios.get(`${API_URL}/onboarding/by-email`, { params: { email } });
      if (res.data?.success) setProfileComplete(isProfileComplete(res.data.data));
    } catch {
      // no onboarding record yet, or not reachable — leave as-is
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    if (!storedToken || !storedUser) {
      setIsLoading(false);
      return;
    }

    applyAuthHeader(storedToken);
    setToken(storedToken);
    let parsedUser: AuthUser | null = null;
    try {
      parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    } catch {
      clearSession();
    }

    // Confirm the token is still valid (not expired / user not deactivated)
    // in the background; drop the session silently if it no longer is.
    axios
      .get(`${API_URL}/auth/me`)
      .then(res => {
        const freshUser = res.data?.user;
        if (freshUser) {
          setUser(freshUser);
          localStorage.setItem('authUser', JSON.stringify(freshUser));
          localStorage.setItem('role', freshUser.role);
          return checkProfileCompletion(freshUser.email);
        }
      })
      .catch(() => {
        clearSession();
        applyAuthHeader(null);
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // If a request comes back 401 while a session is active, that session is
  // dead — either the token expired, or it was force-invalidated server-side
  // (POST /api/auth/force-logout-all bumps tokenVersion; see
  // backend-node/middleware/authenticate.js). Drop it via React state only
  // (no hard window navigation) so ProtectedRoute's own <Navigate to="/login">
  // picks it up on next render — same clean redirect a manual logout gets,
  // instead of whatever page they were on just silently failing.
  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      err => {
        if (err?.response?.status === 401) {
          clearSession();
          applyAuthHeader(null);
          setToken(null);
          setUser(null);
          setProfileComplete(true);
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    const { token: newToken, user: newUser } = res.data;
    persistSession(newToken, newUser);
    applyAuthHeader(newToken);
    setToken(newToken);
    setUser(newUser);
    await checkProfileCompletion(newUser.email);
    return newUser;
  };

  const logout = () => {
    clearSession();
    applyAuthHeader(null);
    setToken(null);
    setUser(null);
    setProfileComplete(true);
    signOutOfPartnerApps();
  };

  // Re-pulls /auth/me — used right after changing a forced temporary
  // password, so the mustChangePassword flag clears without needing a
  // full re-login.
  const refreshUser = async () => {
    const res = await axios.get(`${API_URL}/auth/me`);
    const freshUser = res.data?.user;
    if (freshUser) {
      setUser(freshUser);
      localStorage.setItem('authUser', JSON.stringify(freshUser));
      localStorage.setItem('role', freshUser.role);
    }
  };

  // Re-checks profile completeness against the latest Onboarding data —
  // called by Profile.tsx after a successful save so the gate clears the
  // moment the required fields are actually filled in, with no re-login
  // needed.
  const refreshProfileCompletion = async () => {
    if (user?.email) await checkProfileCompletion(user.email);
  };

  return (
    <AuthContext.Provider
      value={{
        user, token, isAuthenticated: !!user && !!token, isLoading, profileComplete,
        login, logout, refreshUser, refreshProfileCompletion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
