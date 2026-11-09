# 发布前置与版本

- 发布账号：`npm whoami` = `jiezhengj`；发布前 `npm view @jiezhengj/subagent-oar-agy version` 为 E404。
- 基线：`pnpm test` 11 文件 / 63 项通过；实现后 12 文件 / 69 项通过；Convergence 后 12 文件 / 70 项通过。
- 首个 npm 版本 `0.2.6` 于 2026-11-09 02:24（Asia/Shanghai）发布；`v0.2.5` 的 tag/Release 保持不变。
- 为在真实 DSH 中验证「发现更新 → 应用内升级」，随后发布内容等价的 `0.2.7`；本文件记录 `0.2.6` 首发与 `0.2.7` 更新验证。
- **2026-11-09 包名更正**：分发名称由下划线形式改为 `@jiezhengj/subagent-oar-agy`（连字符形式）；新名称于同日发布 `0.2.8`，当前注册表 `latest` 与真实桌面 profile 均为 `0.2.8`。旧名称的 0.2.6/0.2.7 产物保留在 npm；本文件历史段落中的包名已按新名称统一，版本号仍保留当时事实。

# 包清单

- `packages/subagent-oar-agy-bundle/LICENSE` 与仓库根 `LICENSE` 逐字一致（1066 B）。
- `publishConfig.access = "public"`；`keywords` 含 `dsh-plugin`；`files` 含 `LICENSE`；`prepublishOnly` 执行根构建与 `verify-package.mjs`。
- 0.2.7 历史打包结果：`71` 个文件、`46684` B、解包 `136665` B；`LICENSE`、`tool.js`、`provider/index.js`、`cordis.patch.yml`、8 语言 locale 与 8 份 `docs/DETAIL.*.md` 均在清单内。
- 新名称 0.2.8 打包结果：`71` 个文件、`46954` B、解包 `137755` B；`npm pack` 文件名为 `jiezhengj-subagent-oar-agy-0.2.8.tgz`；SHA-256 `e9cf70b06028b7bb2886ca97f0cd50ba61086fbafbd07e27f19c6a1681cc45ee`，SHA-1 `4bf786fcd7ff28657c987554b3608e11c1fbc13e`。
- `node packages/subagent-oar-agy-bundle/scripts/verify-package.mjs` 退出 0。
- 0.2.6 首发包同为 71 个文件、`46684` B、解包 `136665` B。

# 注册表与双渠道

- npm：新名称 `@jiezhengj/subagent-oar-agy@0.2.8`，`dist.shasum = 4bf786fcd7ff28657c987554b3608e11c1fbc13e`，`engines.dsh = >=0.2.2-rc.1 <0.3.0`；旧名称 `0.2.7` 记录保留。
- Release：`v0.2.8` 资产 `subagent-oar-agy-0.2.8.tgz`；历史 `v0.2.7` 与 `v0.2.5` 的资产保留。
- 0.2.8 本地 `npm pack`、注册表 tarball、Release 资产三者的 SHA-256 均为 `e9cf70b06028b7bb2886ca97f0cd50ba61086fbafbd07e27f19c6a1681cc45ee`；SHA-1 与 `dist.shasum` 均为 `4bf786fcd7ff28657c987554b3608e11c1fbc13e`；注册表 `dist.integrity = sha512-CtjTsA9PG4BFl5/FD4M2aKyVj62Mrdytl41LWvMUwe1lVGxkFroiKCPCGP68yX/gRI7heQzECyGoc4kMVlilIA==`。历史 0.2.7 的 SHA-256 为 `f40a5fdf82f16b0aa3e91febc36bec7d152d536cb12dc34f951d012b13094420`。
- `v0.2.5` 仍只有 `subagent_oar_agy-0.2.5.tgz`，未被覆盖。
- 旧名称 npm 包的 0.0.0-stage、0.2.6、0.2.7 已全部标记 deprecated，提示迁移到 `@jiezhengj/subagent-oar-agy`；未执行 unpublish。
- 重复发布 `0.2.7` 被拒绝：注册表返回 `403`，文案 `You cannot publish over the previously published versions: 0.2.7.`（语义等同 409，未发生覆盖）。

# US1 名称安装与启动

隔离环境固定 `HOME=/tmp/vhome DSH_HOME=/tmp/vhome`，deskclone profile 不使用真实 `~/.dsh`。

- 安装依赖值：`0.2.7`（注册表规格，不是 URL/`link:`/`npm:` 别名）；解析版本同为 `0.2.7`；`dsh.profile.bundles` 含 `@jiezhengj/subagent-oar-agy`。
- SC-006 连续 3 轮：每轮重建隔离 home、remove/add、`--port 18131` 启动；3 轮均出现 `http://127.0.0.1:18131/?token=`，且无 `did not activate`，结果 `SC-006 PASS`。
- 真实桌面 profile 的依赖已替换为 `@jiezhengj/subagent-oar-agy: 0.2.8`，旧包已从依赖、lockfile 与 `node_modules` 移除；隔离副本启动成功。正在运行的 DSH 桌面进程仍缓存旧插件视图，需重启应用后加载新包。

# US1 失败语义

- 隔离 profile 写入 `registry=http://127.0.0.1:9`、`fetch-retries=0` 后执行真实 CLI 安装，退出码 1：
  - `ERR_PNPM_RESOLVING_NPM_RESOLVER_NETWORK_ERROR`
  - `Failed to fetch metadata from http://127.0.0.1:9/`
  - `tcp connect error: Connection refused (os error 61)`
