import { Request, Response } from "express";
import * as rutinaService from "../services/rutina.service";

/*
  Este controller junta todo lo relacionado con rutinas.
  Tiene varias responsabilidades:
  crear y editar rutinas,
  manejar carpetas donde se agrupan,
  y administrar la relación entre rutina y ejercicio.

  La lógica general se repite bastante:
  valida lo mínimo para no pasar basura,
  llama al service que hace el laburo más de negocio,
  y responde según si encontró datos, si creó algo o si falló.
*/

// =========================
// RUTINA
// =========================

export const crearRutina = async (req: Request, res: Response) => {
  /*
    Para crear una rutina necesita al menos nombre y creador.
    Si eso no viene, no tiene sentido seguir porque la rutina quedaría incompleta.
    Cuando pasa la validación, manda todo el body al service,
    así la parte más importante de creación queda centralizada ahí.
  */
  try {
    const { nombre, creador_id } = req.body;

    if (!nombre || !creador_id) {
      return res.status(400).json({
        error: "nombre y creador_id son obligatorios",
      });
    }

    const rutina = await rutinaService.crearRutina(req.body);
    return res.status(201).json(rutina);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error creando rutina" });
  }
};

export const getRutinas = async (req: Request, res: Response) => {
  /*
    Lista todas las rutinas.
    No mete filtros ni transforma nada raro:
    solo le pide al service el listado y lo devuelve tal cual.
  */
  try {
    const creadorIdRaw = req.query.creador_id;
    const creadorId =
      typeof creadorIdRaw === "string" && creadorIdRaw.trim()
        ? Number(creadorIdRaw)
        : undefined;

    if (creadorIdRaw != null && (creadorId == null || Number.isNaN(creadorId))) {
      return res.status(400).json({ error: "creador_id inválido" });
    }

    const rutinas = await rutinaService.getRutinas(creadorId);
    return res.json(rutinas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error obteniendo rutinas" });
  }
};

export const getRutinaPorId = async (req: Request, res: Response) => {
  /*
    Busca una rutina específica.
    Primero chequea que el id exista y tenga un formato razonable.
    Después consulta al service.
    Si no aparece nada, devuelve 404 para diferenciar "no existe" de "explotó todo".
  */
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "id inválido" });
    }

    const rutina = await rutinaService.getRutinaPorId(id);

    if (!rutina) {
      return res.status(404).json({ error: "Rutina no encontrada" });
    }

    return res.json(rutina);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error obteniendo rutina" });
  }
};

export const updateRutina = async (req: Request, res: Response) => {
  /*
    Actualiza una rutina ya existente.
    La secuencia es:
    1. validar el id,
    2. pasar el id y los cambios al service,
    3. si el service no devuelve nada, asumir que esa rutina no existía,
    4. si devuelve algo, mandar la versión actualizada.
  */
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "id inválido" });
    }

    const rutina = await rutinaService.updateRutina(id, req.body);

    if (!rutina) {
      return res.status(404).json({ error: "Rutina no encontrada" });
    }

    return res.json(rutina);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error actualizando rutina" });
  }
};

export const deleteRutina = async (req: Request, res: Response) => {
  /*
    Borra una rutina por id.
    Acá el controller valida el id antes de delegar.
    Si el service no tira error, se responde con un mensaje simple de confirmación.
  */
  try {
    const { id } = req.params;
    const creadorIdRaw = req.body.creador_id;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "id inválido" });
    }

    const creadorId =
      creadorIdRaw == null || creadorIdRaw === ""
        ? undefined
        : Number(creadorIdRaw);

    if (creadorIdRaw != null && creadorId !== undefined && Number.isNaN(creadorId)) {
      return res.status(400).json({ error: "creador_id inválido" });
    }

    const rutina = await rutinaService.deleteRutina(id, creadorId);

    if (!rutina) {
      return res.status(404).json({ error: "Rutina no encontrada" });
    }

    return res.json({ mensaje: "Rutina eliminada" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error eliminando rutina" });
  }
};

