import { Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import {
  useDescuentosCliente,
  type AnularDescuento,
  type FilaHistorialDescuento,
} from '@/features/cartera/hooks/use-descuentos';
import { useProveedoresComercial } from '@/features/cartera/hooks/use-comercial';
import { EmptyState, ErrorView, LoadingView } from '@/shared/componentes/estados';
import { FilaDetalle, ListCard } from '@/shared/componentes/list-card';
import { SectionTitle } from '@/shared/componentes/section-title';
import { Chip, ConfirmDialog, FormField } from '@/shared/ui';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Text } from '@/shared/ui/text';
import { usePermisos } from '@/shared/seguridad/use-permisos';
import { formatFechaHora, formatPct } from '@/shared/lib/format';
import { useColoresIcono } from '@/shared/lib/theme';
import type { Categoria } from '@/shared/lib/types';

const ACCIONES: Record<FilaHistorialDescuento['accion'], string> = {
  crear: 'creado',
  actualizar: 'actualizado',
  anular: 'anulado',
};

const etiquetaNivel = (h: FilaHistorialDescuento) => {
  const base =
    h.nivel === 'general'
      ? 'General'
      : h.nivel === 'proveedor'
        ? 'Proveedor'
        : h.nivel === 'categoria'
          ? 'Categoría'
          : 'Producto';
  const objetivo = h.proveedor?.nombre ?? h.categoria?.nombre ?? h.producto?.nombre;
  return objetivo ? `${base} · ${objetivo}` : base;
};

// "0-100" con coma decimal, como el resto de inputs de la pantalla.
const parsePct = (valor: string): number | null => {
  const texto = valor.trim().replace(',', '.');
  if (texto === '') return null;
  const pct = Number(texto);
  if (Number.isNaN(pct) || pct < 0 || pct > 100) return null;
  return pct;
};

