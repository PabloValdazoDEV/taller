"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";

/** Filtro por tipo de orden en el móvil (en pantallas mayores se usan las pastillas). Conserva los demás filtros. */
export function SelectorTipo({ valor, opciones }: { valor: string; opciones: { href: string; texto: string }[] }) {
  const router = useRouter();
  return (
    <label className="mb-2 block sm:hidden">
      <span className="sr-only">Tipo de orden</span>
      <Select value={valor} onChange={(e) => router.push(e.target.value)}>
        {opciones.map((o) => (
          <option key={o.href} value={o.href}>{o.texto}</option>
        ))}
      </Select>
    </label>
  );
}
