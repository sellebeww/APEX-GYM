import type { DB } from '../db/index.ts';
import { newId } from './crypto.ts';

export interface AuditActor {
  id: string | null;
  name: string;
  role: string;
}

export const SYSTEM_ACTOR: AuditActor = { id: null, name: 'Sistem', role: 'SYSTEM' };

/** Append-only audit trail. Call inside the same transaction as the change it describes. */
export function audit(db: DB, actor: AuditActor, action: string, details: string, ip: string | null = null, at = new Date()) {
  db.prepare(
    'INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(newId('log'), actor.id, actor.name, actor.role, action, details.slice(0, 1000), ip, at.toISOString());
}
