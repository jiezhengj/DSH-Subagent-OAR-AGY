---
description: "Task list for npm 短名称安装（注册表分发）"
---

# Tasks: npm 短名称安装（注册表分发）

**Input**: Design documents from `/specs/002-npm-distribution/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md

**Tests**: 本 feature 要求自动化校验（plan/contracts/quickstart），因此包含发布清单测试与发布前校验脚本任务。

**Organization**: 按用户故事分组；US1 是 MVP（按名称安装），US2 验证更新面板，US3 保证 npm 与 Release 同版本同内容。

**版本说明**: 首发版本为 `0.2.6`（`v0.2.5` 的 tag 与 Release 已发布且不可覆盖）。下文命令统一用 `V=$(node -p "require('./packages/subagent-oar-agy-bundle/package.json').version")`。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、且无未完成依赖）
- **[Story]**: US1 / US2 / US3
- 每个任务都给出精确路径

## Path Conventions

仓库根 `packages/subagent-oar-agy-bundle/`（发布单元）、`packages/subagent-oar-agy-bundle/scripts/`、`packages/subagent-oar-agy-bundle/test/`、根 `README*.md`、组合包 `README.md` 与 `docs/INSTALL.md`。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 发布前置条件与事实核对（无代码改动）

- [ ] T001 核对发布前置并留档到本任务：`npm whoami` 为 `jiezhengj`；`npm view @jiezhengj/subagent_oar_agy version` 返回 E404（尚未发布）；`git ls-remote --tags origin | grep v0.2.5` 存在且 `gh release view v0.2.5 --json assets` 含 `subagent_oar_agy-0.2.5.tgz`；`git ls-remote --tags origin | grep v0.2.6` 为空；`packages/subagent-oar-agy-bundle/package.json` 当前版本为 0.2.5；`pnpm test` 基线为 11 文件 / 63 项通过

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 让「发布」可重复、可校验；所有用户故事的验证都依赖它

**⚠️ CRITICAL**: 未完成本阶段前，任何用户故事都不应开始

- [ ] T002 [P] 新增 `packages/subagent-oar-agy-bundle/LICENSE`：内容与仓库根 `LICENSE` 逐字相同（MIT），供 npm tarball 与 Release 资产携带许可证
- [ ] T003 更新 `packages/subagent-oar-agy-bundle/package.json`：加 `publishConfig: { access: "public" }`；加 `keywords`（至少包含 `dsh-plugin`）；加 `prepublishOnly`，内容为 `pnpm --dir ../.. run build && node scripts/verify-package.mjs`，执行根 workspace 构建并校验清单；`files` 加入 `LICENSE`
- [ ] T004 [P] 新增 `packages/subagent-oar-agy-bundle/scripts/verify-package.mjs`：校验 `name`（精确 `@jiezhengj/subagent_oar_agy`，长度 27）/`version`（合法 semver）/`publishConfig.access`/`license`/`keywords`/`engines.dsh`/`dsh.bundle.patch`/`exports`/`files`/`repository`/`homepage`/`bugs`；校验必需文件与禁止内容；逐字比对包内 `LICENSE` 与 `../../LICENSE`；失败退出 1
- [ ] T005 [P] 新增 `packages/subagent-oar-agy-bundle/test/distribution.test.ts`：静态断言发布名、`publishConfig`、`keywords`、`engines.dsh`、`exports`、`files` 含 `LICENSE`、`repository`/`homepage`/`bugs`、运行时依赖不含 `workspace:`/`file:`/`link:`、包内 `LICENSE` 与根文件一致
- [ ] T006 从干净状态验证准备链：在仓库根执行 `pnpm run build` 后执行 `node packages/subagent-oar-agy-bundle/scripts/verify-package.mjs`；再在包目录执行 `npm pack --dry-run --json > /tmp/pack.json`，用 `Object.values(require('/tmp/pack.json'))[0]` 读取（npm 12 输出以包名为键，不是数组），断言 `entryCount === 71`、`unpackedSize <= 150000`、文件路径为无前缀的 `LICENSE`、`provider/index.js`、`tool.js`；若需 `package/` 前缀，改用真实 `npm pack` + `tar -tzf` 后把 tarball 移到 `/tmp`

**Checkpoint**: 发布清单可自动校验，后续用户故事可以开始

---

## Phase 3: User Story 1 - 用一个短名称装好插件 (Priority: P1) 🎯 MVP

**Goal**: 在 DSH 安装框只填 `@jiezhengj/subagent_oar_agy` 完成安装，重启后工具与插件页出现。

**Independent Test**: 隔离 DSH HOME 中按名称安装、启动，确认工具列表出现 `subagent_oar_agy`，启动日志无未激活告警。

### Implementation for User Story 1

- [ ] T007 [P] [US1] 更新根 `README.md`（英文索引）与 `README.zh.md`、`README.en.md`、`README.de.md`、`README.es.md`、`README.fr.md`、`README.ja.md`、`README.pt.md`、`README.ru.md`：安装框主路径改为填 `@jiezhengj/subagent_oar_agy`；`dsh plugin add` 命令改为包名；tgz 地址改为 `v0.2.6` 备选；根 README 的 Release 链接改到 `v0.2.6`；补充名称安装后重启说明
- [ ] T008 [P] [US1] 更新 `packages/subagent-oar-agy-bundle/README.md` 与 `packages/subagent-oar-agy-bundle/docs/INSTALL.md`：主路径改为名称；tgz 改为 `v0.2.6` 备选；删除「本包未上架 npm」旧表述；补充从 tgz 迁移到名称安装的步骤
- [ ] T009 [US1] 文档一致性校验：grep `README.md`、`README.{zh,en,de,es,fr,ja,pt,ru}.md`、`packages/subagent-oar-agy-bundle/README.md`、`packages/subagent-oar-agy-bundle/docs/INSTALL.md` 共 11 份安装文档，确认名称出现、tgz 版本为 `0.2.6`、无「本包未上架 npm」与旧版本主路径；把命中数记录到本任务
- [ ] T010 [US1] 把 `packages/subagent-oar-agy-bundle/package.json` 版本升到 `0.2.6`；执行 `pnpm install --lockfile-only` 确认锁文件无异常；核对 `V=0.2.6`
- [ ] T011 [US1] 运行 `pnpm test` 与 `packages/subagent-oar-agy-bundle/scripts/verify-package.mjs`，提交实现、文档与发布配置（Conventional Commit）；用 `find . -name '*.tgz' -not -path '*/node_modules/*'` 检查并删除历史残留（此前有 `packages/subagent-oar-agy-bundle/dsh-subagent-agy-bundle-0.1.0.tgz` 与 `packages/subagent-oar-agy-provider/dsh-subagent-agy-0.1.0.tgz`），断言最终为 0
- [ ] T012 [US1] 在 `packages/subagent-oar-agy-bundle/` 执行 `npm publish --access public`（npm 要求时当场输入 OTP，记录开始/结束时间并确认 ≤5 分钟）；用 `npm view @jiezhengj/subagent_oar_agy@$V version dist.tarball dist.integrity engines --json` 核对注册表条目
- [ ] T013 [US1] 隔离安装验证（命令必须带 `HOME=/tmp/vhome DSH_HOME=/tmp/vhome`，禁止省略）：`/tmp/vhome` 复制桌面 profile，先 `HOME=/tmp/vhome DSH_HOME=/tmp/vhome <APP> <BIN> plugin --profile deskclone remove @jiezhengj/subagent_oar_agy`，再 `... plugin --profile deskclone add @jiezhengj/subagent_oar_agy --save-exact`；确认 profile 依赖为注册表规格、解析版本为 `$V`，且 profile `package.json` 的 `dsh.profile.bundles` 含该 bundle（否则不会激活）
- [ ] T014 [US1] 隔离启动验证（命令必须带 `HOME=/tmp/vhome DSH_HOME=/tmp/vhome`）：启动 `/tmp/vhome/profiles/deskclone`，确认插件页显示「AGY 子智能体」、工具列表出现 `subagent_oar_agy`、启动日志无未激活告警；调用一次 `subagent_oar_agy(runtime=agy)` 并记录返回
- [ ] T015 [US1] SC-006 连续验证：每轮先重建隔离环境（`rm -rf /tmp/vhome` 后重新 `cp -a ~/.dsh/profiles/desktop /tmp/vhome/profiles/deskclone`），再重复「移除 → 按名称安装 → 启动」3 次（所有命令带 `HOME=/tmp/vhome DSH_HOME=/tmp/vhome`），每次记录启动日志结论；3 次均无未激活告警才算通过
- [ ] T016 [US1] 失败语义与重复安装：在 `/tmp/vhome/profiles/deskclone/.npmrc` 写入 `registry=http://127.0.0.1:9`、`fetch-retries=0`，用带 `HOME=/tmp/vhome DSH_HOME=/tmp/vhome` 的 `<APP> <BIN> plugin --profile deskclone add @jiezhengj/subagent_oar_agy`（BIN/APP 定义见 quickstart 第 4 步）触发真实安装失败，记录输出文案与「依赖未写入、无半装状态」；在 `.npmrc` 仍生效期间打开插件管理「版本」区，记录网络失败文案并核对 `versionsFailedNetwork`；删除 `.npmrc` 后恢复；另用 `npm view --registry=http://127.0.0.1:9 --fetch-retries=0 ...` 作为 CLI 侧证据，并核对宿主键 `installProblemNetwork`/`installProblemNetworkAll`/`installProblemNotFound`/`installProblemInstalled`；在已安装 `$V` 的隔离 profile 再次 `add --save-exact`，确认依赖值不变且不产生第二份依赖

