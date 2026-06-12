import { Request, Response } from "express";
import {
  getWeeklyEvolution,
  ProStatsPeriod,
} from "../services/pro-stats.service";

const allowedPeriods: ProStatsPeriod[] = [4, 12, 26];

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
