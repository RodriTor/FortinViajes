# spec.md — Especificación funcional

## Objetivo
Permitir que una peña publique traslados a los partidos de Vélez y que los hinchas se anoten de forma segura, mientras el organizador controla cupos, pasajeros y pagos sin errores.

## Usuarios y roles
- **Visitante:** consulta viajes y cupos disponibles.
- **Hincha (USER):** se registra, inicia sesión, anota lugares (propio y de acompañantes) y cancela los lugares que anotó él.
- **Organizador (ADMIN):** crea viajes, cambia su estado, administra pasajeros, registra pagos y ve el resumen económico.

## Alcance
Catálogo de viajes, autenticación, inscripción, cancelación con reintegro, panel del organizador, reglas de cupo/estado/pago y persistencia. Pagos online, notificaciones y lista de espera quedan fuera del MVP.

## Reglas de negocio

### Cupo y pasajeros
- **RN1 — Capacidad:** un viaje no puede tener más pasajeros **activos** que su capacidad. Se garantiza en PostgreSQL (bloqueo de fila + trigger) para cubrir solicitudes simultáneas. Los pasajeros cancelados no ocupan cupo.
- **RN2 — Datos del pasajero:** nombre obligatorio (2 a 100 caracteres); DNI de 7 u 8 dígitos; teléfono opcional (6 a 20 caracteres: dígitos, espacios, `+`, `-`, paréntesis); número de socio opcional (hasta 10 dígitos).
- **RN3 — DNI único por viaje:** el mismo DNI no puede estar activo dos veces en el mismo viaje. Se garantiza con un índice único parcial en la base.
- **RN4 — Estados de pago:** los valores válidos son `Pendiente`, `Señado` y `Pagado`. Monto abonado: Pendiente = 0; Pagado = precio completo; Señado = monto de la seña. La seña debe ser mayor a 0 y menor al precio del pasaje; si no se informa, es el 50% del precio. Una seña igual al precio debe registrarse como Pagado.
- **RN5 — Quién registra pagos:** un hincha se anota siempre como `Pendiente`; solo el organizador puede informar o modificar el estado de pago y la seña.

### Estados del viaje
- **RN6 — Estados y transiciones:** los estados son `Abierto`, `Completo`, `En Viaje`, `Finalizado` y `Cancelado`.
  - `Abierto` ↔ `Completo` es automático: al ocuparse el último lugar pasa a Completo; al liberarse un lugar vuelve a Abierto.
  - El organizador puede pasar un viaje `Abierto`/`Completo` a `En Viaje` (requiere al menos un pasajero activo) o a `Cancelado`; y `En Viaje` a `Finalizado`.
  - `Finalizado` y `Cancelado` son definitivos. No se puede fijar manualmente `Abierto` ni `Completo`.
  - Al cancelar un viaje, todos sus pasajeros activos pasan a CANCELADO con reintegro total de lo abonado.
  - No se pueden agregar ni cancelar pasajeros en viajes `En Viaje`, `Finalizado` o `Cancelado` (ni agregar en uno `Completo`).
- **RN7 — Creación de viaje:** rival y estadio obligatorios; fecha y hora de salida válidas y futuras; capacidad entera entre 1 y 100; precio numérico mayor o igual a 0; punto de encuentro opcional; competición (hasta 80 caracteres) y horario del partido opcionales, y si se informa el horario del partido debe ser posterior a la salida del micro. Solo el organizador crea viajes. El viaje nace `Abierto`.

### Inscripción y cancelación
- **RN8 — Cierre de inscripción:** un hincha puede anotarse hasta 3 horas antes de la salida (inclusive). El organizador puede anotar pasajeros hasta el momento de la salida.
- **RN9 — Cancelación y reintegro:** un hincha puede cancelar solo los lugares que anotó él.
  - Faltan 24 h o más: reintegro del 100% de lo abonado.
  - Faltan menos de 24 h y 6 h o más: **se retiene** lo abonado (reintegro 0).
  - Faltan menos de 6 h: no puede cancelar desde la app (debe contactar al organizador).
  - El organizador puede cancelar a cualquier pasajero activo (mientras el viaje no esté En Viaje/Finalizado/Cancelado) y siempre con reintegro total.
- **RN10 — Límites por persona:** un hincha no puede tener más de 4 lugares activos en un mismo viaje (él + 3 acompañantes) ni lugares activos en más de 3 viajes futuros a la vez. El límite no aplica al organizador.
- **RN11 — Un viaje por día:** el mismo DNI no puede estar activo en dos viajes cuya salida caiga en el mismo día calendario de Argentina.

