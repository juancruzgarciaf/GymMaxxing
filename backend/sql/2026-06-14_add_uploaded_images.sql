ALTER TABLE usuario
ADD COLUMN IF NOT EXISTS foto_perfil_url TEXT;

ALTER TABLE sesionentrenamiento
ADD COLUMN IF NOT EXISTS imagen_url TEXT;

ALTER TABLE ejercicio
ADD COLUMN IF NOT EXISTS imagen_url TEXT;
