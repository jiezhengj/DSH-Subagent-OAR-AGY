# 数据模型：npm 短名称安装

本 feature 不新增运行时持久化数据；以下实体描述发布、安装与文档中需要保持一致的信息，以及校验时必须成立的不变量。

## 实体

### DistributionManifest（分发清单）

组合包 `package.json` 中决定「能否被注册表接受、安装后能否运行」的字段集合。

| 字段 | 含义 | 约束 |
|---|---|---|
| `name` | 分发名称 | 固定 `@jiezhengj/subagent_oar_agy`；27 字符；作用域属于发布者 |
| `version` | 本次发布版本 | 合法 semver；首发 `0.2.6`；不得与已发布版本重复 |
| `publishConfig.access` | 注册表访问级别 | 必须为 `public` |
| `license` | 许可证标识 | `MIT` |
| `keywords` | 注册表检索词 | 必须包含 `dsh-plugin` |
| `engines.dsh` | DSH 兼容范围 | `>=0.2.2-rc.1 <0.3.0` |
| `dsh.bundle.patch` | 组合包补丁入口 | `./cordis.patch.yml` |
| `exports` | 包内入口 | 至少含 `./tool`、`./agy-provider`、`./agy-provider/locale/*`、`./locale/*`、`./icon`、`./package.json` |
| `files` | 发布文件白名单 | 含 `cordis.patch.yml`、`icon.svg`、`README.md`、`docs`、`locale`、`provider`、`tool.js`、`LICENSE` |
| `dependencies` | 运行时依赖 | 全部为注册表版本；不得出现 `workspace:`、`file:`、`link:` |
| `repository` / `homepage` / `bugs` | 仓库指向 | 指向 `jiezhengj/DSH-Subagent-OAR-AGY` |

### PublishArtifact（发布产物）

一次 `npm pack` 生成的 tarball，是注册表与 Release 的共同源文件。

| 字段 | 含义 | 约束 |
|---|---|---|
| `filename` | 本地文件名 | `jiezhengj-subagent_oar_agy-<version>.tgz`（npm 自动命名） |
| `fileCount` | 包内文件数 | 当前约 71；只允许白名单内容 |
| `size` | tarball 字节数 | ≤50 kB（当前 45.9 kB） |
| `sha256` | 内容摘要 | Release 资产、注册表 tarball 与本地文件一致 |
| `fileList` | 包内路径列表 | 含 `package/LICENSE`、`package/provider/index.js`、`package/tool.js`、`package/cordis.patch.yml`、8 语言 `locale/*.json` 与 `docs/DETAIL.*.md` |

### ReleaseAsset（发布渠道资产）

GitHub Release 上的 tgz，作为备选安装渠道与 npm 的镜像。

| 字段 | 含义 | 约束 |
|---|---|---|
| `tag` | 版本标签 | `v<version>`；本次 `v0.2.6` |
| `assetName` | 资产名 | `subagent_oar_agy-<version>.tgz` |
| `sha256` | 资产摘要 | 与 `PublishArtifact.sha256` 相同 |
| `version` | 资产内版本 | 与 tag、文档、注册表一致 |

### RegistryEntry（注册表条目）

npm 上的不可变版本记录。

| 字段 | 含义 | 约束 |
|---|---|---|
| `name` | 包名 | 与 `DistributionManifest.name` 相同 |
| `version` | 已发布版本 | 发布后不可被同版本覆盖 |
| `tarballUrl` | 注册表 tarball 地址 | 与 `dist.integrity` 对应 |

### InstalledPlugin（已安装插件）

某个 DSH profile 中对组合包的依赖记录，决定版本面板能否显示更新。

| 字段 | 含义 | 约束 |
|---|---|---|
| `dependencySpec` | profile 依赖值 | 主路径安装后必须是注册表规格（名称 + semver range），不是 URL/link/alias |
| `resolvedVersion` | 实际解析版本 | 合法 semver，与已发布版本一致 |
| `sourceKind` | 安装来源 | 名称安装为 `registry`；tgz 安装为 `tarball` |
| `updatable` | 更新资格 | 仅 `registry` 且包名一致时为真；tgz 来源为假 |

### InstallEntryDoc（安装入口文档）

根 README、8 语言 README、组合包 README 与 INSTALL 中面向使用者的安装说明。

| 字段 | 含义 | 约束 |
|---|---|---|
| `path` | 文档路径 | 11 份文件全部覆盖 |
| `mainEntry` | 主路径 | 填 `@jiezhengj/subagent_oar_agy` |
| `fallbackUrl` | 备选地址 | 指向当前版本的 Release tgz，版本随 `version` 更新 |
| `migrationNote` | 迁移说明 | 从 tgz 升级需先移除旧条目，再按名称安装 |

## 关系

- 一个 `DistributionManifest` 对应一个 `PublishArtifact`；同一个 artifact 同时生成一个 `RegistryEntry` 与一个 `ReleaseAsset`。
- 一个 `InstallEntryDoc` 描述如何到达一个 `RegistryEntry`（主路径）或 `ReleaseAsset`（备选）。
- 一个 `InstalledPlugin` 由一种 `InstallEntryDoc` 主路径安装而来；它的 `sourceKind` 决定 `updatable`。

## 校验不变量

1. `DistributionManifest.name`、`RegistryEntry.name`、文件名中的包名三者一致。
2. `DistributionManifest.version`、`ReleaseAsset.version`、文档中的当前版本、`PublishArtifact` 内版本四者一致。
3. `PublishArtifact.sha256` 与 `ReleaseAsset.sha256` 相同；内容漂移必须能被发现。
4. 包内必需文件全部存在，且不含测试、源码、tarball、`.env` 或临时文件。
5. `dependencies` 不含 workspace/file/link 协议；消费者用 npm 安装 tarball 不依赖仓库目录。
6. 名称安装后的 `dependencySpec` 是注册表规格；tgz 安装后的 `dependencySpec` 是 URL，且 `updatable` 为假。
7. 任何已发布版本不被覆盖：同版本再次发布必须被拒绝，修复只能升版本或补发缺失渠道。
