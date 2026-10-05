/** Hiển thị tổng số lượt học của một từ. */
export function ReviewCount({ count }: { count?: number }) {
  return <span className={`word-review-count${count ? ' has-reviews' : ''}`} title="Tổng lượt học từ qua flashcard, quiz, ghép thẻ, lật thẻ, Khối hộp, Blast và nghe phát âm trong kho từ. Mỗi từ tính một lần trong mỗi ván/phiên; thử lại không cộng trùng.">{count === undefined ? '—' : count === 0 ? 'Chưa ôn' : `${count} lần`}</span>;
}
