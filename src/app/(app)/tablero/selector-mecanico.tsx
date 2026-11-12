"use client";

/** Filtro por mecánico del tablero: envía el formulario al cambiar. */
export function SelectorMecanico({ valor, mecanicos }: { valor: string; mecanicos: { id: string; nombre: string }[] }) {
  return (
    <select
      name="mecanico"
      defaultValue={valor}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      aria-label="Filtrar por mecánico"
      className="min-h-10 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
    >
      <option value="">Todos los mecánicos</option>
      {mecanicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
      <option value="sin">Sin asignar</option>
    </select>
  );
}
