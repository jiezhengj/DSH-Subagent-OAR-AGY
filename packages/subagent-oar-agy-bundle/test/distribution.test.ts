import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const bundleRoot = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string
  version: string
  license: string
  publishConfig?: { access?: string }
  keywords?: string[]
  engines?: { dsh?: string }
  dsh?: { bundle?: { patch?: string; listedByDefault?: boolean } }
  exports?: Record<string, string>
  files?: string[]
  dependencies?: Record<string, string>
  repository?: unknown
  homepage?: string
  bugs?: { url?: string }
}

const languages = ['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh']

describe('npm distribution manifest', () => {
  it('publishes the 27-character short name with public access and MIT license', () => {
    expect(pkg.name).toBe('@jiezhengj/subagent-oar-agy')
    expect(pkg.name).toHaveLength(27)
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u)
    expect(pkg.publishConfig?.access).toBe('public')
    expect(pkg.license).toBe('MIT')
    expect(pkg.keywords).toContain('dsh-plugin')
  })

  it('declares DSH compatibility and bundle metadata for update eligibility', () => {
    expect(pkg.engines?.dsh).toBe('>=0.2.2-rc.1 <0.3.0')
    expect(pkg.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(pkg.dsh?.bundle?.listedByDefault).toBe(false)
  })

  it('exports every resource DSH reads and keeps runtime dependencies registry-safe', () => {
    for (const key of ['./agy-provider', './agy-provider/locale/*', './locale/*', './icon', './package.json', './tool']) {
      expect(pkg.exports?.[key]).toBeTruthy()
    }
    for (const dependency of Object.values(pkg.dependencies ?? {})) {
      expect(dependency).not.toMatch(/^(?:workspace:|file:|link:|npm:)/u)
    }
  })

  it('publishes only the exact whitelist', () => {
    expect(pkg.files).toEqual(['LICENSE', 'cordis.patch.yml', 'icon.svg', 'README.md', 'docs', 'locale', 'provider', 'tool.js'])
  })

  it('ships LICENSE and the complete install/runtime file set', () => {
    expect(pkg.files).toContain('LICENSE')
    for (const file of ['LICENSE', 'README.md', 'cordis.patch.yml', 'icon.svg', 'tool.js', 'provider/index.js', 'docs/INSTALL.md']) {
      expect(existsSync(`${bundleRoot}/${file}`)).toBe(true)
    }
    for (const language of languages) {
      expect(existsSync(`${bundleRoot}/locale/${language}.json`)).toBe(true)
      expect(existsSync(`${bundleRoot}/docs/DETAIL.${language}.md`)).toBe(true)
    }
  })

  it('keeps the bundled license byte-identical to the repository license', () => {
    const rootLicense = readFileSync(new URL('../../../LICENSE', import.meta.url))
    const bundleLicense = readFileSync(new URL('../LICENSE', import.meta.url))
    expect(bundleLicense.equals(rootLicense)).toBe(true)
  })

  it('points repository metadata at the public project', () => {
    expect(pkg.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/jiezhengj/DSH-Subagent-OAR-AGY.git',
    })
    expect(pkg.homepage).toBe('https://github.com/jiezhengj/DSH-Subagent-OAR-AGY')
    expect(pkg.bugs?.url).toBe('https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/issues')
  })
})
