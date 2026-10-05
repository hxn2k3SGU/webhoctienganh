import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { VocabularyPage } from '../src/pages/VocabularyPage';
import { api } from '../src/api/client';
import { speak } from '../src/utils/speech';

vi.mock('../src/utils/speech', () => ({ speak: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/api/client', () => ({ api: {
  decks: vi.fn().mockResolvedValue([]),
  vocabulary: vi.fn().mockResolvedValue({ data: [{ id: '1', word: 'apple', meaning: 'fruit', synonyms: [], tag: 'Food', status: 'New', reviewCount: 3 }], total: 1, page: 1, pageSize: 12 }),
  exportUrl: vi.fn().mockReturnValue('#'), deleteWord: vi.fn(), recordStudyView: vi.fn().mockResolvedValue(undefined),
} }));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(speak).mockResolvedValue(undefined);
  vi.mocked(api.decks).mockResolvedValue([]);
  vi.mocked(api.vocabulary).mockResolvedValue({ data: [{ id: '1', word: 'apple', meaning: 'fruit', synonyms: [], tag: 'Food', status: 'New', reviewCount: 3 }], total: 1, page: 1, pageSize: 12 });
});

it('plays vocabulary audio without recording reviews and limits rapid clicks', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><MemoryRouter><VocabularyPage/></MemoryRouter></QueryClientProvider>);
  const button = (await screen.findAllByRole('button', { name: /apple/ }))[0];
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  await act(async () => { for (let i = 0; i < 20; i++) fireEvent.click(button); });
  expect(speak).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.click(button); });
  expect(speak).toHaveBeenCalledTimes(1);
  clock.mockReturnValue(1600);
  await act(async () => { fireEvent.click(button); });
  expect(speak).toHaveBeenCalledTimes(2);
  expect(api.recordStudyView).not.toHaveBeenCalled();
  expect(api.vocabulary).toHaveBeenCalledTimes(1);
  view.unmount(); client.clear();
});

it('allows playback again after an audio failure without recording a review', async () => {
  vi.mocked(speak).mockRejectedValueOnce(new Error('Playback failed'));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><MemoryRouter><VocabularyPage/></MemoryRouter></QueryClientProvider>);
  const button = (await screen.findAllByRole('button', { name: /apple/ }))[0];
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  await act(async () => { fireEvent.click(button); });
  clock.mockReturnValue(1600);
  await act(async () => { fireEvent.click(button); });
  expect(speak).toHaveBeenCalledTimes(2);
  expect(api.recordStudyView).not.toHaveBeenCalled();
  view.unmount(); client.clear();
});
