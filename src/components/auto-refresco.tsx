"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refresca los datos del servidor cada N segundos (tablero en tiempo casi real). */
export function AutoRefresco({ segundos = 15 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}
