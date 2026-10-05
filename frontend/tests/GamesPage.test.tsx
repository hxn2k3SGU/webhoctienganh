import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { GamesPage } from '../src/pages/GamesPage';
import { api } from '../src/api/client';
import { matchingCards } from '../src/utils/matchingGame';
import type { Vocabulary } from '../src/types';

vi.mock('../src/api/client', () => ({ api: {
  decks: vi.fn().mockResolvedValue([{ name: 'Fruit', count: 2 }]),
  settings: vi.fn().mockResolvedValue({ soundEffects: false }),
  studyQueue: vi.fn(),
  recordStudyView: vi.fn(),
} }));
const words: Vocabulary[] = [
  { id: '1', word: 'apple', meaning: 'táo', synonyms: [], tag: '', status: 'New' },
  { id: '2', word: 'pear', meaning: 'lê', synonyms: [], tag: '', status: 'New' },
];
let client: QueryClient;
afterEach(() => { cleanup(); client?.clear(); vi.restoreAllMocks(); });
function setup(memory = true) {
  vi.mocked(api.recordStudyView).mockResolvedValue(undefined);
  vi.mocked(api.decks).mockResolvedValue([{ name: 'Fruit', count: 2 }]);
  vi.mocked(api.settings).mockResolvedValue({ soundEffects: false, dailyNewLimit: 10, dailyReviewLimit: 20, autoPlayAudio: false, showExamplesFirst: false, theme: 'dark' });
  vi.spyOn(Math, 'random').mockReturnValue(.999);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><GamesPage/></QueryClientProvider></MemoryRouter>);
  if (memory) fireEvent.change(screen.getByLabelText('Cách chơi'), { target: { value: 'memory' } });
}
it('filters ambiguous duplicate faces and creates one word and meaning per pair', () => {
  const cards = matchingCards([...words, { ...words[0], id: '3' }, { ...words[1], id: '4', word: 'other' }], 8);
  expect(cards).toHaveLength(4);
  for (const card of cards) expect(cards.filter(item => item.pairId === card.pairId)).toHaveLength(2);
});
it('locks mismatches, matches pairs, and starts a new round with Enter', async () => {
  vi.mocked(api.studyQueue).mockResolvedValue({ cards: words, mode: 'random' });
  setup();
  await screen.findByRole('option', { name: 'Fruit (2 từ)' });
  fireEvent.change(screen.getByLabelText('Bộ từ vựng'), { target: { value: 'Fruit' } });
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu chơi' }));
  await screen.findByRole('button', { name: 'Lật thẻ 1' });
  expect(api.studyQueue).toHaveBeenLastCalledWith('random', 100, 'Fruit');
  expect(screen.queryByText('apple')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ 3' }));
  expect(screen.getByRole('button', { name: 'Lật thẻ 2' })).toBeDisabled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lật thẻ 1' })).toBeEnabled(), { timeout: 2000 });
  for (const index of [1, 2, 3, 4]) fireEvent.click(screen.getByRole('button', { name: `Lật thẻ ${index}` }));
  expect(screen.getByText('Đã tìm đủ các cặp!')).toBeInTheDocument();
  expect(screen.getByText('Bạn hoàn thành 2 cặp trong 3 lượt lật.')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(await screen.findByRole('button', { name: 'Lật thẻ 1' })).toBeEnabled();
  expect(screen.queryByText('Đã tìm đủ các cặp!')).not.toBeInTheDocument();
});
it('handles insufficient vocabulary and retries a failed request', async () => {
  vi.mocked(api.studyQueue).mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce({ cards: words.slice(0, 1), mode: 'random' });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu chơi' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed');
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu chơi' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Cần ít nhất 2 từ'));
  expect(screen.queryByRole('button', { name: 'Lật thẻ 1' })).not.toBeInTheDocument();
});
it('keeps the current board when entering and leaving immersive mode', async () => {
  vi.mocked(api.studyQueue).mockResolvedValue({ cards: words, mode: 'random' });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu chơi' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Lật thẻ 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Toàn màn hình' }));
  expect(screen.getByRole('button', { name: 'Thoát toàn màn hình' }).closest('.games-page')).toHaveClass('games-fullscreen');
  expect(document.body.style.overflow).toBe('hidden');
  expect(screen.getByRole('button', { name: 'Từ: apple' })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Toàn màn hình' }).closest('.games-page')).not.toHaveClass('games-fullscreen');
  expect(document.body.style.overflow).not.toBe('hidden');
  expect(screen.getByRole('button', { name: 'Từ: apple' })).toBeInTheDocument();
});

it('shows all Match faces and removes only correctly matched pairs', async () => {
  vi.mocked(api.studyQueue).mockResolvedValue({ cards: words, mode: 'random' });
  setup(false);
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu chơi' }));
  const apple = await screen.findByRole('button', { name: 'Từ: apple' });
  expect(screen.getByRole('button', { name: 'Nghĩa: táo' })).toBeVisible();
  fireEvent.click(apple);
  expect(apple).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(apple);
  expect(apple).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(apple);
  fireEvent.click(screen.getByRole('button', { name: 'Nghĩa: lê' }));
  expect(screen.getByText('Chưa đúng! +1 giây. Hãy thử cặp khác.')).toBeInTheDocument();
  await waitFor(() => expect(apple).toBeEnabled(), { timeout: 2000 });
  fireEvent.click(apple);
  fireEvent.click(screen.getByRole('button', { name: 'Nghĩa: táo' }));
  expect(screen.queryByRole('button', { name: 'Từ: apple' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Từ: pear' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Từ: pear' }));
  fireEvent.click(screen.getByRole('button', { name: 'Nghĩa: lê' }));
  expect(screen.getByText('Đã tìm đủ các cặp!')).toBeInTheDocument();
});
