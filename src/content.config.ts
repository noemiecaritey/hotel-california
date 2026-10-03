import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Catalogue : un fichier .md (ou .json) par modèle de lunettes dans src/content/products/
const products = defineCollection({
	loader: glob({ pattern: '**/*.{md,json}', base: './src/content/products' }),
	schema: ({ image }) =>
		z.object({
			name: z.string(),
			brand: z.string(),
			price: z.number().int().positive(), // en centimes, voir src/lib/format.ts
			category: z.enum(['vue', 'soleil']),
			gender: z.enum(['homme', 'femme', 'mixte', 'enfant']),
			shape: z.enum(['ronde', 'rectangulaire', 'carree', 'papillon', 'aviateur', 'ovale']),
			material: z.string(),
			colors: z.array(z.string()).min(1),
			images: z.array(image()).min(1),
			inStock: z.boolean().default(true),
		}),
});

export const collections = { products };
