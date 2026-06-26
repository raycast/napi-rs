import { existsSync } from 'node:fs'
import { exec, execSync } from 'node:child_process'
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { join as posixJoin, sep as posixSep } from 'node:path/posix'
import { sep as win32Sep } from 'node:path/win32'
import { fileURLToPath, pathToFileURL } from 'node:url'

import ava, { type TestFn } from 'ava'

import {
  buildProject,
  createArtifactDestinationName,
  createWasiBrowserEntry,
  createWasiCompilerFlags,
  createWasiDeferredBindingTypeDef,
  generateTypeDef,
  selectWasiBrowserTarget,
  verifyWasiReactor,
  writeJsBinding,
} from '../build.js'
import {
  DEFAULT_TYPE_DEF_HEADER,
  getSystemDefaultTarget,
  parseTriple,
} from '../../utils/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../../..')

const test = ava as TestFn<{
  tmpDir: string
  projectDir: string
  typeDefDir: string
}>

test.beforeEach(async (t) => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  const tmpDir = posixJoin(
    tmpdir(),
    'napi-rs-test',
    `build-spec-${timestamp}-${random}`,
  )
  const projectDir = posixJoin(tmpDir, 'project')
  const typeDefDir = posixJoin(projectDir, 'target', 'type-def')

  await mkdir(typeDefDir, { recursive: true })

  t.context = { tmpDir, projectDir, typeDefDir }
})

test.afterEach.always(async (t) => {
  if (existsSync(t.context.tmpDir)) {
    await rm(t.context.tmpDir, { recursive: true, force: true })
  }
})

