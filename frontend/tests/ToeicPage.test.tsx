import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ToeicAttempt } from '@lexiloop/shared';
import { toeicApi } from '../src/api/toeic';
import { ToeicPage, formatToeicTime } from '../src/pages/ToeicPage';

vi.mock('../src/api/toeic', () => ({ toeicApi: { catalog: vi.fn(), history: vi.fn(), attempt: vi.fn(), start: vi.fn(), save: vi.fn(), submit: vi.fn(), import: vi.fn() } }));
let clients: QueryClient[] = [];
const active = (): ToeicAttempt => ({
  id: 'attempt-1', testId: 'iibc-official-samples', title: 'Official sample', mode: 'practice', part: 2,
  startedAt: Date.now(), deadlineAt: null, listeningEndsAt: null, submittedAt: null, serverNow: Date.now(), status: 'active', section: 'practice',
  sourceName: 'IIBC / ETS', sourceUrl: 'https://www.iibc-global.org/', answers: {}, flags: [], result: null,
  questions: [{ id: 'iibc-7', number: 7, part: 2, sourceUrl: 'https://www.iibc-global.org/toeic/test/lr/about/format/sample02.html' }],
});
function renderPage(url = '/toeic') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[url]}><ToeicPage/></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(toeicApi.catalog).mockResolvedValue({ tests: [{ id: 'iibc-official-samples', title: 'Official sample', sourceName: 'IIBC / ETS', sourceUrl: 'https://www.iibc-global.org/', kind: 'official-sample', questionCount: 60, partCounts: { 1: 2, 2: 4, 3: 12, 4: 12, 5: 5, 6: 4, 7: 21 }, fullAvailable: false }] });
  vi.mocked(toeicApi.history).mockResolvedValue([]);
  vi.mocked(toeicApi.attempt).mockResolvedValue(active());
});
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients = []; vi.restoreAllMocks(); });

