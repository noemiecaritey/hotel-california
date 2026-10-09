// Panier du visiteur, gardé dans son navigateur (localStorage) : pas de compte ni de serveur pour l'instant.
// Toutes les fonctions sont à appeler côté navigateur (dans un <script>), jamais dans le frontmatter.
// Chaque changement prévient la page avec l'événement "panier" (ex. pour mettre à jour le compteur du header).

export interface Article {
	id: string; // modèle + couleurs + taille : deux fois le même article = une seule ligne, quantité 2
	slug: string;
	nom: string;
	monture: string;
	verre: string;
	taille: string;
	image: string;
	prix: number; // en centimes, voir src/lib/format.ts
	quantite: number;
}

const CLE = 'panier';

// Le prix vient de PocketBase (champ prix de chaque modèle). Pas encore dans PocketBase : tailles et livraison.
export const TAILLES = ['52-20', '52-30', '52-40'];
export const TAILLE_PAR_DEFAUT = TAILLES[TAILLES.length - 1];
export const LIVRAISON = 500; // frais par commande, en centimes
export const DELAI_LIVRAISON = 7; // en jours

/** Le panier enregistré (vide si rien n'est enregistré, si le stockage est bloqué ou si les données sont abîmées). */
export function lirePanier(): Article[] {
	try {
		const panier = JSON.parse(localStorage.getItem(CLE) ?? '[]');
		return Array.isArray(panier) ? panier : [];
	} catch {
		return [];
	}
}

function enregistrer(panier: Article[]) {
	try {
		localStorage.setItem(CLE, JSON.stringify(panier));
	} catch {
		// Stockage bloqué (navigation privée, cookies refusés) : le panier ne sera pas gardé.
	}
	window.dispatchEvent(new Event('panier'));
}

/** Ajoute un article ; s'il est déjà dans le panier (mêmes modèle, couleurs et taille), augmente sa quantité. */
export function ajouter(article: Omit<Article, 'id' | 'quantite'>, quantite = 1) {
	const id = [article.slug, article.monture, article.verre, article.taille].join('-');
	const panier = lirePanier();
	const present = panier.find((a) => a.id === id);
	if (present) present.quantite += quantite;
	else panier.push({ ...article, id, quantite });
	enregistrer(panier);
}

/** Change la quantité d'un article ; à 0 ou moins, il est retiré du panier. */
export function changerQuantite(id: string, quantite: number) {
	if (quantite <= 0) return supprimer(id);
	enregistrer(lirePanier().map((a) => (a.id === id ? { ...a, quantite } : a)));
}

/** Retire un article du panier. */
export function supprimer(id: string) {
	enregistrer(lirePanier().filter((a) => a.id !== id));
}

/** Nombre total d'articles (les quantités additionnées). */
export function nombreArticles(): number {
	return lirePanier().reduce((total, a) => total + a.quantite, 0);
}
