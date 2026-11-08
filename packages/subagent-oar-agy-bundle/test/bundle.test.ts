
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import * as oar from '@deepseek-ai/dsh-experimental-tool-subagent-oar'
import { Config as ProviderConfig } from '@jiezhengj/subagent_oar_agy/agy-provider'

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
    expect(pkg.name).toBe('@jiezhengj/subagent_oar_agy')
    expect(pkg.dsh.bundle.listedByDefault).toBe(false)
    expect(pkg.engines.dsh).toBe('>=0.2.2-rc.1 <0.3.0')
    expect(pkg.devDependencies?.['@jiezhengj/subagent_oar_agy-provider']).toBeDefined()
    expect(pkg.dependencies['@deepseek-ai/dsh-experimental-tool-subagent-oar']).toBe('0.2.2-rc.1')
  })

  it('ships the patch, icon, README and docs', () => {
    for (const file of ['cordis.patch.yml', 'icon.svg', 'README.md', 'docs/INSTALL.md', 'docs/DETAIL.zh.md', 'docs/DETAIL.en.md', 'provider/index.js']) {
      expect(existsSync(`${bundleRoot}/${file}`)).toBe(true)
    }
  })

  it('inserts exactly the provider row and the official tool row', () => {
    const entries = patch?.flatMap(entry => entry.insert) ?? []
    expect(entries.map(entry => entry.id)).toEqual(['subagent-agy', 'tool-subagent-oar-agy'])
    const provider = entries.find(entry => entry.id === 'subagent-agy')
    expect(provider?.name).toBe('@jiezhengj/subagent_oar_agy/agy-provider')
    const parsed = ProviderConfig(provider?.config ?? {}) as { providerName: string; command: string; permissionMode: string }
    expect(parsed.providerName).toBe('agy')
    expect(parsed.permissionMode).toBe('yolo')
    expect(parsed.command).toBe('agy')
  })

  it('wires the official tool to the agy provider with a conflict-free default name', () => {
    const entries = patch?.flatMap(entry => entry.insert) ?? []
    const tool = entries.find(entry => entry.id === 'tool-subagent-oar-agy')
    expect(tool?.name).toBe('@deepseek-ai/dsh-experimental-tool-subagent-oar')
    const parsed = oar.Config(tool?.config ?? {}) as { providers: Record<string, string>; toolName: string }
    expect(parsed.providers).toEqual({ agy: 'agy' })
    expect(parsed.toolName).toBe('subagent_oar_agy')
  })

  it('documents the optional subagent_oar override', () => {
    const override = oar.Config({ providers: { agy: 'agy' }, toolName: 'subagent_oar' }) as { toolName: string }
    expect(override.toolName).toBe('subagent_oar')
    expect(readFileSync(new URL('../README.md', import.meta.url), 'utf8')).toContain('toolName: subagent_oar')
  })

  it('exports the locale, icon and manifest resources DSH reads for the plugin page', () => {
    const zhUrl = import.meta.resolve('@jiezhengj/subagent_oar_agy/locale/zh.json')
    const meta = JSON.parse(readFileSync(new URL(zhUrl), 'utf8')).meta as { title: string }
    expect(meta.title).toBe('AGY 子智能体')
    expect(import.meta.resolve('@jiezhengj/subagent_oar_agy/package.json')).toMatch(/package\.json$/u)
    expect(import.meta.resolve('@jiezhengj/subagent_oar_agy/icon')).toMatch(/icon\.svg$/u)
    const providerLocale = JSON.parse(readFileSync(new URL(import.meta.resolve('@jiezhengj/subagent_oar_agy/agy-provider/locale/en.json')), 'utf8'))
    expect(providerLocale.meta.title).toBe('AGY subagent runtime')
  })

  it('localizes its display name and description into the eight DSH languages', () => {
    const languages = ['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh']
    const titles = new Set<string>()
    for (const language of languages) {
      const file = `${bundleRoot}/locale/${language}.json`
      expect(existsSync(file)).toBe(true)
      const meta = JSON.parse(readFileSync(file, 'utf8')).meta as { title: string; description: string; detail: string }
      expect(meta.title.length).toBeGreaterThan(0)
      expect(meta.description.length).toBeGreaterThan(0)
      expect(existsSync(`${bundleRoot}/${meta.detail}`)).toBe(true)
      titles.add(meta.title)
    }
    expect(titles.size).toBeGreaterThanOrEqual(2)
    const zh = JSON.parse(readFileSync(`${bundleRoot}/locale/zh.json`, 'utf8')).meta as { title: string }
    expect(zh.title).toBe('AGY 子智能体')
  })

  it('answers the three user questions and disclaims official support', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
    expect(readme).toContain('默认是否自动执行')
    expect(readme).toContain('风险是什么')
    expect(readme).toContain('如何改保守')
    expect(readme).toContain('非官方封装')
  })
})
