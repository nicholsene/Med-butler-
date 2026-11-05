import { describe, expect, it } from 'vitest';
import { isStandalone, requestPersist } from './device';

describe('requestPersist', () => {
  it('reports granted without asking twice', async () => {
    let asked = 0;
    const s = { persisted: async () => true, persist: async () => (asked++, true) };
    expect(await requestPersist(s)).toBe('granted');
    expect(asked).toBe(0);
  });
  it('asks when not yet persisted', async () => {
    expect(await requestPersist({ persisted: async () => false, persist: async () => true })).toBe('granted');
    expect(await requestPersist({ persisted: async () => false, persist: async () => false })).toBe('denied');
  });
  it('handles missing support and errors', async () => {
    expect(await requestPersist({})).toBe('unsupported');
    expect(await requestPersist({ persist: () => Promise.reject(new Error('no')) })).toBe('denied');
  });
});

describe('isStandalone', () => {
  const media = (matches: boolean) => () => ({ matches });
  it('detects display-mode standalone', () => expect(isStandalone({ matchMedia: media(true) })).toBe(true));
  it('detects navigator.standalone', () => expect(isStandalone({ matchMedia: media(false), navigator: { standalone: true } })).toBe(true));
  it('is false in a browser tab', () => expect(isStandalone({ matchMedia: media(false), navigator: {} })).toBe(false));
});
