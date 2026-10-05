let context: AudioContext | undefined;
/**
 * Phát âm thanh báo đúng/sai bằng Web Audio API.
 * @param volume Âm lượng 0–100.
 */
export function playFeedback(correct: boolean, enabled = true, volume = 100) {
  const level = Math.max(0, Math.min(100, Number.isFinite(volume) ? volume : 100)) / 100;
  if (!enabled || level === 0) return;
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => undefined);
    const start = context.currentTime;
    const notes = correct ? [523.25, 659.25, 783.99] : [220, 164.81];
    const output = context.createGain();
    output.gain.value = level;
    output.connect(context.destination);
    let remaining = notes.length;
    notes.forEach((frequency, index) => {
      const oscillator = context!.createOscillator(), gain = context!.createGain();
      const at = start + index * .09;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.36, at + .015); gain.gain.exponentialRampToValueAtTime(.004, at + .18);
      gain.gain.linearRampToValueAtTime(0, at + .2);
      oscillator.connect(gain); gain.connect(output);
      oscillator.onended = () => {
        oscillator.disconnect(); gain.disconnect();
        if (--remaining === 0) output.disconnect();
      };
      oscillator.start(at); oscillator.stop(at + .2);
    });
  } catch { /* Audio is optional on browsers without Web Audio. */ }
}
