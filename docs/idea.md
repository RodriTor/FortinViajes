# idea.md — FortínViajes

## Problema
Las peñas de Vélez organizan traslados en micro hacia el estadio (local y visitante). Hoy el armado se hace por WhatsApp y planillas: se anota gente de más, se repiten DNI, nadie sabe a ciencia cierta quién pagó la seña, y cuando alguien se baja no hay una regla clara de qué pasa con la plata. El organizador pierde horas ordenando todo y el hincha no sabe si realmente tiene lugar.

## Solución
FortínViajes es una aplicación web para publicar traslados a los partidos, anotarse con un lugar y gestionar la lista de pasajeros y los pagos. El sistema administra las reglas de **cupo**, **cierre de inscripción**, **DNI únicos**, **límites por persona**, **estados de pago**, **política de cancelación y reintegro** y **resumen económico** del viaje.

## Usuarios
- **Visitante**: ve los próximos viajes y sus cupos disponibles.
- **Hincha** (usuario registrado): se anota (a sí mismo y a acompañantes), ve y cancela sus lugares.
- **Organizador** (administrador de la peña): crea viajes, administra pasajeros, registra pagos, cambia el estado del viaje y ve el resumen económico.

## Alcance del MVP
Incluye: catálogo de viajes, registro/ingreso, inscripción con validaciones, mis viajes, cancelación con política de reintegro, panel del organizador (crear viaje, lista de pasajeros con búsqueda, registrar pagos, cambiar estado, resumen), persistencia en PostgreSQL.
No incluye: pagos online, notificaciones por email/WhatsApp, lista de espera, múltiples peñas con cuentas independientes, asignación de asientos.

## Supuestos iniciales
- Moneda: pesos argentinos (ARS).
- Zona horaria operativa: `America/Argentina/Buenos_Aires` (UTC-3, sin horario de verano).
- El precio del pasaje lo fija el organizador para cada viaje.
- El pago se registra manualmente por el organizador (efectivo/transferencia); la app no cobra.
- Un viaje = un micro = una capacidad fija.

## Origen
Evolución del backend de los TP anteriores (gestión de traslados con `Routes → Controller → Service → Repository` y la función pura `calculateTripSummary`), ahora con usuarios, roles, base de datos real, frontend completo y publicación en internet.
