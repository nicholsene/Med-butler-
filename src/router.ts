import { useEffect, useState } from 'react';

const current = () => location.hash.replace(/^#/, '') || '/';

export function navigate(path: string) {
  location.hash = path;
}

/** Hash routes, so reload and Back work from the home screen and from the single-file build. */
export function useRoute(): string {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const onChange = () => setRoute(current());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('[data-route-heading]')?.focus({ preventScroll: true });
  }, [route]);
  return route;
}
