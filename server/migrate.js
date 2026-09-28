// Applique dans l'ordre les scripts server/sql/NNN_*.sql qui ne l'ont pas encore été.
import fs from 'node:fs'
import path from 'node:path'
import { SERVER_DIR, exec, query, transaction } from './db.js'

const SQL_DIR = path.join(SERVER_DIR, 'sql')

export async function migrate() {
  await exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(200) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`)
  const done = new Set((await query('SELECT name FROM schema_migrations')).map((r) => r.name))
  const files = fs
    .readdirSync(SQL_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()

  for (const file of files) {
    if (done.has(file)) continue
    const sql = fs.readFileSync(path.join(SQL_DIR, file), 'utf8')
    try {
      await transaction(async (tx) => {
        await tx.exec(sql)
        await tx.query('INSERT INTO schema_migrations (name) VALUES (@file)', { file })
      })
      console.log(`Migration appliquée : ${file}`)
    } catch (e) {
      throw new Error(`Échec de la migration ${file} : ${e.message}`)
    }
  }
}
