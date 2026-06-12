import { Request, Response } from "express";
import {
  getMuscleDistribution,
  getWeeklyEvolution,
  MuscleStatsPeriod,
  ProStatsPeriod,
} from "../services/pro-stats.service";

const allowedPeriods: ProStatsPeriod[] = [4, 12, 26];
const allowedMusclePeriods: MuscleStatsPeriod[] = [30, 90, 180];

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
