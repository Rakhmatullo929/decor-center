export type PhoneRule = {
  country: string;
  prefix: string;
  pattern: RegExp;
  example: string;
};

const PHONE_RULES: Record<string, PhoneRule> = {
  uz: {
    country: 'uz',
    prefix: '+998',
    pattern: /^\+998\d{9}$/,
    example: '+998901234567',
  },
};

export const DEFAULT_PHONE_COUNTRY = 'uz';

export function normalizePhone(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

export function getPhoneRule(country = DEFAULT_PHONE_COUNTRY): PhoneRule {
  return PHONE_RULES[country] || PHONE_RULES[DEFAULT_PHONE_COUNTRY];
}

export function isPhoneValid(value: string, country = DEFAULT_PHONE_COUNTRY): boolean {
  return getPhoneRule(country).pattern.test(normalizePhone(value));
}

export function getPhonePrefix(country = DEFAULT_PHONE_COUNTRY): string {
  return getPhoneRule(country).prefix;
}
