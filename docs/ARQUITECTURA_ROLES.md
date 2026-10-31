# Arquitectura de roles y comportamiento en cascada

Documento de diseño. Decisiones cerradas con el usuario (31/10/2026).
Base para la corrección de procesos/arquitectura.

---

## 1. Modelo mental

Cuatro comportamientos, **en cascada** (`anónimo ⊂ cliente ⊂ comercial ⊂ admin`),
con dos ejes independientes:

- **Capacidades** (`recurso:acción`): qué puedes hacer.
- **Alcance** (`global | mi-comercial | mi-cartera | cliente-concreto`): sobre qué.

La cascada **hereda capacidades**; el alcance **se estrecha** hacia abajo. Las
excepciones son explícitas (el admin hereda la *vista* del comercial, pero no la
operación de compra).

### Relación real de datos

```
anónimo ──ve──► Catálogo General = COMERCIAL POR DEFECTO + sus proveedores
cliente  ──tiene──► 1 comercial ──tiene──► 1..N proveedores
comercial ──tiene──► cartera de clientes ──tiene──► pedidos
admin    ──administra──► comerciales y proveedores (lectura total)
```

**No existe "proveedor del cliente"**: el cliente hereda los proveedores de su
comercial. Si su comercial tiene 1 proveedor → el cliente **no** puede cambiar de
proveedor (selector oculto). Si tiene varios → puede cambiar (con aviso si hay
carrito).

---

## 2. Catálogo General (comercial por defecto)

- Es un **comercial especial** (`usuarios.rol = 'comercial'` + flag
  `es_catalogo_general = TRUE`, único por índice parcial).
- Sus proveedores habilitados (`comercial_proveedor`) son los que ve el
  **anónimo** y el catálogo general del admin.
- **Asignación del comercial por defecto**: al registrarse o al entrar, si un
  `cliente` tiene `id_comercial IS NULL` → se le asigna el comercial por defecto.
- Consecuencia: "Catálogo General" = ese comercial; su cartera puede tener
  clientes reales (los que entran sin comercial) y sus pedidos.

## 3. Comportamientos

### 3.1 Anónimo
- Ve el **Catálogo General** (proveedores del comercial por defecto) y puede
  cambiar entre ellos.
- Puede **llenar carrito local** (sin sesión).
- Puede registrarse / iniciar sesión.

### 3.2 Cliente
- Ve **solo los proveedores de su comercial** (no el catálogo general).
- Selector de proveedor visible **solo si su comercial tiene >1 proveedor**.
- Ve su cuenta: datos, histórico de pedidos, solicitudes abiertas, carrito.
- No ve cartera ni datos de otros clientes.

### 3.3 Comercial
- Todo lo del cliente **para sí mismo** (carrito propio, pedidos propios).
- **Cartera**: sus clientes; puede abrir la ficha de cada uno (info, historial,
  descuentos) y **abrirle una solicitud/pedido** (carrito del cliente).
- Confirma pedidos de su cartera, gestiona descuentos.
- Cambia de proveedor entre los suyos.

> **No existe "comercial actuando como cliente"** (no hay suplantación): el
> comercial crea pedidos **para un cliente** desde la ficha de ese cliente.

### 3.4 Admin
- **No compra ni pide para sí mismo** (necesitaría otra cuenta) → excepción de
  cascada: `carrito:usar` y operaciones de pedido propias retiradas.
- **Sí puede** entrar en un comercial → ver su **cartera**, abrir un cliente y
  **abrirle una solicitud de pedido**.
- Ese pedido debe reflejar **quién lo creó**: `pedidos.creado_por` (ya existe)
  mostrará "Creado por: Admin <nombre>" en detalle e historial.
- Administra comerciales y proveedores.

---

## 4. Matriz de capacidades

| Capacidad | Anón | Cliente | Comercial | Admin |
|---|:--:|:--:|:--:|:--:|
| `catalogo:ver_general` | ✅ | ❌ | ❌ | ✅ (lectura) |
| `catalogo:ver_proveedores_propios` | — | ✅ | ✅ | ✅ (lectura) |
| `proveedor:cambiar` | ✅ (todos los del general) | ✅ (solo si >1) | ✅ (los suyos) | ✅ (lectura) |
| `carrito:usar` (propio) | ✅ local | ✅ | ✅ | ❌ |
| `pedidos:crear_propio` | ❌ | ✅ | ✅ | ❌ |
| `pedidos:crear_para_cliente` | ❌ | ❌ | ✅ (su cartera) | ✅ (desde ficha de cliente) |
| `pedidos:confirmar` | ❌ | ❌ | ✅ (su cartera) | ❌ |
| `cuenta:ver_propia` / histórico | ❌ | ✅ | ✅ | ✅ |
| `cartera:ver_clientes` | ❌ | ❌ | ✅ | ✅ (lectura) |
| `descuentos:gestionar` | ❌ | ❌ | ✅ | ❌ |
| `comerciales:gestionar` | ❌ | ❌ | ❌ | ✅ |
| `proveedores:gestionar` | ❌ | ❌ | ❌ | ✅ |
| `solo_lectura` (modo vista) | — | — | — | ✅ |

