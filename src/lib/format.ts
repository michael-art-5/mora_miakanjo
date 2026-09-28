export function formatPrice(value: number, currency = 'Ar') {
  return `${value.toLocaleString('fr-FR')} ${currency}`
}

// Les dates SQLite (CURRENT_TIMESTAMP) sont en UTC, sans fuseau
export function parseDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`) // date simple, heure locale
  return new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z')
}

export function formatDate(value: string, withTime = true) {
  return parseDate(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function discountLabel(p: { kind: 'percent' | 'fixed'; value: number }, currency = 'Ar') {
  return p.kind === 'percent' ? `-${p.value} %` : `-${formatPrice(p.value, currency)}`
}
