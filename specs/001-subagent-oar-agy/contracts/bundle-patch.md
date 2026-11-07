# 契约：组合包与 patch

组合包 `dsh-subagent-agy-bundle` 是唯一用户安装入口。

## package.json 关键字段

```jsonc
{
  "name": "dsh-subagent-agy-bundle",
  "version": "0.1.0",
  "type": "module",
  "icon": "./icon.svg",
  "description": "把独立任务交给本机 Antigravity CLI（agy）执行的 DSH 插件",
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml",
      "listedByDefault": false
    }
  },
  "engines": {
    "dsh": ">=0.2.2-rc.1 <0.3.0"
  },
  "dependencies": {
    "dsh-subagent-agy": "0.1.0",
    "@deepseek-ai/dsh-experimental-tool-subagent-oar": "0.2.2-rc.1"
  },
  "files": ["cordis.patch.yml", "icon.svg", "README.md", "docs"]
}
```

## cordis.patch.yml

```yaml
- insert:
    - id: subagent-agy
      name: dsh-subagent-agy
      config:
        providerName: agy
        permissionMode: yolo
    - id: tool-subagent-oar-agy
      name: '@deepseek-ai/dsh-experimental-tool-subagent-oar'
      config:
        providers:
          agy: agy
```

## 契约要点

1. **两行必须同时生效**：缺提供方行则工具启动时 `getProvider('agy')` 未注册、委派报错；缺工具行则模型看不到入口。
2. **组合包依赖必须包含提供方包与官方工具包**：外部插件由宿主 Node 解析，pnpm 只安装组合包依赖树；漏依赖会导致 `Cannot find module`。
3. **官方工具包精确锁版本**：spike 通过后锁定 `0.2.2-rc.1`；升级时必须重跑 spike 并更新 `engines.dsh`。
4. **`engines.dsh` 拒绝加载**：DSH 版本不满足时，插件安装/加载被拒绝并说明所需范围（DSH 插件管理器行为），组合包不得绕过。
5. **禁用语义**：用户禁用组合包后两行都移除，模型工具列表恢复；重新启用恢复配置，无需重新填写。
6. **工具名与共存**：默认 `toolName: subagent_oar_agy`，与官方 OAR 组合包（`subagent_oar`）可同时启用；用户可覆盖为 `subagent_oar`（仅无官方 OAR 时）。DSH 对重复工具名报错并拒绝第二个注册，不静默覆盖。
7. **不修改 AGY 环境**：安装/升级/禁用组合包不得写入 `~/.gemini`、`~/.local/bin` 或任何 AGY 配置。
8. **可选 locale/display meta**：v1 不提供 UI 文案；插件页展示 `package.json` 的 name/description/icon。后续如需本地化再补 `locale/*.json`。
