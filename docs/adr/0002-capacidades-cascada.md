# ADR 0002: Capacidades en cascada

- **Estado**: aceptado (2026-11-01).
- **Contexto**: los permisos estaban dispersos en comprobaciones ad-hoc de rol
  por pantalla y por RPC; hacía falta una matriz única y verificable.
- **Decisión**: modelo de **capacidades en cascada**
  (`anónimo ⊂ cliente ⊂ comercial ⊂ admin`) con dos ejes: *capacidad*
  (`recurso:acción`) y *alcance* (`global | mi-comercial | mi-cartera |
  cliente-concreto`). La cascada hereda capacidades y estrecha el alcance,
  con excepciones explícitas (el admin no compra para sí). En la app:
  `src/shared/seguridad/capacidades.ts` + `use-permisos()` filtran navegación;
  los grupos de rutas `(publico)(carrito)(cliente)(comercial)(admin)` declaran
  su capacidad con `GuardRuta`; en backend, RLS/RPC siguen siendo la fuente de
  verdad. Ver `docs/ARQUITECTURA_ROLES.md` §4.
- **Consecuencias**: una capacidad nueva se añade en UN punto y se refleja en
  nav, rutas y UI; los RPCs de negocio validan rol + alcance (tests pgTAP de
  negativos: cliente→otro cliente, comercial→cliente ajeno).
