/** Textos de los avisos al cliente (un único sitio para cambiarlos). */
type TallerMin = { nombre: string; config: { horario?: string } };
type OtMin = { clienteNombre: string; marca: string | null; modelo: string | null; matricula: string };

export function mensajeListo(taller: TallerMin, o: OtMin) {
  const coche = [o.marca, o.modelo].filter(Boolean).join(" ") || "vehículo";
  const horario = taller.config.horario ? ` Horario de recogida: ${taller.config.horario}.` : "";
  return `Hola ${o.clienteNombre.split(" ")[0]}, le escribimos de ${taller.nombre}. Su ${coche} (${o.matricula}) ya está listo para recoger.${horario} ¡Gracias!`;
}
