import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export const sortFields = [
  { key: 'word', label: 'Từ' },
  { key: 'meaning', label: 'Nghĩa' },
  { key: 'tag', label: 'Chủ đề' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'reviewCount', label: 'Đã ôn' },
];

/** Tiêu đề cột bảng từ vựng có thể bấm để sắp xếp. */
export function VocabularySortHeaders({ field, direction, onSort }: { field: string; direction: string; onSort: (field: string) => void }) {
  return <>{sortFields.map(item => {
    const active = field === item.key;
    const Icon = active ? direction === 'asc' ? ArrowUp : ArrowDown : ArrowUpDown;
    return <button type="button" className={`word-sort${active ? ' active' : ''}`} key={item.key} onClick={() => onSort(item.key)} aria-label={`${item.label}: ${active ? direction === 'asc' ? 'đang tăng dần, bấm để giảm dần' : 'đang giảm dần, bấm để tăng dần' : 'bấm để sắp xếp tăng dần'}`}><span>{item.label}</span><Icon size={13} aria-hidden="true"/></button>;
  })}</>;
}

/** Ô chọn kiểu sắp xếp (dùng trên màn hình nhỏ). */
export function VocabularySortSelect({ field, direction, onChange }: { field: string; direction: string; onChange: (field: string, direction: string) => void }) {
  return <label className="vocabulary-sort-select">Sắp xếp<select className="input" value={`${field}:${direction}`} onChange={event => { const [key, order] = event.target.value.split(':'); onChange(key, order); }}>{sortFields.flatMap(item => ['asc', 'desc'].map(order => <option key={`${item.key}:${order}`} value={`${item.key}:${order}`}>{item.label} · {order === 'asc' ? 'Tăng dần' : 'Giảm dần'}</option>))}</select></label>;
}
