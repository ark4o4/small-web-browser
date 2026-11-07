// Deterministic + idempotent: fixed ids (people slug, site address, visit "seed:<person>:<n>"),
// a fixed reference time, a fixed PRNG seed, and upserts. Running it twice changes nothing.
import { MongoClient } from 'mongodb';
import { ensureIndexes } from './db';
import { extractText } from './text';

const T0 = Date.parse('2025-03-10T09:00:00Z');
const HOUR = 3600_000;

const PEOPLE = [
  { id: 'ines', name: 'Ines Varga' }, { id: 'tomas', name: 'Tomas Reyes' }, { id: 'wren', name: 'Wren Okafor' },
  { id: 'amara', name: 'Amara Lindqvist' }, { id: 'juno', name: 'Juno Park' },
];
const L = (a: string, t?: string) => `<a href="${a}">${t ?? a}</a>`;
const page = (h: string, ...ps: string[]) => `<h1>${h}</h1>\n${ps.map((p) => `<p>${p}</p>`).join('\n')}`;

const SITES: { address: string; title: string; authorId: string; html: string }[] = [
  { address: 'tidepool.zz', title: 'Tidepool', authorId: 'wren', html: page('Tidepool',
    'Twice a day the sea leaves a little of itself behind in the rocks. A tidepool is a pocket of ocean that has to survive six hours of sun, rain and shrinking water before the next tide returns, and the animals that live in one are the toughest small things on the shore.',
    `The pull of the moon sets the rhythm; there is a long record of it in the ${L('moonlog.zz', 'Moonlog')}. Further up the coast the water slows and spreads into the ${L('saltmarsh.zz', 'salt marsh')}, where the same tide does very different work.`,
    `A chapter on sea stars was meant to live at ${L('driftwood.zz', 'driftwood.zz')}, but nobody ever published it.`) },
  { address: 'saltmarsh.zz', title: 'Salt Marsh Field Notes', authorId: 'wren', html: page('Salt Marsh Field Notes',
    'Cordgrass is the quiet engineer of the marsh. It stands in water that would kill most plants, sheds the salt through its leaves, and its roots hold the mud together so the tide cannot carry it away. Behind the grass, channels branch like veins and fiddler crabs wave their one oversized claw.',
    `Read how the water arrives in ${L('tidepool.zz', 'Tidepool')}, or see why the herons keep such strict hours in the ${L('weatherglass.zz', 'barometer notes')}.`,
    'Best visited an hour after low water, when the mud is bright and the birds are working.') },
  { address: 'moonlog.zz', title: 'Moonlog', authorId: 'ines', html: page('Moonlog',
    'I have written down the moon every clear night for six years: phase, height, colour, and whatever else was moving. A waxing crescent after rain is the best thing I know. The log is plain on purpose, one line a night, so that the gaps are honest.',
    `The tides in my notebook line up with the ${L('tidepool.zz', 'tidepool survey')}. When it clouds over I write letters instead; those live at ${L('slowmail.zz', 'Slow Mail')}.`,
    `An older version of this log is at ${L('old.moonlog.zz', 'old.moonlog.zz')}, which I deleted after a bad winter.`) },
  { address: 'slowmail.zz', title: 'Slow Mail', authorId: 'ines', html: page('Slow Mail',
    'A letter takes time to write, time to arrive, and time to answer, and that is the whole point. This site is a small campaign for writing to one person at length instead of to everyone in a sentence. Use good paper. Say something specific. Do not apologise for the pen.',
    `Cloudy nights are good for it; I started after reading the ${L('moonlog.zz', 'Moonlog')} back to myself. Some correspondents draw their replies, and the best of those are collected by ${L('cartogram.zz', 'Cartogram')}.`,
    'Rule of thumb: if you could say it in a text, you should not be sending a letter.') },
  { address: 'kettle.zz', title: 'The Kettle Almanac', authorId: 'tomas', html: page('The Kettle Almanac',
    'A year of cooking organised by what is actually in season rather than by what is fashionable. March is rhubarb and the first sorrel. August is more tomatoes than anyone can reasonably eat. The kettle is always on; the rest of the stove is flexible.',
    `Foraged things go better with a guide, and mine is ${L('hollowpine.zz', 'Hollow Pine')}. If a recipe needs patience, a forge is a good place to wait; see ${L('ferrous.zz', 'Ferrous')} for an iron pan that will outlive you.`,
    `A winter section was planned at ${L('kettle.zz/winter', 'kettle.zz/winter')} and has not happened.`) },
  { address: 'hollowpine.zz', title: 'Hollow Pine', authorId: 'tomas', html: page('Hollow Pine',
    'Notes from a patch of old woodland: which mushrooms come up after which rain, where the owls roost, how to tell a beech from a hornbeam by the bark alone. Everything is written from memory and corrected from the field the next day.',
    `Anything edible ends up in ${L('kettle.zz', 'the Kettle Almanac')}. After dark I walk the same paths and the lanterns of ${L('lanternpost.zz', 'Lantern Post')} are a good companion.`,
    'Bring boots. The path floods in the second field and nobody has ever fixed it.') },
  { address: 'ferrous.zz', title: 'Ferrous', authorId: 'amara', html: page('Ferrous',
    'Beginner blacksmithing in a garage. Iron at working heat is the colour of a ripe apricot; anything darker is too cold to move and anything brighter is starting to burn. Most of the craft is learning to see that, and to stop hitting things that have gone dull.',
    `The first useful thing I made was a hook for ${L('kettle.zz', 'a kitchen')}, then a bracket for a shelf of maps from ${L('cartogram.zz', 'Cartogram')}.`,
    `I owe a tutorial on hardening at ${L('quenchbath.zz', 'quenchbath.zz')}. It does not exist yet.`) },
  { address: 'cartogram.zz', title: 'Cartogram', authorId: 'amara', html: page('Cartogram',
    'Hand-drawn maps of places that are too small for real maps: one street, a school yard, the route between two benches. A good small map leaves out almost everything and keeps the one turn you would otherwise miss.',
    `Maps arrive here by post, usually after a long exchange of the sort promoted at ${L('slowmail.zz', 'Slow Mail')}. Walkers trade routes with ${L('lanternpost.zz', 'Lantern Post')}.`,
    'Scale bars are optional. Compass roses are not.') },
  { address: 'lanternpost.zz', title: 'Lantern Post', authorId: 'juno', html: page('Lantern Post',
    'A zine about walking at night. Each issue is one route, mapped by hand and walked at least twice, once with a torch and once without. The unlit walk is always the better one, and always slower than you expect.',
    `Routes are drawn up with help from ${L('cartogram.zz', 'Cartogram')}; the woodland ones borrow from ${L('hollowpine.zz', 'Hollow Pine')}. Weather decides everything, so read ${L('weatherglass.zz', 'Weatherglass')} first.`,
    `Back issues were hosted at ${L('ghostcrab.zz', 'ghostcrab.zz')} before the whole thing vanished.`) },
  { address: 'weatherglass.zz', title: 'Weatherglass', authorId: 'juno', html: page('Weatherglass',
    'A brass barometer on a wall tells you more than the forecast if you watch it for a week. A fast fall means wind within a day. A slow rise after rain means you can hang the washing. This site keeps a daily reading and says plainly when the glass was wrong.',
    `Wading birds seem to read the same pressure; the ${L('saltmarsh.zz', 'marsh notes')} have a table. For the water itself, start at ${L('tidepool.zz', 'Tidepool')}.`,
    'Tap the glass gently before reading it. Old habit, but it works.') },
];

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const links = (addr: string) => {
  const s = SITES.find((x) => x.address === addr);
  return s ? [...s.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]) : [];
};
const exists = (a: string) => SITES.some((s) => s.address === a);
const ADDRS = SITES.map((s) => s.address);

