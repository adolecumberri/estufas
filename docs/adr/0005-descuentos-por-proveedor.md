# ADR 0005: Descuentos por proveedor

- **Estado**: aceptado (2026-11-01).
- **Contexto**: existían hasta cuatro niveles de descuento por cliente
  (general, por combustible, por producto y la promoción de tienda) y hacía
  falta el nivel "por proveedor" con la posibilidad de acotarlo a categorías.
  Además, el admin había perdido la capacidad de gestionar descuentos de
  clientes de comerciales y no había trazabilidad de quién cambiaba qué.
- **Decisión**:
  1. Gana el descuento **más preciso**, aunque su % sea menor:
     **producto > categoría > proveedor > general**.
  2. "Categoría" = tabla `categorias` + `producto_categoria`, **acotadas al
     proveedor del producto** (la misma categoría en otro proveedor no
     aplica).
  3. **No se acumulan**: solo se aplica un nivel; el 0 % específico también
     sustituye.
  4. El nivel "combustible" (0006) queda **retirado** de la cadena (la tabla
     se conserva como legacy por datos históricos).
  5. Las promociones de tienda se mantienen como **último recurso**: ganan
     solo si su % es mayor que el descuento elegido.
  6. El **admin recupera la escritura** de descuentos en clientes de
     comerciales, y **cada cambio queda auditado** en
     `descuentos_historial` con el actor real (`auth.uid()`) y su rol.
- **Consecuencias**: migraciones 0024 (tablas `descuentos_cliente_proveedor`
  y `descuentos_cliente_categoria` + `descuentos_historial` + triggers + RLS),
  0025 (reescritura de `fn_calcular_precio` y `fn_descuentos_cuenta` +
  ampliación del CHECK de `descuento_origen`) y 0026 (RPCs
  `fn_upsert_descuento_{general,proveedor,categoria,producto}` y
  `fn_anular_descuento_{general,proveedor,categoria}` con alcance
  cliente-prohibido/comercial-cartera/admin-todo). Tests pgTAP 11
  (precedencia y auditoría) y test 06 reescrito al estado legacy. La UI
  gestiona estos descuentos en la ficha de cliente (admin con capacidad) y
  `precios.ts` replica la cadena en el cálculo offline.
