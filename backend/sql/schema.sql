-- FortínViajes — esquema PostgreSQL (idempotente: se puede ejecutar varias veces)
-- Ver docs/spec.md (RN1, RN3, RN4, RN6, RN16) y docs/plan.md.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rival          VARCHAR(120) NOT NULL,
  stadium        VARCHAR(160) NOT NULL,
  departure_at   TIMESTAMPTZ NOT NULL,
  meeting_point  VARCHAR(160) NOT NULL DEFAULT '',
  competition    VARCHAR(80) NOT NULL DEFAULT '',
  match_at       TIMESTAMPTZ,
  ticket_price   NUMERIC(12,2) NOT NULL CHECK (ticket_price >= 0),
  capacity       INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 100),
  status         VARCHAR(20) NOT NULL DEFAULT 'Abierto'
                 CHECK (status IN ('Abierto', 'Completo', 'En Viaje', 'Finalizado', 'Cancelado')),
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Actualización para bases creadas con una versión anterior (no hace nada si las columnas ya existen).
ALTER TABLE trips ADD COLUMN IF NOT EXISTS competition VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS match_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS passengers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  -- Quién anotó al pasajero: el hincha dueño del lugar. NULL si lo cargó el organizador.
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  name             VARCHAR(100) NOT NULL,
  dni              VARCHAR(8) NOT NULL CHECK (dni ~ '^[0-9]{7,8}$'),
  phone            VARCHAR(20) NOT NULL DEFAULT '',
  member_number    VARCHAR(10) NOT NULL DEFAULT '',
  payment_status   VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                   CHECK (payment_status IN ('Pendiente', 'Señado', 'Pagado')),
  deposit_amount   NUMERIC(12,2) CHECK (deposit_amount IS NULL OR deposit_amount > 0),
  status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'CANCELADO')),
  refund_amount    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  retained_amount  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (retained_amount >= 0),
  cancelled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- La seña solo tiene sentido cuando el estado de pago es "Señado".
  CHECK (payment_status = 'Señado' OR deposit_amount IS NULL)
);

-- RN3: un DNI no puede repetirse entre los pasajeros ACTIVOS de un mismo viaje.
CREATE UNIQUE INDEX IF NOT EXISTS passengers_trip_dni_active_uq
  ON passengers (trip_id, dni) WHERE status = 'ACTIVO';

CREATE INDEX IF NOT EXISTS passengers_trip_idx ON passengers (trip_id);
CREATE INDEX IF NOT EXISTS passengers_user_idx ON passengers (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS passengers_dni_idx  ON passengers (dni) WHERE status = 'ACTIVO';
CREATE INDEX IF NOT EXISTS trips_departure_idx ON trips (departure_at);

-- RN1: la capacidad se revalida dentro de la base. Bloquear la fila del viaje serializa
-- las altas simultáneas: la segunda transacción espera y luego cuenta con el dato ya confirmado.
CREATE OR REPLACE FUNCTION enforce_trip_capacity() RETURNS trigger AS $$
DECLARE
  cap   INTEGER;
  taken INTEGER;
BEGIN
  IF NEW.status <> 'ACTIVO' THEN
    RETURN NEW;
  END IF;
  SELECT capacity INTO cap FROM trips WHERE id = NEW.trip_id FOR UPDATE;
  SELECT COUNT(*) INTO taken FROM passengers WHERE trip_id = NEW.trip_id AND status = 'ACTIVO';
  IF taken >= cap THEN
    RAISE EXCEPTION 'El micro está completo, no hay asientos disponibles' USING ERRCODE = 'FV001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS passengers_capacity_trg ON passengers;
CREATE TRIGGER passengers_capacity_trg
  BEFORE INSERT ON passengers
  FOR EACH ROW EXECUTE FUNCTION enforce_trip_capacity();
