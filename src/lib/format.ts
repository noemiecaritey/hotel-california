const priceFormatter = new Intl.NumberFormat('fr-FR', {
	style: 'currency',
	currency: 'EUR',
});

/** Formate un prix stocké en centimes (ex: 12990 -> "129,90 €"). */
export function formatPrice(cents: number): string {
	return priceFormatter.format(cents / 100);
}
