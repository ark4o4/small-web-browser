// Seeds an isolated database twice and proves the data is identical both times.
// Needs Mongo running (npm run db). Uses its own database, so real data is untouched.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';

const DB = 'smallweb_seedcheck';
const url = process.env.MONGO_URL ?? 'mongodb://127.0.0.1:27017';
const env = { ...process.env, MONGO_DB: DB };

async function snapshot(client: MongoClient) {
  const db = client.db(DB);
  const counts: Record<string, number> = {};
  const hash = createHash('sha256');
  for (const name of ['people', 'sites', 'visits']) {
    const docs = await db.collection(name).find().sort({ _id: 1 }).toArray();
    counts[name] = docs.length;
    hash.update(JSON.stringify(docs));
  }
  return { counts, hash: hash.digest('hex') };
}

async function main() {
  const client = new MongoClient(url);
  await client.connect();
  await client.db(DB).dropDatabase();
  const run = () => execSync('npx ts-node --transpile-only src/seed.ts', { cwd: __dirname + '/..', env, stdio: 'inherit' });

  run();
  const first = await snapshot(client);
  run();
  const second = await snapshot(client);

  await client.db(DB).dropDatabase();
  await client.close();

  console.log('after seed 1:', first.counts, first.hash.slice(0, 12));
  console.log('after seed 2:', second.counts, second.hash.slice(0, 12));
  if (first.hash !== second.hash || JSON.stringify(first.counts) !== JSON.stringify(second.counts)) {
    console.error('FAIL: seeding twice changed the data');
    process.exit(1);
  }
  console.log('OK: seeding twice gives identical data');
}
main().catch((e) => { console.error(e); process.exit(1); });