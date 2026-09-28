// Carnet clients : une fiche par e-mail ou par téléphone, créée ou mise à jour à chaque commande ou message.

const phoneKey = (phone) => (phone || '').replace(/\D/g, '') || null

// À appeler dans une transaction : tx = { query, one }
export async function upsertCustomer(tx, { name, email, phone }) {
  const em = email ? email.trim().toLowerCase() : null
  const pk = phoneKey(phone)
  if (!em && !pk) return null

  // Verrous de transaction par e-mail / téléphone : deux commandes simultanées du même client ne créent pas deux fiches
  if (em) await tx.query(`SELECT pg_advisory_xact_lock(hashtext('customer:email:' || @em::text))`, { em })
  if (pk) await tx.query(`SELECT pg_advisory_xact_lock(hashtext('customer:phone:' || @pk::text))`, { pk })

  const existing = await tx.one(
    `SELECT id FROM customers
     WHERE (@em::text IS NOT NULL AND email = @em::text) OR (@pk::text IS NOT NULL AND phone_key = @pk::text)
     ORDER BY CASE WHEN email = @em::text THEN 0 ELSE 1 END
     LIMIT 1`,
    { em, pk },
  )

  if (existing) {
    // Complète l'e-mail ou le téléphone manquant, sauf s'ils appartiennent déjà à une autre fiche
    await tx.query(
      `UPDATE customers c SET
         name = @name,
         email = CASE WHEN c.email IS NULL AND @em::text IS NOT NULL
                       AND NOT EXISTS (SELECT 1 FROM customers x WHERE x.email = @em::text) THEN @em::text ELSE c.email END,
         phone = CASE WHEN c.phone_key IS NULL AND @pk::text IS NOT NULL
                       AND NOT EXISTS (SELECT 1 FROM customers x WHERE x.phone_key = @pk::text) THEN @phone::text ELSE c.phone END,
         phone_key = CASE WHEN c.phone_key IS NULL AND @pk::text IS NOT NULL
                       AND NOT EXISTS (SELECT 1 FROM customers x WHERE x.phone_key = @pk::text) THEN @pk::text ELSE c.phone_key END,
         last_contact_at = now()
       WHERE c.id = @id`,
      { id: existing.id, name, em, pk, phone: phone || null },
    )
    return existing.id
  }

  const row = await tx.one(
    `INSERT INTO customers (name, email, phone, phone_key) VALUES (@name, @em, @phone, @pk) RETURNING id`,
    { name, em, phone: phone || null, pk },
  )
  return row.id
}
