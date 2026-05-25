ALTER TABLE rutina
  ADD COLUMN IF NOT EXISTS visible_en_descubrir BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE rutina
  ALTER COLUMN visible_en_descubrir SET DEFAULT TRUE;

UPDATE rutina
SET visible_en_descubrir = TRUE;

CREATE INDEX IF NOT EXISTS idx_rutina_visible_en_descubrir
  ON rutina(visible_en_descubrir);
