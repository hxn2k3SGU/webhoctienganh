import { RemoveDuplicates } from '../components/vocabulary/RemoveDuplicates';
import { sortFields, VocabularySortHeaders, VocabularySortSelect } from '../components/vocabulary/VocabularySort';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, MoreHorizontal, Pencil, Plus, Search, Trash2, Volume2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ReviewCount } from '../components/vocabulary/ReviewCount';
import '../styles/vocabulary-count.css';
import { useRef, useState } from 'react';
import { api } from '../api/client';
import type { Vocabulary, VocabularyInput, WordStatus } from '../types';
import { speak } from '../utils/speech';
import { WordForm } from '../components/vocabulary/WordForm';
import { ImportVocabularyDialog } from '../components/vocabulary/ImportVocabularyDialog';
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Skeleton } from '../components/ui';

const tones: Record<WordStatus, 'neutral'|'brand'|'coral'|'success'> = { New: 'neutral', Learning: 'coral', Review: 'brand', Mastered: 'success' };
/** Trang thư viện từ vựng: tìm kiếm, lọc, sắp xếp, thêm/sửa/xóa, nhập và xuất file. */
export function VocabularyPage() {
 const lastPlayback = useRef(-Infinity);
 const playbackPending = useRef(false);
 /** Phát âm một từ, chặn bấm liên tục trong 0,5 giây. */
 const hearWord = async (word: Vocabulary) => {
   const now = performance.now();
   if (playbackPending.current || now - lastPlayback.current < 500) return;
   lastPlayback.current = now;
   playbackPending.current = true;
   try { await speak(word.word, word.audioUrl); }
   catch { /* Audio failures must not affect vocabulary browsing. */ }
   finally { playbackPending.current = false; }
 };
 const client = useQueryClient(); const [searchParams, setSearchParams] = useSearchParams(); const [modal, setModal] = useState<'form'|'import'|null>(null); const [editing, setEditing] = useState<Vocabulary>(); const [menu, setMenu] = useState<string>();
 const q = searchParams.get('q') ?? ''; const page = Number(searchParams.get('page') ?? 1); const status = searchParams.get('status') ?? ''; const tag = searchParams.get('tag') ?? '';
 const deck = searchParams.get('deck') ?? ''; const decks = useQuery({ queryKey: ['decks'], queryFn: api.decks });
 const sort = sortFields.some(item=>item.key===searchParams.get('sort'))?searchParams.get('sort')!:'word';
 const direction = searchParams.get('direction')==='desc'?'desc':'asc';
 /** Đổi cột và chiều sắp xếp, quay về trang 1. */
 const changeSort = (field:string, order:string) => { const next = new URLSearchParams(searchParams); next.set('sort',field); next.set('direction',order); next.set('page','1'); setSearchParams(next); };
 const params = new URLSearchParams({ page: String(page), pageSize: '12', sort, direction }); if(deck) params.set('deck', deck); if(q) params.set('q', q); if(status) params.set('status', status); if(tag) params.set('tag', tag);
 const { data, isLoading, error } = useQuery({ queryKey: ['vocabulary', params.toString()], queryFn: () => api.vocabulary(params) });
 /** Làm mới dữ liệu từ vựng, deck và hàng đợi học sau khi thay đổi. */
 const refresh = () => { client.invalidateQueries({ queryKey: ['decks'] }); client.invalidateQueries({ queryKey: ['study'] }); return client.invalidateQueries({ queryKey: ['vocabulary'] }); };
 const save = useMutation({ mutationFn: (input: VocabularyInput) => editing ? api.updateWord(editing.id, input) : api.createWord(input), onSuccess: () => { refresh(); setModal(null); setEditing(undefined); } });
 const remove = useMutation({ mutationFn: api.deleteWord, onSuccess: refresh });
 /** Cập nhật một tham số lọc trên URL và quay về trang 1. */
 const set = (key: string, value: string) => { const next = new URLSearchParams(searchParams); value ? next.set(key,value) : next.delete(key); if(key === 'deck') { next.delete('q'); next.delete('status'); next.delete('tag'); } if(key !== 'page') next.set('page','1'); setSearchParams(next); };
 /** Xóa mọi bộ lọc, chỉ giữ deck đang chọn. */
 const clearFilters = () => { const next = new URLSearchParams(); if (deck) next.set('deck', deck); setSearchParams(next); };
 /** Mở form sửa cho một từ. */
 const openEdit = (word: Vocabulary) => { setEditing(word); setModal('form'); setMenu(undefined); };
 return <div className="page"><PageHeader eyebrow="THƯ VIỆN CÁ NHÂN" title="Kho từ vựng" body={`${data?.total ?? 0} từ đang chờ được ghi nhớ.`} action={<div className="header-actions"><RemoveDuplicates/><Button variant="secondary" onClick={() => setModal('import')}><FileUp size={16}/> Nhập file</Button><div className="export"><Button variant="secondary"><Download size={16}/> Xuất</Button><div>{(['csv','xlsx','json'] as const).map(x => <a key={x} href={api.exportUrl(x, params.toString())}>.{x}</a>)}</div></div><Button onClick={() => {setEditing(undefined);setModal('form')}}><Plus size={17}/> Thêm từ</Button></div>}/>
 <label style={{display: 'block', marginBottom: 16}}>Bộ flashcard<select className="input" value={deck} onChange={e => set('deck',e.target.value)}><option value="">Tất cả các bộ</option>{decks.data?.map(item => <option key={item.name} value={item.name}>{item.name} ({item.count} từ)</option>)}</select></label>
 {(q || status || tag) && <Button variant="ghost" onClick={clearFilters}>Xóa bộ lọc</Button>}
 <Card className="filters"><div className="filter-search"><Search size={17}/><Input value={q} onChange={e => set('q',e.target.value)} placeholder="Tìm từ, nghĩa hoặc ví dụ..."/></div><select className="input" value={status} onChange={e=>set('status',e.target.value)}><option value="">Mọi trạng thái</option>{['New','Learning','Review','Mastered'].map(x=><option key={x}>{x}</option>)}</select><Input value={tag} onChange={e=>set('tag',e.target.value)} placeholder="Lọc chủ đề"/></Card>
 <VocabularySortSelect field={sort} direction={direction} onChange={changeSort}/>
 {isLoading ? <div className="word-grid">{Array.from({length:6},(_,i)=><Skeleton key={i} className="h-44"/>)}</div> : error ? <Empty title="Không tải được từ vựng" body="Kiểm tra kết nối máy chủ rồi thử lại."/> : !data?.data.length ? <Empty title="Chưa tìm thấy từ nào" body="Đổi bộ lọc hoặc thêm từ đầu tiên của bạn."/> : <><div className="word-table"><div className="word-row word-head"><VocabularySortHeaders field={sort} direction={direction} onSort={field=>changeSort(field,field===sort&&direction==='asc'?'desc':'asc')}/><span/></div>{data.data.map(word=><div className="word-row" key={word.id}><div className="word-identity">{word.imageUrl ? <img className="word-thumb" src={word.imageUrl} alt={`Hình minh họa cho ${word.word}`}/> : <span className="word-thumb word-thumb-empty" aria-hidden="true">{word.word.charAt(0).toUpperCase()}</span>}<span><strong>{word.word}</strong><small>{word.pronunciation} · {word.partOfSpeech}</small></span></div><span>{word.meaning}</span><Badge>{word.tag}</Badge><Badge tone={tones[word.status]}>{word.status}</Badge><ReviewCount count={word.reviewCount}/><div className="row-actions"><button onClick={()=>void hearWord(word)} aria-label={`Phát âm ${word.word}`}><Volume2 size={17}/></button><button onClick={()=>setMenu(menu===word.id?undefined:word.id)} aria-label="Tác vụ"><MoreHorizontal size={18}/></button>{menu===word.id&&<div className="action-menu"><button onClick={()=>openEdit(word)}><Pencil size={15}/> Sửa</button><button className="danger" onClick={()=>{if(confirm(`Xóa “${word.word}”?`)) remove.mutate(word.id)}}><Trash2 size={15}/> Xóa</button></div>}</div></div>)}</div>
 <div className="word-grid">{data.data.map(word=><Card key={word.id} className="word-card"><div><Badge tone={tones[word.status]}>{word.status}</Badge><button onClick={()=>openEdit(word)} aria-label={`Sửa ${word.word}`}><Pencil size={16}/></button></div>{word.imageUrl&&<img className="word-card-image" src={word.imageUrl} alt={`Hình minh họa cho ${word.word}`}/>}<h3>{word.word}</h3><small>{word.pronunciation} · {word.partOfSpeech}</small><p>{word.meaning}</p><Badge>{word.tag}</Badge><ReviewCount count={word.reviewCount}/></Card>)}</div>
 <div className="pagination"><Button variant="ghost" disabled={page<=1} onClick={()=>set('page',String(page-1))}>Trước</Button><span>Trang {page} / {Math.max(1,Math.ceil(data.total/data.pageSize))}</span><Button variant="ghost" disabled={page*data.pageSize>=data.total} onClick={()=>set('page',String(page+1))}>Sau</Button></div></>}
 <Modal open={modal==='form'} onClose={()=>setModal(null)} title={editing?'Chỉnh sửa từ':'Thêm từ mới'} wide><WordForm defaultDeck={deck} word={editing} onSubmit={d=>save.mutate(d)} loading={save.isPending}/>{save.error&&<p className="form-error">{save.error.message}</p>}</Modal>
 <ImportVocabularyDialog open={modal==='import'} onClose={()=>setModal(null)} onImported={refresh}/>
 </div>;
}
