import * as React from 'react';
import { View } from 'react-native';

import { LoadingView } from '@/components/comunes/estados';
import { ScreenScroll } from '@/components/comunes/screen';
import { ScreenHeader } from '@/components/comunes/screen-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { ROLES, TIPOS_CLIENTE } from '@/constants';
import { useUsuarios } from '@/hooks/use-admin';
import { useDescuentos } from '@/hooks/use-comercial';
import { formatPct } from '@/lib/format';

export default function AdminUsuarios() {
  const { usuarios, cargando, recargar, asignarComercial } = useUsuarios();
  const { asignarGeneral } = useDescuentos();

  const [mensaje, setMensaje] = React.useState<string | null>(null);

  const comerciales = usuarios.filter((u) => u.rol === 'comercial');
  const clientes = usuarios.filter((u) => u.rol === 'cliente');

  const cambiarComercial = async (clienteId: string, comercialId: string | null) => {
    if (!comercialId) return;
    const { error } = await asignarComercial(clienteId, comercialId);
    setMensaje(error ?? 'Comercial asignado.');
    if (!error) await recargar();
  };

  return (
    <ScreenScroll>
      <ScreenHeader titulo="Usuarios" respaldo="/admin" />

      {cargando ? (
        <LoadingView />
      ) : (
        <View className="gap-3">
          {usuarios.map((u) => (
            <Card key={u.id} className="p-4">
              <CardContent className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="font-medium">
                    {u.razon_social ?? `${u.nombre} ${u.apellidos ?? ''}`.trim()}
                  </Text>
                  <Badge variant={u.rol === 'admin' ? 'default' : 'outline'}>
                    <Text>{ROLES[u.rol].etiqueta}</Text>
                  </Badge>
                </View>
                <Text className="text-xs text-muted-foreground">
                  {u.email}
                  {u.tipo_cliente ? ` · ${TIPOS_CLIENTE[u.tipo_cliente].etiqueta}` : ''}
                </Text>

                {u.rol === 'cliente' && (
                  <View className="mt-1 gap-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-muted-foreground">
                        Dto. general: {formatPct(u.descuento_porcentaje)}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        · Comercial: {u.id_comercial ? 'asignado' : 'sin asignar'}
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap items-center gap-2">
                      {comerciales.map((c) => (
                        <Button
                          key={c.id}
                          size="sm"
                          variant={u.id_comercial === c.id ? 'default' : 'outline'}
                          onPress={() => void cambiarComercial(u.id, c.id)}
                        >
                          <Text className="text-xs">{c.nombre}</Text>
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          void (async () => {
                            const { error } = await asignarGeneral(u.id, 0);
                            setMensaje(error ?? 'Descuento a 0%.');
                            if (!error) await recargar();
                          })();
                        }}
                      >
                        <Text className="text-xs text-muted-foreground">Dto. a 0%</Text>
                      </Button>
                    </View>
                  </View>
                )}
              </CardContent>
            </Card>
          ))}
          <Separator />
          {mensaje && <Text className="text-sm text-muted-foreground">{mensaje}</Text>}
          <Text className="text-xs text-muted-foreground">
            Solo los clientes pueden tener comercial asignado. El descuento general lo gestiona el
            comercial de la cartera desde su ficha de cliente.
          </Text>
        </View>
      )}
    </ScreenScroll>
  );
}
