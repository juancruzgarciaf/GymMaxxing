# GymMaxxing

Aplicación web para el registro, seguimiento y compartición de entrenamientos de gimnasio, con un enfoque social similar a una red tipo fitness.

---

##  Descripción

GymMaxxing permite a los usuarios registrar sus rutinas de entrenamiento, hacer seguimiento de su progreso y visualizar entrenamientos propios y de otros usuarios.

El sistema está orientado tanto a usuarios comunes como a entrenadores y gimnasios.

---

##  Cómo levantar el proyecto (de cero)

Requisitos: Node 20+ y PostgreSQL 14+ con `psql` en el PATH.

```bash
# 1. Backend: configurar .env
cd backend
cp .env.example .env        # completar DB_PASSWORD y AUTH_TOKEN_SECRET como mínimo
npm install

# 2. Base de datos: crea la base (si no existe) y aplica todos los SQL en orden
bash sql/setup_db.sh        # usar --reset para borrarla y crearla de cero

# 3. Levantar el backend (http://localhost:3000)
npm run dev

# 4. Frontend (otra terminal, http://localhost:5173)
cd ../frontend
cp .env.example .env        # VITE_GOOGLE_CLIENT_ID solo hace falta para login con Google
npm install
npm run dev
```

`sql/setup_db.sh` es idempotente: se puede volver a correr sobre una base existente para aplicar migraciones nuevas. Si agregan un `.sql` nuevo, súmenlo a la lista `FILES` del script (el script avisa si encuentra uno que no está en la lista).

La base queda con el usuario `admin@gmail.com` / `admin123`, 8 rutinas oficiales, 32 ejercicios con video y los gimnasios de Pilar.

---

##  Funcionalidades actuales

### Usuarios

* Registro de usuario (**Alta**)
* Modificación de datos de usuario (**Modificación**)
* Login mediante email y contraseña

---

###  Backend

* API REST desarrollada con Express
* Conexión a base de datos PostgreSQL mediante `pg`
* Endpoints implementados:

  * `POST /usuarios` → crear usuario
  * `PUT /usuarios/:id` → modificar usuario
  * `POST /login` → autenticación

---

###  Testing

* Pruebas de endpoints realizadas con:

  * Postman (Web + Desktop Agent)
  * curl desde terminal

---

###  Música (Spotify + Apple Music)

Al guardar o editar un entrenamiento se puede sumar música, sin vincular ninguna cuenta:

* **Playlist de Spotify**: el usuario pega el link (`open.spotify.com/...` o `spotify.link/...`). El backend usa el [oEmbed oficial de Spotify](https://developer.spotify.com/documentation/embeds/reference/oembed) para sacar el título y la portada. Al tocarla se abre en Spotify.
* **Canción**: se elige de las **tendencias** (lo más escuchado en Argentina según el RSS de Apple Music) o con el **buscador** (iTunes Search API). Al tocarla se abre en Apple Music.
* Las dos son opcionales e independientes. Las rutinas también pueden tener una playlist: se precarga en cada entrenamiento que arranca desde esa rutina.

Endpoints (todos piden login):

* `GET /musica/tendencias` · `GET /musica/buscar?q=` · `GET /musica/spotify/preview?url=`
* `PUT /entrenamientos/:id/musica` → body `{ playlist_url?, cancion? }` (lo que no viene no se toca; `null` borra)
* `PUT /rutinas/:id/playlist` → body `{ playlist_url }`

Las respuestas de Apple y Spotify se cachean en el backend (la búsqueda de Apple tiene un límite de ~20 llamadas por minuto). Las columnas se crean con `sql/2026-11-26_add_musica.sql`, y el backend también las crea solo al arrancar.

---

##  Arquitectura

El proyecto sigue una estructura backend modular:

```
src/
 ├── controllers/
 ├── routes/
 ├── db.ts
 └── index.ts
```

---

##  Tecnologías utilizadas

### Backend

* Node.js
* Express
* PostgreSQL
* pg (node-postgres)
* TypeScript

### Frontend

El frontend de la aplicación GymMaxxing está desarrollado utilizando React con TypeScript, y se encarga de la interfaz de usuario y la comunicación con el backend mediante peticiones HTTP.

Funcionalidades actuales
* Login de usuario
Permite ingresar con email y contraseña
Conecta con el endpoint /login del backend
Manejo de errores (credenciales incorrectas, errores de conexión)
* Registro de usuario
Permite crear una nueva cuenta
Conecta con el endpoint /usuarios
Selección de tipo de usuario (usuario, entrenador, gimnasio)
* Navegación entre pantallas
Implementada mediante estado global simple (useState)
Flujo:
Login → Register → Login

---

##  Estado del proyecto

Actualmente el sistema cuenta con:

* Gestión básica de usuarios (Alta y Modificación)
* Sistema de login funcional
* Backend completamente conectado a base de datos

---
