# Controlled Calibration Workflow

The service permits a forward transition only when the expected current state, accountable role, action summary, evidence reference, and unused request identifier are present.

| Current status | Action | Accountable role | Next status |
| --- | --- | --- | --- |
| `reading_logged` | `recordCalibration` | `instrumentation_technician` | `calibration_recorded` |
| `calibration_recorded` | `assessVariance` | `environmental_data_analyst` | `variance_assessed` |
| `variance_assessed` | `authorizeCorrection` | `air_quality_manager` | `correction_authorized` |
| `correction_authorized` | `closeCalibration` | `compliance_records_officer` | `closed` |

Each audit event retains the actor identity, actor role, request identifier, timestamp, summary, evidence reference, and controlled action detail. The initial reading event retains the full calibration input context.
