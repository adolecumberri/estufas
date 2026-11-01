# Estado por features

| Feature                                                      | Estado        | Docs                                           | Tests                                                     | Commits                   |
| ------------------------------------------------------------ | ------------- | ---------------------------------------------- | --------------------------------------------------------- | ------------------------- |
| Roles en cascada (capacidades, rutas, alcance, "Creado por") | ✅ Completado | `docs/ARQUITECTURA_ROLES.md`, ADR 0001/0002    | pgTAP `10_roles_cascada.sql` (11 asserts)                 | rama main (2026-11-01)    |
| Sistema de diseño (primitivas + tokens + auditoría)          | ✅ Completado | `docs/AUDITORIA_UI.md`, ADR 0004, AGENTS.md §4 | typecheck + lint                                          | rama main (2026-11-01)    |
| Reestructura por features (`src/shared` + `src/features`)    | ✅ Completado | ADR 0004, AGENTS.md §1                         | typecheck + lint                                          | rama main (2026-11-01)    |
| Descuentos por proveedor                                     | ✅ Completado | ADR 0005, `docs/BITACORA.md`                   | pgTAP `11_descuentos_proveedor.sql` (8) + `06` legacy (3) | 18eaf7a, 228f891, d98f535 |

Leyenda: ✅ cerrado y verificado · ⛔ pendiente de decisión/implementación.
