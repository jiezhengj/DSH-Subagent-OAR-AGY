
# 安装

1. 打开 DeepSeek Harness 的插件管理（设置 → 插件）。
2. 在安装输入框粘贴：

```
https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.2/subagent_oar_agy-0.2.2.tgz
```

3. 启用「AGY 子智能体」，新会话即可让模型调用 `subagent_oar_agy`。

前置条件：DSH 0.2.2-rc.1 及以上（低于 0.3.0）、本机已安装并登录 Antigravity CLI（`agy`）。tarball 自带插件运行时代码，官方 OAR 工具从 npm 安装。

# 这个插件做什么

把独立任务委派给本机 Antigravity CLI（`agy`）执行：模型通过 `subagent_oar_agy` 工具发起委派，插件启动 `agy --input-format stream-json --output-format stream-json` 子进程，解析 NDJSON 事件流，把最终答复交回 DSH。

- 复用官方 OAR 工具的实现与参数形态（`runtime`/`description`/`prompt`/`cwd`，`runtime` 只有 `agy`），只自写非 ACP 的 AGY 运行时。
- 与官方 OAR 组合包可同时启用：本插件工具名 `subagent_oar_agy`，官方为 `subagent_oar`。
- 显示名、插件页介绍正文、详情文档与运行时提示均覆盖 8 种界面语言（de/en/es/fr/ja/pt/ru/zh）。

# 配置

通过 profile patch 设置（无独立设置界面）：

```yaml
- id: subagent-agy
  config:
    permissionMode: yolo   # yolo(默认) / plan / strict
    timeoutMs: 600000      # 可选
    locale: auto           # auto 或 de/en/es/fr/ja/pt/ru/zh
    command: agy           # 可选：agy 的绝对路径
```

- `yolo`：无人值守执行；`plan`：只读规划；`strict`：需要权限的动作由 AGY 自动拒绝，结果中会附可见说明。

# 安装方式（备选）

```bash
dsh plugin add https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.2/subagent_oar_agy-0.2.2.tgz
```

或从本仓库构建：

```bash
pnpm install
pnpm -r build
cd packages/subagent-oar-agy-bundle && pnpm pack
```

# 仓库结构

- `packages/subagent-oar-agy-provider/`：AGY 运行时提供方（子进程、事件流、超时/取消、i18n 文案）。
- `packages/subagent-oar-agy-bundle/`：可分发的 DSH 组合包（插件清单、patch、8 语言文案与详情文档、构建时内置提供方）。
- `specs/001-subagent-oar-agy/`：SDD 规格、计划、任务与验证记录。

# 开发

```bash
pnpm install
pnpm -r build
pnpm test
```

# 声明

本插件是非官方封装，与 DeepSeek、Google 均无隶属关系；使用风险自担，请遵守 Antigravity 的服务条款。
