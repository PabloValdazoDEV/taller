"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Car, ChevronDown, Plus, Search, X } from "lucide-react";
import MARCAS from "@/data/marcas.json";
import { MARCAS_HABITUALES, MODELOS } from "@/data/modelos";
import { catalogoPersonalizado, crearEnCatalogo } from "@/app/(app)/catalogo/actions";
import { cx } from "./ui";

type Marca = { nombre: string; slug: string | null; personalizada?: boolean };

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const PORSLUG = new Map((MARCAS as { nombre: string; slug: string }[]).map((m) => [m.slug, m]));
const PORNOMBRE = new Map((MARCAS as { nombre: string; slug: string }[]).map((m) => [normal(m.nombre), m]));

/** Busca la marca del catálogo que corresponde a un texto (p. ej. "Mercedes" → mercedes-benz). */
export function marcaDeTexto(texto: string): Marca | null {
  const n = normal(texto);
  if (!n) return null;
  const exacta = PORNOMBRE.get(n);
  if (exacta) return exacta;
  const parcial = (MARCAS as { nombre: string; slug: string }[]).find((m) => normal(m.nombre).startsWith(n) && n.length >= 4);
  return parcial ?? null;
}

export function LogoMarca({ marca, className }: { marca: string; className?: string }) {
  const m = marcaDeTexto(marca);
  if (!m?.slug) return <span className={cx("grid place-items-center rounded-lg bg-slate-100 text-slate-500 font-bold text-xs", className)}>{marca.slice(0, 2).toUpperCase() || <Car className="size-4" />}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/marcas/${m.slug}.png`} alt="" className={cx("object-contain", className)} loading="lazy" />;
}

type Personalizado = { marca: string; modelo: string | null }[];

/** Campos Marca + Modelo que abren un selector a pantalla completa con logos, búsqueda y alta de nuevos. */
export function SelectorMarcaModelo({ marca, modelo, onChange }: { marca: string; modelo: string; onChange: (marca: string, modelo: string) => void }) {
  const [abierto, setAbierto] = useState<null | "marca" | "modelo">(null);
  const [personal, setPersonal] = useState<Personalizado>([]);

  const recargar = () => catalogoPersonalizado().then(setPersonal).catch(() => {});
  useEffect(() => {
    recargar();
  }, []);

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1">Marca</span>
          <button type="button" onClick={() => setAbierto("marca")} className="w-full flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 min-h-14 text-left hover:border-primary">
            {marca ? <LogoMarca marca={marca} className="size-9" /> : <Car className="size-6 text-slate-400" />}
            <span className={cx("flex-1 text-base", !marca && "text-slate-400")}>{marca || "Elegir marca"}</span>
            <ChevronDown className="size-4 text-slate-400" />
          </button>
        </div>
        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1">Modelo</span>
          <button
            type="button"
            disabled={!marca}
            onClick={() => setAbierto("modelo")}
            className="w-full flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 min-h-14 text-left hover:border-primary disabled:opacity-50"
          >
            <span className={cx("flex-1 text-base", !modelo && "text-slate-400")}>{modelo || (marca ? "Elegir modelo" : "Elige antes la marca")}</span>
            <ChevronDown className="size-4 text-slate-400" />
          </button>
        </div>
      </div>

      {abierto === "marca" && (
        <ModalMarca
          personal={personal}
          onCerrar={() => setAbierto(null)}
          onElegir={async (m, crear) => {
            if (crear) {
              await crearEnCatalogo(m);
              recargar();
            }
            onChange(m, m === marca ? modelo : "");
            setAbierto("modelo");
          }}
        />
      )}
      {abierto === "modelo" && marca && (
        <ModalModelo
          marca={marca}
          personal={personal}
          onCerrar={() => setAbierto(null)}
          onElegir={async (mo, crear) => {
            if (crear) {
              await crearEnCatalogo(marca, mo);
              recargar();
            }
            onChange(marca, mo);
            setAbierto(null);
          }}
        />
      )}
    </>
  );
}

function Modal({ titulo, onCerrar, children, busqueda, setBusqueda, placeholder }: { titulo: string; onCerrar: () => void; children: React.ReactNode; busqueda: string; setBusqueda: (v: string) => void; placeholder: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center sm:p-6" onClick={onCerrar} role="dialog" aria-modal aria-label={titulo}>
      <div className="bg-white w-full sm:max-w-4xl h-[92dvh] sm:h-[85dvh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{titulo}</h2>
            <button type="button" onClick={onCerrar} className="p-2 rounded-full hover:bg-slate-100" aria-label="Cerrar"><X className="size-5" /></button>
          </div>
          <div className="relative">
            <Search className="size-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={ref}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-slate-300 pl-10 pr-3 min-h-12 text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function BotonCrear({ texto, onClick, pend }: { texto: string; onClick: () => void; pend: boolean }) {
  return (
    <button type="button" disabled={pend} onClick={onClick} className="w-full mb-4 flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 p-4 text-left text-primary font-semibold hover:bg-primary/10">
      <Plus className="size-5" /> {texto}
    </button>
  );
}

function ModalMarca({ personal, onCerrar, onElegir }: { personal: Personalizado; onCerrar: () => void; onElegir: (marca: string, crear: boolean) => Promise<void> }) {
  const [q, setQ] = useState("");
  const [pend, start] = useTransition();
  const todas = useMemo<Marca[]>(() => {
    const base = (MARCAS as Marca[]).slice();
    const extra = personal.filter((p) => !p.modelo && !PORNOMBRE.has(normal(p.marca))).map((p) => ({ nombre: p.marca, slug: null, personalizada: true }));
    return [...extra, ...base].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [personal]);
  const nq = normal(q);
  const filtradas = nq ? todas.filter((m) => normal(m.nombre).includes(nq)) : todas;
  const habituales = MARCAS_HABITUALES.map((s) => PORSLUG.get(s)!).filter(Boolean);
  const existeExacta = todas.some((m) => normal(m.nombre) === nq);
  const elegir = (m: string, crear = false) => start(() => onElegir(m, crear));

  return (
    <Modal titulo="Marca del vehículo" onCerrar={onCerrar} busqueda={q} setBusqueda={setQ} placeholder="Buscar marca… (p. ej. Seat, Toyota)">
      {q.trim().length >= 2 && !existeExacta && <BotonCrear pend={pend} texto={`Crear la marca «${q.trim()}»`} onClick={() => elegir(q.trim(), true)} />}
      {!nq && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Más habituales</h3>
          <RejillaMarcas marcas={habituales} onElegir={elegir} />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 mt-6">Todas las marcas (A-Z)</h3>
        </>
      )}
      <RejillaMarcas marcas={filtradas} onElegir={elegir} pequena={!nq} />
      {nq && filtradas.length === 0 && <p className="text-center text-slate-500 py-8">No hay ninguna marca con «{q}». Puedes crearla arriba.</p>}
    </Modal>
  );
}

function RejillaMarcas({ marcas, onElegir, pequena }: { marcas: Marca[]; onElegir: (m: string) => void; pequena?: boolean }) {
  return (
    <div className={cx("grid gap-2", pequena ? "grid-cols-3 sm:grid-cols-5 md:grid-cols-6" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6")}>
      {marcas.map((m) => (
        <button
          type="button"
          key={(m.slug ?? "p") + m.nombre}
          onClick={() => onElegir(m.nombre)}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-2 min-h-24 hover:border-primary hover:shadow-sm active:bg-slate-50"
        >
          {m.slug ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/marcas/${m.slug}.png`} alt="" loading="lazy" className={pequena ? "h-8 w-12 object-contain" : "h-11 w-16 object-contain"} />
          ) : (
            <span className="h-10 w-10 grid place-items-center rounded-full bg-slate-100 text-slate-500 font-bold">{m.nombre.slice(0, 2).toUpperCase()}</span>
          )}
          <span className="text-xs font-medium text-center leading-tight line-clamp-2">{m.nombre}</span>
          {m.personalizada && <span className="text-[10px] text-primary">Creada por el taller</span>}
        </button>
      ))}
    </div>
  );
}

