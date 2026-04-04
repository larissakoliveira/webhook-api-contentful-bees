/**
 * Webhook payloads use locale-keyed fields. Single-locale or NL-default spaces
 * often use `nl` / `nl-NL` instead of `en-US`. Reading only `en-US` skips real values.
 */

export function isInStockTrue(inStock: Record<string, boolean | undefined> | undefined): boolean {
  if (!inStock || typeof inStock !== 'object') return false;
  return Object.values(inStock).some((v) => v === true);
}

export function localizedString(field: Record<string, unknown> | undefined): string {
  if (!field || typeof field !== 'object') return '';
  const order = ['en-US', 'nl', 'nl-NL', 'en', 'de', 'pt-BR', 'pt'];
  for (const key of order) {
    const v = field[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  for (const v of Object.values(field)) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** At least one of EN/NL must exist; missing side copies from the other for emails. */
export function resolveProductNames(fields: {
  productNameEnglish?: Record<string, unknown>;
  productNameDutch?: Record<string, unknown>;
}): { en: string; nl: string } | null {
  let en = localizedString(fields.productNameEnglish);
  let nl = localizedString(fields.productNameDutch);
  if (!en) en = nl;
  if (!nl) nl = en;
  if (!en || !nl) return null;
  return { en, nl };
}

/** CMA entry fields are locale-keyed; read first available locale (common when default locale is `nl`). */
export function firstLocale<T>(field: Record<string, T> | undefined): T | undefined {
  if (!field || typeof field !== 'object') return undefined;
  const v =
    field['en-US'] ?? field['nl'] ?? field['nl-NL'] ?? field['en'] ?? Object.values(field)[0];
  return v;
}
