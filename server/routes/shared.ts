import { Hono } from 'hono';
import { z } from 'zod';
import { requireActor, requireRole, type AppEnv } from '../context.ts';
import { newId } from '../lib/crypto.ts';
import { badRequest, forbidden, notFound } from '../lib/errors.ts';
import { body, dateKey, id, parse, text } from '../lib/validate.ts';
import { cancelPtSession, coachSlots } from '../services/booking.ts';
import { assertCoachAccess, requireMember } from '../services/members.ts';

export const sharedRoutes = new Hono<AppEnv>()
  .get('/coaches/:id/slots', c => {
    const actor = requireRole(c, 'MEMBER', 'COACH', 'ADMIN');
    const { db, now } = c.get('deps');
    const date = parse(dateKey, c.req.query('date'));
    const coachId = parse(id, c.req.param('id'));
    if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'COACH' AND is_active = 1").get(coachId)) throw notFound('Coach tidak ditemukan.');
    return c.json({ date, slots: coachSlots(db, coachId, date, actor.role === 'MEMBER' ? actor.id : null, now()) });
  })
  /**
   * Private coach chat. A member can only write in their own thread; a coach only in the threads of
   * their own clients. Admins are deliberately not participants.
   */
  .post('/chat/messages', async c => {
    const actor = requireRole(c, 'MEMBER', 'COACH');
    const { db, now, limiters } = c.get('deps');
    limiters.chat.consume(actor.id);
    const input = await body(c, z.object({ text: text(1, 2000), threadMemberId: id.optional() }));
    let thread: string;
    if (actor.role === 'MEMBER') {
      if (input.threadMemberId && input.threadMemberId !== actor.id) throw forbidden('Anda hanya dapat menulis di percakapan Anda sendiri.');
      const m = requireMember(db, actor.id);
      if (!m.assigned_coach_id) throw badRequest('Anda belum memiliki coach. Booking sesi PT atau minta resepsionis menugaskan coach.');
      thread = actor.id;
    } else {
      if (!input.threadMemberId) throw badRequest('Pilih klien terlebih dahulu.');
      assertCoachAccess(db, actor.id, input.threadMemberId);
      thread = input.threadMemberId;
    }
    db.prepare('INSERT INTO chat_messages (id, thread_member_id, sender_id, text, created_at) VALUES (?, ?, ?, ?, ?)').run(
      newId('msg'),
      thread,
      actor.id,
      input.text,
      now().toISOString()
    );
    return c.json({ ok: true }, 201);
  })
  /** Progress photos are only readable by their owner and the owner's coach. */
  .get('/photos/:id', c => {
    const actor = requireActor(c);
    const { db, storage } = c.get('deps');
    const row = db.prepare('SELECT member_id, storage_key, mime_type FROM progress_photos WHERE id = ?').get(c.req.param('id')) as
      | { member_id: string; storage_key: string; mime_type: string }
      | undefined;
    if (!row) throw notFound('Foto tidak ditemukan.');
    if (actor.role === 'MEMBER' && row.member_id !== actor.id) throw notFound('Foto tidak ditemukan.');
    if (actor.role === 'COACH') assertCoachAccess(db, actor.id, row.member_id);
    if (actor.role === 'ADMIN') throw forbidden('Foto progres bersifat privat antara member dan coach.');
    const data = storage.read(row.storage_key);
    if (!data) throw notFound('File foto tidak ditemukan.');
    return c.body(new Uint8Array(data), 200, {
      'Content-Type': row.mime_type,
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': 'inline',
    });
  })
  .post('/pt-sessions/:id/cancel', c => {
    const actor = requireActor(c);
    const res = cancelPtSession(c.get('deps'), actor, c.req.param('id'), c.get('ip'));
    return c.json({
      ok: true,
      message: res.refunded ? 'Sesi dibatalkan. Kuota sesi dikembalikan.' : 'Sesi dibatalkan kurang dari 12 jam sebelumnya; kuota sesi hangus sesuai kebijakan.',
      refunded: res.refunded,
    });
  });
