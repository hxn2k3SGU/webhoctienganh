import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AiImagePicker } from '../src/components/vocabulary/AiImagePicker';
import { api } from '../src/api/client';

it('searches using the word meaning and selects the returned image', async () => {
  const url = 'https://upload.wikimedia.org/apple.jpg';
  const search = vi.spyOn(api, 'searchImages').mockResolvedValue({ query: 'apple fruit', images: [{ url, sourceUrl: 'https://commons.wikimedia.org/wiki/File:Apple.jpg', title: 'Apple', artist: 'Author', license: 'CC BY' }] });
  const select = vi.fn();
  try {
    render(<AiImagePicker word="apple" meaning="fruit" selected="" onSelect={select}/>);
    await userEvent.click(screen.getByRole('button', { name: /AI/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Apple/ }));
    expect(search).toHaveBeenCalledWith('apple', 'fruit');
    expect(select).toHaveBeenCalledWith(url);
  } finally { search.mockRestore(); }
});
