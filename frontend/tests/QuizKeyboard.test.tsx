import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { QuizPage } from '../src/pages/QuizPage';
import { api } from '../src/api/client';

vi.mock('../src/api/client', () => ({ api: {
  decks: vi.fn().mockResolvedValue([]),
  settings: vi.fn().mockResolvedValue({ soundEffects: false }),
  recordStudyView: vi.fn().mockResolvedValue(undefined),
  quiz: vi.fn(),
  submitQuiz: vi.fn().mockResolvedValue({ points: 100, maxPoints: 100 }),
} }));
vi.mock('../src/utils/speech', () => ({ speak: vi.fn().mockResolvedValue(undefined) }));
let client: QueryClient;
afterEach(() => { cleanup(); client.clear(); vi.clearAllMocks(); });

it.each(['meaning', 'typing', 'cloze', 'listening'] as const)(
  'uses Enter to check, advance and start a fresh %s quiz', async type => {
    const titles = ['Chọn nghĩa', 'Gõ từ', 'Điền vào chỗ trống', 'Nghe & đoán'];
    const types = ['meaning', 'typing', 'cloze', 'listening'];
    vi.mocked(api.quiz).mockResolvedValue({ sessionId: 'session', questions: [{
      id: 'q', vocabularyId: 'word', type, prompt: 'fruit', answer: 'apple',
      ...(type === 'meaning' ? { options: ['apple', 'pear'] } : {}),
    }] });
    client = new QueryClient();
    render(<QueryClientProvider client={client}><QuizPage/></QueryClientProvider>);
    fireEvent.click(screen.getByText(titles[types.indexOf(type)]));
    await screen.findByRole('button', { name: 'Kiểm tra' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.queryByText('Chính xác! +100 điểm')).not.toBeInTheDocument();
    const target = type === 'meaning'
      ? screen.getByRole('button', { name: 'A apple' })
      : screen.getByRole('textbox');
    if (type === 'meaning') fireEvent.click(target);
    else fireEvent.change(target, { target: { value: 'apple' } });
    fireEvent.keyDown(target, { key: 'Enter', isComposing: true });
    expect(screen.queryByText('Chính xác! +100 điểm')).not.toBeInTheDocument();
    fireEvent.keyDown(target, { key: 'Enter' });
    expect(screen.getByText('Chính xác! +100 điểm')).toBeInTheDocument();
    fireEvent.keyDown(target, { key: 'Enter', repeat: true });
    expect(api.submitQuiz).not.toHaveBeenCalled();
    fireEvent.keyDown(target, { key: 'Enter' });
    await screen.findByText('Bạn đạt 100 / 100 điểm.');
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(api.quiz).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Kiểm tra' })).toBeDisabled();
    expect(api.quiz).toHaveBeenLastCalledWith(type, 10, '');
    expect(api.submitQuiz).toHaveBeenCalledTimes(1);
  },
);
