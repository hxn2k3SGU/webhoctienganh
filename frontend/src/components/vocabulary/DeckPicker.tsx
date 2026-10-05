import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '../../api/client';
import { Button, Input } from '../ui';

/** Chọn deck có sẵn hoặc nhập tên deck mới. */
export function DeckPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [decks, setDecks] = useState<{ name: string; count: number }[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    api.decks().then(items => { if (active) setDecks(items); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  return <div className="span-2"><label htmlFor="word-deck">Bộ flashcard</label><div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
    {creating ? <Input id="word-deck" value={value} maxLength={100} required autoFocus placeholder="Tên bộ mới" onChange={event => onChange(event.target.value)}/> : <select id="word-deck" className="input" value={value} onChange={event => onChange(event.target.value)}><option value="">Chưa phân bộ</option>{value && !decks.some(deck => deck.name === value) && <option value={value}>{value}</option>}{decks.map(deck => <option key={deck.name} value={deck.name}>{deck.name} ({deck.count} từ)</option>)}</select>}
    <Button type="button" variant="secondary" title={creating ? 'Hủy tạo bộ' : 'Tạo bộ mới'} aria-label={creating ? 'Hủy tạo bộ' : 'Tạo bộ mới'} onClick={() => { setCreating(!creating); onChange(''); }}>{creating ? <X size={18}/> : <Plus size={18}/>}</Button>
    </div>{error && <div role="alert">Không tải được danh sách bộ. <button type="button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></div>}</div>;
}
