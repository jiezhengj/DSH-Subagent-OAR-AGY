# 功能规格：npm 短名称安装（注册表分发）

**Feature Branch**: `002-npm-distribution`

**Created**: 2026-11-08

**Status**: Completed

**Input**: User description: "发布到 npm，让 DSH 安装框只填 @jiezhengj/subagent-oar-agy 短名称即可安装，并显示版本与更新；同时保留 GitHub Release tarball 备选，保证 npm 与 Release 同版本同内容。"

## 背景

Feature 001 的组合包已经能通过 GitHub Release tarball 安装，但安装框里要粘贴 90+ 字符的地址，且安装来源被标为「不可更新」，版本区拿不到当前版本与更新信息。本 feature 把组合包发布到公共 npm 注册表，让安装主路径变成「填一个短名称」，同时保留 tarball 作为受限网络的备选渠道；不改变插件的运行时行为与安全模型。

## 用户场景与测试 *(mandatory)*

### User Story 1 - 用一个短名称装好插件 (Priority: P1)

使用者打开 DSH 插件管理页，在安装框输入 `@jiezhengj/subagent-oar-agy`（而不是一长串下载地址），确认后插件被装上；重启 DSH 后，`subagent_oar_agy` 工具与「AGY 子智能体」插件页出现，全程不用开终端。

**Why this priority**: 这是本 feature 的核心价值。现有 tgz 地址 101 字符，需要从 README 复制、容易贴错，且安装后没有版本信息；短名称把「找到并复制地址」这一步去掉。

**Independent Test**: 在隔离 DSH 家里只用名称完成安装并启动，检查启动日志没有未激活告警，模型工具列表出现 `subagent_oar_agy`。

**Acceptance Scenarios**:

1. **Given** 插件管理页的安装框，**When** 输入 `@jiezhengj/subagent-oar-agy` 并确认，**Then** 安装成功，管理器显示已安装版本号
2. **Given** 已按名称安装，**When** 重启 DSH，**Then** `subagent_oar_agy` 工具可用、插件页显示「AGY 子智能体」，启动日志无未激活告警
3. **Given** 注册表不可达（企业网络/代理），**When** 安装，**Then** 安装框给出宿主的网络连接失败提示（文案随界面语言），而不是静默失败或装上空包；版本区给出同类网络失败提示

---

### User Story 2 - 安装后能看版本、能点更新 (Priority: P2)

以名称安装后，插件管理的版本区显示当前版本、是否已是最新；有兼容的新版本时出现「可更新到 x.y.z」，点一下即可升级，不需要再翻 Release 页面。

**Why this priority**: 短名称的第二个真实收益：安装来源变成注册表包，DSH 才能列出可用版本并按 `engines.dsh` 过滤兼容性；tgz/链接安装一律被标为不可更新。没有这条，用户每次升级仍要手工换 URL。

**Independent Test**: 在隔离环境按名称安装后，确认 profile 依赖形态是精确版本（不是 URL/link），并确认版本区显示当前版本与「已是最新版本」；用隔离副本把本地版本标记为 0.2.5，确认出现「可更新到 $V」。

**Acceptance Scenarios**:

1. **Given** 按名称安装的插件，**When** 打开插件管理版本区，**Then** 显示当前版本并提示「已是最新版本」
2. **Given** 注册表上存在更新的兼容版本，**When** 检查更新，**Then** 出现「可更新到 x.y.z」并可一键安装
3. **Given** 新版本要求更高的 DSH 版本，**When** 检查更新，**Then** 该版本被标为不可安装并提示需更新 DSH

---

### User Story 3 - 一次发版，两处分发保持一致 (Priority: P3)

发布者升版本号后执行一次发布流程，npm 上的包与 GitHub Release 的 tgz 同时出现同一版本，README 里写的名称与版本对得上；重复发布同一版本会被拒绝，不会出现「文档写一个版本、实际装到另一个」。

**Why this priority**: 分发渠道变多后最容易出现漂移——npm 有新版本、Release 没有，或文档还指向旧地址。这条保证两条渠道同源，同时保留 tgz 作为没有 npm 访问能力时的备选。

**Independent Test**: 用 `npm pack --dry-run` 与发布前的校验脚本输出产物清单，比对 npm 包内容与 Release 资产内容清单一致；检查文档中的名称/版本与实际发布一致；在隔离环境分别用名称与 tgz 安装，确认都能独立完成。

**Acceptance Scenarios**:

1. **Given** 版本号已提升，**When** 执行发布流程，**Then** npm 与 GitHub Release 都能取到同一版本
2. **Given** 某版本已发布，**When** 再次发布同版本，**Then** 被注册表拒绝，仓库侧改为提升版本或补发缺失渠道
3. **Given** 发布过程结束，**When** 检查仓库、脚本输出与提交历史，**Then** 没有任何发布凭据出现

