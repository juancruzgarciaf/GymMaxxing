export type Usuario = {
  id: number;
  username: string;
  email: string;
  nombre?: string | null;
  tipo_usuario: string;
  edad?: number | null;
  peso?: number | null;
  altura?: number | null;
  genero?: "hombre" | "mujer" | null;
  nacionalidad?: string | null;
  nivel_entrenamiento?: string | null;
  objetivo_entrenamiento?: string | null;
};

export type GymDaySchedule = {
  abierto: boolean;
  apertura: string;
  cierre: string;
};

export type GymHolidaySchedule = {
  activo: boolean;
  nota: string;
  apertura: string;
  cierre: string;
};

export type GimnasioPerfil = {
  nombre_gimnasio: string | null;
  telefono: string | null;
  sitio_web: string | null;
  instagram: string | null;
  descripcion_corta: string | null;
  tipo_gimnasio: string | null;
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  google_maps_url: string | null;
  horarios: Record<string, GymDaySchedule>;
  horarios_feriados: GymHolidaySchedule;
  servicios: string[];
};

export type EjercicioPreview = {
  nombre: string;
  series: number;
};

export type EntrenamientoResumen = {
  content_type?: "training";
  id_sesion: number;
  usuario_id: number;
  username: string;
  tipo_usuario?: string;
  rutina_id: number | null;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  fecha_actividad: string | null;
  duracion_segundos: number | null;
  volumen_total: number | null;
  total_series: number;
  total_ejercicios: number;
  total_trofeos: number;
  likes_count: number;
  comments_count: number;
  viewer_liked: boolean;
  ejercicios_preview: EjercicioPreview[];
};

export type RoutinePostPreview = {
  nombre: string;
  series: number;
  grupo_muscular: string | null;
};

export type RoutinePostSummary = {
  content_type: "routine";
  id_rutina: number;
  usuario_id: number;
  username: string;
  tipo_usuario: string;
  titulo: string;
  descripcion: string | null;
  duracion_estimada: number | null;
  fecha_actividad: string | null;
  visible_en_descubrir: boolean;
  total_series: number;
  total_ejercicios: number;
  save_count: number;
  copy_count: number;
  likes_count: number;
  viewer_liked: boolean;
  ejercicios_preview: RoutinePostPreview[];
};

export type FeedItem = EntrenamientoResumen | RoutinePostSummary;

export type SessionComment = {
  id_comentario: number;
  sesion_id: number;
  usuario_id: number;
  username: string;
  contenido: string;
  fecha: string;
};

export type SerieSesionDetalle = {
  id_sesion: number;
  ejercicio_id: number;
  orden: number;
  orden_ejercicio?: number;
  repeticiones: number;
  peso: number | null;
  distancia_km?: number | null;
  tiempo_segundos?: number | null;
  descanso: number | null;
  tipo_serie?: TrainingSetType | null;
  nota_ejercicio?: string | null;
  trofeos?: Array<"peso" | "volumen" | "1rm">;
  nombre: string;
  descripcion: string | null;
  grupo_muscular: string | null;
  tipo_disciplina: string | null;
};

export type RoutineSummary = {
  id_rutina: number;
  nombre: string;
  descripcion: string | null;
  duracion_estimada: number | null;
  creador_id: number;
  id_carpeta: number | null;
  visible_en_descubrir: boolean;
  save_count: number;
  copy_count: number;
  likes_count: number;
  viewer_liked: boolean;
};

export type DiscoverRoutineSummary = RoutineSummary & {
  creador_username: string;
  creador_tipo_usuario?: string;
  total_ejercicios: number;
  grupos_musculares: string[];
  creador_seguido: boolean;
};

export type RoutineExerciseDetailed = {
  id_rutina: number;
  id_ejercicio: number;
  series: number;
  repeticiones: number;
  descanso: number;
  orden: number;
  nombre: string;
  descripcion: string;
  grupo_muscular: string;
  tipo_disciplina: string;
};

export type TrainingSetType = "warmup" | "serie" | "dropset" | "failure";

export type TrainingSeedSerie = {
  kg: string;
  reps: string;
  km?: string;
  tiempoSegundos?: number;
  tipo: TrainingSetType;
};

export type TrainingSeedExercise = {
  id_ejercicio: number;
  nombre: string;
  grupo_muscular: string;
  tipo_disciplina: string;
  nota?: string;
  descansoSegundos: number;
  series: TrainingSeedSerie[];
};

export type TrainingSeed = {
  origin: "rutina" | "sesion";
  sourceId: number;
  sourceRoutineId?: number | null;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  exercises: TrainingSeedExercise[];
};

export type SearchUser = Usuario & {
  followers_count: number;
  following_count: number;
  lo_sigo: boolean;
};

export type SocialUser = Usuario & {
  fecha_seguimiento: string;
  viewer_follows: boolean;
};

export type NotificationPreferences = {
  usuario_id: number;
  email: string | null;
  email_disponible: boolean;
  google_vinculado: boolean;
  recibir_en_app: boolean;
  recibir_por_email: boolean;
  notificar_like_entrenamiento: boolean;
  notificar_comentario_entrenamiento: boolean;
  notificar_nuevo_seguidor: boolean;
  fecha_actualizacion: string;
};

export type SuggestedAthlete = Usuario & {
  followers_count: number;
  following_count: number;
  trainings_count: number;
  viewer_follows: boolean;
  mutual_following_count: number;
};

export type Gimnasio = {
  id: string;
  nombre: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  descripcion?: string | null;
  imagenUrl?: string | null;
  origen: "local";
  distanciaMetros?: number;
  perfil?: {
    username: string;
    email: string;
    tipoUsuario: string;
  } | null;
};

export type PerfilUsuario = {
  usuario: Usuario;
  gimnasio_perfil?: GimnasioPerfil | null;
  followers_count: number;
  following_count: number;
  trainings_count: number;
  routines_count?: number;
  viewer_follows: boolean;
  is_own_profile: boolean;
  entrenamientos: EntrenamientoResumen[];
  rutinas?: RoutinePostSummary[];
};
