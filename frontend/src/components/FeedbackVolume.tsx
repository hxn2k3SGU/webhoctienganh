import { Volume2 } from 'lucide-react';
import { playFeedback } from '../utils/feedbackAudio';

/** Thanh chỉnh âm lượng âm thanh đúng/sai, kèm nút nghe thử. */
export function FeedbackVolume({ volume, enabled, onChange }: { volume: number; enabled: boolean; onChange: (value: number) => void }) {
  return <div style={{ padding: '16px 0', display: 'grid', gap: 12 }}>
    <label htmlFor="feedback-volume" style={{ padding: 0 }}><strong>Âm lượng hiệu ứng</strong><output htmlFor="feedback-volume">{volume}%</output></label>
    <input id="feedback-volume" type="range" min={0} max={100} step={1} value={volume} disabled={!enabled} onChange={event => onChange(Number(event.target.value))} style={{ width: '100%', accentColor: 'rgb(var(--brand))' }}/>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <button type="button" className="btn btn-secondary" disabled={!enabled || volume === 0} onClick={() => playFeedback(true, enabled, volume)}><Volume2 size={16}/> Nghe âm đúng</button>
      <button type="button" className="btn btn-secondary" disabled={!enabled || volume === 0} onClick={() => playFeedback(false, enabled, volume)}><Volume2 size={16}/> Nghe âm sai</button>
    </div>
  </div>;
}
