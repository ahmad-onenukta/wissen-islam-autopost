// Brand-Registry — eine Datei pro Kanal unter brands/<slug>/brand.json
// Secrets kommen aus env mit Brand-Prefix, mit Fallback auf die alten globalen Namen.
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_BRAND = process.env.DEFAULT_BRAND || "nurwissen";

export function listBrands({ activeOnly = false } = {}) {
  if (!fs.existsSync("brands")) return [];
  return fs.readdirSync("brands")
    .filter(d => !d.startsWith("_") && fs.existsSync(`brands/${d}/brand.json`))
    .map(d => JSON.parse(fs.readFileSync(`brands/${d}/brand.json`, "utf8")))
    .filter(b => !activeOnly || b.active !== false);
}

export function loadBrand(slug = DEFAULT_BRAND) {
  const p = path.join("brands", slug, "brand.json");
  if (!fs.existsSync(p)) throw new Error(`Brand "${slug}" hat keine brands/${slug}/brand.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// secret(brand, "IG_TOKEN") -> env IG_TOKEN_NURWISSEN, sonst IG_TOKEN
export function secret(brand, name) {
  const pre = (brand?.env_prefix || brand?.slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return (pre && process.env[`${name}_${pre}`]) || process.env[name] || "";
}

export function hasTarget(brand, entry, target) {
  const t = entry?.targets || brand?.targets || ["instagram"];
  return t.includes(target);
}