// Descuentos por proveedor y por categoría de un cliente + historial de
// cambios. Los proveedores visibles son los habilitados para el comercial
// (los mismos que hereda el cliente); las categorías llegan del catálogo del
// cliente porque el esquema no asocia categorías a proveedores. Solo se
// muestra si el rol puede gestionar descuentos (comercial).
export function DescuentosProveedor({
  clienteId,
  categorias,
}: {
  clienteId: string | null | undefined;
  categorias: Categoria[];
}) {
  const { puede } = usePermisos();
  const puedeEditar = puede('descuentos:gestionar');
  const { proveedores: proveedoresVisibles, cargando: cargandoProveedores } =
    useProveedoresComercial();
  const {
    proveedores,
    categorias: reglasCategoria,
    historial,
    cargando,
    error,
    recargar,
    guardarProveedor,
    guardarCategoria,
    anular,
  } = useDescuentosCliente(clienteId);
  const colores = useColoresIcono();

  const [proveedorActivo, setProveedorActivo] = React.useState<string | null>(null);
  const [pctProveedor, setPctProveedor] = React.useState('');
  const [pctCategorias, setPctCategorias] = React.useState<Record<string, string>>({});
  const [mensaje, setMensaje] = React.useState<string | null>(null);
  const [anulando, setAnulando] = React.useState<AnularDescuento | null>(null);

  // Selecciona el primer proveedor disponible al cargar la lista.
  React.useEffect(() => {
    if (!proveedorActivo && proveedoresVisibles.length > 0) {
      setProveedorActivo(proveedoresVisibles[0].id);
    }
  }, [proveedorActivo, proveedoresVisibles]);

  // Al cambiar de proveedor, precarga su % vigente (si tiene regla).
  React.useEffect(() => {
    const regla = proveedorActivo
      ? proveedores.find((p) => p.proveedor_id === proveedorActivo)
      : undefined;
    setPctProveedor(regla ? String(regla.pct) : '');
  }, [proveedorActivo, proveedores]);

  if (!puedeEditar) return null;

  const reglaProveedor = proveedorActivo
    ? proveedores.find((p) => p.proveedor_id === proveedorActivo)
    : undefined;

  const guardarProveedorPct = async () => {
    if (!proveedorActivo) return;
    const pct = parsePct(pctProveedor);
    if (pct === null) {
      setMensaje('Porcentaje inválido (0-100).');
      return;
    }
    const { error } = await guardarProveedor(proveedorActivo, pct);
    setMensaje(error ?? 'Descuento de proveedor guardado.');
  };

  const guardarCategoriaPct = async (categoriaId: string) => {
    if (!proveedorActivo) return;
    const pct = parsePct(pctCategorias[categoriaId] ?? '');
    if (pct === null) {
      setMensaje('Porcentaje inválido (0-100).');
      return;
    }
    const { error } = await guardarCategoria(proveedorActivo, categoriaId, pct);
    setMensaje(error ?? 'Descuento de categoría guardado.');
  };

  const confirmarAnular = async () => {
    if (!anulando) return;
    const { error } = await anular(anulando);
    setAnulando(null);
    setMensaje(error ?? 'Descuento anulado.');
  };

  return (
    <View className="gap-2">
      <SectionTitle>Descuentos por proveedor</SectionTitle>
      <Text className="text-xs text-muted-foreground">
        Reglas por proveedor y por categoría; el descuento por producto sigue teniendo preferencia.
      </Text>

      {cargando || cargandoProveedores ? (
        <LoadingView />
      ) : error ? (
        <ErrorView mensaje={error} onReintentar={() => void recargar()} />
      ) : proveedoresVisibles.length === 0 ? (
        <EmptyState titulo="Sin proveedores habilitados" />
      ) : (
        <View className="gap-2">
          {/* Selector de proveedor */}
          <View className="flex-row flex-wrap gap-1.5">
            {proveedoresVisibles.map((p) => (
              <Chip
                key={p.id}
                etiqueta={p.nombre}
                activo={proveedorActivo === p.id}
                onPress={() => setProveedorActivo(p.id)}
              />
            ))}
          </View>

          {proveedorActivo ? (
            <Card className="rounded-lg">
              <CardContent className="gap-3">
                {/* Descuento del proveedor */}
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-sm font-semibold">Descuento del proveedor</Text>
                  {reglaProveedor ? (
                    <View className="rounded-md bg-primary/10 px-2 py-1">
                      <Text className="text-xs font-semibold text-primary">
                        {formatPct(reglaProveedor.pct)} Dto.
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-xs text-muted-foreground">Sin descuento</Text>
                  )}
                </View>
                <FormField etiqueta="Porcentaje">
                  <View className="flex-row items-center gap-2">
                    <Input
                      keyboardType="decimal-pad"
                      value={pctProveedor}
                      onChangeText={setPctProveedor}
                      placeholder="%"
                      className="h-10 w-24 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => void guardarProveedorPct()}
                    >
                      <Text>Guardar</Text>
                    </Button>
                    {reglaProveedor ? (
                      <Button
                        size="sm"
                        variant="outline"
                        accessibilityLabel="Anular descuento del proveedor"
                        onPress={() =>
                          setAnulando({ nivel: 'proveedor', proveedorId: proveedorActivo })
                        }
                      >
                        <Text className="text-xs">Anular</Text>
                      </Button>
                    ) : null}
                  </View>
                </FormField>

                {/* Categorías del proveedor */}
                <View className="gap-1.5">
                  <SectionTitle>Categorías del proveedor</SectionTitle>
                  {categorias.length === 0 ? (
                    <Text className="text-sm text-muted-foreground">
                      Sin categorías disponibles.
                    </Text>
                  ) : (
                    categorias.map((c) => {
                      const regla = reglasCategoria.find(
                        (r) => r.proveedor_id === proveedorActivo && r.categoria_id === c.id
                      );
                      return (
                        <ListCard key={c.id}>
                          <View className="flex-row items-center justify-between gap-2">
                            <View className="flex-1 gap-0.5">
                              <Text className="text-sm font-medium" numberOfLines={1}>
                                {c.nombre}
                              </Text>
                              <Text className="text-xs text-muted-foreground">
                                {regla ? `Actual: ${formatPct(regla.pct)}` : 'Sin descuento'}
                              </Text>
                            </View>
                            <Input
                              keyboardType="decimal-pad"
                              value={pctCategorias[c.id] ?? ''}
                              onChangeText={(v) =>
                                setPctCategorias((prev) => ({ ...prev, [c.id]: v }))
                              }
                              placeholder="%"
                              className="h-9 w-20 text-sm"
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => void guardarCategoriaPct(c.id)}
                            >
                              <Text>Guardar</Text>
                            </Button>
                            {regla ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                accessibilityLabel={`Anular descuento de categoría ${c.nombre}`}
                                onPress={() =>
                                  setAnulando({
                                    nivel: 'categoria',
                                    proveedorId: proveedorActivo,
                                    categoriaId: c.id,
                                  })
                                }
                              >
                                <Trash2 size={16} color={colores.destructivo} />
                              </Button>
                            ) : null}
                          </View>
                        </ListCard>
                      );
                    })
                  )}
                </View>
              </CardContent>
            </Card>
          ) : null}
        </View>
      )}

      {mensaje ? <Text className="text-sm text-muted-foreground">{mensaje}</Text> : null}

      {/* Historial de cambios */}
      <View className="gap-1.5 pt-2">
        <SectionTitle>Historial de cambios</SectionTitle>
        {historial.length === 0 ? (
          <EmptyState titulo="Sin cambios registrados" />
        ) : (
          historial.map((h) => (
            <ListCard key={h.id}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm font-medium" numberOfLines={1}>
                  {etiquetaNivel(h)}
                </Text>
                <Text className="text-xs text-muted-foreground">{ACCIONES[h.accion]}</Text>
              </View>
              <FilaDetalle
                etiqueta="Descuento"
                valor={h.descuento_porcentaje != null ? formatPct(h.descuento_porcentaje) : '—'}
              />
              <FilaDetalle
                etiqueta="Actor"
                valor={h.actor_rol === 'admin' ? 'Admin' : 'Comercial'}
              />
              <FilaDetalle etiqueta="Fecha" valor={formatFechaHora(h.created_at)} />
            </ListCard>
          ))
        )}
      </View>

      <ConfirmDialog
        visible={anulando !== null}
        titulo="Anular descuento"
        mensaje="¿Seguro que quieres anular esta regla? El cambio queda registrado en el historial de cambios."
        destructivo
        onConfirmar={() => void confirmarAnular()}
        onCancelar={() => setAnulando(null)}
      />
    </View>
  );
}
