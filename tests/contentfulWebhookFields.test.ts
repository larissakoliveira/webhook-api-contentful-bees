import {
  firstLocale,
  isInStockTrue,
  localizedString,
  resolveProductNames,
} from '../utils/contentfulWebhookFields';

describe('contentfulWebhookFields', () => {
  it('isInStockTrue reads any locale', () => {
    expect(isInStockTrue(undefined)).toBe(false);
    expect(isInStockTrue({ 'en-US': false })).toBe(false);
    expect(isInStockTrue({ 'en-US': true })).toBe(true);
    expect(isInStockTrue({ nl: true })).toBe(true);
  });

  it('localizedString reads nl when en-US empty', () => {
    expect(localizedString({ nl: 'Honing' })).toBe('Honing');
    expect(localizedString({ 'en-US': 'Honey', nl: 'Honing' })).toBe('Honey');
  });

  it('firstLocale reads nl when en-US missing', () => {
    expect(firstLocale({ nl: 'a@b.c' })).toBe('a@b.c');
    expect(firstLocale({ nl: { sys: { id: 'x' } } }) as { sys: { id: string } }).toEqual({ sys: { id: 'x' } });
  });

  it('resolveProductNames falls back across EN/NL', () => {
    expect(
      resolveProductNames({
        productNameEnglish: { nl: 'Only NL as English field' },
        productNameDutch: { nl: 'Honing NL' },
      })
    ).toEqual({ en: 'Only NL as English field', nl: 'Honing NL' });
  });
});
