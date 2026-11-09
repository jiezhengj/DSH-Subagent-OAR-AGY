# Notas de implementação

## Visão geral

Este plugin delega tarefas independentes à CLI local do Antigravity (`agy`). O modelo chama `subagent_oar_agy`; o plugin inicia `agy --input-format stream-json --output-format stream-json`, interpreta o fluxo NDJSON e devolve a resposta final ao DSH. A forma da ferramenta reutiliza a do OAR oficial; aqui só é fornecido o runtime AGY sem ACP.

## Requisitos

- CLI do Antigravity (`agy`) instalada e com login feito ao menos uma vez.
- DSH 0.2.2-rc.1 ou versão compatível.
- macOS, Linux e Windows suportados (grupo de processos POSIX / taskkill).

## Instalação e uso

1. Instale e ative este bundle na página de plugins.
2. Em uma nova sessão, peça ao modelo para delegar uma tarefa ao AGY ou chamar `subagent_oar_agy`.
3. Argumentos: `runtime` (sempre `agy`), `description`, `prompt`, `cwd` opcional.

## Permissões

- `yolo` (padrão): execução sem supervisão.
- `plan`: planejamento somente leitura, sem gravações.
- `strict`: ações que exigem permissão são negadas automaticamente e o resultado traz uma nota visível.
  Negações automáticas nunca são silenciosas: você vê qual ação foi negada e como permiti-la.

## Dados e privacidade

O texto da tarefa vai apenas para o processo `agy` local. O plugin não lê, armazena nem encaminha credenciais ou arquivos de autenticação do AGY, e não altera sua configuração global.

## Nome da ferramenta e coexistência

O nome padrão é `subagent_oar_agy`, sem colisão com `subagent_oar` do bundle OAR oficial; ambos podem ficar ativos. Para reutilizar `subagent_oar`, sobrescreva `toolName` no patch do perfil.

## Aviso

É um wrapper não oficial, sem vínculo com DeepSeek ou Google. Use por sua conta e risco e siga os termos do Antigravity.

## Status, watchdogs and cancellation

The tool entry registers `subagent_oar_agy_control`: `status` returns a bounded snapshot of direct AGY runs (at most 50 runs, 20 activity entries each, `lastText` at most 200 characters); `cancel` only accepts a cancellation request and settles asynchronously. Defaults are a 60 s startup window, a 15 min stall window, `activityLimit=20`, `terminalRetentionMs=300000` and `maxRecordsPerParent=50`; stderr noise does not reset the stall timer. Every path settles once. There is no watchdog off switch; increase the windows instead.

The child environment is the official scrubbed parent environment: credential-shaped names and `DSH_*` are removed unless explicitly supplied through `env`. Parent diagnostics never include raw stderr.
