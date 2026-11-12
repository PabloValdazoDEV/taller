import type { Metadata } from "next";
import { CalendarDays, Car, Check, Clock, FileText, MapPin, Phone, ShieldCheck } from "lucide-react";
import { getOT } from "@/lib/data";
import { tallerPorId } from "@/lib/taller";
import { verificarTokenSeguimiento } from "@/lib/seguimiento";
import { FASE_CLIENTE, faseCliente, hoyISO, queDecirle, type FaseCliente } from "@/lib/estado-cliente";
import { enlaceDocumento } from "@/lib/enlaces";
import { caducado, enlacePresupuesto } from "@/lib/presupuestos";
import { fmtEuros } from "@/lib/importes";
import { fmtFecha, TIPO_DOCUMENTO } from "@/lib/formato";
import { Matricula } from "@/components/ui";
import { LogoMarca } from "@/components/selector-marca-modelo";
import { AutoRefresco } from "@/components/auto-refresco";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Seguimiento de su vehículo", robots: { index: false, follow: false } };

// Pasos que ve el cliente: los estados internos se agrupan en «En el taller»
const PASOS = [
  { id: "recibido", titulo: "Recibido" },
  { id: "taller", titulo: "En el taller" },
  { id: "listo", titulo: "Listo" },
  { id: "entregado", titulo: "Entregado" },
] as const;
const pasoDe = (f: FaseCliente) => (f === "recibido" ? 0 : f === "listo" ? 2 : f === "entregado" ? 3 : 1);