function ModalModelo({ marca, personal, onCerrar, onElegir }: { marca: string; personal: Personalizado; onCerrar: () => void; onElegir: (modelo: string, crear: boolean) => Promise<void> }) {
  const [q, setQ] = useState("");
  const [pend, start] = useTransition();
  const slug = marcaDeTexto(marca)?.slug;
  const modelos = useMemo(() => {
    const base = (slug && MODELOS[slug]) || [];
    const extra = personal.filter((p) => p.modelo && normal(p.marca) === normal(marca)).map((p) => p.modelo!);
    return Array.from(new Set([...base, ...extra])).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  }, [slug, marca, personal]);
  const nq = normal(q);
  const filtrados = nq ? modelos.filter((m) => normal(m).includes(nq)) : modelos;
  const existe = modelos.some((m) => normal(m) === nq);

  return (
    <Modal titulo={`Modelo de ${marca}`} onCerrar={onCerrar} busqueda={q} setBusqueda={setQ} placeholder={`Buscar modelo de ${marca}…`}>
      <div className="flex items-center gap-3 mb-4">
        <LogoMarca marca={marca} className="size-12" />
        <span className="text-sm text-slate-500">{modelos.length} modelos en el catálogo</span>
      </div>
      {q.trim().length >= 1 && !existe && <BotonCrear pend={pend} texto={`Crear el modelo «${q.trim()}»`} onClick={() => start(() => onElegir(q.trim(), true))} />}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {filtrados.map((m) => (
          <button type="button" key={m} onClick={() => start(() => onElegir(m, false))} className="rounded-xl border border-slate-200 bg-white px-3 min-h-12 text-sm font-medium text-left hover:border-primary active:bg-slate-50">
            {m}
          </button>
        ))}
      </div>
      {modelos.length === 0 && !q && <p className="text-center text-slate-500 py-8">No hay modelos de {marca} en el catálogo. Escribe el modelo arriba para crearlo.</p>}
    </Modal>
  );
}
