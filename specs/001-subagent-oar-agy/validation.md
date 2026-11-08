# 实现验证记录

**日期**：2026-11-08　**环境**：macOS（arm64）、Node v26.0.0、pnpm 12.18.0、DSH 0.2.2-rc.1、AGY 1.5.3（v0.2.5 收敛验证已更新）

## 构建与测试

- `pnpm -r build`：通过（TypeScript 严格模式，`module: NodeNext`）。
- `pnpm test`：**11 个测试文件、63 项全绿**（单元 + 假 agy 集成 + i18n + 组合包契约 + 工具包装/回退；早期记录为 50 项）。
- 覆盖率（`pnpm test --coverage`，v8）：全仓行 89.35%；核心模块行覆盖：`stream` 92.59%、`protocol` 100%、`errors` 95%、`timer` 100%；`run.ts` 92%。

## T005 官方工具 spike

见 [spike.md](./spike.md)：官方包 `0.2.2-rc.1` 可安装、导出 `Config/apply/inject/name`，`Config({providers:{agy:'agy'}})` 通过，默认 `toolName: subagent_oar`，`toolName` 覆盖可用。

## T018 / T035 真实 AGY 端到端

| 项 | 结果 |
|---|---|
| 单次委派（quickstart 场景 1） | `completed`，文本 `SMOKE_OK`，启动确认 **3 ms**（SC-002 阈值 2 s），总耗时 9.0 s |
| 连续 10 次（SC-001） | **10/10 成功**，启动确认 2–3 ms，单次总耗时 8.0–12.5 s |

命令：`node scripts/real-smoke.mjs 10`（结果留存 `/tmp/agy_real_smoke.json`）。

## T019 并发与同 cwd

集成测试 `runs concurrent delegations without cross-talk`：两次并行委派（相同 cwd）分别返回 `RUN_A` / `RUN_B`，无串扰；断言通过。

## T027 / T029 三档权限（真实 AGY）

临时目录写入 `sentinel.txt`，提示 AGY 覆盖为 `MODIFIED`：

| 档 | 文件是否被改 | 结果 | 说明 |
|---|---|---|---|
| `plan` | 否 | `completed` | 只读规划 |
| `strict` | 否 | `completed`，输出含可见说明 | AGY 自动拒绝 `write_file`；首次实现发现静默（`SUCCESS` + 空 `response`），已修复为附可见说明 |
| `yolo` | 是（`MODIFIED`） | `completed`，文本 `MODIFIED` | 无人值守 |

## 真实 DSH 宿主验证（T020 / T021 / T032）

### 环境搭建

本机未安装 `dsh` CLI，改用桌面应用自带的 CLI（与 GUI 同一套宿主代码）：

1. 从 `app.asar` 解包出 `@deepseek-ai/dsh/lib/bin.js` 及其依赖到 `/tmp/dsh_app`；
2. 临时 `DSH_HOME=/tmp/dsh_home`（复制 `settings.yaml` 与 `.env`，凭据仅落在临时目录，未提交）；
3. `dsh plugin --profile headless add /tmp/agy_install_bundle` 安装组合包（1 条命令、978 ms）；
4. 用 profile patch 指定 `agent-default-model`（magpie / `auto/deepseek-v4.1-flash`）与 `llm-pi-ai` 提供方。

`--dump-config` 确认组合包两行被宿主正确合成：

```yaml
- id: subagent-agy
  name: @jiezhengj/subagent_oar_agy-provider
  config: {providerName: agy, command: agy, permissionMode: yolo}
- id: tool-subagent-oar-agy
  name: '@deepseek-ai/dsh-experimental-tool-subagent-oar'
  config: {providers: {agy: agy}}
```

> 说明：以上是 v0.1.x 的实测形态。v0.2.3 起提供方改为组合包内子路径 `@jiezhengj/subagent_oar_agy/agy-provider`，工具行显式 `toolName: subagent_oar_agy`，见 `contracts/bundle-patch.md`。

### T020 / T044 入口选择（SC-007，v0.2.5 重新基线）

