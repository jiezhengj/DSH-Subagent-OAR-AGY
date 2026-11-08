# 验证手册：npm 短名称安装

按顺序执行；所有命令都先在仓库根取版本变量，避免写死版本号。发布命令中的 OTP 由发布者当场输入，不写入任何文件。

```sh
cd /Users/jiezhengj/Documents/Project/subagent_oar_agy
V=$(node -p "require('./packages/subagent-oar-agy-bundle/package.json').version")   # 首发应为 0.2.6
echo "$V"
[ "$V" = "0.2.6" ] || { echo "版本不是 0.2.6：先执行 T010 升版本"; exit 1; }
```

## 0. 前置核对

```sh
node -v                 # 26.x
npm -v                  # 12.x
npm whoami              # jiezhengj（未登录则先 npm login）
npm view @jiezhengj/subagent_oar_agy version   # 首发前期望 E404
git ls-remote --tags origin | grep "v$V"       # 首发前期望为空
gh release view v0.2.5 --json tagName,assets    # 旧版本仍在，资产为 subagent_oar_agy-0.2.5.tgz
```

## 1. 构建与测试

```sh
pnpm install
pnpm test                # 现有 63 项 + 新增 distribution 用例全部通过
pnpm --dir packages/subagent-oar-agy-bundle run build
```

## 2. 发布清单校验

```sh
cd packages/subagent-oar-agy-bundle
node scripts/verify-package.mjs
npm pack --dry-run --json > /tmp/pack-plan.json
node -e "const p=Object.values(require('/tmp/pack-plan.json'))[0]; console.log(p.name,p.version,p.entryCount,p.unpackedSize,p.size); console.log(p.files.some(f=>f.path==='LICENSE'))"
```

**期望**：校验脚本逐项通过并退出 0；包名 `@jiezhengj/subagent_oar_agy`、版本 `$V`；`npm pack --json` 的对象以包名为键（不是数组），文件路径**不带** `package/` 前缀；清单含 `LICENSE`、`tool.js`、`provider/index.js`、`cordis.patch.yml`、8 语言 `locale/*.json` 与 `docs/DETAIL.*.md`；`entryCount === 71`、`unpackedSize ≤ 150000`、`size ≤ 51200`。若要看 `package/` 前缀，用真实 `npm pack` 后 `tar -tzf`，并把 tarball 移到 `/tmp`。

## 3. 发布到 npm（需要 OTP）

```sh
npm publish --access public
```

**期望**：`publishConfig.access = public` 生效，注册表出现 `$V`。若提示 OTP，当场输入 6 位码。记录时间：`date -u +%FT%TZ`。为满足 SC-003，发布成功后**先执行第 7 步**创建 tag/Release，再回到第 4 步做长时间安装验证。

**幂等说明**：若 `$V` 已发布成功，本步会返回 409（版本不可覆盖），此时跳过发布，只做核对：

```sh
npm view @jiezhengj/subagent_oar_agy@$V version dist.tarball dist.integrity engines --json
```

**期望**：版本等于 `$V`，`dist.tarball` 指向 `https://registry.npmjs.org/...`，`engines.dsh` 覆盖 `>=0.2.2-rc.1 <0.3.0`。

## 4. 按名称安装（隔离环境）

```sh
if [ -f /tmp/vhome.pid ]; then kill "$(cat /tmp/vhome.pid)" 2>/dev/null || true; fi
rm -f /tmp/vhome.pid
rm -rf /tmp/vhome && mkdir -p /tmp/vhome/profiles
cp -a ~/.dsh/profiles/desktop /tmp/vhome/profiles/deskclone
BIN="/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js"
APP="/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness"
HOME=/tmp/vhome DSH_HOME=/tmp/vhome ELECTRON_RUN_AS_NODE=1 "$APP" "$BIN" \
  plugin --profile deskclone remove @jiezhengj/subagent_oar_agy || true
HOME=/tmp/vhome DSH_HOME=/tmp/vhome ELECTRON_RUN_AS_NODE=1 "$APP" "$BIN" \
  plugin --profile deskclone add @jiezhengj/subagent_oar_agy --save-exact
node -e "const d=require('/tmp/vhome/profiles/deskclone/package.json').dependencies;console.log(d['@jiezhengj/subagent_oar_agy'])"
```

