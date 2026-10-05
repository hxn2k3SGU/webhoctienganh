import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Gamepad2, Maximize, Minimize, Play, RotateCcw, Trophy, Zap, Timer, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Button, Card } from '../components/ui';
import { matchingCards, type MatchingCard } from '../utils/matchingGame';
import { playFeedback } from '../utils/feedbackAudio';
import '../styles/games.css';
import { useStudyViews } from '../hooks/useStudyView';

/**
 * Trò chơi ghép cặp từ–nghĩa và lật thẻ trí nhớ.
 * @param initialMode Chế độ mở đầu: `match` (ghép cặp) hoặc `memory` (trí nhớ).
 */
export function GamesPage({ initialMode = 'match' }: { initialMode?: 'match' | 'memory' }) {
  const gameRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const nativeFullscreen = useRef(false);
  useEffect(() => {
    /** Đồng bộ trạng thái toàn màn hình khi trình duyệt vào/thoát fullscreen. */
    const changed = () => {
      if (document.fullscreenElement === gameRef.current) {
        nativeFullscreen.current = true; setFullscreen(true);
      } else if (nativeFullscreen.current) {
        nativeFullscreen.current = false; setFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    /** Thoát chế độ phóng to khi nhấn Esc. */
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) setFullscreen(false);
    };
    window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', escape); };
  }, [fullscreen]);
  /** Bật/tắt chế độ toàn màn hình cho khu vực chơi. */
  async function toggleFullscreen() {
    if (fullscreen) {
      if (document.fullscreenElement === gameRef.current) {
        try { await document.exitFullscreen(); } catch { return; }
      }
      setFullscreen(false);
      return;
    }
    // Keep an immersive layout on browsers without the Fullscreen API.
    setFullscreen(true);
    try { await gameRef.current?.requestFullscreen?.(); } catch { /* Use the viewport layout. */ }
  }
  const decks = useQuery({ queryKey: ['decks'], queryFn: api.decks });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const [mode, setMode] = useState<'match' | 'memory'>(initialMode);
  const penalty = useRef(0);
  const [deck, setDeck] = useState(''), [count, setCount] = useState(6);
  const [cards, setCards] = useState<MatchingCard[]>([]);
  const [studySession, setStudySession] = useState<string>();
  const [seenWords, setSeenWords] = useState<string[]>([]);
  useStudyViews(mode, studySession, mode === 'match' ? cards.map(card => card.pairId) : seenWords);
  const [open, setOpen] = useState<string[]>([]), [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0), [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [message, setMessage] = useState('Lật hai thẻ để tìm một cặp từ và nghĩa.');
  const requestId = useRef(0), busy = useRef(false);
  const startedAt = useRef(0);
  const complete = cards.length > 0 && matched.length === cards.length / 2;
  const startRef = useRef<() => void>(() => {});

  useEffect(() => () => { requestId.current++; }, []);
  useEffect(() => {
    if (!cards.length || complete || loading) return;
    const timer = window.setInterval(() => setSeconds((Date.now() - startedAt.current) / 1000 + penalty.current), 100);
    return () => window.clearInterval(timer);
  }, [cards, complete, loading]);
  useEffect(() => {
    if (open.length !== 2) return;
    const timer = window.setTimeout(() => {
      setOpen([]); setMessage(mode === 'match' ? 'Chọn từ và nghĩa tương ứng để ghép cặp.' : 'Thử lại nhé! Ghi nhớ vị trí hai thẻ vừa lật.');
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [open, mode]);
  useEffect(() => {
    if (!complete) return;
    /** Nhấn Enter để bắt đầu hoặc chơi lại. */
    const enter = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
      event.preventDefault(); startRef.current();
    };
    window.addEventListener('keydown', enter);
    return () => window.removeEventListener('keydown', enter);
  }, [complete]);

  /** Tải từ vựng và tạo ván chơi mới. */
  async function start() {
    if (busy.current) return;
    busy.current = true;
    const id = ++requestId.current;
    penalty.current = 0;
    setStudySession(undefined); setSeenWords([]);
    setLoading(true); setError(''); setCards([]); setOpen([]); setMatched([]); setMoves(0); setSeconds(0);
    try {
      const queue = await api.studyQueue('random', 100, deck);
      if (id !== requestId.current) return;
      const next = matchingCards(queue.cards, count);
      if (next.length < 4) { setError('Cần ít nhất 2 từ có nghĩa khác nhau để chơi. Hãy thêm từ hoặc chọn bộ khác.'); return; }
      setCards(next); setStudySession(queue.sessionId ?? crypto.randomUUID()); startedAt.current = Date.now();
      setMessage(`Tìm ${next.length / 2} cặp từ và nghĩa. Chọn hai thẻ để bắt đầu!`);
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : 'Chưa tải được từ vựng. Hãy thử lại.');
    } finally {
      if (id === requestId.current) { setLoading(false); busy.current = false; }
    }
  }
  startRef.current = () => { void start(); };

  /** Lật một thẻ; kiểm tra cặp khi đã lật hai thẻ. */
  function flip(card: MatchingCard) {
    if (loading || complete || open.length === 2 || matched.includes(card.pairId)) return;
    setSeenWords(current => current.includes(card.pairId) ? current : [...current, card.pairId]);
    if (open.includes(card.id)) { setOpen([]); return; }
    if (!open.length) { setOpen([card.id]); setMessage('Chọn thêm một thẻ để ghép cặp.'); return; }
    const first = cards.find(item => item.id === open[0])!;
    const correct = first.pairId === card.pairId;
    setMoves(value => value + 1);
    playFeedback(correct, settings.data?.soundEffects === true, settings.data?.soundEffectsVolume);
    if (correct) {
      setMatched(value => [...value, card.pairId]); setOpen([]);
      setSeconds((Date.now() - startedAt.current) / 1000 + penalty.current);
      setMessage('Đúng cặp rồi! Tiếp tục nhé.');
    } else {
      if (mode === 'match') { penalty.current += 1; setSeconds((Date.now() - startedAt.current) / 1000 + penalty.current); }
      setOpen([first.id, card.id]); setMessage(mode === 'match' ? 'Chưa đúng! +1 giây. Hãy thử cặp khác.' : 'Chưa khớp. Hai thẻ sẽ được úp lại.');
    }
  }

  return <div ref={gameRef} className={`page games-page ${cards.length ? 'game-in-session' : 'game-lobby'} ${complete ? 'game-won' : ''} ${fullscreen ? 'games-fullscreen' : ''}`}>
    <Link to="/games" className="game-catalog-back">← Danh mục trò chơi</Link>
    <div className="matching-screen-bar"><span><Gamepad2 size={20}/> Tìm cặp từ & nghĩa</span><Button variant="secondary" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize size={16}/> : <Maximize size={16}/>}{fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}</Button></div>
    {!cards.length && <section className="game-hero"><div className="game-hero-copy"><span className="game-kicker"><span/> LEXILO ARCADE / 01</span><h1>Ghép từ.<br/><em>Bứt tốc.</em></h1><p>Một bàn thẻ. Một cuộc đua với chính mình.<br/>Ghép đúng từng cặp và chinh phục thời gian của bạn.</p><div className="game-tags"><span><Zap size={14}/> Phản xạ</span><span><Target size={14}/> Ghi nhớ</span><span><Timer size={14}/> Tính giờ</span></div></div><div className="game-preview" aria-hidden="true"><div className="game-orbit"/><div className="game-demo-card game-demo-word"><small>EN / WORD</small><strong>spark</strong><Zap size={28}/></div><div className="game-demo-card game-demo-meaning"><small>VI / NGHĨA</small><strong>tia sáng</strong><span><Check size={16}/> ĐÚNG CẶP!</span></div><span className="game-preview-caption">TÌM ĐÚNG CẶP · PHÁ KỶ LỤC CỦA BẠN</span></div></section>}
    {!cards.length && <div className="game-setup-heading"><span>01 — THIẾT LẬP VÁN CHƠI</span><small>Chọn thử thách của bạn</small></div>}
    <div className="matching-controls">
      <label>Cách chơi<select className="input" value={mode} disabled={loading || (!!cards.length && !complete)} onChange={event => setMode(event.target.value as 'match' | 'memory')}><option value="match">Ghép nhanh (Match)</option><option value="memory">Lật thẻ ghi nhớ</option></select></label>
      <label>Bộ từ vựng<select className="input" value={deck} disabled={loading || (!!cards.length && !complete)} onChange={event => setDeck(event.target.value)}><option value="">Tất cả các bộ</option>{decks.data?.map(item => <option key={item.name} value={item.name}>{item.name} ({item.count} từ)</option>)}</select></label>
      <label>Số cặp<select className="input" value={count} disabled={loading || (!!cards.length && !complete)} onChange={event => setCount(Number(event.target.value))}>{[4, 6, 8].map(value => <option key={value} value={value}>{value} cặp · {value * 2} thẻ</option>)}</select></label>
      <Button className="game-start" disabled={loading} onClick={() => void start()}>{cards.length ? <RotateCcw size={18}/> : <Play size={18}/>} {loading ? 'Đang chia thẻ...' : cards.length ? 'Ván mới' : 'Bắt đầu chơi'}</Button>
      {!!cards.length && !complete && <Button variant="ghost" onClick={() => { setCards([]); setOpen([]); }}>Đổi bộ từ</Button>}
    </div>
    {!cards.length && !loading && <div className="game-rules"><span><b>01</b>{mode === 'match' ? 'Chọn một thẻ từ' : 'Lật một thẻ bất kỳ'}</span><span><b>02</b>Tìm thẻ nghĩa tương ứng</span><span><b>03</b>{mode === 'match' ? 'Ghép sai +1 giây. Đúng thì biến mất!' : 'Nhớ vị trí, mở hết các cặp!'}</span></div>}
    {decks.isError && <p role="alert">Chưa tải được danh sách bộ từ. <button onClick={() => void decks.refetch()}>Thử lại</button></p>}
    {error && <Card className="matching-error"><p role="alert">{error}</p><Link to="/vocabulary">Mở kho từ vựng</Link></Card>}
    {loading && <p role="status">Đang xáo trộn từ vựng cho ván mới...</p>}
    {!!cards.length && <>
      <div className="matching-stats"><span><Target size={18}/> Đã ghép <b>{matched.length}<small> / {cards.length / 2}</small></b></span><span><Zap size={18}/> Lượt ghép <b>{moves}</b></span><span className="game-clock"><Timer size={18}/> Thời gian <b>{seconds.toFixed(1)}<small> giây</small></b></span></div>
      <progress className="matching-progress" aria-label="Tiến độ ghép cặp" value={matched.length} max={cards.length / 2}/>
      {complete ? <Card className="matching-complete"><div className="game-trophy"><Trophy size={40}/></div><span className="game-kicker">THỬ THÁCH HOÀN THÀNH</span><h2>Đã tìm đủ các cặp!</h2><div className="matching-final-time">{seconds.toFixed(1)}<small> giây</small></div><p>Bạn hoàn thành {matched.length} cặp trong {moves} lượt lật.</p><Button onClick={() => void start()}><Play size={18}/>Chơi ván mới (Enter)</Button></Card> : <p className={`matching-message ${open.length === 2 ? 'game-feedback-wrong' : ''}`} role="status">{message}</p>}
      <div className={`matching-grid ${mode === 'match' ? 'matching-quick' : ''}`} aria-label="Bàn ghép thẻ">{cards.map((card, index) => {
        const found = matched.includes(card.pairId), visible = mode === 'match' || found || open.includes(card.id);
        return <button key={card.id} type="button" className={`matching-card ${visible ? 'is-open' : ''} ${found ? 'is-matched' : ''} ${open.includes(card.id) ? 'is-selected' : ''} ${open.length === 2 && open.includes(card.id) ? 'is-wrong' : ''}`} disabled={found || open.length === 2} aria-hidden={mode === 'match' && found ? true : undefined} onClick={() => flip(card)} aria-label={visible ? `${card.kind === 'word' ? 'Từ' : 'Nghĩa'}: ${card.text}${found ? ', đã ghép' : ''}` : `Lật thẻ ${index + 1}`} aria-pressed={open.includes(card.id)}>
          {visible ? <><span className="matching-card-label">{card.kind === 'word' ? 'EN / TỪ' : 'VI / NGHĨA'}{found && <Check size={16}/>}</span><strong>{card.text}</strong></> : <><span className="matching-card-number">{String(index + 1).padStart(2, '0')}</span><Gamepad2 size={28}/><span>Lật thẻ</span></>}
        </button>;
      })}</div>
    </>}
  </div>;
}