10 次真实 headless 会话（临时 `DSH_HOME`，v0.2.5 安装包），任务描述只指向 AGY（不点名工具）：

- 结果：**10/10 选择 `subagent_oar_agy` 并返回预期令牌**（阈值 9/10）；单次 14.8–19.1 s。
- 证据：`/tmp/sc3_1.ndjson` … `/tmp/sc3_10.ndjson`、`/tmp/sc3_results.json`。
- 说明：v0.2.4 之前的记录使用旧名 `subagent_oar(runtime=agy)`，已由本节取代。

### T021 / T045 与官方 OAR 共存（v0.2.5）

在临时 profile 中插入官方工具行（`@deepseek-ai/dsh-experimental-tool-subagent-oar`，默认 `subagent_oar`），与本插件的 `subagent_oar_agy` 同时启用：

- 一次会话内模型先后调用 `subagent_oar` 与 `subagent_oar_agy`，两者分别返回 `OFFICIAL_OK` / `AGY_OK`；
- 无覆盖、无重复注册报错；`--dump-config` 同时显示包装行与官方行。
- 证据：`/tmp/coexist_run.ndjson`。

### T032 安装 / 禁用 / 重装（宿主级）

| 步骤 | 结果 |
|---|---|
| 安装 | `dsh plugin add` 成功，`--dump-config` 含两行，真实会话可委派（AGY 返回 `AGY_TOOL_OK`） |
| 禁用 | 对两行加 `disabled: true` 后，模型工具列表无 `subagent_oar`，被要求调用时回复 `NO_TOOL`；其他 DSH 子代理工具仍可用 |
| 重装 | `plugin remove` 后组合包行消失；重新 `add` 后两行恢复，真实委派再次成功（`REINSTALL_OK`） |
| 配置保留 | 用户 patch 的 `permissionMode: plan` 在 remove/reinstall 后仍生效（`--dump-config` 合并结果） |
| 残留进程 | 10 次真实委派后 `ps` 检查无 agy 进程 |

安装耗时约 1 秒、只需 1 条命令；从零到首次委派远低于 SC-004 的 2 步 / 10 分钟。

## 失败路径（自动化）

假 agy 集成测试覆盖：`ERROR` 终态、未登录（stderr 认证文案）、畸形输出、部分输出后崩溃（部分文本与诊断分离）、超时、父会话取消；单元测试覆盖六类诊断互不相同与 4096 字节截断。

## T036 凭据与配置边界检查

- 代码不读取 `~/.gemini`、`~/.config`、`settings.json` 等 AGY 配置；唯一路径来源是配置的 `command` 与 `PATH`/`PATHEXT`。
- 不写入任何 AGY 文件；`strict` 提示文本仅建议用户自行配置 allow 规则。
- 日志只输出 `error.message` 与错误分类；诊断由 stderr 摘要（≤1200 字节，总体 ≤4096）构成，不含 prompt、工具输出或环境变量值。
- `env` 仅按用户配置覆盖子进程环境，不读取、不落盘。
- 临时验证用的 `.env`/`settings.yaml` 仅在 `/tmp/dsh_home`，未进入仓库。

## 成功标准对照

| SC | 结论 | 证据 |
|---|---|---|
| SC-001 10 次 ≥9 成功 | PASS | v0.2.5 10/10 真机（令牌逐次核对） |
| SC-002 2 秒内启动确认 | PASS | v0.2.5 宿主内 `tool_call`→`tool_result` 24.5 ms |
| SC-003 四类失败可读且父会话可用 | PASS | 假 agy 集成测试 + 六类诊断单元测试 |
| SC-004 安装 ≤2 步、10 分钟 | PASS | 1 条 `dsh plugin add`、约 1 s，随即真实委派成功 |
| SC-005 禁用恢复 + 无残留进程 | PASS | v0.2.5：禁用两行后模型无工具可用并自行回答、恢复后 `RESTORED_OK`、`pgrep agy` 无残留 |
| SC-006 文档三问 + 免责 | PASS | MiMo checklist 终审 + 组合包契约测试 |
| SC-007 入口选择 ≥9/10 | PASS | v0.2.5：10/10 真实会话选择 `subagent_oar_agy` |

