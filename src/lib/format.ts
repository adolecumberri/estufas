import { MONEDA } from '@/constants';

const formatterEUR = new Intl.NumberFormat(MONEDA.locale, {
  style: 'currency',
  currency: MONEDA.codigo,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatterPct = new Intl.NumberFormat(MONEDA.locale, {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatterFecha = new Intl.DateTimeFormat(MONEDA.locale, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const formatterFechaHora = new Intl.DateTimeFormat(MONEDA.locale, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatEUR(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return formatterEUR.format(valor);
}

export function formatPct(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return formatterPct.format(valor / 100);
}

export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatterFecha.format(d);
}

export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatterFechaHora.format(d);
}
