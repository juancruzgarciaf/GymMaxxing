import { useLocation, useNavigate } from "react-router-dom";
import DescubrirRutinas from "./DescubrirRutinas";
import Gimnasios from "./Gimnasios";
import Tendencias from "./Tendencias";
import type { EntrenamientoResumen, Usuario } from "../types";

type DescubrirProps = {
  usuario: Usuario;
  onOpenProfile?: (username: string) => void;
  onOpenTraining?: (training: EntrenamientoResumen) => void;
};

type DiscoverBranch = "home" | "rutinas" | "atletas" | "tendencias" | "gimnasios";

const getBranchFromPath = (pathname: string): DiscoverBranch => {
  const branch = pathname.split("/")[2];

  if (branch === "rutinas" || branch === "atletas" || branch === "tendencias" || branch === "gimnasios") {
    return branch;
  }

  return "home";
};

function Descubrir({ usuario, onOpenProfile, onOpenTraining }: DescubrirProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const branch = getBranchFromPath(location.pathname);
  const goHome = () => navigate("/descubrir");

  if (branch === "rutinas") {
    return <DescubrirRutinas usuario={usuario} onBack={goHome} />;
  }

  if (branch === "atletas") {
    return (
      <main className="page-shell">
        <section className="page-hero compact discover-branch-hero">
          <button type="button" className="btn secondary" onClick={goHome}>
            Volver
          </button>
          <div>
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
          <button type="button" className="btn secondary" onClick={goHome}>
            Volver
          </button>
          <div>
            <h1>Lo que esta moviendo la comunidad</h1>
            <p className="subtitle">Rankings vivos de rutinas, usuarios y entrenamientos.</p>
          </div>
        </section>

        <Tendencias usuario={usuario} onOpenProfile={onOpenProfile} onOpenTraining={onOpenTraining} />
      </main>
    );
  }

  if (branch === "gimnasios") {
    return <Gimnasios onBack={goHome} />;
  }

  return (
    <main className="page-shell discover-home-shell">
      <section className="page-hero compact">
        <h1>Explora GymMaxxing</h1>
      </section>

      <section className="discover-module-grid">
        <button type="button" className="discover-module-card" onClick={() => navigate("/descubrir/tendencias")}>
          <div className="discover-module-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17 9 11l4 4 8-8" />
              <path d="M14 7h7v7" />
            </svg>
          </div>
          <span>Tendencias</span>
          <small>Rankings y actividad del momento.</small>
        </button>

        <button type="button" className="discover-module-card" onClick={() => navigate("/descubrir/gimnasios")}>
          <div className="discover-module-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12Z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <span>Gimnasios</span>
          <small>Mapa y lugares cercanos.</small>
        </button>

        <button type="button" className="discover-module-card" onClick={() => navigate("/descubrir/rutinas")}>
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

        <button type="button" className="discover-module-card" onClick={() => navigate("/descubrir/atletas")}>
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
      </section>
    </main>
  );
}

export default Descubrir;
