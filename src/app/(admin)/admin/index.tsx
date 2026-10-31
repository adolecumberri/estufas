import { router } from 'expo-router';
import { Factory, Users } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { ListCard } from '@/shared/componentes/list-card';
import { Screen } from '@/shared/componentes/screen';
import { ScreenHeader } from '@/shared/componentes/screen-header';
import { Text } from '@/shared/ui/text';
import { useColoresIcono } from '@/shared/lib/theme';

const SECCIONES = [
  { titulo: 'Comerciales', descripcion: 'Comerciales, sus clientes y accesos a proveedores', icono: Users, ruta: '/admin/comerciales' },
  { titulo: 'Proveedores', descripcion: 'Catálogo multi-empresa y comerciales', icono: Factory, ruta: '/admin/proveedores' },
] as const;

export default function Admin() {
  const colores = useColoresIcono();

  return (
    <Screen padded>
      <View className="gap-3 pb-4">
        <ScreenHeader titulo="Administración" respaldo="/" />
        {SECCIONES.map((s) => (
          <ListCard key={s.ruta} onPress={() => router.push(s.ruta)}>
            <View className="flex-row items-center gap-3">
              <s.icono size={20} color={colores.primario} />
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold">{s.titulo}</Text>
                <Text className="text-xs text-muted-foreground">{s.descripcion}</Text>
              </View>
            </View>
          </ListCard>
        ))}
        <Pressable onPress={() => router.replace('/')} className="pt-2">
          <Text className="text-center text-sm text-muted-foreground">Volver al catálogo</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
