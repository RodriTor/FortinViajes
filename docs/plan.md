# plan.md — Plan técnico

## Arquitectura
- SPA React + TypeScript + Vite servida como archivos estáticos (Netlify).
- API REST Express + TypeScript con capas **Routes → Controller → Service → Repository** (Render).
- PostgreSQL como fuente persistente de verdad (Neon).
- JWT para autenticar; bcrypt para hashear contraseñas.
- Variables sensibles exclusivamente en el entorno (`.env` fuera del repo).

```
Navegador (Netlify) ──HTTPS/JSON──► API Express (Render) ──SQL/SSL──► PostgreSQL (Neon)
                                     routes → controllers → services → repositories
                                                         └─ business/ (reglas puras)
```

## Modelo de datos
- `users(id uuid, name, email unique, password_hash, role, created_at)`
- `trips(id uuid, rival, stadium, departure_at, meeting_point, competition, match_at, ticket_price, capacity, status, created_by, created_at, updated_at)`
- `passengers(id uuid, trip_id, user_id null, name, dni, phone, member_number, payment_status, deposit_amount null, status, refund_amount, retained_amount, cancelled_at, created_at)`

Restricciones clave en `backend/sql/schema.sql`: `CHECK` de estados y DNI, índice único parcial `(trip_id, dni) WHERE status='ACTIVO'`, trigger `enforce_trip_capacity` y `CHECK` de coherencia de seña.

## API
| Método y ruta | Acceso | Descripción |
|---|---|---|
| `GET /api/health` | público | Estado del servicio y de la base |
| `POST /api/auth/register` | público | Alta de hincha (rol USER) |
| `POST /api/auth/login` | público | Ingreso, devuelve JWT |
| `GET /api/auth/me` | autenticado | Usuario de la sesión |
| `GET /api/trips` | público | Listado con cupos (`?q=rival&status=Abierto`) |
| `GET /api/trips/:id` | público | Detalle con cupos |
| `POST /api/trips` | ADMIN | Crear viaje |
| `PATCH /api/trips/:id/status` | ADMIN | En Viaje, Finalizado o Cancelado |
| `GET /api/trips/:id/summary` | ADMIN | Resumen económico |
| `GET /api/trips/:id/passengers?q=` | ADMIN | Lista y búsqueda |
| `POST /api/trips/:id/passengers` | autenticado | Anotar pasajero |
| `PATCH /api/trips/:id/passengers/:pid/payment` | ADMIN | Registrar pago |
| `PATCH /api/trips/:id/passengers/:pid/cancel` | dueño o ADMIN | Cancelar lugar |
| `GET /api/passengers/mine` | autenticado | Mis lugares |

## Dónde vive cada regla
| Regla | Lugar |
|---|---|
| RN1 capacidad | Servicio (mensaje claro) + trigger `enforce_trip_capacity` con bloqueo `FOR UPDATE` |
| RN2 datos | `business/passengerRules.ts` |
| RN3 DNI único | Servicio + índice único parcial |
| RN4/RN5 pagos | `business/payments.ts` y servicio (`isAdmin`) |
| RN6 estados | `business/tripRules.ts` (`assertTransition`) y servicio |
| RN7 creación | `business/tripRules.ts` |
| RN8/RN9 inscripción y cancelación | `business/policies.ts` |
| RN10/RN11 límites | Servicio con `pg_advisory_xact_lock` por usuario y por DNI |
| RN12 autorización | Middleware JWT/rol + consultas por `user_id` |
| RN14 zona horaria | `business/time.ts` |
| RN15 resumen | `business/summary.ts` |

## Concurrencia
Alta de pasajero y cancelación se ejecutan en una transacción: (1) `pg_advisory_xact_lock` por usuario y por DNI, (2) `SELECT … FOR UPDATE` del viaje, (3) validaciones, (4) `INSERT`/`UPDATE`. El trigger vuelve a validar el cupo dentro de la base. El orden de bloqueos es siempre el mismo para evitar deadlocks.

## Seguridad
Helmet, CORS restringido a `FRONTEND_URL`, rate limit en `/api/auth`, límite de tamaño de JSON, hash bcrypt (costo 12), JWT con expiración, consultas parametrizadas, secretos solo por entorno, error 500 genérico sin detalles internos.

## Despliegue
Frontend en Netlify, backend en Render y PostgreSQL en Neon. Ver `docs/despliegue.md`.

## Riesgos y notas
- Render (plan gratuito) duerme el servicio: la primera petición puede tardar ~50 s. El frontend muestra un aviso de "despertando el servidor".
- Neon exige SSL: la conexión usa `sslmode=require` en `DATABASE_URL`.
- El organizador inicial se crea con `npm run create-admin`; nunca por registro público.
