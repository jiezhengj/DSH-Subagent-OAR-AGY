# Phase 0 研究：npm 短名称安装

本阶段把 spec 中的未知项落到可执行决策。结论均在本机核对：macOS arm64、Node 26.0.0、npm 12.2.2、pnpm 12.18.0、DSH 0.2.2-rc.1、AGY 1.5.3。

## D1 注册表与访问级别

- **Decision**: 发布到公共 npm 注册表（`https://registry.npmjs.org/`），作用域包显式声明 `publishConfig.access = "public"`。
- **Rationale**: DSH 插件管理的安装框把裸名称当注册表规格（`parseInstallSpec` 返回 `kind: "registry"`），安装计划只问「已配置的注册表」；使用者必须能匿名读取，作用域包默认 restricted，不声明 public 会被注册表拒绝。实际核对：`npm whoami` = `jiezhengj`；`npm view @jiezhengj/subagent_oar_agy` 返回 E404（尚未发布、名称可用）。
- **Alternatives considered**: GitHub Packages（需要读者带令牌，安装框无法匿名安装，否决）；只做 tgz 短链（仍是 URL、拿不到版本面板，否决）。

## D2 发布方式与 2FA

- **Decision**: 本机手动发布；npm 要求 OTP 时由发布者当场提供 6 位码。不引入发布流水线，不写 `NPM_TOKEN`。
- **Rationale**: 与 DSHAnywhere 的既有决策一致；`~/.npmrc` 已登录 `jiezhengj`，凭据只留在发布者本机，仓库与脚本零令牌。npm 12.2.2 的 `npm publish --dry-run --access public` 已通过，说明包名与访问级别可用。
- **Alternatives considered**: GitHub Actions + NPM_TOKEN（多一个令牌面，否决）；granular token 写入 `~/.npmrc`（可行但暂无必要，保留为后备）。

## D3 打包前准备与空壳防护

- **Decision**: 在 `packages/subagent-oar-agy-bundle/package.json` 增加 `prepublishOnly`，依次执行「根 workspace 构建（含 provider）→ 复制 provider 产物 → `scripts/verify-package.mjs` 校验清单」，任一步失败即中止发布。同时把 `LICENSE` 复制进包目录并纳入 `files`。
- **Rationale**: `provider/` 与 `dist/` 都不入库；手工 `npm publish` 极易发出缺 `provider/` 或 `tool.js` 的空壳。实测 `pnpm --dir ../.. run build` 在包目录内可用，且 pnpm 按 workspace 依赖拓扑先构建 provider。实测 `npm publish --dry-run` 当前列出 70 个文件、45.9 kB，但**不包含**仓库根 `LICENSE`；npm 只从包目录取许可证，因此必须有包内副本。
- **Alternatives considered**: 把 `dist/`/`provider/` 入库（违反现有 `.gitignore` 约定）；发布前手工跑构建（易漏，否决）。

## D4 版本与渠道一致性

- **Decision**: 首发 npm 版本 `0.2.6`（不是 0.2.5）：`v0.2.5` 的 tag 与 Release 已于 2026-11-08 发布且资产可下载，按「已发布版本不可覆盖」不能重发；同轮创建 `v0.2.6` Release，资产直接用 `npm pack` 产物改名。
- **Rationale**: 注册表同版本不可覆盖，tag/Release 资产也不应回改；版本号是唯一权威。先发布 npm 可以尽早暴露打包问题，Release 只镜像同一份 tarball。
- **Alternatives considered**: 复用 0.2.5 并 `gh release upload --clobber`（违反 Release 不可变，否决）；npm 用独立版本号（文档两套版本，否决）。

## D5 文档主路径

- **Decision**: 根 `README.md`（英文索引）+ 8 个语言 README + 组合包 `README.md` + `docs/INSTALL.md` 的安装框统一改为填 `@jiezhengj/subagent_oar_agy`；tgz 地址保留为「无法访问注册表时」的备选，并补充从 tgz 迁移到名称安装的步骤。
- **Rationale**: 11 份文档是使用者实际会打开的安装入口；只改根索引会让语言版本继续把 tgz 当主路径。当前 8 个语言 README 与组合包 README 都含 v0.2.5 的 tgz 地址，需要同步到 v0.2.6，并删除「本包未上架 npm」的旧表述。
- **Alternatives considered**: 只改根 README（漏语言版本，否决）；删除 tgz 说明（受限网络用户装不了，否决）。

