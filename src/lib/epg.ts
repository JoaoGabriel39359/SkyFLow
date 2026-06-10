export type EpgProgram = {
  id?: string;
  title: string;
  description?: string;
  start: Date | string | number;
  end: Date | string | number;
  startTimeLabel: string;
  endTimeLabel: string;
  isCurrent: boolean;
  progressPercent?: number;
};

export type XtreamCredentials = {
  url: string;
  user: string;
  pass: string;
};

type RawEpgProgram = {
  id?: string | number;
  title?: string;
  name?: string;
  description?: string;
  desc?: string;
  start?: string | number;
  end?: string | number;
  stop?: string | number;
  start_timestamp?: string | number;
  stop_timestamp?: string | number;
};

type RawEpgResponse = {
  epg_listings?: RawEpgProgram[];
};

const EMPTY_TIME = '--:--';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const safeDecodeBase64 = (value?: string | number) => {
  if (value === undefined || value === null) return '';

  const text = String(value).trim();
  if (!text) return '';

  const compactText = text.replace(/\s/g, '');
  const canTryDecode =
    compactText.length >= 8 &&
    compactText.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(compactText);

  if (!canTryDecode || typeof atob === 'undefined') {
    return text;
  }

  try {
    const binary = atob(compactText);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder('utf-8').decode(bytes).trim();

    if (decoded && /[A-Za-z0-9]/.test(decoded)) {
      return decoded;
    }
  } catch {
    return text;
  }

  return text;
};

const parseDateValue = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'number' || /^\d+$/.test(String(value).trim())) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return null;

    const timestampMs = numberValue > 9999999999 ? numberValue : numberValue * 1000;
    const date = new Date(timestampMs);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const normalizedValue = String(value).trim().replace(' ', 'T');
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTime = (date: Date | null) => {
  if (!date) return EMPTY_TIME;

  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const getProgressPercent = (startDate: Date | null, endDate: Date | null, nowMs: number) => {
  if (!startDate || !endDate) return undefined;

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  if (endMs <= startMs || nowMs < startMs || nowMs > endMs) return undefined;

  return Math.min(100, Math.max(0, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100)));
};

const getRawPrograms = (data: unknown): RawEpgProgram[] => {
  if (Array.isArray(data)) return data.filter(isRecord) as RawEpgProgram[];

  if (!isRecord(data)) return [];

  const response = data as RawEpgResponse;
  if (Array.isArray(response.epg_listings)) {
    return response.epg_listings.filter(isRecord) as RawEpgProgram[];
  }

  return [];
};

export const normalizeEpgPrograms = (data: unknown): EpgProgram[] => {
  const nowMs = Date.now();

  return getRawPrograms(data)
    .map((program) => {
      const startDate = parseDateValue(program.start_timestamp ?? program.start);
      const endDate = parseDateValue(program.stop_timestamp ?? program.end ?? program.stop);
      const startMs = startDate?.getTime();
      const endMs = endDate?.getTime();
      const hasValidRange = startMs !== undefined && endMs !== undefined && endMs > startMs;
      const isCurrent = Boolean(hasValidRange && nowMs >= startMs && nowMs <= endMs);
      const title = safeDecodeBase64(program.title ?? program.name) || 'Sem titulo';
      const description = safeDecodeBase64(program.description ?? program.desc);

      return {
        id: program.id !== undefined ? String(program.id) : undefined,
        title,
        description: description || undefined,
        start: startDate ?? program.start_timestamp ?? program.start ?? '',
        end: endDate ?? program.stop_timestamp ?? program.end ?? program.stop ?? '',
        startTimeLabel: formatTime(startDate),
        endTimeLabel: formatTime(endDate),
        isCurrent,
        progressPercent: getProgressPercent(startDate, endDate, nowMs),
      };
    })
    .filter((program) => program.title)
    .sort((first, second) => {
      const firstTime = first.start instanceof Date ? first.start.getTime() : 0;
      const secondTime = second.start instanceof Date ? second.start.getTime() : 0;
      return firstTime - secondTime;
    });
};

export async function getShortEpg(
  credentials: XtreamCredentials,
  streamId: string | number,
  limit = 8,
  signal?: AbortSignal
) {
  if (!credentials.url || !credentials.user || !credentials.pass || !streamId) {
    return [];
  }

  const proxyUrl =
    `/api/xtream?url=${encodeURIComponent(credentials.url)}` +
    `&username=${encodeURIComponent(credentials.user)}` +
    `&password=${encodeURIComponent(credentials.pass)}` +
    `&action=get_short_epg` +
    `&stream_id=${encodeURIComponent(String(streamId))}` +
    `&limit=${encodeURIComponent(String(limit))}`;

  const response = await fetch(proxyUrl, { signal });

  if (!response.ok) {
    return [];
  }

  return normalizeEpgPrograms(await response.json()).slice(0, limit);
}
