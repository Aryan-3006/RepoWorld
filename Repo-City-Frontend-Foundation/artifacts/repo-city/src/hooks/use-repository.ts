import { useCallback, useEffect, useState } from 'react';
import { analyzeRepository, getRepository } from '@/services/api';
import type { Repository } from '@/types/repository';

export function useRepository(repositoryId?: string) {
  const [repository, setRepository] = useState<Repository | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(repositoryId));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!repositoryId) return;
    setIsLoading(true);
    getRepository(repositoryId).then(setRepository).catch(() => setError('Unable to load this repository.')).finally(() => setIsLoading(false));
  }, [repositoryId]);
  const analyze = useCallback(async (url: string) => {
    setIsLoading(true); setError(null);
    try { const result = await analyzeRepository(url); setRepository(result); return result; }
    catch { setError('This repository could not be analyzed.'); throw new Error('analysis failed'); }
    finally { setIsLoading(false); }
  }, []);
  return { repository, isLoading, error, analyze };
}