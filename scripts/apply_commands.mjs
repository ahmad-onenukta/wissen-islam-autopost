// Wendet Dashboard-Befehle auf die Queue an: dashboard/commands.json
// [{op:"pause"|"resume"|"delete"|"move"|"retarget", brand, id, at?, publish_at?, targets?}]
// Laeuft in jedem Produktions- und Posting-Lauf. Alle Operationen sind idempotent,
// Befehle aelter als TTL_H Stunden werden ignoriert -> der Aufrufer muss die Datei
// nicht zurueckschreiben (GitHub-Connector darf keine Workflows anlegen).
import fs from "node:fs";
import { DEFAULT_BRAND } from "../lib/brand.mjs";

const P = "dashboard/commands.json";
const TTL_H = Number(process.env.CMD_TTL_H || 36);

export function applyCommands() {
if (!fs.existsSync(P)) { console.log("Keine Befehle."); return false; }
let cmds = [];
try { cmds = JSON.parse(fs.readFileSync(P, "utf8")); } catch { console.log("commands.json unlesbar."); return false; }
if (!Array.isArray(cmds) || !cmds.length) { console.log("Keine Befehle."); return false; }

const fresh = c => !c.at || (Date.now() - new Date(c.at).getTime()) / 36e5 <= TTL_H;
const queue = JSON.parse(fs.readFileSync("queue.json", "utf8"));
const find = c => queue.find(q => q.id === c.id && (q.brand || DEFAULT_BRAND) === (c.brand || DEFAULT_BRAND));
const done = [];
let changed = false;

for (const c of cmds) {
  if (!fresh(c)) { done.push({ ...c, result: "verfallen" }); continue; }
  const e = find(c);
  if (!e) { done.push({ ...c, result: "nicht gefunden" }); continue; }
  const before = JSON.stringify(e);
  switch (c.op) {
    case "pause":    if (e.status === "ready")  e.status = "paused"; break;
    case "resume":   if (e.status === "paused") e.status = "ready";  break;
    case "delete":   queue.splice(queue.indexOf(e), 1); changed = true; break;
    case "move":     if (c.publish_at) e.publish_at = c.publish_at; break;
    case "retarget": if (Array.isArray(c.targets)) e.targets = c.targets; break;
    default: done.push({ ...c, result: "unbekannt" }); continue;
  }
  if (JSON.stringify(e) !== before) changed = true;
  done.push({ ...c, result: "ok" });
}

if (changed) {
  queue.sort((a, b) => new Date(a.publish_at || 0) - new Date(b.publish_at || 0));
  fs.writeFileSync("queue.json", JSON.stringify(queue, null, 2) + "\n");
}
try {
  const hist = fs.existsSync("dashboard/commands-log.json") ? JSON.parse(fs.readFileSync("dashboard/commands-log.json", "utf8")) : [];
  hist.push({ at: new Date().toISOString(), changed, applied: done });
  fs.mkdirSync("dashboard", { recursive: true });
  fs.writeFileSync("dashboard/commands-log.json", JSON.stringify(hist.slice(-200), null, 2) + "\n");
} catch {}
console.log(`Befehle: ${done.length} geprueft, Queue ${changed ? "geaendert" : "unveraendert"} ->`, JSON.stringify(done));
return changed;
}

// Direktaufruf (node scripts/apply_commands.mjs) vs. Import aus post.mjs/produce
applyCommands();
