export interface AuthUser { id?: string; username: string; displayName?: string; }
export interface AuthResponse { user: AuthUser; csrfToken: string; accessTokenExpiresAt?: string; refreshTokenExpiresAt?: string; }
export interface SetupStatus { setupRequired: boolean; }

export type WordStatus = 'New' | 'Learning' | 'Review' | 'Mastered';
export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type StudySource = 'flashcard' | 'quiz' | 'match' | 'memory' | 'blocks' | 'blast' | 'vocabulary';

export interface Vocabulary {
  id: string;
  word: string;
  pronunciation?: string;
  meaning: string;
  example?: string;
  partOfSpeech?: string;
  synonyms: string[];
  imageUrl?: string;
  audioUrl?: string;
  tag: string;
  deck?: string;
  status: WordStatus;
  reviewCount?: number;
  nextReviewDate?: string;
  createdAt?: string;
}

export interface Paginated<T> { data: T[]; page: number; pageSize: number; total: number; }
export interface VocabularyInput extends Omit<Vocabulary, 'id' | 'status' | 'createdAt' | 'nextReviewDate' | 'reviewCount'> { status?: WordStatus; }
export interface StudyQueue { cards: Vocabulary[]; mode: StudyMode; sessionId?: string; }
export type StudyMode = 'daily' | 'new' | 'random';
export type QuizType = 'meaning' | 'typing' | 'cloze' | 'listening';
export interface QuizQuestion { id: string; vocabularyId: string; type: QuizType; prompt: string; meaningHint?: string; partOfSpeech?: string; answer: string; options?: string[]; audioUrl?: string; example?: string; }
export interface DashboardData { dueToday: number; newAvailable: number; mastered: number; streak: number; reviewedThisWeek: number; activity: { date: string; reviews: number; newWords: number }[]; statuses: { name: string; value: number }[]; tags: { name: string; value: number }[]; }
export interface Settings { quizQuestionCount?: number; soundEffects?: boolean; soundEffectsVolume?: number; speechVolume?: number; dailyNewLimit: number; dailyReviewLimit: number; autoPlayAudio: boolean; showExamplesFirst: boolean; theme: 'light' | 'dark' | 'system'; }

export type DuplicateStrategy = 'skip' | 'update';
export interface ImportVocabularyRow extends VocabularyInput {}
export interface ImportIssue { row: number; field?: keyof ImportVocabularyRow; message: string; severity: 'warning' | 'error'; }
export interface ImportPreview { token: string; expiresAt: string; format: 'csv' | 'xlsx' | 'pdf'; rows: ImportVocabularyRow[]; issues: ImportIssue[]; duplicates?: number; }
export interface ImportCommitInput { deck?: string; token: string; rows: ImportVocabularyRow[]; duplicateStrategy: DuplicateStrategy; }
export interface ImportCommitResult { imported: number; updated: number; skipped: number; total: number; errors: { row: number; message: string }[]; }
