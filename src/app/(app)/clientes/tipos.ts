import { Building2, ShieldCheck, User } from "lucide-react";

export const ICONO_TIPO = { particular: User, empresa: Building2, aseguradora: ShieldCheck, flota: ShieldCheck } as const;
export const NOMBRE_TIPO = { particular: "Particular", empresa: "Empresa", aseguradora: "Aseguradora", flota: "Renting / flota" } as const;
