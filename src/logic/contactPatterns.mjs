// Plain JavaScript so both the app and the Node build check can import the same patterns.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const URL_TEXT = /\bhttps?:\/\/[^\s"'<>)]+/gi;
const LINK_SCHEME = /\b(?:mailto|tel|sms):[^\s"'<>)]+/gi;
// 555 123 4567, (555) 123-4567, 555.123.4567, +1 555 123 4567
// Group 1 stands in for a lookbehind, which older iOS versions can't parse at all.
const PHONE_SPACED = /(^|[^\d.-])((?:\+\d{1,3}[\s.-]?|1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})(?![\d-])/g;
// +447700900123
const PHONE_INTERNATIONAL = /(^|[^\d.-])(\+\d{8,15})(?!\d)/g;
const STREET = /\b\d{1,6}\s+(?:[A-Z][\w'-]*\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Way|Parkway|Pkwy)\b\.?/g;

/** Emails and phone numbers in a string. Web addresses are ignored, so a long number in a source URL is not a phone. */
export function findContactPatterns(text) {
  const found = [];
  for (const m of text.matchAll(EMAIL)) found.push({ type: 'email', match: m[0] });
  for (const m of text.matchAll(LINK_SCHEME)) found.push({ type: 'contact link', match: m[0] });
  const withoutUrls = text.replace(URL_TEXT, ' ').replace(EMAIL, ' ').replace(LINK_SCHEME, ' ');
  for (const m of withoutUrls.matchAll(PHONE_SPACED)) found.push({ type: 'phone', match: m[2] });
  for (const m of withoutUrls.matchAll(PHONE_INTERNATIONAL)) if (!found.some((x) => x.match === m[2])) found.push({ type: 'phone', match: m[2] });
  return found;
}

/** Replaces emails, phone numbers, web addresses and street addresses in free text. */
export function scrubContactDetails(text) {
  return text
    .replace(EMAIL, '[contact removed]')
    .replace(LINK_SCHEME, '[contact removed]')
    .replace(URL_TEXT, '[link removed]')
    .replace(PHONE_SPACED, '$1[contact removed]')
    .replace(PHONE_INTERNATIONAL, '$1[contact removed]')
    .replace(STREET, '[address removed]');
}
