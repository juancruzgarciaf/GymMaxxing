export type Usuario = {
  id: number;
  username: string;
  email: string;
  tipo_usuario: string;
  edad?: number | null;
  peso?: number | null;
  altura?: number | null;
  nacionalidad?: string | null;
  nivel_entrenamiento?: string | null;
  objetivo_entrenamiento?: string | null;
};

export type EjercicioPreview = {
  nombre: string;
  series: number;
};

export type EntrenamientoResumen = {
  id_sesion: number;
  usuario_id: number;
  username: string;
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
  ejercicios_preview: EjercicioPreview[];
};

export type SerieSesionDetalle = {
  id_sesion: number;
  ejercicio_id: number;
  orden: number;
  orden_ejercicio?: number;
  repeticiones: number;
  peso: number | null;
  descanso: number | null;
  nombre: string;
  descripcion: string | null;
  grupo_muscular: string | null;
  tipo_disciplina: string | null;
};

export type SearchUser = Usuario & {
  followers_count: number;
  following_count: number;
  lo_sigo: boolean;
};

export type PerfilUsuario = {
  usuario: Usuario;
  followers_count: number;
  following_count: number;
  trainings_count: number;
  viewer_follows: boolean;
  is_own_profile: boolean;
  entrenamientos: EntrenamientoResumen[];
};
