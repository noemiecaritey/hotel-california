// ─────────────────────────────────────────────────────────────
//  Import des lunettes dans PocketBase
//
//  Usage :
//    node import-lunettes.mjs ./pb-california --dry   (test : n'écrit rien)
//    node import-lunettes.mjs ./pb-california         (import réel)
//
//  Arborescence attendue :
//    pb-california/<categorie>/<modele>/<monture>/<verre>/{face,droite,gauche}.avif
//    (le verre de la même couleur que la monture finit par "_", ex : bleu_)
// ─────────────────────────────────────────────────────────────

import PocketBase from "pocketbase";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";

// ── Configuration ────────────────────────────────────────────
const PB_URL = process.env.PB_URL || "http://127.0.0.1:8090";

// Si la détection automatique des couleurs échoue, remplis ceci
// avec les id de ta collection "color", ex : { bleu: "1piufftvl4qkti9", ... }
const MANUEL_MONTURE = {};
const MANUEL_VERRE = {};
// ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const ROOT = args.find((a) => !a.startsWith("--"));

if (!ROOT || !fs.existsSync(ROOT)) {
  console.error("❌ Indique le chemin du dossier : node import-lunettes.mjs ./pb-california");
  process.exit(1);
}

const one = (x) => (Array.isArray(x) ? x[0] : x) || "";
const isDir = (p) => fs.statSync(p).isDirectory();
const subdirs = (p) =>
  fs.readdirSync(p).filter((n) => !n.startsWith(".") && n !== "__MACOSX" && isDir(path.join(p, n)));
const titleCase = (slug) =>
  slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const POSITIONS = ["face", "droite", "gauche"];

// ── 1. Lecture des dossiers ──────────────────────────────────
const variantes = [];
const modeles = new Map(); // slug -> categorie
const couleursUtilisees = new Set();

for (const categorie of subdirs(ROOT)) {
  if (categorie === "couleur") continue; // dossier des pastilles, ignoré
  for (const modele of subdirs(path.join(ROOT, categorie))) {
    modeles.set(modele, categorie);
    for (const monture of subdirs(path.join(ROOT, categorie, modele))) {
      for (const verreDir of subdirs(path.join(ROOT, categorie, modele, monture))) {
        const verre = verreDir.replace(/_+$/, ""); // "bleu_" -> "bleu"
        const dir = path.join(ROOT, categorie, modele, monture, verreDir);
        const images = {};
        for (const pos of POSITIONS) {
          const f = fs.readdirSync(dir).find((n) => n.toLowerCase().startsWith(pos + "."));
          if (f) images[pos] = path.join(dir, f);
        }
        couleursUtilisees.add(monture).add(verre);
        variantes.push({ categorie, modele, monture, verre, images });
      }
    }
  }
}

console.log(`📁 ${modeles.size} modèles, ${variantes.length} variantes trouvées dans les dossiers.`);
for (const v of variantes) {
  const manque = ["face", "droite"].filter((p) => !v.images[p]);
  if (manque.length) console.warn(`⚠️  ${v.modele}/${v.monture}/${v.verre} : il manque ${manque.join(", ")}`);
}

// ── 2. Connexion ─────────────────────────────────────────────
const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

let email = process.env.PB_EMAIL;
let password = process.env.PB_PASSWORD;
if (!email || !password) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  email ||= await rl.question("Email superuser PocketBase : ");
  password ||= await rl.question("Mot de passe : ");
  rl.close();
}
await pb.collection("_superusers").authWithPassword(email, password);
console.log(`🔑 Connecté à ${PB_URL}`);

// ── 3. Correspondance couleurs (dossier -> id de "color") ────
// PocketBase renomme les fichiers envoyés : "bleu-monture.avif" devient
// "bleu_monture_xxxxxxxxxx.avif". On retrouve donc la couleur grâce au
// nom de l'image dans color_img, et le type grâce au champ tag.
const colors = await pb.collection("color").getFullList();
const mapMonture = { ...MANUEL_MONTURE };
const mapVerre = { ...MANUEL_VERRE };

