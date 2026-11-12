"use client";

import { useState, type ComponentProps } from "react";
import { fmtMiles } from "@/lib/formato";
import { Input } from "./ui";

/**
 * Kilómetros con punto de miles mientras se escribe (125.400). El valor real son solo dígitos.
 * Controlado (value/onChange) o para formularios (name + defaultValue → input oculto).
 */
export function KmInput({
  value,
  defaultValue,
  onChange,
  name,
  ...resto
}: { value?: string; defaultValue?: string | number | null; onChange?: (digitos: string) => void; name?: string } & Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "name">) {
  const [interno, setInterno] = useState(defaultValue != null ? String(defaultValue) : "");
  const actual = value !== undefined ? value : interno;
  return (
    <>
      {name && <input type="hidden" name={name} value={actual} />}
      <Input
        inputMode="numeric"
        autoComplete="off"
        {...resto}
        value={fmtMiles(actual)}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 7);
          setInterno(d);
          onChange?.(d);
        }}
      />
    </>
  );
}
