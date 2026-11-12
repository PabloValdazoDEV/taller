import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type Variante = "primario" | "secundario" | "peligro" | "fantasma" | "exito";
const VARIANTES: Record<Variante, string> = {
  primario: "bg-primary text-primary-fg hover:brightness-110 shadow-sm",
  secundario: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50",
  peligro: "bg-red-600 text-white hover:bg-red-700",
  exito: "bg-emerald-600 text-white hover:bg-emerald-700",
  fantasma: "text-slate-700 hover:bg-slate-200/60",
};
const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-11 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none";

export function Boton({ variante = "primario", className, ...p }: ComponentProps<"button"> & { variante?: Variante }) {
  return <button className={cx(base, VARIANTES[variante], className)} {...p} />;
}

export function BotonLink({
  variante = "primario",
  className,
  ...p
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link className={cx(base, VARIANTES[variante], className)} {...p} />;
}

export function Tarjeta({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl bg-white border border-slate-200 shadow-sm", className)} {...p} />;
}

export function TituloSeccion({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-base font-semibold text-slate-800">{children}</h2>
      {accion}
    </div>
  );
}

export function Pastilla({ color, children, className }: { color?: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", className)}
      style={color ? { backgroundColor: `${color}1a`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function Campo({ etiqueta, children, ayuda, className }: { etiqueta: string; children: ReactNode; ayuda?: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="block text-sm font-medium text-slate-700 mb-1">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-xs text-slate-500 mt-1">{ayuda}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3 min-h-11 text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...p} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cx(inputCls, className)} {...p} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputCls, "py-2 min-h-24", className)} {...p} />;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500 py-6 text-center">{children}</p>;
}

export function Matricula({ children, grande }: { children: ReactNode; grande?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap shrink-0 rounded-md border-2 border-slate-800 bg-white font-mono font-bold tracking-wider text-slate-900",
        grande ? "px-3 py-1 text-xl" : "px-1.5 text-xs",
      )}
    >
      <span className={cx("bg-blue-700 text-white rounded-sm mr-1.5", grande ? "px-1 text-xs" : "px-0.5 text-[8px]")}>E</span>
      {children}
    </span>
  );
}
