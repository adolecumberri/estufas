import { Search } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { Input } from '@/shared/ui/input';
import { useColoresIcono } from '@/shared/lib/theme';

// Campo de búsqueda del catálogo (diseño Stitch): icono integrado a la
// izquierda, radio 10px y anillo de foco ámbar en web. Usa el Input del
// registro de componentes (el TextInput a mano se sustituye por la primitiva).
export function Buscador({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (texto: string) => void;
}) {
  const colores = useColoresIcono();
  return (
    <View className="relative justify-center">
      <View className="pointer-events-none absolute inset-y-0 left-3.5 justify-center">
        <Search size={20} color={colores.tenue} />
      </View>
      <Input
        value={valor}
        onChangeText={onChange}
        placeholder="Buscar por nombre o referencia"
        placeholderTextColor="hsl(240 3.8% 46.1%)"
        className="rounded-lg border-border py-2.5 pl-10 pr-4 text-sm text-foreground web:outline-none web:focus:border-primary web:focus:ring-2 web:focus:ring-primary"
      />
    </View>
  );
}