### Resumen, seguridad y datos
- **RN12 — Autorización y privacidad:** solo un usuario autenticado puede anotarse; el hincha solo ve y cancela sus propios lugares; solo el organizador ve la lista de pasajeros (con DNI y teléfono), registra pagos, cambia estados y ve montos. El rol ADMIN nunca se asigna por el registro público.
- **RN13 — Búsqueda de pasajeros:** el organizador puede filtrar la lista por nombre, DNI o número de socio (sin distinguir mayúsculas).
- **RN14 — Zona horaria:** las fechas se guardan en UTC. Las reglas que dependen de la hora o del día usan horario argentino (UTC-3). Una fecha sin zona horaria enviada a la API se interpreta como horario argentino.
- **RN15 — Resumen económico:** para cada viaje el organizador ve cupos ocupados y disponibles, total recaudado (suma de lo abonado por los pasajeros activos), total pendiente (precio × activos − recaudado), total retenido y total reintegrado (de pasajeros cancelados), y si el viaje está lleno.
- **RN16 — Integridad:** el viaje, el pasajero y el usuario deben existir; los identificadores son UUID; los montos no pueden ser negativos; el servidor ignora cualquier precio, rol o monto calculable enviado por el cliente.

## Historias de usuario

### HU1 — Explorar viajes
Como visitante quiero ver los próximos viajes para elegir a cuál sumarme.
- Dado que ingreso al sitio, cuando se carga el listado, entonces veo rival, estadio, fecha y hora, punto de encuentro, precio, estado y cupos disponibles.
- Dado que escribo un rival en el buscador, cuando filtro, entonces solo veo viajes de ese rival.
- Dado un viaje Completo, cuando lo miro, entonces aparece como completo y no ofrece anotarse.

### HU2 — Crear una cuenta e ingresar
Como visitante quiero registrarme para poder anotarme.
- Dado un nombre, email válido y contraseña de al menos 8 caracteres, cuando envío el formulario, entonces se crea la cuenta con rol USER y recibo una sesión.
- Dado un email ya registrado, cuando intento registrarme, entonces recibo un conflicto (409) y no se duplica la cuenta.
- Dadas credenciales incorrectas, cuando ingreso, entonces recibo 401.

### HU3 — Anotarme en un viaje (RN1, RN2, RN3, RN8, RN10, RN11)
Como hincha quiero reservar un lugar para mí o para un acompañante.
- Dados datos válidos y cupo disponible, cuando confirmo, entonces el lugar queda anotado como Pendiente.
- Dado un DNI ya anotado en el viaje, cuando intento anotarlo, entonces recibo 409.
- Dado un micro completo, cuando intento anotarme, entonces recibo 409.
- Dado que faltan menos de 3 h para la salida, cuando intento anotarme, entonces recibo 409.
- Dado que ya tengo 4 lugares en el viaje o 3 viajes futuros activos, cuando intento anotarme, entonces recibo 409.

### HU4 — Ver y cancelar mis lugares (RN9, RN12)
Como hincha quiero ver mis lugares y cancelarlos si no puedo ir.
- Dado que tengo sesión, cuando abro Mis viajes, entonces veo únicamente los lugares que anoté yo.
- Dado que faltan 24 h o más, cuando cancelo, entonces el lugar queda CANCELADO y se reintegra lo abonado.
- Dado que faltan entre 6 y 24 h, cuando cancelo, entonces se cancela y se retiene lo abonado; la pantalla me lo advierte antes de confirmar.
- Dado que faltan menos de 6 h, cuando intento cancelar, entonces recibo 409.
- Dado un lugar de otra persona, cuando intento cancelarlo, entonces recibo 404.

### HU5 — Crear y administrar viajes (RN6, RN7)
Como organizador quiero publicar viajes y controlar su estado.
- Dados datos válidos, cuando creo el viaje, entonces queda Abierto.
- Dado que soy USER, cuando intento crear un viaje, entonces recibo 403.
- Dado un viaje con pasajeros, cuando lo paso a En Viaje, entonces ya no admite altas ni bajas.
- Dado un viaje que cancelo, cuando confirmo, entonces todos sus pasajeros quedan CANCELADOS con reintegro total.

### HU6 — Gestionar pasajeros y pagos (RN4, RN5, RN13, RN15)
Como organizador quiero ver la lista, buscar, anotar manualmente y registrar pagos.
- Dado un viaje, cuando abro su panel, entonces veo el resumen (cupos, recaudado, pendiente) y la lista de pasajeros.
- Dado un texto de búsqueda, cuando filtro, entonces veo solo pasajeros cuyo nombre, DNI o socio coincide.
- Dado un pasajero Pendiente, cuando registro una seña válida, entonces pasa a Señado y el resumen se actualiza.
- Dada una seña mayor al precio, cuando la envío, entonces recibo 400.

## Casos borde
- Dos personas se anotan en el último lugar al mismo tiempo: solo una lo logra.
- El mismo DNI se envía dos veces en simultáneo: solo una alta prospera.
- Cancelar con 24 h exactas (reintegro) y con 23 h 59 min (retención).
- Cancelar con 6 h exactas (permitido) y 5 h 59 min (rechazado).
- Anotarse con 3 h exactas (permitido) y 2 h 59 min (rechazado).
- Cancelar un lugar en un viaje Completo reabre el viaje.
- Seña igual al precio o igual a 0.
- Un DNI con letras, de 6 o de 9 dígitos.
- La sesión JWT venció o el token es inválido.
- Un USER intenta enviar `paymentStatus: "Pagado"` al anotarse.
- La base de datos no responde (error 500 genérico, sin filtrar detalles).

## Pendientes
No hay pendientes bloqueantes para el MVP. Las decisiones comerciales están en `preguntas-abiertas.md`.
