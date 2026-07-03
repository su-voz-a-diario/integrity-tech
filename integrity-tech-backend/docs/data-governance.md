# Data Governance & Compliance Foundation

## Objetivo

Esta fase prepara Integrity Test para gobernar datos sensibles durante su ciclo de vida sin ejecutar borrados automáticos ni agregar funciones comerciales.

## Arquitectura

- `RetentionPolicy`: política por organización y tipo de dato.
- `DataLifecycleRecord`: estado de ciclo de vida por recurso lógico.
- `DataExportJob`: exportación estructurada JSON de candidato, intento, reporte o auditoría.
- `DataDeletionRequest` y `DataDeletionItem`: solicitud trazable de eliminación, con planeación previa y revisión.
- `CriticalAssetVersion`: versionado de consentimiento, plantillas, reglas interpretativas y baremos.
- `BackupRecoveryEvent`: registro técnico de respaldos, restauraciones e integridad.

## Estados de ciclo de vida

- `ACTIVE`: dato vigente y operable.
- `ARCHIVED`: dato fuera de operación diaria, retenido por política.
- `DELETED`: dato marcado para eliminación lógica o minimización.
- `PURGED`: eliminación definitiva registrada. La ejecución física queda fuera de esta fase.

## Clasificación de datos

| Tipo | Clasificación | Motivo |
| --- | --- | --- |
| `CANDIDATE` | `HIGHLY_SENSITIVE` | Identidad y datos personales de candidato. |
| `ATTEMPT` | `HIGHLY_SENSITIVE` | Estado, conducta, respuestas y metadatos del examen. |
| `REPORT` | `HIGHLY_SENSITIVE` | Resultados psicométricos y recomendaciones. |
| `SNAPSHOT` | `HIGHLY_SENSITIVE` | Evidencia visual o biométrica potencial. |
| `PROCTORING_EVENT` | `HIGHLY_SENSITIVE` | Señales de monitoreo y riesgo conductual. |
| `CONSENT` | `HIGHLY_SENSITIVE` | Consentimiento legal y trazabilidad de aceptación. |
| `SESSION` | `CONFIDENTIAL` | Hash de refresh token, IP, user agent y expiración. |
| `AUDIT` | `CONFIDENTIAL` | Bitácora de acceso y acciones sensibles. |
| `ORGANIZATION` | `CONFIDENTIAL` | Datos tenant, cuenta y configuración empresarial. |

## Políticas iniciales

Las políticas por defecto están en `src/modules/data-governance/data-classification.registry.ts`.

Estas políticas no borran datos automáticamente. Solo permiten evaluar candidatos a archivo, eliminación lógica o purga.

## Exportación

`DataExportService` construye payloads JSON estructurados y tenant-aware:

- candidato
- intento
- reporte
- auditoría por recurso

No genera PDFs ni ZIPs físicos en esta fase.

## Eliminación controlada

`DataDeletionService` crea solicitudes y planes de impacto. No ejecuta borrado físico. Toda solicitud queda trazada en auditoría.

La ejecución definitiva requiere una fase posterior con:

- aprobación dual
- legal hold
- borrado físico por storage
- verificación de backups
- evidencia de purga

## Versionado de activos críticos

`CriticalAssetVersionService` calcula hash SHA-256 del payload y guarda versión de:

- consentimiento
- plantillas de reporte
- reglas interpretativas
- baremos

No cambia el motor psicométrico actual.

## Backups y recuperación

`BackupRecoveryService` registra eventos de backup/restauración/integridad. No provisiona cloud ni ejecuta snapshots.

Controles mínimos futuros:

- backups cifrados
- restauración probada
- hash de integridad
- runbook por tenant
- separación de credenciales

## Riesgos pendientes

- No hay ejecución automática de retención.
- No hay borrado físico real.
- No hay storage privado versionado para snapshots.
- No hay legal hold operacional completo.
- No hay DPIA, DPA, SCCs, ni documentación normativa formal.
- No hay workflow de aprobación dual.
