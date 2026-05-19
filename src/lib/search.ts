const SEARCH_LOCALE = 'pt-BR';

export type SearchIndexEntry<T> = {
  item: T;
  normalized: string;
  compact: string;
};

export function normalizeSearchText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase(SEARCH_LOCALE)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function hasSearchQuery(query: string) {
  return normalizeSearchText(query).length > 0;
}

export function createSearchMatcher(query: string): (value: string) => boolean {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return () => true;
  }

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const compactQuery = normalizedQuery.replace(/\s/g, '');

  return (value: string) => {
    const normalizedValue = normalizeSearchText(value);
    const compactValue = normalizedValue.replace(/\s/g, '');

    return (
      normalizedValue.includes(normalizedQuery) ||
      compactValue.includes(compactQuery) ||
      queryTokens.every((token) => normalizedValue.includes(token))
    );
  };
}

export function createSearchIndex<T>(items: T[], getText: (item: T) => string): SearchIndexEntry<T>[] {
  return items.map((item) => {
    const normalized = normalizeSearchText(getText(item));

    return {
      item,
      normalized,
      compact: normalized.replace(/\s/g, ''),
    };
  });
}

export function createIndexedSearchMatcher<T>(query: string): (entry: SearchIndexEntry<T>) => boolean {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return () => true;
  }

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const compactQuery = normalizedQuery.replace(/\s/g, '');

  return (entry) => (
    entry.normalized.includes(normalizedQuery) ||
    entry.compact.includes(compactQuery) ||
    queryTokens.every((token) => entry.normalized.includes(token))
  );
}
