import { Boxes, Flame, Flower } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView } from 'react-native';

import { Text } from '@/shared/ui/text';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useProveedorActivo } from '@/features/catalogo/proveedor-activo-contexto';
import { useCambioProveedor } from '@/features/catalogo/use-cambio-proveedor';
import { textoSobreProveedor, temaProveedor } from '@/shared/lib/colores-proveedor';
import { useColoresIcono } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import type { Proveedor } from '@/shared/lib/types';

// Icono lucide según el campo `icono` del proveedor (seed: 'flame'/'flower').
// Cualquier valor no reconocido cae en Flame. Exportado para reutilizarlo en
// el selector de proveedores del menú lateral.
export function IconoProveedor({
  icono,
  size,
  color,
}: {
  icono?: string | null;
  size: number;
  color: string;
}) {
  const Icono = icono === 'flower' ? Flower : icono === 'boxes' ? Boxes : Flame;
  return <Icono size={size} color={color} />;
}

// Selector visual del proveedor activo del catálogo: chips horizontales con
// el color de cada proveedor. Con un único proveedor no hay nada que elegir
// (no se renderiza; en modo compacto muestra una línea con su nombre).
//
// Cambiar de proveedor con el carrito no vacío abre un diálogo de confirmación
// (ARQUITECTURA_ROLES.md §5.2): confirmar vacía el carrito y cambia; cancelar
// se queda como está. Con el carrito vacío el cambio es directo. El anónimo
// ve la misma lista (los proveedores del catálogo general que devuelve
// fn_proveedores_visibles): no se oculta el selector por falta de sesión.
export function SelectorProveedor({
  compacto = false,
  proveedores: listaExterna,
  activo: activoExterno,
  onSeleccionar,
}: {
  compacto?: boolean;
  // Lista/activo/selección externos (catálogo acotado a un comercial vía
  // /catalogo?comercial=<id>): si vienen, sustituyen al contexto y el cambio
  // es directo, sin el diálogo de vaciar carrito (ese es del propio usuario).
  proveedores?: Proveedor[];
  activo?: string | null;
  onSeleccionar?: (id: string) => void;
}) {
  const contexto = useProveedorActivo();
  const cambio = useCambioProveedor();
  const colores = useColoresIcono();

  const proveedores = listaExterna ?? contexto.proveedores;
  const activo = activoExterno ?? contexto.activo?.id ?? null;

  // Modo externo (catálogo de un comercial): cambio directo, sin carrito.
  const pulsar = onSeleccionar
    ? (id: string) => {
        if (activo === id) return;
        onSeleccionar(id);
      }
    : cambio.pulsar;

  if (proveedores.length <= 1) {
    if (compacto && proveedores.length === 1) {
      return (
        <Text className="px-4 text-xs text-muted-foreground">
          Proveedor: {proveedores[0].nombre}
        </Text>
      );
    }
    return null;
  }

  return (
    <>
      <ScrollView
        horizontal
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        className="px-4"
        contentContainerStyle={{ gap: 8 }}
      >
        {proveedores.map((p) => {
          const esActivo = activo === p.id;
          const tema = temaProveedor(p.color);
          const colorTexto = textoSobreProveedor(p.color);
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityState={{ selected: esActivo }}
              onPress={() => pulsar(p.id)}
              className={cn(
                'flex-row items-center gap-1.5 rounded-lg px-3 py-1.5',
                !esActivo && 'bg-muted'
              )}
              style={esActivo ? { backgroundColor: tema.base } : undefined}
            >
              <IconoProveedor
                icono={p.icono}
                size={16}
                color={esActivo ? colorTexto : colores.tenue}
              />
              <Text
                className={cn('text-xs font-medium', !esActivo && 'text-muted-foreground')}
                style={esActivo ? { color: colorTexto } : undefined}
              >
                {p.nombre}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Diálogo: confirmar cambio de proveedor con carrito no vacío */}
      <ConfirmDialog
        visible={cambio.pendiente !== null}
        titulo="¿Cambiar de proveedor?"
        mensaje={`Tu carrito tiene ${cambio.totalArticulos} artículo${
          cambio.totalArticulos === 1 ? '' : 's'
        } de ${cambio.nombreProveedorCarrito}. Al cambiar se vaciará.`}
        textoConfirmar="Cambiar y vaciar"
        textoCancelar="Cancelar"
        onConfirmar={cambio.confirmarCambio}
        onCancelar={cambio.cancelar}
      />
    </>
  );
}
