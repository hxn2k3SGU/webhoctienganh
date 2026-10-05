import { Eye, EyeOff, Moon, Sparkles, Sun } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui';
import { useTheme } from '../hooks/useTheme';
import '../styles/auth.css';

/** Trang đăng nhập và đăng ký tài khoản. */
export function LoginPage() {
  const { login, register, setupRequired, connectionError, retryConnection } = useAuth();
  const { resolved, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isSetup = location.pathname === '/register';

  /** Kiểm tra tên đăng nhập/mật khẩu rồi gửi yêu cầu đăng nhập hoặc đăng ký. */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    if (!/^[A-Za-z0-9._-]{3,64}$/.test(username.trim())) {
      setError('Tên đăng nhập cần 3–64 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
      return;
    }
    if (password.length > 256 || (isSetup && password.length < 12)) {
      setError('Mật khẩu cần từ 12 đến 256 ký tự.');
      return;
    }
    if (isSetup && password !== confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    setLoading(true);
    try {
      if (isSetup) await register(username.trim(), password);
      else await login(username.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from?.startsWith('/') && !from.startsWith('//') ? from : '/study', { replace: true });
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) setError('Tên đăng nhập hoặc mật khẩu chưa đúng.');
      else if (reason instanceof ApiError && reason.status === 409) setError('Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.');
      else if (reason instanceof ApiError && reason.status === 400) setError('Tên đăng nhập cần ít nhất 3 ký tự và mật khẩu cần ít nhất 12 ký tự.');
      else if (reason instanceof ApiError && reason.status === 429) setError('Bạn đã thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.');
      else setError(isSetup ? 'Không thể thiết lập lúc này. Vui lòng thử lại.' : 'Không thể đăng nhập lúc này. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return <main className="login-page">
    <section className="login-story" aria-label="Lexilo">
      <div className="login-brand"><span className="logo-mark">L</span><span>lexilo<small>language studio</small></span></div>
      <div className="login-copy"><span className="eyebrow">YOUR DAILY LANGUAGE RITUAL</span><h1>Mỗi từ mới,<br/><em>một thế giới mở ra.</em></h1><p>Ghi nhớ có nhịp điệu. Tiến bộ có chủ đích. Không gian học dành riêng cho bạn.</p></div>
      <div className="login-word"><Sparkles size={16}/><div><small>WORD TO CARRY TODAY</small><strong>becoming</strong><span>/bɪˈkʌm.ɪŋ/ · the process of growing into yourself</span></div></div>
    </section>
    <section className="login-panel">
      <button className="theme-toggle login-theme" type="button" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} aria-label="Đổi giao diện">{resolved === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
      {connectionError ? <div className="login-form"><h2>Chưa thể kết nối</h2><p role="alert">Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.</p><Button onClick={retryConnection}>Thử lại</Button></div> : setupRequired === null ? <div className="login-loading" role="status">Đang chuẩn bị không gian học…</div> : <form className="login-form" onSubmit={submit} aria-busy={loading}>
        <span className="login-kicker">{isSetup ? 'FIRST STEP' : 'WELCOME BACK'}</span>
        <h2>{isSetup ? 'Đăng ký tài khoản' : 'Chào mừng trở lại'}</h2>
        <p>{isSetup ? 'Tạo tài khoản để bắt đầu hành trình học của riêng bạn.' : 'Đăng nhập để tiếp tục học từ vựng của bạn.'}</p>
        <label><span>Tên đăng nhập</span><input autoFocus autoComplete="username" required minLength={3} maxLength={64} pattern="[A-Za-z0-9._-]+" value={username} onChange={event => setUsername(event.target.value)} placeholder="Ví dụ: hieu"/></label>
        <label><span>Mật khẩu</span><div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={isSetup ? 'new-password' : 'current-password'} required minLength={isSetup ? 12 : undefined} value={password} onChange={event => setPassword(event.target.value)} placeholder={isSetup ? 'Ít nhất 12 ký tự' : 'Nhập mật khẩu'}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
        {isSetup && <label><span>Xác nhận mật khẩu</span><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={12} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu"/></label>}
        {isSetup && <small className="login-password-note">Dùng từ 12 ký tự; nên kết hợp chữ, số và ký hiệu.</small>}
        {error && <div className="login-error" role="alert">{error}</div>}
        <Button type="submit" loading={loading} disabled={loading}>{isSetup ? 'Tạo tài khoản' : 'Đăng nhập'}</Button>
        <p className="auth-switch">{isSetup ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}<Link to={isSetup ? '/login' : '/register'} state={location.state}>{isSetup ? 'Đăng nhập' : 'Đăng ký ngay'}</Link></p>
      </form>}
    </section>
  </main>;
}
