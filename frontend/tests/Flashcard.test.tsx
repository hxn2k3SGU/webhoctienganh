import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Flashcard } from '../src/components/study/Flashcard';
import { speak } from '../src/utils/speech';

vi.mock('../src/utils/speech', () => ({ speak: vi.fn(() => Promise.resolve()) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const card = { id: '1', word: 'resilient', pronunciation: '/rɪˈzɪliənt/', meaning: 'kiên cường', example: 'She remained resilient.', partOfSpeech: 'adjective', synonyms: ['strong'], tag: 'IELTS', status: 'New' as const };
describe('Flashcard', () => {
  it('flips by click and keyboard, speaking English when revealing the meaning', () => { const onFlip = vi.fn(); render(<Flashcard card={card} onFlip={onFlip}/>); const el = screen.getByRole('button', { name: 'Mặt trước thẻ' }); fireEvent.click(el); expect(screen.getByText('kiên cường')).toBeInTheDocument(); expect(speak).toHaveBeenCalledWith('resilient', undefined); expect(onFlip).toHaveBeenLastCalledWith(true); fireEvent.keyDown(window, { code: 'Space' }); expect(onFlip).toHaveBeenLastCalledWith(false); expect(speak).toHaveBeenCalledTimes(1); });
  it('has no image panel and keeps the card open when replaying audio', () => { const onFlip = vi.fn(); render(<Flashcard card={card} onFlip={onFlip}/>); fireEvent.click(screen.getByRole('button', { name: 'Mặt trước thẻ' })); const audio = screen.getByRole('button', { name: 'Phát âm' }); expect(screen.queryByRole('img')).not.toBeInTheDocument(); expect(document.querySelector('.card-media')).toBeNull(); fireEvent.click(audio); expect(onFlip).toHaveBeenLastCalledWith(true); expect(speak).toHaveBeenCalledTimes(2); });
});
