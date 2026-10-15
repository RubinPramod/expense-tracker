const INR_GROUPING = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** Persisted money is an integer number of paise. Display uses Indian grouping. */
export function formatInr(minor: number): string {
  if (!Number.isSafeInteger(minor)) return '₹ —';
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const rupees = Math.trunc(abs / 100);
  const paise = abs % 100;
  const grouped = INR_GROUPING.format(rupees);
  if (paise === 0) return `${sign}₹ ${grouped}`;
  return `${sign}₹ ${grouped}.${paise.toString().padStart(2, '0')}`;
}

export function rupeesToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const negative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith('-');
  const cleaned = trimmed.replace(/[()₹,\s]/g, '').replace(/^-/, '').replace(/[^0-9.]/g, '');
  if (!cleaned || cleaned === '.') return null;
  const [whole = '0', fraction = '', extra] = cleaned.split('.');
  if (extra !== undefined) return null;
  if (!/^\d+$/.test(whole) || (fraction !== '' && !/^\d{1,2}$/.test(fraction))) return null;
  const minor = (Number(whole) * 100) + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  return negative ? -minor : minor;
}

export function minorToRupeeInput(minor: number): string {
  const abs = Math.abs(minor);
  const rupees = Math.trunc(abs / 100);
  const paise = abs % 100;
  if (paise === 0) return String(rupees);
  return `${rupees}.${paise.toString().padStart(2, '0')}`;
}
