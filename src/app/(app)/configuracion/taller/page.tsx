import { requireSesion } from "@/lib/auth";
import { tallerPorId } from "@/lib/taller";
import { TEXTOS_LEGALES_BASE } from "@/lib/flujos-base";
import { FormTaller } from "./formulario";

export const dynamic = "force-dynamic";

export default async function DatosTaller() {
  const s = await requireSesion("configuracion");
  const tl = await tallerPorId(s.tid);
  const c = tl.config;
  return (
    <FormTaller
      logo={tl.logoRuta ? `/api/logo?v=${encodeURIComponent(tl.logoRuta.slice(-12))}` : null}
      sello={tl.selloRuta ? `/api/sello?v=${encodeURIComponent(tl.selloRuta.slice(-12))}` : null}
      t={{
        nombre: tl.nombre,
        razonSocial: tl.razonSocial ?? "",
        nif: tl.nif ?? "",
        direccion: tl.direccion ?? "",
        telefono: tl.telefono ?? "",
        whatsapp: tl.whatsapp ?? "",
        email: tl.email ?? "",
        horario: c.horario ?? "",
        prestamoEdadMinima: c.prestamoEdadMinima ?? TEXTOS_LEGALES_BASE.prestamoEdadMinima,
        prestamoAniosCarnet: c.prestamoAniosCarnet ?? TEXTOS_LEGALES_BASE.prestamoAniosCarnet,
        textoResguardo: c.textoResguardo ?? TEXTOS_LEGALES_BASE.textoResguardo,
        textoEntrega: c.textoEntrega ?? TEXTOS_LEGALES_BASE.textoEntrega,
        garantiaTexto: c.garantiaTexto ?? TEXTOS_LEGALES_BASE.garantiaTexto,
        textoPrestamo: c.textoPrestamo ?? TEXTOS_LEGALES_BASE.textoPrestamo,
      }}
    />
  );
}