## D6 更新资格与版本面板

- **Decision**: 用「隔离 HOME + 副本 profile + 按名称安装」验证依赖形态为注册表规格，再用宿主代码核对更新资格；真实桌面版本区只读核对，不修改桌面 profile。
- **Rationale**: `dsh-plugin-manager` 的 `updateRefusal()` 要求 `bundle.source` 解析为 `kind === "registry"`、解析出的包名与 `bundle.name` 相同、且 range 不含协议前缀；tgz 来源会被判为不可更新。按名称安装后 profile 依赖为注册表规格，更新面板才会显示当前版本与「已是最新」。
- **Alternatives considered**: 在真实桌面 profile 上反复安装（CLI 拒绝修改且污染用户环境，否决）。

## D7 环境、回滚与不可覆盖

- **Decision**: 发布统一在 `packages/subagent-oar-agy-bundle/` 目录执行 `npm publish --access public`；发布失败不改版本号，已发布版本只能通过新版本或 `npm deprecate` 处理；Release 缺资产时为新版本补发，绝不对已发布版本 `--clobber`。
- **Rationale**: 仓库根没有 npm workspaces 配置，从包目录发布最直接；不新增 npm workspaces 可避免影响 pnpm workspace 与桌面 profile 的锁文件。注册表没有「撤回」，回滚写成新版本才可复现。
- **Alternatives considered**: 在根 `package.json` 加 `workspaces` 后用 `npm publish --workspace`（会改变现有 pnpm 工作区语义，否决）；`npm unpublish`（24 小时内受限且可能破坏已安装用户，否决）。

## D8 包内 LICENSE 与名称合法性

- **Decision**: 新增 `packages/subagent-oar-agy-bundle/LICENSE`（与仓库根同文的 MIT 副本），由校验脚本逐字比对；包名继续用带下划线的 `@jiezhengj/subagent_oar_agy`。
- **Rationale**: 实测 `npm publish --dry-run` 的清单没有 `LICENSE`，`pnpm pack` 却因工作区根许可证而包含它，两条打包路径不一致；包内副本能保证 npm 与 Release 都带许可证。名称合法性用 npm 自带 `validate-npm-package-name` 核对为 `validForNewPackages: true`；DSH 的安装规格正则也允许下划线（`[a-z0-9._~-]`）。把 tarball 装进临时 npm 项目实测成功（32 个依赖），说明包内 `devDependencies` 的 `workspace:*` 不会阻碍消费者安装。
- **Alternatives considered**: 只在 `prepublishOnly` 临时复制根 LICENSE（会在包目录留下生成文件，且手工 `npm pack` 不含，否决）；改名去掉下划线（零收益且破坏既有包名/文档，否决）。

## D9 发布后校验命令

- **Decision**: 发布后用 `npm view @jiezhengj/subagent_oar_agy@0.2.6 version dist.tarball dist.integrity`、`npm pack @jiezhengj/subagent_oar_agy@0.2.6 --dry-run --json` 与 Release 资产 SHA-256 核对；文档版本用 `V=$(node -p "require('./packages/subagent-oar-agy-bundle/package.json').version")` 生成，不写死。
- **Rationale**: 注册表 tarball 与 Release 资产必须字节一致；`npm pack` 的 `integrity` 与 Release 的 `shasum` 能发现漂移。文档版本若写死，下次发版必然过期。
- **Alternatives considered**: 只比对版本号（不能发现内容漂移，否决）。

## 事实核对记录

| 项 | 结果 |
|---|---|
| `npm whoami` | `jiezhengj` |
| `npm view @jiezhengj/subagent_oar_agy` | E404（可用） |
| 包名合法性 | npm 校验器 `validForNewPackages: true`；长度 27 |
| 现有 tag/Release | `v0.2.5` 已存在，资产 `subagent_oar_agy-0.2.5.tgz` |
| 当前 `npm publish --dry-run` | 70 文件、45.9 kB、public access；缺 `LICENSE` |
| 当前 tgz 地址长度 | 101 字符 |
| DSH 更新资格 | `updateRefusal()` 要求 registry 来源、包名一致、range 无协议前缀 |
| DSH 安装错误键 | `installProblemNetwork` / `installProblemNetworkAll` / `versionsFailedNetwork` / `versionsBlocked` / `installProblemNotFound` / `installProblemInstalled` |
