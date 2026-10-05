import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { NotificationCenter } from '../src/components/NotificationCenter';
import { readNotifications, saveDismissedReminder } from '../src/utils/notifications';

afterEach(() => { cleanup(); localStorage.clear(); });
it('updates the bell, displays saved history, and isolates accounts', () => {
  const view = render(<MemoryRouter><NotificationCenter account="a"/></MemoryRouter>);
  act(() => saveDismissedReminder('a', 12));
  fireEvent.click(screen.getByRole('button', { name: 'Thông báo đã bỏ qua (1)' }));
  expect(screen.getByText('Bạn có từ cần phải ôn')).toBeInTheDocument();
  expect(screen.getByText(/12 từ đã đến hạn/)).toBeInTheDocument();
  expect(readNotifications('b')).toEqual([]);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByText('Bạn có từ cần phải ôn')).not.toBeInTheDocument();
  view.unmount();
  render(<MemoryRouter><NotificationCenter account="a"/></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Thông báo đã bỏ qua (1)' })).toBeInTheDocument();
});
