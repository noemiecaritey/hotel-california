// Accès en lecture au catalogue PocketBase (collections lunettes, color, variantes).
// Les données sont récupérées au moment du rendu de la page : PocketBase doit tourner (pocketbase serve).
import fs from 'node:fs';
import sharp from 'sharp';

export const PB_URL = import.meta.env.PB_URL ?? 'http://127.0.0.1:8090';

// Prix d'un modèle sans prix dans PocketBase (champ vide ou à 0), en centimes.
const PRIX_PAR_DEFAUT = 5500;

interface Color {
	id: string;
	collectionId: string;
	tag: string;
	nom_couleur: string;
	color_img: string;
}

interface Variante {
	id: string;
	collectionId: string;
	img_face: string;
	img_droite: string;
	expand?: {
		modele?: { slug: string; nom: string; select: string; prix?: number };
		couleur_monture?: Color;
		couleur_verre?: Color;
	};
}

export interface Lunette {
	nom: string;
	slug: string;
	categorie: string;
	monture: string;
	verre: string;
	face: string;
	droite: string;
	prix: number; // en centimes (le champ prix de PocketBase est en euros)
}

/** Une couleur proposée sur la page produit : son nom de dossier, son nom affiché et sa pastille. */
export interface Couleur {
	nom: string;
	label: string;
	pastille: string;
}

/** URL publique d'un fichier PocketBase. */
const fileUrl = (r: { collectionId: string; id: string }, file: string) =>
	`${PB_URL}/api/files/${r.collectionId}/${r.id}/${file}`;

/**
 * Nom de couleur ("bleu", "marron"…) retrouvé grâce à l'image de la pastille :
 * PocketBase renomme "bleu-monture.avif" en "bleu_monture_xxxxxxxxxx.avif".
 */
const colorName = (c?: Color) =>
	(c?.color_img ?? '')
		.replace(/\.[^.]+$/, '')
		.replace(/_[a-z0-9]{10}$/i, '')
		.replace(/[-_]?monture$/i, '')
		.toLowerCase();

function toLunette(v: Variante): Lunette {
	return {
		nom: v.expand?.modele?.nom ?? '',
		slug: v.expand?.modele?.slug ?? '',
		categorie: v.expand?.modele?.select ?? '',
		monture: colorName(v.expand?.couleur_monture),
		verre: colorName(v.expand?.couleur_verre),
		face: fileUrl(v, v.img_face),
		droite: fileUrl(v, v.img_droite || v.img_face),
		prix: Math.round((v.expand?.modele?.prix || PRIX_PAR_DEFAUT / 100) * 100),
	};
}

function toCouleur(c: Color): Couleur {
	const nom = colorName(c);
	return { nom, label: c.nom_couleur || nom, pastille: fileUrl(c, c.color_img) };
}

// Une seule requête pour tous les cadres d'une page. En dev, la mémoire est vidée après 2 s
// (et tout de suite en cas d'erreur) pour que les changements faits dans PocketBase apparaissent au rechargement.
let cache: Promise<Variante[]> | undefined;

function getVariantes(): Promise<Variante[]> {
	if (cache) return cache;
	cache = fetch(
		`${PB_URL}/api/collections/variantes/records?perPage=500&expand=modele,couleur_monture,couleur_verre`,
	)
		.then((res) => {
			if (!res.ok) throw new Error(`PocketBase a répondu ${res.status}`);
			return res.json();
		})
		.then((data) => data.items as Variante[]);
	cache.catch(() => (cache = undefined));
	if (import.meta.env.DEV) setTimeout(() => (cache = undefined), 2000);
	return cache;
}

/**
 * Cherche la variante d'un modèle (par slug) dans une couleur de monture et de verre.
 * Renvoie null si PocketBase est injoignable ou si la variante n'existe pas : la page reste affichable.
 */
export async function getLunette(modele: string, monture: string, verre: string): Promise<Lunette | null> {
	let variantes: Variante[];
	try {
		variantes = await getVariantes();
	} catch (error) {
		console.warn(`[pocketbase] Catalogue indisponible (${PB_URL}) :`, (error as Error).message);
		return null;
	}

	const v = variantes.find(
		(v) =>
			v.expand?.modele?.slug === modele &&
			colorName(v.expand?.couleur_monture) === monture &&
			colorName(v.expand?.couleur_verre) === verre,
	);
	if (!v?.img_face) {
		console.warn(`[pocketbase] Variante introuvable : ${modele} ${monture}/${verre}`);
		return null;
	}

	return toLunette(v);
}

/** Slugs de tous les modèles qui ont au moins une variante (pour générer les pages produit). */
export async function getSlugs(): Promise<string[]> {
	const variantes = await getVariantes();
	return [...new Set(variantes.map((v) => v.expand?.modele?.slug).filter((s): s is string => !!s))];
}

