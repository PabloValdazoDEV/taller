"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/** Búsqueda en vivo (actualiza la URL con un pequeño retardo). */
export function BuscadorClientes() {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    const id = setTimeout(() => {
      const p = new URLSearchParams(params);
      if (q.trim()) p.set("q", q.trim());
      else p.delete("q");
      if (p.toString() !== params.toString()) router.replace(`${ruta}?${p}`);
    }, 250);
    return () => clearTimeout(id);
  }, [q, params, router, ruta]);

  return (
    <div className="relative flex-1 min-w-60">
      <Search className="size-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, NIF, teléfono, email o matrícula…"
        className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 min-h-12 text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
        autoFocus
      />
    </div>
  );
}
