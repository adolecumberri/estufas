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

import { Text } from '@/shared/ui/text';
import { RUTAS } from '@/shared/constantes';
import { useSolicitud } from '@/features/carrito/contexto';
import { useAuth } from '@/features/auth/use-auth';
import { usePermisos } from '@/shared/seguridad/use-permisos';
import type { Cap } from '@/shared/seguridad/capacidades';
import { useColoresIcono } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

type PestanaNav = 'catalogo' | 'solicitud' | 'pedidos' | 'cartera' | 'admin' | 'acceso';

type Pestana = {
  id: PestanaNav;
  etiqueta: string;
  icono: LucideIcon;
  ruta: Href;
  // Capacidad(es) exigida(s) para ver la pestaña (matriz
  // docs/ARQUITECTURA_ROLES.md §4). Varias capacidades = basta una (OR).
  caps?: Cap[];
};

const PESTANAS: Pestana[] = [
  {
    id: 'catalogo',
    etiqueta: 'Catálogo',
    icono: Flame,
    ruta: RUTAS.catalogo,
    caps: ['catalogo:ver_general', 'catalogo:ver_proveedores_propios'],
  },
  { id: 'solicitud', etiqueta: 'Solicitud', icono: FilePlus2, ruta: '/solicitud', caps: ['carrito:usar'] },
  {
    id: 'pedidos',
    etiqueta: 'Pedidos',
    icono: ReceiptText,
    ruta: RUTAS.pedidos,
    caps: ['pedidos:crear_propio', 'pedidos:confirmar'],
  },
  { id: 'cartera', etiqueta: 'Cartera', icono: Wallet, ruta: RUTAS.cartera, caps: ['cartera:ver_clientes'] },
  { id: 'admin', etiqueta: 'Admin', icono: ShieldCheck, ruta: RUTAS.admin, caps: ['admin:acceder'] },
];

// Sin sesión solo se ofrecen catálogo e inicio de sesión: añadir al pedido o
// consultar pedidos requiere cuenta.
const PESTANAS_ANONIMAS: Pestana[] = [
  { id: 'catalogo', etiqueta: 'Catálogo', icono: Flame, ruta: RUTAS.catalogo },
  { id: 'acceso', etiqueta: 'Iniciar sesión', icono: LogIn, ruta: RUTAS.login },
];

// Barra de pestañas inferior compartida (diseño Stitch): fondo semántico,
// acento ámbar en la pestaña activa y punto indicador en "Solicitud" cuando
// el carrito tiene líneas. Cada pestaña exige su capacidad (anillo 3): el
// resultado equivale al comportamiento anterior — admin solo Catálogo+Admin,
// clientes sin Cartera, comercial con todo (salvo Admin).
export function NavInferior({
  activa,
}: {
  activa: 'catalogo' | 'solicitud' | 'pedidos' | 'cartera' | 'admin';
}) {
  const insets = useSafeAreaInsets();
  const { lineas } = useSolicitud();
  const { session } = useAuth();
  const { puede, soloLectura } = usePermisos();
  const colores = useColoresIcono();

  const pestanas = React.useMemo(() => {
    if (!session) return PESTANAS_ANONIMAS;
    return PESTANAS.filter((p) => {
      if (!p.caps || !p.caps.some((c) => puede(c))) return false;
      // La cartera del admin es solo lectura y su operación vive en /admin:
      // la pestaña no se muestra (comportamiento actual: Catálogo+Admin).
      if (p.id === 'cartera' && soloLectura) return false;
      return true;
    });
  }, [session, puede, soloLectura]);

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
