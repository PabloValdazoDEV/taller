"use client";

import { useRef, useState, useTransition } from "react";
import { Check, ImageUp, Loader2 } from "lucide-react";
import { Boton, Campo, Input, Tarjeta, Textarea, cx } from "@/components/ui";
import { guardarTaller } from "../actions";
import { ESPECIALIDADES, NOMBRE_ESPECIALIDAD, type Especialidad } from "@/lib/importes";

type Datos = {
  nombre: string; razonSocial: string; nif: string; direccion: string; telefono: string; whatsapp: string; email: string; horario: string;
  prestamoEdadMinima: number; prestamoAniosCarnet: number; textoResguardo: string; textoEntrega: string; garantiaTexto: string; textoPrestamo: string; textoPresupuesto: string;
  ivaDefecto: string; tarifas: Record<Especialidad, string>;
};

export function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <Tarjeta className="grid gap-4 p-5 lg:grid-cols-[16rem_1fr] lg:gap-8">
      <div>
        <h2 className="font-semibold">{titulo}</h2>
        {descripcion && <p className="mt-1 text-sm text-slate-500">{descripcion}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Tarjeta>
  );
}

export function FormTaller({ t, logo, sello }: { t: Datos; logo: string | null; sello: string | null }) {
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pend, start] = useTransition();

  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          const r = await guardarTaller(fd);
          setEstado(r.error ? { tipo: "error", texto: r.error } : { tipo: "ok", texto: "Cambios guardados" });
        })
      }
      onChange={() => estado?.tipo === "ok" && setEstado(null)}
    >
      <Seccion titulo="Logo" descripcion="Aparece en la pantalla de acceso, en el menú y en la cabecera de los PDF. PNG, JPG o WEBP de hasta 2 MB (en los PDF solo salen PNG y JPG).">
        <SubirImagen nombre="logo" campoQuitar="quitarLogo" actual={logo} accept="image/png,image/jpeg,image/webp" textoVacio="Sin logo" textoSubir="Subir logo" textoCambiar="Cambiar logo" alt="Logo del taller" />
      </Seccion>

      <Seccion
        titulo="Sello o firma del taller"
        descripcion="Se estampa en el recuadro «Por el taller» del resguardo, el acta de entrega y el préstamo de coche de sustitución, junto al nombre de quien atendió. Mejor PNG con fondo transparente; hasta 1 MB."
      >
        <SubirImagen nombre="sello" campoQuitar="quitarSello" actual={sello} accept="image/png,image/jpeg" textoVacio="Sin sello" textoSubir="Subir sello" textoCambiar="Cambiar sello" alt="Sello del taller" alto />
      </Seccion>

      <Seccion titulo="Datos del taller" descripcion="Salen en la cabecera de todos los documentos (resguardo, presupuesto, acta de entrega…).">
        <Campo etiqueta="Nombre comercial" className="sm:col-span-2"><Input name="nombre" defaultValue={t.nombre} required /></Campo>
        <Campo etiqueta="Razón social"><Input name="razonSocial" defaultValue={t.razonSocial} /></Campo>
        <Campo etiqueta="NIF / CIF"><Input name="nif" defaultValue={t.nif} className="uppercase" /></Campo>
        <Campo etiqueta="Dirección" className="sm:col-span-2"><Input name="direccion" defaultValue={t.direccion} autoComplete="street-address" /></Campo>
      </Seccion>

      <Seccion
        titulo="Tarifas e IVA"
        descripcion="Precio por hora de mano de obra, SIN IVA. Sale relleno al añadir mano de obra a una orden y se puede cambiar en cada línea. Si cobráis lo mismo en todo, pon el mismo precio."
      >
        {ESPECIALIDADES.map((e) => (
          <Campo key={e} etiqueta={`${NOMBRE_ESPECIALIDAD[e]} (€/hora)`}>
            <Input name={`tarifa_${e}`} inputMode="decimal" defaultValue={t.tarifas[e]} placeholder="Ej.: 45" />
          </Campo>
        ))}
        <Campo etiqueta="IVA general (%)" ayuda="El de los trabajos con IVA. Los exentos se marcan en el cliente o en cada orden.">
          <Input name="ivaDefecto" inputMode="decimal" defaultValue={t.ivaDefecto} required className="max-w-32" />
        </Campo>
      </Seccion>

      <Seccion titulo="Contacto y horario" descripcion="Se usan en los mensajes al cliente («su coche ya está listo…»).">
        <Campo etiqueta="Teléfono"><Input name="telefono" type="tel" defaultValue={t.telefono} /></Campo>
        <Campo etiqueta="WhatsApp"><Input name="whatsapp" type="tel" defaultValue={t.whatsapp} /></Campo>
        <Campo etiqueta="Email" className="sm:col-span-2"><Input name="email" type="email" defaultValue={t.email} /></Campo>
        <Campo etiqueta="Horario de atención" className="sm:col-span-2" ayuda="Ej.: L-V 8:30-14:00 y 15:00-18:00">
          <Input name="horario" defaultValue={t.horario} />
        </Campo>
      </Seccion>

      <Seccion titulo="Coches de sustitución" descripcion="Condiciones mínimas del conductor. Solo Dirección o Jefe de taller pueden prestar un coche sin cumplirlas.">
        <Campo etiqueta="Edad mínima (años)"><Input name="prestamoEdadMinima" type="number" inputMode="numeric" min={18} max={99} defaultValue={t.prestamoEdadMinima} required /></Campo>
        <Campo etiqueta="Antigüedad mínima del carnet (años)"><Input name="prestamoAniosCarnet" type="number" inputMode="numeric" min={0} max={50} defaultValue={t.prestamoAniosCarnet} required /></Campo>
      </Seccion>

      <Seccion titulo="Textos legales" descripcion="Se imprimen en los documentos firmados. Revísalos con vuestra gestoría. Si dejas uno vacío, se usa el texto por defecto.">
        <Campo etiqueta="Resguardo de depósito (recepción)" className="sm:col-span-2"><Textarea name="textoResguardo" rows={5} defaultValue={t.textoResguardo} /></Campo>
        <Campo etiqueta="Presupuesto" className="sm:col-span-2"><Textarea name="textoPresupuesto" rows={4} defaultValue={t.textoPresupuesto} /></Campo>
        <Campo etiqueta="Acta de entrega" className="sm:col-span-2"><Textarea name="textoEntrega" rows={3} defaultValue={t.textoEntrega} /></Campo>
        <Campo etiqueta="Garantía" className="sm:col-span-2"><Textarea name="garantiaTexto" rows={2} defaultValue={t.garantiaTexto} /></Campo>
        <Campo etiqueta="Préstamo de coche de sustitución" className="sm:col-span-2"><Textarea name="textoPrestamo" rows={4} defaultValue={t.textoPrestamo} /></Campo>
      </Seccion>

      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        {estado && (
          <p role={estado.tipo === "error" ? "alert" : "status"} className={estado.tipo === "error" ? "text-sm text-red-700" : "flex items-center gap-1 text-sm text-emerald-700"}>
            {estado.tipo === "ok" && <Check className="size-4" aria-hidden />} {estado.texto}
          </p>
        )}
        <Boton type="submit" disabled={pend}>
          {pend && <Loader2 className="size-4 animate-spin" aria-hidden />} Guardar cambios
        </Boton>
      </div>
    </form>
  );
}

