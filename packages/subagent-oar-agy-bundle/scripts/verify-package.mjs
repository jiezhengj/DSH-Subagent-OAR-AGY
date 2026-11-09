#!/usr/bin/env node
/** 发布前校验：清单、元数据、文件与 npm pack 结果。失败时以非零退出。 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const bundleRoot = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const readJson = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
const pkg = readJson('package.json')
const rootLicense = readFileSync(`${repoRoot}/LICENSE`, 'utf8')
const bundleLicense = readFileSync(`${bundleRoot}/LICENSE`, 'utf8')

const expectedName = '@jiezhengj/subagent-oar-agy'
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u

assert.equal(pkg.name, expectedName, 'package name must be the published short name')
assert.equal(pkg.name.length, 27, 'published name must be 27 characters')
assert.match(pkg.version, semver, 'version must be valid semver')
assert.equal(pkg.license, 'MIT', 'license must be MIT')
assert.equal(pkg.publishConfig?.access, 'public', 'publishConfig.access must be public')
assert.ok(Array.isArray(pkg.keywords) && pkg.keywords.includes('dsh-plugin'), 'keywords must include dsh-plugin')
assert.equal(pkg.engines?.dsh, '>=0.2.2-rc.1 <0.3.0', 'engines.dsh must cover the supported DSH range')
assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml', 'dsh.bundle.patch must point at the patch')
assert.deepEqual(pkg.repository, { type: 'git', url: 'git+https://github.com/jiezhengj/DSH-Subagent-OAR-AGY.git' })
assert.equal(pkg.homepage, 'https://github.com/jiezhengj/DSH-Subagent-OAR-AGY')
assert.deepEqual(pkg.bugs, { url: 'https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/issues' })

for (const key of ['./agy-provider', './agy-provider/locale/*', './locale/*', './icon', './package.json', './tool']) {
  assert.ok(pkg.exports?.[key], `missing exports entry ${key}`)
}
for (const dependency of Object.values(pkg.dependencies ?? {})) {
  assert.ok(!/^(?:workspace:|file:|link:|npm:)/u.test(String(dependency)), `runtime dependency must not be ${dependency}`)
}

const expectedFiles = ['LICENSE', 'cordis.patch.yml', 'icon.svg', 'README.md', 'docs', 'locale', 'provider', 'tool.js']
assert.deepEqual(pkg.files, expectedFiles, 'files must be the exact publish whitelist')
assert.equal(bundleLicense, rootLicense, 'bundle LICENSE must be byte-identical to root LICENSE')

const required = [
  'LICENSE', 'README.md', 'cordis.patch.yml', 'icon.svg', 'tool.js',
  'package.json', 'docs/INSTALL.md', 'provider/index.js', 'provider/locale/en.json',
  ...['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh'].map(language => `locale/${language}.json`),
  ...['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh'].map(language => `docs/DETAIL.${language}.md`),
]
for (const file of required) {
  assert.ok(existsSync(`${bundleRoot}/${file}`), `missing required file ${file}`)
}
const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: bundleRoot, encoding: 'utf8' })
const packed = Object.values(JSON.parse(raw))[0]
assert.equal(packed.name, expectedName)
assert.equal(packed.version, pkg.version)
assert.equal(packed.entryCount, 71, `expected 71 packed files, got ${packed.entryCount}`)
assert.ok(packed.unpackedSize <= 150_000, `unpacked size ${packed.unpackedSize} exceeds 150 kB`)
assert.ok(packed.size <= 51_200, `packed size ${packed.size} exceeds 50 kB`)
const paths = packed.files.map(file => file.path)
assert.ok(paths.every(path => !path.startsWith('package/')), 'npm pack paths must not carry a package/ prefix')
for (const file of required) assert.ok(paths.includes(file), `packed tarball missing ${file}`)

const allowedDocs = new Set(['INSTALL.md', ...['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh'].map(language => `DETAIL.${language}.md`)])
for (const path of paths) {
  assert.ok(!path.startsWith('scripts/'), 'scripts must not be packed')
  assert.ok(!path.startsWith('test/'), 'tests must not be packed')
  assert.ok(!path.split('/').includes('src'), 'source directories must not be packed')
  assert.ok(!/(^|\/)\.env(?:\.|$)/u.test(path), 'environment files must not be packed')
  assert.ok(!/\.(?:log|tmp|temp)$/iu.test(path), 'logs and temporary files must not be packed')
  assert.ok(!path.endsWith('.tgz'), 'tarballs must not be packed')
  assert.ok(!/(^|\/)(?:\.DS_Store|\.npmrc)$/u.test(path), 'editor/registry metadata must not be packed')
  assert.ok(!/\.(?:ts|tsx|mts|cts)$/u.test(path) || /\.d\.(?:ts|mts|cts)$/u.test(path), `TypeScript source must not be packed: ${path}`)
  if (path.startsWith('docs/')) assert.ok(allowedDocs.has(path.slice(5)), `unexpected docs file: ${path}`)
}

console.log(`verify-package: ${packed.entryCount} files, ${packed.size} B packed, ${packed.unpackedSize} B unpacked`)
