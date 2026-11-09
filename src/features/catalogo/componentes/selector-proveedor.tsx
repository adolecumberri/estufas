import { Boxes, Flame, Flower } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView } from 'react-native';

import { Text } from '@/shared/ui/text';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useProveedorActivo } from '@/features/catalogo/proveedor-activo-contexto';
import { useSolicitud } from '@/features/carrito/contexto';
import { textoSobreProveedor, temaProveedor } from '@/shared/lib/colores-proveedor';
import { useColoresIcono } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';
import type { Proveedor } from '@/shared/lib/types';

// Icono lucide según el campo `icono` del proveedor (seed: 'flame'/'flower').
// Cualquier valor no reconocido cae en Flame.
function IconoProveedor({
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
// Cambiar de proveedor con el carrito no vacío abre un modal de confirmación
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
  const { lineas, vaciar, proveedorDelCarrito } = useSolicitud();
  const colores = useColoresIcono();
  // Id del proveedor cuyo cambio está pendiente de confirmación.
  const [pendiente, setPendiente] = React.useState<string | null>(null);

  const proveedores = listaExterna ?? contexto.proveedores;
  const activo = activoExterno ?? (contexto.activo?.id ?? null);

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

  const totalArticulos = lineas.reduce((acc, l) => acc + l.cantidad, 0);

  const pulsar = (id: string) => {
    // Mismo proveedor: no hay nada que hacer.
    if (activo === id) return;
    // Modo externo (catálogo de un comercial): cambio directo, sin carrito.
    if (onSeleccionar) {
      onSeleccionar(id);
      return;
    }
    // Carrito con artículos → confirmar antes (cambiar de proveedor lo vacía).
    if (lineas.length > 0) {
      setPendiente(id);
      return;
    }
    contexto.setActivo(id);
  };

  const confirmarCambio = () => {
    const id = pendiente;
    setPendiente(null);
    if (!id) return;
    vaciar();
    contexto.setActivo(id);
  };

  const nombreProveedorCarrito =
    proveedorDelCarrito?.nombre ?? contexto.activo?.nombre ?? 'este proveedor';

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
        visible={pendiente !== null}
        titulo="¿Cambiar de proveedor?"
        mensaje={`Tu carrito tiene ${totalArticulos} artículo${
          totalArticulos === 1 ? '' : 's'
        } de ${nombreProveedorCarrito}. Al cambiar se vaciará.`}
        textoConfirmar="Cambiar y vaciar"
        textoCancelar="Cancelar"
        onConfirmar={confirmarCambio}
        onCancelar={() => setPendiente(null)}
      />
    </>
  );
}
