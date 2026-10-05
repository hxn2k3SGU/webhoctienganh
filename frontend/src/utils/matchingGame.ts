import type { Vocabulary } from '../types';

export interface MatchingCard { id: string; pairId: string; kind: 'word' | 'meaning'; text: string; }

/** Trộn ngẫu nhiên mảng (thuật toán Fisher–Yates), không sửa mảng gốc. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Tạo bộ thẻ cho trò chơi ghép cặp từ–nghĩa, bỏ các từ hoặc nghĩa bị trùng. */
export function matchingCards(words: Vocabulary[], count: number): MatchingCard[] {
  const seenWords = new Set<string>(), seenMeanings = new Set<string>();
  /** Chuẩn hóa chuỗi để so sánh trùng lặp. */
  const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
  // Duplicate faces would make the intended pair ambiguous.
  const unique = shuffle(words).filter(item => {
    const word = normalize(item.word), meaning = normalize(item.meaning);
    if (!word || !meaning || seenWords.has(word) || seenMeanings.has(meaning)) return false;
    seenWords.add(word); seenMeanings.add(meaning);
    return true;
  }).slice(0, count);
  return shuffle(unique.flatMap(item => [
    { id: `${item.id}:word`, pairId: item.id, kind: 'word' as const, text: item.word },
    { id: `${item.id}:meaning`, pairId: item.id, kind: 'meaning' as const, text: item.meaning },
  ]));
}
