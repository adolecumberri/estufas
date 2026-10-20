// ============================================================================
// Constantes globales de la aplicación.
// Regla del proyecto: TODA constante que pueda repetirse vive aquí.
// ============================================================================

export const APP = {
  nombre: 'Estufas',
  slug: 'estufas',
  version: '0.1.0',
  idioma: 'es-ES',
} as const;

export const SUPABASE = {
  // Local: supabase start. En producción: variables de entorno EXPO_PUBLIC_*.
  url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  anonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    // Clave anon del stack local de Supabase (pública, solo desarrollo).
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
} as const;

export const ROLES = {
  cliente: { etiqueta: 'Cliente' },
  comercial: { etiqueta: 'Comercial' },
  admin: { etiqueta: 'Administrador' },
} as const;

export type Rol = keyof typeof ROLES;

export const TIPOS_CLIENTE = {
  particular: { etiqueta: 'Particular' },
  empresa: { etiqueta: 'Empresa' },
} as const;

export type TipoCliente = keyof typeof TIPOS_CLIENTE;

export const ESTADOS_PEDIDO = {
  solicitado: { etiqueta: 'Solicitado' },
  confirmado: { etiqueta: 'Confirmado' },
  en_preparacion: { etiqueta: 'En preparación' },
  completado: { etiqueta: 'Completado' },
  cancelado: { etiqueta: 'Cancelado' },
} as const;

export type EstadoPedido = keyof typeof ESTADOS_PEDIDO;

export const ORIGENES_DESCUENTO = {
  ninguno: { etiqueta: 'Sin descuento' },
  cliente_general: { etiqueta: 'Descuento de cliente' },
  cliente_producto: { etiqueta: 'Descuento específico' },
  promocion_tienda: { etiqueta: 'Promoción de tienda' },
  ajuste_comercial: { etiqueta: 'Ajuste comercial' },
} as const;

export type OrigenDescuento = keyof typeof ORIGENES_DESCUENTO;

export const MONEDA = {
  codigo: 'EUR',
  locale: 'es-ES',
} as const;

export const PAGINACION = {
  catalogo: 24,
  pedidos: 20,
} as const;

export const LIMITES = {
  maxCantidadLinea: 999,
  precioMaximo: 1_000_000,
} as const;

export const STORAGE_KEYS = {
  solicitud: 'estufas.solicitud', // líneas de la solicitud en curso
} as const;

export const RUTAS = {
  catalogo: '/catalogo',
  login: '/acceso',
  registro: '/registro',
  pedidos: '/pedidos',
  cartera: '/cartera',
  admin: '/admin',
} as const;

export const IVA_MVP = 0; // SUPUESTO MVP: fiscal pendiente de decisión (PRD §14-4)

export const AUTH_ERRORS: Record<string, string> = {
  'User already registered': 'Ya existe una cuenta con ese email.',
  'Invalid login credentials': 'Email o contraseña incorrectos.',
  'Password should be at least 6 characters.': 'La contraseña debe tener al menos 6 caracteres.',
  'Email not confirmed': 'Confirma tu email antes de continuar.',
} as const;

export const ERROR_GENERICO = 'Ha ocurrido un error. Inténtalo de nuevo.';