**Checkpoint**: 新用户只填名称即可装好、启动并调用工具；连续 3 次与失败路径均有结论

---

## Phase 4: User Story 2 - 安装后能看版本、能点更新 (Priority: P2)

**Goal**: 按名称安装后，版本区显示当前版本与「已是最新」；依赖形态是注册表规格，更新资格成立。

**Independent Test**: 隔离环境确认依赖形态与版本元数据；真实 App 版本区只读核对；更新/不兼容按宿主代码与本地旧版本模拟验证。

### Implementation for User Story 2

- [ ] T017 [US2] 在 `packages/subagent-oar-agy-bundle/test/distribution.test.ts` 补充更新资格相关断言：`version` 为合法 semver、`engines.dsh` 覆盖 `>=0.2.2-rc.1 <0.3.0`、包名未写成 `npm:` 别名/URL/`link:`
- [ ] T018 [US2] 读取 `/tmp/vhome/profiles/deskclone/package.json` 与 `node_modules/@jiezhengj/subagent_oar_agy/package.json`，记录依赖值与解析版本，确认 `dependencySpec` 为注册表规格而非 URL
- [ ] T019 [US2] 在 T014 启动的隔离实例中打开插件管理「版本」区，确认显示当前版本 `$V` 与「已是最新版本」；记录界面文案与所在页面
- [ ] T020 [US2] 更新可用性验证：在隔离副本编辑 `/tmp/vhome/profiles/deskclone/node_modules/@jiezhengj/subagent_oar_agy/package.json` 的 `version` 为 `0.2.5`（不改依赖规格、不触发安装），重新读取版本区，期望出现「可更新到 0.2.6」；若界面受缓存影响，则记录 `updateRefusal()` 的 registry 分支证据与例外，并还原该文件
- [ ] T021 [US2] 不兼容过滤核对：读取 `dsh-client-ui-plugin-manager` 与 `dsh-plugin-manager` 中 `engines.dsh`/`versionsBlocked` 的过滤路径，记录一条单版本无实测的例外说明
- [ ] T022 [US2] 把 T018–T021 的证据（依赖值、版本区文案、更新判定、过滤例外）记录到 `specs/002-npm-distribution/validation.md` 的「US2 版本面板」小节（该文件在 T033 汇总，T022 先创建并追加）

