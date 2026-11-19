# AGENTS.md — FortínViajes

Reglas para cualquier agente de IA (o persona) que trabaje en este repositorio.

## Fuente de verdad
- Reglas funcionales: `docs/spec.md` (cada regla está numerada: RN1, RN2…).
- Decisiones de negocio: `docs/decisiones.md`.
- Arquitectura y modelo de datos: `docs/plan.md`.
- Tareas y su estado: `docs/tasks.md`.
- Esquema de base de datos: `backend/sql/schema.sql`.

Si dos documentos se contradicen, **detenerse y pedir una decisión**; no inventar reglas.

## Stack
React + TypeScript + Vite (frontend) · Node.js + Express + TypeScript (backend) · PostgreSQL (Neon en producción).
Arquitectura del backend: **Routes → Controller → Service → Repository**. Las reglas puras viven en `backend/src/business/`.

## Reglas generales
- No agregar dependencias sin justificarlo en el commit o en `docs/decisiones.md`.
- **Nunca** subir `.env`, contraseñas, tokens ni cadenas de conexión. Solo `.env.example` con valores falsos.
- Validar todas las entradas en el backend, aunque el frontend también valide.
- El cliente nunca decide precios, cupos, montos pagados, reintegros ni roles: lo calcula el servidor.
- Los cupos del micro deben conservar protección ante concurrencia **en la base de datos** (bloqueo de fila + trigger), no solo en el código.
- Toda modificación de una regla debe actualizar, en el mismo commit: `docs/spec.md`, los tests y la documentación afectada.
- Los controladores no tienen reglas de negocio; los servicios no conocen HTTP; solo los repositorios hablan SQL.
- Las fechas se guardan en UTC (`timestamptz`) y las reglas de día/hora usan horario de Argentina (UTC-3). Ver RN14.
- Mantener accesibilidad básica (labels, foco visible, contraste), diseño responsive y mensajes de error claros en español rioplatense.
- Una tarea se considera terminada cuando pasan sus tests, `npm run typecheck` y `npm run build` pertinentes.

## Agentes
- **Analista**: aclara reglas y actualiza documentación funcional.
- **Arquitecto**: revisa modelo, API y decisiones técnicas.
- **Backend**: implementa API, reglas y SQL.
- **Frontend**: implementa pantallas y experiencia.
- **Tester**: crea y ejecuta pruebas sin alterar la lógica productiva para que "pasen".
- **Revisor**: revisa seguridad, consistencia y criterios de aceptación.

Detalle de cada agente en `docs/agents/`.

## Ciclo por tarea
1. El Analista confirma las RN/HU involucradas.
2. El Tester define casos y criterios de aceptación (primero el test).
3. Backend/Frontend implementa sin debilitar los tests.
4. El Revisor verifica cambios y resultados.
5. Se marca la tarea en `docs/tasks.md` y se registra **un commit por tarea** (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), mencionando el ID de la tarea (ej. `feat(T07): ...`).
