import { useState } from "react";
import DescubrirRutinas from "./DescubrirRutinas";
import type { Usuario } from "../types";

type DescubrirProps = {
  usuario: Usuario;
};

type DiscoverBranch = "home" | "rutinas" | "atletas" | "tendencias";

function Descubrir({ usuario }: DescubrirProps) {
  const [branch, setBranch] = useState<DiscoverBranch>("home");

  if (branch === "rutinas") {
    return <DescubrirRutinas usuario={usuario} onBack={() => setBranch("home")} />;
  }

  if (branch === "atletas") {
    return (
      <main className="page-shell">
        <section className="page-hero compact discover-branch-hero">
          <button type="button" className="btn secondary" onClick={() => setBranch("home")}>
            Volver
          </button>
          <div>
            <p className="eyebrow">Descubrir Atletas</p>
            <h1>Atletas</h1>
          </div>
        </section>

        <section className="empty-state discover-empty">
          <p>Seccion de atletas</p>
          <small>Lista para sumar rankings, perfiles destacados y busqueda de atletas.</small>
        </section>
      </main>
    );
  }

  if (branch === "tendencias") {
    return (
      <main className="page-shell">
        <section className="page-hero compact discover-branch-hero">
          <button type="button" className="btn secondary" onClick={() => setBranch("home")}>
            Volver
          </button>
          <div>
            <p className="eyebrow">Tendencias</p>
            <h1>Lo que esta moviendo la comunidad</h1>
          </div>
        </section>

        <section className="discover-module-grid">
          <article className="discover-module-card is-muted">
            <div className="discover-module-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19V5" />
                <path d="M8 19V9" />
                <path d="M12 19V3" />
                <path d="M16 19v-7" />
                <path d="M20 19V8" />
              </svg>
            </div>
            <h2>Top 10 rutinas</h2>
            <p>Base preparada para ordenar rutinas por actividad reciente.</p>
          </article>
          <article className="discover-module-card is-muted">
            <div className="discover-module-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h2>Movimientos</h2>
            <p>Base preparada para tendencias de ejercicios, volumen y grupos musculares.</p>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="page-hero compact">
        <p className="eyebrow">Descubrir</p>
        <h1>Explora GymMaxxing</h1>
        <p className="subtitle">Rutinas, atletas y tendencias de la comunidad en un mismo lugar.</p>
      </section>

      <section className="discover-module-grid">
        <button type="button" className="discover-module-card" onClick={() => setBranch("rutinas")}>
          <div className="discover-module-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 4h12" />
              <path d="M6 10h12" />
              <path d="M6 16h8" />
              <path d="M4 4h.01" />
              <path d="M4 10h.01" />
              <path d="M4 16h.01" />
            </svg>
          </div>
          <span>Descubrir Rutinas</span>
          <small>Populares, filtros, oficiales y copias.</small>
        </button>

        <button type="button" className="discover-module-card" onClick={() => setBranch("atletas")}>
          <div className="discover-module-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
              <circle cx="12" cy="7" r="4" />
              <path d="M19 8v6" />
              <path d="M22 11h-6" />
            </svg>
          </div>
          <span>Descubrir Atletas</span>
          <small>Perfiles, referentes y comunidad.</small>
        </button>

        <button type="button" className="discover-module-card" onClick={() => setBranch("tendencias")}>
          <div className="discover-module-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17 9 11l4 4 8-8" />
              <path d="M14 7h7v7" />
            </svg>
          </div>
          <span>Tendencias</span>
          <small>Rankings y actividad del momento.</small>
        </button>
      </section>
    </main>
  );
}

export default Descubrir;
