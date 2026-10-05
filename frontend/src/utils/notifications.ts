export type SavedNotification = { id: string; title: string; message: string; time: number };
export const notificationEvent = 'lexiloop-notifications';
/** Khóa localStorage lưu thông báo của từng tài khoản. */
export const notificationKey = (account: string) => `lexiloop:notifications:${account}`;
const memory = new Map<string, SavedNotification[]>();

/** Đọc danh sách thông báo đã lưu; trả mảng rỗng nếu dữ liệu lỗi. */
export function readNotifications(account: string): SavedNotification[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(notificationKey(account)) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SavedNotification => !!item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.message === 'string' && Number.isFinite(item.time)).slice(0, 100);
  } catch { return memory.get(account) ?? []; }
}

/** Lưu thông báo nhắc ôn tập khi người dùng tắt lời nhắc. */
export function saveDismissedReminder(account: string, count: number) {
  const items = [{ id: crypto.randomUUID(), title: 'Bạn có từ cần phải ôn', message: `${count} từ đã đến hạn tại thời điểm thông báo. Ôn lại một chút để nhớ lâu hơn nhé!`, time: Date.now() }, ...readNotifications(account)].slice(0, 100);
  memory.set(account, items);
  try { localStorage.setItem(notificationKey(account), JSON.stringify(items)); } catch { /* Retain history in memory when browser storage is unavailable. */ }
  window.dispatchEvent(new Event(notificationEvent));
}
