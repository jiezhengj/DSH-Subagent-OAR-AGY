# 契约：npm 与 GitHub Release 同版本同内容

## 版本权威

- 唯一版本来源是 `packages/subagent-oar-agy-bundle/package.json` 的 `version`；文档、tag、Release 资产名都从它派生。
- 读取方式：`V=$(node -p "require('./packages/subagent-oar-agy-bundle/package.json').version")`。
- 本次首发 `V=0.2.6`；`v0.2.5` 的 tag 与 Release 保持原样，不覆盖、不移动。

## 发布顺序

1. 升版本号并提交实现、文档、校验脚本。
2. 在包目录执行 `prepublishOnly` 链（构建 → 校验）与 `npm pack`，得到本地 tarball。
3. `npm publish --access public`（OTP 当场输入），确认注册表出现该版本。
4. `git tag v$V` 并推送 tag。
5. 用同一份 tarball 生成 Release 资产：改名为 `subagent_oar_agy-$V.tgz`，`gh release create v$V <asset>`。
6. 发布后核对；任一渠道失败都不改已发布版本，只能补发缺失渠道或升版本重来。

## 同内容判定

- `npm pack` 的本地 tarball 与上传到 GitHub Release 的资产必须是同一个文件（只改名，不改内容）。
- 记录并比对：
  - 文件数；
  - SHA-256（Release 资产与本地 tarball 相同）；
  - 注册表 `dist.integrity` 与本地 tarball 的内容一致；
  - 包内 `package.json` 的 `version` 等于 `V`。
- `npm pack` 的文件清单与 `npm publish` 实际发布的清单一致（同一 `files` 白名单与 `prepublishOnly` 产物）。

## 不可覆盖

- 同版本再次 `npm publish` 必须被注册表拒绝（409）；不得用 `--force` 绕过。
- 已发布 Release 的资产不得用 `gh release upload --clobber` 修改；缺资产时只能为新版本发布。
- 已发布版本只能通过新版本或 `npm deprecate` 处理；不使用 `npm unpublish` 作为回滚。

## 发布后核对清单

| 项 | 命令/证据 | 通过条件 |
|---|---|---|
| 注册表版本 | `npm view @jiezhengj/subagent_oar_agy@$V version` | 输出 `$V` |
| 注册表 tarball | `npm view @jiezhengj/subagent_oar_agy@$V dist.tarball dist.integrity dist.shasum` | 有 URL、integrity 与 SHA-1 |
| Release 版本 | `gh release view v$V --json tagName,assets` | tag `v$V`，资产 `subagent_oar_agy-$V.tgz` |
| 字节一致 | `gh release download v$V -p subagent_oar_agy-$V.tgz -D /tmp/rel`，再 `shasum -a 256` 本地与 Release 资产 | 两个 SHA-256 相同；本地 SHA-1 等于 `dist.shasum` |
| 文件清单 | `npm pack --dry-run --json` 本地 vs 注册表 tarball | 文件集合一致 |
| 文档一致 | grep 11 份安装文档 | 名称正确、版本 `$V`、无旧版本主路径 |
| 凭据扫描 | 扫描仓库与文档中的 token/OTP/`npmrc` 内容 | 命中数 0 |
