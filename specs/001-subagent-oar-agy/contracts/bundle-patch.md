# 契约：组合包与 patch

组合包 `@jiezhengj/subagent_oar_agy` 是唯一用户安装入口；提供方 `@jiezhengj/subagent_oar_agy-provider` 只作开发依赖，构建时把其 `dist` 复制为组合包内的 `provider/`，使 tarball 自包含、可直接从 GitHub Release 安装。

## package.json 关键字段

```jsonc
{
  "name": "@jiezhengj/subagent_oar_agy",
  "version": "0.2.3",
  "type": "module",
  "description": "Delegate independent tasks to the local Antigravity CLI (agy) from DSH; ...",
  "exports": {
    "./agy-provider": "./provider/index.js",
    "./agy-provider/locale/*": "./provider/locale/*",
    "./locale/*": "./locale/*",
    "./icon": "./icon.svg",
    "./package.json": "./package.json"
  },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml", "listedByDefault": false } },
  "engines": { "dsh": ">=0.2.2-rc.1 <0.3.0" },
  "dependencies": {
    "@deepseek-ai/cordis": "4.1.0",
    "@deepseek-ai/dsh-brand": "0.2.2-rc.1",
    "@deepseek-ai/dsh-llm": "0.2.2-rc.1",
    "@deepseek-ai/dsh-subagent": "0.2.2-rc.1",
    "@deepseek-ai/dsh-timeout": "0.2.2-rc.1",
    "@deepseek-ai/schemastery": "3.19.0",
    "@deepseek-ai/dsh-experimental-tool-subagent-oar": "0.2.2-rc.1"
  },
  "devDependencies": { "@jiezhengj/subagent_oar_agy-provider": "workspace:*" },
  "files": ["cordis.patch.yml", "icon.svg", "README.md", "docs", "locale", "provider"]
}
```

## cordis.patch.yml

```yaml
- insert:
    - id: subagent-agy
      name: "@jiezhengj/subagent_oar_agy/agy-provider"
      config:
        providerName: agy
        permissionMode: yolo
        locale: auto
    - id: tool-subagent-oar-agy
      name: '@deepseek-ai/dsh-experimental-tool-subagent-oar'
      config:
        providers:
          agy: agy
        toolName: subagent_oar_agy
```

## 契约要点

1. **两行必须同时生效**：缺提供方行则工具启动时 `getProvider('agy')` 未注册、委派报错；缺工具行则模型看不到入口。
2. **自包含组合包**：构建脚本 `scripts/vendor-provider.mjs` 把提供方 `dist` 与 `locale` 复制到 `provider/`；patch 通过包内子路径 `.../agy-provider` 引用，运行时依赖只来自组合包 `dependencies`，tarball 安装不依赖 workspace。
3. **exports 必须暴露元数据资源**：DSH 的 `readPluginMeta` 通过 Node 解析器读取 `<pkg>/locale/en.json`、`<pkg>/package.json`、`<pkg>/icon`。组合包一旦声明 `exports`，MUST 同时导出 `./locale/*`、`./agy-provider/locale/*`、`./icon`、`./package.json`；缺失会静默回退为包名（v0.2.2 的真实回归，v0.2.3 修复）。
4. **官方工具包精确锁版本**：spike 通过后锁定 `0.2.2-rc.1`；升级时必须重跑 spike 并更新 `engines.dsh`。
5. **`engines.dsh` 拒绝加载**：DSH 版本不满足时，插件安装/加载被拒绝并说明所需范围，组合包不得绕过。
6. **禁用语义**：用户禁用组合包后两行都移除，模型工具列表恢复；重新启用恢复配置，无需重新填写。
7. **工具名与共存**：默认 `toolName: subagent_oar_agy`，与官方 OAR 组合包（`subagent_oar`）可同时启用；用户可覆盖为 `subagent_oar`（仅无官方 OAR 时）。DSH 对重复工具名报错并拒绝第二个注册，不静默覆盖。
8. **本地化元数据**：`locale/<lang>.json` 提供 8 种语言的 `meta.title`/`meta.description`，`meta.detail` 指向 `docs/DETAIL.<lang>.md`；缺省回退为 `package.json` 的 name/description 与 README。
9. **不修改 AGY 环境**：安装/升级/禁用组合包不得写入 `~/.gemini`、`~/.local/bin` 或任何 AGY 配置。
10. **分发**：仓库公开，Release tarball 地址可直接粘贴进 DSH 插件管理安装框；`README.md` 是语言索引页，链接 8 个 `README.<lang>.md`。
