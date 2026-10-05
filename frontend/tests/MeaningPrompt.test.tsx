import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { MeaningPrompt } from '../src/components/study/MeaningPrompt';
import { speak } from '../src/utils/speech';

vi.mock('../src/utils/speech', () => ({ speak: vi.fn().mockResolvedValue(undefined) }));
it('reads each question once and lets the speaker button replay it', async () => {
  const view = render(<StrictMode><MeaningPrompt key="q1" word="apple"/></StrictMode>);
  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak).toHaveBeenCalledWith('apple', undefined);
  view.rerender(<StrictMode><MeaningPrompt key="q1" word="apple"/></StrictMode>);
  expect(speak).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: /apple/ }));
  expect(speak).toHaveBeenCalledTimes(2);
  view.rerender(<StrictMode><MeaningPrompt key="q2" word="train" audioUrl="/uploads/train.mp3"/></StrictMode>);
  expect(speak).toHaveBeenCalledTimes(3);
  expect(speak).toHaveBeenLastCalledWith('train', '/uploads/train.mp3');
});