**期望**：依赖值为 `@jiezhengj/subagent_oar_agy: $V`（不是 URL、不是 `link:`、不是 `npm:` 别名）；`node_modules/@jiezhengj/subagent_oar_agy/package.json` 的版本同为 `$V`。

## 5. 启动与工具可见性（3 轮连续验证）

以下循环完整执行 3 轮；每轮必须先停止上一轮实例、重建隔离环境，再安装与启动。启动后先断言日志出现访问地址，再检查未激活告警，避免启动失败被误判为通过。

```sh
(
SC006_FAIL=0
for i in 1 2 3; do
  if [ -f /tmp/vhome.pid ]; then kill "$(cat /tmp/vhome.pid)" 2>/dev/null || true; fi
  rm -f /tmp/vhome.pid
  sleep 2
  rm -rf /tmp/vhome && mkdir -p /tmp/vhome/profiles
  cp -a ~/.dsh/profiles/desktop /tmp/vhome/profiles/deskclone
  HOME=/tmp/vhome DSH_HOME=/tmp/vhome ELECTRON_RUN_AS_NODE=1 "$APP" "$BIN" \
    plugin --profile deskclone remove @jiezhengj/subagent_oar_agy >/dev/null 2>&1 || true
  HOME=/tmp/vhome DSH_HOME=/tmp/vhome ELECTRON_RUN_AS_NODE=1 "$APP" "$BIN" \
    plugin --profile deskclone add @jiezhengj/subagent_oar_agy --save-exact
  (HOME=/tmp/vhome DSH_HOME=/tmp/vhome ELECTRON_RUN_AS_NODE=1 "$APP" "$BIN" \
    --profile deskclone --no-open --port 18131 > /tmp/vhome-boot.log 2>&1 & echo $! > /tmp/vhome.pid)
  sleep 15
  if ! grep -qF 'http://127.0.0.1:18131/?token=' /tmp/vhome-boot.log; then
    echo "round $i: 启动失败"; cat /tmp/vhome-boot.log; exit 1
  fi
  if grep -qi "did not activate" /tmp/vhome-boot.log; then
    echo "round $i: FAIL"; grep -i "did not activate" /tmp/vhome-boot.log; SC006_FAIL=1
  else
    echo "round $i: OK"
  fi
done
if [ "$SC006_FAIL" -ne 0 ]; then echo "SC-006 FAIL"; exit 1; fi
echo "SC-006 PASS"
)
SC006_RC=$?
if [ "$SC006_RC" -ne 0 ]; then echo "SC-006 FAIL (exit $SC006_RC)"; fi
```

打开日志中的 `http://127.0.0.1:18131/?token=...`，确认插件页显示「AGY 子智能体」、工具列表出现 `subagent_oar_agy`；在会话里调用一次（`runtime=agy`）确认返回结果。三轮都输出 `OK` 才算通过。

## 6. 更新面板与依赖形态

- 读取 `/tmp/vhome/profiles/deskclone/package.json`，确认依赖是注册表规格（名称 + 版本/范围），而不是 URL。
- 先回插件列表页点「刷新」或整页重载（触发 `checkAllVersions`），再打开「版本」区，确认显示当前版本与「已是最新版本」；记录上次检查时间。按 tasks.md 顺序先跑 T016 时这里会留下 refused 缓存，不刷新会读到「无法连接安装源」；线性执行到本步通常尚无缓存，刷新仍建议保留。
- 模拟「有更新」：npm 首发只有 0.2.6，不存在更旧的已发布版本，因此**不要改依赖值**；改为编辑隔离副本已装包的版本号：

```sh
node -e "const p='/tmp/vhome/profiles/deskclone/node_modules/@jiezhengj/subagent_oar_agy/package.json';const d=require(p);d.version='0.2.5';require('fs').writeFileSync(p,JSON.stringify(d,null,2)+'\n')"
grep '"version"' /tmp/vhome/profiles/deskclone/node_modules/@jiezhengj/subagent_oar_agy/package.json
```

回列表页刷新后重开「版本」区，期望出现「可更新到 0.2.6」；如有更新入口可点一次，确认版本回到 `$V`、依赖仍是注册表规格。若界面缓存导致未刷新，记录 `updateRefusal()` 的 registry 分支证据与例外。还原只把已装包的 `version` 改回 `$V`，不要 `cp -a` 复制 profile（deskclone 已存在会嵌套 `deskclone/desktop`；先删再拷会把依赖退回桌面 profile 的 tgz URL）。不兼容版本依据 `engines.dsh` 过滤（记录为代码核对，不修改真实桌面）。
- tgz 来源的不可更新性在第 7 步生成资产、T027 安装后验证；本步不要求存在 tgz 副本。

