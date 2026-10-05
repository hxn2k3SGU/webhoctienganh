import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

type Theme = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; resolved: 'light' | 'dark' } | null>(null);

/** Quản lý giao diện sáng/tối/theo hệ thống và lưu lựa chọn vào localStorage. */
export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('lexilo-theme') as Theme) || 'system');
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); /** Cập nhật khi hệ điều hành chuyển chế độ sáng/tối. */ const fn = () => setSystemDark(media.matches); media.addEventListener('change', fn); return () => media.removeEventListener('change', fn); }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark', resolved === 'dark'); document.documentElement.style.colorScheme = resolved; }, [resolved]);
  /** Đổi giao diện và lưu lựa chọn. */
  const setTheme = (value: Theme) => { localStorage.setItem('lexilo-theme', value); setThemeState(value); };
  /** Gom giá trị context giao diện, chỉ tạo lại khi có thay đổi. */
  const value = useMemo(() => ({ theme, setTheme, resolved }), [theme, resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
/** Hook truy cập giao diện hiện tại; phải dùng bên trong `ThemeProvider`. */
export function useTheme() { const value = useContext(ThemeContext); if (!value) throw new Error('useTheme requires ThemeProvider'); return value; }
