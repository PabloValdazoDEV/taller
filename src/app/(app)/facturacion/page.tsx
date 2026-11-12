import Link from "next/link";
import { requireSesion } from "@/lib/auth";
import { facturacionPeriodo } from "@/lib/historico";
import { pendientesCobro } from "@/lib/data";
import { leerPeriodo, paramsPeriodo } from "@/lib/periodo";
import { fmtFecha } from "@/lib/formato";
import { fmtEuros } from "@/lib/importes";
import { Matricula, Pastilla, Tarjeta, Vacio, cx } from "@/components/ui";
import { Cifras, SelectorPeriodo } from "@/components/selector-periodo";

export const dynamic = "force-dynamic";

const METODOS = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", bizum: "Bizum" } as const;

export default async function Facturacion({ searchParams }: { searchParams: Promise<{ p?: string; dia?: string; desde?: string; hasta?: string; f?: string }> }) {
  const s = await requireSesion("facturacion");
  const sp = await searchParams;
  const periodo = leerPeriodo(sp, "mes");
  const soloSinFactura = sp.f === "sinfactura";
  const [{ proformas, cobros }, pendientes] = await Promise.all([facturacionPeriodo(s.tid, periodo.desde, periodo.hasta), pendientesCobro(s.tid)]);

  const total = proformas.reduce((a, p) => a + p.total, 0);
  const base = proformas.reduce((a, p) => a + p.base, 0);
  const iva = proformas.reduce((a, p) => a + p.iva, 0);
  const cobradoPeriodo = cobros.reduce((a, c) => a + c.importe, 0);
  const pendientePeriodo = proformas.reduce((a, p) => a + p.pendienteCliente + p.pendienteCompania, 0);
  const pendienteTotal = pendientes.reduce((a, p) => a + p.pendienteCliente + p.pendienteCompania, 0);
  const sinFactura = proformas.filter((p) => !p.facturaExterna);

  // Por quién paga: los clientes (su parte) y cada compañía (la suya)
  const pagadores = new Map<string, { nombre: string; total: number; cobrado: number; pendiente: number; n: number }>();
  const suma = (clave: string, nombre: string, t: number, c: number, pe: number) => {
    const x = pagadores.get(clave) ?? { nombre, total: 0, cobrado: 0, pendiente: 0, n: 0 };
    pagadores.set(clave, { nombre, total: x.total + t, cobrado: x.cobrado + c, pendiente: x.pendiente + pe, n: x.n + 1 });
  };
  for (const p of proformas) {
    if (p.reparto.cliente) suma("_clientes", "Clientes (su parte)", p.reparto.cliente, Math.min(p.cobradoCliente, p.reparto.cliente), p.pendienteCliente);
    if (p.reparto.compania) suma(`c:${p.reparto.companiaNombre}`, p.reparto.companiaNombre ?? "Compañía", p.reparto.compania, Math.min(p.cobradoCompania, p.reparto.compania), p.pendienteCompania);
  }
  const porMetodo = Object.entries(METODOS).map(([k, nombre]) => ({
    nombre,
    cliente: cobros.filter((c) => c.metodo === k && c.pagador === "cliente").reduce((a, c) => a + c.importe, 0),
    compania: cobros.filter((c) => c.metodo === k && c.pagador === "compania").reduce((a, c) => a + c.importe, 0),
  }));

  const params = paramsPeriodo(periodo);
  const lista = soloSinFactura ? sinFactura : proformas;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Facturación</h1>
        <p className="text-sm text-slate-500">Importes de las proformas del periodo, cobros y lo que falta por cobrar. La factura legal se hace en vuestro programa de facturación.</p>
      </div>
      <SelectorPeriodo ruta="/facturacion" periodo={periodo} extra={soloSinFactura ? "f=sinfactura" : ""} csv={`/api/facturacion?${params}`} />

      <Cifras
        datos={[
          { n: fmtEuros(total), t: `${proformas.length} ${proformas.length === 1 ? "trabajo" : "trabajos"} (IVA incl.)`, detalle: `Base ${fmtEuros(base)} · IVA ${fmtEuros(iva)}` },
          { n: fmtEuros(cobradoPeriodo), t: "cobrado en el periodo", tono: "verde" },
          { n: fmtEuros(pendientePeriodo), t: "pendiente de estos trabajos", tono: pendientePeriodo ? "rojo" : undefined },
          { n: fmtEuros(pendienteTotal), t: "pendiente en total", detalle: "de todas las fechas" },
          { n: sinFactura.length, t: "sin nº de factura", tono: sinFactura.length ? "rojo" : undefined },
          { n: proformas.length ? fmtEuros(Math.round(total / proformas.length)) : "—", t: "por trabajo de media" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta className="p-4">
          <h2 className="mb-2 font-semibold">Quién paga</h2>
          {pagadores.size === 0 ? (
            <p className="text-sm text-slate-500">Sin trabajos en el periodo.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="py-1 font-medium">Pagador</th><th className="py-1 text-right font-medium">Total</th><th className="py-1 text-right font-medium">Cobrado</th><th className="py-1 text-right font-medium">Pendiente</th></tr></thead>
              <tbody>
                {[...pagadores.values()].sort((a, b) => b.total - a.total).map((x) => (
                  <tr key={x.nombre} className="border-t border-slate-100">
                    <td className="py-1.5 pr-2">{x.nombre} <span className="text-xs text-slate-400">({x.n})</span></td>
                    <td className="py-1.5 text-right tabular-nums">{fmtEuros(x.total)}</td>
                    <td className="py-1.5 text-right tabular-nums text-emerald-700">{fmtEuros(x.cobrado)}</td>
                    <td className={cx("py-1.5 text-right tabular-nums", x.pendiente ? "font-semibold text-red-700" : "text-slate-400")}>{fmtEuros(x.pendiente)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Tarjeta>
        <Tarjeta className="p-4">
          <h2 className="mb-2 font-semibold">Cobros del periodo por forma de pago</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1 font-medium">Forma de pago</th><th className="py-1 text-right font-medium">Clientes</th><th className="py-1 text-right font-medium">Compañías</th><th className="py-1 text-right font-medium">Total</th></tr></thead>
            <tbody>
              {porMetodo.map((m) => (
                <tr key={m.nombre} className="border-t border-slate-100">
                  <td className="py-1.5">{m.nombre}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtEuros(m.cliente)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtEuros(m.compania)}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{fmtEuros(m.cliente + m.compania)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="py-1.5">Total</td>
                <td className="py-1.5 text-right tabular-nums">{fmtEuros(porMetodo.reduce((a, m) => a + m.cliente, 0))}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtEuros(porMetodo.reduce((a, m) => a + m.compania, 0))}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtEuros(cobradoPeriodo)}</td>
              </tr>
            </tbody>
          </table>
        </Tarjeta>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Trabajos del periodo</h2>
        <span className="ml-auto flex gap-1.5">
          <Link href={`/facturacion?${params}`} aria-current={!soloSinFactura ? "page" : undefined} className={cx("inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-medium", !soloSinFactura ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")}>Todos ({proformas.length})</Link>
          <Link href={`/facturacion?${params}&f=sinfactura`} aria-current={soloSinFactura ? "page" : undefined} className={cx("inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm font-medium", soloSinFactura ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")}>Sin nº de factura ({sinFactura.length})</Link>
        </span>
      </div>
      {lista.length === 0 ? (
        <Tarjeta><Vacio>{soloSinFactura ? "Todos los trabajos del periodo tienen nº de factura." : "No hay trabajos con proforma en el periodo."}</Vacio></Tarjeta>
      ) : (
        <Tarjeta className="divide-y divide-slate-100">
          {lista.map((p) => {
            const pendiente = p.pendienteCliente + p.pendienteCompania;
            return (
              <Link key={p.id} href={`/ot/${p.otId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 hover:bg-slate-50">
                <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Matricula>{p.matricula}</Matricula>
                    <span className="truncate font-medium">{p.clienteNombre}</span>
                    {p.ivaModo === "exento" && <Pastilla color="#0369a1">Exento IVA</Pastilla>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {fmtFecha(p.fecha)} · {p.otNumero} · proforma {p.numero}
                    {p.reparto.compania > 0 && ` · ${p.reparto.companiaNombre ?? "Compañía"} paga ${fmtEuros(p.reparto.compania)}`}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold tabular-nums">{fmtEuros(p.total)}</div>
                  <div className={cx("text-xs tabular-nums", pendiente ? "text-red-700" : "text-emerald-700")}>{pendiente ? `Falta ${fmtEuros(pendiente)}` : "Cobrado"}</div>
                </div>
                <div className="w-full text-sm sm:w-36 sm:text-right">
                  {p.facturaExterna ? <Pastilla color="#047857">Factura {p.facturaExterna}</Pastilla> : <Pastilla color="#b45309">Sin nº de factura</Pastilla>}
                </div>
              </Link>
            );
          })}
        </Tarjeta>
      )}
    </div>
  );
}
