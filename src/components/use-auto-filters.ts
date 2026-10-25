"use client";
import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

export function useAutoFilters<T extends Record<string, string>>(
  initialFilters: T,
  pathname: string,
) {
  const router = useRouter();
  const [filters, setFilters] = useOptimistic(initialFilters);
  const [pending, startTransition] = useTransition();
  const revision = useRef(0);
  const cancelDelay = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const cancel = () => {
      revision.current++;
      cancelDelay.current?.();
    };
    window.addEventListener("popstate", cancel);
    return () => {
      cancel();
      window.removeEventListener("popstate", cancel);
    };
  }, []);

  function update(changes: Partial<T>, delay = 0) {
    const next = { ...filters, ...changes };
    const current = ++revision.current;
    cancelDelay.current?.();
    startTransition(async () => {
      setFilters(next);
      if (delay)
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay);
          cancelDelay.current = () => {
            clearTimeout(timer);
            resolve();
          };
        });
      if (current !== revision.current) return;
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(next))
        if (value.trim()) params.set(key, value);
      router.replace(pathname + (params.size ? "?" + params : ""), {
        scroll: false,
      });
    });
  }

  return { filters, update, pending };
}
