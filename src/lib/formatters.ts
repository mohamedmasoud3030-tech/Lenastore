// Shared formatters for Lenastore Construction PWA

export function formatCurrency(amount: number, currencyCode: string = 'SAR'): string {
  const code = (currencyCode || 'SAR').trim().toUpperCase();
  try {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch (_e) {
    return `${(amount || 0).toFixed(2)} ${code}`;
  }
}

export function formatNumber(val: number, decimals: number = 2): string {
  return new Intl.NumberFormat('ar-SA', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(val || 0);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (_e) {
    return dateString;
  }
}
