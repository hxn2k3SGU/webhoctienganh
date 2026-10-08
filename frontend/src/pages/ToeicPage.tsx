import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Clock3, ExternalLink, FileUp, Flag, Headphones, ListChecks } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toeicParts, type ToeicAttempt, type ToeicChoice, type ToeicImport, type ToeicResult } from '@lexiloop/shared';
import { toeicApi } from '../api/toeic';
import { Button, Card, PageHeader } from '../components/ui';
import '../styles/toeic.css';

const letters: ToeicChoice[] = ['A', 'B', 'C', 'D'];
const etsSample = 'https://www.ets.org/pdfs/toeic/toeic-listening-reading-sample-test.pdf';
const message = (error: unknown) => error instanceof Error ? error.message : 'Chưa thể xử lý. Vui lòng thử lại.';
export const formatToeicTime = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;

function SourceLink({ url, children }: { url: string; children: ReactNode }) {
  return <a className="toeic-source" href={url} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={15}/></a>;
}

function ListeningAudio({ attempt, now }: { attempt: ToeicAttempt; now: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState('');
  const full = attempt.mode === 'full';
  if (!attempt.listeningAudioUrl || (full && attempt.section !== 'Listening') || (!full && attempt.questions.some(q => q.audioUrl))) return null;
  const play = async () => {
    if (!audio.current) return;
    try {
      if (full) audio.current.currentTime = Math.max(0, (now - attempt.startedAt) / 1000);
      await audio.current.play(); setError('');
    } catch { setError('Chưa phát được audio. Kiểm tra kết nối rồi nhấn phát lại; đồng hồ thi vẫn tiếp tục.'); }
  };
  return <div className="toeic-audio">
    <audio ref={audio} src={attempt.listeningAudioUrl} controls={!full} preload="metadata" onError={() => setError('Không tải được audio từ nguồn đề.')} aria-label="Audio Listening"/>
    {full && <Button variant="secondary" onClick={() => void play()}><Headphones size={17}/> Phát / khôi phục audio</Button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}

function QuestionAudio({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="toeic-audio"><audio src={url} controls preload="none" aria-label="Audio câu hỏi / nhóm câu" onError={() => setFailed(true)}/>{failed && <p role="alert">Không tải được audio của câu hỏi.</p>}</div>;
}

function ScoreReport({ result, expired }: { result: ToeicResult; expired: boolean }) {
  const scaled = result.scaledScore;
  const hasTotal = scaled?.total !== null && scaled?.total !== undefined;
  return <Card className="toeic-score-report">
    <div className="toeic-score-heading"><div><span className="toeic-kicker">KẾT QUẢ {expired ? '· HẾT GIỜ' : '· ĐÃ NỘP BÀI'}</span><h2>{hasTotal ? 'Điểm TOEIC tham khảo' : 'Kết quả luyện tập'}</h2></div>
      <div className="toeic-score-total" aria-label={hasTotal ? 'Tổng điểm tham khảo' : 'Tổng số câu đúng'}><strong>{hasTotal ? scaled.total : result.correct}</strong><span> / {hasTotal ? 990 : result.total}</span></div>
    </div>
    <div className="toeic-score-stats">
      <div><span>Trả lời đúng</span><strong>{result.correct}</strong></div>
      <div><span>Trả lời sai</span><strong>{result.incorrect ?? result.total - result.correct - result.unanswered}</strong></div>
      <div><span>Bỏ trống</span><strong>{result.unanswered}</strong></div>
      <div><span>Độ chính xác</span><strong>{result.percentage}%</strong></div>
      <div><span>Thời gian làm bài</span><strong>{result.elapsedSeconds !== undefined ? formatToeicTime(result.elapsedSeconds) : '—'}</strong></div>
    </div>
    <div className="toeic-section-scores">{(['listening', 'reading'] as const).map(section => {
      const data = result[section], points = scaled?.[section];
      return <section key={section} aria-label={`Điểm ${section === 'listening' ? 'Listening' : 'Reading'}`}>
        <h3>{section === 'listening' ? 'Listening' : 'Reading'}</h3>
        <strong>{points !== null && points !== undefined ? <>{points}<small> / 495</small></> : <>{data.correct}<small> / {data.total} câu</small></>}</strong>
        <p>Trả lời đúng: {data.correct}/{data.total} câu</p>
        <progress value={data.correct} max={data.total || 1} aria-label={`Số câu đúng ${section}`}/>
      </section>;
    })}</div>
    <h3>Kết quả theo Part</h3><div className="toeic-part-results">{result.parts.map(item => <span key={item.part}>Part {item.part}<b>{item.correct}/{item.total}</b></span>)}</div>
    <p className="toeic-muted">Điểm quy đổi tham khảo theo bảng PREP, không phải điểm chứng chỉ ETS hay bảng chấm riêng của TOEIC Building. Chỉ quy đổi một kỹ năng khi bài có đủ 100 câu của kỹ năng đó; bài luyện ngắn giữ kết quả theo số câu đúng. <SourceLink url="https://prepedu.com/vi/blog/thang-diem-toeic">Xem bảng quy đổi</SourceLink></p>
  </Card>;
}

export function ToeicPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const attemptId = params.get('attempt');
  const [testId, setTestId] = useState('');
  const [part, setPart] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [questionId, setQuestionId] = useState('');
  const [filter, setFilter] = useState<'all' | 'wrong'>('all');
  const [importError, setImportError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const catalog = useQuery({ queryKey: ['toeic-catalog'], queryFn: toeicApi.catalog });
  useEffect(() => {
    if (!testId && catalog.data) setTestId((catalog.data.tests.find(test => test.kind === 'imported') ?? catalog.data.tests[0])?.id ?? '');
  }, [catalog.data, testId]);
  const history = useQuery({ queryKey: ['toeic-history'], queryFn: toeicApi.history, enabled: !attemptId });
  const current = useQuery({ queryKey: ['toeic-attempt', attemptId], queryFn: () => toeicApi.attempt(attemptId!), enabled: !!attemptId, retry: false,
    refetchInterval: query => query.state.data?.status === 'active' ? 15000 : false });
  const attempt = current.data;
  const [now, setNow] = useState(Date.now());
  const expiredBoundary = useRef<string>('');

  useEffect(() => {
    if (!attempt) return;
    const received = performance.now();
    setNow(attempt.serverNow);
    const timer = window.setInterval(() => setNow(attempt.serverNow + performance.now() - received), 500);
    return () => window.clearInterval(timer);
  }, [attempt]);
  useEffect(() => {
    if (!attempt || attempt.status !== 'active') return;
    const boundary = attempt.section === 'Listening' ? attempt.listeningEndsAt : attempt.deadlineAt;
    const key = `${attempt.id}:${boundary}`;
    if (boundary && now >= boundary && expiredBoundary.current !== key) {
      expiredBoundary.current = key;
      void current.refetch();
    }
  }, [now, attempt, current.refetch]);

  const receive = (data: ToeicAttempt) => {
    queryClient.setQueryData(['toeic-attempt', data.id], data);
    void queryClient.invalidateQueries({ queryKey: ['toeic-history'] });
  };
  const start = useMutation({ mutationFn: toeicApi.start, onSuccess: data => { receive(data); setQuestionId(''); setFilter('all'); setParams({ attempt: data.id }); } });
  const save = useMutation({ mutationFn: (input: { questionId: string; choice?: ToeicChoice | null; flagged?: boolean }) => toeicApi.save(attemptId!, input),
    onSuccess: receive, onError: () => { void current.refetch(); } });
  const submit = useMutation({ mutationFn: () => toeicApi.submit(attemptId!), onSuccess: receive, onError: () => { void current.refetch(); } });
  const imported = useMutation({ mutationFn: toeicApi.import, onSuccess: data => { setTestId(data.id); setImportError(''); void queryClient.invalidateQueries({ queryKey: ['toeic-catalog'] }); } });
  const importFile = async (file?: File) => {
    if (!file) return;
    setImportError('');
    try {
      if (file.size > 900000) throw new Error('File JSON tối đa 900 KB; audio và hình dùng đường dẫn HTTPS.');
      const document = JSON.parse(await file.text()) as ToeicImport;
      await imported.mutateAsync(document);
    } catch (error) { setImportError(message(error)); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  };
  const back = () => { setParams({}); setQuestionId(''); setFilter('all'); save.reset(); submit.reset(); };

  if (!attemptId) {
    const selected = catalog.data?.tests.find(test => test.id === testId);
    const localTests = catalog.data?.tests.filter(test => test.kind === 'imported') ?? [];
    const listeningSeconds = Math.max(2700, selected?.listeningDurationSeconds ?? 2700);
    return <div className="page toeic-page">
      <PageHeader eyebrow="TOEIC LISTENING & READING" title="Một bước gần mục tiêu." body="Luyện từng Part, ghi lại kết quả và làm quen với nhịp thi."/>
      {localTests.length ? <div className="toeic-intro"><div><span className="toeic-kicker">THƯ VIỆN ĐỀ TOEIC</span><h2>Chọn đề. Bắt đầu luyện.</h2><p>Luyện từng Part với hình và audio ngay trên web. Đáp án và giải thích xuất hiện sau khi nộp bài; tiến độ được lưu riêng theo tài khoản.</p>{selected && <SourceLink url={selected.sourceUrl}>Nguồn: {selected.sourceName}</SourceLink>}</div><div className="toeic-stat"><strong>{localTests.length}</strong><span>đề trong thư viện</span><small>{localTests.reduce((sum, test) => sum + test.questionCount, 0).toLocaleString('vi-VN')} câu hỏi · {localTests.filter(test => test.fullAvailable).length} đề thi thử đầy đủ</small></div></div> : <div className="toeic-intro"><div><span className="toeic-kicker">NGUỒN CHÍNH THỨC</span><h2>Bắt đầu từ đề mẫu IIBC / ETS</h2><p>Đọc đề, xem hình và nghe audio tại trang IIBC trong tab riêng. Chọn đáp án tại đây để chấm và lưu kết quả. Trang nguồn có phần đáp án; hãy xem sau khi nộp bài.</p><SourceLink url={etsSample}>Xem PDF mẫu chính thức ETS</SourceLink></div><div className="toeic-stat"><strong>{catalog.data?.tests[0]?.questionCount ?? '…'}</strong><span>câu mẫu · 7 Part</span><small>Bộ mẫu ngắn, không phải đề đủ 200 câu.</small></div></div>}
      {catalog.isPending && <p role="status">Đang tải danh sách đề…</p>}
      {catalog.error && <p role="alert">{message(catalog.error)} <button onClick={() => void catalog.refetch()}>Thử lại</button></p>}
      <div className="toeic-setup">
        <Card className="toeic-setup-card"><h2><ListChecks size={21}/> Luyện tập</h2>
          <label>Chọn đề<select className="input" value={testId} onChange={event => setTestId(event.target.value)}>{catalog.data?.tests.map(test => <option key={test.id} value={test.id}>{test.title}{test.kind === 'imported' ? ' · Đề nhập' : ''}</option>)}</select></label>
          <div className="toeic-form-row"><label>Phần luyện<select className="input" value={part} onChange={event => setPart(Number(event.target.value))}><option value={0}>Tất cả câu của đề</option>{toeicParts.map(item => <option key={item.part} value={item.part}>Part {item.part} · {selected?.partCounts[item.part] ?? 0} câu</option>)}</select></label><label>Thời gian<select className="input" value={minutes} onChange={event => setMinutes(Number(event.target.value))}>{[0,5,10,15,30,45,60,75,120].map(value => <option key={value} value={value}>{value ? `${value} phút` : 'Không giới hạn'}</option>)}</select></label></div>
          <Button disabled={!selected} loading={start.isPending} onClick={() => start.mutate({ testId, mode: 'practice', ...(part ? { part } : {}), ...(minutes ? { timeLimitMinutes: minutes } : {}) })}>Bắt đầu luyện <ArrowRight size={16}/></Button>
        </Card>
        <Card className="toeic-setup-card toeic-full"><h2><Clock3 size={21}/> Thi thử đầy đủ</h2><p><strong>200 câu · {Math.ceil(listeningSeconds / 60) + 75} phút</strong></p><p>Listening: 100 câu / {formatToeicTime(listeningSeconds)}.<br/>Reading: 100 câu / 75 phút.</p>{listeningSeconds > 2700 && <p>Audio nguồn dài hơn 45 phút; thời gian nghe được tính theo audio để không cắt mất câu hỏi.</p>}<p>Hết thời gian Listening sẽ chuyển sang Reading và khóa câu nghe. Hết giờ, bài được chấm với các đáp án đã lưu.</p>
          {!selected?.fullAvailable && <p className="toeic-notice">Đề đang chọn chưa đủ cấu trúc 200 câu và audio liên tục để thi thử. Bạn vẫn có thể luyện từng Part hoặc chọn một đề đầy đủ khác.</p>}
          <Button disabled={!selected?.fullAvailable || start.isPending} onClick={() => start.mutate({ testId, mode: 'full' })}>Bắt đầu thi thử</Button>
        </Card>
      </div>
      {start.error && <p role="alert" className="toeic-error">{message(start.error)}</p>}
      <div className="toeic-parts">{toeicParts.map(item => <button key={item.part} className={part === item.part ? 'selected' : ''} onClick={() => setPart(item.part)} aria-pressed={part === item.part}><span>PART {item.part} · {item.section}</span><strong>{item.title}</strong><small>{selected?.partCounts[item.part] ?? 0} câu trong đề đã chọn · {item.count} câu trong đề đầy đủ</small></button>)}</div>
      <details className="toeic-import"><summary><FileUp size={17}/> Thêm đề đủ 200 câu</summary><p>Nhập file JSON có nguồn đề, quyền sử dụng, đáp án, audio và nội dung câu hỏi. Đề nhập hiển thị đúng nguồn bạn khai báo, không tự gắn nhãn ETS chính thức.</p><a href="/toeic-import-guide.json" download>Tải hướng dẫn định dạng JSON</a><p>File hướng dẫn mô tả cấu trúc; cần bổ sung nội dung thật của đủ 200 câu trước khi nhập.</p><input ref={fileInput} type="file" accept=".json,application/json" onChange={event => void importFile(event.target.files?.[0])} disabled={imported.isPending} aria-label="Nhập đề TOEIC JSON"/>{imported.isPending && <p role="status">Đang kiểm tra và nhập đề…</p>}{importError && <p role="alert" className="toeic-error">{importError}</p>}{imported.isSuccess && !importError && <p role="status">Đã thêm đề. Bạn có thể chọn để luyện hoặc thi thử.</p>}</details>
      <section className="toeic-history"><h2>Lịch sử làm bài</h2>{history.isPending && <p>Đang tải lịch sử…</p>}{history.error && <p role="alert">{message(history.error)} <button onClick={() => void history.refetch()}>Thử lại</button></p>}{history.data?.length === 0 && <p className="toeic-muted">Lượt luyện đầu tiên của bạn sẽ xuất hiện ở đây.</p>}{history.data?.map(item => <button key={item.id} className="toeic-history-item" onClick={() => { setQuestionId(''); setFilter('all'); setParams({ attempt: item.id }); }}><span><strong>{item.title}</strong><small>{item.mode === 'full' ? 'Thi thử 200 câu' : item.part ? `Luyện Part ${item.part}` : 'Luyện toàn bộ mẫu'} · {new Date(item.startedAt).toLocaleString('vi-VN')}</small></span><b>{item.status === 'active' ? 'Tiếp tục' : item.scaledScore?.total != null ? `${item.scaledScore.total}/990 (tham kh\u1ea3o)` : `${item.correct}/${item.total}`}</b><ArrowRight size={17}/></button>)}</section>
    </div>;
  }
  if (current.isPending) return <div className="page" role="status">Đang tải bài TOEIC…</div>;
  if (!attempt || current.isError) return <div className="page"><p role="alert">{message(current.error)}</p><Button onClick={() => void current.refetch()}>Thử lại</Button><Button variant="ghost" onClick={back}>Về TOEIC</Button></div>;

  const finished = attempt.status !== 'active';
  const questions = finished && attempt.result ? attempt.result.questions.filter(q => filter === 'all' || !q.correct) : attempt.questions;
  const index = Math.max(0, questions.findIndex(q => q.id === questionId));
  const question = questions[index];
  const selected = question ? attempt.answers[question.id] : undefined;
  const reviewed = attempt.result?.questions.find(q => q.id === question?.id);
  const boundary = attempt.section === 'Listening' ? attempt.listeningEndsAt : attempt.deadlineAt;
  const remaining = boundary ? Math.max(0, Math.ceil((boundary - now) / 1000)) : null;
  const locked = finished || save.isPending || submit.isPending || remaining === 0;
  const answered = attempt.questions.filter(q => attempt.answers[q.id]).length;

  return <div className="page toeic-page toeic-session">
    <div className="toeic-session-top"><Button variant="ghost" onClick={back}><ArrowLeft size={16}/> TOEIC</Button><span>{attempt.mode === 'full' ? 'THI THỬ' : 'LUYỆN TẬP'}{attempt.part ? ` · PART ${attempt.part}` : ''}</span><div className={`toeic-clock ${remaining !== null && remaining < 60 ? 'urgent' : ''}`} role="timer" aria-label="Thời gian còn lại"><Clock3 size={17}/>{finished ? 'Đã kết thúc' : remaining === null ? 'Không giới hạn' : formatToeicTime(remaining)}</div></div>
    <h1 className="toeic-session-title">{attempt.title}</h1>
    {!finished && <p className="toeic-muted">{attempt.mode === 'full' ? `${attempt.section} · ` : ''}{answered}/{attempt.questions.length} câu đã trả lời trong phần hiện tại. Đáp án lưu sau mỗi lần chọn; đồng hồ vẫn chạy khi đóng trang.</p>}
    {finished && attempt.result && <ScoreReport result={attempt.result} expired={attempt.status === 'expired'}/>}
    {finished && <div className="toeic-review-filter"><Button variant={filter === 'all' ? 'primary' : 'secondary'} onClick={() => { setFilter('all'); setQuestionId(''); }}>Tất cả câu</Button><Button variant={filter === 'wrong' ? 'primary' : 'secondary'} onClick={() => { setFilter('wrong'); setQuestionId(''); }}>Câu sai / bỏ trống</Button></div>}
    <ListeningAudio key={`${attempt.id}:${attempt.section}`} attempt={attempt} now={now}/>
    <div className="toeic-workspace"><Card className="toeic-question">
      {!question ? <p>Không có câu sai hoặc bỏ trống trong lượt này.</p> : <>
        <div className="toeic-question-top"><span>PART {question.part} · CÂU {question.number}</span>{!finished && <button className={`toeic-flag ${attempt.flags.includes(question.id) ? 'marked' : ''}`} aria-label="Đánh dấu xem lại" aria-pressed={attempt.flags.includes(question.id)} disabled={locked} onClick={() => save.mutate({ questionId: question.id, flagged: !attempt.flags.includes(question.id) })}><Flag size={17}/> Xem lại</button>}</div>
        {question.sourceUrl && <div className="toeic-source-card"><h2>Đề gốc · câu {question.number}</h2><p>Mở trang nguồn, tìm đúng số câu rồi chọn đáp án bên dưới. Audio, hình và bài đọc nằm ở trang nguồn.</p><SourceLink url={question.sourceUrl}>Mở đề và audio gốc</SourceLink></div>}
        {question.passage && <div className="toeic-passage">{question.passage}</div>}
        {question.audioUrl && (attempt.mode === 'practice' || finished) && <QuestionAudio key={question.audioUrl} url={question.audioUrl}/>}
        {question.imageUrl && <a href={question.imageUrl} target="_blank" rel="noopener noreferrer" aria-label={`Mở hình câu ${question.number} kích thước gốc`}><img className={`toeic-photo${question.part >= 3 ? ' toeic-reading-image' : ''}`} src={question.imageUrl} alt={`Hình đề TOEIC câu ${question.number}`}/></a>}
        {question.prompt && <h2 className="toeic-prompt">{question.prompt}</h2>}
        {question.sourceWarning && <p className="toeic-notice">Lưu ý dữ liệu nguồn: {question.sourceWarning}</p>}
        {!question.prompt && !question.sourceUrl && <p>Nghe câu hỏi và các lựa chọn trong audio.</p>}
        <div className="toeic-options" role="group" aria-label={`Đáp án câu ${question.number}`}>{letters.slice(0, question.part === 2 ? 3 : 4).map((letter, optionIndex) => <button key={letter} disabled={locked} className={`${selected === letter ? 'chosen' : ''} ${finished && (reviewed?.acceptedAnswers ?? [reviewed?.answer]).includes(letter) ? 'correct' : ''} ${finished && selected === letter && !reviewed?.correct ? 'incorrect' : ''}`} aria-pressed={selected === letter} onClick={() => save.mutate({ questionId: question.id, choice: letter })}><b>{letter}</b><span>{question.options?.[optionIndex] ?? `Chọn ${letter}`}</span>{finished && (reviewed?.acceptedAnswers ?? [reviewed?.answer]).includes(letter) && <Check size={19}/>}</button>)}</div>
        {!finished && <div className="toeic-save-status" role="status">{save.isPending ? 'Đang lưu…' : selected ? `Đã lưu đáp án ${selected}` : 'Chưa chọn đáp án'}{selected && <button disabled={locked} onClick={() => save.mutate({ questionId: question.id, choice: null })}>Bỏ chọn</button>}</div>}
        {finished && reviewed && <div className="toeic-explanation"><strong>{reviewed.correct ? 'Chính xác' : reviewed.selected ? `Bạn chọn ${reviewed.selected}` : 'Bạn chưa trả lời'} · Đáp án {reviewed.answer}</strong>{reviewed.explanation ? <p>{reviewed.explanation}</p> : question.sourceUrl ? <p>Xem phần đáp án và giải thích ở trang đề gốc.</p> : <p>Đề nhập chưa có giải thích cho câu này.</p>}</div>}
        <div className="toeic-question-nav"><Button variant="secondary" disabled={index === 0} onClick={() => setQuestionId(questions[index - 1].id)}><ArrowLeft size={16}/> Câu trước</Button><span>{index + 1}/{questions.length}</span><Button variant="secondary" disabled={index >= questions.length - 1} onClick={() => setQuestionId(questions[index + 1].id)}>Câu sau <ArrowRight size={16}/></Button></div>
      </>}
      {(save.error || submit.error) && <p className="toeic-error" role="alert">{message(save.error || submit.error)}</p>}
    </Card><aside className="toeic-sheet"><h2>Phiếu trả lời</h2><div className="toeic-numbers">{questions.map(q => {
      const result = attempt.result?.questions.find(item => item.id === q.id);
      return <button key={q.id} aria-label={`Câu ${q.number}${attempt.flags.includes(q.id) ? ', đã đánh dấu' : ''}`} aria-current={q.id === question?.id ? 'true' : undefined} className={`${attempt.answers[q.id] ? 'answered' : ''} ${result ? result.correct ? 'right' : 'wrong' : ''} ${attempt.flags.includes(q.id) ? 'flagged' : ''}`} onClick={() => setQuestionId(q.id)}>{q.number}</button>;
    })}</div><p>Màu xanh: đã trả lời. Chấm cam: đánh dấu xem lại.</p>{!finished && <Button disabled={save.isPending || submit.isPending || attempt.section === 'Listening'} loading={submit.isPending} onClick={() => { if (window.confirm(`Nộp bài với ${Object.keys(attempt.answers).length} câu đã trả lời? Sau khi nộp không thể sửa đáp án.`)) submit.mutate(); }}>Nộp bài</Button>}{attempt.section === 'Listening' && <p>Bạn có thể nộp bài trong phần Reading.</p>}</aside></div>
  </div>;
}
