# decisiones.md

| Tema | Pregunta | Decisión |
|---|---|---|
| Stack | ¿Qué tecnologías usar? | React + TypeScript + Vite, Express + TypeScript y PostgreSQL (como CanchaYa y como recomienda la cátedra). |
| Arquitectura | ¿Cómo se organiza el backend? | Se mantiene la arquitectura de los TP previos: Routes → Controller → Service → Repository. Las reglas puras van en `business/`. |
| Cupo | ¿Cómo evitar sobreventa si dos personas se anotan a la vez? | Bloqueo de la fila del viaje (`FOR UPDATE`) dentro de una transacción + trigger en PostgreSQL que revalida el cupo. |
| DNI | ¿Qué se valida del DNI? | 7 u 8 dígitos; único por viaje entre pasajeros activos (índice único parcial). |
| Estados de viaje | ¿Cuáles existen? | Abierto, Completo, En Viaje, Finalizado, Cancelado. Abierto↔Completo es automático según cupo. |
| Estados de pago | ¿Cuáles existen? | Pendiente, Señado, Pagado (valores heredados de los TP previos). |
| Seña | ¿Cuánto es la seña? | Si el organizador no informa monto, 50% del precio. Debe ser mayor a 0 y menor al precio. |
| Quién registra pagos | ¿El hincha puede marcar que pagó? | No. Se anota siempre como Pendiente; solo el organizador registra pagos. |
| Cierre de inscripción | ¿Hasta cuándo se puede anotar? | Hincha: hasta 3 h antes de la salida. Organizador: hasta la salida. |
| Cancelación | ¿Hasta cuándo puede bajarse un hincha y qué pasa con lo pagado? | Hasta 6 h antes. Con 24 h o más: reintegro total de lo abonado. Entre 24 h y 6 h: se retiene lo abonado. Menos de 6 h: no se puede online. |
| Límites por persona | ¿Cuántos lugares puede tomar un hincha? | Máximo 4 lugares activos por viaje (él + 3 acompañantes) y 3 viajes futuros activos. |
| Mismo día | ¿Puede un DNI estar en dos viajes el mismo día? | No (día calendario de Argentina). |
| Viaje cancelado | ¿Qué pasa con los pasajeros? | Todos pasan a CANCELADO con reintegro total de lo abonado. |
| Roles | ¿Cómo se crea un organizador? | Nunca por registro público: se promueve con `npm run create-admin -w backend` o SQL. |
| Autenticación | ¿Cómo autenticar? | Contraseña con hash bcrypt y token JWT (7 días). En producción `JWT_SECRET` es obligatorio. |
| Identificadores | ¿IDs numéricos o UUID? | UUID, para mantener el formato de los TP previos (`db.json`). |
| Zona horaria | ¿Cómo evitar errores de hora entre servidor y navegador? | Se guarda UTC; las reglas de día/hora convierten explícitamente a UTC-3. Las fechas sin zona que llegan a la API se interpretan como horario argentino. |
| Tests | ¿Cómo probar contra PostgreSQL real? | Tests de integración con `TEST_DATABASE_URL`; sin esa variable se omiten (con aviso). En GitHub Actions corren siempre contra un Postgres de servicio. |
| Publicación | ¿Dónde desplegar? | Netlify (frontend), Render (backend) y Neon (PostgreSQL). |
