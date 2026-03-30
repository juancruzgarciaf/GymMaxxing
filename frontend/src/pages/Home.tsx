import type { Usuario } from "../types";

type HomeProps = {
  usuario: Usuario;
};

function Home({ usuario }: HomeProps) {
  return (
    <main className="home">
      <section className="home-card">
        <p className="eyebrow">Panel principal</p>
        <h1>Bienvenido, {usuario.username}</h1>
        <p className="subtitle">
          Este es tu Home inicial. Desde aca ya podes navegar a la seccion de
          Rutinas para crear, editar y ejecutar entrenamientos.
        </p>
      </section>
    </main>
  );
}

export default Home;
