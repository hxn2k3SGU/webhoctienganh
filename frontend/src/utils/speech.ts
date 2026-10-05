/** Hàm đọc âm lượng phát âm mặc định (100%). */
let readVolume: () => Promise<number> = async () => 100;
/** Đăng ký hàm lấy âm lượng phát âm từ cài đặt người dùng. */
export function setSpeechVolumeReader(reader?: () => Promise<number>) {
  readVolume = reader ?? (async () => 100);
}
/**
 * Phát âm một từ: dùng file audio nếu có, ngược lại dùng Web Speech API.
 * @param volumeOverride Âm lượng 0–100 thay cho cài đặt.
 */
export async function speak(text: string, audioUrl?: string, volumeOverride?: number): Promise<void> {
  const requested = volumeOverride ?? await readVolume();
  const volume = Math.max(0, Math.min(100, Number.isFinite(requested) ? requested : 100)) / 100;
  if (volume === 0) return;
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    audio.volume = volume;
    return audio.play();
  }
  if (!('speechSynthesis' in window)) return Promise.reject(new Error('Trình duyệt không hỗ trợ phát âm'));
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US'; utterance.rate = 0.88;
  utterance.volume = volume;
  window.speechSynthesis.speak(utterance);
  return Promise.resolve();
}
