/** Format des maquettes, sans espace avant l'euro (ex: 5500 -> "55,00€"). */
export function formatPrixCourt(cents: number): string {
	return `${(cents / 100).toFixed(2).replace('.', ',')}€`;
}
