import { Document, Page, View, Text, Image, StyleSheet, Svg, Path, Rect, Circle, G } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Dano, DatosSiniestro, LineaPresupuesto } from "@/db/schema";
import { ESTILOS, VISTAS, vistaDe, zonaDano, type DefVista, type Forma } from "@/lib/silueta";
import { fmtCombustible, fmtFecha, fmtFechaHora, fmtKm, fmtMiles } from "@/lib/formato";
import { fmtHoras, type Cambio } from "@/lib/ampliacion";

const C = { texto: "#0f172a", suave: "#64748b", borde: "#cbd5e1", fondo: "#f1f5f9" };

const st = StyleSheet.create({
  pagina: { padding: 32, fontSize: 9, color: C.texto, fontFamily: "Helvetica", lineHeight: 1.35 },
  cabecera: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, paddingBottom: 8, marginBottom: 12 },
  tallerNombre: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  suave: { color: C.suave },
  titulo: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right", marginBottom: 3 },
  seccion: { marginBottom: 10 },
  seccionTitulo: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.suave, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, borderBottomWidth: 0.5, borderBottomColor: C.borde, paddingBottom: 2 },
  fila: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  dato: { flexDirection: "row", marginBottom: 2 },
  datoEt: { width: 78, color: C.suave },
  datoVal: { flex: 1, fontFamily: "Helvetica-Bold" },
  caja: { backgroundColor: C.fondo, padding: 6, borderRadius: 3 },
  legal: { fontSize: 7.5, color: C.suave, textAlign: "justify", marginTop: 6 },
  firmas: { flexDirection: "row", gap: 24, marginTop: 10 },
  firmaCaja: { flex: 1, borderWidth: 0.5, borderColor: C.borde, borderRadius: 3, padding: 6, height: 96 },
  pie: { position: "absolute", bottom: 18, left: 32, right: 32, fontSize: 6.5, color: C.suave, borderTopWidth: 0.5, borderTopColor: C.borde, paddingTop: 4 },
  foto: { width: 92, height: 69, objectFit: "cover", borderRadius: 2 },
});

export type TallerPdf = {
  nombre: string; razonSocial: string | null; nif: string | null; direccion: string | null; telefono: string | null; email: string | null;
  /** data URL PNG/JPEG */
  logo?: string | null;
  /** data URL PNG/JPEG del sello o firma del taller */
  sello?: string | null;
};
export type Evidencia = { firmante: string; fecha: Date; ip: string; dispositivo: string; atendidoPor: string; documentoId: string };

