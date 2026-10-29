// Wendet Dashboard-Befehle auf die Queue an: dashboard/commands.json
// [{op:"pause"|"resume"|"delete"|"move"|"retarget", brand, id, publish_at?, targets?}]
import fs from "node:fs";
import { DEFAULT_BRAND } from "../lib/brand.mjs";

const P = "dashboard/commands.json";
if (!fs.existsSync(P)) { console.log("Keine Befehle."); process.exit(0); }
const cmds = JSON.parse(fs.readFileSync(P, "utf8"));
if (!cmds.length) { console.log("Keine Befehle."); process.exit(0); }
const queue = JSON.parse(fs.readFileSync("queue.json", "utf8"));
const find = c => queue.find(q => q.id === c.id && (q.brand || DEFAULT_BRAND) === (c.brand || DEFAULT_BRAND));
const done = [];

for (const c of cmds) {
  const e = find(c);
  if (!e) { done.push({ ...c, result: "nicht gefunden" }); continue; }
  switch (c.op) {
    case "pause":     if (e.status === "ready") e.status = "paused"; break;
    case "resume":    if (e.status === "paused") e.status = "ready"; break;
    case "delete":    queue.splice(queue.indexOf(e), 1); break;
    case "move":      if (c.publish_at) e.publish_at = c.publish_at; break;
    case "retarget":  if (Array.isArray(c.targets)) e.targets = c.targets; break;
    default:          done.push({ ...c, result: "unbekannt" }); continue;
  }
  done.push({ ...c, result: "ok" });
}
queue.sort((a, b) => new Date(a.publish_at || 0) - new Date(b.publish_at || 0));
fs.writeFileSync("queue.json", JSON.stringify(queue, null, 2) + "\n");
fs.writeFileSync(P, "[]\n");
fs.mkdirSync("dashboard", { recursive: true });
const hist = fs.existsSync("dashboard/commands-log.json") ? JSON.parse(fs.readFileSync("dashboard/commands-log.json", "utf8")) : [];
hist.push({ at: new Date().toISOString(), applied: done });
fs.writeFileSync("dashboard/commands-log.json", JSON.stringify(hist.slice(-200), null, 2) + "\n");
console.log("Befehle angewendet:", JSON.stringify(done));
