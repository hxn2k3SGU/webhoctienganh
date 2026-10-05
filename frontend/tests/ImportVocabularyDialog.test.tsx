import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportVocabularyDialog } from '../src/components/vocabulary/ImportVocabularyDialog';
import { api } from '../src/api/client';

vi.mock('../src/api/client', () => ({ api: { decks: vi.fn().mockResolvedValue([{ name: 'IELTS', count: 0 }]), previewVocabularyImport: vi.fn(), commitVocabularyImport: vi.fn() } }));

const preview = {
  token: 'preview-token',
  expiresAt: '2026-09-18T10:00:00.000Z',
  format: 'pdf' as const,
  rows: [{ word: 'curious', meaning: 'tò mò', pronunciation: '', example: '', partOfSpeech: 'adjective', synonyms: [], tag: 'General', status: 'New' as const }],
  issues: [{ row: 2, field: 'meaning' as const, message: 'Hãy kiểm tra nghĩa', severity: 'warning' as const }],
  duplicates: 1,
};

describe('ImportVocabularyDialog', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('accepts PDF and sends metadata to preview endpoint', async () => {
    vi.mocked(api.previewVocabularyImport).mockResolvedValue(preview);
    const user = userEvent.setup();
    render(<ImportVocabularyDialog open onClose={vi.fn()} onImported={vi.fn()}/>);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf'], 'vocabulary.pdf', { type: 'application/pdf' });
    await user.upload(input, file);
    expect(screen.getByText('vocabulary.pdf')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Phân tích file' }));
    await waitFor(() => expect(api.previewVocabularyImport).toHaveBeenCalledWith(file, { tag: 'General', status: 'New' }));
    expect(await screen.findByText('Vấn đề phát hiện')).toBeInTheDocument();
    expect(screen.getByDisplayValue('curious')).toBeInTheDocument();
  });

  it('commits edited rows and update strategy, then can reset', async () => {
    vi.mocked(api.previewVocabularyImport).mockResolvedValue(preview);
    vi.mocked(api.commitVocabularyImport).mockResolvedValue({ imported: 0, updated: 1, skipped: 0, total: 1, errors: [] });
    const imported = vi.fn();
    const user = userEvent.setup();
    render(<ImportVocabularyDialog open onClose={vi.fn()} onImported={imported}/>);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['word,meaning'], 'words.csv', { type: 'text/csv' })] } });
    await user.click(screen.getByRole('button', { name: 'Phân tích file' }));
    const meaning = await screen.findByLabelText('meaning dòng 2');
    await user.selectOptions(screen.getByLabelText('Bộ flashcard'), 'IELTS');
    await user.clear(meaning); await user.type(meaning, 'hiếu kỳ');
    await user.click(screen.getByText('Cập nhật'));
    await user.click(screen.getByRole('button', { name: 'Nhập 1 từ' }));
    await waitFor(() => expect(api.commitVocabularyImport).toHaveBeenCalledWith(expect.objectContaining({
      token: 'preview-token', duplicateStrategy: 'update', deck: 'IELTS', rows: [expect.objectContaining({ meaning: 'hiếu kỳ' })],
    })));
    expect(imported).toHaveBeenCalled();
    expect(await screen.findByText('Đã hoàn tất nhập từ vựng')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nhập file khác' }));
    expect(screen.getByText('Kéo thả file vào đây')).toBeInTheDocument();
  });
});
