import { Bell, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationEvent, readNotifications } from '../utils/notifications';
import '../styles/notifications.css';

/** Nút chuông và danh sách thông báo của tài khoản. */
export function NotificationCenter({ account }: { account: string }) {
  const [items, setItems] = useState(() => readNotifications(account));
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    /** Đọc lại danh sách thông báo từ localStorage. */
    const refresh = () => setItems(readNotifications(account));
    window.addEventListener(notificationEvent, refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(notificationEvent, refresh); window.removeEventListener('storage', refresh); };
  }, [account]);
  useEffect(() => {
    if (!open) return;
    /** Đóng danh sách khi bấm ra ngoài. */
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    /** Đóng danh sách khi nhấn Esc và trả focus về nút chuông. */
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className="notification-center" ref={root}>
    <button ref={trigger} type="button" className="icon-btn notification-trigger" aria-label={`Thông báo đã bỏ qua (${items.length})`} aria-expanded={open} aria-controls="notification-history" onClick={() => setOpen(value => !value)}><Bell size={19}/>{items.length > 0 && <span className="notification-count">{items.length > 99 ? '99+' : items.length}</span>}</button>
    {open && <section id="notification-history" className="notification-panel" aria-label="Thông báo đã bỏ qua">
      <header><strong>Thông báo đã bỏ qua</strong><button type="button" className="icon-btn" aria-label="Đóng thông báo" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={17}/></button></header>
      {items.length ? <ul>{items.map(item => <li key={item.id}><strong>{item.title}</strong><p>{item.message}</p><time dateTime={new Date(item.time).toISOString()}>{new Date(item.time).toLocaleString('vi-VN')}</time><Link to="/study" onClick={() => setOpen(false)}>Mở trang ôn tập →</Link></li>)}</ul> : <p className="notification-empty">Chưa có thông báo nào được bỏ qua.</p>}
      <footer>Lưu tối đa 100 thông báo gần nhất trên trình duyệt này.</footer>
    </section>}
  </div>;
}
