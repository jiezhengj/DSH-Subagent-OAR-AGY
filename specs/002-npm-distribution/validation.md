# 发布前置与版本

- 发布账号：`npm whoami` = `jiezhengj`；发布前 `npm view @jiezhengj/subagent_oar_agy version` 为 E404。
- 基线：`pnpm test` 11 文件 / 63 项通过；实现后 12 文件 / 69 项通过。
- 首个 npm 版本 `0.2.6` 于 2026-11-09 02:24（Asia/Shanghai）发布；`v0.2.5` 的 tag/Release 保持不变。
- 为在真实 DSH 中验证「发现更新 → 应用内升级」，随后发布内容等价的 `0.2.7`。当前文档、注册表 `latest` 与真实桌面 profile 均为 `0.2.7`；本文件同时记录 `0.2.6` 首发与 `0.2.7` 更新验证。

# 包清单

- `packages/subagent-oar-agy-bundle/LICENSE` 与仓库根 `LICENSE` 逐字一致（1066 B）。
- `publishConfig.access = "public"`；`keywords` 含 `dsh-plugin`；`files` 含 `LICENSE`；`prepublishOnly` 执行根构建与 `verify-package.mjs`。
- 0.2.7 打包结果：`71` 个文件、`46684` B、解包 `136665` B；`LICENSE`、`tool.js`、`provider/index.js`、`cordis.patch.yml`、8 语言 locale 与 8 份 `docs/DETAIL.*.md` 均在清单内。
- `node packages/subagent-oar-agy-bundle/scripts/verify-package.mjs` 退出 0。
- 0.2.6 首发包同为 71 个文件、`46684` B、解包 `136665` B。

# 注册表与双渠道

- npm：`@jiezhengj/subagent_oar_agy@0.2.7`，`dist.shasum = 65cd31bb8becba7ef305aaf230ee5aea05e84426`，`engines.dsh = >=0.2.2-rc.1 <0.3.0`。
- Release：`v0.2.7` 资产 `subagent_oar_agy-0.2.7.tgz`。
- 本地 `npm pack`、Release 资产、注册表 tarball 的 SHA-256 均为 `f40a5fdf82f16b0aa3e91febc36bec7d152d536cb12dc34f951d012b13094420`；本地 SHA-1 与 `dist.shasum` 一致。
- `v0.2.5` 仍只有 `subagent_oar_agy-0.2.5.tgz`，未被覆盖。
- 重复发布 `0.2.7` 被拒绝：注册表返回 `403`，文案 `You cannot publish over the previously published versions: 0.2.7.`（语义等同 409，未发生覆盖）。

# US1 名称安装与启动

隔离环境固定 `HOME=/tmp/vhome DSH_HOME=/tmp/vhome`，deskclone profile 不使用真实 `~/.dsh`。

- 安装依赖值：`0.2.7`（注册表规格，不是 URL/`link:`/`npm:` 别名）；解析版本同为 `0.2.7`；`dsh.profile.bundles` 含 `@jiezhengj/subagent_oar_agy`。
- SC-006 连续 3 轮：每轮重建隔离 home、remove/add、`--port 18131` 启动；3 轮均出现 `http://127.0.0.1:18131/?token=`，且无 `did not activate`，结果 `SC-006 PASS`。
- 真实桌面 profile 也改为注册表规格 `0.2.7`，插件详情显示 v0.2.7、2 个组件均「运行中」。

# US1 失败语义

- 隔离 profile 写入 `registry=http://127.0.0.1:9`、`fetch-retries=0` 后执行真实 CLI 安装，退出码 1：
  - `ERR_PNPM_RESOLVING_NPM_RESOLVER_NETWORK_ERROR`
  - `Failed to fetch metadata from http://127.0.0.1:9/`
  - `tcp connect error: Connection refused (os error 61)`
- 失败后依赖值仍为 `0.2.7`，已安装包仍为 `0.2.7`，无半装状态。
- `npm view --registry=http://127.0.0.1:9 --fetch-retries=0 ...` 退出码 1，作为 CLI 侧独立证据。
- 隔离实例带坏 `.npmrc` 打开插件详情「版本」区：显示「无法检查更新 / 默认安装源 失败」，同时插件仍安装、组件仍运行，对应 `versionsFailedNetwork`。
- 例外：安装框的 `installProblemNetwork`、`installProblemNotFound` 未逐一点击验证；已用真实 CLI 失败与版本区网络失败覆盖同一条注册表不可达路径。

# US2 版本面板与更新

真实桌面操作顺序（DSH 设置 → 插件 → AGY 子智能体 → 版本）：

1. 按名称安装后详情显示 `v0.2.6`、`@jiezhengj/subagent_oar_agy@0.2.6`、当前版本 `0.2.6`、`已是最新版本`。
2. 发布 `0.2.7` 后点「重新检查」，出现「可更新 / 可更新到 0.2.7 / 1 个新版本」与「更新到 0.2.7」。
3. 点击「更新到 0.2.7」，确认对话框显示「将从 0.2.6 更新到 0.2.7」；确认后 profile 依赖值与安装版本均变为 `0.2.7`。
4. 再次打开详情：`v0.2.7`、当前版本 `0.2.7`、`已是最新版本`，2 个组件均「运行中」。

该路径同时证明注册表来源的 `updateRefusal()` 放行、更新入口可用，且不需要卸载重装。`engines.dsh` 不兼容过滤未构造单版本实测，按宿主代码路径核对，列为代码核对例外。

# US3 tgz 备选、迁移与不可覆盖

- 从隔离 profile 移除名称条目后安装 Release tgz：依赖值保存为 `https://github.com/.../v0.2.7/subagent_oar_agy-0.2.7.tgz`，安装版本 `0.2.7`。
- 再移除 tgz 条目并按名称安装：依赖值变回 `0.2.7`，安装版本 `0.2.7`，没有重复依赖。
- 重复发布拒绝见「注册表与双渠道」。

# 文档、回归与凭据

- 11 份安装文档均含包名；11 份均含 `subagent_oar_agy-0.2.7.tgz` 备选；无「本包未上架 npm」与 0.2.6 旧主路径残留。
- `pnpm test`：12 文件 / 69 项通过；`pnpm --dir packages/subagent-oar-agy-bundle run build` 通过；`verify-package.mjs` 通过。
- 仓库内 `*.tgz`（排除 node_modules）为 0；tracked `.npmrc` 为 0。
- 仓库文件与提交历史搜索 `npm_rM074...`、`_authToken=` 命中为 0；发布令牌只在 `/tmp/npmrc-publish`，未进入仓库。
- 工作区剩余改动仅为 `.specify/extensions/.cache/*` 与未跟踪的 `.specify/workflows/.cache/`，与本次发布无关。

# 例外与说明

- 首发版本按 spec 决策为 `0.2.6`；`0.2.7` 是为验证真实应用内更新而追加的等价版本，不改变首发记录。任务清单中的 `0.2.6` 文字保留为历史计划，实际交付版本以本文件与当前 `package.json` 的 `0.2.7` 为准。
- 注册表 packument 在首次发布后约 6 分钟才可匿名读取；期间 PUT 已能识别版本已存在。之后 0.2.7 同样有短暂传播延迟，等待后正常。
- 未执行 `npm unpublish`，未覆盖任何已发布 tag/Release。
