# Workflows einmalig aktivieren

Der GitHub-Connector darf keine Dateien unter `.github/workflows/` schreiben
(fehlender `workflow`-Scope). Deshalb liegen neue oder geaenderte Workflows
zuerst hier und muessen einmal per Hand an ihren Platz.

## So geht es (pro Datei ca. 30 Sekunden)

1. Datei hier oeffnen → Stift-Symbol (Edit)
2. Den Dateinamen oben von `pending-workflows/NAME.yml`
   auf `.github/workflows/NAME.yml` aendern
3. **Commit changes**

## Offen

| Datei | Was sie tut | Voraussetzung |
|---|---|---|
| `post-story.yml` | postet 20:00 Berlin das Reel des Tages zusaetzlich als Story | keine, `scripts/story.mjs` liegt schon im Repo |
| `produce.yml` | rendert ein Reel komplett auf GitHub (Voice-Over + Remotion) | Secret `ELEVENLABS_API_KEY`, ausserdem muessen `remotion/` und `render/` ins Repo |

## Ausserdem von Hand zu aendern

`.github/workflows/post-reel.yml`, Zeile mit `cron`:

    - cron: "0 16 * * *"     # alt: 18:00 Berlin Sommerzeit
    - cron: "0 18 * * *"     # neu: 19:00 Berlin Winterzeit

GitHub-Cron laeuft immer in UTC, es gibt keine Zeitzone. Deshalb:

| Zeitraum | Reel 19:00 Berlin | Story 20:00 Berlin |
|---|---|---|
| Winterzeit (Ende Okt – Ende Maerz) | `0 18 * * *` | `0 19 * * *` |
| Sommerzeit (Ende Maerz – Ende Okt) | `0 17 * * *` | `0 18 * * *` |

Zwei Termine im Jahr, an denen das umgestellt werden muss.