function Marco({ taller, titulo, subtitulo, evidencia, pie, children }: { taller: TallerPdf; titulo: string; subtitulo: string; evidencia?: Evidencia; pie?: string; children: ReactNode }) {
  return (
    <Document title={`${titulo} ${subtitulo}`} author={taller.nombre} producer="Gestión de Taller">
      <Page size="A4" style={st.pagina}>
        <View style={st.cabecera} fixed>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            {taller.logo && <Image src={taller.logo} style={{ width: 64, height: 44, objectFit: "contain" }} />}
            <View>
            <Text style={st.tallerNombre}>{taller.nombre}</Text>
            <Text style={st.suave}>{[taller.razonSocial, taller.nif].filter(Boolean).join(" · ")}</Text>
            <Text style={st.suave}>{taller.direccion}</Text>
            <Text style={st.suave}>{[taller.telefono, taller.email].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
          <View>
            <Text style={st.titulo}>{titulo}</Text>
            <Text style={{ textAlign: "right" }}>{subtitulo}</Text>
            {evidencia && <Text style={[st.suave, { textAlign: "right" }]}>{fmtFechaHora(evidencia.fecha)}</Text>}
          </View>
        </View>
        {children}
        <Text style={st.pie} fixed render={({ pageNumber, totalPages }) =>
          evidencia
            ? `Firmado electrónicamente por ${evidencia.firmante} el ${fmtFechaHora(evidencia.fecha)} · IP ${evidencia.ip} · Atendido por ${evidencia.atendidoPor} · Doc. ${evidencia.documentoId} · ` +
              `Dispositivo: ${evidencia.dispositivo.slice(0, 90)} · Pág. ${pageNumber}/${totalPages}`
            : `${pie ?? ""} · Pág. ${pageNumber}/${totalPages}`
        } />
      </Page>
    </Document>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={st.seccion} wrap={false}>
      <Text style={st.seccionTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

function Dato({ et, val }: { et: string; val: ReactNode }) {
  return (
    <View style={st.dato}>
      <Text style={st.datoEt}>{et}</Text>
      <Text style={st.datoVal}>{val || "—"}</Text>
    </View>
  );
}

const COLOR_DANO: Record<string, string> = { Arañazo: "#f59e0b", Abolladura: "#ef4444", Rotura: "#b91c1c", Pintura: "#8b5cf6", Óxido: "#92400e" };

function FormaPdf({ f }: { f: Forma }) {
  const e = ESTILOS[f.e];
  const p = { fill: e.fill, stroke: e.stroke ?? "none", strokeWidth: e.sw ?? 0 };
  if (f.t === "path") return <Path d={f.d} {...p} />;
  if (f.t === "rect") return <Rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} {...p} />;
  return <Circle cx={f.cx} cy={f.cy} r={f.r} {...p} />;
}

function VistaPdf({ def, danos, ancho }: { def: DefVista; danos: { d: Dano; n: number }[]; ancho: number }) {
  const r = Math.max(def.w, def.h) * 0.032;
  return (
    <View style={{ alignItems: "center", marginRight: 8, marginBottom: 6 }}>
      <Svg width={ancho} height={(ancho * def.h) / def.w} viewBox={`0 0 ${def.w} ${def.h}`}>
        <G transform={def.espejo ? `translate(${def.w} 0) scale(-1 1)` : undefined}>
          {def.formas.map((f, i) => <FormaPdf key={i} f={f} />)}
        </G>
        {danos.map(({ d, n }) => (
          <G key={n}>
            <Circle cx={(d.x / 100) * def.w} cy={(d.y / 100) * def.h} r={r} fill={COLOR_DANO[d.tipo] ?? "#475569"} stroke="#ffffff" strokeWidth={r * 0.2} />
            <Text x={(d.x / 100) * def.w} y={(d.y / 100) * def.h + r * 0.4} textAnchor="middle" fill="#ffffff" style={{ fontSize: r * 1.1, fontFamily: "Helvetica-Bold" }}>
              {String(n)}
            </Text>
          </G>
        ))}
      </Svg>
      <Text style={{ fontSize: 6.5, color: C.suave, marginTop: 1 }}>{def.nombre}</Text>
    </View>
  );
}

function SiluetaPdf({ danos }: { danos: Dano[] }) {
  const numerados = danos.map((d, i) => ({ d, n: i + 1 }));
  const conDanos = VISTAS.filter((v) => danos.some((d) => vistaDe(d) === v.clave));
  const vistas = conDanos.length ? conDanos : [VISTAS[0]];
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}>
        {vistas.map((v) => (
          <VistaPdf key={v.clave} def={v} ancho={v.clave === "superior" ? 62 : v.w > 350 ? 170 : 110} danos={numerados.filter(({ d }) => vistaDe(d) === v.clave)} />
        ))}
      </View>
      {danos.length === 0 && <Text style={st.suave}>Sin daños declarados.</Text>}
      {numerados.map(({ d, n }) => (
        <View key={n} style={{ flexDirection: "row", marginBottom: 2, alignItems: "center" }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_DANO[d.tipo] ?? "#475569", marginRight: 4 }} />
          <Text>
            {n}. {d.tipo} — {zonaDano(d)}{d.nota ? ` (${d.nota})` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Firmas({ firmaPng, firmante, empleado, sello, etiquetaCliente = "Firma del cliente" }: { firmaPng: string; firmante: string; empleado: string; sello?: string | null; etiquetaCliente?: string }) {
  return (
    <View style={st.firmas} wrap={false}>
      <View style={st.firmaCaja}>
        <Text style={st.suave}>{etiquetaCliente}</Text>
        <Image src={firmaPng} style={{ height: 62, objectFit: "contain" }} />
        <Text>{firmante}</Text>
      </View>
      <View style={st.firmaCaja}>
        <Text style={st.suave}>Por el taller</Text>
        {sello ? <Image src={sello} style={{ height: 62, objectFit: "contain" }} /> : <View style={{ height: 62 }} />}
        <Text>Atendido por {empleado}</Text>
      </View>
    </View>
  );
}

function Siniestro({ d }: { d: DatosSiniestro | null | undefined }) {
  if (!d?.companiaNombre) return null;
  return (
    <Seccion titulo="Compañía / siniestro">
      <View style={st.fila}>
        <View style={st.col}>
          <Dato et="Compañía" val={d.companiaNombre} />
          <Dato et="Nº siniestro" val={d.numeroSiniestro} />
          <Dato et="Póliza / contrato" val={d.numeroPoliza} />
        </View>
        <View style={st.col}>
          <Dato et="Perito" val={d.perito} />
          <Dato et="Franquicia" val={d.franquicia != null ? `${d.franquicia} €` : ""} />
          <Dato et="Coche sustitución" val={d.cubreSustitucion ? "Cubierto por póliza" : "No"} />
        </View>
      </View>
    </Seccion>
  );
}

type Cli = { nombre: string; nif: string | null; telefono: string | null; email: string | null };
type Veh = { matricula: string; marca: string | null; modelo: string | null; bastidor: string | null; color: string | null };

function ClienteVehiculo({ cliente, vehiculo, km, combustible }: { cliente: Cli; vehiculo: Veh; km?: number | null; combustible?: number | null }) {
  return (
    <View style={[st.fila, st.seccion]}>
      <View style={st.col}>
        <Text style={st.seccionTitulo}>Cliente</Text>
        <Dato et="Nombre" val={cliente.nombre} />
        <Dato et="NIF" val={cliente.nif} />
        <Dato et="Teléfono" val={cliente.telefono} />
        <Dato et="Email" val={cliente.email} />
      </View>
      <View style={st.col}>
        <Text style={st.seccionTitulo}>Vehículo</Text>
        <Dato et="Matrícula" val={vehiculo.matricula} />
        <Dato et="Marca / modelo" val={`${vehiculo.marca ?? ""} ${vehiculo.modelo ?? ""}`.trim()} />
        <Dato et="Bastidor" val={vehiculo.bastidor} />
        {km !== undefined && <Dato et="Kilómetros" val={fmtKm(km)} />}
        {combustible !== undefined && <Dato et="Combustible" val={fmtCombustible(combustible)} />}
      </View>
    </View>
  );
}

// ───────────────────────── Resguardo de depósito ─────────────────────────

export type DatosResguardo = {
  taller: TallerPdf;
  evidencia: Evidencia;
  numeroOT: string;
  tipoOrden: string;
  cliente: Cli;
  vehiculo: Veh;
  km: number | null;
  combustible: number | null;
  testigos: string[];
  objetos: string[];
  danos: Dano[];
  observaciones: string | null;
  trabajoSolicitado: string;
  fechaEntrada: Date;
  fechaPrevista: string | null;
  renunciaPresupuesto: boolean;
  siniestro?: DatosSiniestro | null;
  fotos: string[]; // data URLs
  textoLegal: string;
  firmaPng: string;
};

export function ResguardoPdf(d: DatosResguardo) {
  return (
    <Marco taller={d.taller} titulo="RESGUARDO DE DEPÓSITO" subtitulo={`Orden ${d.numeroOT} · ${d.tipoOrden}`} evidencia={d.evidencia}>
      <ClienteVehiculo cliente={d.cliente} vehiculo={d.vehiculo} km={d.km} combustible={d.combustible} />
      <Siniestro d={d.siniestro} />
      <Seccion titulo="Trabajo solicitado">
        <View style={st.caja}><Text>{d.trabajoSolicitado}</Text></View>
        <View style={[st.fila, { marginTop: 4 }]}>
          <View style={st.col}><Dato et="Recepción" val={fmtFechaHora(d.fechaEntrada)} /><Dato et="Entrega prevista" val={fmtFecha(d.fechaPrevista)} /></View>
          <View style={st.col}><Dato et="Presupuesto" val={d.renunciaPresupuesto ? "El cliente AUTORIZA la reparación sin presupuesto previo" : "Se facilitará presupuesto antes de reparar"} /></View>
        </View>
      </Seccion>
      <Seccion titulo="Estado del vehículo a la entrada">
        <SiluetaPdf danos={d.danos} />
        <View style={[st.fila, { marginTop: 6 }]}>
          <View style={st.col}><Dato et="Testigos" val={d.testigos.join(", ") || "Ninguno"} /></View>
          <View style={st.col}><Dato et="Objetos / acc." val={d.objetos.join(", ") || "Ninguno"} /></View>
        </View>
        {d.observaciones && <Dato et="Observaciones" val={d.observaciones} />}
      </Seccion>
      {d.fotos.length > 0 && (
        <Seccion titulo={`Fotografías (${d.fotos.length})`}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {d.fotos.slice(0, 8).map((f, i) => <Image key={i} src={f} style={st.foto} />)}
          </View>
          {d.fotos.length > 8 && <Text style={st.suave}>+{d.fotos.length - 8} fotografías más archivadas en la orden.</Text>}
        </Seccion>
      )}
      <Text style={st.legal}>{d.textoLegal}</Text>
      <Firmas sello={d.taller.sello} firmaPng={d.firmaPng} firmante={d.evidencia.firmante} empleado={d.evidencia.atendidoPor} />
    </Marco>
  );
}

// ───────────────────────── Acta de entrega ─────────────────────────

export type DatosEntrega = {
  /** Motivo si el cliente se lleva el vehículo sin reparar */
  sinReparar?: string | null;
  taller: TallerPdf;
  evidencia: Evidencia;
  numeroOT: string;
  tipoOrden: string;
  cliente: Cli;
  vehiculo: Veh;
  fechaEntrada: Date;
  kmEntrada: number | null;
  km: number | null;
  trabajosRealizados: string;
  piezasSustituidas: string | null;
  incidencias: { tipo: string; descripcion: string; resolucion: string | null }[];
  garantia: string;
  textoLegal: string;
  siniestro?: DatosSiniestro | null;
  fotosAntes: string[];
  fotosDespues: string[];
  totalFotosDespues: number;
  firmaPng: string;
  /** Importe según la proforma y lo cobrado al entregar (si la orden tiene importes en la app) */
  importe?: { proforma: string; total: number; cliente: number; clientePagado: number; compania: number; companiaNombre: string | null; metodos: string } | null;
};

export function EntregaPdf(d: DatosEntrega) {
  return (
    <Marco taller={d.taller} titulo={d.sinReparar ? "ACTA DE RETIRADA SIN REPARAR" : "ACTA DE ENTREGA"} subtitulo={`Orden ${d.numeroOT} · ${d.tipoOrden}`} evidencia={d.evidencia}>
      <ClienteVehiculo cliente={d.cliente} vehiculo={d.vehiculo} />
      {d.sinReparar && (
        <View style={{ borderWidth: 1.5, borderColor: "#b91c1c", borderRadius: 3, padding: 6, marginBottom: 8 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: "#b91c1c" }}>EL CLIENTE RETIRA EL VEHÍCULO SIN REPARAR</Text>
          <Text>Motivo: {d.sinReparar}</Text>
          <Text style={[st.suave, { fontSize: 7 }]}>
            El cliente declara conocer el estado del vehículo y que no se han realizado los trabajos solicitados (salvo los indicados abajo). El taller no responde de
            las averías o daños pendientes de reparar.
          </Text>
        </View>
      )}
      <Seccion titulo="Estancia en taller">
        <View style={st.fila}>
          <View style={st.col}><Dato et="Entrada" val={fmtFechaHora(d.fechaEntrada)} /><Dato et="Km entrada" val={fmtKm(d.kmEntrada)} /></View>
          <View style={st.col}><Dato et="Salida" val={fmtFechaHora(d.evidencia.fecha)} /><Dato et="Km salida" val={fmtKm(d.km)} /></View>
        </View>
      </Seccion>
      <Siniestro d={d.siniestro} />
      <Seccion titulo="Trabajos realizados">
        <View style={st.caja}><Text>{d.trabajosRealizados}</Text></View>
      </Seccion>
      {d.piezasSustituidas && (
        <Seccion titulo="Piezas sustituidas">
          <Text>{d.piezasSustituidas}</Text>
          <Text style={[st.suave, { fontSize: 7 }]}>Las piezas sustituidas están a disposición del cliente si las solicita.</Text>
        </Seccion>
      )}
      {d.importe && (
        <Seccion titulo="Importe">
          <Dato et="Total" val={`${eur(d.importe.total)} (proforma ${d.importe.proforma}; la factura se emite por separado)`} />
          <Dato
            et="Cliente"
            val={`${eur(d.importe.cliente)} · ${d.importe.clientePagado >= d.importe.cliente ? `pagado${d.importe.metodos ? ` (${d.importe.metodos})` : ""}` : `pagado ${eur(d.importe.clientePagado)}, PENDIENTE ${eur(d.importe.cliente - d.importe.clientePagado)}`}`}
          />
          {d.importe.companiaNombre && <Dato et="A cargo de" val={`${d.importe.companiaNombre}: ${eur(d.importe.compania)}`} />}
        </Seccion>
      )}
      {d.incidencias.length > 0 && (
        <Seccion titulo="Incidencias durante la reparación">
          {d.incidencias.map((i, k) => (
            <Text key={k}>• {i.tipo}: {i.descripcion}{i.resolucion ? ` → ${i.resolucion}` : ""}</Text>
          ))}
        </Seccion>
      )}
      {d.fotosDespues.length > 0 && (
        <Seccion titulo="Fotografías: antes y después">
          {d.fotosAntes.length > 0 && (
            <>
              <Text style={[st.suave, { marginBottom: 2 }]}>Antes (recepción)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {d.fotosAntes.map((f, i) => <Image key={i} src={f} style={st.foto} />)}
              </View>
            </>
          )}
          <Text style={[st.suave, { marginBottom: 2 }]}>Después (entrega)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {d.fotosDespues.map((f, i) => <Image key={i} src={f} style={st.foto} />)}
          </View>
          {d.totalFotosDespues > d.fotosDespues.length && <Text style={st.suave}>+{d.totalFotosDespues - d.fotosDespues.length} fotografías más archivadas en la orden.</Text>}
        </Seccion>
      )}
      {!d.sinReparar && d.garantia && <Seccion titulo="Garantía"><Text>{d.garantia}</Text></Seccion>}
      <Text style={st.legal}>{d.textoLegal}</Text>
      <Firmas sello={d.taller.sello} firmaPng={d.firmaPng} firmante={d.evidencia.firmante} empleado={d.evidencia.atendidoPor} etiquetaCliente={d.sinReparar ? "Retiro el vehículo sin reparar (cliente)" : "Recibí conforme (cliente)"} />
    </Marco>
  );
}

// ───────────────────────── Coche de sustitución ─────────────────────────

export type DatosPrestamo = {
  taller: TallerPdf;
  evidencia: Evidencia;
  modo: "salida" | "devolucion";
  coche: { matricula: string; marca: string; modelo: string };
  conductor: { nombre: string; dni: string; nacimiento: string; carnet: string };
  pagador: string;
  numeroOT: string | null;
  kmSalida: number;
  combSalida: number;
  danosSalida: Dano[];
  kmLlegada?: number;
  combLlegada?: number;
  danosLlegada?: Dano[];
  observaciones?: string | null;
  condicionesForzadas: boolean;
  textoLegal: string;
  firmaPng: string;
};

export function PrestamoPdf(d: DatosPrestamo) {
  const devol = d.modo === "devolucion";
  return (
    <Marco
      taller={d.taller}
      titulo={devol ? "DEVOLUCIÓN VEHÍCULO SUSTITUCIÓN" : "PRÉSTAMO VEHÍCULO SUSTITUCIÓN"}
      subtitulo={`${d.coche.matricula}${d.numeroOT ? ` · Orden ${d.numeroOT}` : ""}`}
      evidencia={d.evidencia}
    >
      <View style={[st.fila, st.seccion]}>
        <View style={st.col}>
          <Text style={st.seccionTitulo}>Vehículo cedido</Text>
          <Dato et="Matrícula" val={d.coche.matricula} />
          <Dato et="Marca / modelo" val={`${d.coche.marca} ${d.coche.modelo}`} />
          <Dato et="Coste a cargo de" val={d.pagador} />
        </View>
        <View style={st.col}>
          <Text style={st.seccionTitulo}>Conductor</Text>
          <Dato et="Nombre" val={d.conductor.nombre} />
          <Dato et="DNI / NIE" val={d.conductor.dni} />
          <Dato et="Nacimiento" val={fmtFecha(d.conductor.nacimiento)} />
          <Dato et="Carnet desde" val={fmtFecha(d.conductor.carnet)} />
        </View>
      </View>
      {d.condicionesForzadas && <Text style={{ color: "#b45309", marginBottom: 6 }}>Préstamo autorizado por el taller aunque el conductor no cumple las condiciones estándar.</Text>}
      <Seccion titulo="Estado a la salida">
        <View style={st.fila}><View style={st.col}><Dato et="Kilómetros" val={fmtKm(d.kmSalida)} /></View><View style={st.col}><Dato et="Combustible" val={fmtCombustible(d.combSalida)} /></View></View>
        <SiluetaPdf danos={d.danosSalida} />
      </Seccion>
      {devol && (
        <Seccion titulo="Estado a la devolución">
          <View style={st.fila}>
            <View style={st.col}><Dato et="Kilómetros" val={`${fmtKm(d.kmLlegada)} (${fmtMiles((d.kmLlegada ?? 0) - d.kmSalida)} recorridos)`} /></View>
            <View style={st.col}><Dato et="Combustible" val={fmtCombustible(d.combLlegada)} /></View>
          </View>
          <SiluetaPdf danos={d.danosLlegada ?? []} />
          {d.observaciones && <Dato et="Observaciones" val={d.observaciones} />}
        </Seccion>
      )}
      <Text style={st.legal}>{d.textoLegal}</Text>
      <Firmas sello={d.taller.sello} firmaPng={d.firmaPng} firmante={d.evidencia.firmante} empleado={d.evidencia.atendidoPor} etiquetaCliente={devol ? "Firma del conductor (devolución)" : "Firma del conductor"} />
    </Marco>
  );
}

// ───────────────────────── Presupuesto ─────────────────────────

export type DatosPresupuesto = {
  taller: TallerPdf;
  /** Solo si el cliente lo ha firmado (tablet o enlace) */
  evidencia?: Evidencia;
  firmaPng?: string;
  numero: string;
  numeroOT: string;
  tipo: "inicial" | "complementario";
  creadoEn: Date;
  validezHasta: string;
  cliente: Cli;
  vehiculo: Veh;
  trabajoSolicitado: string;
  /** Ampliación: presupuesto aceptado al que amplía y qué cambia */
  ampliacion?: { numero: string; total: number; cambios: Cambio[] } | null;
  horasEstimadas?: string | null;
  fechaEntrega?: string | null;
  lineas: LineaPresupuesto[];
  modo: "con_iva" | "exento";
  pct: string;
  motivoExencion: string | null;
  preciosConIva: boolean;
  base: number;
  iva: number;
  total: number;
  /** Situación si no está firmado (p. ej. «Aprobado por teléfono…» o «Rechazado») */
  situacion?: string;
  textoLegal: string;
};

const eur = (c: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(c / 100);
const precioPdf = (v: string) => {
  const n = Number(v);
  const dec = Math.round(n * 100) / 100 === n ? 2 : 4;
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: dec }).format(n);
};
const cant = (v: string) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(Number(v));
const ESP: Record<string, string> = { mecanica: "mecánica", chapa: "chapa", pintura: "pintura", lunas: "lunas" };

const tb = StyleSheet.create({
  fila: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.borde },
  cab: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: C.texto, fontFamily: "Helvetica-Bold", fontSize: 8 },
  concepto: { flex: 1, paddingRight: 6 },
  num: { width: 52, textAlign: "right" },
  dto: { width: 34, textAlign: "right" },
  imp: { width: 64, textAlign: "right" },
  tot: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 1.5 },
  totEt: { width: 150, textAlign: "right", paddingRight: 8, color: C.suave },
  totVal: { width: 70, textAlign: "right" },
});

type Importes = Pick<DatosPresupuesto, "lineas" | "modo" | "pct" | "motivoExencion" | "preciosConIva" | "base" | "iva" | "total">;

/** Tabla de líneas con base, IVA y total (o total exento con su motivo). La usan el presupuesto y la proforma. */
function TablaImportes({ d, titulo = "Detalle" }: { d: Importes; titulo?: string }) {
  return (
    <View style={st.seccion}>
      <Text style={st.seccionTitulo}>{titulo}{d.modo === "con_iva" ? (d.preciosConIva ? " (precios con IVA incluido)" : " (precios sin IVA)") : ""}</Text>
      <View style={tb.cab} fixed>
        <Text style={tb.concepto}>Concepto</Text>
        <Text style={tb.num}>Cantidad</Text>
        <Text style={tb.num}>Precio</Text>
        <Text style={tb.dto}>Dto.</Text>
        <Text style={tb.imp}>Importe</Text>
      </View>
      {d.lineas.map((l, i) => (
        <View key={i} style={tb.fila} wrap={false}>
          <View style={tb.concepto}>
            <Text>{l.descripcion}</Text>
            {(l.referencia || (l.tipo === "mano_obra" && l.especialidad)) && (
              <Text style={[st.suave, { fontSize: 7.5 }]}>
                {[l.tipo === "mano_obra" && l.especialidad ? `Mano de obra ${ESP[l.especialidad] ?? l.especialidad}` : null, l.referencia ? `Ref. ${l.referencia}` : null].filter(Boolean).join(" · ")}
              </Text>
            )}
          </View>
          <Text style={tb.num}>{cant(l.cantidad)}{l.tipo === "mano_obra" ? " h" : ""}</Text>
          <Text style={tb.num}>{precioPdf(l.precio)}</Text>
          <Text style={tb.dto}>{Number(l.descuento) > 0 ? `${cant(l.descuento)} %` : ""}</Text>
          <Text style={tb.imp}>{eur(l.importe)}</Text>
        </View>
      ))}
      <View style={{ marginTop: 6 }} wrap={false}>
        {d.modo === "con_iva" ? (
          <>
            <View style={tb.tot}><Text style={tb.totEt}>Base imponible</Text><Text style={tb.totVal}>{eur(d.base)}</Text></View>
            <View style={tb.tot}><Text style={tb.totEt}>IVA ({cant(d.pct)} %)</Text><Text style={tb.totVal}>{eur(d.iva)}</Text></View>
            <View style={[tb.tot, { borderTopWidth: 1, borderTopColor: C.texto, marginTop: 2, paddingTop: 3 }]}>
              <Text style={[tb.totEt, { color: C.texto, fontFamily: "Helvetica-Bold" }]}>TOTAL</Text>
              <Text style={[tb.totVal, { fontFamily: "Helvetica-Bold", fontSize: 11 }]}>{eur(d.total)}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={[tb.tot, { borderTopWidth: 1, borderTopColor: C.texto, paddingTop: 3 }]}>
              <Text style={[tb.totEt, { color: C.texto, fontFamily: "Helvetica-Bold" }]}>TOTAL (exento de IVA)</Text>
              <Text style={[tb.totVal, { fontFamily: "Helvetica-Bold", fontSize: 11 }]}>{eur(d.total)}</Text>
            </View>
            <Text style={[st.suave, { textAlign: "right", marginTop: 2 }]}>Operación exenta de IVA{d.motivoExencion ? `: ${d.motivoExencion}` : ""}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const ETQ_CAMBIO = { nueva: "Nuevo", cambia: "Cambia", quita: "Se quita" } as const;

/** Qué añade o cambia una ampliación respecto al presupuesto ya aceptado, y la diferencia. */
function Ampliacion({ a, total, ivaPct }: { a: NonNullable<DatosPresupuesto["ampliacion"]>; total: number; ivaPct: string | null }) {
  const dif = total - a.total;
  const difLinea = (c: Cambio) => (c.tipo === "nueva" ? c.linea.importe : c.tipo === "quita" ? -c.linea.importe : c.linea.importe - (c.antes?.importe ?? 0));
  // Precios sin IVA: las líneas van sin IVA y el IVA de la diferencia aparte, para que cuadre
  const ivaDif = ivaPct ? dif - a.cambios.reduce((s, c) => s + difLinea(c), 0) : 0;
  return (
    <View style={[st.seccion, { borderWidth: 1, borderColor: C.texto, borderRadius: 3, padding: 6 }]} wrap={false}>
      <Text style={st.seccionTitulo}>Ampliación del presupuesto {a.numero} ya aceptado</Text>
      {a.cambios.map((c, i) => {
        const d = difLinea(c);
        return (
          <View key={i} style={tb.fila}>
            <Text style={{ width: 46, fontFamily: "Helvetica-Bold" }}>{ETQ_CAMBIO[c.tipo]}</Text>
            <View style={tb.concepto}>
              <Text>{c.linea.descripcion}</Text>
              {c.tipo === "cambia" && c.antes && (
                <Text style={[st.suave, { fontSize: 7.5 }]}>Antes: {cant(c.antes.cantidad)}{c.antes.tipo === "mano_obra" ? " h" : ""} × {precioPdf(c.antes.precio)} = {eur(c.antes.importe)} · ahora {cant(c.linea.cantidad)}{c.linea.tipo === "mano_obra" ? " h" : ""} × {precioPdf(c.linea.precio)}</Text>
              )}
              {c.tipo === "nueva" && <Text style={[st.suave, { fontSize: 7.5 }]}>{cant(c.linea.cantidad)}{c.linea.tipo === "mano_obra" ? " h" : ""} × {precioPdf(c.linea.precio)}</Text>}
            </View>
            <Text style={tb.imp}>{d >= 0 ? "+" : ""}{eur(d)}</Text>
          </View>
        );
      })}
      {ivaPct && ivaDif !== 0 && (
        <View style={tb.fila}>
          <Text style={{ width: 46 }} />
          <Text style={[tb.concepto, st.suave]}>IVA ({cant(ivaPct)} %)</Text>
          <Text style={tb.imp}>{ivaDif >= 0 ? "+" : ""}{eur(ivaDif)}</Text>
        </View>
      )}
      <View style={{ marginTop: 4 }}>
        <View style={tb.tot}><Text style={tb.totEt}>Ya aceptado ({a.numero})</Text><Text style={tb.totVal}>{eur(a.total)}</Text></View>
        <View style={tb.tot}><Text style={[tb.totEt, { color: C.texto, fontFamily: "Helvetica-Bold" }]}>Ampliación</Text><Text style={[tb.totVal, { fontFamily: "Helvetica-Bold" }]}>{dif >= 0 ? "+" : ""}{eur(dif)}</Text></View>
        <View style={tb.tot}><Text style={tb.totEt}>Nuevo total</Text><Text style={tb.totVal}>{eur(total)}</Text></View>
      </View>
    </View>
  );
}

export function PresupuestoPdf(d: DatosPresupuesto) {
  const firmado = !!(d.evidencia && d.firmaPng);
  return (
    <Marco
      taller={d.taller}
      titulo={d.tipo === "complementario" ? "AMPLIACIÓN DE PRESUPUESTO" : "PRESUPUESTO"}
      subtitulo={`Nº ${d.numero} · Orden ${d.numeroOT}`}
      evidencia={d.evidencia}
      pie={`Presupuesto ${d.numero} · Emitido el ${fmtFecha(d.creadoEn)} · Válido hasta el ${fmtFecha(d.validezHasta)}${d.situacion ? ` · ${d.situacion}` : " · Pendiente de aceptación"}`}
    >
      <ClienteVehiculo cliente={d.cliente} vehiculo={d.vehiculo} />
      {d.trabajoSolicitado && (
        <Seccion titulo="Trabajo solicitado">
          <View style={st.caja}><Text>{d.trabajoSolicitado}</Text></View>
        </Seccion>
      )}
      {d.ampliacion && <Ampliacion a={d.ampliacion} total={d.total} ivaPct={d.modo === "con_iva" && !d.preciosConIva ? d.pct : null} />}
      <TablaImportes d={d} titulo={d.ampliacion ? "Detalle completo con la ampliación" : undefined} />
      {(fmtHoras(d.horasEstimadas) || d.fechaEntrega) && (
        <Seccion titulo="Plazo">
          {fmtHoras(d.horasEstimadas) && <Dato et={d.ampliacion ? "Tiempo de más" : "Tiempo estimado"} val={`${fmtHoras(d.horasEstimadas)} de trabajo`} />}
          {d.fechaEntrega && <Dato et={d.ampliacion ? "Nueva entrega" : "Entrega prevista"} val={fmtFecha(d.fechaEntrega)} />}
        </Seccion>
      )}
      <Seccion titulo="Validez">
        <Text>Este presupuesto es válido hasta el {fmtFecha(d.validezHasta)}.{d.situacion ? ` ${d.situacion}.` : ""}</Text>
      </Seccion>
      <Text style={st.legal}>{d.textoLegal}</Text>
      {firmado && (
        <Firmas sello={d.taller.sello} firmaPng={d.firmaPng!} firmante={d.evidencia!.firmante} empleado={d.evidencia!.atendidoPor} etiquetaCliente="Acepto el presupuesto (cliente)" />
      )}
    </Marco>
  );
}

// ───────────────────────── Proforma (no es factura) ─────────────────────────

export type DatosProforma = Importes & {
  taller: TallerPdf;
  numero: string;
  numeroOT: string;
  creadoEn: Date;
  cliente: Cli;
  vehiculo: Veh;
  reparto: { cliente: number; compania: number; companiaNombre: string | null };
  cobros: { fecha: Date; pagador: "cliente" | "compania"; metodo: string; importe: number }[];
  facturaExterna: string | null;
};

const METODO_PDF: Record<string, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", bizum: "Bizum" };

export function ProformaPdf(d: DatosProforma) {
  const pagado = (q: "cliente" | "compania") => d.cobros.filter((c) => c.pagador === q).reduce((s, c) => s + c.importe, 0);
  const partes = [
    { quien: "Cliente", debe: d.reparto.cliente, pagado: pagado("cliente") },
    ...(d.reparto.companiaNombre ? [{ quien: d.reparto.companiaNombre, debe: d.reparto.compania, pagado: pagado("compania") }] : []),
  ];
  return (
    <Marco
      taller={d.taller}
      titulo="PROFORMA"
      subtitulo={`Nº ${d.numero} · Orden ${d.numeroOT}`}
      pie={`Proforma ${d.numero} del ${fmtFecha(d.creadoEn)} · Documento informativo: NO ES FACTURA`}
    >
      <View style={[st.caja, { marginBottom: 10, borderWidth: 1, borderColor: C.texto }]}>
        <Text style={{ fontFamily: "Helvetica-Bold", textAlign: "center" }}>DOCUMENTO INFORMATIVO · NO ES FACTURA</Text>
        <Text style={[st.suave, { textAlign: "center" }]}>
          {d.facturaExterna ? `Factura correspondiente: nº ${d.facturaExterna}.` : "La factura se emitirá por separado."}
        </Text>
      </View>
      <ClienteVehiculo cliente={d.cliente} vehiculo={d.vehiculo} />
      <TablaImportes d={d} />
      <Seccion titulo="Pago">
        {partes.map((p) => (
          <View key={p.quien} style={tb.tot}>
            <Text style={[tb.totEt, { width: 230 }]}>{p.quien}: {eur(p.debe)}{p.pagado > 0 ? ` · pagado ${eur(p.pagado)}` : ""}</Text>
            <Text style={[tb.totVal, { fontFamily: "Helvetica-Bold" }]}>{p.debe - p.pagado > 0 ? `Pendiente ${eur(p.debe - p.pagado)}` : "Pagado"}</Text>
          </View>
        ))}
        {d.cobros.length > 0 && (
          <View style={{ marginTop: 4 }}>
            {d.cobros.map((c, i) => (
              <Text key={i} style={st.suave}>
                {fmtFechaHora(c.fecha)} · {METODO_PDF[c.metodo] ?? c.metodo} · {c.pagador === "cliente" ? "Cliente" : d.reparto.companiaNombre} · {eur(c.importe)}
              </Text>
            ))}
          </View>
        )}
      </Seccion>
    </Marco>
  );
}

// ───────────────────────── Recibo (justificante de pago, no es factura) ─────────────────────────

export type DatosRecibo = DatosProforma & { emitidoPor: string | null };

/**
 * Recibo rápido para el cliente: qué se le ha hecho (trabajos y piezas con su importe), el subtotal
 * con o sin IVA según la orden, y lo que ha pagado. Sin datos fiscales del cliente: NO es factura.
 */
export function ReciboPdf(d: DatosRecibo) {
  const pagosCliente = d.cobros.filter((c) => c.pagador === "cliente");
  const pagado = pagosCliente.reduce((s, c) => s + c.importe, 0);
  const pendiente = Math.max(0, d.reparto.cliente - pagado);
  const hoy = new Date();
  return (
    <Marco
      taller={d.taller}
      titulo="RECIBO"
      subtitulo={`Orden ${d.numeroOT} · ${fmtFecha(hoy)}`}
      pie={`Recibo de la orden ${d.numeroOT} · Justificante de pago: no es factura${d.facturaExterna ? ` · Factura nº ${d.facturaExterna}` : ""}`}
    >
      <View style={[st.fila, { marginBottom: 10 }]}>
        <View style={st.col}>
          <Dato et="Cliente" val={d.cliente.nombre} />
        </View>
        <View style={st.col}>
          <Dato et="Vehículo" val={`${d.vehiculo.matricula}${d.vehiculo.marca ? ` · ${[d.vehiculo.marca, d.vehiculo.modelo].filter(Boolean).join(" ")}` : ""}`} />
        </View>
      </View>
      <TablaImportes d={d} titulo="Trabajos y piezas" />
      <Seccion titulo="Pago">
        {d.reparto.companiaNombre && (
          <View style={tb.tot}><Text style={[tb.totEt, { width: 230 }]}>A cargo de {d.reparto.companiaNombre}</Text><Text style={tb.totVal}>{eur(d.reparto.compania)}</Text></View>
        )}
        <View style={tb.tot}><Text style={[tb.totEt, { width: 230 }]}>A cargo del cliente</Text><Text style={tb.totVal}>{eur(d.reparto.cliente)}</Text></View>
        {pagosCliente.map((c, i) => (
          <View key={i} style={tb.tot}>
            <Text style={[tb.totEt, { width: 230 }]}>Pagado {fmtFecha(c.fecha)} · {METODO_PDF[c.metodo] ?? c.metodo}</Text>
            <Text style={tb.totVal}>{eur(c.importe)}</Text>
          </View>
        ))}
        <View style={[tb.tot, { borderTopWidth: 1, borderTopColor: C.texto, marginTop: 2, paddingTop: 3 }]}>
          <Text style={[tb.totEt, { width: 230, color: C.texto, fontFamily: "Helvetica-Bold" }]}>{pendiente > 0 ? "Pendiente de pago" : "Pagado"}</Text>
          <Text style={[tb.totVal, { fontFamily: "Helvetica-Bold", fontSize: 11 }]}>{eur(pendiente > 0 ? pendiente : pagado)}</Text>
        </View>
      </Seccion>
      {pagado > 0 && (
        <View style={[st.firmas, { marginTop: 4 }]} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text>Recibí de {d.cliente.nombre} la cantidad de {eur(pagado)} por los trabajos detallados.</Text>
            <Text style={[st.suave, { marginTop: 3 }]}>{d.emitidoPor ? `Atendido por ${d.emitidoPor}` : ""}</Text>
          </View>
          <View style={[st.firmaCaja, { flexGrow: 0, flexShrink: 0, flexBasis: 170 }]}>
            <Text style={st.suave}>Por el taller</Text>
            {d.taller.sello ? <Image src={d.taller.sello} style={{ height: 62, objectFit: "contain" }} /> : <View style={{ height: 62 }} />}
          </View>
        </View>
      )}
      <Text style={st.legal}>
        Este recibo justifica el pago y detalla los trabajos realizados. No es una factura{d.facturaExterna ? `: la factura correspondiente es la nº ${d.facturaExterna}` : ": la factura se emite aparte"}.
      </Text>
    </Marco>
  );
}
