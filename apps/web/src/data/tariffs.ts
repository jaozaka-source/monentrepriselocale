/** Formats an amount in euros (not cents) using French locale. */
export function formatEuro(amount: number) {
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)} €`;
}
