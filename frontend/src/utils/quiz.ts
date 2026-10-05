const letterOrNumber = /[\p{L}\p{N}]/u;

/** Chuẩn hóa câu trả lời quiz (khoảng trắng, dấu nháy, chữ thường). */
export function normalizeQuizAnswer(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/’/g, "'").toLocaleLowerCase('en');
}

/** Đếm số chữ cái và chữ số trong chuỗi. */
export function countQuizLetters(value: string) {
  return Array.from(value).filter(character => letterOrNumber.test(character)).length;
}

/** Đếm số ký tự đầu mà người dùng đã gõ đúng. */
export function matchingPrefixLength(answer: string, input: string) {
  const expected = Array.from(normalizeQuizAnswer(answer));
  const actual = Array.from(normalizeQuizAnswer(input));
  let length = 0;
  while (length < expected.length && length < actual.length && expected[length] === actual[length]) length += 1;
  return length;
}

/** Tìm vị trí chữ cái tiếp theo cần gợi ý. */
export function nextHintPosition(answer: string, input: string, revealedPositions: Iterable<number>) {
  const characters = Array.from(normalizeQuizAnswer(answer));
  const revealed = new Set(revealedPositions);
  const prefixLength = matchingPrefixLength(answer, input);
  for (let index = prefixLength; index < characters.length; index += 1) {
    if (letterOrNumber.test(characters[index]) && !revealed.has(index)) return index;
  }
  for (let index = 0; index < characters.length; index += 1) {
    if (letterOrNumber.test(characters[index]) && !revealed.has(index)) return index;
  }
  return undefined;
}

/** Tạo chuỗi gợi ý: hiện các chữ đã gõ đúng hoặc đã mở, còn lại thay bằng `_`. */
export function buildLetterHint(answer: string, input: string, revealedPositions: Iterable<number>) {
  const characters = Array.from(normalizeQuizAnswer(answer));
  const revealed = new Set(revealedPositions);
  const prefixLength = matchingPrefixLength(answer, input);
  return characters.map((character, index) => {
    if (!letterOrNumber.test(character)) return character;
    return index < prefixLength || revealed.has(index) ? character : '_';
  }).join('');
}

/** Tính điểm câu nghe (0–100) theo số chữ cái đã được gợi ý. */
export function listeningPoints(answer: string, revealedCount: number) {
  const total = countQuizLetters(answer);
  if (!total) return 100;
  return Math.round(Math.max(0, total - Math.min(total, revealedCount)) / total * 100);
}
