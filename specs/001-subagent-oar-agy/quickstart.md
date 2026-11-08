# 快速验证指南：subagent_oar_agy

本指南用于实现完成后逐项验证 spec 的验收场景与成功标准；不包含实现代码。

## 前置条件

- DSH 桌面 0.2.2-rc.1（或组合包 `engines.dsh` 允许的版本）
- 本机已安装并登录 AGY（`agy --version` 可执行；交互登录过一次）
- 能访问 GitHub Release（安装框直接拉取 tarball）
- pnpm 可用（安装组合包时由 DSH 插件管理器调用）

## 场景 1：安装与首次委派（FR-001/002/003/005、SC-004）

1. 在 DSH 插件管理的安装框粘贴根 README 给出的 Release 地址（当前为 `https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.4/subagent_oar_agy-0.2.4.tgz`）并安装，重载 DSH；确认插件页显示名为「AGY 子智能体」，工具列表出现 `subagent_oar_agy`，`runtime` 只有 `agy`。
2. 在 `~/tmp/agy-demo`（存在且可写）打开会话，发起委派：`runtime=agy`，提示"在当前目录创建 hello.txt，内容为 ok，然后回答 done"。
3. **期望**：2 秒内收到"已启动"；任务结束后收到含 done 的完成通知；`hello.txt` 出现在该目录。
4. 不指定 `cwd` 再发起一次，确认 AGY 在父会话目录工作。

## 场景 2：三档权限（FR-012、spec 澄清 Q1；SC-006）

| 档位 | 配置 | 验证 |
|---|---|---|
| `yolo` | 默认 | 写文件/执行命令不需要确认即完成 |
| `plan` | `permissionMode: plan` | 同一任务只产出计划，不写入文件 |
| `strict` | `permissionMode: strict` | 需要审批的动作被软拒绝，结果中可见拒绝说明，进程正常结束 |

评审者按 SC-006 对照 README 的三问答案逐项核对（3/3）；不要求读者抽样。

## 场景 3：失败可读（FR-007/008/009/010；SC-003）

1. 把 `command` 指向不存在的路径 → 委派返回"AGY 未安装"类错误；父会话继续可用。
2. 清空 AGY 登录态（在可回滚的临时 HOME 下）→ 返回"需要先登录"类错误。
3. 设 `timeoutMs: 5000`，提示让 AGY 做长任务 → 5 秒后返回超时错误，进程树已清理（`ps` 无残留）。
4. 用假的 `agy` 脚本输出畸形 NDJSON → 返回协议错误，附退出码，父会话继续可用。
5. 四类错误互不相同、可操作（4/4）。

## 场景 4：并发与取消（FR-006/011；SC-005）

1. 同时发起两个互不依赖的委派（其中一次可指定相同 `cwd`）→ 各自返回对应结果，不串扰。
2. 发起一个长委派，然后中断父回合 → 该委派被取消，AGY 进程树消失，父会话可继续新任务。
3. 禁用组合包并重启 DSH → 工具消失、DSH 正常启动、无残留 AGY 进程；重新启用后恢复。

## 场景 5：官方工具 spike（实施第 1 步，硬门禁）

在隔离 profile（或临时 `DSH_HOME`）中：

1. 安装官方 `@deepseek-ai/dsh-experimental-tool-subagent-oar@0.2.2-rc.1`，确认可加载。
2. 用假 provider 行验证 `providers: {agy: agy}` 被接受、工具出现在列表。
3. 失败则执行 Option B 回退：自写同形工具，用户可见行为不变，并更新 plan/research。

## 场景 6：真实端到端冒烟（需用户授权）

连续 10 次委派至少 9 次成功（SC-001）；启动确认 < 2 秒（SC-002）；记录耗时、模型、权限档与失败原因。

## 场景 7：入口选择（SC-007）

在同时启用内置子代理工具的环境中，连续 10 次用明确指向 AGY 的任务描述发起委派；统计 `subagent_oar_agy` 被选中的比例，要求 ≥9/10，记录到 `validation.md`。

## 通过标准

- spec.md 的场景 1–4、7、8 全部满足；
- 成功标准 SC-001 至 SC-009 均有对应记录（真实冒烟、日志或测试输出；SC-006 由评审者核对，SC-007 为入口选择统计，SC-008/SC-009 由 `readPluginMeta` 断言与安装冒烟证明）；
- 无残留进程、无凭据写入、无 AGY 全局配置修改。

## 场景 8：本地化与显示名（FR-022、SC-008、SC-009）

1. 在 `settings.yaml` 设 `locale: {preference: ja}`（或切换系统语言），重载插件页：显示名应为「AGY サブエージェント」，介绍正文为日文。
2. 逐个抽查 de/en/es/fr/pt/ru/zh：`locale/<lang>.json` 的标题/描述非空，`docs/DETAIL.<lang>.md` 可打开。
3. 用 `strict` 档触发一次权限拒绝，确认运行时说明跟随界面语言（中文环境为「权限档 strict…」）。
4. 检查仓库根 `README.md`：8 个语言链接均可到达对应 `README.<lang>.md`，安装框地址一致。