## 7. Release 同版本（新版本，不动旧版本）

```sh
cd /Users/jiezhengj/Documents/Project/subagent_oar_agy
V=$(node -p "require('./packages/subagent-oar-agy-bundle/package.json').version")
cat > /tmp/release-notes.md <<EOF
安装：在 DSH「插件管理」的安装框里填 @jiezhengj/subagent_oar_agy
备选：https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v$V/subagent_oar_agy-$V.tgz
版本：$V（与 npm 同版本）
EOF
test -s /tmp/release-notes.md

cd packages/subagent-oar-agy-bundle
npm pack                                  # 产物落在包目录
mv jiezhengj-subagent_oar_agy-$V.tgz /tmp/subagent_oar_agy-$V.tgz
cd ../..
git rev-parse -q --verify "refs/tags/v$V" >/dev/null || git tag v$V
git push origin "v$V" 2>/dev/null || true
test -n "$(git ls-remote --tags origin "refs/tags/v$V")" || { echo "tag push failed"; exit 1; }
gh release view v$V >/dev/null 2>&1 || gh release create v$V /tmp/subagent_oar_agy-$V.tgz --notes-file /tmp/release-notes.md
gh release view v$V --json assets --jq '[.assets[].name]'
gh release view v0.2.5 --json assets --jq '[.assets[].name]'   # 旧版本保持原样
```

**幂等说明**：若 `v$V` 的 tag/Release 已存在，不重复创建；只核对，缺资产时仅补 `v$V`，绝不对旧版本 `--clobber`。包目录不保留 tarball。

## 8. 双渠道一致性

```sh
cd /Users/jiezhengj/Documents/Project/subagent_oar_agy
V=$(node -p "require('./packages/subagent-oar-agy-bundle/package.json').version")
rm -rf /tmp/rel && mkdir -p /tmp/rel
gh release download "v$V" -p "subagent_oar_agy-$V.tgz" -D /tmp/rel
shasum -a 256 /tmp/rel/subagent_oar_agy-$V.tgz /tmp/subagent_oar_agy-$V.tgz
shasum -a 1 /tmp/subagent_oar_agy-$V.tgz
npm view @jiezhengj/subagent_oar_agy@$V dist.shasum dist.integrity dist.tarball
npm pack @jiezhengj/subagent_oar_agy@$V --dry-run --json > /tmp/registry-pack.json
node -e "const a=Object.values(require('/tmp/pack-plan.json'))[0].files.map(f=>f.path).sort(); const b=Object.values(require('/tmp/registry-pack.json'))[0].files.map(f=>f.path).sort(); console.log('files match', JSON.stringify(a)===JSON.stringify(b), a.length); if (JSON.stringify(a)!==JSON.stringify(b)) process.exit(1)"
```

**期望**：Release 资产与 `/tmp` 本地 tarball 的 SHA-256 相同；`dist.shasum`（SHA-1）与本地 `shasum -a 1` 相同；注册表文件清单与本地 `npm pack` 一致；文档中的名称与版本为 `@jiezhengj/subagent_oar_agy` 与 `$V`。

## 9. 失败语义与文档一致性

```sh
npm view --registry=http://127.0.0.1:9 --fetch-retries=0 @jiezhengj/subagent_oar_agy version >/dev/null 2>&1; echo "exit=$?（期望非 0）"
grep -rl "@jiezhengj/subagent_oar_agy" README.md README.*.md packages/subagent-oar-agy-bundle/README.md packages/subagent-oar-agy-bundle/docs/INSTALL.md | wc -l   # 期望 11
grep -rl "subagent_oar_agy-$V.tgz" README.md README.*.md packages/subagent-oar-agy-bundle/README.md packages/subagent-oar-agy-bundle/docs/INSTALL.md | wc -l   # 期望 11
grep -rn "本包未上架 npm" README*.md packages/subagent-oar-agy-bundle/README.md packages/subagent-oar-agy-bundle/docs/INSTALL.md   # 期望无输出
```

隔离安装失败语义（真实 CLI 路径，避免只读码）：