test('build pipeline generates bindings and artifacts', async (t) => {
  const { projectDir, typeDefDir } = t.context
  const crateName = 'build_integration'
  const binaryName = 'build-integration'
  const packageName = 'build-integration'
  const version = '0.1.0'
  const target = getSystemDefaultTarget()

  const napiPath = posixJoin(repoRoot, 'crates', 'napi').replaceAll(
    win32Sep,
    posixSep,
  )
  const napiDerivePath = posixJoin(repoRoot, 'crates', 'macro').replaceAll(
    win32Sep,
    posixSep,
  )
  const napiBuildPath = posixJoin(repoRoot, 'crates', 'build').replaceAll(
    win32Sep,
    posixSep,
  )

  await mkdir(join(projectDir, 'src'), { recursive: true })

  const cargoToml = `[package]
name = "${crateName}"
version = "${version}"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
napi = { path = "${napiPath}" }
napi-derive = { path = "${napiDerivePath}" }

[build-dependencies]
napi-build = { path = "${napiBuildPath}" }
`

  await writeFile(join(projectDir, 'Cargo.toml'), cargoToml)
  await writeFile(
    join(projectDir, 'package.json'),
    `${JSON.stringify(
      {
        name: packageName,
        version,
        napi: {
          binaryName,
          targets: [target.triple],
        },
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    join(projectDir, 'build.rs'),
    'fn main() {\n    napi_build::setup();\n}\n',
  )
  await writeFile(
    join(projectDir, 'src', 'lib.rs'),
    'use napi_derive::napi;\n\n#[napi]\npub fn sum(a: i32, b: i32) -> i32 {\n    a + b\n}\n',
  )

  const buildCmd = `cargo build --target ${target.triple}`

  await new Promise<void>((resolve, reject) => {
    const child = exec(buildCmd, {
      cwd: projectDir,
      env: { ...process.env, NAPI_TYPE_DEF_TMP_FOLDER: typeDefDir },
    })
    child.stderr?.on('data', (data) => {
      console.error(data.toString())
    })
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`cargo build exited with code ${code ?? 'null'}`))
      }
    })
    child.on('error', reject)
  })

  const files = await readdir(typeDefDir)
  t.true(files.length > 0, 'type definition files should be generated')

  const { exports, dts } = await generateTypeDef({
    typeDefDir,
    cwd: projectDir,
  })

  t.true(exports.includes('sum'), 'generateTypeDef should expose napi exports')

  const jsBinding = await writeJsBinding({
    platform: true,
    idents: exports,
    binaryName,
    packageName,
    version,
    outputDir: projectDir,
  })

  t.truthy(jsBinding)
  t.is(jsBinding?.path, join(projectDir, 'index.js'))

  const libName = crateName.replace(/-/g, '_')
  const srcName =
    target.platform === 'darwin'
      ? `lib${libName}.dylib`
      : target.platform === 'win32'
        ? `${libName}.dll`
        : `lib${libName}.so`
  const profile = 'debug'
  const srcPath = join(projectDir, 'target', target.triple, profile, srcName)
  t.true(existsSync(srcPath), 'compiled artifact should exist')

  const destName = `${binaryName}.${target.platformArchABI}.${srcName.endsWith('.wasm') ? 'wasm' : 'node'}`
  const destPath = join(projectDir, destName)
  await copyFile(srcPath, destPath)
  t.true(existsSync(destPath), 'artifact should be copied to output directory')

  const nodeStat = await stat(destPath)
  t.true(nodeStat.size > 0)

  t.regex(dts, /export declare function sum\(a: number, b: number\): number/)

  const jsPath = join(projectDir, 'index.js')
  t.true(existsSync(jsPath))
  const jsContent = await readFile(jsPath, 'utf-8')
  t.regex(jsContent, /module\.exports\.sum = nativeBinding\.sum/)
})

test('generateTypeDef preserves deterministic file order', async (t) => {
  const { projectDir, typeDefDir } = t.context

  await mkdir(join(typeDefDir, 'nested'), { recursive: true })
  await writeFile(
    join(typeDefDir, 'b.type'),
    '{"kind":"fn","name":"zeta","def":"function zeta(): void"}\n',
  )
  await writeFile(
    join(typeDefDir, 'a.type'),
    '{"kind":"fn","name":"alpha","def":"function alpha(): void"}\n',
  )

  const { exports, dts } = await generateTypeDef({
    typeDefDir,
    cwd: projectDir,
  })

  t.deepEqual(exports, ['alpha', 'zeta'])
  t.true(
    dts.indexOf('function alpha(): void') <
      dts.indexOf('function zeta(): void'),
  )
})

test('WASI artifact names remain flavor-specific without --platform', (t) => {
  const sourceName = 'binding.wasm'
  const threaded = createArtifactDestinationName(
    'binding',
    parseTriple('wasm32-wasip1-threads'),
    sourceName,
    false,
  )
  const threadless = createArtifactDestinationName(
    'binding',
    parseTriple('wasm32-wasip1'),
    sourceName,
    false,
  )

  t.is(threaded, 'binding.wasm32-wasi.wasm')
  t.is(threadless, 'binding.wasm32-wasip1.wasm')
  t.not(threaded, threadless)
})

test('WASI SDK compiler flags preserve paths containing spaces', (t) => {
  const wasiSdkPath = join(t.context.tmpDir, 'WASI SDK')
  const sysroot = join(wasiSdkPath, 'share', 'wasi-sysroot')
  const linker = join(wasiSdkPath, 'bin', 'wasm-ld')
  const flags = createWasiCompilerFlags(
    wasiSdkPath,
    'wasm32-wasip1-threads',
    true,
  )

  t.is(
    flags.compileFlags,
    `'--target=wasm32-wasip1-threads' '--sysroot=${sysroot}' '-pthread' '-mllvm' '-wasm-enable-sjlj'`,
  )
  t.is(
    flags.linkerFlags,
    `'-fuse-ld=${linker}' '--target=wasm32-wasip1-threads'`,
  )
})

test('writeJsBinding creates nested custom entry directories', async (t) => {
  const output = await writeJsBinding({
    platform: true,
    idents: [],
    jsBinding: join('dist', 'binding.cjs'),
    binaryName: 'nested-wasi',
    packageName: 'nested-wasi',
    version: '1.0.0',
    outputDir: t.context.projectDir,
    wasiFlavors: ['wasm32-wasip1'],
  })

  t.is(output?.path, join(t.context.projectDir, 'dist', 'binding.cjs'))
  t.true(existsSync(output!.path))
})

test('writeJsBinding emits an untyped CJS WASI fallback loader', async (t) => {
  const { projectDir } = t.context
  const output = await writeJsBinding({
    platform: true,
    idents: [],
    binaryName: 'untyped-wasi',
    packageName: 'untyped-wasi',
    version: '1.0.0',
    outputDir: projectDir,
    wasiFlavors: ['wasm32-wasip1'],
  })

  t.is(output?.path, join(projectDir, 'index.js'))
  const binding = await readFile(join(projectDir, 'index.js'), 'utf8')
  t.true(binding.includes("require('./untyped-wasi.wasip1.cjs')"))
  t.true(binding.includes("require('untyped-wasi-wasm32-wasip1')"))
  t.true(binding.includes('module.exports = nativeBinding'))
})

test.serial(
  'writeJsBinding emits an executable untyped ESM WASI fallback loader',
  async (t) => {
    const { projectDir } = t.context
    await writeFile(
      join(projectDir, 'untyped-esm-wasi.wasip1.cjs'),
      'module.exports = { answer: 42 }\n',
    )
    await writeFile(join(projectDir, 'untyped-esm-wasi.wasm32-wasip1.wasm'), '')
    const output = await writeJsBinding({
      platform: true,
      esm: true,
      idents: [],
      jsBinding: 'index.mjs',
      binaryName: 'untyped-esm-wasi',
      packageName: 'untyped-esm-wasi',
      version: '1.0.0',
      outputDir: projectDir,
      wasiFlavors: ['wasm32-wasip1'],
    })

    t.is(output?.path, join(projectDir, 'index.mjs'))
    const previousForceWasi = process.env.NAPI_RS_FORCE_WASI
    process.env.NAPI_RS_FORCE_WASI = 'true'
    try {
      const binding = await import(
        `${pathToFileURL(output!.path).href}?test=${Date.now()}`
      )
      t.is(binding.default.answer, 42)
      t.false('answer' in binding)
    } finally {
      if (previousForceWasi === undefined) {
        delete process.env.NAPI_RS_FORCE_WASI
      } else {
        process.env.NAPI_RS_FORCE_WASI = previousForceWasi
      }
    }
  },
)

test('WASI artifact verification requires a reactor initializer', async (t) => {
  const missingPath = join(t.context.tmpDir, 'missing-initialize.wasm')
  await writeFile(missingPath, new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
  const error = await t.throwsAsync(() => verifyWasiReactor(missingPath))
  t.regex(error.message, /does not export _initialize/)

  const validPath = join(t.context.tmpDir, 'reactor.wasm')
  await writeFile(
    validPath,
    new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 7, 15, 1, 11,
      95, 105, 110, 105, 116, 105, 97, 108, 105, 122, 101, 0, 0, 10, 4, 1, 2, 0,
      11,
    ]),
  )
  await t.notThrowsAsync(() => verifyWasiReactor(validPath))
})

test('should throw on emnapi version mismatch in wasm build', async (t) => {
  const { projectDir } = t.context
  const crateName = 'wasm_version_check'
  const binaryName = 'wasm-version-check'
  const packageName = 'wasm-version-check'
  const version = '0.1.0'

  const napiPath = posixJoin(repoRoot, 'crates', 'napi').replaceAll(
    win32Sep,
    posixSep,
  )
  const napiDerivePath = posixJoin(repoRoot, 'crates', 'macro').replaceAll(
    win32Sep,
    posixSep,
  )
  const napiBuildPath = posixJoin(repoRoot, 'crates', 'build').replaceAll(
    win32Sep,
    posixSep,
  )

  await mkdir(join(projectDir, 'src'), { recursive: true })

  const cargoToml = `[package]
name = "${crateName}"
version = "${version}"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
napi = { path = "${napiPath}", features = ["noop"] }
napi-derive = { path = "${napiDerivePath}", features = ["noop"] }

[build-dependencies]
napi-build = { path = "${napiBuildPath}" }
`

  await writeFile(join(projectDir, 'Cargo.toml'), cargoToml)
  await writeFile(
    join(projectDir, 'package.json'),
    `${JSON.stringify(
      {
        name: packageName,
        version,
        napi: {
          binaryName,
          targets: ['wasm32-wasi-preview1-threads'],
        },
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    join(projectDir, 'build.rs'),
    'fn main() {\n    napi_build::setup();\n}\n',
  )
  await writeFile(
    join(projectDir, 'src', 'lib.rs'),
    'use napi_derive::napi;\n\n#[napi]\npub fn sum(a: i32, b: i32) -> i32 {\n    a + b\n}\n',
  )

  // Create fake @emnapi/core and @emnapi/runtime with mismatched versions
  const fakeVersion = '0.0.0-fake'
  for (const pkg of ['@emnapi/core', '@emnapi/runtime']) {
    const pkgDir = join(projectDir, 'node_modules', pkg)
    await mkdir(pkgDir, { recursive: true })
    await writeFile(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: pkg, version: fakeVersion, main: 'index.js' }),
    )
    await writeFile(
      join(pkgDir, 'index.js'),
      `module.exports = { version: "${fakeVersion}" }`,
    )
  }

  const error = await t.throwsAsync(() =>
    buildProject({
      target: 'wasm32-wasi-preview1-threads',
      cwd: projectDir,
    }),
  )

  t.truthy(error)
  t.regex(error!.message, /emnapi version mismatch/)
})

// Integration: an explicit threadless target controls the emitted loader and
// browser entry even when package config declares only the threaded flavor.
test('explicit WASI build target selects the browser flavor', (t) => {
  const target = selectWasiBrowserTarget(
    parseTriple('wasm32-wasip1'),
    [parseTriple('wasm32-wasip1-threads')],
    [parseTriple('wasm32-wasip1')],
  )

  t.is(target?.platformArchABI, 'wasm32-wasip1')
})

test('untyped WASI browser entry forwards the default export', async (t) => {
  const { projectDir } = t.context
  const packageName = 'untyped-browser-entry-wasm32-wasip1'
  const packageDir = join(projectDir, 'node_modules', packageName)
  await mkdir(packageDir, { recursive: true })
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify({
      name: packageName,
      type: 'module',
      exports: './index.js',
    }),
  )
  await writeFile(
    join(packageDir, 'index.js'),
    'export default { answer: 42 }\n',
  )
  const entryPath = join(projectDir, 'browser.mjs')
  await writeFile(
    entryPath,
    createWasiBrowserEntry('untyped-browser-entry', 'wasm32-wasip1', []),
  )

  const binding = await import(
    `${pathToFileURL(entryPath).href}?test=${Date.now()}`
  )
  t.is(binding.default.answer, 42)
  t.is(
    createWasiBrowserEntry('typed-browser-entry', 'wasm32-wasip1', ['sum']),
    "export * from 'typed-browser-entry-wasm32-wasip1'\n",
  )
})

