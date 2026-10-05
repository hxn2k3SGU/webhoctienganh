import { Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { speak } from '../../utils/speech';

/** Hiển thị từ cần hỏi (hoặc nút nghe với quiz nghe) và tự phát âm một lần. */
export function MeaningPrompt({ word, audioUrl, listening = false }: { word: string; audioUrl?: string; listening?: boolean }) {
  const started = useRef(false);
  const [error, setError] = useState(false);
  /** Phát lại âm thanh của từ. */
  const replay = () => {
    setError(false);
    void speak(word, audioUrl).catch(() => setError(true));
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void speak(word, audioUrl).catch(() => setError(true));
  }, [word, audioUrl]);
  return <div>
    {listening ? <button type="button" className="listen-big" onClick={replay} aria-label="Phát lại từ cần đoán"><Volume2 size={30}/><span>Nhấn để nghe lại</span></button> : <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <h1 style={{ minWidth: 0, overflowWrap: 'anywhere', flex: 1 }}>{word}</h1>
      <button type="button" className="icon-btn" onClick={replay} title="Nghe lại từ tiếng Anh" aria-label={`Phát âm ${word}`} style={{ width: 44, height: 44, flexShrink: 0 }}><Volume2 size={24}/></button>
    </div>}
    {error && <p role="status">Chưa phát được âm thanh. Bấm loa để thử lại.</p>}
  </div>;
}
