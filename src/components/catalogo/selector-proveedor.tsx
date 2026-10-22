import { Boxes, Flame, Flower } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView } from 'react-native';

import { Text } from '@/components/ui/text';
import { useProveedorActivo } from '@/contexts/proveedor-activo-context';
import { textoSobreProveedor, temaProveedor } from '@/lib/colores-proveedor';
import { useColoresIcono } from '@/lib/theme';
import { cn } from '@/lib/utils';

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
export function SelectorProveedor({ compacto = false }: { compacto?: boolean }) {
  const { proveedores, activo, setActivo } = useProveedorActivo();
  const colores = useColoresIcono();

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
    <ScrollView
      horizontal
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      className="px-4"
      contentContainerStyle={{ gap: 8 }}
    >
      {proveedores.map((p) => {
        const esActivo = activo?.id === p.id;
        const tema = temaProveedor(p.color);
        const colorTexto = textoSobreProveedor(p.color);
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityState={{ selected: esActivo }}
            onPress={() => setActivo(p.id)}
            className={cn(
              'flex-row items-center gap-1.5 rounded-[10px] px-3 py-1.5',
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
  );
}