test('deferred WASI declarations preserve typed and untyped bindings', (t) => {
  t.true(
    createWasiDeferredBindingTypeDef('./binding.wasip1.cjs', true).includes(
      "export type WasiBinding = typeof import('./binding.wasip1.cjs')",
    ),
  )
  const untyped = createWasiDeferredBindingTypeDef(
    './binding.wasip1.cjs',
    false,
  )
  t.true(untyped.includes('export type WasiBinding = Record<string, unknown>'))
  t.false(untyped.includes("import('./binding.wasip1.cjs')"))
})

test('direct untyped wasm32-wasip1 build emits complete browser and workerd entries', async (t) => {
  // The wasm32-wasip1 build needs the rust target; the cli test suite runs on
  // lanes that only install the host toolchain, so skip when unavailable.
  // Exact per-line match: a substring probe would be satisfied by a listing
  // containing only `wasm32-wasip1-threads`.
  const targetLibDir = execSync(
    'rustc --print target-libdir --target wasm32-wasip1',
    {
      encoding: 'utf8',
    },
  ).trim()
  if (
    !existsSync(targetLibDir) ||
    !(await readdir(targetLibDir)).some((file) => file.startsWith('libcore-'))
  ) {
    t.pass('skipped: wasm32-wasip1 rust target is not installed')
    return
  }

  const { projectDir } = t.context
  const crateName = 'wasip1_direct'
  const binaryName = 'wasip1-direct'
  const packageName = 'wasip1-direct'
  const version = '0.1.0'

  const napiPath = posixJoin(repoRoot, 'crates', 'napi').replaceAll(
    win32Sep,
    posixSep,
  )
  const napiDerivePath = posixJoin(repoRoot, 'crates', 'macro').replaceAll(
    win32Sep,
    posixSep,
  )
  const napiBuildPath = posixJoin(repoRoot, 'crates', 'build').replaceAll(
    win32Sep,
    posixSep,
  )

  await mkdir(join(projectDir, 'src'), { recursive: true })

  await writeFile(
    join(projectDir, 'Cargo.toml'),
    `[package]
name = "${crateName}"
version = "${version}"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
napi = { path = "${napiPath}", default-features = false, features = ["napi4"] }
napi-derive = { path = "${napiDerivePath}", default-features = false, features = ["strict"] }

[build-dependencies]
napi-build = { path = "${napiBuildPath}" }
`,
  )
  await writeFile(
    join(projectDir, 'package.json'),
    `${JSON.stringify(
      {
        name: packageName,
        version,
        napi: {
          binaryName,
          targets: ['wasm32-wasip1-threads'],
        },
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    join(projectDir, 'build.rs'),
    'fn main() {\n    napi_build::setup();\n}\n',
  )
  await writeFile(
    join(projectDir, 'src', 'lib.rs'),
    'use napi_derive::napi;\n\n#[napi]\npub fn sum(a: i32, b: i32) -> i32 {\n    a + b\n}\n',
  )

  // `setWasiEnv` requires @emnapi/core and @emnapi/runtime resolvable from
  // the project with versions matching the cli's own `emnapi` package.
  const emnapiVersion = JSON.parse(
    await readFile(
      join(repoRoot, 'node_modules', 'emnapi', 'package.json'),
      'utf-8',
    ),
  ).version
  for (const pkg of ['@emnapi/core', '@emnapi/runtime']) {
    const pkgDir = join(projectDir, 'node_modules', pkg)
    await mkdir(pkgDir, { recursive: true })
    await writeFile(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: pkg, version: emnapiVersion, main: 'index.js' }),
    )
    await writeFile(
      join(pkgDir, 'index.js'),
      `module.exports = { version: "${emnapiVersion}" }`,
    )
  }

  // `buildProject` resolves to `{ task }` without awaiting the build; the
  // cargo compile + postBuild run on the returned task promise.
  const { task } = await buildProject({
    platform: true,
    target: 'wasm32-wasip1',
    cwd: projectDir,
  })
  await task

  // the build emitted the wasip1-named loader set...
  t.true(existsSync(join(projectDir, `${binaryName}.wasip1.cjs`)))
  t.true(existsSync(join(projectDir, `${binaryName}.wasip1.d.cts`)))
  t.true(existsSync(join(projectDir, `${binaryName}.wasip1-browser.js`)))
  t.true(existsSync(join(projectDir, `${binaryName}.wasip1-deferred.js`)))
  t.true(existsSync(join(projectDir, `${binaryName}.wasip1-deferred.d.ts`)))
  t.false(existsSync(join(projectDir, `${binaryName}.wasi.cjs`)))

  // The built flavor still participates in the fallback chain even though it
  // differs from the configured flavor.
  const js = await readFile(join(projectDir, 'index.js'), 'utf-8')
  t.regex(js, new RegExp(`require\\('\\./${binaryName}\\.wasip1\\.cjs'\\)`))
  t.regex(js, new RegExp(`require\\('${packageName}-wasm32-wasip1'\\)`))
  t.is(
    await readFile(join(projectDir, 'browser.js'), 'utf8'),
    `export * from '${packageName}-wasm32-wasip1'\nexport { default } from '${packageName}-wasm32-wasip1'\n`,
  )
  const workerdTypeDef = await readFile(
    join(projectDir, `${binaryName}.wasip1-deferred.d.ts`),
    'utf8',
  )
  t.true(
    workerdTypeDef.includes(
      'export type WasiBinding = Record<string, unknown>',
    ),
  )
  t.false(workerdTypeDef.includes(`import('${packageName}')`))
  t.is(
    await readFile(join(projectDir, `${binaryName}.wasip1.d.cts`), 'utf8'),
    `${DEFAULT_TYPE_DEF_HEADER}
declare const binding: Record<string, unknown>
export = binding
`,
  )
  t.false(existsSync(join(projectDir, 'index.d.ts')))
})
