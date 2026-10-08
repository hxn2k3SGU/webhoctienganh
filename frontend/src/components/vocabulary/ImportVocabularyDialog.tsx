import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, FileText, FileUp, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import type { DuplicateStrategy, ImportCommitResult, ImportPreview, ImportVocabularyRow, WordStatus } from '../../types';
import { Badge, Button, Input, Modal } from '../ui';
import { DeckPicker } from './DeckPicker';

type Props = { open: boolean; onClose: () => void; onImported: () => void };
type Step = 'pick' | 'preview' | 'result';

const ACCEPTED_EXTENSIONS = ['csv', 'xlsx', 'pdf'];
const EMPTY_ROW: ImportVocabularyRow = { word: '', meaning: '', pronunciation: '', example: '', partOfSpeech: '', synonyms: [], tag: '', status: 'New' };

/** Lấy đuôi file (chữ thường). */
function fileExtension(file: File) { return file.name.split('.').pop()?.toLowerCase() ?? ''; }
/** Đổi dung lượng file sang dạng dễ đọc (KB, MB). */
function readableSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
/** Kiểm tra dòng xem trước có lỗi chặn việc nhập không. */
function hasBlockingIssue(preview: ImportPreview, index: number) { return preview.issues.some(issue => issue.row === index + 2 && issue.severity === 'error'); }