## 复现命令

```bash
pnpm install
pnpm -r build
pnpm test --coverage
node scripts/real-smoke.mjs 10
node scripts/mode-smoke.mjs plan
node scripts/mode-smoke.mjs strict
node scripts/mode-smoke.mjs yolo
```

宿主级复现（临时 home，不触碰桌面 profile）：

```bash
# 从 app.asar 解包 CLI 后
DSH_HOME=/tmp/dsh_home node /tmp/dsh_app/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js \
  plugin --profile headless add /path/to/@jiezhengj/subagent_oar_agy
DSH_HOME=/tmp/dsh_home node /tmp/dsh_app/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js \
  --profile headless --json "Use subagent_oar with runtime agy to reply exactly OK"
```

## 桌面 profile 实装（2026-11-08 02:2x）

经用户明确要求，把组合包直接装入正在运行的桌面 DSH profile（`~/.dsh/profiles/desktop`），不重启应用：

| 步骤 | 结果 |
|---|---|
| 打包 | 组合包本地 tarball，provider 依赖指向本仓库 `packages/subagent-oar-agy-provider` |
| 安装 | `plugin_manager install_bundle`：`stage: enable`、`application: applied`，pnpm 394 ms |
| 生效 | `include:subagent-agy`、`include:tool-subagent-oar-agy` 均 `fiberPhase: active` |
| 实机冒烟 | 新建子代理调用 `subagent_oar(runtime=agy)`，AGY 返回 `LIVE_GUI_OK`，未使用其他子代理工具 |

- `list_bundles` 显示 `@jiezhengj/subagent_oar_agy` 0.1.0 `enabled: true`、`installed: true`。
- 安装来源是本机 tarball，provider 依赖以 `file:` 指向仓库路径；移动/删除仓库后需重新安装。
- 卸载/禁用可在 DSH「设置 → 插件」中操作，或 `plugin_manager remove_bundle`。

## 发布前修正：默认工具名改为 `subagent_agy`（v0.1.1）

**问题**：发布版若默认占用 `subagent_oar`，用户同时启用官方 OAR 组合包时第二个注册者必然失败（实测报错 `tool "subagent_oar" is already registered`，宿主丢弃该插件行）。这对第三方插件不可接受。

**决策**：组合包默认 `toolName: subagent_agy`，与官方 `subagent_oar` 天然区分，可同时启用；没有官方 OAR 的用户可覆盖回 `subagent_oar`。官方 OAR 工具实现与 patch 形态完全复用，仅改工具名。

**同步改动**：spec FR-016、US1 场景、plan/research/contracts、README/INSTALL/DETAIL、quickstart、组合包测试均更新；版本升至 0.1.1。

**实装验证**（桌面 profile，2026-11-08）：`remove_bundle` 卸载 0.1.0 → 安装 0.1.1 tarball（`application: applied`，pnpm 391 ms）→ 新会话子代理调用 `subagent_agy(runtime=agy)` 返回 `LIVE_AGY_OK`，未使用其他子代理工具。

## 定名：默认工具名 `subagent_oar_agy`（v0.1.2）

用户确认沿用项目本名。`subagent_oar_agy` 是合法工具名且天然唯一，与官方 OAR 的 `subagent_oar` 不冲突，因此作为发布默认名；`toolName` 仍可覆盖（改为 `subagent_oar` 或任意唯一名）。spec FR-016、plan/research/contracts、README/INSTALL/DETAIL、quickstart、组合包测试同步更新。

**实装验证**（桌面 profile）：卸载 0.1.1 → 安装 0.1.2（`application: applied`，371 ms）→ 新会话子代理调用 `subagent_oar_agy(runtime=agy)` 返回 `LIVE_OAR_AGY_OK`，未使用其他子代理工具。

