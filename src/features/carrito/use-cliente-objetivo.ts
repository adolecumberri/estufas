import * as React from 'react';

import { useSolicitud } from '@/features/carrito/contexto';
import { supabase } from '@/shared/lib/supabase';

// Nombre visible del cliente objetivo del carrito (razón social o nombre +
// apellidos), resuelto con una lectura única al cambiar de cliente. Alimenta
// el copy "Pedido para <nombre>" de /solicitud y del banner del catálogo.
export function useClienteObjetivoNombre(): string | null {
  const { clienteObjetivoId } = useSolicitud();
  const [nombre, setNombre] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelado = false;
    setNombre(null);
    if (!clienteObjetivoId) return;
    void (async () => {
      const { data } = await supabase
        .from('usuarios')
        .select('nombre,apellidos,razon_social')
        .eq('id', clienteObjetivoId)
        .maybeSingle();
      if (cancelado) return;
      const c = data as {
        nombre: string;
        apellidos: string | null;
        razon_social: string | null;
      } | null;
      setNombre(c ? (c.razon_social ?? `${c.nombre} ${c.apellidos ?? ''}`.trim()) : null);
    })();
    return () => {
      cancelado = true;
    };
  }, [clienteObjetivoId]);

  return nombre;
}
