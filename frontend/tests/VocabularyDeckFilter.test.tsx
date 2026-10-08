import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { VocabularyPage } from '../src/pages/VocabularyPage';
import { api } from '../src/api/client';

vi.mock('../src/api/client', () => ({ api: {
  decks: vi.fn().mockResolvedValue([{ name: 'Part 1', count: 80 }]),
  vocabulary: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 12 }),
  exportUrl: vi.fn().mockReturnValue('#'), deleteWord: vi.fn(),
} }));
it('loads the selected deck without stale status, search, tag or page filters', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/vocabulary?status=Review&q=old&tag=other&page=4']}><VocabularyPage/></MemoryRouter></QueryClientProvider>);
  await screen.findByRole('option', { name: 'Part 1 (80 từ)' });
  await userEvent.selectOptions(screen.getByLabelText('Bộ flashcard'), 'Part 1');
  await waitFor(() => {
    const params = vi.mocked(api.vocabulary).mock.calls.at(-1)![0];
    expect(Object.fromEntries(params)).toEqual({ page: '1', pageSize: '12', deck: 'Part 1', sort: 'word', direction: 'asc' });
  });
  expect(screen.queryByRole('button', { name: 'Xóa bộ lọc' })).not.toBeInTheDocument();
  client.clear();
});