/** Toutes les variantes d'un modèle, et les couleurs de monture / verre disponibles (sans doublon). */
export async function getModele(slug: string) {
	const variantes = (await getVariantes()).filter((v) => v.expand?.modele?.slug === slug && v.img_face);
	const uniques = (colors: (Color | undefined)[]) =>
		[...new Map(colors.filter((c): c is Color => !!c).map((c) => [colorName(c), toCouleur(c)])).values()];
	return {
		variantes: variantes.map(toLunette),
		montures: uniques(variantes.map((v) => v.expand?.couleur_monture)),
		verres: uniques(variantes.map((v) => v.expand?.couleur_verre)),
	};
}

/** Les modèles d'une catégorie (champ select : rockstar, popstar), avec toutes leurs variantes. */
export async function getModeles(categorie: string) {
	const variantes = (await getVariantes().catch(() => [])).filter(
		(v) => v.expand?.modele?.select === categorie && v.img_face,
	);
	const slugs = [...new Set(variantes.map((v) => v.expand!.modele!.slug))];
	return slugs.map((slug) => {
		const siens = variantes.filter((v) => v.expand?.modele?.slug === slug).map(toLunette);
		return { slug, nom: siens[0].nom, variantes: siens };
	});
}

/** Zone occupée par les lunettes dans une photo (fractions de la photo) et proportion de la photo (hauteur / largeur). */
export interface Cadrage {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	ratio: number;
}

// Mesurée une fois par photo : les photos ont un fond transparent, on retire les bords vides (trim).
// La mesure est lente (photos en taille réelle, plusieurs secondes) : elle est gardée en mémoire (globalThis, sinon
// le mode dev la perd entre deux requêtes) et dans .astro/cadrages-lunettes.json (dossier ignoré par git), pour
// qu'une photo ne soit mesurée qu'une seule fois, même après un redémarrage. Le nom de fichier change à chaque envoi
// dans PocketBase, donc une photo remplacée est mesurée à nouveau.
const FICHIER = '.astro/cadrages-lunettes.json';
const memoire = globalThis as typeof globalThis & { cadragesLunettes?: Map<string, Promise<Cadrage>> };
const cadrages = (memoire.cadragesLunettes ??= new Map(
	Object.entries(lireFichier()).map(([url, c]) => [url, Promise.resolve(c)]),
));

function lireFichier(): Record<string, Cadrage> {
	try {
		return JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
	} catch {
		return {};
	}
}

/** Cadrage d'une photo de lunettes, pour placer la monture au même endroit quel que soit le modèle. */
export function getCadrage(url: string): Promise<Cadrage> {
	if (!cadrages.has(url)) {
		cadrages.set(
			url,
			(async () => {
				const image = Buffer.from(await (await fetch(url)).arrayBuffer());
				const { width = 1, height = 1 } = await sharp(image).metadata();
				const { info } = await sharp(image).trim().toBuffer({ resolveWithObject: true });
				const x0 = -(info.trimOffsetLeft ?? 0) / width;
				const y0 = -(info.trimOffsetTop ?? 0) / height;
				const cadrage = { x0, y0, x1: x0 + info.width / width, y1: y0 + info.height / height, ratio: height / width };
				try {
					fs.mkdirSync('.astro', { recursive: true });
					fs.writeFileSync(FICHIER, JSON.stringify({ ...lireFichier(), [url]: cadrage }));
				} catch {
					// Pas de fichier : la mesure reste en mémoire seulement.
				}
				return cadrage;
			})(),
		);
	}
	return cadrages.get(url)!;
}

/**
 * Cadrage de la vue de droite dans un panneau aux proportions de celui de la page produit (733×606 sur la maquette,
 * même rapport pour l'image du panier) : monture à 6px du bord gauche, de 113px à 490px de haut. En % du panneau.
 */
export function styleVueDroite(c: Cadrage): string {
	const panneau = { w: 733, h: 606 };
	const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(2)}%`;
	const h = 377 / (c.y1 - c.y0);
	const w = h / c.ratio;
	return `left:${pct(6 - c.x0 * w, panneau.w)};top:${pct(113 - c.y0 * h, panneau.h)};width:${pct(w, panneau.w)}`;
}

/** Noms affichés des couleurs (`nom_couleur` dans PocketBase), par type : { monture: { bleu: 'Blue Bird' … }, verre: {…} }. */
export async function getNomsCouleurs() {
	const noms = { monture: {} as Record<string, string>, verre: {} as Record<string, string> };
	for (const v of await getVariantes().catch(() => [])) {
		for (const [type, c] of [['monture', v.expand?.couleur_monture], ['verre', v.expand?.couleur_verre]] as const) {
			if (c) noms[type][colorName(c)] = toCouleur(c).label;
		}
	}
	return noms;
}