**Checkpoint**: US1 与 US2 均可独立验证；版本区与依赖形态有结论

---

## Phase 5: User Story 3 - 一次发版，两处分发保持一致 (Priority: P3)

**Goal**: 同一版本同时出现在 npm 与 GitHub Release；tgz 备选可独立安装；重复发布被拒绝。

**Independent Test**: 本地 `npm pack` 与 Release 资产摘要/文件清单一致；旧 `v0.2.5` 保持原样；tgz 安装可用。

### Implementation for User Story 3

- [ ] T023 [US3] 在 `packages/subagent-oar-agy-bundle/` 执行真实 `npm pack`；把产物 `jiezhengj-subagent_oar_agy-$V.tgz` 改名为 `/tmp/subagent_oar_agy-$V.tgz`（只改名），计算 SHA-256；生成 `/tmp/release-notes.md`（安装填名称、tgz 备选地址、版本 `$V`）并确认非空
- [ ] T024 [US3] 创建并推送 tag：`git tag v$V`、`git push origin v$V`；确认 `git ls-remote --tags origin "refs/tags/v$V"` 命中
- [ ] T025 [US3] 生成 Release 说明并创建 GitHub Release：`gh release create v$V /tmp/subagent_oar_agy-$V.tgz --notes-file /tmp/release-notes.md`；核对 `gh release view v$V --json assets` 含 `subagent_oar_agy-$V.tgz`；记录 Release 创建完成时间，结合 T012 的 publish 时间确认两渠道在 5 分钟内均可用
- [ ] T026 [US3] 双渠道 parity：`gh release download v$V -p subagent_oar_agy-$V.tgz -D /tmp/rel` 下载 Release 资产；比对 `/tmp/rel/subagent_oar_agy-$V.tgz` 与 `/tmp/subagent_oar_agy-$V.tgz` 的 SHA-256；用 `npm view @jiezhengj/subagent_oar_agy@$V dist.shasum dist.integrity dist.tarball` 核对 `dist.shasum` 与本地 SHA-1 一致；`npm pack @jiezhengj/subagent_oar_agy@$V --dry-run --json` 的文件清单与本地一致
- [ ] T027 [US3] 旧版本与 tgz 备选（命令带 `HOME=/tmp/vhome DSH_HOME=/tmp/vhome`）：确认 `v0.2.5` 的 tag/Release 资产未变；用 Release 的 `subagent_oar_agy-$V.tgz` 在隔离 profile 安装一次，确认依赖保存为 URL、插件可用、版本区标为不可更新
- [ ] T028 [US3] 迁移验证（命令带 `HOME=/tmp/vhome DSH_HOME=/tmp/vhome`）：在已用 tgz 安装的隔离 profile 中先移除旧条目，再按名称安装 `$V`，确认没有重复依赖且工具可用
- [ ] T029 [US3] 不可覆盖演练：再次执行 `npm publish --access public` 尝试同版本发布，确认注册表拒绝（409）；若当次无法提供 OTP，则记录「注册表不可同版本覆盖」的代码/文档证据与例外
- [ ] T030 [US3] 发布后文档核对：grep 11 份安装文档确认名称、`$V`、tgz 备选一致；检查 Release 说明与 README 版本一致

