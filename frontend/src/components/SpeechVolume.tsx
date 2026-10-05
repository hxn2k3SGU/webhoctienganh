import { Volume2 } from 'lucide-react';
import { useState } from 'react';
import { speak } from '../utils/speech';

/** Thanh chỉnh âm lượng phát âm, kèm nút nghe thử. */
export function SpeechVolume({ volume, onChange }: { volume: number; onChange: (value: number) => void }) {
  const [error, setError] = useState('');
  return <div style={{ padding: '16px 0', display: 'grid', gap: 12 }}>
    <label htmlFor="speech-volume" style={{ padding: 0, display: 'flex', justifyContent: 'space-between', gap: 12 }}><strong>Âm lượng giọng đọc</strong><output htmlFor="speech-volume">{volume}%</output></label>
    <input id="speech-volume" type="range" min={0} max={100} step={1} value={volume} onChange={event => onChange(Number(event.target.value))} style={{ width: '100%', accentColor: 'rgb(var(--brand))' }}/>
    <div><button type="button" className="btn btn-secondary" disabled={volume === 0} onClick={() => { setError(''); void speak('Hello! Let us learn English together.', undefined, volume).catch(() => setError('Chưa phát được giọng đọc. Vui lòng thử lại.')); }}><Volume2 size={16}/> Nghe thử giọng đọc</button></div>
    {error && <p role="alert">{error}</p>}
  </div>;
}
