# 契约：发布包清单（npm publish）

## 名称与访问

- `name` = `@jiezhengj/subagent-oar-agy`（作用域归属发布者账号；npm 校验器返回 `validForNewPackages: true`）
- `publishConfig.access` = `public`（作用域包默认 restricted，免费账号无法发布私有包）
- `version` = 每次发布递增的语义化版本；首发 `0.2.6`（`0.2.5` 已作为 Release 发布，不可覆盖）
- 包名中的下划线是合法的：DSH 安装规格正则允许 `[a-z0-9._~-]`，npm 校验器也接受

## 必填元数据

| 字段 | 值/要求 |
|---|---|
| `engines.dsh` | `>=0.2.2-rc.1 <0.3.0`（检查更新时用于拒绝不兼容版本） |
| `dsh.bundle.patch` | `./cordis.patch.yml` |
| `license` | `MIT`，且包内 `LICENSE` 与仓库根 `LICENSE` 逐字相同 |
| `keywords` | 至少包含 `dsh-plugin` |
| `exports` | `./agy-provider`、`./agy-provider/locale/*`、`./locale/*`、`./icon`、`./package.json`、`./tool` |
| `repository` / `homepage` / `bugs` | 指向 `jiezhengj/DSH-Subagent-OAR-AGY` |
| `dependencies` | 全部为注册表版本；不得出现 `workspace:`、`file:`、`link:`、`npm:` 别名 |

## 必需包内文件

| 路径 | 作用 |
|---|---|
| `package/package.json` | 分发清单 |
| `package/tool.js` | 工具包装插件（注册 `subagent_oar_agy`） |
| `package/cordis.patch.yml` | 组合包 patch（provider 行 + tool 行） |
| `package/icon.svg` | 插件图标（36×36 透明） |
| `package/README.md` | 注册表页面与包内说明 |
| `package/LICENSE` | MIT 许可证 |
| `package/provider/index.js` | 构建后的 provider 入口 |
| `package/provider/locale/*.json` | 8 语言 provider 文案 |
| `package/locale/*.json` | 8 语言界面文案 |
| `package/docs/DETAIL.*.md` | 8 语言实现说明 |
| `package/docs/INSTALL.md` | 安装与升级说明 |

## 禁止内容

- 测试与测试夹具、TypeScript 源码、`src/`、`tests/`、`node_modules/`
- 任何 `*.tgz`、`.env`、日志、临时文件、编辑器缓存
- 发布凭据（token、`npmrc` 内容、OTP）

## 打包与发布生命周期

1. `prepublishOnly` 在包目录执行：根 workspace 构建（provider 先于组合包构建）→ 复制 provider 产物 → `node scripts/verify-package.mjs`。
2. 校验脚本检查上述元数据、必需文件、禁止内容与 `LICENSE` 一致性；任一项失败即中止发布。
3. 发布命令在 `packages/subagent-oar-agy-bundle/` 执行：`npm publish --access public`；OTP 由发布者当场输入。
4. `scripts/verify-package.mjs` 不进入 `files`，不会出现在发布包内。

## 发布后核对

- `npm view @jiezhengj/subagent-oar-agy@<version> version dist.tarball dist.integrity` 返回该版本。
- `npm pack @jiezhengj/subagent-oar-agy@<version> --dry-run --json` 的文件清单与本地 `npm pack` 一致。
- 包内 `package.json` 的 `version` 与 tag、Release、文档一致。
