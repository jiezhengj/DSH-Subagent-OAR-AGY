# Installation

1. Ouvrez la gestion des plugins de DeepSeek Harness (Réglages → Plugins).
2. Collez ceci dans le champ d’installation puis installez :

```
https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.2/subagent_oar_agy-0.2.2.tgz
```

3. Activez « Sous-agent AGY » ; le modèle pourra appeler `subagent_oar_agy` dans une nouvelle session.

Prérequis : DSH 0.2.2-rc.1 ou plus récent (inférieur à 0.3.0), CLI Antigravity (`agy`) installée et connectée localement. Le tarball contient le code d’exécution de ce plugin ; l’outil OAR officiel est installé depuis npm.

# Ce que fait ce plugin

Il délègue des tâches indépendantes à la CLI Antigravity locale (`agy`) : le modèle appelle `subagent_oar_agy`, le plugin lance `agy --input-format stream-json --output-format stream-json`, lit le flux NDJSON et renvoie la réponse finale à DSH.

- Réutilise l’implémentation et la forme de l’outil OAR officiel (`runtime`/`description`/`prompt`/`cwd`, `runtime` valant seulement `agy`) ; seul le runtime AGY sans ACP est écrit ici.
- Coexiste avec le bundle OAR officiel : l’outil ici est `subagent_oar_agy`, l’officiel `subagent_oar`.
- Nom affiché, description, documents de détail et messages d’exécution en 8 langues d’interface (de/en/es/fr/ja/pt/ru/zh).

# Configuration

Via le patch de profil (pas d’écran de réglages dédié) :

```yaml
- id: subagent-agy
  config:
    permissionMode: yolo   # yolo (par défaut) / plan / strict
    timeoutMs: 600000      # facultatif
    locale: auto           # auto ou de/en/es/fr/ja/pt/ru/zh
    command: agy           # facultatif : chemin absolu d’agy
```

- `yolo` : sans surveillance ; `plan` : planification en lecture seule ; `strict` : les actions nécessitant une autorisation sont refusées automatiquement et le résultat contient une note visible.

# Installation alternative

```bash
dsh plugin add https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.2/subagent_oar_agy-0.2.2.tgz
```

Ou compilez depuis ce dépôt :

```bash
pnpm install
pnpm -r build
cd packages/subagent-oar-agy-bundle && pnpm pack
```

# Structure du dépôt

- `packages/subagent-oar-agy-provider/` : fournisseur du runtime AGY (sous-processus, flux d’événements, délai/annulation, messages i18n).
- `packages/subagent-oar-agy-bundle/` : bundle DSH distribuable (manifeste, patch, métadonnées et détails en 8 langues, fournisseur intégré à la compilation).
- `specs/001-subagent-oar-agy/` : spécification SDD, plan, tâches et validation.

# Développement

```bash
pnpm install
pnpm -r build
pnpm test
```

# Avertissement

Extension non officielle, sans lien avec DeepSeek ou Google. Utilisation à vos risques ; respectez les conditions d’Antigravity.
