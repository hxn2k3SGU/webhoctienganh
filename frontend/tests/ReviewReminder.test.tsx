import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ReviewReminder } from '../src/components/ReviewReminder';

const state = vi.hoisted(() => ({ dueCount: 3, refetch: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { dueCount: state.dueCount }, refetch: state.refetch }) }));
function mount(account = 'user-a', route = '/') {
  return render(<MemoryRouter initialEntries={[route]}><ReviewReminder account={account}/></MemoryRouter>);
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 21, 12)); localStorage.clear(); state.dueCount = 3; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

it.each([1, 15])('reminds after %s minutes and keeps the deadline across reloads', minutes => {
  const view = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Nhắc tôi sau' }));
  fireEvent.click(screen.getByRole('button', { name: `Nhắc sau ${minutes} phút` }));
  expect(screen.queryByText('Bạn có từ cần phải ôn')).not.toBeInTheDocument();
  view.unmount(); mount();
  act(() => { vi.advanceTimersByTime(minutes * 60_000 - 1); });
  expect(screen.queryByText('Bạn có từ cần phải ôn')).not.toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.getByText('Bạn có từ cần phải ôn')).toBeInTheDocument();
  expect(state.refetch).toHaveBeenCalled();
});

it('dismisses until tomorrow without affecting another account', () => {
  const view = mount(); fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua' }));
  act(() => { vi.advanceTimersByTime(15 * 60_000); });
  expect(screen.queryByText('Bạn có từ cần phải ôn')).not.toBeInTheDocument();
  view.unmount(); mount('user-b');
  expect(screen.getByText('Bạn có từ cần phải ôn')).toBeInTheDocument();
});

it('does not remind when no words are due or while studying', () => {
  state.dueCount = 0; const view = mount();
  expect(screen.queryByText('Bạn có từ cần phải ôn')).not.toBeInTheDocument();
  view.unmount(); state.dueCount = 3; mount('user-a', '/study');
  expect(screen.queryByText('Bạn có từ cần phải ôn')).not.toBeInTheDocument();
});