```sh
printf 'registry=http://127.0.0.1:9\nfetch-retries=0\n' > /tmp/vhome/profiles/deskclone/.npmrc
HOME=/tmp/vhome DSH_HOME=/tmp/vhome ELECTRON_RUN_AS_NODE=1 "$APP" "$BIN" \
  plugin --profile deskclone add @jiezhengj/subagent_oar_agy > /tmp/install-fail.log 2>&1; echo "exit=$?（期望非 0）"
grep -iE "registry|network|ECONN|unable" /tmp/install-fail.log | head -5
node -e "const d=require('/tmp/vhome/profiles/deskclone/package.json').dependencies; console.log(d['@jiezhengj/subagent_oar_agy'])"
```

在 `.npmrc` 仍生效期间：先打开插件管理「版本」区；若先显示缓存的「已是最新」，点「重新检查」（若按钮不渲染，回列表页刷新）后再断言网络失败提示（宿主键 `versionsFailedNetwork`）。安装框探测保持默认安装源（OFFICIAL_REGISTRY），若安装源被记忆为镜像/自定义源，记录例外。再在安装框输入**未安装的探测名** `@jiezhengj/dsh-probe-uninstalled` 并确认，观察 `installProblemNetwork`。输入已安装的原名会在本地短路为 `installProblemInstalled`（作为边界记录，不能用来证明网络失败）。清理 `.npmrc` 后，在注册表可达时输入一个不存在的名称，观察 `installProblemNotFound`。

```sh
rm -f /tmp/vhome/profiles/deskclone/.npmrc
HOME=/tmp/vhome DSH_HOME=/tmp/vhome ELECTRON_RUN_AS_NODE=1 "$APP" "$BIN" \
  plugin --profile deskclone add @jiezhengj/subagent_oar_agy --save-exact
node -e "const d=require('/tmp/vhome/profiles/deskclone/package.json').dependencies; console.log(d['@jiezhengj/subagent_oar_agy'])"
```

**期望**：安装失败、错误指向注册表/网络；依赖值保持原样（不是「不存在」，因为插件仍安装）、无半装状态；版本区显示网络失败而非错误地显示最新；探测名显示网络失败，原名显示已安装；删掉坏 `.npmrc` 后再次 add 不产生第二份依赖。

宿主错误键（用于安装框/版本区）：`installProblemNetwork`、`installProblemNetworkAll`、`installProblemNotFound`、`installProblemInstalled`、`versionsFailedNetwork`、`versionsBlocked`、`versionsBlockedDetail`。

## 10. 收尾

```sh
kill "$(cat /tmp/vhome.pid)" 2>/dev/null || true
rm -f /tmp/vhome.pid
rm -rf /tmp/vhome
git status        # 只应有本次发布/文档相关改动
```

凭据扫描：检查仓库、文档与提交历史中没有 npm token、`npmrc` 内容或 OTP；OTP 只存在于发布终端会话。

## 附录：tgz 安装、迁移与 409 演练（T027–T029）

```sh
# 先移除按名称安装的条目，再安装 Release tgz
HOME=/tmp/vhome DSH_HOME=/tmp/vhome ELECTRON_RUN_AS_NODE=1 "$APP" "$BIN" \
  plugin --profile deskclone remove @jiezhengj/subagent_oar_agy || true
HOME=/tmp/vhome DSH_HOME=/tmp/vhome ELECTRON_RUN_AS_NODE=1 "$APP" "$BIN" \
  plugin --profile deskclone add "https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v$V/subagent_oar_agy-$V.tgz" --save-exact
node -e "const d=require('/tmp/vhome/profiles/deskclone/package.json').dependencies; console.log(d['@jiezhengj/subagent_oar_agy'])"   # 期望 URL

# 迁移：移除 tgz 条目，再按名称安装
HOME=/tmp/vhome DSH_HOME=/tmp/vhome ELECTRON_RUN_AS_NODE=1 "$APP" "$BIN" \
  plugin --profile deskclone remove @jiezhengj/subagent_oar_agy
HOME=/tmp/vhome DSH_HOME=/tmp/vhome ELECTRON_RUN_AS_NODE=1 "$APP" "$BIN" \
  plugin --profile deskclone add @jiezhengj/subagent_oar_agy --save-exact

# 409 演练（需要可用的 OTP；不可用则记录例外与注册表不可覆盖证据）
cd packages/subagent-oar-agy-bundle && npm publish --access public
```
