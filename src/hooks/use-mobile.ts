import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Subscribes to the viewport media query. Returning the same function identity
 * on every call matters — `useSyncExternalStore` resubscribes whenever this
 * reference changes.
 */
function subscribe(onStoreChange: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/** The server has no viewport; match the previous hook, which rendered `false`
 * until the post-mount effect ran. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * `useSyncExternalStore` is the intended primitive for reading from a browser
 * API like `matchMedia`. The previous implementation seeded state to `undefined`
 * and wrote the real value from an effect, which rendered every consumer twice
 * on mount and tripped `react-hooks/set-state-in-effect`. Behaviour is
 * unchanged: `false` during SSR and the first paint, then the real match.
 */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
