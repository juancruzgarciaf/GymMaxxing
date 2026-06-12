import { Request, Response } from "express";
import {
  ExerciseProgressPeriod,
  getExerciseProgress,
  getMuscleDistribution,
  getTrainedExercises,
  getWeeklyEvolution,
  MuscleStatsPeriod,
  ProStatsPeriod,
} from "../services/pro-stats.service";

const allowedPeriods: ProStatsPeriod[] = [4, 12, 26];
const allowedMusclePeriods: MuscleStatsPeriod[] = [30, 90, 180];
const allowedExercisePeriods: ExerciseProgressPeriod[] = [90, 180, 365];

export const getMyWeeklyEvolution = async (req: Request, res: Response) => {
  try {
    const requestedWeeks = Number(req.query.weeks ?? 12);
    const weeks = allowedPeriods.includes(requestedWeeks as ProStatsPeriod)
      ? (requestedWeeks as ProStatsPeriod)
      : 12;

    return res.json(await getWeeklyEvolution(req.authUser!.id, weeks));
  } catch (error) {
    console.error("ERROR GET PRO WEEKLY EVOLUTION:", error);
    return res.status(500).json({
      error: "No se pudieron obtener las estadisticas PRO",
    });
  }
};

export const getMyMuscleDistribution = async (req: Request, res: Response) => {
  try {
    const requestedDays = Number(req.query.days ?? 30);
    const days = allowedMusclePeriods.includes(requestedDays as MuscleStatsPeriod)
      ? (requestedDays as MuscleStatsPeriod)
      : 30;

    return res.json(await getMuscleDistribution(req.authUser!.id, days));
  } catch (error) {
    console.error("ERROR GET PRO MUSCLE DISTRIBUTION:", error);
    return res.status(500).json({
      error: "No se pudo obtener la distribucion muscular",
    });
  }
};

export const getMyTrainedExercises = async (req: Request, res: Response) => {
  try {
    return res.json(await getTrainedExercises(req.authUser!.id));
  } catch (error) {
    console.error("ERROR GET PRO TRAINED EXERCISES:", error);
    return res.status(500).json({
      error: "No se pudieron obtener tus ejercicios",
    });
  }
};

export const getMyExerciseProgress = async (req: Request, res: Response) => {
  try {
    const exerciseId = Number(req.query.exerciseId);
    if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
      return res.status(400).json({ error: "exerciseId es obligatorio" });
    }

    const requestedDays = Number(req.query.days ?? 180);
    const days = allowedExercisePeriods.includes(
      requestedDays as ExerciseProgressPeriod,
    )
      ? (requestedDays as ExerciseProgressPeriod)
      : 180;
    const progress = await getExerciseProgress(
      req.authUser!.id,
      exerciseId,
      days,
    );

    if (!progress) {
      return res.status(404).json({ error: "Ejercicio no encontrado" });
    }

    return res.json(progress);
  } catch (error) {
    console.error("ERROR GET PRO EXERCISE PROGRESS:", error);
    return res.status(500).json({
      error: "No se pudo obtener el progreso del ejercicio",
    });
  }
};
