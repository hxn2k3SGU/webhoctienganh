import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { api, ApiError, refreshSession, setCsrfToken, setUnauthorizedHandler } from '../api/client';
import type { AuthResponse, AuthUser } from '../types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  setupRequired: boolean | null;
  connectionError: boolean;
  retryConnection: () => void;
  setup: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
/** Lấy thời điểm hết hạn access token (epoch ms) từ dữ liệu phiên. */
const expiryOf = (session: AuthResponse) => session.accessTokenExpiresAt ? Date.parse(session.accessTokenExpiresAt) : null;

/**
 * Cung cấp trạng thái đăng nhập cho toàn ứng dụng.
 * Khôi phục phiên khi tải trang và tự refresh access token khoảng 1 phút trước khi hết hạn.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [accessExpiresAt, setAccessExpiresAt] = useState<number | null>(null);
  /** Thử kết nối lại server khi không khôi phục được phiên. */
  const retryConnection = useCallback(() => setAttempt(value => value + 1), []);

  /** Xóa phiên trên giao diện và toàn bộ dữ liệu đã cache. */
  const clearSession = useCallback(() => {
    setCsrfToken(null);
    setAccessExpiresAt(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    let active = true;
    setConnectionError(false);
    setStatus('loading');
    Promise.all([api.session().catch(error => {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      return null;
    }), api.setupStatus()]).then(([session, setup]) => {
      if (!active) return;
      setSetupRequired(setup.setupRequired);
      if (session) {
        setCsrfToken(session.csrfToken);
        setAccessExpiresAt(expiryOf(session));
        setUser(session.user);
        setStatus('authenticated');
      } else {
        clearSession();
      }
    }).catch(error => {
      if (active) {
        console.error('Không thể khôi phục phiên đăng nhập', error);
        setSetupRequired(null);
        setConnectionError(true);
        clearSession();
      }
    });
    return () => { active = false; setUnauthorizedHandler(null); };
  }, [clearSession, attempt]);

  useEffect(() => {
    if (status !== 'authenticated' || !accessExpiresAt) return;
    const timer = window.setTimeout(() => {
      void refreshSession().then(session => session ? setAccessExpiresAt(expiryOf(session)) : clearSession());
    }, Math.max(accessExpiresAt - Date.now() - 60_000, 5_000));
    return () => window.clearTimeout(timer);
  }, [status, accessExpiresAt, clearSession]);

  /** Lưu phiên vừa nhận từ server (người dùng, CSRF token, hạn access token). */
  const applySession = useCallback((session: AuthResponse) => {
    setCsrfToken(session.csrfToken);
    setAccessExpiresAt(expiryOf(session));
    setUser(session.user);
    setStatus('authenticated');
    setSetupRequired(false);
  }, []);

  /** Tạo tài khoản đầu tiên rồi đăng nhập. */
  const setup = useCallback(async (username: string, password: string) => {
    applySession(await api.setup(username, password));
  }, [applySession]);

  /** Đăng nhập rồi lưu phiên. */
  const login = useCallback(async (username: string, password: string) => {
    applySession(await api.login(username, password));
  }, [applySession]);
  /** Đăng ký rồi tự đăng nhập. */
  const register = useCallback(async (username: string, password: string) => {
    applySession(await api.register(username, password));
  }, [applySession]);

  /**
   * Đăng xuất và xóa phiên.
   * @param allDevices `true` để đăng xuất khỏi mọi thiết bị.
   */
  const logout = useCallback(async (allDevices = false) => {
    await (allDevices ? api.logoutAll() : api.logout());
    clearSession();
  }, [clearSession]);

  /** Gom các giá trị và hàm của context, chỉ tạo lại khi có thay đổi. */
  const value = useMemo(() => ({ user, status, setupRequired, connectionError, retryConnection, setup, register, login, logout }), [user, status, setupRequired, connectionError, retryConnection, setup, register, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook truy cập trạng thái đăng nhập; phải dùng bên trong `AuthProvider`. */
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
