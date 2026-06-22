import { useEffect, useState } from "react";

/** Returns true only after client-side mount, so persisted Zustand state
 *  can render without SSR hydration mismatch. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
