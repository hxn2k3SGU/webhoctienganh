import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ArcadePage } from '../src/pages/ArcadePage';
import { GameCatalogPage } from '../src/pages/GameCatalogPage';
import { api } from '../src/api/client';
import { canPlace, placeShape, arcadeQuestions } from '../src/utils/arcade';
import type { Vocabulary } from '../src/types';
vi.mock('../src/api/client',()=>({api:{decks:vi.fn(),settings:vi.fn(),studyQueue:vi.fn(),recordStudyView:vi.fn()}}));
const words:Vocabulary[]=[{id:'1',word:'apple',meaning:'táo',synonyms:[],tag:'',status:'New'},{id:'2',word:'pear',meaning:'lê',synonyms:[],tag:'',status:'New'}];
let client:QueryClient;
afterEach(()=>{cleanup();client?.clear();vi.restoreAllMocks()});
function setup(game:'blocks'|'blast'){
  vi.mocked(api.recordStudyView).mockResolvedValue(undefined);
  vi.spyOn(Math,'random').mockReturnValue(.999);
  vi.mocked(api.decks).mockResolvedValue([]);
  vi.mocked(api.settings).mockResolvedValue({soundEffects:false,dailyNewLimit:10,dailyReviewLimit:20,autoPlayAudio:false,showExamplesFirst:false,theme:'dark'});
  vi.mocked(api.studyQueue).mockResolvedValue({cards:words,mode:'random'});
  client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<MemoryRouter><QueryClientProvider client={client}><ArcadePage game={game}/></QueryClientProvider></MemoryRouter>);
}
it('rejects overlap and edge wrapping and clears intersecting full lines',()=>{
  const board=Array(64).fill(0);
  expect(canPlace(board,[[0,0],[0,1]],7)).toBe(false);
  for(let i=1;i<8;i++){board[i]=1;board[i*8]=1}
  expect(canPlace(board,[[0,0]],1)).toBe(false);
  const result=placeShape(board,[[0,0]],0,2)!;
  expect(result.lines).toBe(2);expect(result.board.every(cell=>cell===0)).toBe(true);
});
it('creates distinct choices and honors the question direction',()=>{
  const qs=arcadeQuestions(words,10,true);
  expect(qs).toHaveLength(2);
  for(const q of qs){expect(['táo','lê']).toContain(q.prompt);expect(q.options).toContain(q.answer);expect(new Set(q.options).size).toBe(q.options.length)}
});
it('offers separate game entries',()=>{
  render(<MemoryRouter><GameCatalogPage/></MemoryRouter>);
  for(const path of ['blocks','blast','match','memory'])expect(document.querySelector(`a[href="/games/${path}"]`)).not.toBeNull();
});
it('requires a correct word before placing a block',async()=>{
  setup('blocks');fireEvent.click(screen.getByRole('button',{name:'Bắt đầu chơi'}));
  const input=await screen.findByLabelText('Từ tiếng Anh');
  await waitFor(()=>expect(api.recordStudyView).toHaveBeenCalledWith('blocks',expect.any(String),'1'));
  const cell=screen.getByRole('button',{name:'Hàng 1, cột 1'});
  expect(cell).toBeDisabled();
  fireEvent.change(input,{target:{value:'wrong'}});fireEvent.click(screen.getByRole('button',{name:'Kiểm tra'}));
  expect(cell).toBeDisabled();
  fireEvent.change(input,{target:{value:'apple'}});fireEvent.click(screen.getByRole('button',{name:'Kiểm tra'}));
  expect(cell).toBeEnabled();fireEvent.click(cell);
  expect(screen.getByRole('button',{name:'Hàng 1, cột 1, đã có khối'})).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'lê'})).toBeInTheDocument();
  await waitFor(()=>expect(api.recordStudyView).toHaveBeenCalledWith('blocks',expect.any(String),'2'));
});
it('locks shots during feedback and finishes after the last target',async()=>{
  setup('blast');fireEvent.click(screen.getByRole('button',{name:'Bắt đầu chơi'}));
  const first=await screen.findByRole('button',{name:/táo/});
  fireEvent.click(first);expect(first).toBeDisabled();
  await waitFor(()=>expect(screen.getByRole('heading',{name:'pear'})).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:/lê/}));
  expect(await screen.findByRole('heading',{name:'Hoàn thành nhiệm vụ!'})).toBeInTheDocument();
  expect(screen.getByText('220',{selector:'strong'})).toBeInTheDocument();
  fireEvent.keyDown(window,{key:'Enter'});
  expect(await screen.findByRole('heading',{name:'apple'})).toBeInTheDocument();
});
it('ends Blast when its deadline expires',async()=>{
  setup('blast');fireEvent.click(screen.getByRole('button',{name:'Bắt đầu chơi'}));
  await screen.findByRole('heading',{name:'apple'});
  const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now+130000);
  expect(await screen.findByRole('heading',{name:'Hết giờ!'})).toBeInTheDocument();
});
it('shows loading failures and allows retry',async()=>{
  setup('blast');vi.mocked(api.studyQueue).mockRejectedValueOnce(new Error('Offline'));
  fireEvent.click(screen.getByRole('button',{name:'Bắt đầu chơi'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
  fireEvent.click(screen.getByRole('button',{name:'Bắt đầu chơi'}));
  expect(await screen.findByRole('heading',{name:'apple'})).toBeInTheDocument();
});