## 本地化与改名（v0.2.1，SC-008）

- **包名**：组合包 `@jiezhengj/subagent_oar_agy`，提供方 `@jiezhengj/subagent_oar_agy-provider`；插件显示名固定为「AGY 子智能体」（按界面语言本地化）。
- **8 语言元数据**：两个包的 `locale/<lang>.json` 均含 `meta.title`/`meta.description`；组合包另有 `docs/DETAIL.<lang>.md`（zh/en/de/es/fr/ja/pt/ru）。
- **运行时文案**：`src/i18n.ts` 覆盖 8 语言的失败、超时、取消、权限拒绝等文案；`locale: auto` 时依次读取 `locale` 配置、DSH `settings.yaml` 的 `locale.preference`、`DSH_LOCALE`/`LC_ALL`/`LANG`，最后回退英文。
- **测试**：58 项全绿，新增 `i18n.test.ts`（语言表完整性、占位符、检测顺序、8 语言 locale 文件）与组合包 8 语言元数据/详情文件断言。
- **实装**：卸载旧包名 0.1.2 → 安装 `@jiezhengj/subagent_oar_agy` 0.2.1（`application: applied`），`locale/*.json` 与 `docs/DETAIL.*.md` 均已落入 profile；真实会话 `subagent_oar_agy(runtime=agy)` 返回 `FINAL_INSTALL_OK`。

## 公开分发（GitHub，v0.2.2）

- **隐私检查**：全仓库无令牌、密钥、邮箱、个人绝对路径（仅 `/tmp` 临时验证路径）；`node_modules`、`dist`、`coverage`、构建出的 `provider/` 与 tarball 均被忽略。
- **仓库**：`https://github.com/jiezhengj/DSH-Subagent-OAR-AGY`，public，topics：`dsh-plugin`、`dsh`、`deepseek-harness`、`antigravity`、`agy`、`subagent`；`main` 分支已推送。
- **发布包**：组合包改为自包含（构建时把提供方 `dist` 复制为 `provider/`，patch 引用 `@jiezhengj/subagent_oar_agy/agy-provider`），tarball 依赖只剩 npm 上的宿主包与官方 OAR 工具。
- **Release**：`v0.2.2` 附带 `subagent_oar_agy-0.2.2.tgz`；安装框输入 `https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.2/subagent_oar_agy-0.2.2.tgz`。
- **安装验证**：临时 `DSH_HOME` 用该 URL 安装成功（pnpm 拉取 tarball，官方 OAR 工具从 npm 安装）；本机桌面 profile 已卸载 0.2.1 并按同一 URL 安装 0.2.2（`application: applied`）。

- **README 索引**：仓库根 `README.md` 为索引页（语言导航 + 安装框输入 + 链接），8 种语言正文分别在 `README.<lang>.md`；组合包 README 也链接到这些语言版本。
- **Release URL 冒烟**：本机按 README 的安装框 URL 重装 0.2.2 后，`subagent_oar_agy(runtime=agy)` 返回 `RELEASE_INSTALL_OK`。

## 显示名回归修复（v0.2.3）

- **症状**：从 GitHub Release 安装后，插件页显示名变成 `@jiezhengj/subagent_oar_agy`，而非「AGY 子智能体」。
- **根因**：自包含改造给 `package.json` 增加 `exports` 后，Node 资源解析拒绝 `@jiezhengj/subagent_oar_agy/locale/en.json`、`/package.json`、`/icon`；DSH 的 `readPluginMeta` 读不到 locale 元数据，标题回退为包名。
- **修复**：`exports` 增加 `./locale/*`、`./agy-provider/locale/*`、`./icon`、`./package.json`；构建时一并复制提供方 `locale`；新增资源可解析性测试（59 项全绿）。
- **验证**：`readPluginMeta` 对组合包返回 8 语言标题（zh 为「AGY 子智能体」），对 `@jiezhengj/subagent_oar_agy/agy-provider` 返回「AGY 子智能体运行时」；按 Release URL 重装后真实委派冒烟通过。

