# Boutique de lunettes — Astro + Tailwind

## Démarrage

```bash
npm install
npm run dev       # serveur de dev sur http://localhost:4321
npm run build     # build de production dans dist/
npm run preview   # prévisualise le build
```

Node.js >= 22.12 requis (exigence d'Astro).

## Ce qui est installé (et rien d'autre)

| Paquet | Pourquoi |
| --- | --- |
| `astro` | Le framework. Génère du HTML statique par défaut, 0 JS envoyé au navigateur sauf si on le demande → pages produits très rapides, excellent pour le SEO d'un e-commerce. |
| `tailwindcss` | Le framework CSS (v4). |
| `@tailwindcss/vite` | Le plugin officiel de Tailwind v4 pour Vite (le bundler d'Astro). C'est la méthode recommandée aujourd'hui ; l'ancienne intégration `@astrojs/tailwind` est dépréciée. |

Pas de framework UI (React, Vue…), pas de lib d'icônes, de fonts, de linter ou de gestion de panier : à ajouter seulement quand le besoin apparaît (`npx astro add react`, etc.).

## Structure

```
public/                  Fichiers servis tels quels (favicon, robots.txt…)
src/
├── assets/images/       Images optimisées par Astro (photos produits, bannières)
├── components/
│   ├── layout/          Header, Footer — présents sur toutes les pages
│   ├── product/         Composants métier : carte produit, galerie, filtres…
│   ├── sections/        Grands blocs de page (carousel d'accueil…), assemblés dans pages/
│   └── ui/              Briques génériques réutilisables : Button, Badge, Input…
├── content/products/    Le catalogue : un fichier .md ou .json par modèle
├── content.config.ts    Schéma (typé et validé) d'un produit
├── layouts/             Squelette HTML des pages (BaseLayout)
├── lib/                 Fonctions utilitaires en TypeScript pur (formatPrice…)
├── pages/               Routing : chaque fichier = une URL
└── styles/global.css    Import Tailwind + tokens de design (couleurs de la marque)
```

### Les choix, un par un

**`src/assets/` vs `public/`** — Les photos de lunettes sont l'élément le plus lourd du site. Placées dans `src/assets/`, elles passent par le composant `<Image />` d'Astro qui les convertit en WebP/AVIF, génère les bonnes tailles et ajoute `width`/`height` (pas de saut de mise en page). `public/` est réservé à ce qui ne doit **pas** être transformé (favicon, `robots.txt`).

**`components/` découpé en `layout` / `product` / `ui`** — Séparer le générique (`ui`, sans aucune notion de lunettes) du métier (`product`) évite qu'un bouton dépende de la logique produit et rend les composants faciles à retrouver quand le projet grossit. `layout` regroupe ce qui encadre chaque page.

**`content/products/` + `content.config.ts`** — Le catalogue est géré avec les *Content Collections* d'Astro : chaque paire de lunettes est un fichier (ex. `aviator-gold.md`). Le schéma Zod dans `content.config.ts` décrit un produit (marque, prix, forme, matière, couleurs, images…) :
- une faute de frappe ou un champ manquant fait échouer le build au lieu de casser une page en production ;
- les données sont typées automatiquement dans tout le projet (`getCollection('products')`) ;
- `image()` valide que les photos existent et les rend optimisables.

Le jour où le catalogue viendra d'une API ou d'un CMS (Shopify, Stripe…), seul le `loader` change, les pages restent identiques.

Exemple de fichier produit (`src/content/products/aviator-gold.md`) :

```md
---
name: Aviator Gold
brand: Maison X
price: 12990
category: soleil
gender: mixte
shape: aviateur
material: Métal
colors: [or, noir]
images: [../../assets/images/aviator-gold-1.jpg]
---

Description du modèle…
```

**Prix en centimes** (`price: 12990`) — Les nombres décimaux en JavaScript sont imprécis (`0.1 + 0.2 !== 0.3`). Stocker des entiers est la convention de toutes les solutions de paiement (Stripe notamment). L'affichage se fait via `formatPrice()` dans `src/lib/format.ts`.

**`layouts/BaseLayout.astro`** — Un seul endroit pour `<head>`, les meta SEO (`title`, `description`), l'import du CSS global, le header et le footer. Chaque page n'écrit que son contenu.

**`lib/`** — Code TypeScript sans rendu (formatage, filtres du catalogue, calculs de panier). Séparé des composants pour être réutilisable et testable.

**`styles/global.css` avec `@theme`** — Tailwind v4 se configure directement en CSS, il n'y a plus de `tailwind.config.js`. Les couleurs déclarées dans `@theme` (`--color-brand`, `--color-accent`) deviennent des classes (`bg-brand`, `text-accent`…). Changer l'identité visuelle = modifier ces variables.

**Alias `@/`** (dans `tsconfig.json`) — `import Header from '@/components/layout/Header.astro'` au lieu de `../../../components/...`. Les imports ne cassent plus quand on déplace un fichier.

**TypeScript `strict`** — Hérité du template Astro, conservé : sur un site qui manipule des prix et un panier, les erreurs de type attrapées à la compilation valent le coup.

Les dossiers encore vides contiennent un `.gitkeep` pour être conservés par Git ; supprime-le dès que tu y ajoutes un fichier.

## Notes

- `npm audit` signale une vulnérabilité dans `http-cache-semantics`, une dépendance interne d'Astro. Le correctif proposé par `npm audit fix --force` rétrograderait Astro en v2 : **ne pas le lancer**, attendre la mise à jour d'Astro.
- `CLAUDE.md` / `AGENTS.md` viennent du template Astro : ce sont des consignes pour les assistants IA de code, sans effet sur le site.