it('labels the short official sample clearly and starts selected Part practice', async () => {
  const user = userEvent.setup();
  vi.mocked(toeicApi.start).mockResolvedValue(active());
  renderPage();
  expect(await screen.findByText('60')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bắt đầu thi thử' })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText('Phần luyện'), '2');
  await user.selectOptions(screen.getByLabelText('Thời gian'), '10');
  await user.click(screen.getByRole('button', { name: /Bắt đầu luyện/ }));
  await waitFor(() => expect(toeicApi.start).toHaveBeenCalledWith({ testId: 'iibc-official-samples', mode: 'practice', part: 2, timeLimitMinutes: 10 }, expect.anything()));
  const link = await screen.findByRole('link', { name: 'Mở đề và audio gốc' });
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('href', expect.stringContaining('sample02.html'));
});

it('restores saved answers, offers three choices for Part 2, and saves changes', async () => {
  const attempt = { ...active(), answers: { 'iibc-7': 'B' as const } };
  vi.mocked(toeicApi.attempt).mockResolvedValue(attempt);
  vi.mocked(toeicApi.save).mockResolvedValue({ ...attempt, answers: { 'iibc-7': 'A' } });
  renderPage('/toeic?attempt=attempt-1');
  expect(await screen.findByRole('button', { name: 'B Chọn B' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: 'D Chọn D' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'A Chọn A' }));
  await waitFor(() => expect(toeicApi.save).toHaveBeenCalledWith('attempt-1', { questionId: 'iibc-7', choice: 'A' }));
  expect(await screen.findByText('Đã lưu đáp án A')).toBeInTheDocument();
});

it('shows a save failure without claiming that the new choice was saved', async () => {
  vi.mocked(toeicApi.save).mockRejectedValue(new Error('Không lưu được đáp án'));
  renderPage('/toeic?attempt=attempt-1');
  fireEvent.click(await screen.findByRole('button', { name: 'A Chọn A' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Không lưu được đáp án');
  expect(screen.getByText('Chưa chọn đáp án')).toBeInTheDocument();
});

it('confirms submission, displays the answer only in results and supports wrong-answer review', async () => {
  const attempt = active();
  vi.mocked(toeicApi.submit).mockResolvedValue({ ...attempt, status: 'submitted', section: 'finished', submittedAt: Date.now(), result: {
    correct: 0, total: 1, unanswered: 1, percentage: 0, listening: { correct: 0, total: 1 }, reading: { correct: 0, total: 0 }, parts: [{ part: 2, correct: 0, total: 1 }],
    questions: [{ ...attempt.questions[0], answer: 'A', selected: null, correct: false }],
  } });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderPage('/toeic?attempt=attempt-1');
  fireEvent.click(await screen.findByRole('button', { name: 'Nộp bài' }));
  expect(await screen.findByText('Bạn chưa trả lời · Đáp án A')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'A Chọn A' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Câu sai / bỏ trống' }));
  expect(screen.getByText('Đề gốc · câu 7')).toBeInTheDocument();
});

it('formats the countdown without negative values', () => {
  expect(formatToeicTime(4500)).toBe('75:00');
  expect(formatToeicTime(59)).toBe('00:59');
  expect(formatToeicTime(-1)).toBe('00:00');
});

it('plays downloaded group audio and displays the complete reading image', async () => {
  const imageUrl = `/api/toeic/media/${'b'.repeat(64)}.png`;
  const audioUrl = `/api/toeic/media/${'a'.repeat(64)}.mp3`;
  const attempt = { ...active(), part: null, questions: [
    { id: 'q32', number: 32, part: 3, audioUrl, prompt: 'Where are the speakers?', options: ['A place', 'Another place', 'An office', 'A station'] },
    { id: 'q131', number: 131, part: 6, imageUrl, prompt: 'Question 131', options: ['One', 'Two', 'Three', 'Four'] },
  ] };
  vi.mocked(toeicApi.attempt).mockResolvedValue(attempt);
  renderPage('/toeic?attempt=attempt-1');
  expect(await screen.findByLabelText('Audio câu hỏi / nhóm câu')).toHaveAttribute('src', audioUrl);
  fireEvent.click(screen.getByRole('button', { name: 'Câu sau' }));
  expect(screen.queryByLabelText('Audio câu hỏi / nhóm câu')).not.toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Hình đề TOEIC câu 131' })).toHaveClass('toeic-reading-image');
  expect(screen.getByRole('link', { name: 'Mở hình câu 131 kích thước gốc' })).toHaveAttribute('href', imageUrl);
});

it('shows scaled Listening, Reading, total, incorrect and elapsed time after submission', async () => {
  const base = active();
  vi.mocked(toeicApi.attempt).mockResolvedValue({ ...base, status: 'submitted', section: 'finished', result: {
    correct: 150, total: 200, unanswered: 1, incorrect: 49, percentage: 75, elapsedSeconds: 3661,
    listening: { correct: 80, total: 100 }, reading: { correct: 70, total: 100 },
    scaledScore: { method: 'toeic-reference-v1', listening: 420, reading: 300, total: 720 },
    parts: [{ part: 2, correct: 20, total: 25 }],
    questions: [{ ...base.questions[0], answer: 'A', selected: null, correct: false }],
  } });
  renderPage('/toeic?attempt=attempt-1');
  expect(await screen.findByLabelText('Tổng điểm tham khảo')).toHaveTextContent('720 / 990');
  expect(screen.getByLabelText('Điểm Listening')).toHaveTextContent('420 / 495');
  expect(screen.getByLabelText('Điểm Reading')).toHaveTextContent('300 / 495');
  expect(screen.getByText('49')).toBeInTheDocument();
  expect(screen.getByText('61:01')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Xem bảng quy đổi' })).toHaveAttribute('href', 'https://prepedu.com/vi/blog/thang-diem-toeic');
});

it('displays the estimated total in completed attempt history', async () => {
  vi.mocked(toeicApi.history).mockResolvedValue([{ id: 'past', title: 'Previous test', mode: 'full', part: null,
    startedAt: Date.now(), submittedAt: Date.now(), status: 'submitted', correct: 150, total: 200,
    scaledScore: { method: 'toeic-reference-v1', listening: 420, reading: 300, total: 720 },
  }]);
  renderPage();
  expect(await screen.findByText('720/990 (tham khảo)')).toBeInTheDocument();
});
