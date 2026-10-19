// Fertiges Video in videos/ + Eintrag in queue.json (naechster freier 18:00-Berlin-Slot)
// Aufruf: node scripts/enqueue.mjs <id> <mp4-pfad>
import fs from "node:fs";
const [id, mp4] = process.argv.slice(2);
const scriptPath = fs.readdirSync("scripts").filter(f => (f === `${id}.json` || f.startsWith(id + "-")) && f.endsWith(".json")).map(f => `scripts/${f}`)[0];
const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const queue  = JSON.parse(fs.readFileSync("queue.json", "utf8"));
if (queue.some(q => q.id === id)) { console.log(`Reel ${id} ist schon in der Queue.`); process.exit(0); }

// Slot: 18:00 Europe/Berlin (Winterzeit 17:00 UTC, Sommerzeit 16:00 UTC)
const berlinHourUTC = d => { const m = d.getUTCMonth(); return (m >= 3 && m <= 9) ? 16 : 17; };
const slots = queue.filter(q => q.status === "ready").map(q => new Date(q.publish_at)).sort((a, b) => a - b);
let next = new Date(); next.setUTCMinutes(0, 0, 0);
let day = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate()));
const taken = new Set(slots.map(s => s.toISOString().slice(0, 10)));
for (let i = 0; i < 60; i++) {
  const key = day.toISOString().slice(0, 10);
  const slot = new Date(day); slot.setUTCHours(berlinHourUTC(slot));
  if (!taken.has(key) && slot > new Date()) { next = slot; break; }
  day.setUTCDate(day.getUTCDate() + 1);
}
const file = `${id}-${(script.thema || "reel").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.mp4`;
fs.mkdirSync("videos", { recursive: true });
fs.copyFileSync(mp4, `videos/${file}`);
queue.push({ id, file, publish_at: next.toISOString(), status: "ready", caption: script.caption || script.title });
queue.sort((a, b) => new Date(a.publish_at) - new Date(b.publish_at));
fs.writeFileSync("queue.json", JSON.stringify(queue, null, 2) + "\n");
console.log(`Queue: ${id} -> ${next.toISOString()} (${file})`);
