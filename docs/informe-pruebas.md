# informe-pruebas.md — Informe de pruebas

## 1. Alcance y entorno
- **Probado:** reglas de negocio puras, API completa (autenticación, viajes, pasajeros, pagos, resumen, búsqueda, "Mis lugares"), restricciones y trigger de PostgreSQL, concurrencia de cupo, y el flujo de punta a punta del frontend.
- **Entorno de la corrida:** Node 22.23.5, PostgreSQL 16 local (base `fortinviajes_test`, vaciada en cada prueba), Chromium con Playwright para el flujo del navegador. Fecha de ejecución: 19/11/2026.
- **No probado todavía:** el despliegue público (Neon + Render + Netlify). Se completa en la sección 6 cuando se publique (tareas T15–T17).
- **Reloj controlado:** los tests de integración inyectan un reloj para verificar los límites horarios exactos (3 h, 6 h, 24 h) sin esperar.

## 2. Resultados de las corridas
| Verificación | Comando | Resultado |
|---|---|---|
| Tipos (backend y frontend) | `npm run typecheck` | Sin errores |
| Tests unitarios (sin base de datos) | `npm run test:unit -w backend` | **53 de 53 pasan** |
| Suite completa (unitarios + integración + concurrencia) | `npm test` | **107 de 107 pasan** (20 suites, 0 fallas, 0 omitidos) |
| Build de producción | `npm run build` | Backend (tsc) y frontend (vite) compilan |
| Arranque de producción | `NODE_ENV=production node backend/dist/server.js` | `/api/health` → `ok`; sin `JWT_SECRET` se niega a arrancar |
| Secretos en el repo | `git ls-files` + búsqueda de cadenas de conexión | Sin `.env` ni credenciales versionadas |

Sin `TEST_DATABASE_URL`, los 54 tests de integración se omiten con un aviso (no cuentan como aprobados); en GitHub Actions corren siempre contra un PostgreSQL de servicio.

## 3. Trazabilidad: regla → pruebas
| Regla | Dónde se prueba |
|---|---|
| RN1 Capacidad | `passengers.test` (no supera capacidad); `concurrency.test` (10 hinchas simultáneos en 3 lugares → exactamente 3; trigger de la base) |
| RN2 Datos del pasajero | `passengerRules.test` (DNI 6/9 dígitos, letras, nombre, teléfono, socio); `passengers.test` (400) |
| RN3 DNI único por viaje | `passengers.test` (409 y reuso tras cancelar); `concurrency.test` (mismo DNI ×6 simultáneo; índice único) |
| RN4 Estados de pago y seña | `payments.test` (50% por defecto, 0, igual al precio, mayor al precio); `passengers.test` |
| RN5 Solo el organizador registra pagos | `passengers.test` (403 al hincha) |
| RN6 Estados del viaje | `tripRules.test` (transiciones); `trips.test` (ciclo completo, cancelación en cascada); `passengers.test` (Abierto↔Completo, altas bloqueadas) |
| RN7 Creación de viaje | `tripRules.test`; `trips.test` (403/401/400, hora argentina) |
| RN8 Cierre de inscripción | `policies.test` y `passengers.test` (3 h exactas sí; 2 h 59 min no; organizador hasta la salida) |
| RN9 Cancelación y reintegro | `policies.test` y `passengers.test` (24 h exactas / 23 h 59 min; 6 h exactas / 5 h 59 min; organizador) |
| RN10 Límites por persona | `passengers.test` (4 lugares, 3 viajes); `concurrency.test` (carreras del mismo usuario) |
| RN11 Un viaje por día por DNI | `passengers.test` (23:30 mismo día → 409; 00:30 del día siguiente → permitido); `time.test` |
| RN12 Autorización y privacidad | `auth.test` (nunca ADMIN por registro, token vencido/inválido/usuario borrado); `trips.test` (no se expone DNI ni teléfono); `passengers.test` (lugares ajenos → 404, lista y resumen solo organizador) |
| RN13 Búsqueda de pasajeros | `passengers.test` (nombre, DNI, socio, mayúsculas, `%` literal) |
| RN14 Zona horaria | `time.test` (UTC-3, día argentino, fechas imposibles) |
| RN15 Resumen económico | `summary.test`; `passengers.test` (recaudado, pendiente, retenido) |
| RN16 Integridad | `validation.test`; `trips.test` y `passengers.test` (ids mal formados → 404); `concurrency.test` (CHECK de la base) |

## 4. Prueba de punta a punta en navegador (frontend + API + PostgreSQL)
Ejecutada con Playwright (Chromium) contra la app compilada y la API real, con datos de ejemplo:

| Paso | Resultado |
|---|---|
| Ver listado de viajes (boletos con fecha, precio y cupos) | Correcto |
| Registrarse como hincha e iniciar sesión | Correcto |
| Reservar un lugar con DNI y número de socio | Mensaje de confirmación; el cupo baja de 20 a 19 |
| Reservar el mismo DNI otra vez | Error claro "Ese DNI ya está anotado en este viaje" (409) |
| Mis viajes → Cancelar lugar | Aparece la confirmación con el efecto sobre el dinero |
| Salir; ingresar como organizador; abrir Panel | Correcto |
| Abrir un viaje y pasar un pasajero a Señado | Toast "Pago actualizado"; recaudado = $ 5.000 (50% de $ 10.000) |
| Vista móvil (390 px) | Se ve y navega bien, sin scroll horizontal |

## 5. Hallazgos y límites conocidos
- El frontend no tiene pruebas automatizadas propias; su verificación es el recorrido de la sección 4 más `typecheck` y build. Es un buen siguiente paso (Vitest + Testing Library).
- Durante el desarrollo, el primer intento de correr la integración falló por un error del arnés (una cadena de conexión por socket Unix que `new URL` no entiende), no por una regla de negocio. Se corrigió el arnés, sin tocar la lógica.
- Las fuentes de Google no cargaron en el entorno de pruebas (sin salida a internet), por eso las capturas locales usan la tipografía de respaldo. En un navegador normal se usan Archivo y Public Sans.
- Los viajes `Finalizado` y `Cancelado` no se muestran en la portada pública, solo en el panel del organizador.

## 6. Prueba contra el entorno publicado _(pendiente: T15–T17)_
| Elemento | Valor |
|---|---|
| URL del frontend | _completar_ |
| URL de `/api/health` | _completar_ |
| Fecha y quién probó | _completar_ |
| Resultado del recorrido de la sección 4 en internet | _completar_ |
