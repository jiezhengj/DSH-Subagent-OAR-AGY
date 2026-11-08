# 规格质量清单：npm 短名称安装（注册表分发）

**Purpose**: 在进入 plan 前校验规格的完整性与质量
**Created**: 2026-11-08
**Feature**: [spec.md](../spec.md)

## 内容质量

- [ ] 不包含具体框架或代码结构；包元数据与文件清单以分发契约形式出现
- [ ] 聚焦用户价值与业务需求
- [ ] 非技术读者可理解
- [ ] 所有必填章节已完成

## 需求完整性

- [ ] 没有 [NEEDS CLARIFICATION] 标记
- [ ] 需求可测试且无歧义
- [ ] 成功标准可度量
- [ ] 成功标准不依赖具体技术实现
- [ ] 所有验收场景已定义
- [ ] 边界情况已识别
- [ ] 范围边界清晰
- [ ] 依赖与假设已列出

## Feature 就绪度

- [ ] 每条功能需求都有对应验收路径
- [ ] 用户场景覆盖主要流程
- [ ] 满足 Success Criteria 中的可度量结果
- [ ] 规格未泄漏实现细节

## 备注

- 勾选状态：待 mimo 评审 PASS 后再逐项勾选；当前保持未勾选。
- 2026-11-08 第 1 轮 mimo 评审：**FAIL**。P1 为 `npm pack --json` 形状/路径断言错误与 quickstart 命令不可执行；P2 为失败语义未真实执行、更新版本模拟方式错误、tarball 检查无效、隔离命令未内联环境变量；已修订 spec/plan/research/data-model/contracts/quickstart/tasks 后送第 2 轮。
- 「规格未泄漏实现细节」的例外边界：spec 不写宿主 i18n 键名（已移到安装入口契约）；`publishConfig`/`keywords` 等发布元数据属于分发契约，不是框架或代码结构。
- 「每条功能需求都有对应验收路径」：已在 spec 增加「需求验收映射」，FR-001–FR-012 逐条对应 US 场景/成功标准/契约。

- 2026-11-08 事实核对：`npm whoami` = `jiezhengj`；`@jiezhengj/subagent_oar_agy` 在 npm 上为 E404（名称可用、作用域由发布者持有）；当前仓库 tag `v0.2.5` 与 Release `v0.2.5` 已存在且不可覆盖；组合包当前版本 0.2.5，名称长度 27；现有 tgz 安装地址 101 字符；包内已有 `dsh.bundle.patch`、`engines.dsh`、`exports`、`files`、MIT `LICENSE`，缺 `publishConfig`、`keywords` 与 `prepublishOnly`。
- 2026-11-08 已决策：分发名称沿用 `@jiezhengj/subagent_oar_agy`（零重命名）；本机手动发布、OTP 当场输入；npm 首发版本 `0.2.6`，同轮补 `v0.2.6` Release；文档主路径改为填名称、保留 tgz 备选。
- 规格引用 DSH 宿主既有行为（注册表安装、版本区、网络失败语义），具体错误键名放在安装入口契约；不新增宿主侧要求。