**Checkpoint**: npm 与 Release 同版本同内容，tgz 备选与迁移可用，重复发布被拒绝

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全量回归、凭据扫描与验证记录

- [ ] T031 [P] 全量回归：`pnpm test`、`node packages/subagent-oar-agy-bundle/scripts/verify-package.mjs`、`pnpm --dir packages/subagent-oar-agy-bundle run build` 全部通过；按 `quickstart.md` 第 1–10 步抽查
- [ ] T032 [P] 凭据扫描：扫描仓库文件、提交历史、文档与脚本中的 npm token、`npmrc` 内容与 OTP，命中数必须为 0；用 `find . -name '*.tgz' -not -path '*/node_modules/*'` 与 `git status --ignored --porcelain` 确认没有 tarball/临时文件残留（T011 已清理历史残留）
- [ ] T033 [P] 汇总并完善 `specs/002-npm-distribution/validation.md`（T022 已创建）：记录发布前置、包清单、注册表版本、隔离安装 3 次、版本面板证据、parity 摘要、失败语义与例外
- [ ] T034 更新 `specs/002-npm-distribution/spec.md` 状态为 Completed（`v0.2.6`），勾选 T001–T033，在**当前分支 `main`** 提交并推送（本项目既有 feature 亦在 main 推进，不新建分支）；确认工作区只剩无关缓存文件


