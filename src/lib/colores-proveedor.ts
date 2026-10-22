// ---------------------------------------------------------------------------
// Colores por proveedor.
//
// Deriva un tema (base/tinte/borde/texto) del color HEX guardado en
// proveedores.color (#RRGGBB). Si el color falta o no es válido se usa el
// primario global de la marca (el acento ámbar de la app).
// ---------------------------------------------------------------------------

export interface TemaProveedor {
  base: string; // 'hsl(h s% l%)'
  texto: string; // variante más oscura para contraste
  tinte: string; // hsla al 10% de opacidad
  borde: string; // hsla al 40% de opacidad
}

// Primario global por defecto de la app (verde #415D43, el mismo que
// --primary en global.css). Se usa cuando un proveedor no tiene color.
const TEMA_PRIMARIO: TemaProveedor = {
  base: 'hsl(124.3 17.7% 31%)',
  tinte: 'hsla(124.3, 17.7%, 31%, 0.10)',
  borde: 'hsla(124.3, 17.7%, 31%, 0.40)',
  texto: 'hsl(124.3 17.7% 16%)',
};

// ¿El valor es un color HEX '#RRGGBB'?
export function esColorValido(hex: string | null | undefined): boolean {
  return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex);
}

interface Hsl {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

// Convierte '#RRGGBB' a { h, s, l } redondeados a enteros.
function hexAHsl(hex: string): Hsl {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Tema del proveedor a partir de su color HEX. null/inválido → primario global.
export function temaProveedor(colorHex: string | null | undefined): TemaProveedor {
  // Check inline para que TS afine el tipo (esColorValido no es un guard).
  if (typeof colorHex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
    return TEMA_PRIMARIO;
  }

  const { h, s, l } = hexAHsl(colorHex);
  const lTexto = Math.max(0, l - 15); // texto más oscuro para contraste

  return {
    base: `hsl(${h} ${s}% ${l}%)`,
    tinte: `hsla(${h}, ${s}%, ${l}%, 0.10)`,
    borde: `hsla(${h}, ${s}%, ${l}%, 0.40)`,
    texto: `hsl(${h} ${s}% ${lTexto}%)`,
  };
}

// Triplete 'h s% l%' (SIN la función hsl) para asignarlo como valor de la
// variable --primary de NativeWind. Color ausente/inválido → primario global.
export function tripletProveedor(hex: string | null | undefined): string {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return '124.3 17.7% 31%';
  }
  const { h, s, l } = hexAHsl(hex);
  return `${h} ${s}% ${l}%`;
}

// Texto legible sobre el color del proveedor (para --primary-foreground):
// negro si el color es claro (luminancia relativa WCAG > 0.5), blanco si es
// oscuro. Color ausente/inválido → blanco (el ámbar global es oscuro).
export function textoSobreProveedor(hex: string | null | undefined): string {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return '#ffffff';
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lineal = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminancia = 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
  return luminancia > 0.5 ? '#09090b' : '#ffffff';
}
