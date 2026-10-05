import { Sparkles, Check, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { Button } from '../ui';
import '../../styles/image-search.css';

/** Tìm và chọn ảnh minh họa cho từ bằng AI, hiển thị nguồn và giấy phép ảnh. */
export function AiImagePicker({ word, meaning, selected, onSelect }: { word: string; meaning: string; selected: string; onSelect: (url: string) => void }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.searchImages>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => { generation.current++; setResult(null); setError(''); setBusy(false); return () => { generation.current++; }; }, [word, meaning]);
  /** Gọi API tìm ảnh; bỏ qua kết quả cũ nếu người dùng đã tìm lại. */
  const search = async () => {
    if (busy) return;
    const current = ++generation.current;
    setBusy(true); setError(''); setResult(null);
    try {
      const data = await api.searchImages(word.trim(), meaning.trim());
      if (current === generation.current) setResult(data);
    } catch (cause) {
      if (current === generation.current) setError(cause instanceof Error ? cause.message : 'Không thể tìm ảnh.');
    } finally { if (current === generation.current) setBusy(false); }
  };
  return <section className="ai-images span-2" aria-label="Ảnh gợi ý bằng AI">
    <Button type="button" variant="secondary" onClick={search} loading={busy} disabled={busy || !word.trim() || !meaning.trim()}><Sparkles size={16}/>{busy ? 'Đang tìm ảnh...' : 'Tìm ảnh bằng AI'}</Button>
    {error && <p role="alert" className="form-error">{error}</p>}
    {result && <><p className="ai-image-query">{result.images.length ? `Ảnh gợi ý: ${result.query}` : 'Chưa tìm thấy ảnh phù hợp. Bạn có thể sửa nghĩa của từ rồi tìm lại.'}</p><div className="ai-image-grid">{result.images.map(image => <article key={image.url}>
      <button type="button" className="ai-image-choice" aria-label={`Chọn ảnh ${image.title}`} aria-pressed={selected === image.url} onClick={() => onSelect(image.url)}><img src={image.url} alt={image.title} loading="lazy" onError={event => { const button = event.currentTarget.parentElement as HTMLButtonElement; button.disabled = true; }}/>{selected === image.url && <span className="ai-image-selected"><Check size={16}/> Đã chọn</span>}</button>
      <a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.license || 'Wikimedia Commons'} <ExternalLink size={12}/></a>
      <small title={image.artist}>{image.artist}</small>
    </article>)}</div></>}
  </section>;
}
