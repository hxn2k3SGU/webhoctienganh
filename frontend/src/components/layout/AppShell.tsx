import { NotificationCenter } from '../NotificationCenter';
import { BarChart3, BookOpenText, BrainCircuit, ClipboardCheck, Gamepad2, Library, LoaderCircle, LogOut, Moon, Search, Settings, Sun, X } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useLayoutEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { setSpeechVolumeReader } from '../../utils/speech';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../auth/AuthProvider';
import '../../styles/account.css';
import { ReviewReminder } from '../ReviewReminder';

const links = [
  { to: '/', label: 'Tổng quan', icon: BarChart3 },
  { to: '/vocabulary', label: 'Từ vựng', icon: Library },
  { to: '/study', label: 'Ôn tập', icon: BookOpenText },
  { to: '/quiz', label: 'Quiz', icon: BrainCircuit },
  { to: '/toeic', label: 'TOEIC', icon: ClipboardCheck },
  { to: '/games', label: 'Game', icon: Gamepad2 },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
];
/** Khung giao diện chính: thanh điều hướng, ô tìm kiếm, thông báo, tài khoản và nội dung trang. */
export function AppShell() {
  const queryClient = useQueryClient();
  useLayoutEffect(() => {
    setSpeechVolumeReader(async () => {
      const settings = await queryClient.fetchQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 30000 });
      return settings.speechVolume ?? 100;
    });
    return () => setSpeechVolumeReader();
  }, [queryClient]);
  const { resolved, setTheme } = useTheme(); const navigate = useNavigate(); const [query, setQuery] = useState('');
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  /** Đăng xuất và chuyển về trang đăng nhập; báo lỗi nếu không đăng xuất được. */
  const signOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setLogoutError('Chưa thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.');
      setLoggingOut(false);
    }
  };
  /** Chuyển tới trang từ vựng với từ khóa tìm kiếm. */
  const search = (e: FormEvent) => { e.preventDefault(); if (query.trim()) navigate(`/vocabulary?q=${encodeURIComponent(query.trim())}`); };
  return <div className="app-shell">
    <aside className="sidebar">
      <NavLink to="/" className="logo"><span className="logo-mark">L</span><span>lexilo<small>language studio</small></span></NavLink>
      <nav>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-note"><span>WORD OF THE DAY</span><strong>serendipity</strong><p>/ˌser.ənˈdɪp.ə.ti/</p></div>
    </aside>
    <div className="main-wrap">
      <header className="topbar"><form className="search" onSubmit={search}><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm nhanh một từ..." aria-label="Tìm kiếm"/>{query && <button type="button" onClick={() => setQuery('')}><X size={15}/></button>}<kbd>⌘ K</kbd></form>{user && <NotificationCenter key={user.id ?? user.username} account={user.id ?? user.username}/>}<button className="theme-toggle" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} aria-label="Đổi giao diện">{resolved === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button></header>
      <div className="account-bar"><span className="account-name" title={user?.username}>{user?.username}</span><button type="button" className="account-logout" onClick={signOut} disabled={loggingOut} aria-busy={loggingOut}>{loggingOut ? <LoaderCircle size={17} className="animate-spin"/> : <LogOut size={17}/>}<span>{loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span></button></div>
      {logoutError && <p className="account-error" role="alert">{logoutError}</p>}
      <main><Outlet/></main>
      {user && <ReviewReminder key={user.id ?? user.username} account={user.id ?? user.username}/>}
    </div>
    <nav className="bottom-nav">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'}><Icon size={20}/><span>{label}</span></NavLink>)}</nav>
  </div>;
}
