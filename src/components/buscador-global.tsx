"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, UserRound } from "lucide-react";
import { LogoMarca } from "./selector-marca-modelo";
import { Matricula, cx } from "./ui";

type Orden = { id: string; numero: string; matricula: string; marca: string | null; modelo: string | null; cliente: string; estado: string; color: string; abierta: boolean };
type Cliente = { id: string; nombre: string; telefono: string | null; matriculas: string[] };
type Sugerencias = { ordenes: Orden[]; clientes: Cliente[] };

const MIN = 2;
const ESPERA_MS = 200;

/**
 * Búsqueda global predictiva (matrícula, teléfono, nombre, nº de orden o de siniestro) desde 2 caracteres.
 *  - «lista»: despliega sugerencias bajo la caja (menú lateral, cabecera, Inicio). ↑↓ para moverse, Intro para abrir.
 *  - «enVivo»: en la página Buscar, actualiza los resultados de la página mientras se escribe.
 * Atajo de teclado: «/».
 */
export function BuscadorGlobal({
  valor = "",
  grande = false,
  autoFocus = false,
  oscuro = false,
  enVivo = false,
}: {
  valor?: string;
  grande?: boolean;
  autoFocus?: boolean;
  oscuro?: boolean;
  enVivo?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLFormElement>(null);
  const [texto, setTexto] = useState(valor);
  const [sug, setSug] = useState<Sugerencias | null>(null);
  const [cargando, setCargando] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const [activo, setActivo] = useState(-1);

  // Atajo «/»
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  // Búsqueda mientras se escribe (con una pequeña espera para no lanzar una petición por tecla)
  useEffect(() => {
    const q = texto.trim();
    if (enVivo) {
      if (q === valor.trim()) return;
      const id = setTimeout(() => router.replace(q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar", { scroll: false }), ESPERA_MS + 100);
      return () => clearTimeout(id);
    }
    if (q.length < MIN) {
      setSug(null);
      setCargando(false);
      return;
    }
    const ctrl = new AbortController();
    setCargando(true);
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (r.ok) {
          setSug(await r.json());
          setActivo(-1);
        }
      } catch {
        /* cancelada o sin red: se ignora */
      } finally {
        if (!ctrl.signal.aborted) setCargando(false);
      }
    }, ESPERA_MS);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [texto, enVivo, valor, router]);

  // Cerrar al tocar fuera
  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && setAbierta(false);
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierta]);

  const destinos = [...(sug?.ordenes ?? []).map((o) => `/ot/${o.id}`), ...(sug?.clientes ?? []).map((c) => `/clientes/${c.id}`)];
  const verTodo = `/buscar?q=${encodeURIComponent(texto.trim())}`;
  const mostrarLista = !enVivo && abierta && texto.trim().length >= MIN;

  function ir(href: string) {
    setAbierta(false);
    ref.current?.blur();
    router.push(href);
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (enVivo || !destinos.length) {
      if (e.key === "Escape") setAbierta(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierta(true);
      setActivo((a) => (a + 1) % (destinos.length + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => (a <= 0 ? destinos.length : a - 1));
    } else if (e.key === "Escape") {
      setAbierta(false);
    }
  }

  const fila = (i: number) =>
    cx("flex w-full items-center gap-3 px-3 py-2 text-left min-h-12 text-slate-800", i === activo ? "bg-slate-100" : "hover:bg-slate-50");

  return (
    <form
      ref={caja}
      action="/buscar"
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        const q = texto.trim();
        if (!q) return;
        if (!enVivo && activo >= 0 && activo < destinos.length) return ir(destinos[activo]);
        ir(enVivo ? `/buscar?q=${encodeURIComponent(q)}` : verTodo);
      }}
    >
      <label htmlFor={enVivo ? "buscador-pagina" : undefined} className="sr-only">Buscar por matrícula, teléfono, nombre o nº de orden</label>
      <Search
        className={cx("pointer-events-none absolute top-1/2 -translate-y-1/2", oscuro ? "text-slate-400" : "text-slate-400", grande ? "left-4 size-6" : oscuro ? "left-3 size-4" : "left-3 size-5")}
        aria-hidden
      />
      <input
        ref={ref}
        id={enVivo ? "buscador-pagina" : undefined}
        name="q"
        type="search"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierta(true);
        }}
        onFocus={() => setAbierta(true)}
        onKeyDown={teclas}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls="sugerencias-busqueda"
        aria-autocomplete="list"
        aria-label="Buscar por matrícula, teléfono, nombre o nº de orden"
        placeholder={oscuro ? "Matrícula, cliente, nº…" : "Matrícula, teléfono, nombre o nº de orden…"}
        className={cx(
          oscuro
            ? "w-full min-h-10 rounded-xl bg-white/10 border border-white/10 pl-9 pr-8 text-sm text-white placeholder:text-slate-400 focus:bg-white/15 focus:outline-none focus:border-white/30"
            : "w-full rounded-2xl border border-slate-300 bg-white shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15",
          !oscuro && (grande ? "min-h-16 pl-13 pr-24 text-lg" : "min-h-12 pl-10 pr-20 text-base"),
        )}
      />
      {cargando && !enVivo ? (
        <Loader2 className={cx("absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin", oscuro ? "text-slate-400" : "text-slate-400")} aria-hidden />
      ) : (
        !oscuro && (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500 md:block">/</kbd>
        )
      )}

      {mostrarLista && sug && (
        <div
          id="sugerencias-busqueda"
          role="listbox"
          className={cx(
            "absolute left-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl",
            oscuro ? "w-[26rem] max-w-[calc(100vw-1.5rem)]" : "w-full",
          )}
        >
          {sug.ordenes.length === 0 && sug.clientes.length === 0 && !cargando && (
            <p className="px-3 py-3 text-sm text-slate-500">Nada coincide con «{texto.trim()}».</p>
          )}
          {sug.ordenes.length > 0 && <p className="px-3 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Vehículos</p>}
          {sug.ordenes.map((o, i) => (
            <button key={o.id} type="button" role="option" aria-selected={i === activo} className={fila(i)} onMouseEnter={() => setActivo(i)} onClick={() => ir(`/ot/${o.id}`)}>
              {o.marca ? <LogoMarca marca={o.marca} className="size-6 shrink-0" /> : <span className="size-6 shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <Matricula>{o.matricula}</Matricula>
                  <span className="truncate text-sm font-medium">{[o.marca, o.modelo].filter(Boolean).join(" ")}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: o.color }} aria-hidden />
                  <span className="shrink-0 font-semibold text-slate-700">{o.estado}</span>
                  <span className="truncate">· {o.cliente} · {o.numero}</span>
                </span>
              </span>
            </button>
          ))}
          {sug.clientes.length > 0 && <p className="px-3 pt-2 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Clientes</p>}
          {sug.clientes.map((c, k) => {
            const i = sug.ordenes.length + k;
            return (
              <button key={c.id} type="button" role="option" aria-selected={i === activo} className={fila(i)} onMouseEnter={() => setActivo(i)} onClick={() => ir(`/clientes/${c.id}`)}>
                <UserRound className="size-5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.nombre}</span>
                  <span className="block truncate text-xs text-slate-500">{[c.telefono, ...c.matriculas].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            );
          })}
          {(sug.ordenes.length > 0 || sug.clientes.length > 0) && (
            <button type="button" className={cx(fila(destinos.length), "border-t border-slate-100 text-sm font-semibold text-primary")} onClick={() => ir(verTodo)}>
              <Search className="size-4" /> Ver todos los resultados de «{texto.trim()}»
            </button>
          )}
        </div>
      )}
    </form>
  );
}
