import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Button, Modal } from '../ui';

/** Nút tìm và xóa từ trùng, có bước xác nhận số lượng sẽ xóa. */
export function RemoveDuplicates() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const preview = useMutation({ mutationFn: api.duplicatePreview });
  const remove = useMutation({ mutationFn: api.removeDuplicates, onSuccess: result => {
    setNotice(`Đã xóa ${result.deleted} bản trùng, giữ một bản cho mỗi từ.`); setOpen(false);
    for (const key of ['vocabulary', 'decks', 'study', 'study-summary', 'dashboard', 'progress', 'review-reminder']) void client.invalidateQueries({ queryKey: [key] });
  } });
  const count = preview.data?.reduce((sum, ids) => sum + ids.length - 1, 0) ?? 0;
  return <><Button variant="secondary" onClick={() => { setOpen(true); setNotice(''); remove.reset(); preview.reset(); preview.mutate(); }}>Xóa từ trùng</Button>
    <Modal open={open} onClose={() => { if (!remove.isPending) setOpen(false); }} title="Xóa từ trùng hoàn toàn">
      <p>Kiểm tra toàn bộ kho từ, kể cả các bộ flashcard khác nhau. Chỉ xóa bản trùng khi tiếng Anh và nghĩa tiếng Việt giống hệt nhau, kể cả chữ hoa, dấu và khoảng trắng.</p>
      <p>Giữ bản được ôn gần nhất (hoặc bản thêm đầu tiên nếu chưa ôn), cùng bộ flashcard và nội dung của bản đó. Lịch sử học của các bản trùng được gộp lại.</p>
      {preview.isPending ? <p role="status">Đang tìm từ trùng…</p> : preview.error ? <p role="alert">{preview.error.message}</p> : preview.data && <p role="status">{count ? `Có ${count} bản trùng trong ${preview.data.length} nhóm từ sẽ bị xóa.` : 'Không có từ trùng hoàn toàn.'}</p>}
      {remove.error && <p role="alert">{remove.error.message} Hãy đóng và mở lại để kiểm tra danh sách mới.</p>}
      <div className="form-actions"><Button variant="secondary" disabled={remove.isPending} onClick={() => setOpen(false)}>Hủy</Button><Button variant="danger" disabled={!count || preview.isPending || remove.isPending || remove.isSuccess} loading={remove.isPending} onClick={() => { if (preview.data) remove.mutate(preview.data); }}>Xóa {count} bản trùng</Button></div>
    </Modal>{notice && <span role="status">{notice}</span>}</>;
}
