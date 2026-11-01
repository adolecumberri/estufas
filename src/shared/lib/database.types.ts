export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      auditoria: {
        Row: {
          accion: string;
          datos_anteriores: Json | null;
          datos_nuevos: Json | null;
          fecha: string;
          id: number;
          ip: unknown;
          realizado_por: string | null;
          registro_id: string;
          tabla: string;
        };
        ComputedFields: never;
        Insert: {
          accion: string;
          datos_anteriores?: Json | null;
          datos_nuevos?: Json | null;
          fecha?: string;
          id?: never;
          ip?: unknown;
          realizado_por?: string | null;
          registro_id: string;
          tabla: string;
        };
        Update: {
          accion?: string;
          datos_anteriores?: Json | null;
          datos_nuevos?: Json | null;
          fecha?: string;
          id?: never;
          ip?: unknown;
          realizado_por?: string | null;
          registro_id?: string;
          tabla?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'auditoria_realizado_por_fkey';
            columns: ['realizado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      caracteristica_tipo_producto: {
        Row: {
          borrado: boolean;
          caracteristica_id: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          obligatoria: boolean;
          tipo_producto_id: string;
        };
        ComputedFields: never;
        Insert: {
          borrado?: boolean;
          caracteristica_id: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          obligatoria?: boolean;
          tipo_producto_id: string;
        };
        Update: {
          borrado?: boolean;
          caracteristica_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          obligatoria?: boolean;
          tipo_producto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'caracteristica_tipo_producto_caracteristica_id_fkey';
            columns: ['caracteristica_id'];
            isOneToOne: false;
            referencedRelation: 'caracteristicas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'caracteristica_tipo_producto_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'caracteristica_tipo_producto_tipo_producto_id_fkey';
            columns: ['tipo_producto_id'];
            isOneToOne: false;
            referencedRelation: 'tipos_producto';
            referencedColumns: ['id'];
          },
        ];
      };
      caracteristicas: {
        Row: {
          activo: boolean;
          borrado: boolean;
          clave: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          descripcion: string | null;
          grupo: string;
          icono_recurso_id: string | null;
          id: string;
          nombre: string;
          orden: number;
          tipo_dato: Database['public']['Enums']['tipo_dato_caracteristica'];
          unidad: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          borrado?: boolean;
          clave: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          grupo?: string;
          icono_recurso_id?: string | null;
          id?: string;
          nombre: string;
          orden?: number;
          tipo_dato: Database['public']['Enums']['tipo_dato_caracteristica'];
          unidad?: string | null;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          borrado?: boolean;
          clave?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          grupo?: string;
          icono_recurso_id?: string | null;
          id?: string;
          nombre?: string;
          orden?: number;
          tipo_dato?: Database['public']['Enums']['tipo_dato_caracteristica'];
          unidad?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'caracteristicas_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'caracteristicas_icono_recurso_id_fkey';
            columns: ['icono_recurso_id'];
            isOneToOne: false;
            referencedRelation: 'recursos';
            referencedColumns: ['id'];
          },
        ];
      };
      catalogo_version: {
        Row: {
          actualizado_en: string;
          id: number;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          actualizado_en?: string;
          id?: number;
          version?: number;
        };
        Update: {
          actualizado_en?: string;
          id?: number;
          version?: number;
        };
        Relationships: [];
      };
      categorias: {
        Row: {
          activo: boolean;
          borrado: boolean;
          clave: string;
          combustible: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          descripcion: string | null;
          grupo: string;
          id: string;
          nombre: string;
          orden: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          borrado?: boolean;
          clave: string;
          combustible?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          grupo: string;
          id?: string;
          nombre: string;
          orden?: number;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          borrado?: boolean;
          clave?: string;
          combustible?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          grupo?: string;
          id?: string;
          nombre?: string;
          orden?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categorias_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      comercial_proveedor: {
        Row: {
          comercial_id: string;
          creado_por: string | null;
          created_at: string;
          habilitado: boolean;
          id: string;
          proveedor_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          comercial_id: string;
          creado_por?: string | null;
          created_at?: string;
          habilitado?: boolean;
          id?: string;
          proveedor_id: string;
          updated_at?: string;
        };
        Update: {
          comercial_id?: string;
          creado_por?: string | null;
          created_at?: string;
          habilitado?: boolean;
          id?: string;
          proveedor_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comercial_proveedor_comercial_id_fkey';
            columns: ['comercial_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comercial_proveedor_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comercial_proveedor_proveedor_id_fkey';
            columns: ['proveedor_id'];
            isOneToOne: false;
            referencedRelation: 'proveedores';
            referencedColumns: ['id'];
          },
        ];
      };
      descuentos_cliente_categoria: {
        Row: {
          actualizado_at: string;
          actualizado_por: string | null;
          borrado: boolean;
          categoria_id: string;
          cliente_id: string;
          creado_at: string;
          creado_por: string | null;
          deleted_at: string | null;
          descuento_porcentaje: number;
          id: string;
          proveedor_id: string;
        };
        ComputedFields: never;
        Insert: {
          actualizado_at?: string;
          actualizado_por?: string | null;
          borrado?: boolean;
          categoria_id: string;
          cliente_id: string;
          creado_at?: string;
          creado_por?: string | null;
          deleted_at?: string | null;
          descuento_porcentaje: number;
          id?: string;
          proveedor_id: string;
        };
        Update: {
          actualizado_at?: string;
          actualizado_por?: string | null;
          borrado?: boolean;
          categoria_id?: string;
          cliente_id?: string;
          creado_at?: string;
          creado_por?: string | null;
          deleted_at?: string | null;
          descuento_porcentaje?: number;
          id?: string;
          proveedor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'descuentos_cliente_categoria_actualizado_por_fkey';
            columns: ['actualizado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_categoria_categoria_id_fkey';
            columns: ['categoria_id'];
            isOneToOne: false;
            referencedRelation: 'categorias';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_categoria_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_categoria_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_categoria_proveedor_id_fkey';
            columns: ['proveedor_id'];
            isOneToOne: false;
            referencedRelation: 'proveedores';
            referencedColumns: ['id'];
          },
        ];
      };
      descuentos_cliente_combustible: {
        Row: {
          borrado: boolean;
          cliente_id: string;
          combustible: string;
          creado_por: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          descuento_porcentaje: number;
          fecha_fin: string | null;
          fecha_inicio: string;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          borrado?: boolean;
          cliente_id: string;
          combustible: string;
          creado_por?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descuento_porcentaje: number;
          fecha_fin?: string | null;
          fecha_inicio?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          borrado?: boolean;
          cliente_id?: string;
          combustible?: string;
          creado_por?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descuento_porcentaje?: number;
          fecha_fin?: string | null;
          fecha_inicio?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'descuentos_cliente_combustible_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_combustible_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_combustible_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      descuentos_cliente_producto: {
        Row: {
          borrado: boolean;
          cliente_id: string;
          creado_por: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          descuento_porcentaje: number;
          fecha_fin: string | null;
          fecha_inicio: string;
          id: string;
          producto_id: string;
        };
        ComputedFields: never;
        Insert: {
          borrado?: boolean;
          cliente_id: string;
          creado_por?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descuento_porcentaje: number;
          fecha_fin?: string | null;
          fecha_inicio?: string;
          id?: string;
          producto_id: string;
        };
        Update: {
          borrado?: boolean;
          cliente_id?: string;
          creado_por?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descuento_porcentaje?: number;
          fecha_fin?: string | null;
          fecha_inicio?: string;
          id?: string;
          producto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'descuentos_cliente_producto_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_producto_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_producto_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_producto_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'productos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_producto_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'v_productos_precio_vigente';
            referencedColumns: ['producto_id'];
          },
        ];
      };
      descuentos_cliente_proveedor: {
        Row: {
          actualizado_at: string;
          actualizado_por: string | null;
          borrado: boolean;
          cliente_id: string;
          creado_at: string;
          creado_por: string | null;
          deleted_at: string | null;
          descuento_porcentaje: number;
          id: string;
          proveedor_id: string;
        };
        ComputedFields: never;
        Insert: {
          actualizado_at?: string;
          actualizado_por?: string | null;
          borrado?: boolean;
          cliente_id: string;
          creado_at?: string;
          creado_por?: string | null;
          deleted_at?: string | null;
          descuento_porcentaje: number;
          id?: string;
          proveedor_id: string;
        };
        Update: {
          actualizado_at?: string;
          actualizado_por?: string | null;
          borrado?: boolean;
          cliente_id?: string;
          creado_at?: string;
          creado_por?: string | null;
          deleted_at?: string | null;
          descuento_porcentaje?: number;
          id?: string;
          proveedor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'descuentos_cliente_proveedor_actualizado_por_fkey';
            columns: ['actualizado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_proveedor_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_proveedor_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_proveedor_proveedor_id_fkey';
            columns: ['proveedor_id'];
            isOneToOne: false;
            referencedRelation: 'proveedores';
            referencedColumns: ['id'];
          },
        ];
      };
      descuentos_historial: {
        Row: {
          accion: string;
          actor_id: string | null;
          actor_rol: Database['public']['Enums']['rol_usuario'] | null;
          categoria_id: string | null;
          cliente_id: string;
          created_at: string;
          descuento_porcentaje: number | null;
          id: number;
          nivel: string;
          producto_id: string | null;
          proveedor_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          accion: string;
          actor_id?: string | null;
          actor_rol?: Database['public']['Enums']['rol_usuario'] | null;
          categoria_id?: string | null;
          cliente_id: string;
          created_at?: string;
          descuento_porcentaje?: number | null;
          id?: number;
          nivel: string;
          producto_id?: string | null;
          proveedor_id?: string | null;
        };
        Update: {
          accion?: string;
          actor_id?: string | null;
          actor_rol?: Database['public']['Enums']['rol_usuario'] | null;
          categoria_id?: string | null;
          cliente_id?: string;
          created_at?: string;
          descuento_porcentaje?: number | null;
          id?: number;
          nivel?: string;
          producto_id?: string | null;
          proveedor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'descuentos_historial_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_historial_categoria_id_fkey';
            columns: ['categoria_id'];
            isOneToOne: false;
            referencedRelation: 'categorias';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_historial_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_historial_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'productos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_historial_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'v_productos_precio_vigente';
            referencedColumns: ['producto_id'];
          },
          {
            foreignKeyName: 'descuentos_historial_proveedor_id_fkey';
            columns: ['proveedor_id'];
            isOneToOne: false;
            referencedRelation: 'proveedores';
            referencedColumns: ['id'];
          },
        ];
      };
      marcas: {
        Row: {
          activo: boolean;
          borrado: boolean;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          descripcion: string | null;
          id: string;
          nombre: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          borrado?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          id?: string;
          nombre: string;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          borrado?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          id?: string;
          nombre?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'marcas_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      pedido_historial_estados: {
        Row: {
          cambiado_por: string | null;
          estado_anterior: Database['public']['Enums']['estado_pedido'] | null;
          estado_nuevo: Database['public']['Enums']['estado_pedido'];
          fecha_cambio: string;
          id: string;
          nota: string | null;
          pedido_id: string;
        };
        ComputedFields: never;
        Insert: {
          cambiado_por?: string | null;
          estado_anterior?: Database['public']['Enums']['estado_pedido'] | null;
          estado_nuevo: Database['public']['Enums']['estado_pedido'];
          fecha_cambio?: string;
          id?: string;
          nota?: string | null;
          pedido_id: string;
        };
        Update: {
          cambiado_por?: string | null;
          estado_anterior?: Database['public']['Enums']['estado_pedido'] | null;
          estado_nuevo?: Database['public']['Enums']['estado_pedido'];
          fecha_cambio?: string;
          id?: string;
          nota?: string | null;
          pedido_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pedido_historial_estados_cambiado_por_fkey';
            columns: ['cambiado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedido_historial_estados_pedido_id_fkey';
            columns: ['pedido_id'];
            isOneToOne: false;
            referencedRelation: 'pedidos';
            referencedColumns: ['id'];
          },
        ];
      };
      pedido_lineas: {
        Row: {
          base_imponible: number;
          borrado: boolean;
          cantidad: number;
          created_at: string;
          cuota_iva: number;
          deleted_at: string | null;
          deleted_by: string | null;
          descuento_importe: number;
          descuento_origen: string;
          descuento_porcentaje: number;
          id: string;
          iva_porcentaje: number;
          nombre_producto: string;
          pedido_id: string;
          precio_unitario: number;
          producto_id: string;
          referencia_producto: string;
          total_linea: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          base_imponible: number;
          borrado?: boolean;
          cantidad: number;
          created_at?: string;
          cuota_iva: number;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descuento_importe?: number;
          descuento_origen?: string;
          descuento_porcentaje?: number;
          id?: string;
          iva_porcentaje: number;
          nombre_producto: string;
          pedido_id: string;
          precio_unitario: number;
          producto_id: string;
          referencia_producto: string;
          total_linea: number;
          updated_at?: string;
        };
        Update: {
          base_imponible?: number;
          borrado?: boolean;
          cantidad?: number;
          created_at?: string;
          cuota_iva?: number;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descuento_importe?: number;
          descuento_origen?: string;
          descuento_porcentaje?: number;
          id?: string;
          iva_porcentaje?: number;
          nombre_producto?: string;
          pedido_id?: string;
          precio_unitario?: number;
          producto_id?: string;
          referencia_producto?: string;
          total_linea?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pedido_lineas_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedido_lineas_pedido_id_fkey';
            columns: ['pedido_id'];
            isOneToOne: false;
            referencedRelation: 'pedidos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedido_lineas_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'productos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedido_lineas_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'v_productos_precio_vigente';
            referencedColumns: ['producto_id'];
          },
        ];
      };
      pedidos: {
        Row: {
          borrado: boolean;
          cliente_id: string;
          comercial_id: string | null;
          creado_por: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          estado: Database['public']['Enums']['estado_pedido'];
          fecha_pedido: string;
          id: string;
          moneda: string;
          numero_pedido: number;
          observaciones: string | null;
          proveedor_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          borrado?: boolean;
          cliente_id: string;
          comercial_id?: string | null;
          creado_por: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          estado?: Database['public']['Enums']['estado_pedido'];
          fecha_pedido?: string;
          id?: string;
          moneda?: string;
          numero_pedido?: never;
          observaciones?: string | null;
          proveedor_id?: string | null;
          updated_at?: string;
        };
        Update: {
          borrado?: boolean;
          cliente_id?: string;
          comercial_id?: string | null;
          creado_por?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          estado?: Database['public']['Enums']['estado_pedido'];
          fecha_pedido?: string;
          id?: string;
          moneda?: string;
          numero_pedido?: never;
          observaciones?: string | null;
          proveedor_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pedidos_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedidos_comercial_id_fkey';
            columns: ['comercial_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedidos_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedidos_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pedidos_proveedor_id_fkey';
            columns: ['proveedor_id'];
            isOneToOne: false;
            referencedRelation: 'proveedores';
            referencedColumns: ['id'];
          },
        ];
      };
      producto_caracteristica: {
        Row: {
          borrado: boolean;
          caracteristica_id: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          producto_id: string;
          updated_at: string;
          valor_booleano: boolean | null;
          valor_numero: number | null;
          valor_texto: string | null;
        };
        ComputedFields: never;
        Insert: {
          borrado?: boolean;
          caracteristica_id: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          producto_id: string;
          updated_at?: string;
          valor_booleano?: boolean | null;
          valor_numero?: number | null;
          valor_texto?: string | null;
        };
        Update: {
          borrado?: boolean;
          caracteristica_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          producto_id?: string;
          updated_at?: string;
          valor_booleano?: boolean | null;
          valor_numero?: number | null;
          valor_texto?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'producto_caracteristica_caracteristica_id_fkey';
            columns: ['caracteristica_id'];
            isOneToOne: false;
            referencedRelation: 'caracteristicas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_caracteristica_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_caracteristica_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'productos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_caracteristica_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'v_productos_precio_vigente';
            referencedColumns: ['producto_id'];
          },
        ];
      };
      producto_categoria: {
        Row: {
          borrado: boolean;
          categoria_id: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          producto_id: string;
        };
        ComputedFields: never;
        Insert: {
          borrado?: boolean;
          categoria_id: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          producto_id: string;
        };
        Update: {
          borrado?: boolean;
          categoria_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          producto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'producto_categoria_categoria_id_fkey';
            columns: ['categoria_id'];
            isOneToOne: false;
            referencedRelation: 'categorias';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_categoria_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_categoria_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'productos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_categoria_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'v_productos_precio_vigente';
            referencedColumns: ['producto_id'];
          },
        ];
      };
      producto_precios: {
        Row: {
          borrado: boolean;
          creado_por: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          fecha_fin: string | null;
          fecha_inicio: string;
          id: string;
          moneda: string;
          precio: number;
          producto_id: string;
        };
        ComputedFields: never;
        Insert: {
          borrado?: boolean;
          creado_por?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          fecha_fin?: string | null;
          fecha_inicio?: string;
          id?: string;
          moneda?: string;
          precio: number;
          producto_id: string;
        };
        Update: {
          borrado?: boolean;
          creado_por?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          fecha_fin?: string | null;
          fecha_inicio?: string;
          id?: string;
          moneda?: string;
          precio?: number;
          producto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'producto_precios_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_precios_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_precios_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'productos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_precios_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'v_productos_precio_vigente';
            referencedColumns: ['producto_id'];
          },
        ];
      };
      producto_precios_transporte: {
        Row: {
          borrado: boolean;
          created_at: string;
          id: string;
          precio: number;
          producto_id: string;
          transporte: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          borrado?: boolean;
          created_at?: string;
          id?: string;
          precio: number;
          producto_id: string;
          transporte: string;
          updated_at?: string;
        };
        Update: {
          borrado?: boolean;
          created_at?: string;
          id?: string;
          precio?: number;
          producto_id?: string;
          transporte?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'producto_precios_transporte_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'productos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_precios_transporte_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'v_productos_precio_vigente';
            referencedColumns: ['producto_id'];
          },
        ];
      };
      producto_recurso: {
        Row: {
          borrado: boolean;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          orden: number;
          producto_id: string;
          recurso_id: string;
          tipo_en_producto: string;
        };
        ComputedFields: never;
        Insert: {
          borrado?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          orden?: number;
          producto_id: string;
          recurso_id: string;
          tipo_en_producto?: string;
        };
        Update: {
          borrado?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          orden?: number;
          producto_id?: string;
          recurso_id?: string;
          tipo_en_producto?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'producto_recurso_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_recurso_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'productos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_recurso_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'v_productos_precio_vigente';
            referencedColumns: ['producto_id'];
          },
          {
            foreignKeyName: 'producto_recurso_recurso_id_fkey';
            columns: ['recurso_id'];
            isOneToOne: false;
            referencedRelation: 'recursos';
            referencedColumns: ['id'];
          },
        ];
      };
      productos: {
        Row: {
          activo: boolean;
          borrado: boolean;
          created_at: string;
          datos: NonNullable<Json>;
          deleted_at: string | null;
          deleted_by: string | null;
          descripcion: string | null;
          destacado: boolean;
          etiqueta_energetica: string | null;
          id: string;
          imagen_plano_id: string | null;
          imagen_principal_id: string | null;
          marca_id: string | null;
          nombre: string;
          proveedor_id: string | null;
          referencia: string;
          slug: string | null;
          tipo_producto_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          borrado?: boolean;
          created_at?: string;
          datos?: NonNullable<Json>;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          destacado?: boolean;
          etiqueta_energetica?: string | null;
          id?: string;
          imagen_plano_id?: string | null;
          imagen_principal_id?: string | null;
          marca_id?: string | null;
          nombre: string;
          proveedor_id?: string | null;
          referencia: string;
          slug?: string | null;
          tipo_producto_id: string;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          borrado?: boolean;
          created_at?: string;
          datos?: NonNullable<Json>;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          destacado?: boolean;
          etiqueta_energetica?: string | null;
          id?: string;
          imagen_plano_id?: string | null;
          imagen_principal_id?: string | null;
          marca_id?: string | null;
          nombre?: string;
          proveedor_id?: string | null;
          referencia?: string;
          slug?: string | null;
          tipo_producto_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'productos_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'productos_imagen_plano_id_fkey';
            columns: ['imagen_plano_id'];
            isOneToOne: false;
            referencedRelation: 'recursos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'productos_imagen_principal_id_fkey';
            columns: ['imagen_principal_id'];
            isOneToOne: false;
            referencedRelation: 'recursos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'productos_marca_id_fkey';
            columns: ['marca_id'];
            isOneToOne: false;
            referencedRelation: 'marcas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'productos_proveedor_id_fkey';
            columns: ['proveedor_id'];
            isOneToOne: false;
            referencedRelation: 'proveedores';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'productos_tipo_producto_id_fkey';
            columns: ['tipo_producto_id'];
            isOneToOne: false;
            referencedRelation: 'tipos_producto';
            referencedColumns: ['id'];
          },
        ];
      };
      promociones_tienda: {
        Row: {
          activa: boolean;
          borrado: boolean;
          creado_por: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          descripcion: string | null;
          descuento_porcentaje: number;
          fecha_fin: string | null;
          fecha_inicio: string;
          id: string;
          nombre: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activa?: boolean;
          borrado?: boolean;
          creado_por?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          descuento_porcentaje: number;
          fecha_fin?: string | null;
          fecha_inicio?: string;
          id?: string;
          nombre: string;
          updated_at?: string;
        };
        Update: {
          activa?: boolean;
          borrado?: boolean;
          creado_por?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          descuento_porcentaje?: number;
          fecha_fin?: string | null;
          fecha_inicio?: string;
          id?: string;
          nombre?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'promociones_tienda_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'promociones_tienda_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      proveedores: {
        Row: {
          activo: boolean;
          borrado: boolean;
          color: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          email: string | null;
          icono: string | null;
          id: string;
          nif: string | null;
          nombre: string;
          telefono: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          borrado?: boolean;
          color?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          email?: string | null;
          icono?: string | null;
          id?: string;
          nif?: string | null;
          nombre: string;
          telefono?: string | null;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          borrado?: boolean;
          color?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          email?: string | null;
          icono?: string | null;
          id?: string;
          nif?: string | null;
          nombre?: string;
          telefono?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'proveedores_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      recursos: {
        Row: {
          activo: boolean;
          borrado: boolean;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          id: string;
          metadata: NonNullable<Json>;
          mime_type: string | null;
          nombre: string;
          tamano_bytes: number | null;
          texto_alternativo: string | null;
          tipo: Database['public']['Enums']['tipo_recurso'];
          updated_at: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          borrado?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          metadata?: NonNullable<Json>;
          mime_type?: string | null;
          nombre: string;
          tamano_bytes?: number | null;
          texto_alternativo?: string | null;
          tipo: Database['public']['Enums']['tipo_recurso'];
          updated_at?: string;
          url: string;
        };
        Update: {
          activo?: boolean;
          borrado?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          id?: string;
          metadata?: NonNullable<Json>;
          mime_type?: string | null;
          nombre?: string;
          tamano_bytes?: number | null;
          texto_alternativo?: string | null;
          tipo?: Database['public']['Enums']['tipo_recurso'];
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recursos_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      tipos_producto: {
        Row: {
          activo: boolean;
          borrado: boolean;
          clave: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          descripcion: string | null;
          id: string;
          nombre: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          borrado?: boolean;
          clave: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          id?: string;
          nombre: string;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          borrado?: boolean;
          clave?: string;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descripcion?: string | null;
          id?: string;
          nombre?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tipos_producto_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      usuarios: {
        Row: {
          activo: boolean;
          apellidos: string | null;
          borrado: boolean;
          ciudad_facturacion: string | null;
          codigo_postal_facturacion: string | null;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
          descuento_porcentaje: number;
          direccion_facturacion: string | null;
          email: string;
          es_catalogo_general: boolean;
          id: string;
          id_comercial: string | null;
          nif_cif: string | null;
          nombre: string;
          pais_facturacion: string;
          provincia_facturacion: string | null;
          razon_social: string | null;
          rol: Database['public']['Enums']['rol_usuario'];
          telefono: string | null;
          tipo_cliente: Database['public']['Enums']['tipo_cliente'] | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activo?: boolean;
          apellidos?: string | null;
          borrado?: boolean;
          ciudad_facturacion?: string | null;
          codigo_postal_facturacion?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descuento_porcentaje?: number;
          direccion_facturacion?: string | null;
          email: string;
          es_catalogo_general?: boolean;
          id: string;
          id_comercial?: string | null;
          nif_cif?: string | null;
          nombre: string;
          pais_facturacion?: string;
          provincia_facturacion?: string | null;
          razon_social?: string | null;
          rol?: Database['public']['Enums']['rol_usuario'];
          telefono?: string | null;
          tipo_cliente?: Database['public']['Enums']['tipo_cliente'] | null;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          apellidos?: string | null;
          borrado?: boolean;
          ciudad_facturacion?: string | null;
          codigo_postal_facturacion?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          descuento_porcentaje?: number;
          direccion_facturacion?: string | null;
          email?: string;
          es_catalogo_general?: boolean;
          id?: string;
          id_comercial?: string | null;
          nif_cif?: string | null;
          nombre?: string;
          pais_facturacion?: string;
          provincia_facturacion?: string | null;
          razon_social?: string | null;
          rol?: Database['public']['Enums']['rol_usuario'];
          telefono?: string | null;
          tipo_cliente?: Database['public']['Enums']['tipo_cliente'] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usuarios_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'usuarios_id_comercial_fkey';
            columns: ['id_comercial'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      v_descuentos_cliente_combustible_vigentes: {
        Row: {
          cliente_id: string;
          combustible: string;
          descuento_porcentaje: number;
          fecha_inicio: string;
        };
        ComputedFields: never;
        Insert: {
          cliente_id?: string | null;
          combustible?: string | null;
          descuento_porcentaje?: number | null;
          fecha_inicio?: string | null;
        };
        Update: {
          cliente_id?: string | null;
          combustible?: string | null;
          descuento_porcentaje?: number | null;
          fecha_inicio?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'descuentos_cliente_combustible_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      v_descuentos_cliente_producto_vigentes: {
        Row: {
          cliente_id: string;
          descuento_porcentaje: number;
          producto_id: string;
        };
        ComputedFields: never;
        Insert: {
          cliente_id?: string | null;
          descuento_porcentaje?: number | null;
          producto_id?: string | null;
        };
        Update: {
          cliente_id?: string | null;
          descuento_porcentaje?: number | null;
          producto_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'descuentos_cliente_producto_cliente_id_fkey';
            columns: ['cliente_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_producto_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'productos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'descuentos_cliente_producto_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'v_productos_precio_vigente';
            referencedColumns: ['producto_id'];
          },
        ];
      };
      v_precios_transporte: {
        Row: {
          camion: number | null;
          franquicia: number | null;
          palet: number | null;
          producto_id: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'producto_precios_transporte_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'productos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'producto_precios_transporte_producto_id_fkey';
            columns: ['producto_id'];
            isOneToOne: false;
            referencedRelation: 'v_productos_precio_vigente';
            referencedColumns: ['producto_id'];
          },
        ];
      };
      v_productos_precio_vigente: {
        Row: {
          descripcion: string | null;
          etiqueta_energetica: string | null;
          imagen_plano_id: string | null;
          imagen_principal_id: string | null;
          marca_id: string | null;
          moneda: string | null;
          nombre: string;
          precio: number | null;
          precio_fecha_inicio: string | null;
          producto_id: string;
          referencia: string;
          slug: string | null;
          tipo_producto_id: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: 'productos_imagen_plano_id_fkey';
            columns: ['imagen_plano_id'];
            isOneToOne: false;
            referencedRelation: 'recursos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'productos_imagen_principal_id_fkey';
            columns: ['imagen_principal_id'];
            isOneToOne: false;
            referencedRelation: 'recursos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'productos_marca_id_fkey';
            columns: ['marca_id'];
            isOneToOne: false;
            referencedRelation: 'marcas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'productos_tipo_producto_id_fkey';
            columns: ['tipo_producto_id'];
            isOneToOne: false;
            referencedRelation: 'tipos_producto';
            referencedColumns: ['id'];
          },
        ];
      };
      v_promociones_tienda_vigentes: {
        Row: {
          descripcion: string | null;
          descuento_porcentaje: number;
          fecha_fin: string | null;
          fecha_inicio: string;
          id: string;
          nombre: string;
        };
        ComputedFields: never;
        Insert: {
          descripcion?: string | null;
          descuento_porcentaje?: number | null;
          fecha_fin?: string | null;
          fecha_inicio?: string | null;
          id?: string | null;
          nombre?: string | null;
        };
        Update: {
          descripcion?: string | null;
          descuento_porcentaje?: number | null;
          fecha_fin?: string | null;
          fecha_inicio?: string | null;
          id?: string | null;
          nombre?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      actualizar_precio: { Args: { p_precio: number; p_producto: string }; Returns: undefined };
      actualizar_proveedor: {
        Args: {
          p_activo?: boolean;
          p_email?: string;
          p_nif?: string;
          p_nombre?: string;
          p_proveedor: string;
          p_telefono?: string;
        };
        Returns: undefined;
      };
      ajustar_descuento_linea: {
        Args: { p_descuento_pct: number; p_linea_id: string; p_nota?: string };
        Returns: undefined;
      };
      anular_descuento_cliente_combustible: {
        Args: { p_cliente_id: string; p_combustible: string };
        Returns: undefined;
      };
      anular_descuento_cliente_producto: {
        Args: { p_cliente_id: string; p_producto_id: string };
        Returns: undefined;
      };
      asignar_comercial: {
        Args: { p_cliente_id: string; p_comercial_id: string };
        Returns: undefined;
      };
      asignar_descuento_cliente: {
        Args: { p_cliente_id: string; p_descuento_pct: number };
        Returns: undefined;
      };
      asignar_descuento_cliente_combustible: {
        Args: {
          p_cliente_id: string;
          p_combustible: string;
          p_descuento_pct: number;
          p_fecha_fin?: string;
        };
        Returns: undefined;
      };
      asignar_descuento_cliente_producto: {
        Args: {
          p_cliente_id: string;
          p_descuento_pct: number;
          p_fecha_fin?: string;
          p_producto_id: string;
        };
        Returns: undefined;
      };
      asignar_proveedor_comercial: {
        Args: { p_comercial: string; p_proveedor: string };
        Returns: undefined;
      };
      avanzar_pedido: {
        Args: {
          p_estado: Database['public']['Enums']['estado_pedido'];
          p_nota?: string;
          p_pedido: string;
        };
        Returns: undefined;
      };
      cancelar_pedido: { Args: { p_nota?: string; p_pedido: string }; Returns: undefined };
      confirmar_pedido: { Args: { p_nota?: string; p_pedido: string }; Returns: undefined };
      crear_comercial: {
        Args: { p_apellidos?: string; p_email: string; p_nombre: string; p_password: string };
        Returns: string;
      };
      crear_pedido: {
        Args: { p_cliente_id?: string; p_lineas?: Json; p_observaciones?: string };
        Returns: {
          numero_pedido: number;
          pedido_id: string;
        }[];
      };
      crear_proveedor: {
        Args: { p_email?: string; p_nif?: string; p_nombre?: string; p_telefono?: string };
        Returns: string;
      };
      desasignar_proveedor_comercial: {
        Args: { p_comercial: string; p_proveedor: string };
        Returns: undefined;
      };
      editar_pedido: {
        Args: { p_lineas?: Json; p_observaciones?: string; p_pedido: string };
        Returns: undefined;
      };
      fn_anular_descuento_categoria: {
        Args: { p_categoria: string; p_cliente: string; p_proveedor: string };
        Returns: undefined;
      };
      fn_anular_descuento_general: { Args: { p_cliente: string }; Returns: undefined };
      fn_anular_descuento_proveedor: {
        Args: { p_cliente: string; p_proveedor: string };
        Returns: undefined;
      };
      fn_app_user_id: { Args: Record<PropertyKey, never>; Returns: string };
      fn_asignar_comercial_defecto: { Args: Record<PropertyKey, never>; Returns: string };
      fn_calcular_lineas: {
        Args: { p_cliente: string; p_lineas: Json };
        Returns: {
          base: number;
          cantidad: number;
          cuota: number;
          descuento_importe: number;
          descuento_origen: string;
          descuento_pct: number;
          iva_pct: number;
          nombre_producto: string;
          precio_unitario: number;
          producto_id: string;
          referencia_producto: string;
          total: number;
        }[];
      };
      fn_calcular_precio: {
        Args: { p_cliente?: string; p_producto: string };
        Returns: {
          descuento_origen: string;
          descuento_pct: number;
          precio_base: number;
          precio_final: number;
        }[];
      };
      fn_catalogo_snapshot: { Args: Record<PropertyKey, never>; Returns: Json };
      fn_catalogo_usuario: {
        Args: {
          p_busqueda?: string;
          p_categoria?: string;
          p_cliente?: string;
          p_limite?: number;
          p_marca?: string;
          p_offset?: number;
        };
        Returns: {
          categorias: string[];
          descripcion: string;
          descuento_origen: string;
          descuento_pct: number;
          destacado: boolean;
          etiqueta_energetica: string;
          imagen_url: string;
          marca: string;
          moneda: string;
          nombre: string;
          precio_base: number;
          precio_final: number;
          producto_id: string;
          referencia: string;
          slug: string;
          tipo: string;
        }[];
      };
      fn_catalogo_usuario_v2: {
        Args: {
          p_busqueda?: string;
          p_categoria?: string;
          p_cliente?: string;
          p_combustible?: string;
          p_limite?: number;
          p_marca?: string;
          p_offset?: number;
          p_proveedor?: string;
        };
        Returns: {
          categorias: string[];
          descripcion: string;
          descuento_origen: string;
          descuento_pct: number;
          destacado: boolean;
          etiqueta_energetica: string;
          imagen_url: string;
          marca: string;
          moneda: string;
          nombre: string;
          precio_base: number;
          precio_final: number;
          precios_transporte: Json;
          producto_id: string;
          proveedor_id: string;
          proveedor_nombre: string;
          referencia: string;
          slug: string;
          tipo: string;
        }[];
      };
      fn_catalogo_version: { Args: Record<PropertyKey, never>; Returns: number };
      fn_comercial_defecto: { Args: Record<PropertyKey, never>; Returns: string };
      fn_comercial_responsable: { Args: { p_cliente: string }; Returns: boolean };
      fn_descuentos_cuenta: { Args: { p_cliente?: string }; Returns: Json };
      fn_es_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      fn_es_comercial: { Args: Record<PropertyKey, never>; Returns: boolean };
      fn_hoy: { Args: Record<PropertyKey, never>; Returns: string };
      fn_pedido_detalle: {
        Args: { p_pedido: string };
        Returns: {
          borrado: boolean;
          cliente_id: string;
          comercial_id: string;
          creado_por: string;
          creado_por_nombre: string;
          creado_por_rol: Database['public']['Enums']['rol_usuario'];
          created_at: string;
          deleted_at: string;
          deleted_by: string;
          estado: Database['public']['Enums']['estado_pedido'];
          fecha_pedido: string;
          id: string;
          moneda: string;
          numero_pedido: number;
          observaciones: string;
          proveedor_id: string;
          updated_at: string;
        }[];
      };
      fn_producto_detalle: {
        Args: { p_cliente?: string; p_producto: string };
        Returns: {
          caracteristicas: Json;
          categorias: string[];
          datos: Json;
          descripcion: string;
          descuento_origen: string;
          descuento_pct: number;
          destacado: boolean;
          etiqueta_energetica: string;
          galeria: Json;
          imagen_url: string;
          marca: string;
          moneda: string;
          nombre: string;
          plano_url: string;
          precio_base: number;
          precio_final: number;
          precios_transporte: Json;
          producto_id: string;
          proveedor_id: string;
          proveedor_nombre: string;
          referencia: string;
          slug: string;
          tipo: string;
        }[];
      };
      fn_proveedores_visibles: {
        Args: Record<PropertyKey, never>;
        Returns: {
          color: string;
          icono: string;
          id: string;
          nombre: string;
        }[];
      };
      fn_rol_usuario: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Enums']['rol_usuario'];
      };
      fn_upsert_descuento_categoria: {
        Args: { p_categoria: string; p_cliente: string; p_porcentaje: number; p_proveedor: string };
        Returns: undefined;
      };
      fn_upsert_descuento_general: {
        Args: { p_cliente: string; p_porcentaje: number };
        Returns: undefined;
      };
      fn_upsert_descuento_producto: {
        Args: { p_cliente: string; p_porcentaje: number; p_producto: string };
        Returns: undefined;
      };
      fn_upsert_descuento_proveedor: {
        Args: { p_cliente: string; p_porcentaje: number; p_proveedor: string };
        Returns: undefined;
      };
      habilitar_proveedor_comercial: {
        Args: { p_comercial: string; p_habilitado: boolean; p_proveedor: string };
        Returns: undefined;
      };
      show_limit: { Args: Record<PropertyKey, never>; Returns: number };
      show_trgm: { Args: { '': string }; Returns: string[] };
    };
    Enums: {
      estado_pedido: 'solicitado' | 'confirmado' | 'en_preparacion' | 'completado' | 'cancelado';
      rol_usuario: 'cliente' | 'comercial' | 'admin';
      tipo_cliente: 'particular' | 'empresa';
      tipo_dato_caracteristica: 'texto' | 'numero' | 'booleano';
      tipo_recurso:
        'imagen' | 'plano' | 'ficha_tecnica' | 'icono_svg' | 'documento' | 'video' | 'otro';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_pedido: ['solicitado', 'confirmado', 'en_preparacion', 'completado', 'cancelado'],
      rol_usuario: ['cliente', 'comercial', 'admin'],
      tipo_cliente: ['particular', 'empresa'],
      tipo_dato_caracteristica: ['texto', 'numero', 'booleano'],
      tipo_recurso: ['imagen', 'plano', 'ficha_tecnica', 'icono_svg', 'documento', 'video', 'otro'],
    },
  },
} as const;
