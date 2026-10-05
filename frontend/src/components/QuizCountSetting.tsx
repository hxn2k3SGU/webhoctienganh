/** Ô nhập số câu hỏi mỗi bài quiz (1–50). */
export function QuizCountSetting({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <label><span><strong>Số câu hỏi mỗi bài quiz</strong><small>Chọn từ 1–50 câu. Nếu không đủ từ phù hợp, bài quiz sẽ có ít câu hơn.</small></span><input aria-label="Số câu hỏi mỗi bài quiz" type="number" min="1" max="50" step="1" value={value} onChange={event => onChange(Number(event.target.value))}/></label>;
}