export const recordRutinaSave = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = Number(req.body.usuario_id);

    if (!id || Array.isArray(id) || Number.isNaN(usuarioId)) {
      return res.status(400).json({
        error: "id y usuario_id son obligatorios",
      });
    }

    const summary = await rutinaService.recordRutinaSave(id, usuarioId);

    if (!summary) {
      return res.status(404).json({ error: "Rutina no encontrada" });
    }

    return res.status(201).json(summary);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error registrando guardado de rutina" });
  }
};

export const recordRutinaCopy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuarioId = Number(req.body.usuario_id);

    if (!id || Array.isArray(id) || Number.isNaN(usuarioId)) {
      return res.status(400).json({
        error: "id y usuario_id son obligatorios",
      });
    }

    const summary = await rutinaService.recordRutinaCopy(id, usuarioId);

    if (!summary) {
      return res.status(404).json({ error: "Rutina no encontrada" });
    }

    return res.status(201).json(summary);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error registrando copia de rutina" });
  }
};

export const getCarpetasRutina = async (req: Request, res: Response) => {
  /*
    Devuelve todas las carpetas donde se pueden organizar rutinas.
    Es un endpoint de consulta nomás, sin validaciones de entrada.
  */
  try {
    const usuarioIdRaw = req.query.usuario_id;
    const usuarioId =
      typeof usuarioIdRaw === "string" && usuarioIdRaw.trim()
        ? Number(usuarioIdRaw)
        : undefined;

    if (usuarioIdRaw != null && (usuarioId == null || Number.isNaN(usuarioId))) {
      return res.status(400).json({ error: "usuario_id inválido" });
    }

    const carpetas = await rutinaService.getCarpetasRutina(usuarioId);
    return res.json(carpetas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error obteniendo carpetas de rutina" });
  }
};

export const crearCarpetaRutina = async (req: Request, res: Response) => {
  /*
    Acá se crea una carpeta para ordenar rutinas.
    Se valida que el nombre no venga vacío y que exista un usuario dueño de esa carpeta.
    Después se normaliza un poco el dato:
    - nombre con trim para sacar espacios al pedo,
    - usuario_id convertido a número,
    - carpeta padre opcional si viene.

    Recién ahí se lo pasa al service para crearla.
  */
  try {
    const { nombre, usuario_id } = req.body;

    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      return res.status(400).json({ error: "nombre es obligatorio" });
    }

    if (usuario_id == null || Number.isNaN(Number(usuario_id))) {
      return res.status(400).json({ error: "usuario_id es obligatorio" });
    }

    const carpeta = await rutinaService.crearCarpetaRutina({
      nombre: nombre.trim(),
      usuario_id: Number(usuario_id),
      id_carpeta_padre: req.body.id_carpeta_padre ?? null,
    });

    return res.status(201).json(carpeta);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error creando carpeta de rutina" });
  }
};

export const updateCarpetaRutina = async (req: Request, res: Response) => {
  /*
    Edita una carpeta existente.
    La lógica es parecida a crear:
    valida id, valida nombre, valida usuario,
    limpia el nombre y manda todo al service.
    Si no vuelve carpeta, se interpreta que no existía.
  */
  try {
    const { id } = req.params;
    const { nombre, usuario_id } = req.body;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "id inválido" });
    }

    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      return res.status(400).json({ error: "nombre es obligatorio" });
    }

    if (usuario_id == null || Number.isNaN(Number(usuario_id))) {
      return res.status(400).json({ error: "usuario_id es obligatorio" });
    }

    const carpeta = await rutinaService.updateCarpetaRutina(id, {
      nombre: nombre.trim(),
      usuario_id: Number(usuario_id),
    });

    if (!carpeta) {
      return res.status(404).json({ error: "Carpeta no encontrada" });
    }

    return res.json(carpeta);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error actualizando carpeta de rutina" });
  }
};

