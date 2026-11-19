# FortínViajes

Aplicación web para organizar los **traslados en micro de las peñas de Vélez** a la cancha: el organizador publica viajes y controla cupos, pasajeros y pagos; los hinchas se anotan, ven sus lugares y pueden cancelar con una política de reintegro clara.

Trabajo práctico final — Generación T. Evolución del backend de los TP anteriores (`Routes → Controller → Service → Repository`) con usuarios y roles, PostgreSQL, frontend completo y publicación en internet.

## Enlaces públicos
| Qué | URL |
|---|---|
| Aplicación (frontend, Netlify) | _pendiente: completar al publicar (ver `docs/despliegue.md`)_ |
| API (Render) | _pendiente_ `/api/health` |
| Base de datos | Neon (PostgreSQL) |

## Qué hace
- **Hincha:** ve los viajes y sus cupos, se registra, reserva lugares (propio y de acompañantes), ve **Mis viajes** y cancela viendo antes cuánto se reintegra o se retiene.
- **Organizador:** crea viajes, cambia su estado (Iniciar / Finalizar / Cancelar), anota pasajeros, registra señas y pagos, busca por nombre/DNI/socio y ve el **resumen económico** (recaudado, pendiente, retenido, a reintegrar).
- **Reglas de negocio reales** (16 reglas numeradas en [`docs/spec.md`](docs/spec.md)): capacidad protegida ante concurrencia en la base, DNI único por viaje, cierre de inscripción 3 h antes, límites por persona, un viaje por día por DNI, estados de viaje y de pago, reintegro según anticipación, privacidad por rol.

## Tecnologías
React + TypeScript + Vite · Node.js + Express + TypeScript · PostgreSQL · JWT + bcrypt · Netlify / Render / Neon.

## Estructura
```
backend/   API (src/routes → controllers → services → repositories, src/business = reglas puras), sql/, test/
frontend/  SPA React (src/pages, src/components)
docs/      idea, spec (RN1–RN16), plan, tasks, decisiones, glosario, despliegue, informe-pruebas, agents/
AGENTS.md  reglas para agentes de IA
```

## Cómo correrlo en local
Requisitos: Node 22+ y PostgreSQL 14+.
```bash
npm install
createdb fortinviajes && createdb fortinviajes_test
cp .env.example backend/.env           # editá DATABASE_URL, JWT_SECRET y TEST_DATABASE_URL
cp frontend/.env.example frontend/.env
npm run db:schema -w backend           # crea tablas, índices y trigger
npm run create-admin -w backend -- organizador@mail.com "ClaveSegura123" "Tu Nombre"
psql "$DATABASE_URL" -f backend/sql/seed.example.sql   # opcional: viajes de ejemplo
npm run dev                            # API en :3000 y web en http://localhost:5173
```

## Tests
```bash
npm run test:unit -w backend   # reglas puras, sin base de datos
npm test                       # todo; los de integración necesitan TEST_DATABASE_URL (base exclusiva de tests)
npm run typecheck && npm run build
```
Resultados reales y trazabilidad RN → pruebas en [`docs/informe-pruebas.md`](docs/informe-pruebas.md). El CI de GitHub Actions corre todo contra un PostgreSQL de servicio.

## Seguridad
`.env` está en `.gitignore`; solo se versiona `.env.example` con valores falsos. Contraseñas con bcrypt, JWT con vencimiento, CORS restringido al frontend, rate limit en `/api/auth`, consultas parametrizadas y errores 500 sin detalles internos.

## Documentación
[`idea`](docs/idea.md) · [`spec`](docs/spec.md) · [`plan`](docs/plan.md) · [`tasks`](docs/tasks.md) · [`decisiones`](docs/decisiones.md) · [`glosario`](docs/glosario.md) · [`preguntas abiertas`](docs/preguntas-abiertas.md) · [`despliegue`](docs/despliegue.md) · [`informe de pruebas`](docs/informe-pruebas.md) · [`AGENTS.md`](AGENTS.md)
