// Couleurs des lunettes (noms des dossiers / de PocketBase) et classe de fond correspondante.
// Écris toujours les classes complètes : Tailwind ne détecte pas une classe construite par morceaux.
export const fonds: Record<string, string> = {
	jaune: 'bg-yellow',
	bleu: 'bg-turquoise',
	rouge: 'bg-red',
	marron: 'bg-brown',
};

/**
 * Fond à afficher derrière des lunettes : le fond prévu, sauf si la monture ou le verre ont la même couleur
 * (les lunettes se fondraient dedans). Dans ce cas, la première couleur que n'utilisent ni les lunettes,
 * ni le décor posé sur le fond (texte et étoiles du bandeau « Bestseller »).
 */
export function fondLibre(fond: string, couleursLunettes: string[], decor: string[] = []): string {
	const lunettes = couleursLunettes.map((c) => fonds[c]);
	if (!lunettes.includes(fond)) return fond;
	const prises = [...lunettes, ...decor.map((c) => fonds[c])];
	return Object.values(fonds).find((f) => !prises.includes(f)) ?? fond;
}

// Contour d'une bande de couleur : toujours sur le jaune, et sur la bande de la même couleur que le fond affiché
// (sinon elle disparaîtrait). `force` impose ou retire le contour.
const contours: Record<string, string> = {
	'bg-yellow': 'border-turquoise',
	'bg-red': 'border-brown',
	'bg-turquoise': 'border-red',
	'bg-brown': 'border-yellow',
};
export const classesContour = ['border-[0.235vw]', ...Object.values(contours)];

export function contourBande(verre: string, fond: string, force?: boolean): string[] {
	const c = fonds[verre];
	return (force ?? (c === 'bg-yellow' || c === fond)) ? ['border-[0.235vw]', contours[c]] : [];
}
