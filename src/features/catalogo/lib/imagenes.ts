import ef8 from '../../assets/images/productos/ef8.jpg';
import la5 from '../../assets/images/productos/la5.jpg';
import ll7 from '../../assets/images/productos/ll7.jpg';
import lp9 from '../../assets/images/productos/lp9.jpg';
import tf12 from '../../assets/images/productos/tf12.jpg';
import tf70 from '../../assets/images/productos/tf70.jpg';
import placeholderProducto from '../../assets/images/placeholder-producto.png';

// Las imágenes de desarrollo del seed apuntan a picsum.photos (internet
// externo): desde el móvil en la LAN pueden no cargar. Los seeds conocidos se
// resuelven contra assets empaquetados en la app, que siempre cargan.
const IMAGENES_LOCALES: { semilla: string; fuente: number }[] = [
  { semilla: '/seed/estufa-lp9/', fuente: lp9 },
  { semilla: '/seed/estufa-tf12/', fuente: tf12 },
  { semilla: '/seed/estufa-ll7/', fuente: ll7 },
  { semilla: '/seed/estufa-ef8/', fuente: ef8 },
  { semilla: '/seed/estufa-tf70/', fuente: tf70 },
  { semilla: '/seed/estufa-la5/', fuente: la5 },
];

/**
 * Devuelve la fuente de imagen a usar en <Image> de expo-image: el asset
 * empaquetado si la URL corresponde a un seed conocido; si no, la URL remota.
 * Sin imagen (productos importados de catálogos sin fotos) se usa el
 * placeholder empaquetado, que siempre carga (offline-proof).
 */
export function fuenteImagen(url: string | null | undefined): number | { uri: string } {
  if (!url) return placeholderProducto;
  for (const { semilla, fuente } of IMAGENES_LOCALES) {
    if (url.includes(semilla)) return fuente;
  }
  return { uri: url };
}
