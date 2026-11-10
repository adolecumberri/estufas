import * as React from 'react';

import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { supabase } from '@/shared/lib/supabase';

// Banner de contexto para rutas scoped (?comercial=<id>): muestra
// "<prefijo> <nombre>" (p. ej. "Pedidos de Eider Comercial") consultando el
// nombre del comercial (el admin puede leer usuarios por RLS). Sustituye a
// los banners genéricos "…de este comercial" (feedback 10/11: el admin debe
// ver claramente DE QUIÉN son los datos).
export function BannerContexto({
  comercialId,
  prefijo,
}: {
  comercialId: string;
  prefijo: string;
}) {
  const [nombre, setNombre] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelado = false;
    void (async () => {
      const { data } = await supabase
        .from('usuarios')
        .select('nombre, apellidos')
        .eq('id', comercialId)
        .maybeSingle();
      if (cancelado) return;
      const u = data as { nombre?: string; apellidos?: string | null } | null;
      setNombre(u && u.nombre ? `${u.nombre} ${u.apellidos ?? ''}`.trim() : null);
    })();
    return () => {
      cancelado = true;
    };
  }, [comercialId]);

  return (
    <Card className="gap-0 rounded-lg border-primary/40 bg-primary/10 p-3">
      <Text className="text-sm">{nombre ? `${prefijo} ${nombre}` : `${prefijo} este comercial`}</Text>
    </Card>
  );
}
