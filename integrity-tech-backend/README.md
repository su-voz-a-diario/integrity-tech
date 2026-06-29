# Integrity-Tech | Platform API

## Visión del Proyecto
Integrity-Tech es un ecosistema SaaS diseñado para la gestión integral de evaluaciones de alto impacto. Nuestra arquitectura permite procesar desde pruebas psicométricas complejas y evaluaciones de integridad conductual hasta exámenes académicos estandarizados, garantizando siempre la máxima seguridad, integridad de datos y escalabilidad.

## Filosofía Técnica
- **Independencia de Contenido:** El motor de evaluación está diseñado para manejar cualquier tipo de reactivo, desde escalas de Likert para psicometría hasta pruebas de opción múltiple.
- **Arquitectura Robusta:** Sistema distribuido basado en Monolito Modular, permitiendo escalabilidad horizontal hacia microservicios.
- **Fiabilidad Académica/Corporativa:** Proctoring integrado, telemetría de eventos y trazabilidad inmutable de cambios (Auditoría).

## Pilares de Integridad
- **Ingesta Asíncrona:** Procesamiento en segundo plano mediante Redis/BullMQ para asegurar que ninguna respuesta se pierda ante picos de concurrencia.
- **Resiliencia Frontend:** Motor de sincronización offline (IndexedDB) para garantizar que la experiencia del usuario sea continua, incluso en condiciones de red inestables.
- **Interoperabilidad:** Cumplimiento con estándar LTI v1.3 para integración nativa con LMS y sistemas corporativos.

## Estructura de Módulos (Bounded Contexts)
- `iam`: Identidad, Roles y Permisos (RBAC para RRHH/Administradores).
- `organizations`: Multi-tenant (gestión de múltiples empresas/instituciones).
- `exams`: Banco de reactivos, modelos psicométricos y configuraciones de prueba.
- `evaluations`: Motor transaccional de respuestas y workers de análisis.
- `proctoring`: Telemetría de comportamiento y auditoría de integridad.
