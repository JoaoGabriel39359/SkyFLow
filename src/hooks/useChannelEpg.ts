'use client';

import { useEffect, useMemo, useState } from 'react';
import { getShortEpg, type EpgProgram, type XtreamCredentials } from '@/lib/epg';

const EPG_CACHE_LIMIT = 100;
const epgCache = new Map<string, EpgProgram[]>();

function getCachedEpgPrograms(cacheKey: string) {
  const cachedPrograms = epgCache.get(cacheKey);

  if (!cachedPrograms) return null;

  epgCache.delete(cacheKey);
  epgCache.set(cacheKey, cachedPrograms);
  return cachedPrograms;
}

function setCachedEpgPrograms(cacheKey: string, programs: EpgProgram[]) {
  epgCache.delete(cacheKey);
  epgCache.set(cacheKey, programs);

  while (epgCache.size > EPG_CACHE_LIMIT) {
    const oldestKey = epgCache.keys().next().value;
    if (!oldestKey) return;
    epgCache.delete(oldestKey);
  }
}

type UseChannelEpgParams = {
  credentials?: XtreamCredentials | null;
  streamId?: string | number | null;
  enabled?: boolean;
  limit?: number;
};

export function useChannelEpg({
  credentials,
  streamId,
  enabled = true,
  limit = 8,
}: UseChannelEpgParams) {
  const [state, setState] = useState<{
    cacheKey: string;
    programs: EpgProgram[];
    isLoading: boolean;
    error: string | null;
  }>({
    cacheKey: '',
    programs: [],
    isLoading: false,
    error: null,
  });

  const cacheKey = credentials && streamId
    ? `${credentials.url}:${credentials.user}:${streamId}:${limit}`
    : '';
  const canLoad = Boolean(enabled && credentials && streamId && cacheKey);

  useEffect(() => {
    if (!canLoad || !credentials || !streamId) return undefined;

    const abortController = new AbortController();
    let ignoreResult = false;
    const timeout = window.setTimeout(() => {
      const cachedPrograms = getCachedEpgPrograms(cacheKey);
      if (cachedPrograms) {
        setState({
          cacheKey,
          programs: cachedPrograms,
          isLoading: false,
          error: null,
        });
        return;
      }

      setState({
        cacheKey,
        programs: [],
        isLoading: true,
        error: null,
      });

      getShortEpg(credentials, streamId, limit, abortController.signal)
        .then((nextPrograms) => {
          if (ignoreResult) return;

          setCachedEpgPrograms(cacheKey, nextPrograms);
          setState({
            cacheKey,
            programs: nextPrograms,
            isLoading: false,
            error: null,
          });
        })
        .catch((requestError) => {
          if (ignoreResult || abortController.signal.aborted) return;

          console.error('Erro ao carregar EPG:', requestError);
          setState({
            cacheKey,
            programs: [],
            isLoading: false,
            error: 'epg_unavailable',
          });
        });
    }, 0);

    return () => {
      ignoreResult = true;
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [cacheKey, canLoad, credentials, limit, streamId]);

  const programs = useMemo(() => {
    if (!canLoad || state.cacheKey !== cacheKey) {
      return [];
    }

    return state.programs;
  }, [cacheKey, canLoad, state.cacheKey, state.programs]);

  const isLoading = canLoad && state.cacheKey === cacheKey ? state.isLoading : false;
  const error = canLoad && state.cacheKey === cacheKey ? state.error : null;

  const currentProgram = useMemo(
    () => programs.find((program) => program.isCurrent) ?? programs[0] ?? null,
    [programs]
  );

  return {
    programs,
    currentProgram,
    isLoading,
    error,
    hasEpg: programs.length > 0,
  };
}
