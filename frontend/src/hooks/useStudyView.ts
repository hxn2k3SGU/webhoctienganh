import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { StudySource } from '../types';

/** Ghi nhận lượt xem cho một thẻ (gọi `useStudyViews` với một id). */
export function useStudyView(source: StudySource, sessionId?: string, cardId?: string) {
  useStudyViews(source, sessionId, cardId ? [cardId] : []);
}

/**
 * Ghi nhận lượt xem cho nhiều thẻ, mỗi thẻ chỉ một lần trong một phiên học.
 * Tự thử lại với các thẻ ghi nhận thất bại.
 */
export function useStudyViews(source: StudySource, sessionId: string | undefined, cardIds: string[]) {
  const client = useQueryClient();
  const key = JSON.stringify([...new Set(cardIds)].sort());
  useEffect(() => {
    const ids: string[] = JSON.parse(key);
    if (!sessionId || !ids.length) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    /** Gửi lượt xem cho các thẻ còn chờ; thử lại tối đa vài lần với thẻ bị lỗi. */
    const record = async (pending: string[], attempt: number) => {
      try {
        const failed: string[] = [];
        await Promise.all(pending.map(async id => {
          try { await api.recordStudyView(source, sessionId, id); }
          catch { failed.push(id); }
        }));
        void client.invalidateQueries({ queryKey: ['vocabulary'] });
        if (!cancelled && failed.length && attempt < 2) timer = setTimeout(() => void record(failed, attempt + 1), 2000);
      } catch {
        if (!cancelled && attempt < 2) timer = setTimeout(() => void record(pending, attempt + 1), 2000);
      }
    };
    void record(ids, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [source, sessionId, key, client]);
}
