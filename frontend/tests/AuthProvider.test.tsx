import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { api } from '../src/api/client';

vi.mock('../src/api/client', () => ({
  api: { session: vi.fn(), setupStatus: vi.fn() },
  ApiError: class extends Error {},
  setCsrfToken: vi.fn(), setUnauthorizedHandler: vi.fn(),
}));

function Probe() {
  const auth = useAuth();
  return <><span>{auth.connectionError ? 'offline' : auth.status}</span><button onClick={auth.retryConnection}>retry</button></>;
}

it('recovers from a failed bootstrap when the user retries', async () => {
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(api.session).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ user: { id: '1', username: 'owner' }, csrfToken: 'token' });
  vi.mocked(api.setupStatus).mockResolvedValue({ setupRequired: false });
  try {
    render(<QueryClientProvider client={new QueryClient()}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>);
    expect(await screen.findByText('offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'retry' }));
    await waitFor(() => expect(screen.getByText('authenticated')).toBeInTheDocument());
  } finally { errorLog.mockRestore(); }
});
