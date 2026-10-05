import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Grid2X2, Rocket, Trophy, Heart, Maximize, Minimize, Volume2, VolumeX, Play, Settings2 } from 'lucide-react';
import { api } from '../api/client';
import { Button } from '../components/ui';
import { arcadeQuestions, availableShapes, canPlace, placeShape, type ArcadeQuestion, type Shape } from '../utils/arcade';
import { normalizeQuizAnswer } from '../utils/quiz';
import { playFeedback } from '../utils/feedbackAudio';
import '../styles/arcade.css';
import { useStudyView } from '../hooks/useStudyView';

/** Trò chơi arcade (Khối hộp hoặc Blast) kết hợp trả lời câu hỏi từ vựng có giới hạn thời gian. */
export function ArcadePage({game}: {game:'blocks'|'blast'}) {
  const isBlast = game === 'blast', title = isBlast ? 'Blast' : 'Khối hộp';
  const decks = useQuery({queryKey:['decks'],queryFn:api.decks});
  const settings = useQuery({queryKey:['settings'],queryFn:api.settings});
  const [deck,setDeck] = useState(''), [count,setCount] = useState(10), [difficulty,setDifficulty] = useState('normal');
  const [reverse,setReverse] = useState(false), [sound,setSound] = useState(true);
  const [phase,setPhase] = useState<'setup'|'loading'|'play'|'done'>('setup');
  const [questions,setQuestions] = useState<ArcadeQuestion[]>([]), [index,setIndex] = useState(0);
  const [score,setScore] = useState(0), [streak,setStreak] = useState(0), [lives,setLives] = useState(3);
  const [time,setTime] = useState(0), [answer,setAnswer] = useState(''), [feedback,setFeedback] = useState('');
  const [error,setError] = useState(''), [reason,setReason] = useState('');
  const [board,setBoard] = useState<number[]>(Array(64).fill(0));
  const [piece,setPiece] = useState<Shape|null>(null), [hover,setHover] = useState<number|null>(null);
  const [hit,setHit] = useState<{answer:string;correct:boolean}|null>(null);
  const [expanded,setExpanded] = useState(false);
  const root = useRef<HTMLDivElement>(null), deadline = useRef(0), locked = useRef(false), request = useRef(0);
  const native = useRef(false), startRef = useRef<()=>void>(()=>{});
  const question = questions[index];
  const [studySession, setStudySession] = useState<string>();
  useStudyView(game, phase === 'play' ? studySession : undefined, question?.vocabularyId);
  const duration = (difficulty==='easy'?120:difficulty==='hard'?45:75);
  useEffect(()=>()=>{ request.current++; },[]);
  useEffect(()=>{
    /** Đồng bộ trạng thái toàn màn hình khi trình duyệt vào/thoát fullscreen. */
    const change=()=>{if(document.fullscreenElement===root.current){native.current=true;setExpanded(true)}else if(native.current){native.current=false;setExpanded(false)}};
    document.addEventListener('fullscreenchange',change);
    return()=>document.removeEventListener('fullscreenchange',change);
  },[]);
  useEffect(()=>{
    if(!expanded)return;
    const old=document.body.style.overflow;document.body.style.overflow='hidden';
    /** Thoát chế độ phóng to khi nhấn Esc. */
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.fullscreenElement)setExpanded(false)};
    window.addEventListener('keydown',escape);
    return()=>{document.body.style.overflow=old;window.removeEventListener('keydown',escape)};
  },[expanded]);
  /** Bật/tắt chế độ toàn màn hình cho khu vực chơi. */
  async function fullscreen(){
    if(expanded){if(document.fullscreenElement===root.current){try{await document.exitFullscreen()}catch{return}}setExpanded(false)}
    else {setExpanded(true);try{await root.current?.requestFullscreen?.()}catch{/* The viewport layout remains available. */}}
  }
  useEffect(()=>{
    if(phase!=='play'||!isBlast)return;
    /** Cập nhật đồng hồ đếm ngược và kết thúc ván khi hết giờ. */
    const tick=()=>{const left=Math.max(0,(deadline.current-Date.now())/1000);setTime(left);if(left<=0){locked.current=true;setReason('Hết giờ!');setPhase('done')}};
    tick();const timer=window.setInterval(tick,100);return()=>window.clearInterval(timer);
  },[phase,isBlast]);
  useEffect(()=>{
    if(!hit)return;
    const timer=window.setTimeout(()=>{
      setHit(null);
      if(phase!=='play')return;
      if(lives<=0){setReason('Hết lá chắn!');setPhase('done');return}
      if(index+1>=questions.length){setReason('Hoàn thành nhiệm vụ!');setPhase('done');return}
      setIndex(value=>value+1);locked.current=false;
    },650);
    return()=>window.clearTimeout(timer);
  },[hit,phase,lives,index,questions.length]);
  useEffect(()=>{
    if(phase!=='done')return;
    /** Nhấn Enter để bắt đầu hoặc chơi lại. */
    const enter=(event:KeyboardEvent)=>{if(event.key==='Enter'&&!event.repeat&&!event.isComposing&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();startRef.current()}};
    window.addEventListener('keydown',enter);return()=>window.removeEventListener('keydown',enter);
  },[phase]);
  /** Tải từ vựng theo deck và bắt đầu ván mới. */
  async function start(){
    if(phase==='loading')return;
    const id=++request.current;setPhase('loading');setError('');setHit(null);setFeedback('');
    try{
      const queue=await api.studyQueue('random',100,deck);
      if(id!==request.current)return;
      const next=arcadeQuestions(queue.cards,count,isBlast?reverse:true);
      if(!next.length||isBlast&&next.some(q=>q.options.length<2))throw new Error(isBlast?'Cần ít nhất 2 từ có đáp án khác nhau. Hãy chọn bộ khác hoặc thêm từ.':'Bộ này chưa có từ để chơi.');
      setStudySession(queue.sessionId ?? crypto.randomUUID());
      setQuestions(next);setIndex(0);setScore(0);setStreak(0);setLives(difficulty==='easy'?5:3);setBoard(Array(64).fill(0));setPiece(null);setHover(null);setAnswer('');setReason('');
      setTime(duration);deadline.current=Date.now()+duration*1000;locked.current=false;setPhase('play');
    }catch(cause){if(id===request.current){setError(cause instanceof Error?cause.message:'Chưa tải được dữ liệu.');setPhase('setup')}}
  }
  startRef.current=()=>void start();
  /** Xử lý lựa chọn đáp án trong chế độ Blast. */
  function shoot(choice:string){
    if(locked.current||phase!=='play'||Date.now()>=deadline.current)return;
    locked.current=true;
    const correct=choice===question.answer;
    setHit({answer:choice,correct});playFeedback(correct,sound&&settings.data?.soundEffects!==false,settings.data?.soundEffectsVolume);
    if(correct){setScore(value=>value+100+Math.min(streak,5)*20);setStreak(value=>value+1);setFeedback('Trúng đích! +'+(100+Math.min(streak,5)*20)+' điểm')}
    else{setLives(value=>value-1);setStreak(0);setFeedback(`Chưa đúng. Đáp án: ${question.answer}`)}
  }
  /** Kiểm tra từ người dùng gõ; trả lời đúng sẽ nhận khối để đặt lên bàn. */
  function checkWord(){
    if(!answer.trim()||piece||phase!=='play'||locked.current)return;
    const correct=normalizeQuizAnswer(answer)===normalizeQuizAnswer(question.answer);
    playFeedback(correct,sound&&settings.data?.soundEffects!==false,settings.data?.soundEffectsVolume);
    if(!correct){setStreak(0);setFeedback('Chưa đúng. Thử lại nhé!');return}
    const choices=availableShapes(board).filter(shape=>difficulty==='easy'?shape.length<=2:difficulty==='hard'?shape.length>=2:true);
    if(!choices.length){setReason('Không còn chỗ đặt khối!');setPhase('done');return}
    setScore(value=>value+100);setStreak(value=>value+1);setPiece(choices[Math.floor(Math.random()*choices.length)]);setFeedback('Chính xác! Chọn một ô trên bàn để đặt khối.');
  }
  /** Đặt khối lên bàn tại ô được chọn và cộng điểm. */
  function place(anchor:number){
    if(!piece||phase!=='play')return;
    const result=placeShape(board,piece,anchor,index%4+1);
    if(!result){setFeedback('Khối chưa vừa vị trí này. Chọn ô khác nhé.');return}
    setBoard(result.board);setScore(value=>value+piece.length*10+result.lines*200);setPiece(null);setAnswer('');setHover(null);
    setFeedback(result.lines?`Tuyệt! Dọn ${result.lines} hàng/cột, +${result.lines*200} điểm!`:'Đã đặt khối. Giải từ tiếp theo!');
    if(index+1>=questions.length){setReason('Hoàn thành nhiệm vụ!');setPhase('done')}
    else if(!availableShapes(result.board).some(shape=>difficulty!=='hard'||shape.length>=2)){setReason('Không còn chỗ đặt khối!');setPhase('done')}
    else setIndex(value=>value+1);
  }
  const preview=piece&&hover!==null?piece.map(([r,c])=>(Math.floor(hover/8)+r)*8+hover%8+c):[];
  return <div ref={root} className={`arcade-page arcade-${game} ${expanded?'arcade-expanded':''}`}>
    <header className="arcade-toolbar"><Link to="/games">← Danh mục</Link><strong>{isBlast?<Rocket size={20}/>:<Grid2X2 size={20}/>} {title}</strong><div><button aria-label={sound?'Tắt âm thanh':'Bật âm thanh'} onClick={()=>setSound(!sound)}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button><button aria-label={expanded?'Thoát toàn màn hình':'Toàn màn hình'} onClick={()=>void fullscreen()}>{expanded?<Minimize size={19}/>:<Maximize size={19}/>}</button></div></header>
    {phase==='setup'||phase==='loading'?<section className="arcade-setup"><div className="arcade-setup-copy"><span className="arcade-eyebrow">{isBlast?'02 / SPACE MISSION':'01 / BLOCK STUDIO'}</span>{isBlast?<Rocket size={72}/>:<Grid2X2 size={72}/>}<h1>{isBlast?'Ngắm chuẩn. Bắn nhanh.':'Xếp khối. Mở trí nhớ.'}</h1><p>{isBlast?'Chọn thiên thạch mang đáp án đúng. Mỗi câu đúng nối dài chuỗi điểm; mỗi lần sai mất một lá chắn.':'Nhìn nghĩa, gõ từ tiếng Anh để nhận khối. Chọn ô làm góc trên trái để đặt khối. Lấp đầy hàng hoặc cột để dọn bàn.'}</p><div className="arcade-rule-chips"><span>{isBlast?'100 điểm / câu đúng':'100 điểm / từ đúng'}</span><span>{isBlast?'Chuỗi đúng tăng điểm':'200 điểm / hàng hoặc cột'}</span></div></div><form className="arcade-settings" onSubmit={event=>{event.preventDefault();void start()}}><h2><Settings2 size={20}/> Cài đặt {title}</h2><fieldset disabled={phase==='loading'}><label>Bộ từ vựng<select value={deck} onChange={event=>setDeck(event.target.value)}><option value="">Tất cả các bộ</option>{decks.data?.map(item=><option key={item.name}>{item.name}</option>)}</select></label><label>Số câu hỏi<select value={count} onChange={event=>setCount(Number(event.target.value))}>{[10,20,30,50].map(n=><option key={n} value={n}>{n} câu</option>)}</select></label><label>Độ khó<select value={difficulty} onChange={event=>setDifficulty(event.target.value)}><option value="easy">Dễ{isBlast?' · 120 giây · 5 lá chắn':''}</option><option value="normal">Vừa{isBlast?' · 75 giây · 3 lá chắn':''}</option><option value="hard">Khó{isBlast?' · 45 giây · 3 lá chắn':' · Khối từ 2 ô'}</option></select></label>{isBlast&&<label>Hướng câu hỏi<select value={String(reverse)} onChange={event=>setReverse(event.target.value==='true')}><option value="false">Tiếng Anh → Nghĩa tiếng Việt</option><option value="true">Nghĩa tiếng Việt → Tiếng Anh</option></select></label>}<p className="arcade-setting-note">Nếu bộ có ít từ hơn, ván chơi dùng số từ hiện có.</p><Button type="submit"><Play size={18}/>{phase==='loading'?'Đang chuẩn bị...':'Bắt đầu chơi'}</Button></fieldset>{error&&<p role="alert">{error}</p>}{decks.isError&&<p role="alert">Chưa tải được bộ từ. <button type="button" onClick={()=>void decks.refetch()}>Thử lại</button></p>}</form></section>:<>
      <div className="arcade-hud"><span><Trophy size={18}/> Điểm <b>{score}</b></span><span>Câu <b>{Math.min(index+1,questions.length)} / {questions.length}</b></span><span>Chuỗi <b>×{streak}</b></span>{isBlast&&<><span><Heart size={18}/> <b>{lives}</b></span><span className={time<10?'arcade-time-low':''}>Còn <b>{Math.ceil(time)}s</b></span></>}</div>
      {phase==='done'?<section className="arcade-result"><Trophy size={64}/><span className="arcade-eyebrow">KẾT THÚC VÁN CHƠI</span><h1>{reason}</h1><strong>{score.toLocaleString('vi-VN')}</strong><p>điểm tích lũy trong ván này</p><Button onClick={()=>void start()}>Chơi ván mới (Enter)</Button><Button variant="secondary" onClick={()=>setPhase('setup')}>Đổi cài đặt</Button></section>:isBlast?<section className="blast-play"><div className="blast-question"><span>TÌM ĐÁP ÁN CHO</span><h1>{question.prompt}</h1><progress aria-label="Thời gian còn lại" value={time} max={duration}/></div><div className="blast-space"><div className="blast-targets">{question.options.map((option,i)=><button className={`blast-asteroid asteroid-${i} ${hit?.answer===option?(hit.correct?'blast-hit':'blast-miss'):''}`} key={`${index}:${option}`} disabled={!!hit} onClick={()=>shoot(option)}><span>{String.fromCharCode(65+i)}</span><strong>{option}</strong></button>)}</div><div className={`blast-ship ${hit?.correct?'is-firing':''}`} aria-hidden="true"><Rocket size={58}/></div></div><p role="status" className="arcade-feedback">{feedback||'Chọn thiên thạch có nghĩa đúng để khai hỏa.'}</p></section>:<section className="blocks-play"><div className="blocks-question"><span className="arcade-eyebrow">GIẢI TỪ ĐỂ NHẬN KHỐI</span><h2>{question.prompt}</h2><form onSubmit={event=>{event.preventDefault();checkWord()}}><label className="arcade-answer-label">Từ tiếng Anh<input value={answer} readOnly={!!piece} onChange={event=>setAnswer(event.target.value)} placeholder="Nhập từ tiếng Anh..." autoComplete="off"/></label><Button disabled={!!piece||!answer.trim()} type="submit">Kiểm tra</Button></form>{piece&&<div className="blocks-piece"><span>KHỐI CỦA BẠN</span><div className="piece-preview">{Array.from({length:9},(_,i)=><i key={i} className={piece.some(([r,c])=>r===Math.floor(i/3)&&c===i%3)?`block-color-${index%4+1}`:''}/>)}</div></div>}<p role="status" className="arcade-feedback">{feedback||'Mỗi từ đúng mở một khối mới.'}</p></div><div className="blocks-board" aria-label="Bàn xếp khối 8 nhân 8" onMouseLeave={()=>setHover(null)}>{board.map((cell,i)=><button key={i} aria-label={`Hàng ${Math.floor(i/8)+1}, cột ${i%8+1}${cell?', đã có khối':''}`} disabled={!piece} onFocus={()=>setHover(i)} onMouseEnter={()=>setHover(i)} onClick={()=>place(i)} className={`${cell?`block-color-${cell}`:''} ${preview.includes(i)?(piece&&hover!==null&&canPlace(board,piece,hover)?'block-preview':'block-invalid'):''}`}/>)}</div></section>}
      {phase==='play'&&<button className="arcade-leave" onClick={()=>{locked.current=true;setHit(null);setPhase('setup')}}>Kết thúc ván · Đổi cài đặt</button>}
    </>}
  </div>;
}
