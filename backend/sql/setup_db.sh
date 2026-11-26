#!/usr/bin/env bash
# Crea/actualiza la base de GymMaxxing aplicando todos los SQL en el orden correcto.
# Toma la conexion de backend/.env (DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT).
#
# Uso (desde la carpeta backend/):
#   bash sql/setup_db.sh            -> aplica sobre la base existente (todo es idempotente)
#   bash sql/setup_db.sh --reset    -> borra la base y la crea de cero
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${DB_USER:?Falta DB_USER en backend/.env}"
: "${DB_HOST:?Falta DB_HOST en backend/.env}"
: "${DB_NAME:?Falta DB_NAME en backend/.env}"
: "${DB_PORT:?Falta DB_PORT en backend/.env}"
export PGPASSWORD="${DB_PASSWORD:-}"

PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -v ON_ERROR_STOP=1 -q)

if [ "${1:-}" = "--reset" ]; then
  echo "Borrando y recreando la base $DB_NAME..."
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\""
  "${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DB_NAME\""
elif ! "${PSQL[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
  echo "Creando la base $DB_NAME..."
  "${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DB_NAME\""
fi

# El orden importa: el catalogo oficial de ejercicios tiene que estar antes
# de re-armar las rutinas oficiales y de asignar los videos/imagenes.
FILES=(
  0000_schema_base.sql
  2026-04-08_add_routine_save_copy_metrics.sql
  2026-04-08_allow_null_rutina_id_in_sesionentrenamiento.sql
  2026-04-18_seed_official_routines.sql
  2026-05-17_unique_username_email.sql
  2026-05-20_add_cardio_time_fields_to_serie.sql
  2026-05-20_add_genero_to_usuario.sql
  2026-05-20_add_tipo_serie_to_serie.sql
  2026-05-20_add_training_records.sql
  2026-05-20_create_gimnasio_table.sql
  2026-05-21_create_gimnasio_perfil_table.sql
  2026-05-21_delete_old_sportclub_pilar.sql
  2026-05-21_link_gimnasios_to_profiles.sql
  2026-05-21_remove_google_place_id_from_gimnasio.sql
  2026-05-21_seed_pilar_fitness.sql
  2026-05-21_update_sportclub_pilar_address.sql
  2026-05-21_update_sportclub_pilar_coordinates.sql
  2026-05-24_add_routine_discover_visibility.sql
  2026-05-24_add_routine_likes.sql
  2026-06-03_create_notification_tables.sql
  2026-06-08_create_subscriptions.sql
  2026-06-12_add_pro_body_measurements_and_custom_exercises.sql
  2026-06-12_add_profile_photo_to_usuario.sql
  2026-06-14_add_uploaded_images.sql
  2026-06-15_sync_official_exercises.sql
  2026-11-26_resync_official_routines.sql
  2026-06-15_seed_exercise_media.sql
  2026-06-15_sync_exercise_media_by_name.sql
  2026-11-26_add_musica.sql
)

for file in "${FILES[@]}"; do
  echo "-> $file"
  "${PSQL[@]}" -d "$DB_NAME" -f "sql/$file" > /dev/null
done

# Avisa si aparece un .sql nuevo que no esta en la lista de arriba.
for path in sql/*.sql; do
  name="$(basename "$path")"
  if [[ ! " ${FILES[*]} " =~ \ $name\  ]]; then
    echo "AVISO: $name no esta en setup_db.sh, no se aplico."
  fi
done

echo "Base $DB_NAME lista."
