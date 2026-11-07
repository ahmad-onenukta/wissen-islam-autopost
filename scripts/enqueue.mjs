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

// Slots aus brand.schedule: slots_berlin (Liste) hat Vorrang, sonst slot_berlin.
// Wichtig: pro Tag kann es mehrere Slots geben (per_day), deshalb wird der belegte
// Platz am genauen Zeitpunkt gemerkt und nicht am Datum - sonst bleibt es bei 1/Tag.
const sched = brand.schedule || {};
let slots = sched.slots_berlin;
if (!Array.isArray(slots) || !slots.length) {
  slots = [sched.slot_berlin || "19:00"];
  const perDay = Number(sched.per_day || 1);
  if (perDay > 1 && slots.length === 1) {
    // Kein zweiter Slot konfiguriert: Mittagsslot 7 h vor dem Abendslot ergaenzen
    const [eh, em = "00"] = slots[0].split(":");
    slots = [`${String(Math.max(0, Number(eh) - 7)).padStart(2, "0")}:${em}`, slots[0]];
  }
}
slots = [...new Set(slots)].sort();

const offset = d => { const m = d.getUTCMonth(); return (m >= 3 && m <= 9) ? 2 : 1; };  // Sommer-/Winterzeit
const taken = new Set(queue
  .filter(q => q.status === "ready" && (q.brand || DEFAULT_BRAND) === brand.slug)
  .map(q => q.publish_at));

const now = new Date();
let day = new Date(); day.setUTCHours(0, 0, 0, 0);
let next = null;
for (let i = 0; i < 90 && !next; i++) {
  for (const s of slots) {
    const [sh, sm = "0"] = s.split(":").map(Number);
    const slot = new Date(day);
    slot.setUTCHours(sh - offset(slot), sm || 0, 0, 0);
    const iso = slot.toISOString();
    if (slot > now && !taken.has(iso)) { next = slot; break; }
  }
  day.setUTCDate(day.getUTCDate() + 1);
}
if (!next) { console.error("Kein freier Slot in den naechsten 90 Tagen."); process.exit(1); }

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
