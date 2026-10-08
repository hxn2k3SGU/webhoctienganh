import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { Vocabulary, VocabularyInput } from '../../types';
import { Button, Input } from '../ui';
import { DeckPicker } from './DeckPicker';

/** Tạo quy tắc Zod cho trường bắt buộc với thông báo lỗi tùy chỉnh. */
const required = (message: string) => z.string({ required_error: message }).trim().min(1, message);
const schema = z.object({ word: required('Vui lòng nhập từ'), pronunciation: z.string(), meaning: required('Vui lòng nhập nghĩa'), example: z.string(), partOfSpeech: z.string(), synonymsText: z.string(), tag: required('Vui lòng nhập chủ đề'), audioUrl: z.string(), deck: z.string().trim().max(100) });
type FormData = z.infer<typeof schema>;
/**
 * Form thêm/sửa từ vựng: từ, nghĩa, phát âm, ví dụ, deck.
 * @param word Từ đang sửa; bỏ trống khi thêm mới.
 */
export function WordForm({ word, onSubmit, loading, defaultDeck = '' }: { defaultDeck?: string; word?: Vocabulary; onSubmit: (data: VocabularyInput) => void; loading?: boolean }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { deck: word?.deck ?? defaultDeck, word: word?.word ?? '', pronunciation: word?.pronunciation ?? '', meaning: word?.meaning ?? '', example: word?.example ?? '', partOfSpeech: word?.partOfSpeech ?? '', synonymsText: word?.synonyms.join(', ') ?? '', tag: word?.tag ?? 'General', audioUrl: word?.audioUrl ?? '' } });
  return <form className="word-form" onSubmit={handleSubmit(({ synonymsText, ...data }) => onSubmit({ ...data, synonyms: synonymsText.split(',').map(x => x.trim()).filter(Boolean), status: word?.status }))}>
    <label>Từ tiếng Anh *<Input autoFocus {...register('word')}/>{errors.word && <small>{errors.word.message}</small>}</label><label>Phiên âm<Input placeholder="/ˈwɜːd/" {...register('pronunciation')}/></label>
    <label className="span-2">Nghĩa tiếng Việt *<Input {...register('meaning')}/>{errors.meaning && <small>{errors.meaning.message}</small>}</label>
    <label className="span-2">Câu ví dụ<textarea className="input" rows={3} {...register('example')}/></label>
    <label>Loại từ<select className="input" {...register('partOfSpeech')}><option value="">Chưa chọn</option>{['noun','verb','adjective','adverb','phrase','other'].map(x => <option key={x}>{x}</option>)}</select></label><label>Chủ đề *<Input {...register('tag')}/>{errors.tag && <small>{errors.tag.message}</small>}</label>
    <label className="span-2">Từ đồng nghĩa<Input placeholder="Ngăn cách bằng dấu phẩy" {...register('synonymsText')}/></label>
    <DeckPicker value={watch('deck')} onChange={value => setValue('deck', value, { shouldDirty: true })}/>
    <label className="span-2">URL âm thanh<Input {...register('audioUrl')}/></label>
    <div className="form-actions span-2"><Button type="submit" loading={loading}>{word ? 'Lưu thay đổi' : 'Thêm vào thư viện'}</Button></div>
  </form>;
}
