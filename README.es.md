# Instalación

1. Abre la gestión de plugins de DeepSeek Harness (Ajustes → Plugins).
2. Pega esto en el campo de instalación e instala:

```
@jiezhengj/subagent-oar-agy
```

Fallback (tgz): `https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.3.0/subagent-oar-agy-0.3.0.tgz`

3. Activa «Subagente AGY» y el modelo podrá llamar a `subagent_oar_agy` en una sesión nueva.
4. Recarga DSH cuando se te pida (reinicia si es necesario) y llama a `subagent_oar_agy` en una sesión nueva.

Requisitos: DSH 0.2.2-rc.1 o superior (menor que 0.3.0), con la CLI de Antigravity (`agy`) instalada y con sesión iniciada. El tarball incluye el código del runtime de este plugin; la herramienta OAR oficial se instala desde npm.

# Migrar de una instalación tgz al nombre

Un perfil instalado desde un tgz no puede buscar actualizaciones. Elimina la entrada antigua en la gestión de plugins (o ejecuta `dsh plugin remove @jiezhengj/subagent-oar-agy`) e instala con el nombre indicado arriba; la configuración del plugin normalmente se conserva; si se elimina con la entrada antigua, vuelve a introducir tus ajustes anteriores. La sección de versión mostrará la versión actual y «Actualizado», de modo que las próximas actualizaciones se hagan desde la app.

# Qué hace este plugin

Delega tareas independientes a la CLI local de Antigravity (`agy`): el modelo llama a `subagent_oar_agy`, el plugin inicia `agy --input-format stream-json --output-format stream-json`, interpreta el flujo NDJSON y devuelve la respuesta final a DSH.

- Reutiliza la implementación y forma de la herramienta OAR oficial (`runtime`/`description`/`prompt`/`cwd`, `runtime` solo `agy`); aquí solo se implementa el runtime AGY sin ACP.
- Convive con el bundle OAR oficial: la herramienta aquí es `subagent_oar_agy`, allí `subagent_oar`.
- Nombre visible, descripción de la página, documentos de detalle y mensajes del runtime en 8 idiomas de la interfaz (de/en/es/fr/ja/pt/ru/zh).

# Observabilidad y control

La versión 0.3.0 añade vigilantes de inicio y de inactividad (60 s / 15 min por defecto), la herramienta `subagent_oar_agy_control` con `status` y `cancel`, y resúmenes de actividad acotados (50 ejecuciones, 20 actividades, 200 caracteres). Los vigilantes no se pueden desactivar; amplía las ventanas para tareas largas. El estado nunca expone prompts, argumentos de herramientas, respuestas completas ni stderr sin procesar.

# Configuración

Se ajusta en el patch del perfil (sin pantalla de ajustes propia):

```yaml
- id: subagent-agy
  config:
    permissionMode: yolo   # yolo (predeterminado) / plan / strict
    timeoutMs: 600000      # opcional
    startupTimeoutMs: 60000
    stallTimeoutMs: 900000
    controlToolName: subagent_oar_agy_control
    locale: auto           # auto o de/en/es/fr/ja/pt/ru/zh
    command: agy           # opcional: ruta absoluta de agy
```

- `yolo`: sin supervisión; `plan`: planificación de solo lectura; `strict`: las acciones que requieren permiso se rechazan automáticamente y el resultado incluye una nota visible.

# Instalación alternativa

```bash
dsh plugin add @jiezhengj/subagent-oar-agy
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
- `specs/003-agy-observability-control/`: especificación SDD, plan, tareas y validación de vigilantes, estado y cancelación.

# Desarrollo

```bash
pnpm install
pnpm -r build
pnpm test
```

# Aviso

Envoltorio no oficial, sin relación con DeepSeek ni Google. Úsalo bajo tu responsabilidad y respeta los términos de Antigravity.