## 验证备注

后续任务在此记录证据，T033 汇总进 `validation.md`：

### US2 版本面板

（T018–T021 执行后填写依赖值、版本区文案、更新判定、过滤例外）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup；阻塞所有用户故事
- **US1 (Phase 3)**: 依赖 Foundational；MVP
- **US2 (Phase 4)**: 依赖 Foundational，并需要 T012 的注册表条目；可与 US1 的文档任务部分并行
- **US3 (Phase 5)**: 依赖 T010（版本 0.2.6）、T011（提交）与 T012（npm 发布成功）
- **Polish (Phase 6)**: 依赖所有用户故事完成

### User Story Dependencies

- **US1**: 可在 Foundational 后独立完成；发布与安装验证是 MVP
- **US2**: 依赖 US1 的发布结果（注册表条目）；验证版本面板与依赖形态
- **US3**: 依赖 US1 的版本与发布；完成双渠道、迁移与不可覆盖验证

### Within Each User Story

- T002–T005 可并行；T006 依赖 T002、T003、T004
- T007 与 T008 可并行；T009 依赖二者
- T010 依赖 T003；T011 依赖 T006、T009、T010
- T012 依赖 T011；T013–T016 依赖 T012，彼此可顺序执行
- US2 的 T018 依赖 T013；T019 依赖 T014 与 T018；T020–T021 依赖 T018
- US3 的 T023 依赖 T012；T024–T026 依次执行；T027–T030 在 T025 之后
- Polish 的 T031–T033 可并行；T034 依赖全部

### Parallel Opportunities

- T002、T004、T005 不同文件可并行
- T007、T008 文档两组不同文件可并行
- T031、T032、T033 可在发布完成后并行（T033 创建独立文件）
- 不将同一文件的编辑任务标为 [P]（例如 T017 与 T005 都改 `test/distribution.test.ts`，按顺序执行）

---

## Parallel Example: User Story 1

```bash
# 文档主路径两组可并行：
Task: "更新根 README 与 8 语言 README 的安装入口"
Task: "更新组合包 README 与 docs/INSTALL.md"

# 发布准备文件可并行：
Task: "新增包内 LICENSE"
Task: "新增 verify-package.mjs"
Task: "新增 distribution.test.ts"
```

---

## Implementation Strategy

### MVP First（US1）

1. 完成 Setup + Foundational（发布清单可校验）
2. 改 11 份文档 → 升版本 0.2.6 → 提交 → `npm publish` → 隔离按名称安装 3 次
3. **STOP and VALIDATE**：按名称能装、能启动、工具可用、失败路径明确

### Incremental Delivery

1. US1 → 名称安装可用（MVP）
2. US2 → 版本区、依赖形态与更新资格有证据
3. US3 → tag/Release、parity、tgz 备选、迁移与 409 演练
4. Polish → 全量回归、凭据扫描、validation 与状态收尾

### Notes

- 发布凭据只在发布者本机 `~/.npmrc`；本清单不涉及任何令牌文件，OTP 只在终端当场输入
- 发布会话固定使用版本 `V`（首发 0.2.6）；`v0.2.5` 的 tag/Release 不改
- 隔离验证一律使用 `HOME=/tmp/vhome DSH_HOME=/tmp/vhome`，不碰 `~/.dsh` 真实状态
- `provider/` 与 `dist/` 不入库，由 `prepublishOnly` 与构建链生成
- 包目录与仓库根不保留任何 `*.tgz`；Release 资产使用 `/tmp` 中的 tarball
- 若 npm 要求 OTP 而当时无法提供，发布任务保持未完成并在 validation 记录，不以 dry-run 代替真实发布
