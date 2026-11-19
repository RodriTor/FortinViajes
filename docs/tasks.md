# tasks.md — Tareas

Formato: `ID — Descripción — Agente — RN — HU — Dependencias — Criterio de terminado`. Un commit por tarea.

- [x] T01 — Estructura monorepo, AGENTS.md y documentación base — Agente: Arquitecto — RN: todas — HU: todas — Dep: ninguna — Terminado: workspaces, `AGENTS.md`, idea, decisiones, glosario y agentes creados.
- [x] T02 — Especificación con reglas numeradas y plan técnico — Agente: Analista — RN: RN1–RN16 — HU: HU1–HU6 — Dep: T01 — Terminado: `spec.md`, `plan.md` y `tasks.md` consistentes.
- [x] T03 — Esquema PostgreSQL — Agente: Backend — RN: 1, 3, 4, 6, 16 — HU: 3, 4, 5, 6 — Dep: T02 — Terminado: tablas, índice único parcial y trigger de capacidad aplican sobre una base real.
- [x] T04 — Reglas de negocio puras con tests unitarios — Agente: Backend/Tester — RN: 2, 4, 6, 7, 8, 9, 11, 14, 15 — HU: 3, 4, 5, 6 — Dep: T02 — Terminado: funciones puras y tests unitarios en verde.
- [x] T05 — Infraestructura del backend y autenticación — Agente: Backend — RN: 12, 16 — HU: 2 — Dep: T03 — Terminado: config, pool, errores, app Express, registro, login, JWT, roles.
- [x] T06 — API de viajes — Agente: Backend — RN: 6, 7, 12 — HU: 1, 5 — Dep: T04, T05 — Terminado: listar, detalle, crear, cambiar estado (con cascada de cancelación).
- [x] T07 — API de pasajeros: anotar, cancelar y registrar pago — Agente: Backend — RN: 1–5, 8–12, 16 — HU: 3, 4, 6 — Dep: T04, T06 — Terminado: reglas de cupo, DNI, límites, cierre, reintegro y pagos operando en transacción.
- [x] T08 — Resumen, búsqueda y "Mis lugares" — Agente: Backend — RN: 12, 13, 15 — HU: 4, 6 — Dep: T07 — Terminado: endpoints de resumen, lista con búsqueda y mis lugares.
- [x] T09 — Tests de integración y concurrencia contra PostgreSQL — Agente: Tester — RN: todas — HU: todas — Dep: T05–T08 — Terminado: suite de API y prueba de carrera de cupo en verde.
- [x] T10 — Frontend base: router, cliente de API y autenticación — Agente: Frontend — RN: 12 — HU: 2 — Dep: T05 — Terminado: layout, ingreso/registro, sesión persistente.
- [x] T11 — Frontend del hincha: viajes, anotarse y mis viajes — Agente: Frontend — RN: 1–3, 8–11 — HU: 1, 3, 4 — Dep: T06–T08, T10 — Terminado: catálogo, detalle con formulario, mis lugares y cancelación con advertencia de reintegro.
- [x] T12 — Frontend del organizador: panel — Agente: Frontend — RN: 4–7, 13, 15 — HU: 5, 6 — Dep: T11 — Terminado: crear viaje, estados, resumen, pasajeros, búsqueda y pagos.
- [x] T13 — Configuración de despliegue, CI y scripts de administración — Agente: Arquitecto — RN: 12 — HU: todas — Dep: T09, T12 — Terminado: `render.yaml`, `netlify.toml`, GitHub Actions, `create-admin`, seed de ejemplo y guía de despliegue.
- [x] T14 — Informe de pruebas con ejecución real — Agente: Tester — RN: todas — HU: todas — Dep: T09, T12 — Terminado: resultados reales de tests, typecheck, build y matriz de API.
- [ ] T15 — Crear base en Neon y desplegar la API en Render — Agente: DevOps (persona) — RN: todas — HU: todas — Dep: T13 — Terminado: `/api/health` público responde `ok`.
- [ ] T16 — Desplegar el frontend en Netlify y validar el flujo real — Agente: Revisor (persona) — RN: todas — HU: todas — Dep: T15 — Terminado: URL pública probada de punta a punta.
- [ ] T17 — Registrar URLs y capturas reales en el informe — Agente: Revisor (persona) — RN: todas — HU: todas — Dep: T14–T16 — Terminado: enlaces y evidencia reales en README e informe.