/** Selector de imagen con vista previa, «Cambiar» y «Quitar» (logo, sello). */
function SubirImagen({ nombre, campoQuitar, actual, accept, textoVacio, textoSubir, textoCambiar, alt, alto }: {
  nombre: string; campoQuitar: string; actual: string | null; accept: string; textoVacio: string; textoSubir: string; textoCambiar: string; alt: string; alto?: boolean;
}) {
  const [vista, setVista] = useState<string | null>(actual);
  const [quitar, setQuitar] = useState(false);
  const fichero = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
      <div className={cx("grid w-40 place-items-center rounded-xl border border-dashed border-slate-300 bg-white", alto ? "h-28" : "h-20")}>
        {vista && !quitar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vista} alt={alt} className={cx("max-w-36 object-contain", alto ? "max-h-24" : "max-h-16")} />
        ) : (
          <span className="text-xs text-slate-400">{textoVacio}</span>
        )}
      </div>
      <input
        ref={fichero}
        type="file"
        name={nombre}
        accept={accept}
        className="sr-only"
        id={nombre}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setVista(URL.createObjectURL(f));
            setQuitar(false);
          }
        }}
      />
      <Boton type="button" variante="secundario" onClick={() => fichero.current?.click()}>
        <ImageUp className="size-4" aria-hidden /> {vista && !quitar ? textoCambiar : textoSubir}
      </Boton>
      {vista && !quitar && (
        <Boton
          type="button"
          variante="fantasma"
          onClick={() => {
            setQuitar(true);
            if (fichero.current) fichero.current.value = "";
          }}
        >
          Quitar
        </Boton>
      )}
      {quitar && <input type="hidden" name={campoQuitar} value="on" />}
    </div>
  );
}
