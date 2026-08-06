// Shared locale-safe formatters for LENA SUPPLY.

export function formatCurrency(amount: number, currencyCode: string = 'EGP'): string {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const code = (currencyCode || 'EGP').trim().toUpperCase();

  try {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: code === 'OMR' ? 3 : 2,
    }).format(safeAmount);
  } catch (_error) {
    return `${safeAmount.toFixed(code === 'OMR' ? 3 : 2)} ${code}`;
  }
}

export function formatNumber(value: number, decimals: number = 2): string {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(safeValue);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (_error) {
    return dateString;
  }
}
