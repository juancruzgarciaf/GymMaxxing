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

### Variables para Gemini

Para dejar lista la integración con generación inteligente de rutinas, sumá estas variables en `backend/.env`:

```env
GEMINI_API_KEY=tu_api_key_de_google_ai_studio
GEMINI_MODEL=gemini-2.5-flash
```

Notas:

* `GEMINI_API_KEY` se obtiene desde Google AI Studio y es la credencial que usa el backend para llamar a Gemini.
* `GEMINI_MODEL` es opcional en la práctica: si no lo definís, el backend usa `gemini-2.5-flash` por defecto.
* `GOOGLE_CLIENT_ID` y `GEMINI_API_KEY` no son lo mismo.
  `GOOGLE_CLIENT_ID` se usa para login con Google y `GEMINI_API_KEY` para la API de Gemini.

### Variables para notificaciones por email

Si queres habilitar envios por correo para las notificaciones, suma estas variables en `backend/.env`:

```env
MAIL_ENABLED=false
MAIL_FROM=no-reply@gymmaxxing.local
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=tu_mail@gmail.com
MAIL_PASS=tu_password_o_app_password
```

También acepta estas variantes equivalentes:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_usuario_smtp
SMTP_PASS=tu_password_o_app_password_smtp
```

O, si prefieres nombrarlo específico para Gmail:

```env
GMAIL_USER=tu_mail@gmail.com
GMAIL_APP_PASSWORD=tu_app_password_de_google
MAIL_FROM=tu_mail@gmail.com
MAIL_ENABLED=true
```

Notas:

* `MAIL_ENABLED=true` activa el intento de envio.
* Si `MAIL_ENABLED=false`, la app sigue funcionando y solo crea notificaciones internas.
* Para Gmail SMTP normalmente conviene usar una `App Password`, no tu contraseña común.
* `MAIL_FROM` es el remitente visible.
* `MAIL_SECURE=true` o `SMTP_SECURE=true` suele usarse con puerto `465`; `false` suele ir con `587`.
* El backend acepta aliases: `MAIL_HOST/MAIL_PORT/MAIL_USER/MAIL_PASS`, `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS` y `GMAIL_USER/GMAIL_APP_PASSWORD`.

---

## 📌 Estado del proyecto

Actualmente el sistema cuenta con:

* Gestión básica de usuarios (Alta y Modificación)
* Sistema de login funcional
* Backend completamente conectado a base de datos

---
