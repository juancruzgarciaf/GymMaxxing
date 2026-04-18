# GymMaxxing

Aplicación web para el registro, seguimiento y compartición de entrenamientos de gimnasio, con un enfoque social similar a una red tipo fitness.

---

## Seed de Rutinas Oficiales

Para cargar rutinas oficiales de la app (creadas por `admin@gmail.com`) podes correr:

```bash
psql -h 127.0.0.1 -U postgres -d gymmaxxing_db -f sql/2026-04-18_seed_official_routines.sql
```

Este seed:

* crea el usuario admin si no existe
* crea ejercicios base si faltan
* crea rutinas oficiales (PPL, Upper/Lower, Full Body, por musculo)
* vincula ejercicios a cada rutina

Es idempotente: se puede ejecutar mas de una vez.

## 🧠 Descripción de la app

GymMaxxing permite a los usuarios registrar sus rutinas de entrenamiento, hacer seguimiento de su progreso y visualizar entrenamientos propios y de otros usuarios.

El sistema está orientado tanto a usuarios comunes como a entrenadores y gimnasios.

---

## 🚀 Funcionalidades actuales

### 👤 Usuarios

* Registro de usuario (**Alta**)
* Modificación de datos de usuario (**Modificación**)
* Login mediante email y contraseña

---

### 🗄️ Backend

* API REST desarrollada con Express
* Conexión a base de datos PostgreSQL mediante `pg`
* Endpoints implementados:

  * `POST /usuarios` → crear usuario
  * `PUT /usuarios/:id` → modificar usuario
  * `POST /login` → autenticación

---

### 🧪 Testing

* Pruebas de endpoints realizadas con:

  * Postman (Web + Desktop Agent)
  * curl desde terminal

---

## 🏗️ Arquitectura

El proyecto sigue una estructura backend modular:

```
src/
 ├── controllers/
 ├── routes/
 ├── db.ts
 └── index.ts
```

---

## 🛠️ Tecnologías utilizadas

### Backend

* Node.js
* Express
* PostgreSQL
* pg (node-postgres)
* TypeScript

### Frontend

* (a definir)

---

## ⚙️ Configuración local

El backend toma la conexión a PostgreSQL desde variables de entorno en `backend/.env`.

Podés usar `backend/.env.example` como plantilla y crear tu propio `backend/.env` local con los valores de tu máquina:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=gymmaxxing_db
DB_PASSWORD=tu_password_local
DB_PORT=5432
```

Cada integrante del equipo puede necesitar valores distintos en `DB_USER`, `DB_PASSWORD`, `DB_NAME` o `DB_PORT`, según cómo tenga configurado PostgreSQL.

---

## 📌 Estado del proyecto

Actualmente el sistema cuenta con:

* Gestión básica de usuarios (Alta y Modificación)
* Sistema de login funcional
* Backend completamente conectado a base de datos

---
