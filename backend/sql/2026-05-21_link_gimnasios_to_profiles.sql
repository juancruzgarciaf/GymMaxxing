ALTER TABLE gimnasio
ADD COLUMN IF NOT EXISTS usuario_id INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gimnasio_usuario_id_fkey'
  ) THEN
    ALTER TABLE gimnasio
    ADD CONSTRAINT gimnasio_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES usuario(id)
    ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO usuario (username, email, password, tipo_usuario)
SELECT 'SPORTCLUB PILAR', 'sportclubpilar@gmail.com', 'gymmaxxing', 'gimnasio'
WHERE NOT EXISTS (
  SELECT 1
  FROM usuario
  WHERE LOWER(email) = LOWER('sportclubpilar@gmail.com')
     OR LOWER(username) = LOWER('SPORTCLUB PILAR')
);

INSERT INTO usuario (username, email, password, tipo_usuario)
SELECT 'MEGATLON', 'megatlon@gmail.com', 'gymmaxxing', 'gimnasio'
WHERE NOT EXISTS (
  SELECT 1
  FROM usuario
  WHERE LOWER(email) = LOWER('megatlon@gmail.com')
     OR LOWER(username) = LOWER('MEGATLON')
);

UPDATE usuario
SET tipo_usuario = 'gimnasio'
WHERE LOWER(email) IN (LOWER('sportclubpilar@gmail.com'), LOWER('megatlon@gmail.com'))
   OR LOWER(username) IN (LOWER('SPORTCLUB PILAR'), LOWER('MEGATLON'));

UPDATE gimnasio
SET usuario_id = (
  SELECT id
  FROM usuario
  WHERE LOWER(email) = LOWER('sportclubpilar@gmail.com')
     OR LOWER(username) = LOWER('SPORTCLUB PILAR')
  ORDER BY CASE WHEN LOWER(email) = LOWER('sportclubpilar@gmail.com') THEN 0 ELSE 1 END
  LIMIT 1
)
WHERE LOWER(nombre) = LOWER('SportClub Pilar');

UPDATE gimnasio
SET usuario_id = (
  SELECT id
  FROM usuario
  WHERE LOWER(email) = LOWER('megatlon@gmail.com')
     OR LOWER(username) = LOWER('MEGATLON')
  ORDER BY CASE WHEN LOWER(email) = LOWER('megatlon@gmail.com') THEN 0 ELSE 1 END
  LIMIT 1
)
WHERE LOWER(nombre) = LOWER('Megatlon Pilar');
