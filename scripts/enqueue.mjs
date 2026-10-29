// Fertiges Video in videos/ + Eintrag in queue.json (naechster freier Slot DIESER Brand)
// Aufruf: node scripts/enqueue.mjs <id> <mp4-pfad> [brand]
import fs from "node:fs";
import { loadBrand, DEFAULT_BRAND } from "../lib/brand.mjs";

const [id, mp4, brandArg] = process.argv.slice(2);
const brand = loadBrand(brandArg || process.env.BRAND || DEFAULT_BRAND);
const scriptPath = [`brands/${brand.slug}/scripts`, "scripts"]
  .filter(d => fs.existsSync(d))
  .flatMap(d => fs.readdirSync(d).filter(f => (f === `${id}.json` || f.startsWith(id + "-")) && f.endsWith(".json")).map(f => `${d}/${f}`))[0];
const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const queue  = JSON.parse(fs.readFileSync("queue.json", "utf8"));
if (queue.some(q => q.id === id && (q.brand || DEFAULT_BRAND) === brand.slug)) {
  console.log(`Reel ${id} (${brand.slug}) ist schon in der Queue.`); process.exit(0);
}

// Slot aus brand.schedule.slot_berlin, in UTC umgerechnet (Sommer-/Winterzeit)
const [h] = (brand.schedule?.slot_berlin || "19:00").split(":").map(Number);
const utcHour = d => { const m = d.getUTCMonth(); return h - ((m >= 3 && m <= 9) ? 2 : 1); };
const taken = new Set(queue
  .filter(q => q.status === "ready" && (q.brand || DEFAULT_BRAND) === brand.slug)
  .map(q => q.publish_at.slice(0, 10)));
let day = new Date(); day.setUTCHours(0, 0, 0, 0);
let next = null;
for (let i = 0; i < 90 && !next; i++) {
  const slot = new Date(day); slot.setUTCHours(utcHour(slot), 0, 0, 0);
  if (!taken.has(slot.toISOString().slice(0, 10)) && slot > new Date()) next = slot;
  day.setUTCDate(day.getUTCDate() + 1);
}

const file = `${brand.slug}-${id}-${(script.thema || script.title || "reel").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.mp4`;
fs.mkdirSync("videos", { recursive: true });
fs.copyFileSync(mp4, `videos/${file}`);
queue.push({
  id, brand: brand.slug, file, publish_at: next.toISOString(), status: "ready",
  targets: brand.targets || ["instagram"],
  caption: script.caption || script.title,
  first_comment: script.first_comment || brand.caption?.cta || "",
  thumb_offset: script.thumb_offset ?? 3000,
});
queue.sort((a, b) => new Date(a.publish_at) - new Date(b.publish_at));
fs.writeFileSync("queue.json", JSON.stringify(queue, null, 2) + "\n");
console.log(`Queue: ${brand.slug}/${id} -> ${next.toISOString()} (${file})`);