- 失败后依赖值仍为 `0.2.7`，已安装包仍为 `0.2.7`，无半装状态。
- `npm view --registry=http://127.0.0.1:9 --fetch-retries=0 ...` 退出码 1，作为 CLI 侧独立证据。
- 隔离实例带坏 `.npmrc` 打开插件详情「版本」区：显示「无法检查更新 / 默认安装源 失败」，同时插件仍安装、组件仍运行，对应 `versionsFailedNetwork`。
- 安装框网络失败（真实隔离 UI）：安装源为 `127.0.0.1:9`，输入未安装探测名 `@jiezhengj/dsh-probe-uninstalled` 后显示「无法获取插件信息：ERR_PNPM_RESOLVING_NPM_RESOLVER_NETWORK_ERROR / Failed to fetch metadata from http://127.0.0.1:9/…」；profile 依赖未新增探测名，无半装。
- 安装框不存在名称（真实隔离 UI，安装源为可达镜像）：输入 `@jiezhengj/definitely-not-a-pack-xyz` 后显示「未找到相关插件」；profile 依赖未新增该名称。

# US2 版本面板与更新

真实桌面操作顺序（DSH 设置 → 插件 → AGY 子智能体 → 版本）：

1. 按名称安装后详情显示 `v0.2.6`、`@jiezhengj/subagent-oar-agy@0.2.6`、当前版本 `0.2.6`、`已是最新版本`。
2. 发布 `0.2.7` 后点「重新检查」，出现「可更新 / 可更新到 0.2.7 / 1 个新版本」与「更新到 0.2.7」。
3. 点击「更新到 0.2.7」，确认对话框显示「将从 0.2.6 更新到 0.2.7」；确认后 profile 依赖值与安装版本均变为 `0.2.7`。
4. 再次打开详情：`v0.2.7`、当前版本 `0.2.7`、`已是最新版本`，2 个组件均「运行中」。

该路径同时证明注册表来源的 `updateRefusal()` 放行、更新入口可用，且不需要卸载重装。

# US3 tgz 备选、迁移与不可覆盖

- 从隔离 profile 移除名称条目后安装 Release tgz：依赖值保存为 `https://github.com/.../v0.2.7/subagent_oar_agy-0.2.7.tgz`，安装版本 `0.2.7`。
- 再移除 tgz 条目并按名称安装：依赖值变回 `0.2.7`，安装版本 `0.2.7`，没有重复依赖。
- 重复发布拒绝见「注册表与双渠道」。

# Convergence 记录（2026-11-09）

- T035：11 份安装文档均补「按提示重载（必要时重启）DSH」说明。
- T036：11 份文档均补 tgz → 名称迁移步骤；配置保留措辞改为「通常保留，若随旧条目移除则重新填写」。
- T037：`verify-package.mjs` 增加 `files` 精确白名单、禁止路径/`npm:` 别名检查；`distribution.test.ts` 增加白名单断言；测试 12 文件 / 70 项通过。
- T038：隔离 UI 实测安装框网络失败（`ERR_PNPM_RESOLVING_NPM_RESOLVER_NETWORK_ERROR`）与不存在名称（「未找到相关插件」），均无依赖新增。
- T039：`engines.dsh` 过滤记录为宿主边界；本机 DSH bundle 存在 `versionsBlocked` / `versionsBlockedDetail` 文案键，不发布伪造的不兼容版本。
- T040：根 README 增加 feature 002 规格与验证记录链接。

# 文档、回归与凭据

- 11 份安装文档均含包名；11 份均含 `subagent_oar_agy-0.2.7.tgz` 备选；无「本包未上架 npm」与 0.2.6 旧主路径残留。
- Convergence 后 11 份文档均含重载/重启说明与 tgz → 名称迁移步骤；根 `README.md` 增加 feature 002 规格与验证记录链接。
- `pnpm test`：12 文件 / 70 项通过；`pnpm --dir packages/subagent-oar-agy-bundle run build` 通过；`verify-package.mjs` 通过。
- `verify-package.mjs` 已校验 `files` 精确白名单，并拒绝 `src/`、`test/`、`scripts/`、`.env`、日志/临时文件、`.DS_Store`、`.npmrc`、非声明 TypeScript 源码、`*.tgz` 与 `npm:` 依赖别名；`docs/` 只允许 `INSTALL.md` 与 8 份 `DETAIL.*.md`。
- 仓库内 `*.tgz`（排除 node_modules）为 0；tracked `.npmrc` 为 0。
- 仓库文件与提交历史搜索 `npm_rM074...`、`_authToken=` 命中为 0；发布令牌只在 `/tmp/npmrc-publish`，未进入仓库。
- 工作区剩余改动仅为 `.specify/extensions/.cache/*` 与未跟踪的 `.specify/workflows/.cache/`，与本次发布无关。

# 例外与说明

- 旧名首发版本按 spec 决策为 `0.2.6`；`0.2.7` 是为验证真实应用内更新而追加的等价版本。2026-11-09 包名更正后，新名称首发 `0.2.8`；当前交付版本以 `package.json` 的 `0.2.8` 为准。
- 真实桌面进程未在本次收尾中重启（重启会结束当前 Agent 会话），因此其插件页仍显示旧包缓存；profile 磁盘状态已是 0.2.8，重启 DSH 即加载新包。
- 注册表 packument 在首次发布后约 6 分钟才可匿名读取；期间 PUT 已能识别版本已存在。之后 0.2.7 同样有短暂传播延迟，等待后正常。
- `engines.dsh` 不兼容过滤属于宿主行为：本机 DSH bundle 中存在 `versionsBlocked` / `versionsBlockedDetail` 文案键；本 feature 不发布一个要求更高 DSH 的测试版本，以免污染注册表，故 US2 场景 3 记为宿主边界核对，不构造单版本实测。
- Convergence 的文档修订已随 0.2.8 新名称首发一起发布；旧名称 0.2.7 产物保持原样。
- 未执行 `npm unpublish`，未覆盖任何已发布 tag/Release。
