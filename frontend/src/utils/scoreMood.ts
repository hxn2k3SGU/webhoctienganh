/** Chọn lời nhận xét và tông màu theo tỉ lệ điểm quiz. */
export function scoreMood(points: number, maxPoints: number) {
  if (maxPoints <= 0) return { tone: 'neutral', title: 'Sẵn sàng thử sức!', message: 'Mỗi câu trả lời là một bước tiến. Bắt đầu nhé!' };
  const percent = Math.max(0, Math.min(100, points / maxPoints * 100));
  if (percent >= 100) return { tone: 'perfect', title: 'Xuất sắc! Trọn vẹn điểm số!', message: 'Bạn đạt điểm tối đa ở các câu đã hoàn thành. Chúc mừng bạn!' };
  if (percent >= 85) return { tone: 'great', title: 'Tuyệt vời! Bạn làm rất tốt!', message: 'Kiến thức đang rất vững vàng. Tiếp tục phát huy nhé!' };
  if (percent >= 70) return { tone: 'good', title: 'Tốt lắm, bạn đang tiến bộ!', message: 'Thêm một chút luyện tập là bạn sẽ bứt phá!' };
  if (percent >= 50) return { tone: 'steady', title: 'Bạn đang đi đúng hướng!', message: 'Ôn lại những từ còn khó, bạn sẽ làm tốt hơn ở lần sau.' };
  return { tone: 'encourage', title: 'Cứ từng bước, bạn sẽ làm được!', message: 'Chưa nhớ hết cũng không sao. Mỗi lần thử là một cơ hội học thêm.' };
}
