// Schreibt Fehler in dashboard/<name>-error.log und pusht sie, damit sie im
// Dashboard sichtbar werden - auch wenn der Workflow-Schritt "commit" uebersprungen wird.
import fs from "node:fs";
import { execSync } from "node:child_process";

export function reportError(name, err) {
  try {
    fs.mkdirSync("dashboard", { recursive: true });
    const txt = `== ${name} ${new Date().toISOString()} ==\n${(err && err.stack) || err}\n`;
    fs.writeFileSync(`dashboard/${name}-error.log`, txt);
    const sh = c => execSync(c, { stdio: "ignore" });
    sh('git config user.name "reel-bot"');
    sh('git config user.email "reel-bot@users.noreply.github.com"');
    sh(`git add -A dashboard/${name}-error.log`);
    sh(`git commit -m "fehler: ${name}"`);
    try { sh("git pull --rebase -q"); } catch {}
    sh("git push -q origin HEAD:main");
    console.log(`Fehler nach dashboard/${name}-error.log geschrieben.`);
  } catch (e) { console.log("Fehlerbericht fehlgeschlagen:", e.message); }
}

// Haelt fest, wie weit die Produktion eines Reels gekommen ist, damit das
// Dashboard die Stufe "Voice erstellt" zeigen kann, auch wenn der Render spaeter scheitert.
export function markProduced(brand, id, feld) {
  try {
    fs.mkdirSync("dashboard", { recursive: true });
    const P = "dashboard/produced.json";
    let alle = {};
    try { alle = JSON.parse(fs.readFileSync(P, "utf8")); } catch { alle = {}; }
    const key = `${brand}/${id}`;
    alle[key] = { ...(alle[key] || {}), [feld]: new Date().toISOString() };
    fs.writeFileSync(P, JSON.stringify(alle, null, 2) + "\n");
    const sh = c => execSync(c, { stdio: "ignore" });
    sh('git config user.name "reel-bot"');
    sh('git config user.email "reel-bot@users.noreply.github.com"');
    sh(`git add -A ${P}`);
    sh(`git commit -m "produktion: ${key} ${feld}"`);
    try { sh("git pull --rebase -q"); } catch {}
    sh("git push -q origin HEAD:main");
    console.log(`Fortschritt vermerkt: ${key} ${feld}`);
  } catch (e) { console.log("Fortschritt nicht vermerkt:", e.message); }
}

export function clearError(name) {
  try { if (fs.existsSync(`dashboard/${name}-error.log`)) fs.unlinkSync(`dashboard/${name}-error.log`); } catch {}
}