---

### 边界情况

- 分发名称已被他人占用：作用域 `@jiezhengj` 由发布者持有，沿用现有包名 `@jiezhengj/subagent-oar-agy`，零重命名；若作用域权限丢失则暂停发布
- 用户网络无法访问公共注册表：安装必须给明确错误提示（具体宿主键见安装入口契约），并保留 tgz 地址作为备选
- 发布只完成一半（npm 成功、Release 失败，或反之）：文档与读者会看到版本不一致，需要可重复的补齐流程且不覆盖已发布版本
- 已有同版本 Release（`v0.2.5` 已于 2026-11-08 发布且资产可下载）：本次必须在**新版本**上首次发布 npm 包，`v0.2.5` 的 tag 与 Release 保持原样，不通过覆盖资产来「对齐」
- 新版本与当前 DSH 不兼容：检查更新必须标出不可安装，而不是让人装完崩溃
- 已安装同名同版本时再次输入名称：不应重复安装或产生第二份依赖
- 从旧的 tgz 安装升级到名称安装：需要先移除旧条目，再按名称安装；文档必须说明
- npm 要求 OTP：由发布者当场提供，不把令牌写入仓库或日志
- 发布前工作区未构建：`provider/`、`tool.js` 等产物缺失会发出空壳包，必须有自动校验阻断
- 包内包含 `provider/`、`tool.js`、`cordis.patch.yml` 与 8 语言资源，但不得包含源码、测试、tarball 或临时文件

## 需求 *(mandatory)*

### 功能需求

- **FR-001**: 组合包 MUST 以一个公开的分发名称发布到公共注册表，使 DSH 安装框只填该名称即可完成安装，无需下载地址
- **FR-002**: 分发名称 MUST 为 `@jiezhengj/subagent-oar-agy`（2026-11-09 决定）：由原下划线形式改为连字符形式；该名称在 npm 上尚未被占用，作用域由发布者持有。名称长度为 27 个字符，是短名称路径可接受的上限内
- **FR-003**: 发布内容 MUST 包含运行所需的全部产物：构建后的 `provider/`、工具包装 `tool.js`、`cordis.patch.yml`、8 语言 `locale/` 与 `docs/DETAIL.*.md`、`icon.svg`、`README.md`、`LICENSE`；安装后不需要二次构建，也不依赖 workspace 路径
- **FR-004**: 包 MUST 声明与 DSH 的兼容范围（`engines.dsh`）以及 DSH 组合包元数据（`dsh.bundle.patch`），使检查更新时能按当前 DSH 版本拒绝不兼容版本
- **FR-005**: 发布产物 MUST 与 GitHub Release 的 tgz 同源同版本；两者内容清单一致，且任一渠道都能单独完成安装。已发布过的版本 MUST NOT 通过覆盖 Release 资产来对齐内容（首发使用新版本号，见决策记录）
- **FR-006**: 面向使用者的文档 MUST 改为「填名称」主路径（根 README 索引、8 语言 README、组合包 README、安装文档、Release 说明），并保留 tgz 作为备选路径；升级与从 tgz 迁移的步骤 MUST 说明
- **FR-007**: 发布流程 MUST 在打包前自动准备并校验发布内容（构建 provider、同步产物、校验包内文件清单与元数据），任何一步失败即中止发布，避免发出缺少构建产物的空壳版本
- **FR-008**: 发布凭据 MUST NOT 出现在仓库文件、提交历史、文档、脚本输出或日志中；发布动作 MUST 由发布者本人授权
- **FR-009**: 同一版本号 MUST NOT 被二次发布覆盖；发布失败时 MUST 以提升版本或补发缺失渠道的方式修复
- **FR-010**: 安装后，插件管理 MUST 能显示当前版本、是否最新，并对兼容的新版本提供更新入口；安装来源为注册表规格时更新资格成立，tgz 来源标为不可更新
- **FR-011**: 发布动作 MUST 可重复执行且不泄露凭据；2026-11-08 决定采用**本机手动发布**：发布者在本机完成注册表认证后执行发布命令，OTP 当场输入，发布令牌 MUST NOT 写入仓库、脚本、文档或日志，也不引入发布流水线
- **FR-012**: 包 MUST 声明 `publishConfig.access = "public"`、`license`（MIT）、`repository`/`homepage`/`bugs` 与 `keywords`（含 `dsh-plugin`），使注册表页面与非匿名安装可用

### 需求验收映射

