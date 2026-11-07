import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Db } from 'mongodb';
import { DB } from './db';
import { normalizeAddress } from './address';
import { back, emptyNav, entryKey, forward, go, NavState, setScroll, Target } from './nav';

const VIA = ['typed', 'link', 'history', 'search'];

@Injectable()
export class NavService {
  constructor(@Inject(DB) private db: Db) {}

  async assertPerson(id: string) {
    if (!(await this.db.collection<any>('people').findOne({ _id: id }))) throw new NotFoundException('no such person');
  }

  // Optimistic concurrency on one document per person: read, compute (pure), write if rev unchanged.
  private async apply(personId: string, op: (s: NavState) => NavState | null) {
    const navs = this.db.collection<any>('navs');
    for (let i = 0; i < 8; i++) {
      const doc = await navs.findOne({ _id: personId });
      const before: NavState = doc ? { entries: doc.entries, cursor: doc.cursor } : emptyNav();
      const after = op(before);
      if (!after) return { before, after: before, changed: false };
      try {
        if (doc) {
          const r = await navs.updateOne({ _id: personId, rev: doc.rev }, { $set: { entries: after.entries, cursor: after.cursor, rev: doc.rev + 1 } });
          if (r.matchedCount === 1) return { before, after, changed: true };
        } else {
          await navs.insertOne({ _id: personId, entries: after.entries, cursor: after.cursor, rev: 1 });
          return { before, after, changed: true };
        }
      } catch (e: any) { if (e.code !== 11000) throw e; }
    }
    throw new ConflictException('navigation busy, try again');
  }

  async view(personId: string, state?: NavState) {
    if (!state) {
      await this.assertPerson(personId);
      const d = await this.db.collection<any>('navs').findOne({ _id: personId });
      state = d ? { entries: d.entries, cursor: d.cursor } : emptyNav();
    }
    const e = state.entries[state.cursor];
    let current: any = null;
    if (e?.kind === 'page') {
      const addr = normalizeAddress(e.address);
      const site = addr ? await this.db.collection<any>('sites').findOne({ _id: addr }) : null;
      const author = site ? await this.db.collection<any>('people').findOne({ _id: site.authorId }) : null;
      current = {
        kind: 'page', address: addr ?? e.address, valid: !!addr, scrollY: e.scrollY,
        site: site ? { address: site.address, title: site.title, authorName: author?.name ?? 'unknown', html: site.html } : null,
      };
    } else if (e?.kind === 'search') current = { kind: 'search', query: e.query, scrollY: e.scrollY };
    return { cursor: state.cursor, length: state.entries.length, canBack: state.cursor > 0, canForward: state.cursor < state.entries.length - 1, current };
  }

  private async visit(personId: string, state: NavState, prev: NavState, via: string) {
    const e = state.entries[state.cursor];
    if (e?.kind !== 'page') return; // searches are not addresses, so not visits
    const addr = normalizeAddress(e.address);
    const found = addr ? !!(await this.db.collection<any>('sites').findOne({ _id: addr }, { projection: { _id: 1 } })) : false;
    const p = prev.entries[prev.cursor];
    await this.db.collection<any>('visits').insertOne({
      personId, address: addr ?? e.address, at: new Date(), via, found,
      from: p?.kind === 'page' ? p.address : null,
    });
  }

  async go(personId: string, body: any) {
    await this.assertPerson(personId);
    const t = body?.target;
    let target: Target;
    if (t?.kind === 'page' && typeof t.address === 'string') target = { kind: 'page', address: t.address.trim().slice(0, 200) };
    else if (t?.kind === 'search' && typeof t.query === 'string' && t.query.trim()) target = { kind: 'search', query: t.query.trim().slice(0, 200) };
    else throw new BadRequestException('bad target');
    if (target.kind === 'page') target.address = normalizeAddress(target.address) ?? target.address;
    const via = VIA.includes(body?.via) ? body.via : 'typed';
    const y = this.y(body?.scrollY);
    const r = await this.apply(personId, (s) => go(s, target, y));
    await this.visit(personId, r.after, r.before, via);
    return this.view(personId, r.after);
  }
  async back(personId: string, body: any) { return this.step(personId, body, back, 'back'); }
  async forward(personId: string, body: any) { return this.step(personId, body, forward, 'forward'); }
  private async step(personId: string, body: any, fn: typeof back, via: string) {
    await this.assertPerson(personId);
    const y = this.y(body?.scrollY);
    const r = await this.apply(personId, (s) => fn(s, y));
    if (r.changed) await this.visit(personId, r.after, r.before, via); // arriving by back/forward is still a visit
    return this.view(personId, r.after);
  }

  // Persist scroll for reloads. No-op if the reader has already moved on (cursor/key mismatch).
  async scroll(personId: string, body: any) {
    await this.assertPerson(personId);
    const y = this.y(body?.scrollY);
    await this.apply(personId, (s) => {
      const e = s.entries[s.cursor];
      if (!e || s.cursor !== body?.cursor || entryKey(e) !== body?.key) return null;
      return setScroll(s, y);
    });
    return { ok: true };
  }
  private y(v: any) { return typeof v === 'number' && isFinite(v) && v >= 0 ? Math.min(v, 1e7) : 0; }
}
