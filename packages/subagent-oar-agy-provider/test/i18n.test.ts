import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectLocale, isLocale, LOCALES, MESSAGES, normalizeLocale, readSettingsText, settingsLocale, t } from '../src/i18n.js'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

describe('runtime messages', () => {
  it('covers the eight DSH languages with the same keys and non-empty text', () => {
    const reference = Object.keys(MESSAGES.en).sort()
    expect(LOCALES).toEqual(['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh'])
    for (const locale of LOCALES) {
      expect(Object.keys(MESSAGES[locale]).sort()).toEqual(reference)
      for (const value of Object.values(MESSAGES[locale])) expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('substitutes placeholders and keeps each language distinct', () => {
    expect(t('en', 'permissionDenied', { mode: 'strict', tools: 'write_file' })).toContain('strict')
    expect(t('zh', 'permissionDenied', { mode: 'strict', tools: 'write_file' })).toContain('权限档 strict')
    expect(t('ja', 'timeout')).not.toBe(t('en', 'timeout'))
    expect(t('en', 'detailLabel')).toBe('Detail')
  })
})

describe('language detection', () => {
  it('normalizes BCP 47 ids and rejects unknown languages', () => {
    expect(normalizeLocale('zh-CN')).toBe('zh')
    expect(normalizeLocale('en-US')).toBe('en')
    expect(normalizeLocale('pt_BR')).toBe('pt')
    expect(normalizeLocale('xx_YY')).toBeUndefined()
    expect(normalizeLocale('xx')).toBeUndefined()
    expect(isLocale('ru')).toBe(true)
    expect(isLocale('zz')).toBe(false)
  })

  it('reads locale.preference from the settings document', () => {
    expect(settingsLocale('locale:\n  preference: ja\n')).toBe('ja')
    expect(settingsLocale('locale:\n  preference: "de-DE"\nother: 1\n')).toBe('de')
    expect(settingsLocale('other: 1\n')).toBeUndefined()
  })

  it('prefers explicit config, then settings, then the process environment, then English', () => {
    expect(detectLocale('fr', {}, 'locale:\n  preference: ja\n')).toBe('fr')
    expect(detectLocale('auto', {}, 'locale:\n  preference: ja\n')).toBe('ja')
    expect(detectLocale('auto', { LANG: 'es_ES.UTF-8' })).toBe('es')
    expect(detectLocale('auto', { DSH_LOCALE: 'ru-RU' })).toBe('ru')
    expect(detectLocale('auto', {})).toBe('en')
    expect(detectLocale(undefined, { LANG: 'C' })).toBe('en')
  })

  it('reads $DSH_HOME/settings.yaml and tolerates a missing file', () => {
    const home = mkdtempSync(join(tmpdir(), 'agy-i18n-'))
    writeFileSync(join(home, 'settings.yaml'), 'locale:\n  preference: pt-BR\n')
    expect(readSettingsText({ DSH_HOME: home })).toContain('preference')
    expect(settingsLocale(readSettingsText({ DSH_HOME: home }))).toBe('pt')
    expect(readSettingsText({ DSH_HOME: join(home, 'missing') })).toBeUndefined()
  })
})

describe('package locale metadata', () => {
  it('declares a localized title and description in the eight DSH languages', () => {
    for (const language of LOCALES) {
      const file = join(packageRoot, 'locale', `${language}.json`)
      expect(existsSync(file)).toBe(true)
      const meta = JSON.parse(readFileSync(file, 'utf8')).meta as { title: string; description: string }
      expect(meta.title.length).toBeGreaterThan(0)
      expect(meta.description.length).toBeGreaterThan(0)
    }
    const zh = JSON.parse(readFileSync(join(packageRoot, 'locale', 'zh.json'), 'utf8')).meta as { title: string }
    expect(zh.title).toBe('AGY 子智能体运行时')
  })
})
