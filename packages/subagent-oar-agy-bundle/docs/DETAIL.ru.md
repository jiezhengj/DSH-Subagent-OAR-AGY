# Заметки о реализации

## Обзор

Плагин передаёт независимые задачи локальному Antigravity CLI (`agy`). Модель вызывает `subagent_oar_agy`; плагин запускает `agy --input-format stream-json --output-format stream-json`, разбирает поток событий NDJSON и возвращает итоговый ответ в DSH. Форма инструмента повторяет официальный OAR; здесь реализована только среда выполнения AGY без ACP.

## Требования

- Antigravity CLI (`agy`) установлен локально и хотя бы раз выполнен вход.
- DSH 0.2.2-rc.1 или совместимая версия.
- Поддерживаются macOS, Linux и Windows (группа процессов POSIX / taskkill).

## Установка и использование

1. Установите и включите этот бандл на странице плагинов.
2. В новой сессии попросите модель передать задачу в AGY или вызвать `subagent_oar_agy`.
3. Параметры: `runtime` (всегда `agy`), `description`, `prompt`, необязательный `cwd`.

## Разрешения

- `yolo` (по умолчанию): выполнение без присмотра.
- `plan`: планирование только для чтения, без записи.
- `strict`: действия, требующие разрешения, автоматически отклоняются, а результат содержит видимое примечание.
  Автоматические отказы никогда не безмолвны: видно, какое действие отклонено и как его разрешить.

## Данные и конфиденциальность

Текст задачи отправляется только локальному процессу `agy`. Плагин не читает, не хранит и не передаёт учётные данные и файлы аутентификации AGY, не изменяет его глобальную конфигурацию.

## Имя инструмента и совместимость

Имя по умолчанию — `subagent_oar_agy`, оно не конфликтует с `subagent_oar` из официального OAR-бандла; оба могут быть включены. Чтобы использовать `subagent_oar`, переопределите `toolName` в патче профиля.

## Отказ от ответственности

Это неофициальная обёртка, не связанная с DeepSeek или Google. Используйте на свой риск и соблюдайте условия Antigravity.

## Status, watchdogs and cancellation

The tool entry registers `subagent_oar_agy_control`: `status` returns a bounded snapshot of direct AGY runs (at most 50 runs, 20 activity entries each, `lastText` at most 200 characters); `cancel` only accepts a cancellation request and settles asynchronously. Defaults are a 60 s startup window, a 15 min stall window, `activityLimit=20`, `terminalRetentionMs=300000` and `maxRecordsPerParent=50`; stderr noise does not reset the stall timer. Every path settles once. There is no watchdog off switch; increase the windows instead.

The child environment is the official scrubbed parent environment: credential-shaped names and `DSH_*` are removed unless explicitly supplied through `env`. Parent diagnostics never include raw stderr.
