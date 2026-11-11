"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Boton, Campo, Input, Select, Textarea } from "@/components/ui";
import { actualizarCliente } from "../actions";

type Cliente = {
  id: string; tipo: string; nombre: string; nif: string | null; telefono: string | null; email: string | null; direccion: string | null;
  notas: string | null; aceptaWhatsapp: boolean; aceptaEmail: boolean; exentoIva: boolean; motivoExencion: string | null;
};

export function EditarCliente({ c }: { c: Cliente }) {
  const [abierto, setAbierto] = useState(false);
  const [exento, setExento] = useState(c.exentoIva);
  const [error, setError] = useState("");
  const [pend, start] = useTransition();

  if (!abierto)
    return (
      <Boton variante="secundario" onClick={() => setAbierto(true)}>
        <Pencil className="size-4" /> Editar datos
      </Boton>
    );

  return (
    <form
      className="w-full grid sm:grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
      action={(fd) =>
        start(async () => {
          const r = await actualizarCliente(fd);
          if (r.error) setError(r.error);
          else {
            setError("");
            setAbierto(false);
          }
        })
      }
    >
      <input type="hidden" name="id" value={c.id} />
      <Campo etiqueta="Nombre / razón social" className="sm:col-span-2"><Input name="nombre" defaultValue={c.nombre} required /></Campo>
      <Campo etiqueta="Tipo">
        <Select name="tipo" defaultValue={c.tipo}>
          <option value="particular">Particular</option>
          <option value="empresa">Empresa</option>
          <option value="aseguradora">Aseguradora</option>
          <option value="flota">Renting / flota</option>
        </Select>
      </Campo>
      <Campo etiqueta="NIF / DNI"><Input name="nif" defaultValue={c.nif ?? ""} /></Campo>
      <Campo etiqueta="Teléfono"><Input name="telefono" type="tel" defaultValue={c.telefono ?? ""} /></Campo>
      <Campo etiqueta="Email"><Input name="email" type="email" defaultValue={c.email ?? ""} /></Campo>
      <Campo etiqueta="Dirección" className="sm:col-span-2"><Input name="direccion" defaultValue={c.direccion ?? ""} /></Campo>
      <div className="sm:col-span-2 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="aceptaWhatsapp" defaultChecked={c.aceptaWhatsapp} className="size-5" /> Acepta WhatsApp</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="aceptaEmail" defaultChecked={c.aceptaEmail} className="size-5" /> Acepta email</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="exentoIva" checked={exento} onChange={(e) => setExento(e.target.checked)} className="size-5" /> Exento de IVA</label>
      </div>
      {exento && <Campo etiqueta="Motivo legal de la exención" className="sm:col-span-2"><Input name="motivoExencion" defaultValue={c.motivoExencion ?? ""} placeholder="Ej.: Art. 20.Uno… Ley 37/1992" /></Campo>}
      <Campo etiqueta="Notas internas" className="sm:col-span-2"><Textarea name="notas" rows={2} defaultValue={c.notas ?? ""} /></Campo>
      {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
      <div className="sm:col-span-2 flex justify-end gap-2">
        <Boton type="button" variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton>
        <Boton type="submit" disabled={pend}>{pend && <Loader2 className="size-4 animate-spin" />} Guardar</Boton>
      </div>
    </form>
  );
}
