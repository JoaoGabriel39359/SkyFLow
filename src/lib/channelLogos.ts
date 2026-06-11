import type { ChannelListViewChannel } from '@/components/ChannelListView';

const LOGO_MISSING_MARKERS = [
  'no-logo',
  'no_logo',
  'nologo',
  'noimage',
  'no-image',
  'notfound',
  'not-found',
  'placeholder',
  'unavailable',
  'sem-logo',
  'sem_logo',
];

const CHANNEL_LOGO_BRANDS = [
  { key: 'sportv', label: 'sportv', aliases: ['sportv', 'sport tv', 'sport-tv'] },
  { key: 'espn', label: 'ESPN', aliases: ['espn'] },
  { key: 'premiere', label: 'Premiere', aliases: ['premiere', 'premier'] },
  { key: 'combate', label: 'Combate', aliases: ['combate'] },
  { key: 'globo', label: 'Globo', aliases: ['globo'] },
  { key: 'record', label: 'Record', aliases: ['record'] },
  { key: 'sbt', label: 'SBT', aliases: ['sbt'] },
  { key: 'band', label: 'Band', aliases: ['band'] },
  { key: 'cnn', label: 'CNN', aliases: ['cnn'] },
  { key: 'bandnews', label: 'BandNews', aliases: ['bandnews', 'band news'] },
  { key: 'globonews', label: 'GloboNews', aliases: ['globonews', 'globo news'] },
  { key: 'telecine', label: 'Telecine', aliases: ['telecine'] },
  { key: 'hbo', label: 'HBO', aliases: ['hbo'] },
  { key: 'cinemax', label: 'Cinemax', aliases: ['cinemax'] },
  { key: 'discovery', label: 'Discovery', aliases: ['discovery'] },
  { key: 'history', label: 'History', aliases: ['history'] },
  { key: 'ae', label: 'A&E', aliases: ['a&e', 'ae'] },
  { key: 'amc', label: 'AMC', aliases: ['amc'] },
  { key: 'sony', label: 'Sony', aliases: ['sony'] },
  { key: 'warner', label: 'Warner', aliases: ['warner'] },
  { key: 'tnt', label: 'TNT', aliases: ['tnt'] },
  { key: 'disney', label: 'Disney', aliases: ['disney'] },
  { key: 'cartoon', label: 'CN', aliases: ['cartoon'] },
  { key: 'nick', label: 'Nick', aliases: ['nick'] },
  { key: 'multishow', label: 'Multishow', aliases: ['multishow'] },
  { key: 'gnt', label: 'GNT', aliases: ['gnt'] },
  { key: 'bis', label: 'Bis', aliases: ['bis'] },
  { key: 'megapix', label: 'Megapix', aliases: ['megapix'] },
  { key: 'universal', label: 'Universal', aliases: ['universal'] },
  { key: 'paramount', label: 'Paramount', aliases: ['paramount'] },
  { key: 'animalplanet', label: 'Animal', aliases: ['animal planet'] },
  { key: 'natgeo', label: 'Nat Geo', aliases: ['national geographic', 'nat geo'] },
] as const;

export type ChannelLogoBrand = (typeof CHANNEL_LOGO_BRANDS)[number];

export const normalizeLogoLookupText = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d{1,2}[:h]\d{2}\b/g, ' ')
    .replace(/\b(4k|fhd|fullhd|full hd|hd|sd|uhd|h265|hevc|h\.265|backup|raw)\b/g, ' ')
    .replace(/[^a-z0-9&+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

export const hasUsableChannelLogo = (logo?: string) => {
  if (!logo?.trim()) return false;

  try {
    const normalizedLogo = decodeURIComponent(logo).toLowerCase();
    return !LOGO_MISSING_MARKERS.some((marker) => normalizedLogo.includes(marker));
  } catch {
    return true;
  }
};

export const getChannelLogoBrand = (value: string): ChannelLogoBrand | null => {
  const normalizedValue = normalizeLogoLookupText(value);

  if (!normalizedValue) return null;

  const normalizedCompactValue = normalizedValue.replace(/\s+/g, '');

  return CHANNEL_LOGO_BRANDS.find((brand) =>
    brand.aliases.some((alias) => {
      const normalizedAlias = normalizeLogoLookupText(alias);
      const normalizedCompactAlias = normalizedAlias.replace(/\s+/g, '');

      return (
        normalizedValue.includes(normalizedAlias) ||
        normalizedCompactValue.includes(normalizedCompactAlias)
      );
    })
  ) ?? null;
};

const createLogoLookup = (channels: ChannelListViewChannel[]) => {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  const byBrand = new Map<string, string>();

  channels.forEach((channel) => {
    if (!hasUsableChannelLogo(channel.logo)) return;

    byId.set(String(channel.id), channel.logo);

    const nameKey = normalizeLogoLookupText(channel.name);
    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, channel.logo);
    }

    const brandFromName = getChannelLogoBrand(channel.name);
    if (brandFromName && !byBrand.has(brandFromName.key)) {
      byBrand.set(brandFromName.key, channel.logo);
    }

    const brandFromLogo = getChannelLogoBrand(channel.logo);
    if (brandFromLogo && !byBrand.has(brandFromLogo.key)) {
      byBrand.set(brandFromLogo.key, channel.logo);
    }
  });

  return { byId, byName, byBrand };
};

export const enrichChannelsWithCatalogLogos = (
  channels: ChannelListViewChannel[],
  catalogChannels: ChannelListViewChannel[]
) => {
  if (channels.length === 0 || catalogChannels.length === 0) return channels;

  const lookup = createLogoLookup(catalogChannels);

  return channels.map((channel) => {
    if (hasUsableChannelLogo(channel.logo)) return channel;

    const nameKey = normalizeLogoLookupText(channel.name);
    const brand = getChannelLogoBrand(channel.name);
    const enrichedLogo =
      lookup.byId.get(String(channel.id)) ||
      (nameKey ? lookup.byName.get(nameKey) : '') ||
      (brand ? lookup.byBrand.get(brand.key) : '');

    return enrichedLogo ? { ...channel, logo: enrichedLogo } : channel;
  });
};