export const deleteCarpetaRutina = async (req: Request, res: Response) => {
  /*
    Para borrar una carpeta no alcanza solo con el id de la carpeta:
    también pide usuario_id.
    Eso sirve para que el service tenga claro quién está intentando borrarla
    y pueda aplicar las reglas que correspondan.
  */
  try {
    const { id } = req.params;
    const { usuario_id } = req.body;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "id inválido" });
    }

    if (usuario_id == null || Number.isNaN(Number(usuario_id))) {
      return res.status(400).json({ error: "usuario_id es obligatorio" });
    }

    const carpeta = await rutinaService.deleteCarpetaRutina(id, {
      usuario_id: Number(usuario_id),
    });

    if (!carpeta) {
      return res.status(404).json({ error: "Carpeta no encontrada" });
    }

    return res.json({ mensaje: "Carpeta eliminada" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error eliminando carpeta de rutina" });
  }
};

// =========================
// RUTINA_EJERCICIO
// =========================

export const agregarEjercicioARutina = async (
  req: Request,
  res: Response
) => {
  /*
    Esta parte arma la relación entre una rutina y un ejercicio.
    No solo necesita saber qué rutina y qué ejercicio son,
    sino también cómo queda configurado adentro de la rutina:
    series, repeticiones, descanso y orden.

    Si falta cualquiera de esos datos, la relación quedaría a medias,
    así que el endpoint corta antes de llegar al service.
  */
  try {
    const {
      id_rutina,
      id_ejercicio,
      series,
      repeticiones,
      descanso,
      orden,
    } = req.body;

    if (
      !id_rutina ||
      !id_ejercicio ||
      series == null ||
      repeticiones == null ||
      descanso == null ||
      orden == null
    ) {
      return res.status(400).json({
        error:
          "id_rutina, id_ejercicio, series, repeticiones, descanso y orden son obligatorios",
      });
    }

    const relacion = await rutinaService.agregarEjercicioARutina(req.body);
    return res.status(201).json(relacion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error agregando ejercicio a rutina",
    });
  }
};

export const getEjerciciosDeRutina = async (req: Request, res: Response) => {
  /*
    Trae todos los ejercicios que tiene una rutina concreta.
    Valida el id de la rutina y después delega al service,
    que es quien sabe cómo armar esa lista.
  */
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ error: "id inválido" });
    }

    const ejercicios = await rutinaService.getEjerciciosDeRutina(id);
    return res.json(ejercicios);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo ejercicios de la rutina",
    });
  }
};

export const updateEjercicioDeRutina = async (
  req: Request,
  res: Response
) => {
  /*
    Acá no se actualiza una rutina entera, sino una fila puntual dentro de la rutina:
    la relación de un ejercicio específico con esa rutina.
    Por eso necesita dos ids:
    el de la rutina y el del ejercicio.

    Con esos dos datos encuentra exactamente qué relación tocar.
  */
  try {
    const { id_rutina, id_ejercicio } = req.params;

    if (
      !id_rutina ||
      Array.isArray(id_rutina) ||
      !id_ejercicio ||
      Array.isArray(id_ejercicio)
    ) {
      return res.status(400).json({
        error: "id_rutina e id_ejercicio inválidos",
      });
    }

    const relacion = await rutinaService.updateEjercicioDeRutina(
      id_rutina,
      id_ejercicio,
      req.body
    );

    if (!relacion) {
      return res.status(404).json({
        error: "Ejercicio de rutina no encontrado",
      });
    }

    return res.json(relacion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error actualizando ejercicio de rutina",
    });
  }
};

export const deleteEjercicioDeRutina = async (
  req: Request,
  res: Response
) => {
  /*
    Misma lógica que el update de arriba, pero para borrar la relación.
    Los dos ids juntos identifican qué ejercicio sacar de qué rutina.
    Si todo sale bien, responde con un mensaje de confirmación.
  */
  try {
    const { id_rutina, id_ejercicio } = req.params;

    if (
      !id_rutina ||
      Array.isArray(id_rutina) ||
      !id_ejercicio ||
      Array.isArray(id_ejercicio)
    ) {
      return res.status(400).json({
        error: "id_rutina e id_ejercicio inválidos",
      });
    }

    await rutinaService.deleteEjercicioDeRutina(id_rutina, id_ejercicio);

    return res.json({
      mensaje: "Ejercicio eliminado de la rutina",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error eliminando ejercicio de rutina",
    });
  }
};
