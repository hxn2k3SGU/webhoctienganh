import { afterEach, expect, it, vi } from 'vitest';
import { setSpeechVolumeReader, speak } from '../src/utils/speech';

afterEach(() => { setSpeechVolumeReader(); vi.unstubAllGlobals(); });
it('applies saved volume to speech and allows a preview override', async () => {
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  const synthesis = { cancel: vi.fn(), speak: vi.fn() };
  vi.stubGlobal('speechSynthesis', synthesis);
  setSpeechVolumeReader(async () => 35);
  await speak('apple');
  expect(synthesis.speak.mock.calls[0][0]).toMatchObject({ text: 'apple', volume: .35 });
  await speak('preview', undefined, 60);
  expect(synthesis.speak.mock.calls[1][0]).toMatchObject({ volume: .6 });
});
it('applies volume to uploaded audio and mutes at zero', async () => {
  const play = vi.fn().mockResolvedValue(undefined);
  const audio = { volume: 1, play };
  vi.stubGlobal('Audio', vi.fn(() => audio));
  setSpeechVolumeReader(async () => 20);
  await speak('apple', '/uploads/apple.mp3');
  expect(audio.volume).toBe(.2);
  await speak('apple', '/uploads/apple.mp3', 0);
  expect(play).toHaveBeenCalledTimes(1);
});
