/**
 * Creates the first ADMIN account. Credentials come from the environment so the password
 * never lands in shell history or process listings:
 *   ADMIN_NAME="Nama" ADMIN_EMAIL=owner@domain.com ADMIN_PHONE=0812... ADMIN_PASSWORD='...' npm run admin:create
 */
import { loadConfig } from '../server/config.ts';
import { migrate, openDatabase } from '../server/db/index.ts';
import { hashPassword, newId } from '../server/lib/crypto.ts';
import { email, parse, password, phone, text } from '../server/lib/validate.ts';

const config = loadConfig();
const input = {
  name: parse(text(2, 120), process.env.ADMIN_NAME),
  email: parse(email, process.env.ADMIN_EMAIL),
  phone: parse(phone, process.env.ADMIN_PHONE),
  password: parse(password, process.env.ADMIN_PASSWORD),
};

const db = openDatabase(config.databasePath);
migrate(db);
const now = new Date().toISOString();
try {
  db.prepare(
    `INSERT INTO users (id, role, name, email, phone, phone_digits, password_hash, created_at, updated_at)
     VALUES (?, 'ADMIN', ?, ?, ?, ?, ?, ?, ?)`
  ).run(newId('admin'), input.name, input.email, input.phone, input.phone.replace(/\D/g, ''), await hashPassword(input.password), now, now);
  console.info(`Admin ${input.email} dibuat di ${config.databasePath}.`);
} catch (err) {
  if (String((err as { code?: string }).code).startsWith('SQLITE_CONSTRAINT')) {
    console.error('Email atau nomor telepon sudah terdaftar.');
    process.exitCode = 1;
  } else throw err;
} finally {
  db.close();
}
