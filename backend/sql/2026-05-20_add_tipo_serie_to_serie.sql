ALTER TABLE serie
ADD COLUMN IF NOT EXISTS tipo_serie VARCHAR(20) NOT NULL DEFAULT 'serie';

ALTER TABLE serie
DROP CONSTRAINT IF EXISTS serie_tipo_serie_check;

ALTER TABLE serie
ADD CONSTRAINT serie_tipo_serie_check
CHECK (tipo_serie IN ('warmup', 'serie', 'dropset', 'failure'));
