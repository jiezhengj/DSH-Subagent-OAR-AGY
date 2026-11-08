# 契约：安装入口

## 主路径：注册表名称

- 输入：`@jiezhengj/subagent_oar_agy`（不是只填 `subagent_oar_agy`：作用域名是既有包名，零重命名）
- 安装器行为：按注册表规格解析 → 通过 profile 的 pnpm 加入依赖 → profile 依赖保存为注册表规格（名称 + semver range），不是 URL/link/alias
- 安装后：需重启 DSH；启动日志不得出现未激活告警；`subagent_oar_agy` 工具可用，插件页显示「AGY 子智能体」
- 版本区：显示当前版本与「已是最新版本」；存在兼容新版本时显示「可更新到 x.y.z」，不兼容版本被拒绝并提示需更新 DSH
- 版本查询：`npm view @jiezhengj/subagent_oar_agy version` 返回已发布版本

## 备选路径：tgz 地址

- 输入：`https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v<version>/subagent_oar_agy-<version>.tgz`
- 安装器行为：tarball 规格 → profile 依赖保存为完整 URL
- 版本区：该来源被标为「不可更新」（只有注册表来源能列出新版本）；升级需先移除旧条目，再安装新 URL 或改用名称
- 适用：无法访问公共注册表的网络；离线转存

## 失败语义

| 情况 | 期望表现（宿主键名） | 验证归属 |
|---|---|---|
| 注册表不可达 | 安装框报连接失败（`installProblemNetwork` / `installProblemNetworkAll`），不写依赖、不产生半装状态；版本区用 `versionsFailedNetwork` | US1 场景 3 |
| 名称不存在 | `installProblemNotFound`（「未找到相关插件」） | US1 同批核对 |
| 已安装同名同版本 | `installProblemInstalled`；不重复添加依赖 | US1 边界 |
| 新版本与当前 DSH 不兼容 | 版本列表阶段按 `engines.dsh` 过滤，标为不可安装（`versionsBlocked` / `versionsBlockedDetail`） | US2 场景 3 |
| 存在更新的兼容版本 | 版本区显示「可更新到 x.y.z」 | US2 场景 2 |

## 文档一致性

根 `README.md`（英文索引）、8 个语言 README、组合包 `README.md`、`docs/INSTALL.md` 共 11 份文件：

- 安装框/代码块以名称为主路径
- 同时保留 tgz 地址（备选），版本用 `$V` 拼出，与组合包 `package.json` 一致
- 补充从 tgz 迁移到名称安装的步骤
- 不得出现旧版本号作为「当前版本」，不得再写「本包未上架 npm」
- 名称与版本在 11 份文件中一致；发版时同步更新
