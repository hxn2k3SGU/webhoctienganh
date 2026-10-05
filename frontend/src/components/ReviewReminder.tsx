import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import '../styles/review-reminder.css';
import { saveDismissedReminder } from '../utils/notifications';

/** Đọc thời điểm tạm ẩn lời nhắc từ localStorage; trả 0 nếu không có. */
function readDeadline(key: string) {
  try { const value = Number(localStorage.getItem(key)); return Number.isFinite(value) ? value : 0; }
  catch { return 0; }
}

/** Lời nhắc khi có từ đến hạn ôn; cho phép nhắc lại sau hoặc tắt đến hết ngày. */
export function ReviewReminder({ account }: { account: string }) {
  const storageKey = `lexiloop:review-reminder:${account}`;
  const [until, setUntil] = useState(() => readDeadline(storageKey));
  const [now, setNow] = useState(Date.now);
  const [choosing, setChoosing] = useState(false);
  const { pathname } = useLocation();
  const summary = useQuery({ queryKey: ['review-reminder', account], queryFn: () => api.studySummary(), refetchInterval: 30_000, refetchOnWindowFocus: true });

  useEffect(() => {
    /** Đồng bộ trạng thái tạm ẩn từ localStorage. */
    const sync = () => { setUntil(readDeadline(storageKey)); setNow(Date.now()); };
    /** Cập nhật lời nhắc khi tab khác thay đổi localStorage. */
    const storage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) sync(); };
    window.addEventListener('storage', storage);
    window.addEventListener('focus', sync);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener('focus', sync); };
  }, [storageKey]);

  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = window.setTimeout(() => { setNow(Date.now()); void summary.refetch(); }, Math.min(until - Date.now(), 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [until, summary.refetch]);

  /** Tạm ẩn lời nhắc đến thời điểm cho trước. */
  const defer = (deadline: number) => {
    try { localStorage.setItem(storageKey, String(deadline)); } catch { /* Keep the reminder usable when storage is unavailable. */ }
    setUntil(deadline); setNow(Date.now()); setChoosing(false);
  };
  /** Tắt lời nhắc đến hết ngày và lưu vào danh sách thông báo. */
  const dismiss = () => {
    saveDismissedReminder(account, summary.data?.dueCount ?? 0);
    const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0); defer(tomorrow.getTime());
  };
  if (until > now || !summary.data?.dueCount || summary.isError || summary.isFetching || pathname === '/study' || pathname === '/quiz') return null;

  return <aside className="review-reminder" aria-label="Nhắc ôn từ vựng">
    <div className="review-reminder-heading" role="status"><BellRing size={22} aria-hidden="true"/><div><strong>Bạn có từ cần phải ôn</strong><p>{summary.data.dueCount} từ đã đến hạn. Ôn lại một chút để nhớ lâu hơn nhé!</p></div></div>
    <Link className="review-reminder-link" to="/study">Mở trang ôn tập →</Link>
    <div className="review-reminder-actions"><button type="button" className="btn btn-secondary" onClick={dismiss}>Bỏ qua</button><button type="button" className="btn btn-primary" aria-expanded={choosing} aria-controls="review-reminder-options" onClick={() => setChoosing(value => !value)}>Nhắc tôi sau</button></div>
    {choosing && <div id="review-reminder-options" className="review-reminder-options"><button type="button" onClick={() => defer(Date.now() + 60_000)}>Nhắc sau 1 phút</button><button type="button" onClick={() => defer(Date.now() + 15 * 60_000)}>Nhắc sau 15 phút</button></div>}
    <small>Bỏ qua sẽ ẩn lời nhắc đến hết hôm nay.</small>
  </aside>;
}
