import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { QuizPage } from '../src/pages/QuizPage';
import { speak } from '../src/utils/speech';

vi.mock('../src/api/client', () => ({ api: { decks: vi.fn().mockResolvedValue([]),
  settings: vi.fn().mockResolvedValue({ soundEffects: false }),
  quiz: vi.fn().mockResolvedValue({ sessionId: 's', questions: [
    { id: '1', type: 'listening', prompt: '', answer: 'apple', meaningHint: 'quả táo', partOfSpeech: 'noun' },
    { id: '2', type: 'listening', prompt: '', answer: 'pear', meaningHint: 'quả lê', partOfSpeech: 'noun' },
  ] }), submitQuiz: vi.fn(),
} }));
vi.mock('../src/utils/speech', () => ({ speak: vi.fn().mockResolvedValue(undefined) }));
it('reveals meaning and part of speech only after a correct checked answer', async () => {
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><QuizPage/></QueryClientProvider>);
  fireEvent.click(screen.getByText('Nghe & đoán'));
  const input = await screen.findByRole('textbox');
  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak).toHaveBeenLastCalledWith('apple', undefined);
  expect(screen.queryByText('quả táo')).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: 'wrong' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));
  expect(screen.queryByText('quả táo')).not.toBeInTheDocument();
  expect(screen.queryByText('noun')).not.toBeInTheDocument();
  expect(speak).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: 'apple' } });
  expect(screen.queryByText('quả táo')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));
  expect(screen.getByText('quả táo')).toBeInTheDocument();
  expect(screen.getByText('noun')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Câu tiếp theo' }));
  expect(speak).toHaveBeenLastCalledWith('pear', undefined);
  const calls = vi.mocked(speak).mock.calls.length;
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'p' } });
  expect(speak).toHaveBeenCalledTimes(calls);
  fireEvent.click(screen.getByRole('button', { name: 'Phát lại từ cần đoán' }));
  expect(speak).toHaveBeenCalledTimes(calls + 1);
  expect(screen.queryByText('quả lê')).not.toBeInTheDocument();
  expect(screen.queryByText('noun')).not.toBeInTheDocument();
  view.unmount(); client.clear();
});
