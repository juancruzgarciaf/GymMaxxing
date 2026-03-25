# GymMaxxing

Aplicación web para el registro, seguimiento y compartición de entrenamientos de gimnasio, con un enfoque social similar a una red tipo fitness.

---

##  Descripción

GymMaxxing permite a los usuarios registrar sus rutinas de entrenamiento, hacer seguimiento de su progreso y visualizar entrenamientos propios y de otros usuarios.

El sistema está orientado tanto a usuarios comunes como a entrenadores y gimnasios.

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
