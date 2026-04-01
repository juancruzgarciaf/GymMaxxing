import { Request, Response } from "express";
import * as entrenamientoService from "../services/entrenamiento.service";

/*
  Este controller maneja lo que pasa mientras una persona entrena:
  arrancar una sesión, guardar series, consultar lo que ya hizo y cerrarla al final.
  El controller valida lo básico y delega la lógica más pesada al service.
*/

// =========================
// SESION_ENTRENAMIENTO
// =========================

export const iniciarSesionEntrenamiento = async (
  req: Request,
  res: Response
) => {
  /*
    Cuando alguien arranca a entrenar:
    1. Revisa que venga el usuario y la rutina.
    2. Si falta alguno, no sigue.
    3. Si está todo bien, le pasa el body al service.
    4. El service se encarga de crear la sesión como corresponde.
    5. Después devuelve esa sesión creada.

    O sea, este endpoint prende la "sesión activa" con el contexto mínimo.
  */
  try {
    const { usuario_id, rutina_id } = req.body;

    if (!usuario_id || !rutina_id) {
      return res.status(400).json({
        error: "usuario_id y rutina_id son obligatorios",
      });
    }

    const sesion = await entrenamientoService.iniciarSesionEntrenamiento(
      req.body
    );

    return res.status(201).json(sesion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error iniciando sesión de entrenamiento",
    });
  }
};

export const getSesionPorId = async (req: Request, res: Response) => {
  /*
    Este endpoint sirve para recuperar una sesión puntual.
    Primero valida que el id de la URL tenga sentido,
    después le pide al service esa sesión,
    y si no existe responde 404 para dejar claro que no hay nada con ese id.
  */
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    const sesion = await entrenamientoService.getSesionPorId(id);

    if (!sesion) {
      return res.status(404).json({
        error: "Sesión no encontrada",
      });
    }

    return res.json(sesion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo sesión",
    });
  }
};

// =========================
// SERIE
// =========================

export const registrarSerie = async (req: Request, res: Response) => {
  /*
    Acá se guarda una serie hecha dentro de una sesión.
    La idea es asegurarse de que vengan los datos mínimos para identificar:
    qué ejercicio fue, en qué sesión cayó, qué número de serie es
    y cuántas repeticiones se hicieron.

    Si eso está, el service la registra y devuelve el resultado.
  */
  try {
    const { repeticiones, orden, ejercicio_id, sesion_id } = req.body;

    if (
      repeticiones == null ||
      orden == null ||
      !ejercicio_id ||
      !sesion_id
    ) {
      return res.status(400).json({
        error:
          "repeticiones, orden, ejercicio_id y sesion_id son obligatorios",
      });
    }

    const serie = await entrenamientoService.registrarSerie(req.body);
    return res.status(201).json(serie);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error registrando serie",
    });
  }
};

export const getSeriesDeSesion = async (req: Request, res: Response) => {
  /*
    Trae todas las series asociadas a una sesión.
    Es útil para reconstruir el entrenamiento que la persona fue cargando.
    Valida el id de la sesión y después delega la búsqueda al service.
  */
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({
        error: "id inválido",
      });
    }

    const series = await entrenamientoService.getSeriesDeSesion(id);
    return res.json(series);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error obteniendo series de la sesión",
    });
  }
};

export const finalizarSesion = async (req: Request, res: Response) => {
  /*
    Este endpoint cierra la sesión de entrenamiento.
    Pide el id de la sesión,
    y con eso el service se encarga de marcarla como finalizada
    o hacer el cierre que corresponda.
  */
  try {
    const { sesion_id } = req.body;

    if (!sesion_id) {
      return res.status(400).json({
        error: "sesion_id es obligatorio",
      });
    }

    const resultado = await entrenamientoService.finalizarSesion(sesion_id);
    return res.json(resultado);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error finalizando sesión",
    });
  }
};
