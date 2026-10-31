// ============================================================================
// Fase 1 — Arquitectura de roles (docs/ARQUITECTURA_ROLES.md §1, §4 y §6):
// capacidades `recurso:accion` en cascada (anónimo ⊂ cliente ⊂ comercial ⊂
// admin). La UI (nav, botones) consulta estas capacidades; la autoridad real
// sigue en RLS/RPC (anillo 1).
//
// Importante: la cascada se aplica NIVEL A NIVEL (no como un simple spread),
// para que cada nivel pueda quitar capacidades heredadas y el siguiente
// volver a añadirlas. Ejemplo real: el catálogo general es cosa del anónimo
// (y del admin en lectura), pero un cliente/comercial NO lo ve; el admin lo
// recupera con `anade`.
// ============================================================================

export type Rol = 'anon' | 'cliente' | 'comercial' | 'admin';

export type Cap =
  | 'catalogo:ver_general'
  | 'catalogo:ver_proveedores_propios'
  | 'proveedor:cambiar'
  | 'carrito:usar'
  | 'pedidos:crear_propio'
  | 'pedidos:crear_para_cliente'
  | 'pedidos:confirmar'
  | 'cuenta:ver_propia'
  | 'cartera:ver_clientes'
  | 'descuentos:gestionar'
  | 'comerciales:gestionar'
  | 'proveedores:gestionar'
  | 'auth:login'
  | 'admin:acceder';

// Orden de la cascada (cada rol hereda del anterior).
const ORDEN: Rol[] = ['anon', 'cliente', 'comercial', 'admin'];

// Lo que aporta cada nivel a lo heredado.
const PROPIAS: Record<Rol, Cap[]> = {
  anon: [
    'catalogo:ver_general', // catálogo general = proveedores del comercial por defecto
    'proveedor:cambiar', // selector de proveedor del catálogo general
    'carrito:usar', // carrito local, sin sesión
    'auth:login',
  ],
  cliente: [
    'catalogo:ver_proveedores_propios', // los de SU comercial (no el general)
    'pedidos:crear_propio',
    'cuenta:ver_propia',
  ],
  comercial: [
    'pedidos:crear_para_cliente', // desde la ficha de un cliente de su cartera
    'pedidos:confirmar',
    'cartera:ver_clientes',
    'descuentos:gestionar',
  ],
  admin: ['comerciales:gestionar', 'proveedores:gestionar', 'admin:acceder'],
};

// Ajustes por nivel: `quita` = capacidades heredadas que este rol NO tiene;
// `anade` = capacidades que recupera (p. ej. el admin, el catálogo general).
const AJUSTES: Partial<Record<Rol, { quita?: Cap[]; anade?: Cap[] }>> = {
  cliente: {
    quita: ['catalogo:ver_general'], // el cliente no ve el catálogo general
  },
  admin: {
    // El admin no compra ni pide para sí mismo (usría necesitaría otra cuenta):
    quita: ['carrito:usar', 'pedidos:crear_propio', 'pedidos:confirmar', 'descuentos:gestionar'],
    // Pero SÍ ve todo en lectura, incluido el catálogo general.
    anade: ['catalogo:ver_general'],
  },
};

// Capacidades efectivas de un rol: se acumulan nivel a nivel aplicando
// `quita`/`anade`, sin duplicados. `puede()` y la UI usan esto.
export function capacidadesDe(rol: Rol): Cap[] {
  const hasta = ORDEN.indexOf(rol);
  if (hasta < 0) return [];
  const acumuladas = new Set<Cap>();
  for (const nivel of ORDEN.slice(0, hasta + 1)) {
    for (const cap of PROPIAS[nivel]) acumuladas.add(cap);
    const quita = AJUSTES[nivel]?.quita ?? [];
    for (const cap of quita) acumuladas.delete(cap);
    for (const cap of AJUSTES[nivel]?.anade ?? []) acumuladas.add(cap);
  }
  return Array.from(acumuladas);
}

// Mapa resultante por rol (útil para depurar y para los guardias de fase 2).
export const CASCADA: Record<Rol, Cap[]> = {
  anon: capacidadesDe('anon'),
  cliente: capacidadesDe('cliente'),
  comercial: capacidadesDe('comercial'),
  admin: capacidadesDe('admin'),
};

export function puede(rol: Rol, cap: Cap): boolean {
  return capacidadesDe(rol).includes(cap);
}

// Rol efectivo desde el perfil: null/undefined o rol desconocido → 'anon'
// (mínimo privilegio).
export function rolDesdePerfil(perfil: { rol: string } | null | undefined): Rol {
  if (!perfil) return 'anon';
  if (perfil.rol === 'cliente' || perfil.rol === 'comercial' || perfil.rol === 'admin') {
    return perfil.rol;
  }
  return 'anon';
}

// Pantalla de inicio de cada rol (fallback de los guards de fase 2).
export const INICIO_POR_ROL: Record<Rol, string> = {
  anon: '/',
  cliente: '/',
  comercial: '/cartera',
  admin: '/admin',
};
