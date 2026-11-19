-- Datos reales para que la app no arranque vacía. NO contiene usuarios ni contraseñas.
-- Uso: pegar en el SQL Editor de Neon (o `psql "$DATABASE_URL" -f backend/sql/seed.sql`).
-- Es seguro correrlo más de una vez: no duplica el viaje.
--
-- Octavos de final del Clausura 2026: Vélez vs Belgrano, viernes 20/11/2026, 20:00 h, en el Amalfitani.
-- La salida del micro es 3 horas antes del partido (17:00). Ajustá punto de encuentro, precio y capacidad
-- desde el Panel del organizador o editando estos valores antes de correrlo.
INSERT INTO trips (rival, stadium, departure_at, meeting_point, competition, match_at, ticket_price, capacity)
SELECT 'Belgrano', 'Estadio José Amalfitani',
       TIMESTAMPTZ '2026-11-20 17:00:00-03', 'Sede Liniers', 'Octavos de final · Clausura 2026',
       TIMESTAMPTZ '2026-11-20 20:00:00-03', 10000, 40
WHERE NOT EXISTS (
  SELECT 1 FROM trips WHERE rival = 'Belgrano' AND departure_at = TIMESTAMPTZ '2026-11-20 17:00:00-03'
);
