// Données de départ : insérées une seule fois, sur une base vide.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { SERVER_DIR, getSetting, one, query, setSetting, transaction } from './db.js'
import { hashPassword } from './auth.js'

const ENV_FILE = path.join(SERVER_DIR, '.env')

export async function seed() {
  await seedAdmin()
  if (!(await getSetting('shop'))) await seedContent()
}

async function seedAdmin() {
  if ((await one('SELECT COUNT(*)::int AS n FROM users')).n > 0) return
  const username = process.env.ADMIN_USERNAME || 'admin'
  let password = process.env.ADMIN_PASSWORD
  if (!password) {
    // Mot de passe initial aléatoire. En local, il est enregistré dans server/.env (fichier ignoré par git).
    password = crypto.randomBytes(9).toString('base64url')
    try {
      fs.appendFileSync(ENV_FILE, `\nADMIN_USERNAME=${username}\nADMIN_PASSWORD=${password}\n`)
      console.log(`Compte administrateur créé. Identifiants initiaux : voir ${ENV_FILE}`)
    } catch {
      console.log('Compte administrateur créé : définissez ADMIN_PASSWORD avant le premier démarrage pour choisir le mot de passe.')
    }
  }
  await query('INSERT INTO users (username, password_hash) VALUES (@username, @hash)', { username, hash: hashPassword(password) })
}

async function seedContent() {
  await transaction(async (tx) => {
    await setSetting(
      'shop',
      {
        name: 'MORA MIAKANJO',
        tagline: 'Des vêtements qui vous ressemblent, à prix doux.',
        currency: 'Ar',
        email: 'contact@exemple.com',
        phone: '+000 00 00 000 00',
        whatsapp: '',
        address: 'Adresse de la boutique',
        hours: 'Lun – Sam : 9h – 18h',
        instagram: '',
        facebook: '',
      },
      tx,
    )
    await setSetting(
      'home',
      {
        announcement: '',
        hero_eyebrow: 'Nouvelle collection',
        hero_title: "S'habiller bien,",
        hero_highlight: 'tout simplement.',
        hero_text: 'Des vêtements qui vous ressemblent, à prix doux.',
        hero_cta: 'Découvrir la collection',
        featured_title: 'À la une',
        new_title: 'Nouveautés',
      },
      tx,
    )
    await setSetting(
      'about',
      {
        title: 'À propos de MORA MIAKANJO',
        text:
          "MORA MIAKANJO est née d'une idée simple : permettre à chacun de bien s'habiller sans se ruiner. Nous sélectionnons des pièces confortables, faciles à porter et pensées pour le quotidien.\n\n" +
          'Chaque article est choisi avec soin pour sa matière, sa coupe et sa durabilité. Notre équipe vous accueille en boutique pour vous conseiller et vous aider à trouver la tenue qui vous va.',
      },
      tx,
    )

    const categories = [
      ['femme', 'Femme', 'Robes, chemisiers et pièces légères', '#7a4e2d', 1],
      ['homme', 'Homme', 'Chemises, pantalons et essentiels', '#1b2438', 2],
      ['accessoires', 'Accessoires', 'Sacs, foulards et chapeaux', '#c49a5c', 3],
    ]
    for (const [id, label, blurb, color, sort] of categories)
      await tx.query('INSERT INTO categories (id, label, blurb, color, sort) VALUES (@id, @label, @blurb, @color, @sort)', { id, label, blurb, color, sort })

    const items = [
      ['robe-lin-terracotta', 'Robe en lin terracotta', 'femme', 85000, 'Robe midi en lin lavé, coupe fluide et ceinture à nouer. Idéale pour les journées chaudes.', ['S', 'M', 'L', 'XL'], ['Terracotta', 'Sable'], '#c8744f', true, true],
      ['chemisier-coton-blanc', 'Chemisier coton blanc', 'femme', 55000, 'Chemisier ample en coton doux, col officier et manches retroussables.', ['S', 'M', 'L'], ['Blanc'], '#e7dccb', false, false],
      ['jupe-plissee-olive', 'Jupe plissée olive', 'femme', 60000, 'Jupe longue plissée à taille élastiquée, tombé léger.', ['S', 'M', 'L', 'XL'], ['Olive', 'Noir'], '#7d7b4e', true, false],
      ['ensemble-wax', 'Ensemble imprimé wax', 'femme', 120000, 'Haut et pantalon assortis en coton imprimé, motifs colorés.', ['M', 'L', 'XL'], ['Multicolore'], '#d49a3a', false, true],
      ['chemise-lin-bleu', 'Chemise en lin bleu', 'homme', 70000, 'Chemise respirante en lin, coupe droite, boutons en nacre.', ['M', 'L', 'XL', 'XXL'], ['Bleu ciel', 'Blanc'], '#7f9fb8', true, true],
      ['pantalon-chino-beige', 'Pantalon chino beige', 'homme', 65000, 'Chino en coton stretch, confortable au quotidien comme au bureau.', ['38', '40', '42', '44'], ['Beige', 'Marine'], '#c9b48f', false, false],
      ['tshirt-essentiel', 'T-shirt essentiel', 'homme', 25000, 'T-shirt en coton épais, col rond, coupe régulière.', ['S', 'M', 'L', 'XL'], ['Noir', 'Blanc', 'Kaki'], '#3f3a35', false, false],
      ['sac-raphia', 'Sac cabas en raphia', 'accessoires', 45000, 'Cabas tressé à la main, anses en cuir, doublure intérieure.', ['Unique'], ['Naturel'], '#d8c08c', true, true],
      ['foulard-soie', 'Foulard en soie', 'accessoires', 35000, 'Foulard carré imprimé, à porter au cou, dans les cheveux ou sur un sac.', ['Unique'], ['Terracotta', 'Bleu'], '#a54b3a', false, false],
      ['chapeau-paille', 'Chapeau de paille', 'accessoires', 30000, 'Chapeau à larges bords, ruban coton, protège du soleil avec style.', ['Unique'], ['Naturel'], '#bfa06a', false, false],
    ]
    let sort = 0
    for (const [slug, name, category, price, description, sizes, colors, tone, isNew, featured] of items)
      await tx.query(
        `INSERT INTO products (slug, name, category_id, price, description, sizes, colors, tone, is_new, is_featured, sort)
         VALUES (@slug, @name, @category, @price, @description, @sizes::jsonb, @colors::jsonb, @tone, @isNew, @featured, @sort)`,
        { slug, name, category, price, description, sizes: JSON.stringify(sizes), colors: JSON.stringify(colors), tone, isNew, featured, sort: sort++ },
      )
  })
  console.log('Contenu de départ inséré (boutique, catégories, 10 produits d’exemple).')
}
