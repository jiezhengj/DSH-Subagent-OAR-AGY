# T005 Spike：官方工具包可用性

**日期**：2026-11-08　**结论**：PASS（可安装、导出齐全、`providers` 契约接受 `agy`）

## 环境

- DSH 桌面版 0.2.2-rc.1
- 官方工具包 `@deepseek-ai/dsh-experimental-tool-subagent-oar@0.2.2-rc.1`
- Node v26.0.0、pnpm 12.18.0
- 隔离目录 `/tmp/agy_spike`（不影响桌面 profile）

## 步骤与结果

1. `npm install @deepseek-ai/dsh-experimental-tool-subagent-oar@0.2.2-rc.1` → 成功，版本 `0.2.2-rc.1`。
2. `import(...)` 导出：`Config`、`apply`、`inject`、`name`。
3. `Config` 字段：`providers`、`toolName`；`Config({})` 报错 `$.providers missing required value`（providers 必填）。
4. `Config({providers:{agy:'agy'}})` → `{"providers":{"agy":"agy"},"toolName":"subagent_oar"}`（默认工具名 `subagent_oar`）。
5. `Config({providers:{agy:'agy'},toolName:'subagent_agy'})` → 接受覆盖（`toolName` 为真实配置项）。
6. 组合包 patch 两行经 `Config` 解析通过（bundle 契约测试，见 `packages/subagent-oar-agy-bundle/test/bundle.test.ts`）。

## 结论与限制

- **PASS**：官方工具包可安装、可导入、`providers` 接受别名 `agy`；`toolName` 覆盖可用，README 的冲突处理方案成立。
- `providers` 只在配置解析层校验存在性，不检查运行时名是否已注册（`providers:{agy:'nope'}` 仍通过 schema），因此提供方行必须与工具行同时生效——组合包契约已说明。
- 宿主内的实际加载（cordis patch 挂载）无法在纯 Node 中复现；已在独立 pnpm 消费者中验证依赖树安装与模块导入（见 `validation.md`），宿主 GUI 加载留给用户验收。