---

## 5. Carrito: reglas de fusión y proveedor

1. **Anónimo llena carrito** → al hacer login:
   - Si el cliente **ya tiene comercial** (distinto del de catálogo general) →
     **se vacía el carrito** + aviso ("Tu carrito era del catálogo general; tu
     comercial es otro").
   - Si **no tiene comercial** → se le asigna el **comercial por defecto** y el
     carrito **se conserva**.
2. **Cambio de proveedor con carrito no vacío** → **popup de aviso**.
   - Confirmar → vacía el carrito y cambia el proveedor.
   - Cancelar → se queda en el proveedor actual.
3. El carrito es **por cuenta** y, para pedidos por cliente, un **borrador por
   cliente** (ya implementado). No se mezclan proveedores en un pedido (servidor
   lo rechaza).

---

## 6. Seguridad en tres anillos

```
Anillo 1 — Backend (fuente de verdad): RLS + RPC por rol y alcance
Anillo 2 — Rutas (page-safe): cada grupo de rutas declara su capacidad
Anillo 3 — UI: nav y botones según capacidad; nunca sustituyen a 1
```

### Backend
- RLS: cliente solo sus filas; comercial solo su cartera; admin lectura total.
- RPC: toda escritura valida rol + alcance + datos. Tests pgTAP de **negativos**
  (cliente→otro cliente, comercial→cliente ajeno, admin→escritura de negocio).
- **Nuevo**: `pedidos.creado_por` ya existe; se guarda siempre el actor real
  (cliente, comercial o admin) y `comercial_id` = comercial del cliente.
- **Nuevo**: comercial por defecto (`es_catalogo_general`) + asignación
  automática; `fn_proveedores_visibles()` para anónimo devuelve los proveedores
  del comercial por defecto (no todos).
- **Nuevo**: RPC `fn_mi_alcance()` → { rol, comercial_id, es_catalogo_general,
  proveedores[] } para estandarizar la app.

### Rutas (page-safe)
Grupos de Expo Router con guard único por rama (el guard del grupo cubre a sus
hijas):

```
(publico)/    catalogo general, acceso, registro        → nadie / anónimo
(cliente)/    mi cuenta, mis pedidos, carrito           → cliente+
(comercial)/  cartera, cartera/[id], pedidos cartera    → comercial+
(admin)/      comerciales, comerciales/[id], proveedores→ admin
```

`GuardRuta exige="cap"` en el `_layout` de cada grupo; fallback = inicio del rol.

### "Cada llamada" verificada (app)
- `resolverClienteObjetivo(id)`: valida que el cliente esté en tu alcance
  (propio / mi cartera / cualquiera si admin en lectura). **Todos** los hooks de
  cartera/pedidos/descuentos lo usan; nunca leer el id de la URL a pelo.
- `supabaseSeguro.rpc()`: wrapper único que exige sesión, adjunta auth y traduce
  401/403 a redirect/aviso.

---

## 7. Cambios de esquema (migraciones 0020+)

| # | Cambio |
|---|---|
| 0020 | `usuarios.es_catalogo_general BOOLEAN DEFAULT FALSE` + índice único parcial; seed: marcar un comercial y asignarle los proveedores del catálogo general. |
| 0021 | `fn_asignar_comercial_defecto()` (y trigger en alta de cliente) + RPC `fn_mi_alcance()`. |
| 0022 | `fn_proveedores_visibles()`: anónimo → proveedores del comercial por defecto (en vez de "todos"). |
| 0023 | `crear_pedido`/`editar_pedido`: guardar `creado_por` = actor real; `comercial_id` = comercial del cliente; permitir admin crear para cliente (sin carrito propio). |
| 0024 | Tests pgTAP de negativos de alcance + catálogo general + atribución de creador. |

## 8. Cambios de app (fases)

| Fase | Contenido |
|---|---|
| **1** | `src/lib/permisos.ts` (mapa + cascada + excepciones) y `usePermisos()`; nav inferior/lateral filtrado por capacidad (sin tocar rutas). |
| **2** | Reestructura a grupos `(publico|cliente|comercial|admin)` + `GuardRuta` + fallbacks; eliminar redirects ad-hoc por pantalla. |
| **3** | `alcance.ts` + `supabaseSeguro` en hooks; selector de proveedor visible según nº de proveedores del comercial; popup de cambio de proveedor con carrito. |
| **4** | Regla de carrito en login (vaciar/asignar por defecto) con aviso; "Creado por" en pedidos; vista admin de comercial/cliente en solo lectura + abrir solicitud. |

## 9. Pendiente de confirmar (menor)

- Texto/tono del popup de cambio de proveedor y del aviso de carrito vaciado.
- ¿El comercial por defecto se ve en `/admin/comerciales` como uno más? (Sí,
  marcado "Catálogo General".)
- ¿Puede un cliente pertenecer al comercial por defecto y luego ser reasignado
  a otro comercial? (Sí; al reasignarse, su carrito borrador se vacía.)
