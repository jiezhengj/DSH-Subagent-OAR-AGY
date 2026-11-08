# Implementation Plan: npm 短名称安装（注册表分发）

**Branch**: `002-npm-distribution` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-npm-distribution/spec.md`

## Summary

把 `@jiezhengj/subagent_oar_agy` 组合包从「只发 GitHub Release tgz」扩展为「同时发布到公共 npm 注册表」，安装框主路径变成填 `@jiezhengj/subagent_oar_agy`，并保留 tgz 作为备选。发布前由 `prepublishOnly` 自动构建 provider、生成包内产物并校验清单，发布后把同一份 npm tarball 作为 `v0.2.6` Release 资产；文档统一改为主推名称、tgz 地址作为备选。不改变插件运行时行为、工具表面与安全模型。

## Technical Context

**Language/Version**: JavaScript ESM（`tool.js` 与发布脚本）、TypeScript 编译产物（provider）；Node 26.0.0

**Primary Dependencies**: pnpm 12.18（workspace）、npm CLI 12.2.2（发布）、现有 `scripts/vendor-provider.mjs` 构建链、DSH 0.2.2-rc.1、公共 npm 注册表

**Storage**: N/A（不新增运行时数据；分发包本身是唯一产物）

**Testing**: Vitest（现有 11 文件 63 项）+ 新增 `test/distribution.test.ts` 静态契约测试 + `scripts/verify-package.mjs` 发布前校验 + `npm pack` 消费者安装冒烟 + 隔离 DSH HOME 的按名称安装/启动

**Target Platform**: 发布者 macOS（arm64，本机手动发布）；使用者为 DSH `>=0.2.2-rc.1 <0.3.0` 的桌面应用

**Project Type**: pnpm 多包仓库中的可分发组合包（bundle）+ 发布配置与文档

**Performance Goals**: 一次发布（构建 + 校验 + 上传）≤5 分钟；npm tarball ≤50 kB、解包 ≤150 kB（当前 45.9 kB / 135.4 kB）；使用者按名称安装到可用 ≤2 步

**Constraints**: 作用域包必须显式 `publishConfig.access = "public"`；包名固定为 `@jiezhengj/subagent_oar_agy`（27 字符）；首发版本 `0.2.6`（`v0.2.5` 的 tag/Release 已发布，不可覆盖）；发布时 npm 若要求 OTP 由发布者当场提供；发布凭据不得进入仓库、脚本输出或日志；打包前必须从干净状态构建，避免发出缺少 `provider/` 的空壳；npm 包内必须自带 `LICENSE`（仓库根 `LICENSE` 不会进入 npm tarball）

**Scale/Scope**: 1 个 npm 包、约 71 个文件、11 份安装文档（根索引 + 8 语言 + 组合包 README + INSTALL）、3 份契约、1 个校验脚本、1 个新增测试文件

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 判断 | 说明 |
|---|---|---|
| I 官方优先，最小自研 | 通过 | 使用官方 npm 注册表、DSH 插件安装器与现有构建/打包链；只新增发布校验脚本与清单字段，不新增运行时能力 |
| II 非 ACP 与外部进程边界 | 通过 | 分发方式不触碰 `agy -p` 子进程边界、不打包 AGY、不涉及 token |
| III 一次性委派契约 | 通过 | 客户端运行时与 provider 契约完全不变；发布产物只是现有构建结果的搬运 |
| IV 可安装、可恢复、可诊断 | 通过 | 名称安装与版本面板是本次目标；保留 tgz 备选与安装失败诊断，禁用/回滚路径不变 |
| V 透明默认与合规声明 | 通过 | README 继续保留非官方封装、自担风险与 Antigravity 政策声明；npm 包内加入 MIT `LICENSE` 与 `publishConfig` |
| 附加约束（技术栈/版本策略/范围） | 通过 | 不改变 TypeScript ESM、`engines.dsh` 与仅 AGY 运行时范围 |
| 开发工作流 | 通过 | 走 Feature SDD 短路径；本阶段为 plan，后续 tasks → implement；发布前跑测试与隔离安装验证 |

**GATE 结论**：无违反项，无需 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```text
specs/002-npm-distribution/
├── plan.md              # 本文件
├── research.md          # Phase 0 决策记录
├── data-model.md        # Phase 1 实体与不变量
├── quickstart.md        # Phase 1 发布与验证手册
├── contracts/
│   ├── package-manifest.md   # 发布包清单与生命周期契约
│   ├── install-entry.md      # 名称/ tgz 两种安装入口契约
│   └── release-parity.md     # npm 与 GitHub Release 同版本同内容
└── checklists/
    └── requirements.md       # 规格质量清单
