// Aggregiert den Fabrik-Zustand in dashboard/state.json (vom Dashboard per raw.githubusercontent gelesen)
import fs from "node:fs";
import { listBrands, DEFAULT_BRAND } from "../lib/brand.mjs";

const j = (p, d) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : d;
const queue = j("queue.json", []), posted = j("posted.json", []), stats = j("engage/stats.json", {});
const brands = listBrands();
const scripts = fs.existsSync("scripts") ? fs.readdirSync("scripts").filter(f => /^\d{3}.*\.json$/.test(f)) : [];
const inQueue = new Set(queue.map(q => q.id));

const state = {
  generated_at: new Date().toISOString(),
  brands: brands.map(b => {
    const q = queue.filter(x => (x.brand || DEFAULT_BRAND) === b.slug);
    return {
      slug: b.slug, name: b.name, niche: b.niche, accent: b.palette?.accent,
      targets: b.targets, slot: b.schedule?.slot_berlin, active: b.active !== false,
      handle: b.handle,
      ready: q.filter(x => x.status === "ready").length,
      posted: q.filter(x => x.status === "posted").length,
      next: q.filter(x => x.status === "ready").sort((a, c) => new Date(a.publish_at) - new Date(c.publish_at))[0]?.publish_at || null,
      runway_days: q.filter(x => x.status === "ready").length,
    };
  }),
  queue: queue.map(q => ({ id: q.id, brand: q.brand || DEFAULT_BRAND, status: q.status, publish_at: q.publish_at || q.posted_at,
    targets: q.targets || null, caption: (q.caption || "").slice(0, 160), media_id: q.media_id || null, results: q.results || null })),
  scripts_unqueued: scripts.map(f => f.match(/^(\d{3})/)[1]).filter(id => !inQueue.has(id)),
  posted_total: posted.length,
  stats,
};
fs.mkdirSync("dashboard", { recursive: true });
fs.writeFileSync("dashboard/state.json", JSON.stringify(state, null, 2) + "\n");
console.log(`state.json: ${state.brands.length} Brands, ${state.queue.length} Queue-Eintraege, ${state.scripts_unqueued.length} offene Scripts`);
