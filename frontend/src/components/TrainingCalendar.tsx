import { useEffect, useMemo, useRef, useState } from "react";
import type { EntrenamientoResumen } from "../types";

type TrainingCalendarProps = {
  trainings: EntrenamientoResumen[];
  onOpenTraining: (training: EntrenamientoResumen) => void;
};

type CalendarDay = {
  date: Date;
  inMonth: boolean;
  key: string;
  trainings: EntrenamientoResumen[];
};

const WEEK_DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTH_LABEL = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
});
const FULL_DATE_LABEL = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const getTrainingDate = (training: EntrenamientoResumen) => {
  const rawDate = training.fecha_actividad || training.fecha_fin || training.fecha_inicio;
  if (!rawDate) {
    return null;
  }

  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDuration = (seconds: number | null) => {
  if (seconds == null) {
    return "Duracion sin registrar";
  }

  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  return `${minutes} min`;
};

const buildCalendarDays = (
  visibleMonth: Date,
  trainingsByDay: Map<string, EntrenamientoResumen[]>,
) => {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const monthStartOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - monthStartOffset);

  return Array.from({ length: 42 }, (_, index): CalendarDay => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = getDateKey(date);

    return {
      date,
      key,
      inMonth: date.getMonth() === month,
      trainings: trainingsByDay.get(key) ?? [],
    };
  });
};

function TrainingCalendar({ trainings, onOpenTraining }: TrainingCalendarProps) {
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const openTooltip = (dayKey: string) => {
    clearCloseTimeout();
    setHoveredDay(dayKey);
  };

  const scheduleCloseTooltip = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredDay(null);
      closeTimeoutRef.current = null;
    }, 160);
  };

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, []);

  const trainingsByDay = useMemo(() => {
    const grouped = new Map<string, EntrenamientoResumen[]>();

    trainings.forEach((training) => {
      const date = getTrainingDate(training);
      if (!date) {
        return;
      }

      const key = getDateKey(date);
      grouped.set(key, [...(grouped.get(key) ?? []), training]);
    });

    grouped.forEach((items, key) => {
      grouped.set(
        key,
        [...items].sort((a, b) => {
          const dateA = getTrainingDate(a)?.getTime() ?? 0;
          const dateB = getTrainingDate(b)?.getTime() ?? 0;
          return dateB - dateA;
        }),
      );
    });

    return grouped;
  }, [trainings]);

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth, trainingsByDay),
    [trainingsByDay, visibleMonth],
  );

  const moveMonth = (delta: number) => {
    setHoveredDay(null);
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <article className="training-calendar-card">
      <div className="calendar-head">
        <h2>Calendario</h2>
        <div className="calendar-controls">
          <button type="button" className="calendar-nav-btn" onClick={() => moveMonth(-1)} aria-label="Mes anterior">
            ‹
          </button>
          <strong>{MONTH_LABEL.format(visibleMonth)}</strong>
          <button type="button" className="calendar-nav-btn" onClick={() => moveMonth(1)} aria-label="Mes siguiente">
            ›
          </button>
        </div>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {WEEK_DAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarDays.map((day) => {
          const hasTraining = day.trainings.length > 0;
          const primaryTraining = day.trainings[0];
          const isTooltipOpen = hoveredDay === day.key;

          return (
            <div
              key={day.key}
              className={`calendar-day ${day.inMonth ? "" : "outside"} ${hasTraining ? "has-training" : ""} ${
                isTooltipOpen ? "is-open" : ""
              }`}
              onMouseEnter={() => {
                if (hasTraining) {
                  openTooltip(day.key);
                }
              }}
              onMouseLeave={() => {
                if (hasTraining) {
                  scheduleCloseTooltip();
                }
              }}
              onFocus={() => {
                if (hasTraining) {
                  openTooltip(day.key);
                }
              }}
              onBlur={() => {
                if (hasTraining) {
                  scheduleCloseTooltip();
                }
              }}
            >
              <span className="calendar-day-number">{day.date.getDate()}</span>
              {hasTraining ? <span className="calendar-training-count">{day.trainings.length}</span> : null}

              {hasTraining && primaryTraining ? (
                <div
                  className="calendar-tooltip"
                  role="tooltip"
                  onMouseEnter={() => openTooltip(day.key)}
                  onMouseLeave={scheduleCloseTooltip}
                >
                  <strong>{primaryTraining.titulo}</strong>
                  <span>{formatDuration(primaryTraining.duracion_segundos)}</span>
                  <span>{FULL_DATE_LABEL.format(day.date)}</span>

                  {day.trainings.length > 1 ? (
                    <small>{day.trainings.length} entrenamientos este dia</small>
                  ) : null}

                  <div className="calendar-tooltip-actions">
                    {day.trainings.slice(0, 3).map((training) => (
                      <button
                        type="button"
                        key={training.id_sesion}
                        className="calendar-training-link"
                        onClick={() => {
                          setHoveredDay(null);
                          onOpenTraining(training);
                        }}
                      >
                        {training.id_sesion === primaryTraining.id_sesion
                          ? "Ver entrenamiento"
                          : training.titulo}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default TrainingCalendar;
