import { LoaderCircle, X } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type PropsWithChildren, type ReactNode } from 'react';

/** Nút bấm dùng chung, hỗ trợ kiểu hiển thị và trạng thái đang tải. */
export function Button({ className = '', variant = 'primary', loading, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  return <button className={`btn btn-${variant} ${className}`} disabled={loading || props.disabled} {...props}>{loading && <LoaderCircle size={16} className="animate-spin" />}{children}</button>;
}
/** Ô nhập liệu dùng chung (hỗ trợ ref cho react-hook-form). */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...props }, ref) { return <input ref={ref} className={`input ${className}`} {...props} />; });
/** Nhãn nhỏ có màu theo tông. */
export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'brand' | 'coral' | 'success' }>) { return <span className={`badge badge-${tone}`}>{children}</span>; }
/** Khung nội dung có nền và bo góc. */
export function Card({ children, className = '', ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) { return <div className={`surface ${className}`} {...props}>{children}</div>; }
/** Trạng thái trống: biểu tượng, tiêu đề và mô tả. */
export function Empty({ icon, title, body }: { icon?: ReactNode; title: string; body: string }) { return <div className="empty">{icon}<h3>{title}</h3><p>{body}</p></div>; }
/** Tiêu đề trang kèm mô tả và nút hành động. */
export function PageHeader({ eyebrow, title, body, action }: { eyebrow?: string; title: string; body?: string; action?: ReactNode }) { return <header className="page-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{body && <p>{body}</p>}</div>{action}</header>; }
/** Hộp thoại nổi; đóng khi bấm nền hoặc nhấn Esc. */
export function Modal({ open, onClose, title, children, wide = false }: PropsWithChildren<{ open: boolean; onClose: () => void; title: string; wide?: boolean }>) { if (!open) return null; return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={20}/></button></div>{children}</section></div>; }
/** Khối giữ chỗ trong lúc tải dữ liệu. */
export function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton ${className}`} />; }
