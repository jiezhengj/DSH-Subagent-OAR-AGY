# Notas de implementación

## Descripción

Este plugin delega tareas independientes a la CLI local de Antigravity (`agy`). El modelo llama a `subagent_oar_agy`; el plugin inicia `agy --input-format stream-json --output-format stream-json`, interpreta el flujo NDJSON y devuelve la respuesta final a DSH. La forma de la herramienta reutiliza la oficial de OAR; aquí solo se aporta el runtime AGY sin ACP.

## Requisitos

- CLI de Antigravity (`agy`) instalada y con sesión iniciada al menos una vez.
- DSH 0.2.2-rc.1 o una versión compatible.
- Compatible con macOS, Linux y Windows (grupo de procesos POSIX / taskkill).

## Instalación y uso

1. Instala y activa este bundle desde la página de plugins.
2. En una sesión nueva, pide al modelo que delegue una tarea a AGY o que llame a `subagent_oar_agy`.
3. Argumentos: `runtime` (siempre `agy`), `description`, `prompt` y `cwd` opcional.

## Permisos

- `yolo` (predeterminado): ejecución sin supervisión.
- `plan`: planificación de solo lectura, sin escrituras.
- `strict`: las acciones que requieren permiso se rechazan automáticamente y el resultado incluye una nota visible.
  Los rechazos automáticos nunca son silenciosos: verás qué acción se rechazó y cómo permitirla.

## Datos y privacidad

El texto de la tarea solo se envía al proceso `agy` local. El plugin no lee, almacena ni reenvía credenciales ni archivos de autenticación de AGY, y no modifica su configuración global.

## Nombre de la herramienta y convivencia

El nombre predeterminado es `subagent_oar_agy`, que no choca con `subagent_oar` del bundle OAR oficial; ambos pueden estar activos. Para reutilizar `subagent_oar`, sobrescribe `toolName` en el patch del perfil.

## Aviso

Es un envoltorio no oficial, sin relación con DeepSeek ni Google. Úsalo bajo tu responsabilidad y respeta los términos de Antigravity.
