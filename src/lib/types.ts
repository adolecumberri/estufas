import type { EstadoPedido, OrigenDescuento, Rol, TipoCliente } from '@/constants';

export type { EstadoPedido, OrigenDescuento, Rol, TipoCliente };

// ---------------------------------------------------------------------------
// Tipos de dominio (coinciden con las funciones RPC y las tablas de Postgres).
// ---------------------------------------------------------------------------

export interface ProductoCatalogo {
  producto_id: string;
  referencia: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  marca: string | null;
  tipo: string | null;
  categorias: string[];
  etiqueta_energetica: string | null;
  destacado: boolean;
  precio_base: number;
  precio_final: number;
  descuento_pct: number;
  descuento_origen: OrigenDescuento;
  moneda: string;
  imagen_url: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  precios_transporte: {
    camion: number | null;
    palet: number | null;
    franquicia: number | null;
  } | null;
}

export interface ValorCaracteristica {
  clave: string;
  nombre: string;
  unidad: string | null;
  grupo: string;
  orden: number;
  valor: string | number | boolean;
}

export interface ItemGaleria {
  url: string;
  alt: string | null;
  tipo: string;
  orden: number;
}

export interface ProductoDetalle extends ProductoCatalogo {
  plano_url: string | null;
  caracteristicas: ValorCaracteristica[];
  galeria: ItemGaleria[];
  // Datos técnicos flexibles (JSONB productos.datos): grupos con filas.
  datos: GrupoDatos[];
}

export interface FilaDato {
  clave: string;
  nombre: string;
  valor: string | number | boolean | null;
  unidad: string | null;
}

export interface GrupoDatos {
  grupo: string;
  filas: FilaDato[];
}

export interface LineaPedido {
  id: string;
  pedido_id: string;
  producto_id: string;
  referencia_producto: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  descuento_porcentaje: number;
  descuento_origen: OrigenDescuento;
  descuento_importe: number;
  iva_porcentaje: number;
  base_imponible: number;
  cuota_iva: number;
  total_linea: number;
  proveedor_id?: string | null;
  proveedor_nombre?: string | null;
}

export interface Pedido {
  id: string;
  numero_pedido: number;
  cliente_id: string;
  creado_por: string;
  comercial_id: string | null;
  estado: EstadoPedido;
  fecha_pedido: string;
  observaciones: string | null;
  moneda: string;
  proveedor_id: string | null;
  proveedor?: { nombre: string } | null;
  pedido_lineas?: LineaPedido[];
  cliente?: PerfilUsuario;
}

export interface HistorialEstado {
  id: string;
  pedido_id: string;
  estado_anterior: EstadoPedido | null;
  estado_nuevo: EstadoPedido;
  cambiado_por: string | null;
  fecha_cambio: string;
  nota: string | null;
}

export interface PerfilUsuario {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  telefono: string | null;
  rol: Rol;
  tipo_cliente: TipoCliente | null;
  razon_social: string | null;
  nif_cif: string | null;
  id_comercial: string | null;
  descuento_porcentaje: number;
  activo: boolean;
}

export interface Promocion {
  id: string;
  nombre: string;
  descripcion: string | null;
  descuento_porcentaje: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  activa: boolean;
}

export interface DescuentoClienteProducto {
  id: string;
  cliente_id: string;
  producto_id: string;
  descuento_porcentaje: number;
  fecha_inicio: string;
  fecha_fin: string | null;
}

export interface DescuentoClienteCombustible {
  id: string;
  cliente_id: string;
  combustible: Combustible;
  descuento_porcentaje: number;
  fecha_inicio: string;
  fecha_fin: string | null;
}

export interface Proveedor {
  id: string;
  nombre: string;
  nif: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
}

export interface ComercialProveedor {
  id: string;
  comercial_id: string;
  proveedor_id: string;
  habilitado: boolean;
}

// Línea que el usuario añade a la solicitud en curso (antes de crearse).
export interface Categoria {
  id: string;
  nombre: string;
  clave: string;
  grupo: string;
  orden: number;
  combustible: 'pellets' | 'lena' | null;
}

export type Combustible = 'pellets' | 'lena';

export interface Marca {
  id: string;
  nombre: string;
}

export interface LineaSolicitud {
  producto_id: string;
  referencia: string;
  nombre: string;
  cantidad: number;
  precio_base: number;
  precio_final: number;
  descuento_pct: number;
  descuento_origen: OrigenDescuento;
  imagen_url: string | null;
  // Proveedor del producto: opcionales para no romper los borradores
  // persistidos antes de esta versión (sin información de proveedor).
  proveedor_id?: string | null;
  proveedor_nombre?: string | null;
}

// ---------------------------------------------------------------------------
// Catálogo local (SQLite): contrato de los RPC fn_catalogo_snapshot y
// fn_descuentos_cuenta del backend. Se consumen tal cual llegan del servidor.
// ---------------------------------------------------------------------------

export interface ProductoSnapshot {
  producto_id: string;
  referencia: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  tipo: string | null;
  marca_id: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  activo: boolean;
  destacado: boolean;
  etiqueta_energetica: string | null;
  imagen_url: string | null;
  plano_url: string | null;
  precio_base: number;
  precios_transporte: {
    camion: number | null;
    palet: number | null;
    franquicia: number | null;
  } | null;
  // Claves ('pellets' | 'lena') e IDs de categorías a los que pertenece.
  combustibles: string[];
  categorias: string[];
  // Datos técnicos flexibles (JSONB productos.datos).
  datos: GrupoDatos[];
  // Galería (misma forma que fn_producto_detalle). Opcional: los snapshots
  // de la versión anterior no la traían.
  galeria?: { url: string; alt: string | null; tipo: string | null; orden: number | null }[];
}

export interface SnapshotCatalogo {
  version: number;
  categorias: Categoria[];
  marcas: Marca[];
  proveedores: { id: string; nombre: string }[];
  productos: ProductoSnapshot[];
}

export interface DescuentosCuenta {
  cliente_id: string | null;
  general_pct: number | null;
  productos: { producto_id: string; pct: number }[];
  combustibles: { combustible: string; pct: number }[];
  promo_pct: number | null;
  proveedores_habilitados: string[];
}
