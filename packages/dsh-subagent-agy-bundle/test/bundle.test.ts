
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import * as oar from '@deepseek-ai/dsh-experimental-tool-subagent-oar'
import { Config as ProviderConfig } from 'dsh-subagent-agy'

const bundleRoot = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string
  engines: { dsh: string }
  dsh: { bundle: { patch: string; listedByDefault: boolean } }
  dependencies: Record<string, string>
}
const patchPath = new URL(`..${pkg.dsh.bundle.patch.replace('./', '/')}`, import.meta.url)
const patch = parseYaml(readFileSync(patchPath, 'utf8')) as Array<{ insert: Array<{ id: string; name: string; config: Record<string, unknown> }> }> | null

describe('bundle manifest', () => {
  it('declares the patch, engine range, and both dependencies', () => {
    expect(pkg.name).toBe('dsh-subagent-agy-bundle')
    expect(pkg.dsh.bundle.listedByDefault).toBe(false)
    expect(pkg.engines.dsh).toBe('>=0.2.2-rc.1 <0.3.0')
    expect(pkg.dependencies['dsh-subagent-agy']).toBeDefined()
    expect(pkg.dependencies['@deepseek-ai/dsh-experimental-tool-subagent-oar']).toBe('0.2.2-rc.1')
  })

  it('ships the patch, icon, README and docs', () => {
    for (const file of ['cordis.patch.yml', 'icon.svg', 'README.md', 'docs/INSTALL.md', 'docs/DETAIL.md']) {
      expect(existsSync(`${bundleRoot}/${file}`)).toBe(true)
    }
  })

  it('inserts exactly the provider row and the official tool row', () => {
    const entries = patch?.flatMap(entry => entry.insert) ?? []
    expect(entries.map(entry => entry.id)).toEqual(['subagent-agy', 'tool-subagent-oar-agy'])
    const provider = entries.find(entry => entry.id === 'subagent-agy')
    expect(provider?.name).toBe('dsh-subagent-agy')
    const parsed = ProviderConfig(provider?.config ?? {}) as { providerName: string; command: string; permissionMode: string }
    expect(parsed.providerName).toBe('agy')
    expect(parsed.permissionMode).toBe('yolo')
    expect(parsed.command).toBe('agy')
  })

  it('wires the official tool to the agy provider with the default tool name', () => {
    const entries = patch?.flatMap(entry => entry.insert) ?? []
    const tool = entries.find(entry => entry.id === 'tool-subagent-oar-agy')
    expect(tool?.name).toBe('@deepseek-ai/dsh-experimental-tool-subagent-oar')
    const parsed = oar.Config(tool?.config ?? {}) as { providers: Record<string, string>; toolName: string }
    expect(parsed.providers).toEqual({ agy: 'agy' })
    expect(parsed.toolName).toBe('subagent_oar')
  })

  it('documents the toolName override for coexistence with official OAR', () => {
    const override = oar.Config({ providers: { agy: 'agy' }, toolName: 'subagent_agy' }) as { toolName: string }
    expect(override.toolName).toBe('subagent_agy')
    expect(readFileSync(new URL('../README.md', import.meta.url), 'utf8')).toContain('toolName: subagent_agy')
  })

  it('answers the three user questions and disclaims official support', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
    expect(readme).toContain('默认是否自动执行')
    expect(readme).toContain('风险是什么')
    expect(readme).toContain('如何改保守')
    expect(readme).toContain('非官方封装')
  })
})
