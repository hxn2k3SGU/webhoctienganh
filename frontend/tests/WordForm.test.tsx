import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WordForm } from '../src/components/vocabulary/WordForm';

describe('WordForm', () => { it('validates and submits a new word', async () => { const user = userEvent.setup(); const submit = vi.fn(); render(<WordForm onSubmit={submit}/>); await user.click(screen.getByRole('button', { name: 'Thêm vào thư viện' })); expect(await screen.findByText('Vui lòng nhập từ')).toBeInTheDocument(); const inputs = screen.getAllByRole('textbox'); await user.type(inputs[0], 'curious'); await user.type(inputs[2], 'tò mò'); await user.clear(inputs[5]); await user.type(inputs[5], 'General'); await user.click(screen.getByRole('button', { name: 'Thêm vào thư viện' })); expect(submit).toHaveBeenCalledWith(expect.objectContaining({ word: 'curious', meaning: 'tò mò', tag: 'General' })); }); });