/** Página pública de seguimiento (enlace enviado al cliente en la recepción). Solo muestra lo que es del cliente. */
export default async function Seguimiento({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const v = await verificarTokenSeguimiento(token);
  const ot = v ? await getOT(v.tallerId, v.otId) : null;
  if (!v || !ot) return <Aviso titulo="Enlace no válido o caducado" texto="Pida al taller que le envíe el enlace de nuevo." />;
  const taller = await tallerPorId(v.tallerId);
  const telefono = taller.telefono;
  const hoy = hoyISO();

  const o = {
    estadoNombre: ot.estado.nombre,
    estadoMarca: ot.estado.marca,
    requiereAprobacion: ot.estado.requiereAprobacion,
    fechaPrevista: ot.ot.fechaPrevista,
    cerradaEn: ot.ot.cerradaEn,
    datosSiniestro: ot.ot.datosSiniestro,
    incidenciasCliente: ot.incidencias
      .filter(({ i }) => i.visibleCliente && (i.estado === "abierta" || i.estado === "en_curso"))
      .map(({ i }) => ({ tipo: i.tipo, descripcion: i.descripcion, nuevaFecha: i.nuevaFecha })),
  };
  const fase = faseCliente(o);
  const paso = pasoDe(fase);
  const anulada = !!ot.ot.anuladaEn;
  const sinReparar = !!ot.entrega?.motivoSinReparar;

  // Presupuesto que espera su respuesta (enlace para verlo y aceptarlo)
  const pendiente = !ot.ot.cerradaEn ? ot.presupuestos.find((p) => p.estado === "pendiente" && !caducado(p)) : undefined;
  const enlacePres = pendiente ? await enlacePresupuesto(pendiente) : null;
  const documentos = await Promise.all(
    ot.documentos.map(async (d) => ({
      id: d.id,
      titulo: d.tipo === "entrega" && sinReparar ? "Acta de retirada sin reparar" : (TIPO_DOCUMENTO[d.tipo] ?? "Documento"),
      fecha: d.creadoEn,
      enlace: await enlaceDocumento(d.id, v.tallerId),
    })),
  );
  const prestamo = ot.prestamos.find((p) => !p.p.devueltoEn);
  const retraso = o.incidenciasCliente.find((i) => i.tipo === "retraso_piezas" && i.nuevaFecha);
  const prevista = retraso?.nuevaFecha ?? ot.ot.fechaPrevista;
  const nombre = ot.cliente.nombre.split(" ")[0];
  const tel = telefono?.replace(/\s/g, "");

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-6" style={{ ["--primary" as string]: taller.colorPrimario }}>
      {!ot.ot.cerradaEn && !anulada && <AutoRefresco segundos={60} />}
      <div className="mx-auto max-w-xl space-y-4">
        <header className="flex items-center gap-3">
          {taller.logoRuta && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/logo?v=${encodeURIComponent(taller.logoRuta.slice(-12))}`} alt="" className="size-12 rounded-lg bg-white object-contain p-1" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-bold">{taller.nombre}</div>
            {taller.direccion && <div className="flex items-center gap-1 text-sm text-slate-600"><MapPin className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{taller.direccion}</span></div>}
          </div>
          {tel && (
            <a href={`tel:${tel}`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
              <Phone className="size-4" aria-hidden /> Llamar
            </a>
          )}
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div>
            <h1 className="text-xl font-bold">Hola, {nombre}</h1>
            <p className="text-slate-600">Aquí puede ver cómo va su vehículo. Esta página se actualiza sola.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Matricula grande>{ot.vehiculo.matricula}</Matricula>
            <span className="flex items-center gap-2 font-semibold">
              {ot.vehiculo.marca && <LogoMarca marca={ot.vehiculo.marca} className="size-7" />} {ot.vehiculo.marca} {ot.vehiculo.modelo}
            </span>
          </div>

          {anulada ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" role="status">
              <p className="font-semibold">Este trabajo se ha cancelado</p>
              <p className="text-sm text-slate-600">Si tiene cualquier duda, llámenos.</p>
            </div>
          ) : (
            <>
              <ol className="grid grid-cols-4 gap-1" aria-label="Progreso">
                {PASOS.map((p, i) => {
                  const hecho = i < paso || (i === paso && i === 3);
                  const actual = i === paso;
                  return (
                    <li key={p.id} className="flex flex-col items-center gap-1 text-center" aria-current={actual ? "step" : undefined}>
                      <span
                        className={`grid size-8 place-items-center rounded-full border-2 text-sm font-bold ${
                          hecho ? "border-emerald-600 bg-emerald-600 text-white" : actual ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-400"
                        }`}
                      >
                        {hecho ? <Check className="size-4" aria-hidden /> : i + 1}
                      </span>
                      <span className={`text-xs leading-tight ${actual ? "font-semibold text-slate-900" : "text-slate-500"}`}>{p.titulo}</span>
                    </li>
                  );
                })}
              </ol>

              <div className="rounded-xl p-4 text-white" style={{ background: FASE_CLIENTE[fase].color }} role="status">
                <p className="text-lg font-bold">{sinReparar ? "Retirado sin reparar" : FASE_CLIENTE[fase].titulo}</p>
                <p className="text-sm opacity-95">
                  {fase === "entregado"
                    ? `Se entregó el ${fmtFecha(ot.ot.cerradaEn)}. ¡Gracias por su confianza!`
                    : fase === "listo" && taller.config.horario
                      ? `Ya puede pasar a recogerlo. Horario: ${taller.config.horario}.`
                      : queDecirle(o, hoy, { sinFecha: true })}
                </p>
              </div>

              {!ot.ot.cerradaEn && (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <Dato icono={<CalendarDays className="size-4" aria-hidden />} etiqueta="Entró el" valor={fmtFecha(ot.ot.fechaEntrada)} />
                  {prevista && fase !== "listo" && (
                    <Dato icono={<Clock className="size-4" aria-hidden />} etiqueta="Fecha prevista" valor={fmtFecha(prevista)} nota={retraso ? "Nueva fecha por retraso de piezas" : undefined} />
                  )}
                </dl>
              )}
            </>
          )}
        </section>

        {pendiente && enlacePres && (
          <section className="space-y-2 rounded-2xl border-2 border-violet-300 bg-violet-50 p-4">
            <p className="font-semibold text-violet-950">{pendiente.tipo === "complementario" ? "Tiene una ampliación del presupuesto pendiente" : "Tiene un presupuesto pendiente de aceptar"}</p>
            <p className="text-sm text-violet-900">Importe: <b>{fmtEuros(pendiente.total)}</b> · Válido hasta el {fmtFecha(pendiente.validezHasta)}</p>
            <a href={enlacePres} className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">Ver y responder al presupuesto</a>
          </section>
        )}

        {prestamo && (
          <section className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Car className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold">Lleva nuestro coche de sustitución</p>
              <p className="text-slate-600">{prestamo.coche.marca} {prestamo.coche.modelo} ({prestamo.coche.matricula}). Tráigalo cuando venga a recoger el suyo.</p>
            </div>
          </section>
        )}

        {fase === "entregado" && !sinReparar && ot.entrega?.garantiaTexto && (
          <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden />
            <div className="text-sm text-emerald-950">
              <p className="font-semibold">Garantía</p>
              <p>{ot.entrega.garantiaTexto}</p>
            </div>
          </section>
        )}

        {documentos.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Sus documentos</h2>
            <ul className="divide-y divide-slate-100">
              {documentos.map((d) => (
                <li key={d.id}>
                  <a href={d.enlace} target="_blank" rel="noopener" className="flex min-h-12 items-center gap-3 py-2 hover:text-slate-950">
                    <FileText className="size-5 shrink-0 text-slate-400" aria-hidden />
                    <span className="flex-1 font-medium">{d.titulo}</span>
                    <span className="text-xs text-slate-500">{fmtFecha(d.fecha)}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Documentos firmados en PDF.</p>
          </section>
        )}

        <footer className="pb-4 text-center text-xs text-slate-500">
          Orden {ot.ot.numero} · {taller.nombre}
          {taller.config.horario && <> · Horario: {taller.config.horario}</>}
        </footer>
      </div>
    </main>
  );
}

function Dato({ icono, etiqueta, valor, nota }: { icono: React.ReactNode; etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
      <span className="mt-0.5 text-slate-500">{icono}</span>
      <div>
        <dt className="text-slate-500">{etiqueta}</dt>
        <dd className="font-semibold">{valor}</dd>
        {nota && <dd className="text-xs text-amber-700">{nota}</dd>}
      </div>
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-100 p-6 text-center">
      <div>
        <h1 className="text-xl font-bold">{titulo}</h1>
        <p className="mt-1 text-slate-600">{texto}</p>
      </div>
    </main>
  );
}
