# Установка

1. Откройте управление плагинами DeepSeek Harness (Настройки → Плагины).
2. Вставьте это в поле установки и установите:

```
https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.2/subagent_oar_agy-0.2.2.tgz
```

3. Включите «Субагент AGY»; в новой сессии модель сможет вызывать `subagent_oar_agy`.

Требования: DSH 0.2.2-rc.1 или новее (ниже 0.3.0), Antigravity CLI (`agy`) установлен локально и выполнен вход. Tarball содержит код среды выполнения плагина; официальный инструмент OAR ставится из npm.

# Что делает плагин

Передаёт независимые задачи локальному Antigravity CLI (`agy`): модель вызывает `subagent_oar_agy`, плагин запускает `agy --input-format stream-json --output-format stream-json`, разбирает поток NDJSON и возвращает итоговый ответ в DSH.

- Использует реализацию и форму официального инструмента OAR (`runtime`/`description`/`prompt`/`cwd`, `runtime` только `agy`); здесь реализована только среда AGY без ACP.
- Совместим с официальным OAR-бандлом: здесь инструмент `subagent_oar_agy`, там `subagent_oar`.
- Отображаемое имя, описание, документы и сообщения среды выполнения на 8 языках интерфейса (de/en/es/fr/ja/pt/ru/zh).

# Настройка

Через патч профиля (отдельного экрана настроек нет):

```yaml
- id: subagent-agy
  config:
    permissionMode: yolo   # yolo (по умолчанию) / plan / strict
    timeoutMs: 600000      # необязательно
    locale: auto           # auto или de/en/es/fr/ja/pt/ru/zh
    command: agy           # необязательно: абсолютный путь к agy
```

- `yolo`: без присмотра; `plan`: планирование только для чтения; `strict`: действия, требующие разрешения, автоматически отклоняются, а результат содержит видимое примечание.

# Альтернативная установка

```bash
dsh plugin add https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.2/subagent_oar_agy-0.2.2.tgz
```

Или соберите из этого репозитория:

```bash
pnpm install
pnpm -r build
cd packages/subagent-oar-agy-bundle && pnpm pack
```

# Структура репозитория

- `packages/subagent-oar-agy-provider/`: провайдер среды AGY (подпроцесс, поток событий, тайм-аут/отмена, сообщения i18n).
- `packages/subagent-oar-agy-bundle/`: распространяемый DSH-бандл (манифест, патч, метаданные и документы на 8 языках, встроенный провайдер).
- `specs/001-subagent-oar-agy/`: спецификация SDD, план, задачи и проверка.

# Разработка

```bash
pnpm install
pnpm -r build
pnpm test
```

# Отказ от ответственности

Неофициальная обёртка, не связанная с DeepSeek или Google. Используйте на свой риск и соблюдайте условия Antigravity.
