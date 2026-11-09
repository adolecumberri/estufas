# Requisitos — ficha de cliente (desde Admin → Comercial → cliente)

Feedback del usuario (10/11/2026). Origen: revisión de `/admin/comerciales/[id]`
y de la ficha `/cartera/[id]` en su objetivo real: **ver al cliente y abrirle un
pedido**.

## A. Lista de clientes del comercial (`/admin/comerciales/[id]`)

1. El objetivo principal es abrir la ficha de un cliente para pedirle. Debe
   quedar claro y accesible.
2. Mostrar nombre y email; **botón para copiar el email** (copiar al portapapeles
   con confirmación visual).
3. Los chips `#0 productos` / `#0 combustibles` son **ambiguos**: no parece que
   representen descuentos. Sustituir por un resumen legible, p. ej.:
   - "Sin descuentos"
   - "3 descuentos · proveedor + categoría + producto"
4. Cabecera de "Descuentos" y **descuento general** visible junto al nombre.
   Al lado del **proveedor con descuento**, mostrar el número de reglas de ese
   proveedor.

## B. Ficha del cliente (`/cartera/[id]`)

5. **Nombre duplicado**: ya aparece en la cabecera de navegación y otra vez en el
   cuerpo. En el cuerpo no repetir; empezar por lo accionable.
6. "**Tarifa Profesional**" no se entiende: eliminar o sustituir por el tipo de
   cliente real (`particular` / `empresa`) como badge explicado, o quitarlo.
7. "**Crear pedido para este cliente**" es el **CTA principal**: debe estar
   destacado arriba (botón primario visible), no como segundo dato del cuerpo.
8. **Descuento general**: debe ser un **valor editable** (input numérico libre),
   no chips cerrados de 5/10/15/20.
9. **Descuentos por proveedor**: los proveedores deben ser **pestañas**
   (tabs), y **cada proveedor tiene su propia rama**:
   - descuento general de ese proveedor,
   - descuentos **por categoría de ese proveedor** (hoy se muestran categorías
     que no corresponden y no cambian al cambiar de proveedor — bug),
   - descuentos **por producto de ese proveedor**.
   Al cambiar de pestaña deben cambiar las categorías y los productos mostrados.

## C. Datos necesarios (backend/app)

- Categorías **por proveedor**: derivar de los productos del proveedor
  (`producto_categoria` ⋈ `productos` por `proveedor_id`), deduplicadas.
- Productos **por proveedor** para el buscador de la sección de producto.
- Precedencia vigente: producto > categoría (del proveedor del producto) >
  proveedor > general; sin acumular; el más preciso gana aunque el % sea menor.
- Auditoría: cada cambio registra actor y rol (`descuentos_historial`).

## D. Navegación (pendiente EGM)

- Menús superior e inferior no se relevan; desaparecen en Admin; no hay acceso
  al usuario dentro del flujo admin → se resuelve en el brainstorm de navegación
  (`docs/egm/`), no aquí.