type V = { _id: string; personId: string; address: string; at: Date; via: string; found: boolean; from: string | null };

function history(): V[] {
  const out: V[] = [];
  PEOPLE.forEach((p, k) => {
    const r = rng(1000 + k);
    let t = T0 + Math.floor(r() * 120) * 1000, n = 0;
    let cur: string | null = null, prev: string | null = null;
    const push = (address: string, via: string, dwell: number) => {
      out.push({ _id: `seed:${p.id}:${String(n++).padStart(3, '0')}`, personId: p.id, address, at: new Date(t), via, found: exists(address), from: cur });
      prev = cur; cur = address; t += dwell * 1000;
    };
    if (p.id === 'ines') {
      // The one who has been nearly everywhere: a full tour, then a second lap of favourites.
      const tour = [...ADDRS, 'driftwood.zz', 'old.moonlog.zz', 'quenchbath.zz'];
      for (let i = 0; t < T0 + HOUR; i++) {
        const a = tour[i % tour.length];
        push(a, cur && links(cur).includes(a) ? 'link' : 'typed', 70 + Math.floor(r() * 60));
      }
      return;
    }
    while (t < T0 + HOUR) {
      const dwell = 25 + Math.floor(r() * 90);
      if (cur === null) push(ADDRS[Math.floor(r() * ADDRS.length)], 'typed', dwell);
      else if (!exists(cur)) {
        if (prev && r() < 0.6) push(prev, 'back', dwell); else push(ADDRS[Math.floor(r() * ADDRS.length)], 'typed', dwell);
      } else if (r() < 0.12) push(ADDRS[Math.floor(r() * ADDRS.length)], 'typed', dwell);
      else { const ls = links(cur); push(ls[Math.floor(r() * ls.length)], 'link', dwell); }
    }
  });
  return out;
}

async function main() {
  const client = new MongoClient(process.env.MONGO_URL ?? 'mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db(process.env.MONGO_DB ?? 'smallweb');
  await ensureIndexes(db);
  const up = (docs: any[]) => docs.map((d) => ({ replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true } }));
  await db.collection<any>('people').bulkWrite(up(PEOPLE.map((p) => ({ _id: p.id, name: p.name }))));
  await db.collection<any>('sites').bulkWrite(up(SITES.map((s) => ({
    _id: s.address, ...s, text: extractText(s.html), createdAt: new Date(T0 - 86400_000),
  }))));
  const visits = history();
  await db.collection<any>('visits').bulkWrite(up(visits));
  const per = PEOPLE.map((p) => `${p.id}:${visits.filter((v) => v.personId === p.id).length}`).join(' ');
  console.log(`seeded ${PEOPLE.length} people, ${SITES.length} sites, ${visits.length} visits (${per})`);
  await client.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
