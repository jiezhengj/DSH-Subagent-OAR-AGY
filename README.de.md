# Installation

1. Öffnen Sie die Plugin-Verwaltung von DeepSeek Harness (Einstellungen → Plugins).
2. Fügen Sie dies in das Installationsfeld ein und installieren Sie:

```
@jiezhengj/subagent_oar_agy
```

Fallback (tgz): `https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.7/subagent_oar_agy-0.2.7.tgz`

3. Aktivieren Sie „AGY-Subagent“; danach kann das Modell in einer neuen Sitzung `subagent_oar_agy` aufrufen.
4. Laden Sie DSH nach Aufforderung neu (bei Bedarf Neustart) und rufen Sie danach `subagent_oar_agy` in einer neuen Sitzung auf.

Voraussetzungen: DSH 0.2.2-rc.1 oder neuer (unter 0.3.0), Antigravity CLI (`agy`) lokal installiert und angemeldet. Das Tarball enthält den Laufzeitcode dieses Plugins; das offizielle OAR-Werkzeug wird aus npm installiert.

# Migration von tgz zur Namensinstallation

Ein aus einem tgz installiertes Profil kann nicht nach Updates suchen. Entfernen Sie den alten Eintrag in der Plugin-Verwaltung (oder führen Sie `dsh plugin remove @jiezhengj/subagent_oar_agy` aus) und installieren Sie anschließend über den oben genannten Namen; die Plugin-Konfiguration bleibt normalerweise erhalten; falls sie mit dem alten Eintrag entfernt wird, geben Sie Ihre bisherigen Einstellungen erneut ein. Die Versionsansicht zeigt danach die aktuelle Version und „Aktuell“, sodass spätere Updates in der App möglich sind.

# Was dieses Plugin tut

Es delegiert unabhängige Aufgaben an die lokale Antigravity CLI (`agy`): Das Modell ruft `subagent_oar_agy` auf, das Plugin startet `agy --input-format stream-json --output-format stream-json`, liest den NDJSON-Ereignisstrom und liefert die endgültige Antwort an DSH zurück.

- Nutzt die Form des offiziellen OAR-Werkzeugs (`runtime`/`description`/`prompt`/`cwd`, `runtime` nur `agy`); nur die AGY-Laufzeit ohne ACP ist hier implementiert.
- Koexistiert mit dem offiziellen OAR-Bundle: Werkzeugname hier `subagent_oar_agy`, dort `subagent_oar`.
- Anzeigename, Plugin-Beschreibung, Detaildokumente und Laufzeitmeldungen in 8 UI-Sprachen (de/en/es/fr/ja/pt/ru/zh).

# Konfiguration

Über den Profil-Patch (keine eigene Einstellungsseite):

```yaml
- id: subagent-agy
  config:
    permissionMode: yolo   # yolo (Standard) / plan / strict
    timeoutMs: 600000      # optional
    locale: auto           # auto oder de/en/es/fr/ja/pt/ru/zh
    command: agy           # optional: absoluter Pfad zu agy
```

- `yolo`: unbeaufsichtigt; `plan`: Nur-Lese-Planung; `strict`: Aktionen mit Berechtigungsbedarf werden automatisch abgelehnt, das Ergebnis enthält einen sichtbaren Hinweis.

# Alternative Installation

```bash
dsh plugin add @jiezhengj/subagent_oar_agy
```

Oder aus diesem Repository bauen:

```bash
pnpm install
pnpm -r build
cd packages/subagent-oar-agy-bundle && pnpm pack
```

# Repository-Aufbau

- `packages/subagent-oar-agy-provider/`: AGY-Laufzeit (Unterprozess, Ereignisstrom, Timeout/Abbruch, i18n-Meldungen).
- `packages/subagent-oar-agy-bundle/`: verteilbares DSH-Bundle (Manifest, Patch, 8-sprachige Metadaten und Detaildokumente, eingebettete Laufzeit).
- `specs/001-subagent-oar-agy/`: SDD-Spezifikation, Plan, Aufgaben und Verifikation.

# Entwicklung

```bash
pnpm install
pnpm -r build
pnpm test
```

# Haftungsausschluss

Inoffizielle Erweiterung, nicht mit DeepSeek oder Google verbunden. Nutzung auf eigenes Risiko; beachten Sie die Antigravity-Nutzungsbedingungen.