| 需求 | 验收路径 |
|---|---|
| FR-001、FR-002 | US1 场景 1/2；SC-001 |
| FR-003 | US3 Independent Test；发布包清单契约 |
| FR-004 | US2 场景 3；`engines.dsh` 过滤 |
| FR-005 | US3 场景 1/2；Release parity 契约 |
| FR-006 | US1 Independent Test、SC-001；11 份安装文档一致性检查 |
| FR-007 | US3 Independent Test；发布包清单契约的打包生命周期 |
| FR-008 | US3 场景 3；收尾的凭据扫描 |
| FR-009 | US3 场景 2；不可覆盖规则 |
| FR-010 | US2 场景 1/2 |
| FR-011 | US3 场景 3；决策记录中的本机手动发布 |
| FR-012 | US1 场景 1；发布包清单契约的元数据字段 |

### 关键实体

- **分发包**：一次发布的内容集合，包含分发名称、版本号、运行所需产物、兼容范围声明
- **发布渠道**：同一版本的两种落地形式——注册表条目与 GitHub Release 资产，二者版本与内容清单需一致
- **安装入口**：使用者看到的两种输入——短名称（主路径）与 tgz 地址（备选）

## 成功标准 *(mandatory)*

### 可度量结果

- **SC-001**: 新使用者从打开插件管理到插件可用，只需「输入名称 + 重启」两步，不再需要复制长地址
- **SC-002**: 安装框里要输入的名称长度为 27 个字符（现有 tgz 地址 101 字符，输入量减少约 73%）
- **SC-003**: 发版后 5 分钟内，注册表与 GitHub Release 都能取到同一版本，文档写的名称与版本与两者一致
- **SC-004**: 对按名称安装的用户，版本区 100% 能显示当前版本与「已是最新」（或「可更新到 x.y.z」）
- **SC-005**: 在仓库与文档中扫描发布凭据，命中数为 0
- **SC-006**: 在隔离环境中连续 3 次按名称安装并启动，插件入口 100% 可用，启动日志无未激活告警

## 假设

- 发布者持有公共注册表的账户与目标作用域（`@jiezhengj`，与 npm 用户名一致），并在发布前于本机完成认证；发布只用本机手动方式
- 公共注册表（或企业镜像）可从使用者网络访问；不可访问时走 tgz 备选路径
- 本 feature 不改变插件的运行时行为与安全模型，只改变分发方式与安装入口
- GitHub Release 的 tgz 资产继续保留，作为离线/受限网络的备选渠道
- 桌面应用 profile 的插件管理由应用本体负责，本 feature 不改变 CLI 与应用的职责边界
- 版本号继续遵守语义化版本；发布前必须完成现有测试与隔离环境安装验证
- 本次 npm 首发版本定为 `0.2.6`：`0.2.5` 已作为 GitHub Release 发布（资产已可下载），按「不覆盖已发布版本」必须在更高版本上发布
- 组合包已具备 `dsh.bundle.patch`、`engines.dsh`、`exports`、`files` 与 MIT `LICENSE`；本 feature 只补发布所需的 `publishConfig`、`keywords`、`prepublishOnly`/校验脚本与文档主路径
- Feature 001 曾把 npm 上架列为范围外；本 feature 在不改变运行时行为的前提下专门补齐注册表分发

## 决策记录

- **2026-11-08 分发名称**：最初采用下划线形式；**2026-11-09 更正**为 `@jiezhengj/subagent-oar-agy`（连字符形式），作用域由发布者持有，短名称长度为 27 个字符。
- **2026-11-08 发布方式**：本机手动发布，不引入发布流水线；发布令牌只留在发布者本机的注册表认证状态里，OTP 当场输入。
- **2026-11-08 首发版本 0.2.6**：`v0.2.5` 的 Release 与 tag 已存在且不可覆盖，本次 npm 首发取 `0.2.6`，同轮创建 `v0.2.6` Release 并附 `subagent_oar_agy-0.2.6.tgz`；`v0.2.5` 保持原样，作为历史版本继续可装。
- **2026-11-09 更新验证版本 0.2.7**：为在真实 DSH 中验证「发现更新 → 应用内升级」，发布与 `0.2.6` 内容等价的 `0.2.7`，并创建同版本 Release；首发记录仍为 `0.2.6`，交付与验证记录见 `validation.md`。
- **2026-11-09 包名更正与 0.2.8**：将分发名称由下划线形式改为 `@jiezhengj/subagent-oar-agy`；新名称首发 `0.2.8`，创建 `v0.2.8` Release，旧名的 0.2.6/0.2.7 产物保留。
- **2026-11-08 发布位置**：在 `packages/subagent-oar-agy-bundle/` 目录用系统 npm 执行 `npm publish --access public`；仓库保持 pnpm workspace，不新增 npm workspaces 配置，避免污染现有 pnpm 锁文件与 profile 安装流程。
- **2026-11-08 文档主路径**：根 README（英文索引）、8 语言 README、组合包 README、`docs/INSTALL.md` 的安装框改为填名称；tgz 地址保留为备选；`README.zh.md` 等语言全文不再以 tgz 为主路径。
