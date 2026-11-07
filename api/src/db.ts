import { Db, MongoClient } from 'mongodb';
export const DB = 'DB';

export async function ensureIndexes(db: Db) {
  // Search is Mongo's text index over title + body text (extracted from the HTML at publish time).
  await db.collection('sites').createIndex({ title: 'text', text: 'text' }, { name: 'site_text', weights: { title: 5, text: 1 } });
  await db.collection('visits').createIndex({ personId: 1, at: -1, _id: -1 });
}
export async function connect(): Promise<Db> {
  const client = new MongoClient(process.env.MONGO_URL ?? 'mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db(process.env.MONGO_DB ?? 'smallweb');
  await ensureIndexes(db);
  return db;
}
