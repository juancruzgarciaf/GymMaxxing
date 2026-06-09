CREATE TABLE IF NOT EXISTS suscripcion (
  id_suscripcion SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'pending',
  proveedor VARCHAR(30) NOT NULL DEFAULT 'mercadopago',
  external_reference VARCHAR(120) NOT NULL UNIQUE,
  mp_preapproval_id VARCHAR(120) UNIQUE,
  mp_preference_id VARCHAR(120) UNIQUE,
  mp_payment_id VARCHAR(120),
  moneda VARCHAR(10) NOT NULL,
  monto NUMERIC(12, 2) NOT NULL,
  fecha_inicio TIMESTAMP,
  fecha_fin TIMESTAMP,
  fecha_cancelacion TIMESTAMP,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT suscripcion_plan_check
    CHECK (plan IN ('monthly', 'yearly', 'lifetime')),
  CONSTRAINT suscripcion_estado_check
    CHECK (estado IN ('pending', 'active', 'paused', 'cancelled', 'expired', 'payment_failed'))
);

CREATE INDEX IF NOT EXISTS idx_suscripcion_usuario_estado
  ON suscripcion(usuario_id, estado);

CREATE INDEX IF NOT EXISTS idx_suscripcion_external_reference
  ON suscripcion(external_reference);

CREATE TABLE IF NOT EXISTS evento_pago (
  id_evento SERIAL PRIMARY KEY,
  clave_evento VARCHAR(220) NOT NULL UNIQUE,
  proveedor VARCHAR(30) NOT NULL DEFAULT 'mercadopago',
  tipo VARCHAR(60) NOT NULL,
  recurso_id VARCHAR(120),
  payload JSONB NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evento_pago_recurso
  ON evento_pago(proveedor, recurso_id);
