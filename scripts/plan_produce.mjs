// Plant, welche Reels produziert werden: pro aktiver Brand bis MIN_RUNWAY Tage Vorlauf.
// Gibt eine JSON-Matrix aus: [{"brand":"nurwissen","id":"016"}, ...]
import fs from "node:fs";
import { listBrands, DEFAULT_BRAND } from "../lib/brand.mjs";

const MIN = Number(process.env.MIN_RUNWAY || 3);
const queue = JSON.parse(fs.readFileSync("queue.json", "utf8"));
const posted = fs.existsSync("posted.json") ? JSON.parse(fs.readFileSync("posted.json", "utf8")) : [];
const used = new Set([...queue, ...posted].map(e => `${e.brand || DEFAULT_BRAND}/${e.id}`));

const scriptsFor = brand => {
  const dirs = [`brands/${brand}/scripts`, ...(brand === DEFAULT_BRAND ? ["scripts"] : [])];
  const order = [];
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    const ord = `${d}/ORDER.txt`;
    if (fs.existsSync(ord)) order.push(...(fs.readFileSync(ord, "utf8").match(/^\d{3}/gm) || []));
    order.push(...fs.readdirSync(d).filter(f => /^\d{3}.*\.json$/.test(f)).map(f => f.slice(0, 3)).sort());
  }
  return [...new Set(order)];
};

const jobs = [];
const want = process.env.IN_BRAND ? [process.env.IN_BRAND] : null;
for (const b of listBrands({ activeOnly: true })) {
  if (want && !want.includes(b.slug)) continue;
  if (process.env.IN_ID) { jobs.push({ brand: b.slug, id: process.env.IN_ID }); continue; }
  const ready = queue.filter(q => (q.brand || DEFAULT_BRAND) === b.slug && q.status === "ready" && new Date(q.publish_at) > new Date()).length;
  let missing = Math.max(0, MIN - ready);
  for (const id of scriptsFor(b.slug)) {
    if (!missing) break;
    if (used.has(`${b.slug}/${id}`)) continue;
    jobs.push({ brand: b.slug, id }); used.add(`${b.slug}/${id}`); missing--;
  }
}
process.stdout.write(JSON.stringify(jobs));
