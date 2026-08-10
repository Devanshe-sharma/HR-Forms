import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeId?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
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

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    if (!storedToken || !storedUser) {
      setIsLoading(false);
      return;
    }

    applyAuthHeader(storedToken);
    setToken(storedToken);
    try {
      setUser(JSON.parse(storedUser));
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

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    const { token: newToken, user: newUser } = res.data;
    persistSession(newToken, newUser);
    applyAuthHeader(newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    clearSession();
    applyAuthHeader(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!user && !!token, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
