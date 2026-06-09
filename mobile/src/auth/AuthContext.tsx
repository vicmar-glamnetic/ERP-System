import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { apiClient, setUnauthorizedHandler } from '../api/client';
import * as storage from '../utils/storage';
import { User, AuthState } from '../types';

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN'; payload: { user: User; access_token: string } }
  | { type: 'LOGOUT' };

interface AuthContextValue {
  state: AuthState;
  login: (employeeCode: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

const initialState: AuthState = {
  user: null,
  access_token: null,
  isLoading: true,
  isAuthenticated: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOGIN':
      return {
        ...state,
        user: action.payload.user,
        access_token: action.payload.access_token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    default:
      return state;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    setUnauthorizedHandler(() => dispatch({ type: 'LOGOUT' }));
  }, []);

  const login = useCallback(async (employee_code: string, password: string) => {
    const loginRes = await apiClient.post('/auth/login', { employee_code, password });
    const { access_token, refresh_token } = loginRes.data.data;

    await storage.saveTokens(access_token, refresh_token);

    const meRes = await apiClient.get('/auth/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user: User = meRes.data.data;
    await storage.saveUser(user);

    dispatch({ type: 'LOGIN', payload: { user, access_token } });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (_) {
      // ignore
    }
    await storage.clearAll();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const token = await storage.getAccessToken();
      if (!token) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      const meRes = await apiClient.get('/auth/me');
      const user: User = meRes.data.data;
      await storage.saveUser(user);
      dispatch({ type: 'LOGIN', payload: { user, access_token: token } });
    } catch (_) {
      await storage.clearAll();
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, logout, restoreSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
