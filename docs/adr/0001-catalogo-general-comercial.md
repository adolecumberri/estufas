# ADR 0001: Catálogo General como comercial por defecto

- **Estado**: aceptado (2026-11-01).
- **Contexto**: el anónimo necesita ver un catálogo con proveedores, pero la
  visibilidad de proveedores está modelada por comercial
  (`comercial_proveedor`). Además, los clientes que se registran sin
  comercial asignado necesitaban un comercial para heredar proveedores.
- **Decisión**: el "Catálogo General" es un **comercial especial** marcado con
  `usuarios.es_catalogo_general = TRUE` (único por índice parcial, CHECK que
  solo `rol = 'comercial'` puede serlo). Sus proveedores habilitados son los
  que ve el anónimo. Al alta de un cliente sin `id_comercial`, un trigger lo
  asigna al comercial por defecto (`fn_comercial_defecto()`), y
  `fn_proveedores_visibles()` anónimo devuelve los proveedores de ese
  comercial. El flag solo lo gestiona el backend (postgres/service_role).
- **Consecuencias**: el comercial por defecto puede tener clientes reales y
  pedidos; su cartera es la del "catálogo general". El cliente hereda los
  proveedores de su comercial (no tiene proveedores propios). Ver
  migraciones 0020-0022 y `docs/ARQUITECTURA_ROLES.md` §2.
