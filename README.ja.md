# インストール

1. DeepSeek Harness のプラグイン管理（設定 → プラグイン）を開きます。
2. インストール欄に以下を貼り付けてインストールします：

```
https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.2/subagent_oar_agy-0.2.2.tgz
```

3. 「AGY サブエージェント」を有効化すると、新しいセッションでモデルが `subagent_oar_agy` を呼べます。

要件：DSH 0.2.2-rc.1 以上（0.3.0 未満）、Antigravity CLI（`agy`）がローカルにインストール済みでログイン済みであること。tarball には本プラグインの実行時コードが含まれ、公式 OAR ツールは npm からインストールされます。

# このプラグインの機能

独立したタスクをローカルの Antigravity CLI（`agy`）に委任します。モデルが `subagent_oar_agy` を呼び、プラグインが `agy --input-format stream-json --output-format stream-json` を起動して NDJSON イベントストリームを解析し、最終回答を DSH に返します。

- 公式 OAR ツールの実装と形を再利用（`runtime`/`description`/`prompt`/`cwd`、`runtime` は `agy` のみ）。ACP を使わない AGY ランタイムのみを実装しています。
- 公式 OAR バンドルと共存可能：本プラグインは `subagent_oar_agy`、公式は `subagent_oar`。
- 表示名、プラグイン説明、詳細ドキュメント、実行時メッセージは 8 言語（de/en/es/fr/ja/pt/ru/zh）に対応。

# 設定

プロファイル patch で設定します（専用の設定画面はありません）：

```yaml
- id: subagent-agy
  config:
    permissionMode: yolo   # yolo（既定） / plan / strict
    timeoutMs: 600000      # 任意
    locale: auto           # auto または de/en/es/fr/ja/pt/ru/zh
    command: agy           # 任意：agy の絶対パス
```

- `yolo`：無人実行、`plan`：読み取り専用の計画、`strict`：権限が必要な操作は自動的に拒否され、結果に可視の注記が付きます。

# 代替のインストール方法

```bash
dsh plugin add https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.2/subagent_oar_agy-0.2.2.tgz
```

このリポジトリからビルドする場合：

```bash
pnpm install
pnpm -r build
cd packages/subagent-oar-agy-bundle && pnpm pack
```

# リポジトリ構成

- `packages/subagent-oar-agy-provider/`：AGY ランタイム提供者（サブプロセス、イベントストリーム、タイムアウト/キャンセル、i18n メッセージ）。
- `packages/subagent-oar-agy-bundle/`：配布用 DSH バンドル（マニフェスト、patch、8 言語のメタデータと詳細、ビルド時に同梱される提供者）。
- `specs/001-subagent-oar-agy/`：SDD 仕様、計画、タスク、検証記録。

# 開発

```bash
pnpm install
pnpm -r build
pnpm test
```

# 免責

非公式のラッパーであり、DeepSeek や Google とは関係ありません。自己責任で使用し、Antigravity の利用規約に従ってください。
