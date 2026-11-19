-- Datos de ejemplo para probar la app (NO contiene usuarios ni contraseñas).
-- Los viajes se crean con fechas relativas a hoy, en horario argentino.
-- Uso: psql "$DATABASE_URL" -f backend/sql/seed.example.sql
INSERT INTO trips (rival, stadium, departure_at, meeting_point, ticket_price, capacity) VALUES
  ('San Lorenzo', 'Estadio José Amalfitani', (date_trunc('day', NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') + interval '12 days 18 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires', 'Sede Liniers', 10000, 20),
  ('Boca Juniors', 'La Bombonera', (date_trunc('day', NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') + interval '20 days 15 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires', 'Sede Liniers', 14000, 30),
  ('Independiente', 'Libertadores de América', (date_trunc('day', NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') + interval '27 days 20 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires', 'Plaza Flores', 12000, 4);
