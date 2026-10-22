import { router, type Href } from 'expo-router';
import {
  FilePlus2,
  Flame,
  LogIn,
  ReceiptText,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { RUTAS } from '@/constants';
import { useSolicitud } from '@/contexts/solicitud-context';
import { useAuth } from '@/hooks/use-auth';
import { useColoresIcono } from '@/lib/theme';
import { cn } from '@/lib/utils';

type PestanaNav = 'catalogo' | 'solicitud' | 'pedidos' | 'cartera' | 'admin' | 'acceso';

type Pestana = { id: PestanaNav; etiqueta: string; icono: LucideIcon; ruta: Href };

const PESTANAS: Pestana[] = [
  { id: 'catalogo', etiqueta: 'Catálogo', icono: Flame, ruta: RUTAS.catalogo },
  { id: 'solicitud', etiqueta: 'Solicitud', icono: FilePlus2, ruta: '/solicitud' },
  { id: 'pedidos', etiqueta: 'Pedidos', icono: ReceiptText, ruta: RUTAS.pedidos },
  { id: 'cartera', etiqueta: 'Cartera', icono: Wallet, ruta: RUTAS.cartera },
  { id: 'admin', etiqueta: 'Admin', icono: ShieldCheck, ruta: RUTAS.admin },
];

// Sin sesión solo se ofrecen catálogo e inicio de sesión: añadir al pedido o
// consultar pedidos requiere cuenta.
const PESTANAS_ANONIMAS: Pestana[] = [
  { id: 'catalogo', etiqueta: 'Catálogo', icono: Flame, ruta: RUTAS.catalogo },
  { id: 'acceso', etiqueta: 'Iniciar sesión', icono: LogIn, ruta: RUTAS.login },
];

// Barra de pestañas inferior compartida (diseño Stitch): fondo semántico,
// acento ámbar en la pestaña activa y punto indicador en "Solicitud" cuando
// el carrito tiene líneas. Cartera solo se muestra a comercial/admin y la
// pestaña Admin (5ª, acceso al panel de administración) solo al admin: el
// acceso de administración vive aquí, no en la cabecera superior.
export function NavInferior({
  activa,
}: {
  activa: 'catalogo' | 'solicitud' | 'pedidos' | 'cartera' | 'admin';
}) {
  const insets = useSafeAreaInsets();
  const { lineas } = useSolicitud();
  const { session, perfil } = useAuth();
  const colores = useColoresIcono();

  const pestanas = React.useMemo(
    () =>
      session
        ? PESTANAS.filter((p) => {
            if (p.id === 'cartera') {
              return perfil?.rol === 'comercial' || perfil?.rol === 'admin';
            }
            if (p.id === 'admin') return perfil?.rol === 'admin';
            return true;
          })
        : PESTANAS_ANONIMAS,
    [session, perfil]
  );

  return (
    <View
      className="absolute bottom-0 left-0 right-0 h-16 flex-row items-center justify-around border-t border-border bg-background px-2"
      style={{ height: 64 + insets.bottom, paddingBottom: insets.bottom }}
    >
      {pestanas.map(({ id, etiqueta, icono: Icono, ruta }) => {
        const esActiva = id === activa;
        return (
          <Pressable
            key={id}
            onPress={() => {
              if (esActiva) return;
              router.push(ruta);
            }}
            className="relative flex-col items-center justify-center gap-0.5 py-1 active:opacity-70"
          >
            <Icono size={24} color={esActiva ? colores.primario : colores.tenue} />
            {id === 'solicitud' && lineas.length > 0 && (
              <View className="absolute right-2 top-0 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
            )}
            <Text
              className={cn(
                'text-[11px] leading-tight',
                esActiva ? 'font-medium text-primary' : 'text-muted-foreground'
              )}
            >
              {etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
