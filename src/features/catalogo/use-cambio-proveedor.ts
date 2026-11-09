import * as React from 'react';

import { useProveedorActivo } from '@/features/catalogo/proveedor-activo-contexto';
import { useSolicitud } from '@/features/carrito/contexto';

// Cambio de proveedor con confirmación cuando el carrito no está vacío
// (ARQUITECTURA_ROLES.md §5.2): pulsar un proveedor distinto con artículos
// abre el diálogo; confirmar vacía el carrito y cambia; cancelar no toca
// nada. Compartido entre el selector del cuerpo y el del menú lateral para
// que ambos disparen el MISMO flujo.
export function useCambioProveedor() {
  const { activo, setActivo } = useProveedorActivo();
  const { lineas, vaciar, proveedorDelCarrito } = useSolicitud();
  // Id del proveedor cuyo cambio está pendiente de confirmación.
  const [pendiente, setPendiente] = React.useState<string | null>(null);

  const totalArticulos = lineas.reduce((acc, l) => acc + l.cantidad, 0);

  const pulsar = (id: string) => {
    // Mismo proveedor: no hay nada que hacer.
    if (activo?.id === id) return;
    // Carrito con artículos → confirmar antes (cambiar de proveedor lo vacía).
    if (lineas.length > 0) {
      setPendiente(id);
      return;
    }
    setActivo(id);
  };

  const confirmarCambio = () => {
    const id = pendiente;
    setPendiente(null);
    if (!id) return;
    vaciar();
    setActivo(id);
  };

  const cancelar = () => setPendiente(null);

  return {
    pendiente,
    pulsar,
    confirmarCambio,
    cancelar,
    totalArticulos,
    nombreProveedorCarrito: proveedorDelCarrito?.nombre ?? activo?.nombre ?? 'este proveedor',
  };
}
