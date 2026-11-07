# Notes d’implémentation

## Présentation

Ce plugin délègue des tâches indépendantes à la CLI Antigravity locale (`agy`). Le modèle appelle `subagent_oar_agy` ; le plugin lance `agy --input-format stream-json --output-format stream-json`, lit le flux d’événements NDJSON et renvoie la réponse finale à DSH. La forme de l’outil réutilise celle de l’OAR officiel ; seul le runtime AGY sans ACP est fourni ici.

## Prérequis

- CLI Antigravity (`agy`) installée localement et connectée au moins une fois.
- DSH 0.2.2-rc.1 ou une version compatible.
- macOS, Linux et Windows pris en charge (groupe de processus POSIX / taskkill).

## Installation et utilisation

1. Installez et activez ce bundle depuis la page des plugins.
2. Dans une nouvelle session, demandez au modèle de déléguer une tâche à AGY ou d’appeler `subagent_oar_agy`.
3. Paramètres : `runtime` (toujours `agy`), `description`, `prompt`, `cwd` facultatif.

## Autorisations

- `yolo` (par défaut) : exécution sans surveillance.
- `plan` : planification en lecture seule, sans écriture.
- `strict` : les actions nécessitant une autorisation sont refusées automatiquement et le résultat contient une note visible.
  Les refus automatiques ne sont jamais silencieux : vous voyez l’action refusée et comment l’autoriser.

## Données et confidentialité

Le texte de la tâche n’est envoyé qu’au processus `agy` local. Le plugin ne lit, ne stocke et ne transmet ni identifiants ni fichiers d’authentification AGY, et ne modifie pas sa configuration globale.

## Nom de l’outil et coexistence

Le nom par défaut est `subagent_oar_agy`, sans collision avec `subagent_oar` du bundle OAR officiel ; les deux peuvent être actifs. Pour réutiliser `subagent_oar`, remplacez `toolName` dans le patch du profil.

## Avertissement

Extension non officielle, sans lien avec DeepSeek ou Google. Utilisation à vos risques ; respectez les conditions d’Antigravity.
