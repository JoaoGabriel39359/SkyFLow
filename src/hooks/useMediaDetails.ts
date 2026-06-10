'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getMediaDetails,
  type MediaDetails,
  type MediaDetailsSeed,
  type MediaDetailsType,
} from '@/lib/mediaDetails';
import type { XtreamCredentials } from '@/lib/epg';

const MEDIA_DETAILS_CACHE_LIMIT = 120;
const mediaDetailsCache = new Map<string, MediaDetails | null>();

const getCachedMediaDetails = (cacheKey: string) => {
  if (!mediaDetailsCache.has(cacheKey)) return undefined;

  const cachedDetails = mediaDetailsCache.get(cacheKey) ?? null;
  mediaDetailsCache.delete(cacheKey);
  mediaDetailsCache.set(cacheKey, cachedDetails);
  return cachedDetails;
};

const setCachedMediaDetails = (cacheKey: string, details: MediaDetails | null) => {
  mediaDetailsCache.delete(cacheKey);
  mediaDetailsCache.set(cacheKey, details);

  while (mediaDetailsCache.size > MEDIA_DETAILS_CACHE_LIMIT) {
    const oldestKey = mediaDetailsCache.keys().next().value;
    if (!oldestKey) return;
    mediaDetailsCache.delete(oldestKey);
  }
};

type UseMediaDetailsParams = {
  credentials?: XtreamCredentials | null;
  mediaType?: MediaDetailsType | null;
  streamId?: string | number | null;
  seed?: MediaDetailsSeed | null;
  enabled?: boolean;
};

export function useMediaDetails({
  credentials,
  mediaType,
  streamId,
  seed,
  enabled = true,
}: UseMediaDetailsParams) {
  const [state, setState] = useState<{
    cacheKey: string;
    details: MediaDetails | null;
    isLoading: boolean;
    error: string | null;
  }>({
    cacheKey: '',
    details: null,
    isLoading: false,
    error: null,
  });

  const seedKey = useMemo(
    () => JSON.stringify(seed ?? {}),
    [seed]
  );
  const cacheKey = credentials && mediaType && streamId
    ? `${credentials.url}:${credentials.user}:${mediaType}:${streamId}:${seedKey}`
    : '';
  const canLoad = Boolean(enabled && credentials && mediaType && streamId && cacheKey);

  useEffect(() => {
    if (!canLoad || !credentials || !mediaType || !streamId) return undefined;

    const abortController = new AbortController();
    let ignoreResult = false;
    const timeout = window.setTimeout(() => {
      const cachedDetails = getCachedMediaDetails(cacheKey);
      if (cachedDetails !== undefined) {
        setState({
          cacheKey,
          details: cachedDetails,
          isLoading: false,
          error: null,
        });
        return;
      }

      setState({
        cacheKey,
        details: null,
        isLoading: true,
        error: null,
      });

      getMediaDetails(credentials, mediaType, streamId, seed, abortController.signal)
        .then((nextDetails) => {
          if (ignoreResult) return;

          setCachedMediaDetails(cacheKey, nextDetails);
          setState({
            cacheKey,
            details: nextDetails,
            isLoading: false,
            error: null,
          });
        })
        .catch(() => {
          if (ignoreResult || abortController.signal.aborted) return;

          setCachedMediaDetails(cacheKey, null);
          setState({
            cacheKey,
            details: null,
            isLoading: false,
            error: 'details_unavailable',
          });
        });
    }, 260);

    return () => {
      ignoreResult = true;
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [cacheKey, canLoad, credentials, mediaType, seed, streamId]);

  const details = canLoad && state.cacheKey === cacheKey ? state.details : null;
  const isLoading = canLoad && state.cacheKey === cacheKey ? state.isLoading : false;
  const error = canLoad && state.cacheKey === cacheKey ? state.error : null;

  return {
    details,
    isLoading,
    error,
    hasDetails: Boolean(details),
  };
}
