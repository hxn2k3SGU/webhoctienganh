import type { Vocabulary } from '../types';
import { shuffle } from './matchingGame';

export type Shape = [number, number][];
export const shapes: Shape[] = [ [[0,0]], [[0,0],[0,1]], [[0,0],[1,0]], [[0,0],[0,1],[0,2]], [[0,0],[1,0],[1,1]], [[0,0],[0,1],[1,0],[1,1]] ];
/**
 * Kiểm tra khối có đặt vừa bàn 8x8 tại vị trí cho trước không.
 * @param anchor Chỉ số ô góc trên trái của khối.
 */
export function canPlace(board: number[], shape: Shape, anchor: number) {
  const row = Math.floor(anchor / 8), col = anchor % 8;
  return shape.every(([r,c]) => row+r < 8 && col+c < 8 && board[(row+r)*8+col+c] === 0);
}
/**
 * Đặt khối lên bàn và xóa các hàng/cột đã đầy.
 * @returns Bàn mới và số hàng/cột đã xóa, hoặc `null` nếu không đặt được.
 */
export function placeShape(board: number[], shape: Shape, anchor: number, color: number) {
  if (!canPlace(board, shape, anchor)) return null;
  const next = [...board];
  const row = Math.floor(anchor / 8), col = anchor % 8;
  shape.forEach(([r,c]) => { next[(row+r)*8+col+c] = color; });
  const fullRows = Array.from({length:8},(_,r)=>r).filter(r=>next.slice(r*8,r*8+8).every(Boolean));
  const fullCols = Array.from({length:8},(_,c)=>c).filter(c=>Array.from({length:8},(_,r)=>next[r*8+c]).every(Boolean));
  // Detect both directions before clearing their shared cells.
  fullRows.forEach(r=>{ for(let c=0;c<8;c++) next[r*8+c]=0; });
  fullCols.forEach(c=>{ for(let r=0;r<8;r++) next[r*8+c]=0; });
  return { board: next, lines: fullRows.length + fullCols.length };
}
/** Lấy các khối còn đặt được ở ít nhất một vị trí trên bàn. */
export function availableShapes(board: number[]) {
  return shapes.filter(shape=>board.some((_,i)=>canPlace(board,shape,i)));
}
export interface ArcadeQuestion { vocabularyId: string; prompt: string; answer: string; options: string[]; }
/**
 * Tạo câu hỏi trắc nghiệm cho trò chơi arcade từ danh sách từ.
 * @param reverse `true` để hỏi nghĩa và chọn từ tiếng Anh.
 */
export function arcadeQuestions(words: Vocabulary[], count: number, reverse: boolean): ArcadeQuestion[] {
  const seen = new Set<string>();
  const clean = shuffle(words).filter(word=>{
    const key = word.word.trim().toLocaleLowerCase();
    if (!key || !word.meaning.trim() || seen.has(key)) return false;
    seen.add(key); return true;
  });
  return clean.slice(0,count).map(word=>{
    const answer = reverse ? word.word : word.meaning;
    const alternatives = [...new Set(clean.map(item=>reverse?item.word:item.meaning))].filter(item=>item.trim().toLocaleLowerCase()!==answer.trim().toLocaleLowerCase());
    return { vocabularyId: word.id, prompt: reverse?word.meaning:word.word, answer, options: shuffle([answer,...shuffle(alternatives).slice(0,3)]) };
  });
}
