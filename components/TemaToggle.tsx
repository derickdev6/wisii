"use client";

import { useEffect, useState } from "react";

type Tema = "claro" | "oscuro" | "sistema";

const ICONO: Record<Tema, string> = { claro: "☀", oscuro: "☾", sistema: "◐" };
const SIGUIENTE: Record<Tema, Tema> = { sistema: "claro", claro: "oscuro", oscuro: "sistema" };
const TITULO: Record<Tema, string> = {
  sistema: "Tema: según el sistema", claro: "Tema: claro", oscuro: "Tema: oscuro",
};

export function aplicarTema(t: Tema) {
  const r = document.documentElement;
  if (t === "sistema") r.removeAttribute("data-theme");
  else r.setAttribute("data-theme", t === "oscuro" ? "dark" : "light");
}

export default function TemaToggle() {
  const [tema, setTema] = useState<Tema>("sistema");

  useEffect(() => {
    const g = localStorage.getItem("tema") as Tema | null;
    if (g) setTema(g);
  }, []);

  function cambiar() {
    const t = SIGUIENTE[tema];
    setTema(t);
    localStorage.setItem("tema", t);
    aplicarTema(t);
  }

  return (
    <button onClick={cambiar} title={TITULO[tema]} aria-label={TITULO[tema]}
            className="rounded-lg border px-2.5 py-1.5 text-sm leading-none transition"
            style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-soft)" }}>
      {ICONO[tema]}
    </button>
  );
}