/** Hộp thoại nhập từ vựng gồm 3 bước: chọn file, xem trước và sửa, xác nhận nhập. */
export function ImportVocabularyDialog({ open, onClose, onImported }: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<File>();
  const [tag, setTag] = useState('General');
  const [deck, setDeck] = useState('');
  const [status, setStatus] = useState<WordStatus>('New');
  const [strategy, setStrategy] = useState<DuplicateStrategy>('skip');
  const [preview, setPreview] = useState<ImportPreview>();
  const [rows, setRows] = useState<ImportVocabularyRow[]>([]);
  const [result, setResult] = useState<ImportCommitResult>();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /** Đưa hộp thoại về trạng thái ban đầu. */
  const reset = () => {
    setStep('pick'); setFile(undefined); setPreview(undefined); setRows([]); setResult(undefined);
    setDeck('');
    setError(''); setBusy(false); setDragging(false); setTag('General'); setStatus('New'); setStrategy('skip');
    if (fileRef.current) fileRef.current.value = '';
  };
  useEffect(() => { if (!open) reset(); }, [open]);

  /** Kiểm tra định dạng và dung lượng file người dùng chọn. */
  const selectFile = (next?: File) => {
    setError(''); setPreview(undefined); setRows([]);
    if (!next) return;
    if (!ACCEPTED_EXTENSIONS.includes(fileExtension(next))) { setFile(undefined); setError('Chỉ hỗ trợ file .csv, .xlsx hoặc .pdf.'); return; }
    setFile(next);
  };
  /** Gửi file lên server để đọc và hiển thị bản xem trước. */
  const analyze = async () => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const data = await api.previewVocabularyImport(file, { tag, status });
      setPreview(data); setRows(data.rows.map(row => ({ ...EMPTY_ROW, ...row, synonyms: row.synonyms ?? [], tag: row.tag || tag, status: row.status || status })));
      setStep('preview');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể phân tích file.'); }
    finally { setBusy(false); }
  };
  /** Sửa một ô trong bảng xem trước. */
  const updateRow = (index: number, key: keyof ImportVocabularyRow, value: string) => setRows(current => current.map((row, rowIndex) => {
    if (rowIndex !== index) return row;
    if (key === 'synonyms') return { ...row, synonyms: value.split(',').map(item => item.trim()).filter(Boolean) };
    return { ...row, [key]: value };
  }));
  /** Nhập các dòng đã xem trước vào thư viện. */
  const commit = async () => {
    if (!preview || !rows.length) return;
    setBusy(true); setError('');
    try {
      const data = await api.commitVocabularyImport({ token: preview.token, rows, duplicateStrategy: strategy, deck: deck.trim() || undefined });
      setResult(data); setStep('result'); onImported();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể nhập dữ liệu.'); }
    finally { setBusy(false); }
  };
  /** Nhận file được kéo thả vào vùng chọn file. */
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); };
  /** Đóng hộp thoại nếu không đang xử lý. */
  const close = () => { if (!busy) onClose(); };

  return <Modal open={open} onClose={close} title="Nhập từ vựng từ file" wide>
    <div className="import-dialog">
      <ol className="import-steps" aria-label="Tiến trình nhập file">
        {['Chọn file', 'Kiểm tra', 'Hoàn tất'].map((label, index) => <li key={label} className={(step === 'pick' ? 0 : step === 'preview' ? 1 : 2) >= index ? 'active' : ''}><span>{index + 1}</span>{label}</li>)}
      </ol>

      {step !== 'result' && <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: '0 0 20px', minWidth: 0 }}><DeckPicker value={deck} onChange={setDeck}/></fieldset>}
      {step === 'pick' && <>
        <div className={`import-dropzone ${dragging ? 'is-dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          <FileUp size={34}/><strong>Kéo thả file vào đây</strong><p>CSV, XLSX hoặc PDF, tối đa theo giới hạn máy chủ</p>
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>Chọn file</Button>
          <input id={inputId} ref={fileRef} hidden type="file" accept=".csv,.xlsx,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0])}/>
        </div>
        {file && <div className="import-file"><span className="import-file-icon">{fileExtension(file) === 'pdf' ? <FileText/> : <FileSpreadsheet/>}</span><div><strong>{file.name}</strong><small>{readableSize(file.size)} · {fileExtension(file).toUpperCase()}</small></div><button type="button" onClick={() => selectFile()} aria-label="Bỏ file"><Trash2 size={17}/></button></div>}
        <div className="import-metadata"><label>Chủ đề mặc định<Input value={tag} onChange={event => setTag(event.target.value)} placeholder="General"/></label><label>Trạng thái<select className="input" value={status} onChange={event => setStatus(event.target.value as WordStatus)}><option>New</option><option>Learning</option><option>Review</option><option>Mastered</option></select></label></div>
        <p className="import-help">File nên có cột <b>word</b>, <b>meaning</b>. PDF sẽ được máy chủ trích xuất và đánh dấu các dòng cần kiểm tra.</p>
      </>}

      {step === 'preview' && preview && <>
        <div className="import-summary"><div><strong>{rows.length}</strong><span>dòng tìm thấy</span></div><div><strong>{preview.issues.length}</strong><span>vấn đề</span></div><div><strong>{preview.duplicates ?? 0}</strong><span>trùng lặp</span></div></div>
        {preview.issues.length > 0 && <section className="import-issues" aria-label="Vấn đề cần kiểm tra"><h3><AlertCircle size={17}/> Vấn đề phát hiện</h3><ul>{preview.issues.map((issue, index) => <li key={`${issue.row}-${index}`} className={issue.severity}><b>Dòng {issue.row}:</b> {issue.message}</li>)}</ul></section>}
        <div className="import-table-wrap"><table className="import-table"><thead><tr><th>#</th><th>Từ *</th><th>Nghĩa *</th><th>Phiên âm</th><th>Loại từ</th><th>Ví dụ</th><th>Đồng nghĩa</th><th>Chủ đề</th><th></th></tr></thead><tbody>{rows.map((row, index) => <tr key={index} className={hasBlockingIssue(preview, index) ? 'has-error' : ''}><td>{index + 2}</td>{(['word','meaning','pronunciation','partOfSpeech','example'] as const).map(key => <td key={key}><input aria-label={`${key} dòng ${index + 2}`} value={row[key] ?? ''} onChange={event => updateRow(index, key, event.target.value)}/></td>)}<td><input aria-label={`synonyms dòng ${index + 2}`} value={row.synonyms.join(', ')} onChange={event => updateRow(index, 'synonyms', event.target.value)}/></td><td><input aria-label={`tag dòng ${index + 2}`} value={row.tag} onChange={event => updateRow(index, 'tag', event.target.value)}/></td><td><button type="button" onClick={() => setRows(current => current.filter((_, rowIndex) => rowIndex !== index))} aria-label={`Xóa dòng ${index + 2}`}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>
        <fieldset className="duplicate-strategy"><legend>Khi từ đã tồn tại</legend><label><input type="radio" name="duplicate" checked={strategy === 'skip'} onChange={() => setStrategy('skip')}/><span><b>Bỏ qua</b><small>Giữ nguyên từ đang có</small></span></label><label><input type="radio" name="duplicate" checked={strategy === 'update'} onChange={() => setStrategy('update')}/><span><b>Cập nhật</b><small>Ghi đè bằng dữ liệu mới</small></span></label></fieldset>
      </>}

      {step === 'result' && result && <div className="import-result"><CheckCircle2 size={48}/><h3>Đã hoàn tất nhập từ vựng</h3><p>Dữ liệu hợp lệ đã được thêm vào thư viện.</p><div><span><b>{result.imported}</b> đã nhập</span><span><b>{result.updated ?? 0}</b> cập nhật</span><span><b>{result.skipped}</b> bỏ qua</span><span><b>{result.errors.length}</b> lỗi</span></div>{result.errors.length > 0 && <ul>{result.errors.map((item, index) => <li key={index}>Dòng {item.row}: {item.message}</li>)}</ul>}</div>}

      {error && <p className="form-error import-error" role="alert"><AlertCircle size={16}/>{error}</p>}
      <div className="import-actions">
        {step === 'pick' && <><Button variant="ghost" onClick={close}>Hủy</Button><Button onClick={analyze} disabled={!file || !tag.trim()} loading={busy}>Phân tích file</Button></>}
        {step === 'preview' && <><Button variant="ghost" onClick={reset}><RotateCcw size={16}/> Chọn lại</Button><Button onClick={commit} disabled={!rows.length || rows.some(row => !row.word.trim() || !row.meaning.trim())} loading={busy}>Nhập {rows.length} từ</Button></>}
        {step === 'result' && <><Button variant="secondary" onClick={reset}><RotateCcw size={16}/> Nhập file khác</Button><Button onClick={close}>Đóng</Button></>}
      </div>
    </div>
  </Modal>;
}
