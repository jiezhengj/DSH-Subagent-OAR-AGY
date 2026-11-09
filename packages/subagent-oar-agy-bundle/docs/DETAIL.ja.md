# 実装メモ

## 概要

このプラグインは独立したタスクをローカルの Antigravity CLI（`agy`）に委任します。モデルは `subagent_oar_agy` を呼び、プラグインは `agy --input-format stream-json --output-format stream-json` を起動して NDJSON イベントストリームを解析し、最終回答を DSH に返します。モデル側のツール形態は公式 OAR ツールを再利用し、ACP を使わない AGY ランタイムのみを提供します。

## 要件

- Antigravity CLI（`agy`）がインストール済みで、一度以上ログインしていること。
- DSH 0.2.2-rc.1 または互換バージョン。
- macOS、Linux、Windows に対応（POSIX プロセスグループ終了 / taskkill）。

## インストールと使い方

1. プラグインページからこのバンドルをインストールして有効化します。
2. 新しいセッションで、AGY への委任または `subagent_oar_agy` の呼び出しをモデルに依頼します。
3. 引数：`runtime`（常に `agy`）、`description`、`prompt`、任意の `cwd`。

## 権限

- `yolo`（既定）：無人で実行。
- `plan`：読み取り専用の計画。書き込みなし。
- `strict`：権限が必要な操作は AGY が自動的に拒否し、結果に可視の注記が付きます。
  自動拒否は決して無言ではありません。拒否された操作と許可方法が表示されます。

## データとプライバシー

タスクのテキストはローカルの `agy` プロセスにのみ送信されます。プラグインは AGY の認証情報や認証ファイルを読み取り・保存・転送せず、グローバル設定も変更しません。

## ツール名と共存

既定のツール名は `subagent_oar_agy` で、公式 OAR バンドルの `subagent_oar` と衝突しないため同時に有効化できます。`subagent_oar` を使う場合はプロファイル patch で `toolName` を上書きしてください。

## 免責

非公式のラッパーであり、DeepSeek や Google とは関係ありません。自己責任で使用し、Antigravity の利用規約に従ってください。

## Status, watchdogs and cancellation

The tool entry registers `subagent_oar_agy_control`: `status` returns a bounded snapshot of direct AGY runs (at most 50 runs, 20 activity entries each, `lastText` at most 200 characters); `cancel` only accepts a cancellation request and settles asynchronously. Defaults are a 60 s startup window, a 15 min stall window, `activityLimit=20`, `terminalRetentionMs=300000` and `maxRecordsPerParent=50`; stderr noise does not reset the stall timer. Every path settles once. There is no watchdog off switch; increase the windows instead.

The child environment is the official scrubbed parent environment: credential-shaped names and `DSH_*` are removed unless explicitly supplied through `env`. Parent diagnostics never include raw stderr.
