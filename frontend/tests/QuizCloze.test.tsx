import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuizPage } from '../src/pages/QuizPage';
import { api } from '../src/api/client';
import { speak } from '../src/utils/speech';

vi.mock('../src/api/client', () => ({ api: { decks: vi.fn().mockResolvedValue([]), quiz: vi.fn(), submitQuiz: vi.fn(), settings: vi.fn().mockResolvedValue({ soundEffects: true }) } }));
vi.mock('../src/utils/speech', () => ({ speak: vi.fn(() => Promise.resolve()) }));
let client: QueryClient;
afterEach(() => { cleanup(); client.clear(); vi.clearAllMocks(); });
function start() {
  client = new QueryClient();
  render(<QueryClientProvider client={client}><QuizPage/></QueryClientProvider>);
  fireEvent.click(screen.getByText('Điền vào chỗ trống'));
}
const question = { sessionId: 'session', questions: [{ id: 'q', vocabularyId: '1', type: 'cloze' as const, prompt: 'We study _____ in our class today.', answer: '[', meaningHint: 'dấu ngoặc' }] };
describe('cloze quiz UI', () => {
  it('renders the server blank verbatim and retains meaning hints and answer audio', async () => {
    vi.mocked(api.quiz).mockResolvedValue(question); start();
    expect(await screen.findByRole('heading', { name: question.questions[0].prompt })).toBeInTheDocument();
    expect(screen.getByText('Gợi ý nghĩa tiếng Việt')).toBeInTheDocument();
    expect(screen.getByText('dấu ngoặc')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '[' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    expect(speak).toHaveBeenCalledWith('[', undefined);
    expect(screen.getByText('Chính xác! +100 điểm')).toBeInTheDocument();
  });
  it('explains generation loading and disables automatic generation retries/refetches', () => {
    vi.mocked(api.quiz).mockImplementation(() => new Promise(() => {})); start();
    expect(screen.getByRole('status')).toHaveTextContent('Gemini');
    const options = client.getQueryCache().find({ queryKey: ['quiz', 'cloze', '', 10] })!.options as any;
    expect(options).toMatchObject({ retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  });
  it('shows the server error and supports explicit retry and back', async () => {
    vi.mocked(api.quiz).mockRejectedValue(new Error('Gemini đã hết hạn mức.')); start();
    expect(await screen.findByText('Gemini đã hết hạn mức.')).toBeInTheDocument();
    expect(api.quiz).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(api.quiz).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    expect(screen.getByText('Thử sức ghi nhớ')).toBeInTheDocument();
  });
});
