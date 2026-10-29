// Neue Brand anlegen — ein Befehl, danach nur noch Secrets setzen.
// node scripts/newbrand.mjs <slug> "<Name>" "<Nische>" [targets=instagram,youtube] [slot=19:00] [accent=#E0312E]
import fs from "node:fs";

const [slug, name, niche, targetsArg, slot, accent] = process.argv.slice(2);
if (!slug || !name) { console.error('Aufruf: node scripts/newbrand.mjs <slug> "<Name>" "<Nische>" [targets] [slot] [accent]'); process.exit(1); }
const dir = `brands/${slug}`;
if (fs.existsSync(dir)) { console.error(`Brand ${slug} existiert schon.`); process.exit(1); }

const tpl = JSON.parse(fs.readFileSync("brands/_template/brand.json", "utf8"));
const brand = {
  ...tpl,
  slug, name, niche: niche || "",
  targets: (targetsArg || "instagram,youtube").split(",").map(s => s.trim()).filter(Boolean),
  schedule: { slot_berlin: slot || "19:00", per_day: 1 },
  palette: { ...tpl.palette, accent: accent || tpl.palette.accent },
  env_prefix: slug.toUpperCase().replace(/[^A-Z0-9]/g, "_"),
  active: true,
};
fs.mkdirSync(`${dir}/scripts`, { recursive: true });
fs.writeFileSync(`${dir}/brand.json`, JSON.stringify(brand, null, 2) + "\n");

const req = { instagram: ["IG_TOKEN", "IG_USER_ID"], youtube: ["YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"],
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REFRESH_TOKEN"], facebook: ["FB_PAGE_ID", "FB_PAGE_TOKEN"] };
const secrets = brand.targets.flatMap(t => (req[t] || []).map(s => `${s}_${brand.env_prefix}`));
fs.writeFileSync(`${dir}/SETUP.md`, `# ${name} — Einrichtung\n\nNische: ${niche || "-"}\nPlattformen: ${brand.targets.join(", ")}\nSlot: ${brand.schedule.slot_berlin} Berlin\n\n## Repo-Secrets setzen\n${secrets.map(s => `- [ ] \`${s}\``).join("\n")}\n\n## Danach\nScripts unter \`brands/${slug}/scripts/<id>.json\` ablegen.\nProduktion: Workflow „Reel produzieren" mit Eingabe brand=${slug}.\n`);
console.log(`Brand ${slug} angelegt. Noch zu setzen:\n` + secrets.map(s => "  " + s).join("\n"));
