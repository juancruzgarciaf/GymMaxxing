import TrainingPostCard from "./TrainingPostCard";
import type { EntrenamientoResumen } from "../types";

type UserTrainingFeedProps = {
  trainings: EntrenamientoResumen[];
  viewerId: number;
  onOpenProfile: (username: string) => void;
  onOpenTraining: (training: EntrenamientoResumen) => void;
  onSaveAsRoutine: (training: EntrenamientoResumen, customName?: string) => void | Promise<void>;
};

function UserTrainingFeed({
  trainings,
  viewerId,
  onOpenProfile,
  onOpenTraining,
  onSaveAsRoutine,
}: UserTrainingFeedProps) {
  if (trainings.length === 0) {
    return (
      <section className="empty-state">
        <h2>No hay entrenamientos finalizados todavía</h2>
        <p>Cuando este usuario termine rutinas, van a aparecer acá.</p>
      </section>
    );
  }

  return (
    <section className="feed-list">
      {trainings.map((item) => (
        <TrainingPostCard
          key={item.id_sesion}
          item={item}
          viewerId={viewerId}
          onOpenProfile={onOpenProfile}
          onOpenTraining={onOpenTraining}
          onSaveAsRoutine={onSaveAsRoutine}
        />
      ))}
    </section>
  );
}

export default UserTrainingFeed;
