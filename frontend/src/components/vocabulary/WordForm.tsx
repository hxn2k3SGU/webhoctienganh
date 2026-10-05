import { zodResolver } from '@hookform/resolvers/zod';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../../api/client';
import type { Vocabulary, VocabularyInput } from '../../types';
import { Button, Input } from '../ui';
import { AiImagePicker } from './AiImagePicker';
import { DeckPicker } from './DeckPicker';

/** Tạo quy tắc Zod cho trường bắt buộc với thông báo lỗi tùy chỉnh. */
const required = (message: string) => z.string({ required_error: message }).trim().min(1, message);
const schema = z.object({ word: required('Vui lòng nhập từ'), pronunciation: z.string(), meaning: required('Vui lòng nhập nghĩa'), example: z.string(), partOfSpeech: z.string(), synonymsText: z.string(), tag: required('Vui lòng nhập chủ đề'), imageUrl: z.string(), audioUrl: z.string(), deck: z.string().trim().max(100) });
type FormData = z.infer<typeof schema>;
/**
 * Form thêm/sửa từ vựng: từ, nghĩa, phát âm, ví dụ, deck, ảnh minh họa.
 * @param word Từ đang sửa; bỏ trống khi thêm mới.
 */
export function WordForm({ word, onSubmit, loading, defaultDeck = '' }: { defaultDeck?: string; word?: Vocabulary; onSubmit: (data: VocabularyInput) => void; loading?: boolean }) {
  const imageInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [imageBroken, setImageBroken] = useState(false);
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { deck: word?.deck ?? defaultDeck, word: word?.word ?? '', pronunciation: word?.pronunciation ?? '', meaning: word?.meaning ?? '', example: word?.example ?? '', partOfSpeech: word?.partOfSpeech ?? '', synonymsText: word?.synonyms.join(', ') ?? '', tag: word?.tag ?? 'General', imageUrl: word?.imageUrl ?? '', audioUrl: word?.audioUrl ?? '' } });
  const imageUrl = watch('imageUrl');
  /** Tải ảnh từ máy lên server và gán URL vào form. */
  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadError(''); setImageBroken(false);
    try { const result = await api.uploadMedia(file); setValue('imageUrl', result.url, { shouldDirty: true }); }
    catch (cause) { setUploadError(cause instanceof Error ? cause.message : 'Không thể tải ảnh lên.'); }
    finally { setUploading(false); event.target.value = ''; }
  };
  /** Bỏ ảnh minh họa khỏi form. */
  const removeImage = () => { setValue('imageUrl', '', { shouldDirty: true }); setImageBroken(false); setUploadError(''); };
  return <form className="word-form" onSubmit={handleSubmit(({ synonymsText, ...data }) => onSubmit({ ...data, synonyms: synonymsText.split(',').map(x => x.trim()).filter(Boolean), status: word?.status }))}>
    <label>Từ tiếng Anh *<Input autoFocus {...register('word')}/>{errors.word && <small>{errors.word.message}</small>}</label><label>Phiên âm<Input placeholder="/ˈwɜːd/" {...register('pronunciation')}/></label>
    <label className="span-2">Nghĩa tiếng Việt *<Input {...register('meaning')}/>{errors.meaning && <small>{errors.meaning.message}</small>}</label>
    <label className="span-2">Câu ví dụ<textarea className="input" rows={3} {...register('example')}/></label>
    <label>Loại từ<select className="input" {...register('partOfSpeech')}><option value="">Chưa chọn</option>{['noun','verb','adjective','adverb','phrase','other'].map(x => <option key={x}>{x}</option>)}</select></label><label>Chủ đề *<Input {...register('tag')}/>{errors.tag && <small>{errors.tag.message}</small>}</label>
    <label className="span-2">Từ đồng nghĩa<Input placeholder="Ngăn cách bằng dấu phẩy" {...register('synonymsText')}/></label>
    <div className="word-image-field span-2"><span>Hình minh họa</span><div className="word-image-picker">{imageUrl && !imageBroken ? <img src={imageUrl} alt="Xem trước hình minh họa" onError={() => setImageBroken(true)}/> : <div className="word-image-placeholder"><ImagePlus size={25}/><small>{imageBroken ? 'Không tải được ảnh' : 'Chưa có ảnh'}</small></div>}<div><Input placeholder="Dán URL ảnh hoặc chọn ảnh từ máy" {...register('imageUrl', { onChange: () => setImageBroken(false) })}/><div className="word-image-actions"><Button type="button" variant="secondary" onClick={() => imageInput.current?.click()} loading={uploading}>Chọn ảnh</Button>{imageUrl && <button type="button" className="image-remove" onClick={removeImage}><Trash2 size={15}/> Bỏ ảnh</button>}</div><input ref={imageInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadImage}/>{uploadError && <small className="form-error" role="alert">{uploadError}</small>}<small>JPEG, PNG, WebP hoặc GIF, tối đa 5 MB.</small></div></div></div>
    <DeckPicker value={watch('deck')} onChange={value => setValue('deck', value, { shouldDirty: true })}/>
    <AiImagePicker word={watch('word')} meaning={watch('meaning')} selected={imageUrl} onSelect={url => { setValue('imageUrl', url, { shouldDirty: true }); setImageBroken(false); setUploadError(''); }}/>
    <label className="span-2">URL âm thanh<Input {...register('audioUrl')}/></label>
    <div className="form-actions span-2"><Button type="submit" loading={loading} disabled={uploading}>{word ? 'Lưu thay đổi' : 'Thêm vào thư viện'}</Button></div>
  </form>;
}