```

### Source Code (repository root)

```text
packages/subagent-oar-agy-bundle/
├── package.json                 # 增加 publishConfig、keywords、prepublishOnly、files 中的 LICENSE
├── LICENSE                      # 新增：与仓库根 LICENSE 同文的包内副本
├── tool.js                      # 工具包装，不改运行时行为
├── cordis.patch.yml             # 组合包 patch，不改
├── icon.svg                     # 插件图标，不改
├── README.md                    # 安装主路径改为名称，tgz 作为备选
├── docs/
│   ├── INSTALL.md               # 同步主路径与迁移说明
│   └── DETAIL.*.md              # 8 语言实现说明，不改安装语义
├── locale/                      # 8 语言界面文案，不改
├── provider/                    # 构建产物（不入库），由 prepublish 生成
├── scripts/
│   ├── vendor-provider.mjs      # 现有构建步骤
│   └── verify-package.mjs       # 新增：发布清单静态校验
└── test/
    ├── bundle.test.ts           # 现有契约测试
    ├── tool.test.ts             # 现有工具测试
    └── distribution.test.ts     # 新增：发布元数据与文件清单测试

README.md                        # 英文索引：安装框改为名称 + tgz 备选
README.{zh,en,de,es,fr,ja,pt,ru}.md  # 8 语言全文：安装主路径改为名称
```

**Structure Decision**: 发布单元保持为 `packages/subagent-oar-agy-bundle/`，发布工具脚本放在该包 `scripts/` 下且不进入 `files`；仓库继续使用 pnpm workspace，不新增 npm workspaces 配置，避免影响现有 pnpm 锁文件与桌面 profile 安装流程。文档改动只在根 README 与组合包文档，运行时代码零改动。

## Phases

### Phase 0：研究（research.md）

- 固化注册表/访问级别、发布方式与 OTP、打包前准备、版本与渠道一致性、文档主路径、更新资格、回滚、LICENSE 打包与名称合法性九项决策。
- 所有结论以本机事实核对为依据（npm whoami、E404、DSH 安装器代码、`npm publish --dry-run`、`npm pack` 消费者安装）。

### Phase 1：设计与契约

- `data-model.md`：分发包、发布渠道、安装入口与已安装依赖的字段和不变量。
- `contracts/package-manifest.md`：包名、访问级别、必填元数据、必需文件、发布生命周期与禁止项。
- `contracts/install-entry.md`：名称主路径、tgz 备选、失败语义、更新资格、迁移步骤。
- `contracts/release-parity.md`：版本来源、发布顺序、同一 tarball、校验和/文件清单核对、不可覆盖规则。
- `quickstart.md`：从前提核对到 npm 发布、Release、隔离安装、parity 与凭据扫描的可执行步骤。

### Phase 2：任务拆分（后续 `/speckit-tasks`）

任务将按用户故事分组：US1 名称安装（发布准备 + 文档 + 发布 + 隔离安装），US2 版本面板（依赖形态 + 版本元数据 + 更新资格核对），US3 双渠道一致（版本号、Release、parity、凭据扫描）。US1 是 MVP。

## Risks and Mitigations

| 风险 | 影响 | 缓解 |
|---|---|---|
| npm 要求 OTP 且发布中断 | 发布不完整 | 先完成本地构建/校验；OTP 当场输入；失败不改已发布版本，补发或升版本 |
| `prepublishOnly` 在干净 clone 中缺依赖或顺序错误 | 发出空壳包 | 脚本先跑根 workspace 构建（拓扑顺序保证 provider 先于 vendor），再由 `verify-package.mjs` 断言产物存在 |
| 仓库根 `LICENSE` 不进 npm tarball | 包内无许可证 | 新增包内 `LICENSE` 副本，校验脚本比对根文件内容 |
| npm 版本与 Release 资产漂移 | 用户装到不同内容 | 只上传 `npm pack` 的同一文件；记录 SHA-256 与文件清单；不覆盖已发布版本 |
| 文档仍以 tgz 为主路径 | 短名称收益被抵消 | 11 份安装文档统一改写；用 grep 校验不残留「本包未上架 npm」等旧表述 |
| 注册表不可达 | 用户装不上 | 保留 tgz 地址，契约记录宿主错误键与提示 |
| 更新面板显示不可更新 | 用户无法升级 | 验证 profile 依赖为注册表规格，核对 `updateRefusal()` 的 registry 分支；tgz 来源明确标为不可更新 |

## Complexity Tracking

无 Constitution 违反项，无需填写。