for (const c of colors) {
  const file = one(c.color_img);
  if (!file) continue;
  const base = file
    .replace(/\.[^.]+$/, "")          // extension
    .replace(/_[a-z0-9]{10}$/i, "")   // suffixe aléatoire ajouté par PocketBase
    .replace(/[-_]?monture$/i, "")    // "-monture"
    .toLowerCase();
  const tag = one(c.tag);
  const target = tag === "monture" ? mapMonture : tag === "verre" ? mapVerre : null;
  if (target && !target[base]) target[base] = c.id;
}

let erreur = false;
for (const coul of couleursUtilisees) {
  if (!mapMonture[coul]) { console.error(`❌ Couleur de monture "${coul}" introuvable dans "color"`); erreur = true; }
  if (!mapVerre[coul]) { console.error(`❌ Couleur de verre "${coul}" introuvable dans "color"`); erreur = true; }
}
if (erreur) {
  console.error("\nVoici ta collection color, complète MANUEL_MONTURE / MANUEL_VERRE en haut du script :");
  console.table(colors.map((c) => ({ id: c.id, tag: c.tag, nom: c.nom_couleur, img: c.color_img })));
  process.exit(1);
}
console.log("🎨 Couleurs monture :", mapMonture);
console.log("🎨 Couleurs verre   :", mapVerre);

// ── 4. Modèles (collection "lunettes") ───────────────────────
const lunettes = await pb.collection("lunettes").getFullList();
const idModele = {};

for (const [slug, categorie] of modeles) {
  let rec = lunettes.find((l) => l.slug === slug);
  // Fiche existante mais sans slug, dans la bonne catégorie (ex : Hendrix)
  rec ||= lunettes.find((l) => !l.slug && one(l.select) === categorie);
  const data = { slug, select: categorie };
  if (!rec?.nom) data.nom = titleCase(slug);

  if (!rec) {
    console.log(`➕ lunettes : création de ${slug}`);
    if (!DRY) rec = await pb.collection("lunettes").create(data);
  } else if (rec.slug !== slug || !rec.nom || one(rec.select) !== categorie) {
    console.log(`✏️  lunettes : mise à jour de ${rec.id} →`, data);
    if (!DRY) rec = await pb.collection("lunettes").update(rec.id, data);
  }
  idModele[slug] = rec?.id ?? `(nouveau ${slug})`;
}

// ── 5. Variantes ─────────────────────────────────────────────
const existantes = await pb.collection("variantes").getFullList();

// Fiches vides (sans couleur) : supprimées
for (const v of existantes.filter((v) => !one(v.couleur_monture) && !one(v.couleur_verre))) {
  console.log(`🗑️  variantes : suppression de la fiche vide ${v.id}`);
  if (!DRY) await pb.collection("variantes").delete(v.id);
}

let crees = 0, maj = 0;
for (const v of variantes) {
  const modele = idModele[v.modele];
  const monture = mapMonture[v.monture];
  const verre = mapVerre[v.verre];

  const fd = new FormData();
  fd.append("modele", modele);
  fd.append("couleur_monture", monture);
  fd.append("couleur_verre", verre);
  for (const [pos, file] of Object.entries(v.images)) {
    const nom = `${v.modele}-${v.monture}-${v.verre}-${pos}${path.extname(file)}`;
    fd.append(`img_${pos}`, new Blob([fs.readFileSync(file)], { type: "image/avif" }), nom);
  }

  const deja = existantes.find(
    (e) => one(e.modele) === modele && one(e.couleur_monture) === monture && one(e.couleur_verre) === verre
  );
  if (deja) {
    if (!DRY) await pb.collection("variantes").update(deja.id, fd);
    maj++;
  } else {
    if (!DRY) await pb.collection("variantes").create(fd);
    crees++;
  }
  process.stdout.write(`\r⏳ ${crees + maj}/${variantes.length}`);
}

console.log(`\n✅ ${DRY ? "[TEST, rien n'a été écrit] " : ""}${crees} variantes créées, ${maj} mises à jour.`);
