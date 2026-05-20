ALTER TABLE usuario
ADD COLUMN IF NOT EXISTS genero TEXT;

ALTER TABLE usuario
DROP CONSTRAINT IF EXISTS usuario_genero_check;

ALTER TABLE usuario
ADD CONSTRAINT usuario_genero_check
CHECK (genero IS NULL OR genero IN ('hombre', 'mujer'));