## 最终发布验证（v0.2.3，2026-11-08）

- **发布物**：`v0.2.3` Release 资产 `subagent_oar_agy-0.2.3.tgz`，自包含（含 `provider/`、`locale/`、`docs/DETAIL.<lang>.md`）。
- **安装路径**：临时 `DSH_HOME` 与本机桌面 profile 均用安装框地址安装成功；桌面卸载 0.2.2 后安装 0.2.3（`application: applied`）。
- **显示名/元数据**：`readPluginMeta` 对组合包返回 8 语言标题（zh「AGY 子智能体」）、描述与图标；对 `@jiezhengj/subagent_oar_agy/agy-provider` 返回 8 语言「AGY 子智能体运行时」。
- **功能冒烟**：安装 0.2.3 后 `subagent_oar_agy(runtime=agy)` 返回 `TITLE_FIX_OK`。
- **README**：根 `README.md` 为语言索引页，链接 `README.de/en/es/fr/ja/pt/ru/zh.md`；组合包 README 也互链；安装框地址与 Release 一致。
- **仓库**：`https://github.com/jiezhengj/DSH-Subagent-OAR-AGY`，public，topics 含 `dsh-plugin`；`main` 已推送。

## 图标透明化（v0.2.4）

- **症状**：插件图标固定为深色方块，不随 DSH 浅/深主题变化。
- **查证**：DSH 无浅/深双图标机制与滤镜；`readPluginMeta` 只解析单个 `icon`，客户端以 `<img>` 渲染，不继承主题 CSS 变量。官方 21 个插件图标均为 36×36、`fill="none"` 透明画布；此前我们的图标自带不透明 `#0f172a` 圆角矩形，故固定深色。
- **修复**：改为 36×36 透明画布（蓝色渐变 A 标记 + 粉色节点），无背景块；`readPluginMeta` 解析出的 data URL 以 `width="36"`、`fill="none"` 开头且不含整块不透明矩形。
- **发布**：v0.2.4，Release 资产与 README/INSTALL 安装地址同步更新；实装后插件行 active，显示名与图标元数据正常。

## 收敛修复与验证（v0.2.5）

| 任务 | 结果 |
|---|---|
| T042 官方工具包可用性校验与同形回退 | 工具行改为包内 `tool.js`：官方包可解析时挂载官方插件；缺失时警告并注册内置同形工具。单元测试覆盖两条路径；另用去掉官方依赖的变体包安装到临时 profile（确认 profile 内无官方包），会话仍通过 `subagent_oar_agy` 返回 `FALLBACK_OK` |
| T043 安装文档修正 | 组合包 README 删除未上架 npm 的 `dsh plugin add @jiezhengj/subagent_oar_agy`，改为 Release 地址/本地 tarball；配置表补 `locale`；INSTALL 本地 tarball 文件名改为 `<version>` |
| T044 真机验收重新基线 | 10/10 委派成功（14.8–19.1 s）、启动确认 24.5 ms、禁用/恢复与无残留进程均通过（见上） |
| T045 与官方 OAR 共存 | 同会话同时调用 `subagent_oar`、`subagent_oar_agy`，分别返回 `OFFICIAL_OK` / `AGY_OK` |
| T046 许可证 | 新增根 `LICENSE`（MIT）；根与两个包的 `package.json` 均加 `"license": "MIT"`；README 增加许可证声明 |
| T047 超时语义文档 | README 明确：`timeoutMs` 不配置时不设内部时限，委派只能由父会话取消/关闭终止 |
| T048 DSH 版本拒绝 | 用 `engines.dsh: ">=99.0.0 <100.0.0"` 的临时 bundle 执行 `dsh plugin add`，宿主拒绝安装并输出 `requirements {"engines.dsh":">=99.0.0 <100.0.0"}` 与所需范围 |

- 测试：`pnpm test` → 11 文件 / 63 项全绿。
- 版本：`@jiezhengj/subagent_oar_agy@0.2.5`，Release 资产为最终验证对象。
