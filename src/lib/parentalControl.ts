const RESTRICTED_CATEGORY_PATTERNS = [
  /\badult(?:o|a|os|as)?\b/,
  /\bxxx\b/,
  /\bporn(?:o|ografia)?\b/,
  /\berotic(?:o|a|os|as)?\b/,
  /\bsexo\b/,
  /\bsex\b/,
  /\b18\s*\+/,
];

const normalizeCategoryName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const isValidParentalPin = (pin: string) => /^\d{4}$/.test(pin);

export const isRestrictedCategoryName = (name: string) => {
  const normalizedName = normalizeCategoryName(name);

  return RESTRICTED_CATEGORY_PATTERNS.some((pattern) => pattern.test(normalizedName));
};
