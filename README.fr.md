# Installation

1. Ouvrez la gestion des plugins de DeepSeek Harness (Réglages → Plugins).
2. Collez ceci dans le champ d’installation puis installez :

```
@jiezhengj/subagent-oar-agy
```

Fallback (tgz): `https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.3.0/subagent-oar-agy-0.3.0.tgz`

3. Activez « Sous-agent AGY » ; le modèle pourra appeler `subagent_oar_agy` dans une nouvelle session.
4. Rechargez DSH lorsque cela est demandé (redémarrez si nécessaire), puis appelez `subagent_oar_agy` dans une nouvelle session.

Prérequis : DSH 0.2.2-rc.1 ou plus récent (inférieur à 0.3.0), CLI Antigravity (`agy`) installée et connectée localement. Le tarball contient le code d’exécution de ce plugin ; l’outil OAR officiel est installé depuis npm.

# Migrer d’une installation tgz vers le nom

Un profil installé depuis un tgz ne peut pas rechercher de mises à jour. Supprimez l’ancienne entrée dans la gestion des plugins (ou exécutez `dsh plugin remove @jiezhengj/subagent-oar-agy`), puis installez avec le nom ci-dessus ; la configuration du plugin est normalement conservée ; si elle est supprimée avec l’ancienne entrée, saisissez à nouveau vos réglages précédents. La section Version affichera ensuite la version actuelle et « À jour », ce qui permettra les mises à jour dans l’application.

# Ce que fait ce plugin

Il délègue des tâches indépendantes à la CLI Antigravity locale (`agy`) : le modèle appelle `subagent_oar_agy`, le plugin lance `agy --input-format stream-json --output-format stream-json`, lit le flux NDJSON et renvoie la réponse finale à DSH.

- Réutilise l’implémentation et la forme de l’outil OAR officiel (`runtime`/`description`/`prompt`/`cwd`, `runtime` valant seulement `agy`) ; seul le runtime AGY sans ACP est écrit ici.
- Coexiste avec le bundle OAR officiel : l’outil ici est `subagent_oar_agy`, l’officiel `subagent_oar`.
- Nom affiché, description, documents de détail et messages d’exécution en 8 langues d’interface (de/en/es/fr/ja/pt/ru/zh).

# Observabilité et contrôle

La version 0.3.0 ajoute des chiens de garde de démarrage et d’inactivité (60 s / 15 min par défaut), l’outil `subagent_oar_agy_control` avec `status` et `cancel`, ainsi que des résumés d’activité bornés (50 exécutions, 20 activités, 200 caractères). Les chiens de garde ne peuvent pas être désactivés ; augmentez les fenêtres pour les tâches longues. Le statut n’expose jamais les prompts, les arguments d’outil, les réponses complètes ni le stderr brut.

# Configuration

Via le patch de profil (pas d’écran de réglages dédié) :

```yaml
- id: subagent-agy
  config:
    permissionMode: yolo   # yolo (par défaut) / plan / strict
    timeoutMs: 600000      # facultatif
    startupTimeoutMs: 60000
    stallTimeoutMs: 900000
    controlToolName: subagent_oar_agy_control
    locale: auto           # auto ou de/en/es/fr/ja/pt/ru/zh
    command: agy           # facultatif : chemin absolu d’agy
```

- `yolo` : sans surveillance ; `plan` : planification en lecture seule ; `strict` : les actions nécessitant une autorisation sont refusées automatiquement et le résultat contient une note visible.

# Installation alternative

```bash
dsh plugin add @jiezhengj/subagent-oar-agy
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
- `specs/003-agy-observability-control/` : spécification SDD, plan, tâches et validation des chiens de garde, du statut et de l’annulation.

# Développement

```bash
pnpm install
pnpm -r build
pnpm test
```

# Avertissement

Extension non officielle, sans lien avec DeepSeek ou Google. Utilisation à vos risques ; respectez les conditions d’Antigravity.
