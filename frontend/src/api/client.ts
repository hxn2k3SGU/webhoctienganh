import type { AuthResponse, DashboardData, ImportCommitInput, ImportCommitResult, ImportPreview, Paginated, QuizQuestion, QuizType, Rating, Settings, SetupStatus, StudyMode, StudyQueue, Vocabulary, VocabularyInput, WordStatus } from '../types';

const BASE = '/api';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let csrfToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export class ApiError extends Error {
  /** @param status Mã HTTP server trả về. @param details Nội dung lỗi chi tiết (nếu có). */
  constructor(message: string, public status: number, public details?: unknown) { super(message); }
}

/** Lưu CSRF token dùng cho các request thay đổi dữ liệu. */
export function setCsrfToken(token?: string | null) { csrfToken = token ?? null; }
/** Đăng ký hàm được gọi khi phiên đăng nhập hết hạn hẳn (401 sau khi đã thử refresh). */
export function setUnauthorizedHandler(handler: (() => void) | null) { unauthorizedHandler = handler; }

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/setup', '/auth/refresh', '/auth/session', '/auth/setup-status', '/auth/logout'];
let refreshing: Promise<AuthResponse | null> | null = null;

/**
 * Gọi `/auth/refresh` để lấy access token mới bằng refresh token trong cookie.
 * Nhiều request cùng lúc chỉ dùng chung một lần refresh.
 * @returns Phiên mới, hoặc `null` nếu refresh token không còn hợp lệ.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async response => {
      if (!response.ok) return null;
      const body = await response.json() as AuthResponse;
      csrfToken = body.csrfToken;
      return body;
    })
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

/** Lấy CSRF token đã lưu, hoặc hỏi server nếu chưa có. */
async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${BASE}/auth/csrf`, { credentials: 'include' });
  if (response.ok) {
    const body = await response.json() as { csrfToken?: string };
    csrfToken = body.csrfToken ?? null;
  }
  return csrfToken;
}

/**
 * Gửi request tới API kèm cookie và CSRF token.
 * Nếu nhận 401 thì tự refresh token và gửi lại request một lần.
 * @param path Đường dẫn API, không gồm tiền tố `/api`.
 * @throws {ApiError} Khi server trả lỗi.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (UNSAFE_METHODS.has(method) && !AUTH_PATHS.includes(path)) {
    const token = await getCsrfToken();
    if (token) headers.set('X-CSRF-Token', token);
  }
  let response = await fetch(`${BASE}${path}`, { ...init, method, headers, credentials: 'include' });
  if (response.status === 401 && !AUTH_PATHS.includes(path) && await refreshSession()) {
    if (UNSAFE_METHODS.has(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
    response = await fetch(`${BASE}${path}`, { ...init, method, headers, credentials: 'include' });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    if (response.status === 401 && !['/auth/login', '/auth/register', '/auth/setup'].includes(path)) unauthorizedHandler?.();
    const fallback = response.status === 409 ? 'Dữ liệu bị trùng với bản ghi đã có.' : response.status === 400 ? 'Thông tin nhập chưa hợp lệ.' : response.status === 403 ? 'Phiên làm việc không hợp lệ. Vui lòng tải lại trang.' : 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
    throw new ApiError(body?.message ?? fallback, response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  /** Lấy các nhóm từ bị trùng. */
  duplicatePreview: () => request<number[][]>('/vocabulary/duplicates'),
  /** Xóa từ trùng theo các nhóm đã xem trước. */
  removeDuplicates: (groups: number[][]) => request<{ deleted: number; groups: number }>('/vocabulary/duplicates/remove', { method: 'POST', body: JSON.stringify({ groups }) }),
  /** Ghi nhận một lượt xem từ để thống kê. */
  recordStudyView: (source: import('../types').StudySource, sessionId: string, cardId: string) => request<void>('/study/view', { method: 'POST', body: JSON.stringify({ source, sessionId, cardId }) }),
  /** Lấy số thẻ mới, thẻ đến hạn và thời điểm đến hạn gần nhất. */
  studySummary: (deck = '') => request<{ total: number; newCount: number; dueCount: number; nextDue: string | null }>(`/study/summary?deck=${encodeURIComponent(deck)}`),
  /** Lấy chuỗi ngày học, số từ đã thuộc và huy hiệu. */
  progress: () => request<{ streak: number; longest: number; learned: number; studiedToday: boolean; days: string[]; achievements: { id: string; title: string; kind: string; target: number; value: number; unlockedAt: string | null }[] }>('/progress'),
  /** Lấy danh sách deck kèm số thẻ. */
  decks: () => request<{ name: string; count: number }[]>('/decks'),
  /** Tìm ảnh minh họa cho từ bằng AI. */
  searchImages: (word: string, meaning: string) => request<{ query: string; images: { url: string; sourceUrl: string; title: string; artist: string; license: string }[] }>('/images/search', { method: 'POST', body: JSON.stringify({ word, meaning }) }),
  /** Đăng ký tài khoản mới. */
  register: (username: string, password: string) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  /** Kiểm tra hệ thống đã có tài khoản nào chưa. */
  setupStatus: () => request<SetupStatus>('/auth/setup-status'),
  /** Tạo tài khoản đầu tiên. */
  setup: (username: string, password: string) => request<AuthResponse>('/auth/setup', { method: 'POST', body: JSON.stringify({ username, password }) }),
  /** Đăng nhập. */
  login: (username: string, password: string) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  /** Lấy phiên đăng nhập hiện tại (server tự refresh nếu cần). */
  session: () => request<AuthResponse>('/auth/session'),
  /** Đăng xuất thiết bị hiện tại. */
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  /** Đăng xuất khỏi mọi thiết bị. */
  logoutAll: () => request<void>('/auth/logout-all', { method: 'POST' }),
  /** Lấy số liệu trang tổng quan. */
  dashboard: () => request<DashboardData>('/dashboard'),
  /** Lấy danh sách từ vựng theo bộ lọc, sắp xếp và phân trang. */
  vocabulary: (params: URLSearchParams) => request<Paginated<Vocabulary>>(`/vocabulary?${params}`),
  /** Lấy tối đa 200 từ để dùng làm dữ liệu cho trò chơi. */
  vocabularyOptions: () => request<Paginated<Vocabulary>>('/vocabulary?page=1&pageSize=200'),
  /** Thêm từ vựng mới. */
  createWord: (data: VocabularyInput) => request<Vocabulary>('/vocabulary', { method: 'POST', body: JSON.stringify(data) }),
  /** Cập nhật từ vựng. */
  updateWord: (id: string, data: VocabularyInput) => request<Vocabulary>(`/vocabulary/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  /** Xóa từ vựng. */
  deleteWord: (id: string) => request<void>(`/vocabulary/${id}`, { method: 'DELETE' }),
  /** Tải ảnh lên server và nhận lại URL. */
  uploadMedia: (file: File) => { const body = new FormData(); body.append('file', file); return request<{ url: string; mimeType: string; size: number }>('/media', { method: 'POST', body }); },
  /** Gửi file nhập để server đọc và trả bản xem trước. */
  previewVocabularyImport: async (file: File, metadata: { tag: string; status: WordStatus }) => {
    const body = new FormData(); body.append('file', file);
    const preview = await request<Omit<ImportPreview, 'issues'> & { errors?: { row: number; message: string }[]; issues?: ImportPreview['issues'] }>('/vocabulary/import/preview', { method: 'POST', body });
    return { ...preview, rows: preview.rows.map(row => ({ ...row, tag: row.tag || metadata.tag, status: row.status || metadata.status })), issues: preview.issues ?? (preview.errors ?? []).map(error => ({ ...error, severity: 'error' as const })) };
  },
  /** Xác nhận nhập các dòng từ vựng đã xem trước. */
  commitVocabularyImport: async (data: ImportCommitInput) => {
    const result = await request<Omit<ImportCommitResult, 'errors'> & { errors?: ImportCommitResult['errors'] }>('/vocabulary/import/commit', { method: 'POST', body: JSON.stringify(data) });
    return { ...result, errors: result.errors ?? [] };
  },
  /** Tạo đường dẫn tải file xuất từ vựng (CSV, XLSX, JSON). */
  exportUrl: (format: 'csv' | 'xlsx' | 'json', query = '') => `${BASE}/vocabulary/export?format=${format}&${query}`,
  /** Lấy hàng đợi thẻ để học theo chế độ và deck. */
  studyQueue: (mode: StudyMode, limit = 20, deck = '') => request<StudyQueue>(`/study/queue?mode=${mode}&limit=${limit}&deck=${encodeURIComponent(deck)}&timezoneOffset=${new Date().getTimezoneOffset()}`),
  /** Gửi đánh giá Again/Hard/Good/Easy cho một thẻ. */
  rate: (vocabularyId: string, rating: Rating, sessionId?: string) => request('/study/review', { method: 'POST', body: JSON.stringify({ vocabularyId, rating, sessionId, reviewedAt: new Date().toISOString() }) }),
  /** Tạo một lượt quiz theo loại, số câu và deck. */
  quiz: (type: QuizType, count = 10, deck = '') => request<{ sessionId: string; questions: QuizQuestion[] }>(`/quiz?type=${type}&count=${count}&deck=${encodeURIComponent(deck)}`),
  /** Nộp bài quiz và nhận kết quả chấm điểm. */
  submitQuiz: (sessionId: string, answers: { questionId: string; answer: string; revealedHintPositions: number[] }[]) => request<{ score: number; total: number; points: number; maxPoints: number; percentage: number; results: { questionId: string; correct: boolean; answer: string; revealedHintPositions: number[]; earnedPoints: number }[] }>('/quiz/submit', { method: 'POST', body: JSON.stringify({ sessionId, answers }) }),
  /** Lấy cài đặt người dùng. */
  settings: () => request<Settings>('/settings'),
  /** Lưu cài đặt người dùng. */
  saveSettings: (data: Settings) => request<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
};
