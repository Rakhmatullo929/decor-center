import { format, getTime, formatDistanceToNow, type Locale } from 'date-fns';
import { ru, uz } from 'date-fns/locale';

import i18n from 'src/locales/i18n';

// ----------------------------------------------------------------------

type InputValue = Date | string | number | null | undefined;

function getDateFnsLocale(): Locale | undefined {
  const lang = i18n.language;
  const baseLang = lang.split('-')[0];

  if (baseLang === 'ru') return ru;
  if (baseLang === 'uz') return uz;

  return undefined;
}

export function fDate(date: InputValue, newFormat?: string) {
  const fm = newFormat || 'dd MMM yyyy';

  const locale = getDateFnsLocale();

  return date ? format(new Date(date), fm, locale ? { locale } : undefined) : '';
}

export function fDateTime(date: InputValue, newFormat?: string) {
  const baseLang = i18n.language.split('-')[0];
  const fm = newFormat || (baseLang === 'uz' ? 'dd MMM yyyy HH:mm' : 'dd MMM yyyy p');

  const locale = getDateFnsLocale();

  return date ? format(new Date(date), fm, locale ? { locale } : undefined) : '';
}

export function fTimestamp(date: InputValue) {
  return date ? getTime(new Date(date)) : '';
}

export function fToNow(date: InputValue) {
  const locale = getDateFnsLocale();

  return date
    ? formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale,
      })
    : '';
}
