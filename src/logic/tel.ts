/** Builds a tel: link from what was typed in settings, or null if it isn't a usable number. */
export function telHref(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/[a-z]/i.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 3 || digits.length > 15) return null;
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

/** Builds an sms: link with the message filled in. Only opens Messages; she still presses send. */
export function smsHref(raw: string | undefined | null, body: string): string | null {
  const tel = telHref(raw);
  if (!tel) return null;
  const number = tel.slice('tel:'.length);
  // "?&body=" is the form both iOS and Android read.
  return body.trim() ? `sms:${number}?&body=${encodeURIComponent(body.trim())}` : `sms:${number}`;
}
