import * as React from 'react';
import { View } from 'react-native';

import { LoadingView } from '@/components/comunes/estados';
import { ScreenScroll } from '@/components/comunes/screen';
import { ScreenHeader } from '@/components/comunes/screen-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { usePromocionesAdmin } from '@/hooks/use-admin';
import { formatFecha, formatPct } from '@/lib/format';

export default function AdminPromociones() {
  const { promociones, cargando, recargar, crear, alternar } = usePromocionesAdmin();

  const [nombre, setNombre] = React.useState('');
  const [descripcion, setDescripcion] = React.useState('');
  const [pct, setPct] = React.useState('');
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  const guardar = async () => {
    const numero = Number(pct.replace(',', '.'));
    if (!nombre.trim() || Number.isNaN(numero) || numero <= 0 || numero > 100) {
      setMensaje('Nombre y porcentaje válido (0-100] son obligatorios.');
      return;
    }
    const { error } = await crear({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      descuento_porcentaje: numero,
    });
    setMensaje(error ?? 'Promoción creada.');
    setNombre('');
    setDescripcion('');
    setPct('');
    if (!error) await recargar();
  };

  return (
    <ScreenScroll>
      <ScreenHeader titulo="Promociones de tienda" respaldo="/admin" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva promoción</CardTitle>
        </CardHeader>
        <CardContent className="gap-2">
          <Input value={nombre} onChangeText={setNombre} placeholder="Nombre" className="h-10 text-sm" />
          <Input
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Descripción (opcional)"
            className="h-10 text-sm"
          />
          <View className="flex-row items-center gap-2">
            <Input
              keyboardType="decimal-pad"
              value={pct}
              onChangeText={setPct}
              placeholder="% descuento"
              className="h-10 w-32 text-sm"
            />
            <Button size="sm" onPress={() => void guardar()}>
              <Text>Crear</Text>
            </Button>
          </View>
        </CardContent>
      </Card>

      {cargando ? (
        <LoadingView />
      ) : (
        <View className="gap-3">
          {promociones.map((p) => (
            <Card key={p.id} className="p-4">
              <CardContent className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text className="font-medium">{p.nombre}</Text>
                  <Badge variant={p.activa ? 'default' : 'outline'}>
                    <Text>{p.activa ? 'Activa' : 'Inactiva'}</Text>
                  </Badge>
                </View>
                <Text className="text-sm font-semibold">{formatPct(p.descuento_porcentaje)}</Text>
                {p.descripcion && (
                  <Text className="text-xs text-muted-foreground">{p.descripcion}</Text>
                )}
                <Text className="text-xs text-muted-foreground">
                  Desde {formatFecha(p.fecha_inicio)}
                  {p.fecha_fin ? ` hasta ${formatFecha(p.fecha_fin)}` : ' (sin fin)'}
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  onPress={() =>
                    void (async () => {
                      const { error } = await alternar(p.id, !p.activa);
                      setMensaje(error ?? 'Promoción actualizada.');
                      if (!error) await recargar();
                    })()
                  }
                >
                  <Text className="text-xs">{p.activa ? 'Desactivar' : 'Activar'}</Text>
                </Button>
              </CardContent>
            </Card>
          ))}
          <Separator />
          {mensaje && <Text className="text-sm text-muted-foreground">{mensaje}</Text>}
          <Text className="text-xs text-muted-foreground">
            Las promociones se aplican tomando el mayor porcentaje entre el descuento del cliente y la
            promoción vigente (nunca se acumulan).
          </Text>
        </View>
      )}
    </ScreenScroll>
  );
}
