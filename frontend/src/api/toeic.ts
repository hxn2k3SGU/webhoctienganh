import type { ToeicAttempt, ToeicCatalogItem, ToeicChoice, ToeicHistoryItem, ToeicImport } from '@lexiloop/shared';
import { request } from './client';

export const toeicApi = {
  catalog: () => request<{ tests: ToeicCatalogItem[] }>('/toeic/catalog'),
  history: () => request<ToeicHistoryItem[]>('/toeic/attempts'),
  attempt: (id: string) => request<ToeicAttempt>(`/toeic/attempts/${encodeURIComponent(id)}`),
  start: (input: { testId: string; mode: 'practice' | 'full'; part?: number; timeLimitMinutes?: number }) => request<ToeicAttempt>('/toeic/attempts', { method: 'POST', body: JSON.stringify(input) }),
  save: (id: string, input: { questionId: string; choice?: ToeicChoice | null; flagged?: boolean }) => request<ToeicAttempt>(`/toeic/attempts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  submit: (id: string) => request<ToeicAttempt>(`/toeic/attempts/${encodeURIComponent(id)}/submit`, { method: 'POST' }),
  import: (input: ToeicImport) => request<ToeicCatalogItem>('/toeic/tests', { method: 'POST', body: JSON.stringify(input) }),
};
