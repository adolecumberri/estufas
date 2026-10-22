# Usuarios de prueba

Mapa de los usuarios del seed para probar los distintos roles y reglas de
visibilidad por proveedor. En desarrollo, usa la pantalla **Dev → Acceso
rápido** (enlace "Acceso rápido (dev)" en la pantalla de login) para cambiar de
usuario con un toque.

## Resumen de roles y visibilidad

| Usuario | Contraseña | Rol | Proveedores visibles | Notas / qué probar |
|---|---|---|---|---|
| (anónimo) | — | anónimo | **Todos** (Eider, Fansa y estufas) | Navega el catálogo completo, busca, fichas. Sin carrito, sin botones Añadir, sin navbar inferior (solo login). |
| `admin@estufas.local` | `Admin123!` | admin | Todos + gestión | Admin → Proveedores (asignar/desasignar/habilitar proveedores por comercial), productos, cartera de todos, pedidos de todos. |
| `comercial@estufas.local` | `Comercial123!` | comercial | Eider + estufas (p1, p2) | Comercial original. Cartera con `cliente@` y `empresa@` asignados. |
| `fansa@estufas.local` | `ComercialFansa123!` | comercial | **Solo Fansa** | Verifica que NO ve Eider ni estufas. |
| `ambos@estufas.local` | `ComercialAmbos123!` | comercial | Fansa + Eider | Verifica que ve los dos catálogos nuevos. |
| `cliente@estufas.local` | `Cliente123!` | cliente (particular) | Lo que tenga habilitado su comercial (2222) | Pedidos propios, carrito, descuentos. |
| `empresa@estufas.local` | `Empresa123!` | cliente (empresa) | Idem comercial 2222 | Descuento general 10% + específico 0% en LP-9 + promo 5% (prueba de precedencia). |
| `suelto@estufas.local` | `Suelto123!` | cliente **sin comercial** | **Catálogo vacío** (todos los productos tienen proveedor) | Ficha → "Producto no disponible"; pedido con proveedor → "El cliente no tiene comercial asignado". |

## Comerciales ↔ proveedores (seed)

- `2222` (Comercial Prueba): Estufas Norte S.L., Calor Hogar S.L., Eider Biomasa
- `6666` (Comercial Fansa): Fansa
- `7777` (Comercial Ambos): Fansa, Eider Biomasa

El admin puede cambiar estas asignaciones en **Admin → Proveedores** (asignar,
desasignar, habilitar/deshabilitar por comercial).

## Reglas de oro a probar

1. **Visibilidad por proveedor**: un cliente solo ve productos de proveedores
   habilitados para SU comercial. Anónimo y admin ven todo.
2. **Sin mezcla de proveedores**: un carrito no admite productos de dos
   proveedores (aviso ámbar en catálogo/solicitud; el servidor rechaza al
   guardar).
3. **Precios por transporte**: ficha → tarjeta "Precios por transporte"
   (Camión/Palet/Franquicia). Fansa no los trae (solo precio base = tarifa).
4. **Datos técnicos flexibles**: ficha → grupos JSONB (Datos generales,
   Dimensiones, Logística, Datos adicionales de origen).
5. **Descuentos por precedencia**: por-producto > por-combustible > general >
   promo de tienda (el 0% específico sustituye al general).
6. **Carrito aislado por cuenta y por cliente**: cambiar de usuario no mezcla
   borradores; el comercial tiene un borrador por cliente.
7. **Placeholder**: productos sin foto (Fansa/Eider) muestran la imagen por
   defecto empaquetada.

## Cómo crear más usuarios de prueba

Regístrate desde la app: el registro público SIEMPRE crea clientes (migración
0010). Para comerciales/admin: Admin → gestión, o añade el perfil al seed
(`supabase/seed.sql`) siguiendo el patrón de los existentes y aplica con
`npx supabase db reset` (cuidado: borra los datos locales) o insertando la
sección a mano en la BD viva.
