# Implementierungshinweise

## Überblick

Dieses Plugin delegiert unabhängige Aufgaben an die lokale Antigravity CLI (`agy`). Das Modell ruft `subagent_oar_agy` auf; das Plugin startet `agy --input-format stream-json --output-format stream-json`, liest den NDJSON-Ereignisstrom und liefert die endgültige Antwort an DSH zurück. Die modellseitige Form entspricht dem offiziellen OAR-Werkzeug; hier wird nur die AGY-Laufzeit ohne ACP bereitgestellt.

## Voraussetzungen

- Antigravity CLI (`agy`) lokal installiert und mindestens einmal angemeldet.
- DSH 0.2.2-rc.1 oder eine kompatible Version.
- macOS, Linux und Windows werden unterstützt (POSIX-Prozessgruppe / taskkill).

## Installation und Nutzung

1. Dieses Bundle in der Plugin-Seite installieren und aktivieren.
2. In einer neuen Sitzung das Modell bitten, eine Aufgabe an AGY zu delegieren oder `subagent_oar_agy` aufzurufen.
3. Werkzeugparameter: `runtime` (immer `agy`), `description`, `prompt`, optional `cwd`.

## Berechtigungen

- `yolo` (Standard): unbeaufsichtigte Ausführung.
- `plan`: Nur-Lese-Planung ohne Schreibzugriff.
- `strict`: Aktionen mit Berechtigungsbedarf werden von AGY automatisch abgelehnt; das Ergebnis enthält einen sichtbaren Hinweis.
  Automatische Ablehnungen sind nie still: Sie sehen, welche Aktion abgelehnt wurde und wie Sie sie erlauben.

## Daten und Datenschutz

Aufgabentext wird nur an den lokalen `agy`-Prozess gesendet. Das Plugin liest, speichert oder überträgt keine AGY-Anmeldedaten und ändert keine globale Konfiguration.

## Werkzeugname und Koexistenz

Der Standardname ist `subagent_oar_agy` und kollidiert nicht mit `subagent_oar` aus dem offiziellen OAR-Bundle; beide können gemeinsam aktiv sein. Um `subagent_oar` zu verwenden, überschreiben Sie `toolName` im Profil-Patch.

## Haftungsausschluss

Dies ist eine inoffizielle Erweiterung, nicht mit DeepSeek oder Google verbunden. Nutzung auf eigenes Risiko; beachten Sie die Antigravity-Nutzungsbedingungen.

## Status, watchdogs and cancellation

The tool entry registers `subagent_oar_agy_control`: `status` returns a bounded snapshot of direct AGY runs (at most 50 runs, 20 activity entries each, `lastText` at most 200 characters); `cancel` only accepts a cancellation request and settles asynchronously. Defaults are a 60 s startup window, a 15 min stall window, `activityLimit=20`, `terminalRetentionMs=300000` and `maxRecordsPerParent=50`; stderr noise does not reset the stall timer. Every path settles once. There is no watchdog off switch; increase the windows instead.

The child environment is the official scrubbed parent environment: credential-shaped names and `DSH_*` are removed unless explicitly supplied through `env`. Parent diagnostics never include raw stderr.
