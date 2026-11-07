# Instalación

1. Abre la gestión de plugins de DeepSeek Harness (Ajustes → Plugins).
2. Pega esto en el campo de instalación e instala:

```
https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.2/subagent_oar_agy-0.2.2.tgz
```

3. Activa «Subagente AGY» y el modelo podrá llamar a `subagent_oar_agy` en una sesión nueva.

Requisitos: DSH 0.2.2-rc.1 o superior (menor que 0.3.0), con la CLI de Antigravity (`agy`) instalada y con sesión iniciada. El tarball incluye el código del runtime de este plugin; la herramienta OAR oficial se instala desde npm.

# Qué hace este plugin

Delega tareas independientes a la CLI local de Antigravity (`agy`): el modelo llama a `subagent_oar_agy`, el plugin inicia `agy --input-format stream-json --output-format stream-json`, interpreta el flujo NDJSON y devuelve la respuesta final a DSH.

- Reutiliza la implementación y forma de la herramienta OAR oficial (`runtime`/`description`/`prompt`/`cwd`, `runtime` solo `agy`); aquí solo se implementa el runtime AGY sin ACP.
- Convive con el bundle OAR oficial: la herramienta aquí es `subagent_oar_agy`, allí `subagent_oar`.
- Nombre visible, descripción de la página, documentos de detalle y mensajes del runtime en 8 idiomas de la interfaz (de/en/es/fr/ja/pt/ru/zh).

# Configuración

Se ajusta en el patch del perfil (sin pantalla de ajustes propia):

```yaml
- id: subagent-agy
  config:
    permissionMode: yolo   # yolo (predeterminado) / plan / strict
    timeoutMs: 600000      # opcional
    locale: auto           # auto o de/en/es/fr/ja/pt/ru/zh
    command: agy           # opcional: ruta absoluta de agy
```

- `yolo`: sin supervisión; `plan`: planificación de solo lectura; `strict`: las acciones que requieren permiso se rechazan automáticamente y el resultado incluye una nota visible.

# Instalación alternativa

```bash
dsh plugin add https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.2/subagent_oar_agy-0.2.2.tgz
```

O compila desde este repositorio:

```bash
pnpm install
pnpm -r build
cd packages/subagent-oar-agy-bundle && pnpm pack
```

# Estructura del repositorio

- `packages/subagent-oar-agy-provider/`: proveedor del runtime AGY (subproceso, flujo de eventos, timeout/cancelación, mensajes i18n).
- `packages/subagent-oar-agy-bundle/`: bundle DSH distribuible (manifiesto, patch, metadatos y detalles en 8 idiomas, proveedor integrado al compilar).
- `specs/001-subagent-oar-agy/`: especificación SDD, plan, tareas y validación.

# Desarrollo

```bash
pnpm install
pnpm -r build
pnpm test
```

# Aviso

Envoltorio no oficial, sin relación con DeepSeek ni Google. Úsalo bajo tu responsabilidad y respeta los términos de Antigravity.
