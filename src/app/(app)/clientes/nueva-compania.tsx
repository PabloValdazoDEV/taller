"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Boton, Campo, Input, Textarea, cx } from "@/components/ui";
import { Dialogo } from "@/components/dialogo";
import { TelefonoInput } from "@/components/telefono-input";
import { crearCompania } from "./actions";

export type CompaniaCreada = { id: string; nombre: string; tipo: string };

const TIPOS = [
  { v: "aseguradora", t: "Aseguradora", ayuda: "Mutua, Mapfre… (siniestros con perito)" },
  { v: "flota", t: "Renting / flota", ayuda: "Bansacar, Ayvens, flotas de empresa" },
  { v: "empresa", t: "Empresa", ayuda: "Otra empresa cliente" },
] as const;

/**
 * Botón + diálogo para dar de alta una aseguradora, renting/flota o empresa.
 * `onCreada` permite seleccionarla al momento (recepción); sin él, abre su ficha.
 */
export function NuevaCompania({ onCreada, texto = "Nueva aseguradora o flota", tipoInicial = "aseguradora", className, variante = "secundario" }: {
  onCreada?: (c: CompaniaCreada) => void;
  texto?: string;
  tipoInicial?: "aseguradora" | "flota" | "empresa";
  className?: string;
  variante?: "primario" | "secundario" | "fantasma";
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<string>(tipoInicial);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();
  const cerrar = () => {
    setAbierto(false);
    setError("");
  };

  return (
    <>
      <Boton type="button" variante={variante} className={className} onClick={() => setAbierto(true)}>
        <Plus className="size-4" aria-hidden /> {texto}
      </Boton>
      <Dialogo abierto={abierto} onCerrar={cerrar} titulo="Nueva compañía" descripcion="Aseguradoras, renting y flotas: quienes pagan o autorizan las reparaciones.">
        {abierto && (
          // No es un <form> anidado: la recepción ya va dentro de un formulario
          <div
            className="space-y-4"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
                e.preventDefault();
                (e.currentTarget.querySelector("[data-guardar]") as HTMLButtonElement | null)?.click();
              }
            }}
          >
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-slate-700">Tipo</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {TIPOS.map((x) => (
                  <label key={x.v} className={cx("cursor-pointer rounded-xl border-2 p-2.5", tipo === x.v ? "border-slate-900 bg-slate-50" : "border-slate-200")}>
                    <input type="radio" name="nc_tipo" value={x.v} checked={tipo === x.v} onChange={() => setTipo(x.v)} className="sr-only" />
                    <span className="block text-sm font-semibold">{x.t}</span>
                    <span className="block text-xs text-slate-500">{x.ayuda}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre" className="sm:col-span-2"><Input data-campo="nombre" required minLength={2} maxLength={120} placeholder="Ej.: Mutua Madrileña" autoFocus /></Campo>
              <Campo etiqueta="NIF / CIF"><Input data-campo="nif" className="uppercase" maxLength={20} /></Campo>
              <Campo etiqueta="Email"><Input data-campo="email" type="email" maxLength={120} placeholder="Para enviar presupuestos y facturas" /></Campo>
              <Campo etiqueta="Teléfono" className="sm:col-span-2"><TelefonoInput name="nc_telefono" /></Campo>
              <Campo etiqueta="Dirección" className="sm:col-span-2"><Input data-campo="direccion" maxLength={200} /></Campo>
              <Campo etiqueta="Notas (opcional)" className="sm:col-span-2">
                <Textarea data-campo="notas" rows={2} maxLength={1000} placeholder="Ej.: perito habitual, persona de contacto, cómo autorizan" />
              </Campo>
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Boton type="button" variante="fantasma" onClick={cerrar}>Cancelar</Boton>
              <Boton
                type="button"
                data-guardar
                disabled={pend}
                onClick={(e) => {
                  const caja = (e.currentTarget as HTMLElement).closest(".space-y-4")!;
                  const fd = new FormData();
                  fd.set("tipo", tipo);
                  caja.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-campo]").forEach((el) => fd.set(el.dataset.campo!, el.value));
                  fd.set("telefono", (caja.querySelector('input[name="nc_telefono"]') as HTMLInputElement | null)?.value ?? "");
                  start(async () => {
                    const r = await crearCompania(fd);
                    if (r.error || !r.id) return setError(r.error ?? "No se ha podido guardar");
                    cerrar();
                    if (onCreada) onCreada({ id: r.id, nombre: r.nombre!, tipo: r.tipo! });
                    else router.push(`/clientes/${r.id}`);
                  });
                }}
              >
                {pend && <Loader2 className="size-4 animate-spin" aria-hidden />} Guardar compañía
              </Boton>
            </div>
          </div>
        )}
      </Dialogo>
    </>
  );
}
