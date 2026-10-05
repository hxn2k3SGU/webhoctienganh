import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/** Màn hình chờ trong lúc khôi phục phiên đăng nhập. */
export function AuthBootstrap() {
  return <div className="auth-bootstrap" role="status"><span className="logo-mark">L</span><div className="auth-loader"/><p>Đang mở không gian học...</p></div>;
}

/** Chỉ cho vào khi đã đăng nhập; nếu chưa thì chuyển tới trang đăng nhập. */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <AuthBootstrap/>;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }}/>;
  return <Outlet/>;
}

/** Chỉ cho vào khi chưa đăng nhập (trang đăng nhập/đăng ký); đã đăng nhập thì về trang chủ. */
export function PublicOnlyRoute() {
  const { status } = useAuth();
  if (status === 'loading') return <AuthBootstrap/>;
  if (status === 'authenticated') return <Navigate to="/" replace/>;
  return <Outlet/>;
}
