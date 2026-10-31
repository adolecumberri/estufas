import { useLocalSearchParams } from 'expo-router';
import * as React from 'react';

import CatalogoScreen from '@/features/catalogo/screens/catalogo-screen';

// Catálogo de un proveedor concreto (/catalogo/proveedor/[id]).
// Reutiliza la MISMA pantalla del catálogo (sin duplicar views): el filtro por
// proveedor llega como prop y la pantalla lo aplica al RPC/consulta local.
// La ruta es estática antes del segmento dinámico para no colisionar con la
// ficha de producto (/catalogo/[id]).
export default function CatalogoProveedor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CatalogoScreen proveedorIdOverride={id ?? null} />;
}
