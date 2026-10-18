# nurwissen_official — Auto-Poster

Veroeffentlicht taeglich ein Reel auf Instagram ueber die **offizielle Instagram Graph API**.
Keine Drittanbieter, keine laufenden Kosten.

| Teil | Wo |
|---|---|
| Videos | `videos/` |
| Warteschlange | `queue.json` |
| Verlauf | `posted.json` |
| Poster | `scripts/post.mjs` |
| Zeitplan | `.github/workflows/post-reel.yml` (taeglich) |
| Token-Erneuerung | `.github/workflows/refresh-token.yml` (2x/Monat) |

## Einmalige Einrichtung

1. Instagram-Konto auf **Professional** (Creator oder Business) umstellen.
2. Auf developers.facebook.com eine App anlegen → Produkt **Instagram** hinzufuegen
   → *Instagram API mit Instagram Login* → Berechtigungen
   `instagram_business_basic`, `instagram_business_content_publish`.
3. Im App-Dashboard unter *Instagram → API setup with Instagram login* einen
   **Long-Lived Access Token** erzeugen (60 Tage, wird automatisch verlaengert).
4. Hier im Repo unter **Settings → Secrets and variables → Actions** anlegen:
   - `IG_TOKEN` = der Long-Lived Token
   - `IG_USER_ID` = die Instagram-User-ID (oder leer lassen, dann `me`)
   - `GH_PAT` = Fine-grained Token auf dieses Repo mit Recht *Secrets: Read and write*
     (nur fuer die automatische Token-Erneuerung)

## Testen

Actions → *Reel posten* → **Run workflow** → `dry_run = true`.
Prueft Token und Limit, ohne zu veroeffentlichen.

## Limits

100 per API veroeffentlichte Beitraege pro 24 Stunden. Wir nutzen 1.
