import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { DB } from './db';
import { normalizeAddress } from './address';
import { extractText, snippet } from './text';

@Injectable()
export class SitesService {
  constructor(@Inject(DB) private db: Db) {}

  async people() {
    const sites = await this.db.collection<any>('sites').aggregate([{ $group: { _id: '$authorId', n: { $sum: 1 } } }]).toArray();
    const n = new Map(sites.map((s: any) => [s._id, s.n]));
    const people = await this.db.collection<any>('people').find().sort({ name: 1 }).toArray();
    return people.map((p: any) => ({ id: p._id, name: p.name, siteCount: n.get(p._id) ?? 0 }));
  }

  async list() {
    const rows = await this.db.collection<any>('sites').find({}, { projection: { title: 1, address: 1, authorId: 1 } }).sort({ _id: 1 }).toArray();
    const people = new Map((await this.db.collection<any>('people').find().toArray()).map((p: any) => [p._id, p.name]));
    return rows.map((s: any) => ({ address: s.address, title: s.title, authorName: people.get(s.authorId) ?? 'unknown' }));
  }

  async publish(b: any) {
    const address = normalizeAddress(b?.address);
    if (!address) throw new BadRequestException('address must look like name.zz (or name.zz/path)');
    const title = typeof b?.title === 'string' ? b.title.trim() : '';
    if (!title || title.length > 120) throw new BadRequestException('title required, max 120 chars');
    const html = typeof b?.html === 'string' ? b.html : '';
    if (!html.trim() || html.length > 100_000) throw new BadRequestException('html required, max 100,000 chars');
    const author = typeof b?.authorId === 'string' ? await this.db.collection<any>('people').findOne({ _id: b.authorId }) : null;
    if (!author) throw new BadRequestException('unknown author');
    try {
      // First publish wins; there is no edit. (Knowingly left out: edits and ownership transfer.)
      await this.db.collection<any>('sites').insertOne({
        _id: address, address, title, html, text: extractText(html), authorId: author._id, createdAt: new Date(),
      });
    } catch (e: any) {
      if (e.code === 11000) throw new ConflictException(`${address} is already taken`);
      throw e;
    }
    return { address, title };
  }

  async search(q: string) {
    q = (q ?? '').trim().slice(0, 200);
    if (!q) return { query: q, results: [] };
    const rows = await this.db.collection<any>('sites')
      .find({ $text: { $search: q } }, { projection: { score: { $meta: 'textScore' }, address: 1, title: 1, text: 1, authorId: 1 } })
      .sort({ score: { $meta: 'textScore' }, _id: 1 }).limit(30).toArray();
    const people = new Map((await this.db.collection<any>('people').find().toArray()).map((p: any) => [p._id, p.name]));
    return {
      query: q,
      results: rows.map((s: any) => ({ address: s.address, title: s.title, authorName: people.get(s.authorId) ?? 'unknown', snippet: snippet(s.text, q) })),
    };
  }

  async history(personId: string, limitRaw: any, before?: string) {
    const limit = Math.min(Math.max(parseInt(limitRaw) || 30, 1), 100);
    const filter: any = { personId };
    if (before) {
      const [iso, id] = before.split('|');
      const at = new Date(iso);
      if (isNaN(+at)) throw new BadRequestException('bad cursor');
      filter.$or = [{ at: { $lt: at } }, { at, _id: { $lt: id } }];
    }
    const rows = await this.db.collection<any>('visits').find(filter).sort({ at: -1, _id: -1 }).limit(limit + 1).toArray();
    const page = rows.slice(0, limit);
    const sites = await this.db.collection<any>('sites')
      .find({ _id: { $in: [...new Set(page.map((v: any) => v.address))] } }, { projection: { title: 1 } }).toArray();
    const titles = new Map(sites.map((s: any) => [s._id, s.title]));
    const last = page[page.length - 1];
    return {
      items: page.map((v: any) => ({ id: String(v._id), address: v.address, at: v.at, via: v.via, found: v.found, from: v.from, title: titles.get(v.address) ?? null })),
      next: rows.length > limit && last ? `${last.at.toISOString()}|${last._id}` : null,
    };
  }
}
