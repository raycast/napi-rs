import { Cli, Command } from "clipanion";

//#region src/def/artifacts.d.ts
declare abstract class BaseArtifactsCommand extends Command {
  static paths: string[][];
  static usage: import("clipanion").Usage;
  cwd: string;
  configPath?: string;
  packageJsonPath: string;
  outputDir: string;
  npmDir: string;
  buildOutputDir?: string;
  getOptions(): {
    cwd: string;
    configPath: string | undefined;
    packageJsonPath: string;
    outputDir: string;
    npmDir: string;
    buildOutputDir: string | undefined;
  };
}
/**
 * Copy artifacts from Github Actions into npm packages and ready to publish
 */
interface ArtifactsOptions {
  /**
   * The working directory of where napi command will be executed in, all other paths options are relative to this path
   *
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * Path to `napi` config json file
   */
  configPath?: string;
  /**
   * Path to `package.json`
   *
   * @default 'package.json'
   */
  packageJsonPath?: string;
  /**
   * Path to the folder where all built `.node` files put, same as `--output-dir` of build command
   *
   * @default './artifacts'
   */
  outputDir?: string;
  /**
   * Path to the folder where the npm packages put
   *
   * @default 'npm'
   */
  npmDir?: string;
  /**
   * Path to the build output dir, only needed when targets contains `wasm32-wasi-*`
   */
  buildOutputDir?: string;
}
//#endregion
//#region src/api/artifacts.d.ts
declare function collectArtifacts(userOptions: ArtifactsOptions): Promise<void>;
//#endregion
//#region src/def/build.d.ts
declare abstract class BaseBuildCommand extends Command {
  static paths: string[][];
  static usage: import("clipanion").Usage;
  target?: string;
  cwd?: string;
  manifestPath?: string;
  configPath?: string;
  packageJsonPath?: string;
  targetDir?: string;
  outputDir?: string;
  platform?: boolean;
  jsPackageName?: string;
  constEnum?: boolean;
  runtimeStringEnum?: boolean;
  jsBinding?: string;
  noJsBinding?: boolean;
  dts?: string;
  dtsHeader?: string;
  noDtsHeader?: boolean;
  dtsCache: boolean;
  esm?: boolean;
  strip?: boolean;
  release?: boolean;
  verbose?: boolean;
  bin?: string;
  package?: string;
  profile?: string;
  crossCompile?: boolean;
  useCross?: boolean;
  useNapiCross?: boolean;
  watch?: boolean;
  features?: string[];
  allFeatures?: boolean;
  noDefaultFeatures?: boolean;
  getOptions(): {
    target: string | undefined;
    cwd: string | undefined;
    manifestPath: string | undefined;
    configPath: string | undefined;
    packageJsonPath: string | undefined;
    targetDir: string | undefined;
    outputDir: string | undefined;
    platform: boolean | undefined;
    jsPackageName: string | undefined;
    constEnum: boolean | undefined;
    runtimeStringEnum: boolean | undefined;
    jsBinding: string | undefined;
    noJsBinding: boolean | undefined;
    dts: string | undefined;
    dtsHeader: string | undefined;
    noDtsHeader: boolean | undefined;
    dtsCache: boolean;
    esm: boolean | undefined;
    strip: boolean | undefined;
    release: boolean | undefined;
    verbose: boolean | undefined;
    bin: string | undefined;
    package: string | undefined;
    profile: string | undefined;
    crossCompile: boolean | undefined;
    useCross: boolean | undefined;
    useNapiCross: boolean | undefined;
    watch: boolean | undefined;
    features: string[] | undefined;
    allFeatures: boolean | undefined;
    noDefaultFeatures: boolean | undefined;
  };
}
/**
 * Build the NAPI-RS project
 */
interface BuildOptions$1 {
  /**
   * Build for the target triple, bypassed to `cargo build --target`
   */
  target?: string;
  /**
   * The working directory of where napi command will be executed in, all other paths options are relative to this path
   */
  cwd?: string;
  /**
   * Path to `Cargo.toml`
   */
  manifestPath?: string;
  /**
   * Path to `napi` config json file
   */
  configPath?: string;
  /**
   * Path to `package.json`
   */
  packageJsonPath?: string;
  /**
   * Directory for all crate generated artifacts, see `cargo build --target-dir`
   */
  targetDir?: string;
  /**
   * Path to where all the built files would be put. Default to the crate folder
   */
  outputDir?: string;
  /**
   * Add platform triple to the generated nodejs binding file, eg: `[name].linux-x64-gnu.node`
   */
  platform?: boolean;
  /**
   * Package name in generated js binding file. Only works with `--platform` flag
   */
  jsPackageName?: string;
  /**
   * Whether generate const enum for typescript bindings
   */
  constEnum?: boolean;
  /**
   * Emit `#[napi(string_enum)]` enums as runtime enums (`export declare enum`) under `--no-const-enum`. Default: type-only union.
   */
  runtimeStringEnum?: boolean;
  /**
   * Path and filename of generated JS binding file. Only works with `--platform` flag. Relative to `--output-dir`.
   */
  jsBinding?: string;
  /**
   * Whether to disable the generation JS binding file. Only works with `--platform` flag.
   */
  noJsBinding?: boolean;
  /**
   * Path and filename of generated type def file. Relative to `--output-dir`
   */
  dts?: string;
  /**
   * Custom file header for generated type def file. Only works when `typedef` feature enabled.
   */
  dtsHeader?: string;
  /**
   * Whether to disable the default file header for generated type def file. Only works when `typedef` feature enabled.
   */
  noDtsHeader?: boolean;
  /**
   * Whether to enable the dts cache, default to true
   *
   * @default true
   */
  dtsCache?: boolean;
  /**
   * Whether to emit an ESM JS binding file instead of CJS format. Only works with `--platform` flag.
   */
  esm?: boolean;
  /**
   * Whether strip the library to achieve the minimum file size
   */
  strip?: boolean;
  /**
   * Build in release mode
   */
  release?: boolean;
  /**
   * Verbosely log build command trace
   */
  verbose?: boolean;
  /**
   * Build only the specified binary
   */
  bin?: string;
  /**
   * Build the specified library or the one at cwd
   */
  package?: string;
  /**
   * Build artifacts with the specified profile
   */
  profile?: string;
  /**
   * [experimental] cross compile by replacing the cargo subcommand: Windows MSVC targets from a non-Windows host build with `cargo-xwin` (`windows-gnu` targets are rejected, `cargo-xwin` cannot handle them), non-Windows targets build with `cargo-zigbuild` (requires `zig` on PATH). The selected subcommand is auto-installed on first use. Cannot be combined with `--use-cross`, `--use-napi-cross` or `--watch`
   */
  crossCompile?: boolean;
  /**
   * [experimental] not recommended, prefer `--cross-compile` or `--use-napi-cross`: build in a Docker or Podman container with [cross](https://github.com/cross-rs/cross), which must be installed manually and needs a running container engine. Cannot be combined with `--cross-compile`, `--use-napi-cross` or `--watch`
   */
  useCross?: boolean;
  /**
   * [experimental] download a prebuilt gcc cross toolchain from `@napi-rs/cross-toolchain` (glibc 2.17) and set linker and C compiler environment variables. Linux glibc targets only (x64, arm64, armv7, ppc64le, s390x) on a Linux x64 or arm64 host, any other target or host errors. Cannot be combined with `--cross-compile` or `--use-cross`
   */
  useNapiCross?: boolean;
  /**
   * watch the crate changes and build continuously with `cargo-watch` crates
   */
  watch?: boolean;
  /**
   * Space-separated list of features to activate
   */
  features?: string[];
  /**
   * Activate all available features
   */
  allFeatures?: boolean;
  /**
   * Do not activate the `default` feature
   */
  noDefaultFeatures?: boolean;
}
//#endregion
//#region src/api/build.d.ts
type OutputKind = 'js' | 'dts' | 'node' | 'exe' | 'wasm';
type Output = {
  kind: OutputKind;
  path: string;
};
type BuildOptions = BuildOptions$1 & {
  cargoOptions?: string[];
};
declare function buildProject(rawOptions: BuildOptions): Promise<{
  task: Promise<Output[]>;
  abort: () => void;
}>;
interface WriteJsBindingOptions {
  platform?: boolean;
  noJsBinding?: boolean;
  idents: string[];
  jsBinding?: string;
  esm?: boolean;
  binaryName: string;
  packageName: string;
  version: string;
  outputDir: string;
}
declare function writeJsBinding(options: WriteJsBindingOptions): Promise<Output | undefined>;
interface GenerateTypeDefOptions {
  typeDefDir: string;
  noDtsHeader?: boolean;
  dtsHeader?: string;
  dtsHeaderFile?: string;
  configDtsHeader?: string;
  configDtsHeaderFile?: string;
  constEnum?: boolean;
  runtimeStringEnum?: boolean;
  cwd: string;
}
/**
 * Walk the napi-derive intermediate type-def directory, render every entry
 * into TypeScript via {@link processTypeDef}, and return the concatenated
 * `.d.ts` source plus the list of identifiers to re-export from
 * `index.js`.
 */
declare function generateTypeDef(options: GenerateTypeDefOptions): Promise<{
  exports: string[];
  dts: string;
}>;
//#endregion
//#region src/def/create-npm-dirs.d.ts
declare abstract class BaseCreateNpmDirsCommand extends Command {
  static paths: string[][];
  static usage: import("clipanion").Usage;
  cwd: string;
  configPath?: string;
  packageJsonPath: string;
  npmDir: string;
  dryRun: boolean;
  getOptions(): {
    cwd: string;
    configPath: string | undefined;
    packageJsonPath: string;
    npmDir: string;
    dryRun: boolean;
  };
}
/**
 * Create npm package dirs for different platforms
 */
interface CreateNpmDirsOptions {
  /**
   * The working directory of where napi command will be executed in, all other paths options are relative to this path
   *
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * Path to `napi` config json file
   */
  configPath?: string;
  /**
   * Path to `package.json`
   *
   * @default 'package.json'
   */
  packageJsonPath?: string;
  /**
   * Path to the folder where the npm packages put
   *
   * @default 'npm'
   */
  npmDir?: string;
  /**
   * Dry run without touching file system
   *
   * @default false
   */
  dryRun?: boolean;
}
//#endregion
//#region src/api/create-npm-dirs.d.ts
declare function createNpmDirs(userOptions: CreateNpmDirsOptions): Promise<void>;
//#endregion
//#region src/def/new.d.ts
declare abstract class BaseNewCommand extends Command {
  static paths: string[][];
  static usage: import("clipanion").Usage;
  $$path: string | undefined;
  $$name?: string;
  minNodeApiVersion: number;
  packageManager: string;
  license: string;
  targets: string[];
  enableDefaultTargets: boolean;
  enableAllTargets: boolean;
  enableTypeDef: boolean;
  enableGithubActions: boolean;
  testFramework: string;
  dryRun: boolean;
  getOptions(): {
    path: string | undefined;
    name: string | undefined;
    minNodeApiVersion: number;
    packageManager: string;
    license: string;
    targets: string[];
    enableDefaultTargets: boolean;
    enableAllTargets: boolean;
    enableTypeDef: boolean;
    enableGithubActions: boolean;
    testFramework: string;
    dryRun: boolean;
  };
}
/**
 * Create a new project with pre-configured boilerplate
 */
interface NewOptions {
  /**
   * The path where the NAPI-RS project will be created.
   */
  path?: string;
  /**
   * The name of the project, default to the name of the directory if not provided
   */
  name?: string;
  /**
   * The minimum Node-API version to support
   *
   * @default 4
   */
  minNodeApiVersion?: number;
  /**
   * The package manager to use. Only support yarn 4.x for now.
   *
   * @default 'yarn'
   */
  packageManager?: string;
  /**
   * License for open-sourced project
   *
   * @default 'MIT'
   */
  license?: string;
  /**
   * All targets the crate will be compiled for.
   *
   * @default []
   */
  targets?: string[];
  /**
   * Whether enable default targets
   *
   * @default true
   */
  enableDefaultTargets?: boolean;
  /**
   * Whether enable all targets
   *
   * @default false
   */
  enableAllTargets?: boolean;
  /**
   * Whether enable the `type-def` feature for typescript definitions auto-generation
   *
   * @default true
   */
  enableTypeDef?: boolean;
  /**
   * Whether generate preconfigured GitHub Actions workflow
   *
   * @default true
   */
  enableGithubActions?: boolean;
  /**
   * The JavaScript test framework to use, only support `ava` for now
   *
   * @default 'ava'
   */
  testFramework?: string;
  /**
   * Whether to run the command in dry-run mode
   *
   * @default false
   */
  dryRun?: boolean;
}
//#endregion
//#region src/api/new.d.ts
declare function newProject(userOptions: NewOptions): Promise<void>;
//#endregion
//#region src/def/pre-publish.d.ts
declare abstract class BasePrePublishCommand extends Command {
  static paths: string[][];
  static usage: import("clipanion").Usage;
  cwd: string;
  configPath?: string;
  packageJsonPath: string;
  npmDir: string;
  tagStyle: string;
  ghRelease: boolean;
  ghReleaseName?: string;
  ghReleaseId?: string;
  skipOptionalPublish: boolean;
  dryRun: boolean;
  getOptions(): {
    cwd: string;
    configPath: string | undefined;
    packageJsonPath: string;
    npmDir: string;
    tagStyle: string;
    ghRelease: boolean;
    ghReleaseName: string | undefined;
    ghReleaseId: string | undefined;
    skipOptionalPublish: boolean;
    dryRun: boolean;
  };
}
/**
 * Update package.json and copy addons into per platform packages
 */
interface PrePublishOptions {
  /**
   * The working directory of where napi command will be executed in, all other paths options are relative to this path
   *
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * Path to `napi` config json file
   */
  configPath?: string;
  /**
   * Path to `package.json`
   *
   * @default 'package.json'
   */
  packageJsonPath?: string;
  /**
   * Path to the folder where the npm packages put
   *
   * @default 'npm'
   */
  npmDir?: string;
  /**
   * git tag style, `npm` or `lerna`
   *
   * @default 'lerna'
   */
  tagStyle?: 'npm' | 'lerna';
  /**
   * Whether create GitHub release
   *
   * @default true
   */
  ghRelease?: boolean;
  /**
   * GitHub release name
   */
  ghReleaseName?: string;
  /**
   * Existing GitHub release id
   */
  ghReleaseId?: string;
  /**
   * Whether skip optionalDependencies packages publish
   *
   * @default false
   */
  skipOptionalPublish?: boolean;
  /**
   * Dry run without touching file system
   *
   * @default false
   */
  dryRun?: boolean;
}
//#endregion
//#region src/api/pre-publish.d.ts
declare function prePublish(userOptions: PrePublishOptions): Promise<void>;
//#endregion
//#region src/def/rename.d.ts
declare abstract class BaseRenameCommand extends Command {
  static paths: string[][];
  static usage: import("clipanion").Usage;
  cwd: string;
  configPath?: string;
  packageJsonPath: string;
  npmDir: string;
  $$name?: string;
  binaryName?: string;
  packageName?: string;
  manifestPath: string;
  repository?: string;
  description?: string;
  getOptions(): {
    cwd: string;
    configPath: string | undefined;
    packageJsonPath: string;
    npmDir: string;
    name: string | undefined;
    binaryName: string | undefined;
    packageName: string | undefined;
    manifestPath: string;
    repository: string | undefined;
    description: string | undefined;
  };
}
/**
 * Rename the NAPI-RS project
 */
interface RenameOptions {
  /**
   * The working directory of where napi command will be executed in, all other paths options are relative to this path
   *
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * Path to `napi` config json file
   */
  configPath?: string;
  /**
   * Path to `package.json`
   *
   * @default 'package.json'
   */
  packageJsonPath?: string;
  /**
   * Path to the folder where the npm packages put
   *
   * @default 'npm'
   */
  npmDir?: string;
  /**
   * The new name of the project
   */
  name?: string;
  /**
   * The new binary name *.node files
   */
  binaryName?: string;
  /**
   * The new package name of the project
   */
  packageName?: string;
  /**
   * Path to `Cargo.toml`
   *
   * @default 'Cargo.toml'
   */
  manifestPath?: string;
  /**
   * The new repository of the project
   */
  repository?: string;
  /**
   * The new description of the project
   */
  description?: string;
}
//#endregion
//#region src/api/rename.d.ts
declare function renameProject(userOptions: RenameOptions): Promise<void>;
//#endregion
//#region src/def/universalize.d.ts
declare abstract class BaseUniversalizeCommand extends Command {
  static paths: string[][];
  static usage: import("clipanion").Usage;
  cwd: string;
  configPath?: string;
  packageJsonPath: string;
  outputDir: string;
  getOptions(): {
    cwd: string;
    configPath: string | undefined;
    packageJsonPath: string;
    outputDir: string;
  };
}
/**
 * Combile built binaries into one universal binary
 */
interface UniversalizeOptions {
  /**
   * The working directory of where napi command will be executed in, all other paths options are relative to this path
   *
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * Path to `napi` config json file
   */
  configPath?: string;
  /**
   * Path to `package.json`
   *
   * @default 'package.json'
   */
  packageJsonPath?: string;
  /**
   * Path to the folder where all built `.node` files put, same as `--output-dir` of build command
   *
   * @default './'
   */
  outputDir?: string;
}
//#endregion
//#region src/api/universalize.d.ts
declare function universalizeBinaries(userOptions: UniversalizeOptions): Promise<void>;
//#endregion
//#region src/def/version.d.ts
declare abstract class BaseVersionCommand extends Command {
  static paths: string[][];
  static usage: import("clipanion").Usage;
  cwd: string;
  configPath?: string;
  packageJsonPath: string;
  npmDir: string;
  getOptions(): {
    cwd: string;
    configPath: string | undefined;
    packageJsonPath: string;
    npmDir: string;
  };
}
/**
 * Update version in created npm packages
 */
interface VersionOptions {
  /**
   * The working directory of where napi command will be executed in, all other paths options are relative to this path
   *
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * Path to `napi` config json file
   */
  configPath?: string;
  /**
   * Path to `package.json`
   *
   * @default 'package.json'
   */
  packageJsonPath?: string;
  /**
   * Path to the folder where the npm packages put
   *
   * @default 'npm'
   */
  npmDir?: string;
}
//#endregion
//#region src/api/version.d.ts
declare function version(userOptions: VersionOptions): Promise<void>;
//#endregion
//#region src/commands/artifacts.d.ts
declare class ArtifactsCommand extends BaseArtifactsCommand {
  static usage: import("clipanion").Usage;
  static paths: string[][];
  execute(): Promise<void>;
}
//#endregion
//#region src/commands/build.d.ts
declare class BuildCommand extends BaseBuildCommand {
  pipe: string | undefined;
  cargoOptions: string[];
  execute(): Promise<void>;
}
//#endregion
//#region src/commands/create-npm-dirs.d.ts
declare class CreateNpmDirsCommand extends BaseCreateNpmDirsCommand {
  execute(): Promise<void>;
}
//#endregion
//#region src/commands/new.d.ts
declare class NewCommand extends BaseNewCommand {
  interactive: boolean;
  execute(): Promise<1 | 0>;
  private fetchOptions;
  private fetchName;
  private fetchLicense;
  private fetchNapiVersion;
  private fetchTargets;
  private fetchTypeDef;
  private fetchGithubActions;
}
//#endregion
//#region src/commands/pre-publish.d.ts
declare class PrePublishCommand extends BasePrePublishCommand {
  execute(): Promise<void>;
}
//#endregion
//#region src/commands/rename.d.ts
declare class RenameCommand extends BaseRenameCommand {
  execute(): Promise<void>;
}
//#endregion
//#region src/commands/universalize.d.ts
declare class UniversalizeCommand extends BaseUniversalizeCommand {
  execute(): Promise<void>;
}
//#endregion
//#region src/commands/version.d.ts
declare class VersionCommand extends BaseVersionCommand {
  execute(): Promise<void>;
}
//#endregion
//#region src/utils/target.d.ts
type Platform = NodeJS.Platform | 'wasm' | 'wasi' | 'openharmony';
type NodeJSArch = 'arm' | 'arm64' | 'ia32' | 'loong64' | 'mips' | 'mipsel' | 'ppc' | 'ppc64' | 'riscv64' | 's390' | 's390x' | 'x32' | 'x64' | 'universal' | 'wasm32';
interface Target {
  triple: string;
  platformArchABI: string;
  platform: Platform;
  arch: NodeJSArch;
  abi: string | null;
}
/**
 * A triple is a specific format for specifying a target architecture.
 * Triples may be referred to as a target triple which is the architecture for the artifact produced, and the host triple which is the architecture that the compiler is running on.
 * The general format of the triple is `<arch><sub>-<vendor>-<sys>-<abi>` where:
 *   - `arch` = The base CPU architecture, for example `x86_64`, `i686`, `arm`, `thumb`, `mips`, etc.
 *   - `sub` = The CPU sub-architecture, for example `arm` has `v7`, `v7s`, `v5te`, etc.
 *   - `vendor` = The vendor, for example `unknown`, `apple`, `pc`, `nvidia`, etc.
 *   - `sys` = The system name, for example `linux`, `windows`, `darwin`, etc. none is typically used for bare-metal without an OS.
 *   - `abi` = The ABI, for example `gnu`, `android`, `eabi`, etc.
 */
declare function parseTriple(rawTriple: string): Target;
//#endregion
//#region src/utils/config.d.ts
interface UserNapiConfig {
  /**
   * Name of the binary to be generated, default to `index`
   */
  binaryName?: string;
  /**
   * Name of the npm package, default to the name of root package.json name
   *
   * Always given `@scope/pkg` and arch suffix will be appended like `@scope/pkg-linux-gnu-x64`
   */
  packageName?: string;
  /**
   * All targets the crate will be compiled for
   */
  targets?: string[];
  /**
   * The npm client project uses.
   */
  npmClient?: string;
  /**
   * Whether generate const enum for typescript bindings
   */
  constEnum?: boolean;
  /**
   * Emit `#[napi(string_enum)]` enums as runtime enums (`export declare enum`) under `--no-const-enum`. Default: type-only union.
   */
  runtimeStringEnum?: boolean;
  /**
   * dts header prepend to the generated dts file
   */
  dtsHeader?: string;
  /**
   * dts header file path to be prepended to the generated dts file
   * if both dtsHeader and dtsHeaderFile are provided, dtsHeaderFile will be used
   */
  dtsHeaderFile?: string;
  /**
   * wasm compilation options
   */
  wasm?: {
    /**
     * https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/Memory
     * @default 4000 pages (256MiB)
     */
    initialMemory?: number;
    /**
     * @default 65536 pages (4GiB)
     */
    maximumMemory?: number;
    /**
     * Browser wasm binding configuration
     */
    browser: {
      /**
       * Whether to use fs module in browser
       */
      fs?: boolean;
      /**
       * Whether to initialize wasm asynchronously
       */
      asyncInit?: boolean;
      /**
       * Whether to inject `buffer` to emnapi context
       */
      buffer?: boolean;
      /**
       * Whether to emit custom events for errors in worker
       */
      errorEvent?: boolean;
    };
  };
  /**
   * @deprecated binaryName instead
   */
  name?: string;
  /**
   * @deprecated use packageName instead
   */
  package?: {
    name?: string;
  };
  /**
   * @deprecated use targets instead
   */
  triples?: {
    /**
     * Whether enable default targets
     */
    defaults: boolean;
    /**
     * Additional targets to be compiled for
     */
    additional?: string[];
  };
}
interface CommonPackageJsonFields {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  author?: string;
  authors?: string[];
  license?: string;
  cpu?: string[];
  os?: string[];
  libc?: string[];
  files?: string[];
  repository?: any;
  homepage?: any;
  engines?: Record<string, string>;
  publishConfig?: any;
  bugs?: any;
  napi?: UserNapiConfig;
  type?: 'module' | 'commonjs';
  scripts?: Record<string, string>;
  main?: string;
  module?: string;
  types?: string;
  browser?: string;
  exports?: any;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  ava?: {
    timeout?: string;
  };
}
type NapiConfig = Required<Pick<UserNapiConfig, 'binaryName' | 'packageName' | 'npmClient'>> & Pick<UserNapiConfig, 'wasm' | 'dtsHeader' | 'dtsHeaderFile' | 'constEnum' | 'runtimeStringEnum'> & {
  targets: Target[];
  packageJson: CommonPackageJsonFields;
};
declare function readNapiConfig(path: string, configPath?: string): Promise<NapiConfig>;
//#endregion
//#region src/index.d.ts
declare const cli: Cli<import("clipanion").BaseContext>;
/**
 *
 * @usage
 *
 * ```ts
 * const cli = new NapiCli()
 *
 * cli.build({
 *   cwd: '/path/to/your/project',
 * })
 * ```
 */
declare class NapiCli {
  artifacts: typeof collectArtifacts;
  new: typeof newProject;
  build: typeof buildProject;
  createNpmDirs: typeof createNpmDirs;
  prePublish: typeof prePublish;
  rename: typeof renameProject;
  universalize: typeof universalizeBinaries;
  version: typeof version;
}
declare function createBuildCommand(args: string[]): BuildCommand;
declare function createArtifactsCommand(args: string[]): ArtifactsCommand;
declare function createCreateNpmDirsCommand(args: string[]): CreateNpmDirsCommand;
declare function createPrePublishCommand(args: string[]): PrePublishCommand;
declare function createRenameCommand(args: string[]): RenameCommand;
declare function createUniversalizeCommand(args: string[]): UniversalizeCommand;
declare function createVersionCommand(args: string[]): VersionCommand;
declare function createNewCommand(args: string[]): NewCommand;
//#endregion
export { type GenerateTypeDefOptions, NapiCli, type WriteJsBindingOptions, cli, createArtifactsCommand, createBuildCommand, createCreateNpmDirsCommand, createNewCommand, createPrePublishCommand, createRenameCommand, createUniversalizeCommand, createVersionCommand, generateTypeDef, parseTriple, readNapiConfig, writeJsBinding };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguZC5jdHMiLCJuYW1lcyI6WyJCdWlsZE9wdGlvbnMiLCJSYXdCdWlsZE9wdGlvbnMiLCJSYXdOZXdPcHRpb25zIl0sInNvdXJjZXMiOlsiLi4vc3JjL2RlZi9hcnRpZmFjdHMuZC50cyIsIi4uL3NyYy9hcGkvYXJ0aWZhY3RzLmQudHMiLCIuLi9zcmMvZGVmL2J1aWxkLmQudHMiLCIuLi9zcmMvYXBpL2J1aWxkLmQudHMiLCIuLi9zcmMvZGVmL2NyZWF0ZS1ucG0tZGlycy5kLnRzIiwiLi4vc3JjL2FwaS9jcmVhdGUtbnBtLWRpcnMuZC50cyIsIi4uL3NyYy9kZWYvbmV3LmQudHMiLCIuLi9zcmMvYXBpL25ldy5kLnRzIiwiLi4vc3JjL2RlZi9wcmUtcHVibGlzaC5kLnRzIiwiLi4vc3JjL2FwaS9wcmUtcHVibGlzaC5kLnRzIiwiLi4vc3JjL2RlZi9yZW5hbWUuZC50cyIsIi4uL3NyYy9hcGkvcmVuYW1lLmQudHMiLCIuLi9zcmMvZGVmL3VuaXZlcnNhbGl6ZS5kLnRzIiwiLi4vc3JjL2FwaS91bml2ZXJzYWxpemUuZC50cyIsIi4uL3NyYy9kZWYvdmVyc2lvbi5kLnRzIiwiLi4vc3JjL2FwaS92ZXJzaW9uLmQudHMiLCIuLi9zcmMvY29tbWFuZHMvYXJ0aWZhY3RzLmQudHMiLCIuLi9zcmMvY29tbWFuZHMvYnVpbGQuZC50cyIsIi4uL3NyYy9jb21tYW5kcy9jcmVhdGUtbnBtLWRpcnMuZC50cyIsIi4uL3NyYy9jb21tYW5kcy9uZXcuZC50cyIsIi4uL3NyYy9jb21tYW5kcy9wcmUtcHVibGlzaC5kLnRzIiwiLi4vc3JjL2NvbW1hbmRzL3JlbmFtZS5kLnRzIiwiLi4vc3JjL2NvbW1hbmRzL3VuaXZlcnNhbGl6ZS5kLnRzIiwiLi4vc3JjL2NvbW1hbmRzL3ZlcnNpb24uZC50cyIsIi4uL3NyYy91dGlscy90YXJnZXQuZC50cyIsIi4uL3NyYy91dGlscy9jb25maWcuZC50cyIsIi4uL3NyYy9pbmRleC5kLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbW1hbmQgfSBmcm9tICdjbGlwYW5pb24nO1xuZXhwb3J0IGRlY2xhcmUgYWJzdHJhY3QgY2xhc3MgQmFzZUFydGlmYWN0c0NvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcbiAgICBzdGF0aWMgcGF0aHM6IHN0cmluZ1tdW107XG4gICAgc3RhdGljIHVzYWdlOiBpbXBvcnQoXCJjbGlwYW5pb25cIikuVXNhZ2U7XG4gICAgY3dkOiBzdHJpbmc7XG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICBwYWNrYWdlSnNvblBhdGg6IHN0cmluZztcbiAgICBvdXRwdXREaXI6IHN0cmluZztcbiAgICBucG1EaXI6IHN0cmluZztcbiAgICBidWlsZE91dHB1dERpcj86IHN0cmluZztcbiAgICBnZXRPcHRpb25zKCk6IHtcbiAgICAgICAgY3dkOiBzdHJpbmc7XG4gICAgICAgIGNvbmZpZ1BhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgICAgIG91dHB1dERpcjogc3RyaW5nO1xuICAgICAgICBucG1EaXI6IHN0cmluZztcbiAgICAgICAgYnVpbGRPdXRwdXREaXI6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICB9O1xufVxuLyoqXG4gKiBDb3B5IGFydGlmYWN0cyBmcm9tIEdpdGh1YiBBY3Rpb25zIGludG8gbnBtIHBhY2thZ2VzIGFuZCByZWFkeSB0byBwdWJsaXNoXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXJ0aWZhY3RzT3B0aW9ucyB7XG4gICAgLyoqXG4gICAgICogVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCBwcm9jZXNzLmN3ZCgpXG4gICAgICovXG4gICAgY3dkPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICAgKi9cbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYHBhY2thZ2UuanNvbmBcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICdwYWNrYWdlLmpzb24nXG4gICAgICovXG4gICAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gdGhlIGZvbGRlciB3aGVyZSBhbGwgYnVpbHQgYC5ub2RlYCBmaWxlcyBwdXQsIHNhbWUgYXMgYC0tb3V0cHV0LWRpcmAgb2YgYnVpbGQgY29tbWFuZFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgJy4vYXJ0aWZhY3RzJ1xuICAgICAqL1xuICAgIG91dHB1dERpcj86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgdGhlIG5wbSBwYWNrYWdlcyBwdXRcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICducG0nXG4gICAgICovXG4gICAgbnBtRGlyPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gdGhlIGJ1aWxkIG91dHB1dCBkaXIsIG9ubHkgbmVlZGVkIHdoZW4gdGFyZ2V0cyBjb250YWlucyBgd2FzbTMyLXdhc2ktKmBcbiAgICAgKi9cbiAgICBidWlsZE91dHB1dERpcj86IHN0cmluZztcbn1cbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGFwcGx5RGVmYXVsdEFydGlmYWN0c09wdGlvbnMob3B0aW9uczogQXJ0aWZhY3RzT3B0aW9ucyk6IHtcbiAgICBjd2Q6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAgICovXG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICBwYWNrYWdlSnNvblBhdGg6IHN0cmluZztcbiAgICBvdXRwdXREaXI6IHN0cmluZztcbiAgICBucG1EaXI6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIHRoZSBidWlsZCBvdXRwdXQgZGlyLCBvbmx5IG5lZWRlZCB3aGVuIHRhcmdldHMgY29udGFpbnMgYHdhc20zMi13YXNpLSpgXG4gICAgICovXG4gICAgYnVpbGRPdXRwdXREaXI/OiBzdHJpbmc7XG59O1xuIiwiaW1wb3J0IHsgdHlwZSBBcnRpZmFjdHNPcHRpb25zIH0gZnJvbSAnLi4vZGVmL2FydGlmYWN0cy5qcyc7XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBjb2xsZWN0QXJ0aWZhY3RzKHVzZXJPcHRpb25zOiBBcnRpZmFjdHNPcHRpb25zKTogUHJvbWlzZTx2b2lkPjtcbiIsImltcG9ydCB7IENvbW1hbmQgfSBmcm9tICdjbGlwYW5pb24nO1xuZXhwb3J0IGRlY2xhcmUgYWJzdHJhY3QgY2xhc3MgQmFzZUJ1aWxkQ29tbWFuZCBleHRlbmRzIENvbW1hbmQge1xuICAgIHN0YXRpYyBwYXRoczogc3RyaW5nW11bXTtcbiAgICBzdGF0aWMgdXNhZ2U6IGltcG9ydChcImNsaXBhbmlvblwiKS5Vc2FnZTtcbiAgICB0YXJnZXQ/OiBzdHJpbmc7XG4gICAgY3dkPzogc3RyaW5nO1xuICAgIG1hbmlmZXN0UGF0aD86IHN0cmluZztcbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZztcbiAgICB0YXJnZXREaXI/OiBzdHJpbmc7XG4gICAgb3V0cHV0RGlyPzogc3RyaW5nO1xuICAgIHBsYXRmb3JtPzogYm9vbGVhbjtcbiAgICBqc1BhY2thZ2VOYW1lPzogc3RyaW5nO1xuICAgIGNvbnN0RW51bT86IGJvb2xlYW47XG4gICAgcnVudGltZVN0cmluZ0VudW0/OiBib29sZWFuO1xuICAgIGpzQmluZGluZz86IHN0cmluZztcbiAgICBub0pzQmluZGluZz86IGJvb2xlYW47XG4gICAgZHRzPzogc3RyaW5nO1xuICAgIGR0c0hlYWRlcj86IHN0cmluZztcbiAgICBub0R0c0hlYWRlcj86IGJvb2xlYW47XG4gICAgZHRzQ2FjaGU6IGJvb2xlYW47XG4gICAgZXNtPzogYm9vbGVhbjtcbiAgICBzdHJpcD86IGJvb2xlYW47XG4gICAgcmVsZWFzZT86IGJvb2xlYW47XG4gICAgdmVyYm9zZT86IGJvb2xlYW47XG4gICAgYmluPzogc3RyaW5nO1xuICAgIHBhY2thZ2U/OiBzdHJpbmc7XG4gICAgcHJvZmlsZT86IHN0cmluZztcbiAgICBjcm9zc0NvbXBpbGU/OiBib29sZWFuO1xuICAgIHVzZUNyb3NzPzogYm9vbGVhbjtcbiAgICB1c2VOYXBpQ3Jvc3M/OiBib29sZWFuO1xuICAgIHdhdGNoPzogYm9vbGVhbjtcbiAgICBmZWF0dXJlcz86IHN0cmluZ1tdO1xuICAgIGFsbEZlYXR1cmVzPzogYm9vbGVhbjtcbiAgICBub0RlZmF1bHRGZWF0dXJlcz86IGJvb2xlYW47XG4gICAgZ2V0T3B0aW9ucygpOiB7XG4gICAgICAgIHRhcmdldDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBjd2Q6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgbWFuaWZlc3RQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGNvbmZpZ1BhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIHRhcmdldERpcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBvdXRwdXREaXI6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgcGxhdGZvcm06IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gICAgICAgIGpzUGFja2FnZU5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3RFbnVtOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICBydW50aW1lU3RyaW5nRW51bTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgICAgICAganNCaW5kaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIG5vSnNCaW5kaW5nOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICBkdHM6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgZHRzSGVhZGVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIG5vRHRzSGVhZGVyOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICBkdHNDYWNoZTogYm9vbGVhbjtcbiAgICAgICAgZXNtOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICBzdHJpcDogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgICAgICAgcmVsZWFzZTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgICAgICAgdmVyYm9zZTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgICAgICAgYmluOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIHBhY2thZ2U6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgcHJvZmlsZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBjcm9zc0NvbXBpbGU6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gICAgICAgIHVzZUNyb3NzOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICB1c2VOYXBpQ3Jvc3M6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gICAgICAgIHdhdGNoOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICBmZWF0dXJlczogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG4gICAgICAgIGFsbEZlYXR1cmVzOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICBub0RlZmF1bHRGZWF0dXJlczogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgICB9O1xufVxuLyoqXG4gKiBCdWlsZCB0aGUgTkFQSS1SUyBwcm9qZWN0XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRPcHRpb25zIHtcbiAgICAvKipcbiAgICAgKiBCdWlsZCBmb3IgdGhlIHRhcmdldCB0cmlwbGUsIGJ5cGFzc2VkIHRvIGBjYXJnbyBidWlsZCAtLXRhcmdldGBcbiAgICAgKi9cbiAgICB0YXJnZXQ/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoXG4gICAgICovXG4gICAgY3dkPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYENhcmdvLnRvbWxgXG4gICAgICovXG4gICAgbWFuaWZlc3RQYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICAgKi9cbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYHBhY2thZ2UuanNvbmBcbiAgICAgKi9cbiAgICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogRGlyZWN0b3J5IGZvciBhbGwgY3JhdGUgZ2VuZXJhdGVkIGFydGlmYWN0cywgc2VlIGBjYXJnbyBidWlsZCAtLXRhcmdldC1kaXJgXG4gICAgICovXG4gICAgdGFyZ2V0RGlyPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gd2hlcmUgYWxsIHRoZSBidWlsdCBmaWxlcyB3b3VsZCBiZSBwdXQuIERlZmF1bHQgdG8gdGhlIGNyYXRlIGZvbGRlclxuICAgICAqL1xuICAgIG91dHB1dERpcj86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBBZGQgcGxhdGZvcm0gdHJpcGxlIHRvIHRoZSBnZW5lcmF0ZWQgbm9kZWpzIGJpbmRpbmcgZmlsZSwgZWc6IGBbbmFtZV0ubGludXgteDY0LWdudS5ub2RlYFxuICAgICAqL1xuICAgIHBsYXRmb3JtPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBQYWNrYWdlIG5hbWUgaW4gZ2VuZXJhdGVkIGpzIGJpbmRpbmcgZmlsZS4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnXG4gICAgICovXG4gICAganNQYWNrYWdlTmFtZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIGdlbmVyYXRlIGNvbnN0IGVudW0gZm9yIHR5cGVzY3JpcHQgYmluZGluZ3NcbiAgICAgKi9cbiAgICBjb25zdEVudW0/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIEVtaXQgYCNbbmFwaShzdHJpbmdfZW51bSldYCBlbnVtcyBhcyBydW50aW1lIGVudW1zIChgZXhwb3J0IGRlY2xhcmUgZW51bWApIHVuZGVyIGAtLW5vLWNvbnN0LWVudW1gLiBEZWZhdWx0OiB0eXBlLW9ubHkgdW5pb24uXG4gICAgICovXG4gICAgcnVudGltZVN0cmluZ0VudW0/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFBhdGggYW5kIGZpbGVuYW1lIG9mIGdlbmVyYXRlZCBKUyBiaW5kaW5nIGZpbGUuIE9ubHkgd29ya3Mgd2l0aCBgLS1wbGF0Zm9ybWAgZmxhZy4gUmVsYXRpdmUgdG8gYC0tb3V0cHV0LWRpcmAuXG4gICAgICovXG4gICAganNCaW5kaW5nPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdG8gZGlzYWJsZSB0aGUgZ2VuZXJhdGlvbiBKUyBiaW5kaW5nIGZpbGUuIE9ubHkgd29ya3Mgd2l0aCBgLS1wbGF0Zm9ybWAgZmxhZy5cbiAgICAgKi9cbiAgICBub0pzQmluZGluZz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogUGF0aCBhbmQgZmlsZW5hbWUgb2YgZ2VuZXJhdGVkIHR5cGUgZGVmIGZpbGUuIFJlbGF0aXZlIHRvIGAtLW91dHB1dC1kaXJgXG4gICAgICovXG4gICAgZHRzPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEN1c3RvbSBmaWxlIGhlYWRlciBmb3IgZ2VuZXJhdGVkIHR5cGUgZGVmIGZpbGUuIE9ubHkgd29ya3Mgd2hlbiBgdHlwZWRlZmAgZmVhdHVyZSBlbmFibGVkLlxuICAgICAqL1xuICAgIGR0c0hlYWRlcj86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRvIGRpc2FibGUgdGhlIGRlZmF1bHQgZmlsZSBoZWFkZXIgZm9yIGdlbmVyYXRlZCB0eXBlIGRlZiBmaWxlLiBPbmx5IHdvcmtzIHdoZW4gYHR5cGVkZWZgIGZlYXR1cmUgZW5hYmxlZC5cbiAgICAgKi9cbiAgICBub0R0c0hlYWRlcj86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogV2hldGhlciB0byBlbmFibGUgdGhlIGR0cyBjYWNoZSwgZGVmYXVsdCB0byB0cnVlXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCB0cnVlXG4gICAgICovXG4gICAgZHRzQ2FjaGU/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdG8gZW1pdCBhbiBFU00gSlMgYmluZGluZyBmaWxlIGluc3RlYWQgb2YgQ0pTIGZvcm1hdC4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnLlxuICAgICAqL1xuICAgIGVzbT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogV2hldGhlciBzdHJpcCB0aGUgbGlicmFyeSB0byBhY2hpZXZlIHRoZSBtaW5pbXVtIGZpbGUgc2l6ZVxuICAgICAqL1xuICAgIHN0cmlwPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBCdWlsZCBpbiByZWxlYXNlIG1vZGVcbiAgICAgKi9cbiAgICByZWxlYXNlPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBWZXJib3NlbHkgbG9nIGJ1aWxkIGNvbW1hbmQgdHJhY2VcbiAgICAgKi9cbiAgICB2ZXJib3NlPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBCdWlsZCBvbmx5IHRoZSBzcGVjaWZpZWQgYmluYXJ5XG4gICAgICovXG4gICAgYmluPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEJ1aWxkIHRoZSBzcGVjaWZpZWQgbGlicmFyeSBvciB0aGUgb25lIGF0IGN3ZFxuICAgICAqL1xuICAgIHBhY2thZ2U/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogQnVpbGQgYXJ0aWZhY3RzIHdpdGggdGhlIHNwZWNpZmllZCBwcm9maWxlXG4gICAgICovXG4gICAgcHJvZmlsZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBbZXhwZXJpbWVudGFsXSBjcm9zcyBjb21waWxlIGJ5IHJlcGxhY2luZyB0aGUgY2FyZ28gc3ViY29tbWFuZDogV2luZG93cyBNU1ZDIHRhcmdldHMgZnJvbSBhIG5vbi1XaW5kb3dzIGhvc3QgYnVpbGQgd2l0aCBgY2FyZ28teHdpbmAgKGB3aW5kb3dzLWdudWAgdGFyZ2V0cyBhcmUgcmVqZWN0ZWQsIGBjYXJnby14d2luYCBjYW5ub3QgaGFuZGxlIHRoZW0pLCBub24tV2luZG93cyB0YXJnZXRzIGJ1aWxkIHdpdGggYGNhcmdvLXppZ2J1aWxkYCAocmVxdWlyZXMgYHppZ2Agb24gUEFUSCkuIFRoZSBzZWxlY3RlZCBzdWJjb21tYW5kIGlzIGF1dG8taW5zdGFsbGVkIG9uIGZpcnN0IHVzZS4gQ2Fubm90IGJlIGNvbWJpbmVkIHdpdGggYC0tdXNlLWNyb3NzYCwgYC0tdXNlLW5hcGktY3Jvc3NgIG9yIGAtLXdhdGNoYFxuICAgICAqL1xuICAgIGNyb3NzQ29tcGlsZT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogW2V4cGVyaW1lbnRhbF0gbm90IHJlY29tbWVuZGVkLCBwcmVmZXIgYC0tY3Jvc3MtY29tcGlsZWAgb3IgYC0tdXNlLW5hcGktY3Jvc3NgOiBidWlsZCBpbiBhIERvY2tlciBvciBQb2RtYW4gY29udGFpbmVyIHdpdGggW2Nyb3NzXShodHRwczovL2dpdGh1Yi5jb20vY3Jvc3MtcnMvY3Jvc3MpLCB3aGljaCBtdXN0IGJlIGluc3RhbGxlZCBtYW51YWxseSBhbmQgbmVlZHMgYSBydW5uaW5nIGNvbnRhaW5lciBlbmdpbmUuIENhbm5vdCBiZSBjb21iaW5lZCB3aXRoIGAtLWNyb3NzLWNvbXBpbGVgLCBgLS11c2UtbmFwaS1jcm9zc2Agb3IgYC0td2F0Y2hgXG4gICAgICovXG4gICAgdXNlQ3Jvc3M/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFtleHBlcmltZW50YWxdIGRvd25sb2FkIGEgcHJlYnVpbHQgZ2NjIGNyb3NzIHRvb2xjaGFpbiBmcm9tIGBAbmFwaS1ycy9jcm9zcy10b29sY2hhaW5gIChnbGliYyAyLjE3KSBhbmQgc2V0IGxpbmtlciBhbmQgQyBjb21waWxlciBlbnZpcm9ubWVudCB2YXJpYWJsZXMuIExpbnV4IGdsaWJjIHRhcmdldHMgb25seSAoeDY0LCBhcm02NCwgYXJtdjcsIHBwYzY0bGUsIHMzOTB4KSBvbiBhIExpbnV4IHg2NCBvciBhcm02NCBob3N0LCBhbnkgb3RoZXIgdGFyZ2V0IG9yIGhvc3QgZXJyb3JzLiBDYW5ub3QgYmUgY29tYmluZWQgd2l0aCBgLS1jcm9zcy1jb21waWxlYCBvciBgLS11c2UtY3Jvc3NgXG4gICAgICovXG4gICAgdXNlTmFwaUNyb3NzPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiB3YXRjaCB0aGUgY3JhdGUgY2hhbmdlcyBhbmQgYnVpbGQgY29udGludW91c2x5IHdpdGggYGNhcmdvLXdhdGNoYCBjcmF0ZXNcbiAgICAgKi9cbiAgICB3YXRjaD86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogU3BhY2Utc2VwYXJhdGVkIGxpc3Qgb2YgZmVhdHVyZXMgdG8gYWN0aXZhdGVcbiAgICAgKi9cbiAgICBmZWF0dXJlcz86IHN0cmluZ1tdO1xuICAgIC8qKlxuICAgICAqIEFjdGl2YXRlIGFsbCBhdmFpbGFibGUgZmVhdHVyZXNcbiAgICAgKi9cbiAgICBhbGxGZWF0dXJlcz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogRG8gbm90IGFjdGl2YXRlIHRoZSBgZGVmYXVsdGAgZmVhdHVyZVxuICAgICAqL1xuICAgIG5vRGVmYXVsdEZlYXR1cmVzPzogYm9vbGVhbjtcbn1cbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGFwcGx5RGVmYXVsdEJ1aWxkT3B0aW9ucyhvcHRpb25zOiBCdWlsZE9wdGlvbnMpOiB7XG4gICAgLyoqXG4gICAgICogQnVpbGQgZm9yIHRoZSB0YXJnZXQgdHJpcGxlLCBieXBhc3NlZCB0byBgY2FyZ28gYnVpbGQgLS10YXJnZXRgXG4gICAgICovXG4gICAgdGFyZ2V0Pzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFRoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aFxuICAgICAqL1xuICAgIGN3ZD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBDYXJnby50b21sYFxuICAgICAqL1xuICAgIG1hbmlmZXN0UGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAgICovXG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBwYWNrYWdlLmpzb25gXG4gICAgICovXG4gICAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIERpcmVjdG9yeSBmb3IgYWxsIGNyYXRlIGdlbmVyYXRlZCBhcnRpZmFjdHMsIHNlZSBgY2FyZ28gYnVpbGQgLS10YXJnZXQtZGlyYFxuICAgICAqL1xuICAgIHRhcmdldERpcj86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIHdoZXJlIGFsbCB0aGUgYnVpbHQgZmlsZXMgd291bGQgYmUgcHV0LiBEZWZhdWx0IHRvIHRoZSBjcmF0ZSBmb2xkZXJcbiAgICAgKi9cbiAgICBvdXRwdXREaXI/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogQWRkIHBsYXRmb3JtIHRyaXBsZSB0byB0aGUgZ2VuZXJhdGVkIG5vZGVqcyBiaW5kaW5nIGZpbGUsIGVnOiBgW25hbWVdLmxpbnV4LXg2NC1nbnUubm9kZWBcbiAgICAgKi9cbiAgICBwbGF0Zm9ybT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogUGFja2FnZSBuYW1lIGluIGdlbmVyYXRlZCBqcyBiaW5kaW5nIGZpbGUuIE9ubHkgd29ya3Mgd2l0aCBgLS1wbGF0Zm9ybWAgZmxhZ1xuICAgICAqL1xuICAgIGpzUGFja2FnZU5hbWU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogV2hldGhlciBnZW5lcmF0ZSBjb25zdCBlbnVtIGZvciB0eXBlc2NyaXB0IGJpbmRpbmdzXG4gICAgICovXG4gICAgY29uc3RFbnVtPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBFbWl0IGAjW25hcGkoc3RyaW5nX2VudW0pXWAgZW51bXMgYXMgcnVudGltZSBlbnVtcyAoYGV4cG9ydCBkZWNsYXJlIGVudW1gKSB1bmRlciBgLS1uby1jb25zdC1lbnVtYC4gRGVmYXVsdDogdHlwZS1vbmx5IHVuaW9uLlxuICAgICAqL1xuICAgIHJ1bnRpbWVTdHJpbmdFbnVtPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBQYXRoIGFuZCBmaWxlbmFtZSBvZiBnZW5lcmF0ZWQgSlMgYmluZGluZyBmaWxlLiBPbmx5IHdvcmtzIHdpdGggYC0tcGxhdGZvcm1gIGZsYWcuIFJlbGF0aXZlIHRvIGAtLW91dHB1dC1kaXJgLlxuICAgICAqL1xuICAgIGpzQmluZGluZz86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRvIGRpc2FibGUgdGhlIGdlbmVyYXRpb24gSlMgYmluZGluZyBmaWxlLiBPbmx5IHdvcmtzIHdpdGggYC0tcGxhdGZvcm1gIGZsYWcuXG4gICAgICovXG4gICAgbm9Kc0JpbmRpbmc/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFBhdGggYW5kIGZpbGVuYW1lIG9mIGdlbmVyYXRlZCB0eXBlIGRlZiBmaWxlLiBSZWxhdGl2ZSB0byBgLS1vdXRwdXQtZGlyYFxuICAgICAqL1xuICAgIGR0cz86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBDdXN0b20gZmlsZSBoZWFkZXIgZm9yIGdlbmVyYXRlZCB0eXBlIGRlZiBmaWxlLiBPbmx5IHdvcmtzIHdoZW4gYHR5cGVkZWZgIGZlYXR1cmUgZW5hYmxlZC5cbiAgICAgKi9cbiAgICBkdHNIZWFkZXI/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogV2hldGhlciB0byBkaXNhYmxlIHRoZSBkZWZhdWx0IGZpbGUgaGVhZGVyIGZvciBnZW5lcmF0ZWQgdHlwZSBkZWYgZmlsZS4gT25seSB3b3JrcyB3aGVuIGB0eXBlZGVmYCBmZWF0dXJlIGVuYWJsZWQuXG4gICAgICovXG4gICAgbm9EdHNIZWFkZXI/OiBib29sZWFuO1xuICAgIGR0c0NhY2hlOiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdG8gZW1pdCBhbiBFU00gSlMgYmluZGluZyBmaWxlIGluc3RlYWQgb2YgQ0pTIGZvcm1hdC4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnLlxuICAgICAqL1xuICAgIGVzbT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogV2hldGhlciBzdHJpcCB0aGUgbGlicmFyeSB0byBhY2hpZXZlIHRoZSBtaW5pbXVtIGZpbGUgc2l6ZVxuICAgICAqL1xuICAgIHN0cmlwPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBCdWlsZCBpbiByZWxlYXNlIG1vZGVcbiAgICAgKi9cbiAgICByZWxlYXNlPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBWZXJib3NlbHkgbG9nIGJ1aWxkIGNvbW1hbmQgdHJhY2VcbiAgICAgKi9cbiAgICB2ZXJib3NlPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBCdWlsZCBvbmx5IHRoZSBzcGVjaWZpZWQgYmluYXJ5XG4gICAgICovXG4gICAgYmluPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEJ1aWxkIHRoZSBzcGVjaWZpZWQgbGlicmFyeSBvciB0aGUgb25lIGF0IGN3ZFxuICAgICAqL1xuICAgIHBhY2thZ2U/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogQnVpbGQgYXJ0aWZhY3RzIHdpdGggdGhlIHNwZWNpZmllZCBwcm9maWxlXG4gICAgICovXG4gICAgcHJvZmlsZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBbZXhwZXJpbWVudGFsXSBjcm9zcyBjb21waWxlIGJ5IHJlcGxhY2luZyB0aGUgY2FyZ28gc3ViY29tbWFuZDogV2luZG93cyBNU1ZDIHRhcmdldHMgZnJvbSBhIG5vbi1XaW5kb3dzIGhvc3QgYnVpbGQgd2l0aCBgY2FyZ28teHdpbmAgKGB3aW5kb3dzLWdudWAgdGFyZ2V0cyBhcmUgcmVqZWN0ZWQsIGBjYXJnby14d2luYCBjYW5ub3QgaGFuZGxlIHRoZW0pLCBub24tV2luZG93cyB0YXJnZXRzIGJ1aWxkIHdpdGggYGNhcmdvLXppZ2J1aWxkYCAocmVxdWlyZXMgYHppZ2Agb24gUEFUSCkuIFRoZSBzZWxlY3RlZCBzdWJjb21tYW5kIGlzIGF1dG8taW5zdGFsbGVkIG9uIGZpcnN0IHVzZS4gQ2Fubm90IGJlIGNvbWJpbmVkIHdpdGggYC0tdXNlLWNyb3NzYCwgYC0tdXNlLW5hcGktY3Jvc3NgIG9yIGAtLXdhdGNoYFxuICAgICAqL1xuICAgIGNyb3NzQ29tcGlsZT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogW2V4cGVyaW1lbnRhbF0gbm90IHJlY29tbWVuZGVkLCBwcmVmZXIgYC0tY3Jvc3MtY29tcGlsZWAgb3IgYC0tdXNlLW5hcGktY3Jvc3NgOiBidWlsZCBpbiBhIERvY2tlciBvciBQb2RtYW4gY29udGFpbmVyIHdpdGggW2Nyb3NzXShodHRwczovL2dpdGh1Yi5jb20vY3Jvc3MtcnMvY3Jvc3MpLCB3aGljaCBtdXN0IGJlIGluc3RhbGxlZCBtYW51YWxseSBhbmQgbmVlZHMgYSBydW5uaW5nIGNvbnRhaW5lciBlbmdpbmUuIENhbm5vdCBiZSBjb21iaW5lZCB3aXRoIGAtLWNyb3NzLWNvbXBpbGVgLCBgLS11c2UtbmFwaS1jcm9zc2Agb3IgYC0td2F0Y2hgXG4gICAgICovXG4gICAgdXNlQ3Jvc3M/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFtleHBlcmltZW50YWxdIGRvd25sb2FkIGEgcHJlYnVpbHQgZ2NjIGNyb3NzIHRvb2xjaGFpbiBmcm9tIGBAbmFwaS1ycy9jcm9zcy10b29sY2hhaW5gIChnbGliYyAyLjE3KSBhbmQgc2V0IGxpbmtlciBhbmQgQyBjb21waWxlciBlbnZpcm9ubWVudCB2YXJpYWJsZXMuIExpbnV4IGdsaWJjIHRhcmdldHMgb25seSAoeDY0LCBhcm02NCwgYXJtdjcsIHBwYzY0bGUsIHMzOTB4KSBvbiBhIExpbnV4IHg2NCBvciBhcm02NCBob3N0LCBhbnkgb3RoZXIgdGFyZ2V0IG9yIGhvc3QgZXJyb3JzLiBDYW5ub3QgYmUgY29tYmluZWQgd2l0aCBgLS1jcm9zcy1jb21waWxlYCBvciBgLS11c2UtY3Jvc3NgXG4gICAgICovXG4gICAgdXNlTmFwaUNyb3NzPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiB3YXRjaCB0aGUgY3JhdGUgY2hhbmdlcyBhbmQgYnVpbGQgY29udGludW91c2x5IHdpdGggYGNhcmdvLXdhdGNoYCBjcmF0ZXNcbiAgICAgKi9cbiAgICB3YXRjaD86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogU3BhY2Utc2VwYXJhdGVkIGxpc3Qgb2YgZmVhdHVyZXMgdG8gYWN0aXZhdGVcbiAgICAgKi9cbiAgICBmZWF0dXJlcz86IHN0cmluZ1tdO1xuICAgIC8qKlxuICAgICAqIEFjdGl2YXRlIGFsbCBhdmFpbGFibGUgZmVhdHVyZXNcbiAgICAgKi9cbiAgICBhbGxGZWF0dXJlcz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogRG8gbm90IGFjdGl2YXRlIHRoZSBgZGVmYXVsdGAgZmVhdHVyZVxuICAgICAqL1xuICAgIG5vRGVmYXVsdEZlYXR1cmVzPzogYm9vbGVhbjtcbn07XG4iLCJpbXBvcnQgdHlwZSB7IEJ1aWxkT3B0aW9ucyBhcyBSYXdCdWlsZE9wdGlvbnMgfSBmcm9tICcuLi9kZWYvYnVpbGQuanMnO1xudHlwZSBPdXRwdXRLaW5kID0gJ2pzJyB8ICdkdHMnIHwgJ25vZGUnIHwgJ2V4ZScgfCAnd2FzbSc7XG50eXBlIE91dHB1dCA9IHtcbiAgICBraW5kOiBPdXRwdXRLaW5kO1xuICAgIHBhdGg6IHN0cmluZztcbn07XG50eXBlIEJ1aWxkT3B0aW9ucyA9IFJhd0J1aWxkT3B0aW9ucyAmIHtcbiAgICBjYXJnb09wdGlvbnM/OiBzdHJpbmdbXTtcbn07XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBidWlsZFByb2plY3QocmF3T3B0aW9uczogQnVpbGRPcHRpb25zKTogUHJvbWlzZTx7XG4gICAgdGFzazogUHJvbWlzZTxPdXRwdXRbXT47XG4gICAgYWJvcnQ6ICgpID0+IHZvaWQ7XG59Pjtcbi8qKlxuICogVmFsaWRhdGUgdGhlIGNvbWJpbmF0aW9uIG9mIHRoZSBjcm9zcy1jb21waWxhdGlvbiByZWxhdGVkIGZsYWdzLlxuICpcbiAqIGAtLXVzZS1jcm9zc2AsIGAtLXVzZS1uYXBpLWNyb3NzYCBhbmQgYC0tY3Jvc3MtY29tcGlsZWAgKGAteGApIGFyZSB0aHJlZVxuICogbXV0dWFsbHkgZXhjbHVzaXZlIGNyb3NzLWNvbXBpbGF0aW9uIG1lY2hhbmlzbXM7IGNvbWJpbmluZyBhbnkgdHdvIG9mIHRoZW1cbiAqIGxlYXZlcyBib3RoIGFjdGl2ZSBhdCBvbmNlIGFuZCBwcm9kdWNlcyBicm9rZW4gYnVpbGRzLCBzbyBpdCBpcyByZWplY3RlZFxuICogdXBmcm9udCBiZWZvcmUgYW55IHNpZGUgZWZmZWN0IChsaWtlIGF1dG8taW5zdGFsbGluZyBjYXJnbyBiaW5hcmllcyBvclxuICogZG93bmxvYWRpbmcgdG9vbGNoYWlucykgaGFwcGVucy5cbiAqXG4gKiBgLS1jcm9zcy1jb21waWxlYCB3aXRoIGEgYHdpbmRvd3MtZ251YCB0YXJnZXQgaXMgcmVqZWN0ZWQgYXMgd2VsbDogb24gYVxuICogbm9uLVdpbmRvd3MgaG9zdCBpdCByb3V0ZXMgdGhlIGJ1aWxkIHRvIGBjYXJnbyB4d2luIGJ1aWxkYCwgYnV0XG4gKiBgY2FyZ28teHdpbmAgb25seSBzZXRzIHVwIE1TVkMgdG9vbGNoYWlucyDigJQgZm9yIGB3aW5kb3dzLWdudWAgdGFyZ2V0cyBpdFxuICogc2lsZW50bHkgZG9lcyBub3RoaW5nIGFuZCB0aGUgYnVpbGQgZGllcyBtdWNoIGxhdGVyIHdpdGggYSBjcnlwdGljXG4gKiBgYGVycm9yOiBsaW5rZXIgYHg4Nl82NC13NjQtbWluZ3czMi1nY2NgIG5vdCBmb3VuZGBgIHRoYXQgbmV2ZXIgbWVudGlvbnNcbiAqIGBjYXJnby14d2luYC4gT25seSBhbiBleHBsaWNpdGx5IHJlcXVlc3RlZCB0YXJnZXQgKGAtLXRhcmdldGAgb3JcbiAqIGBDQVJHT19CVUlMRF9UQVJHRVRgKSBpcyBpbnNwZWN0ZWQsIHNvIHRoaXMgdmFsaWRhdGlvbiBuZXZlciBoYXMgdG8gc3Bhd25cbiAqIGBydXN0YyAtdlZgOyBhIG5vbi1XaW5kb3dzIGhvc3QncyBkZWZhdWx0IHRhcmdldCBjYW4gbmV2ZXIgYmVcbiAqIGB3aW5kb3dzLWdudWAgYW55d2F5LlxuICovXG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiB2YWxpZGF0ZUNyb3NzQ29tcGlsZUZsYWdzKG9wdGlvbnM6IHtcbiAgICB1c2VDcm9zcz86IGJvb2xlYW47XG4gICAgY3Jvc3NDb21waWxlPzogYm9vbGVhbjtcbiAgICB1c2VOYXBpQ3Jvc3M/OiBib29sZWFuO1xuICAgIHdhdGNoPzogYm9vbGVhbjtcbiAgICB0YXJnZXQ/OiBzdHJpbmc7XG59LCBob3N0UGxhdGZvcm0/OiBzdHJpbmcpOiB2b2lkO1xuLyoqXG4gKiBWYWxpZGF0ZSB0aGF0IGAtLXVzZS1uYXBpLWNyb3NzYCBjYW4gYWN0dWFsbHkgaGFuZGxlIHRoZSByZXF1ZXN0ZWQgdGFyZ2V0XG4gKiBvbiB0aGUgY3VycmVudCBob3N0LiBUaGUgc3VwcG9ydGVkIHRhcmdldCBzZXQgaXMgcmVhZCBmcm9tIHRoZVxuICogYEBuYXBpLXJzL2Nyb3NzLXRvb2xjaGFpbmAgcGFja2FnZSwgYW5kIHRoZSBwcmUtYnVpbHQgdG9vbGNoYWlucyBvbmx5IHJ1blxuICogb24gTGludXggeDY0IGFuZCBMaW51eCBhcm02NCBob3N0cy5cbiAqL1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gdmFsaWRhdGVOYXBpQ3Jvc3NTdXBwb3J0KHRhcmdldFRyaXBsZTogc3RyaW5nLCBob3N0UGxhdGZvcm0/OiBzdHJpbmcsIGhvc3RBcmNoPzogc3RyaW5nKTogdm9pZDtcbi8qKlxuICogQ29tcHV0ZSB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGVzIHRoYXQgcm91dGUgYSBgLS11c2UtbmFwaS1jcm9zc2AgYnVpbGRcbiAqIHRocm91Z2ggdGhlIGBAbmFwaS1ycy9jcm9zcy10b29sY2hhaW5gIHRvb2xjaGFpbiBleHRyYWN0ZWQgYXRcbiAqIGB0b29sY2hhaW5QYXRoYC5cbiAqXG4gKiBGb2xsb3dzIHRoZSBzYW1lIHJ1bGUgYXMgYEJ1aWxkZXIjc2V0RW52SWZOb3RFeGlzdHNgOiBhIHZhcmlhYmxlIHRoZSB1c2VyXG4gKiBhbHJlYWR5IHNldCBpbiBgZW52YCB3aW5zIGFuZCBpcyBub3QgcmV0dXJuZWQsIGFuZCBhIHByZXNlbnQtYnV0LWVtcHR5XG4gKiB2YXJpYWJsZSBjb3VudHMgYXMgdW5zZXQgKGZhbHN5IHNlbWFudGljcykuIFRoZSBvbmx5IGV4Y2VwdGlvbnMgYXJlIHRoZVxuICogY2xhbmctc3BlY2lmaWMgYFRBUkdFVF9DRkxBR1NgL2BUQVJHRVRfQ1hYRkxBR1NgLCB3aGljaCBwcmVwZW5kIHRoZSBzeXNyb290XG4gKiBmbGFncyB0byB0aGUgdXNlcidzIHZhbHVlLCBhbmQgYFBBVEhgLCB3aGljaCBhbHdheXMgZ2V0cyB0aGUgdG9vbGNoYWluXG4gKiBgYmluYCBkaXJlY3RvcnkgcHJlcGVuZGVkLlxuICpcbiAqIEV4cG9ydGVkIGZvciB0ZXN0cy5cbiAqL1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gbmFwaUNyb3NzVG9vbGNoYWluRW52cyh0b29sY2hhaW5QYXRoOiBzdHJpbmcsIHRhcmdldFRyaXBsZTogc3RyaW5nLCBlbnY/OiBOb2RlSlMuUHJvY2Vzc0Vudik6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG5leHBvcnQgaW50ZXJmYWNlIFdyaXRlSnNCaW5kaW5nT3B0aW9ucyB7XG4gICAgcGxhdGZvcm0/OiBib29sZWFuO1xuICAgIG5vSnNCaW5kaW5nPzogYm9vbGVhbjtcbiAgICBpZGVudHM6IHN0cmluZ1tdO1xuICAgIGpzQmluZGluZz86IHN0cmluZztcbiAgICBlc20/OiBib29sZWFuO1xuICAgIGJpbmFyeU5hbWU6IHN0cmluZztcbiAgICBwYWNrYWdlTmFtZTogc3RyaW5nO1xuICAgIHZlcnNpb246IHN0cmluZztcbiAgICBvdXRwdXREaXI6IHN0cmluZztcbn1cbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIHdyaXRlSnNCaW5kaW5nKG9wdGlvbnM6IFdyaXRlSnNCaW5kaW5nT3B0aW9ucyk6IFByb21pc2U8T3V0cHV0IHwgdW5kZWZpbmVkPjtcbmV4cG9ydCBpbnRlcmZhY2UgR2VuZXJhdGVUeXBlRGVmT3B0aW9ucyB7XG4gICAgdHlwZURlZkRpcjogc3RyaW5nO1xuICAgIG5vRHRzSGVhZGVyPzogYm9vbGVhbjtcbiAgICBkdHNIZWFkZXI/OiBzdHJpbmc7XG4gICAgZHRzSGVhZGVyRmlsZT86IHN0cmluZztcbiAgICBjb25maWdEdHNIZWFkZXI/OiBzdHJpbmc7XG4gICAgY29uZmlnRHRzSGVhZGVyRmlsZT86IHN0cmluZztcbiAgICBjb25zdEVudW0/OiBib29sZWFuO1xuICAgIHJ1bnRpbWVTdHJpbmdFbnVtPzogYm9vbGVhbjtcbiAgICBjd2Q6IHN0cmluZztcbn1cbi8qKlxuICogV2FsayB0aGUgbmFwaS1kZXJpdmUgaW50ZXJtZWRpYXRlIHR5cGUtZGVmIGRpcmVjdG9yeSwgcmVuZGVyIGV2ZXJ5IGVudHJ5XG4gKiBpbnRvIFR5cGVTY3JpcHQgdmlhIHtAbGluayBwcm9jZXNzVHlwZURlZn0sIGFuZCByZXR1cm4gdGhlIGNvbmNhdGVuYXRlZFxuICogYC5kLnRzYCBzb3VyY2UgcGx1cyB0aGUgbGlzdCBvZiBpZGVudGlmaWVycyB0byByZS1leHBvcnQgZnJvbVxuICogYGluZGV4LmpzYC5cbiAqL1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gZ2VuZXJhdGVUeXBlRGVmKG9wdGlvbnM6IEdlbmVyYXRlVHlwZURlZk9wdGlvbnMpOiBQcm9taXNlPHtcbiAgICBleHBvcnRzOiBzdHJpbmdbXTtcbiAgICBkdHM6IHN0cmluZztcbn0+O1xuZXhwb3J0IHt9O1xuIiwiaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJ2NsaXBhbmlvbic7XG5leHBvcnQgZGVjbGFyZSBhYnN0cmFjdCBjbGFzcyBCYXNlQ3JlYXRlTnBtRGlyc0NvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcbiAgICBzdGF0aWMgcGF0aHM6IHN0cmluZ1tdW107XG4gICAgc3RhdGljIHVzYWdlOiBpbXBvcnQoXCJjbGlwYW5pb25cIikuVXNhZ2U7XG4gICAgY3dkOiBzdHJpbmc7XG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICBwYWNrYWdlSnNvblBhdGg6IHN0cmluZztcbiAgICBucG1EaXI6IHN0cmluZztcbiAgICBkcnlSdW46IGJvb2xlYW47XG4gICAgZ2V0T3B0aW9ucygpOiB7XG4gICAgICAgIGN3ZDogc3RyaW5nO1xuICAgICAgICBjb25maWdQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgICAgICBucG1EaXI6IHN0cmluZztcbiAgICAgICAgZHJ5UnVuOiBib29sZWFuO1xuICAgIH07XG59XG4vKipcbiAqIENyZWF0ZSBucG0gcGFja2FnZSBkaXJzIGZvciBkaWZmZXJlbnQgcGxhdGZvcm1zXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ3JlYXRlTnBtRGlyc09wdGlvbnMge1xuICAgIC8qKlxuICAgICAqIFRoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgcHJvY2Vzcy5jd2QoKVxuICAgICAqL1xuICAgIGN3ZD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAgICovXG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBwYWNrYWdlLmpzb25gXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAncGFja2FnZS5qc29uJ1xuICAgICAqL1xuICAgIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgdGhlIG5wbSBwYWNrYWdlcyBwdXRcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICducG0nXG4gICAgICovXG4gICAgbnBtRGlyPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIERyeSBydW4gd2l0aG91dCB0b3VjaGluZyBmaWxlIHN5c3RlbVxuICAgICAqXG4gICAgICogQGRlZmF1bHQgZmFsc2VcbiAgICAgKi9cbiAgICBkcnlSdW4/OiBib29sZWFuO1xufVxuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gYXBwbHlEZWZhdWx0Q3JlYXRlTnBtRGlyc09wdGlvbnMob3B0aW9uczogQ3JlYXRlTnBtRGlyc09wdGlvbnMpOiB7XG4gICAgY3dkOiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgICAqL1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgbnBtRGlyOiBzdHJpbmc7XG4gICAgZHJ5UnVuOiBib29sZWFuO1xufTtcbiIsImltcG9ydCB7IHR5cGUgQ3JlYXRlTnBtRGlyc09wdGlvbnMgfSBmcm9tICcuLi9kZWYvY3JlYXRlLW5wbS1kaXJzLmpzJztcbmV4cG9ydCBpbnRlcmZhY2UgUGFja2FnZU1ldGEge1xuICAgICdkaXN0LXRhZ3MnOiB7XG4gICAgICAgIFtpbmRleDogc3RyaW5nXTogc3RyaW5nO1xuICAgIH07XG59XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBjcmVhdGVOcG1EaXJzKHVzZXJPcHRpb25zOiBDcmVhdGVOcG1EaXJzT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG4iLCJpbXBvcnQgeyBDb21tYW5kIH0gZnJvbSAnY2xpcGFuaW9uJztcbmV4cG9ydCBkZWNsYXJlIGFic3RyYWN0IGNsYXNzIEJhc2VOZXdDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gICAgc3RhdGljIHBhdGhzOiBzdHJpbmdbXVtdO1xuICAgIHN0YXRpYyB1c2FnZTogaW1wb3J0KFwiY2xpcGFuaW9uXCIpLlVzYWdlO1xuICAgICQkcGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICQkbmFtZT86IHN0cmluZztcbiAgICBtaW5Ob2RlQXBpVmVyc2lvbjogbnVtYmVyO1xuICAgIHBhY2thZ2VNYW5hZ2VyOiBzdHJpbmc7XG4gICAgbGljZW5zZTogc3RyaW5nO1xuICAgIHRhcmdldHM6IHN0cmluZ1tdO1xuICAgIGVuYWJsZURlZmF1bHRUYXJnZXRzOiBib29sZWFuO1xuICAgIGVuYWJsZUFsbFRhcmdldHM6IGJvb2xlYW47XG4gICAgZW5hYmxlVHlwZURlZjogYm9vbGVhbjtcbiAgICBlbmFibGVHaXRodWJBY3Rpb25zOiBib29sZWFuO1xuICAgIHRlc3RGcmFtZXdvcms6IHN0cmluZztcbiAgICBkcnlSdW46IGJvb2xlYW47XG4gICAgZ2V0T3B0aW9ucygpOiB7XG4gICAgICAgIHBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgbmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBtaW5Ob2RlQXBpVmVyc2lvbjogbnVtYmVyO1xuICAgICAgICBwYWNrYWdlTWFuYWdlcjogc3RyaW5nO1xuICAgICAgICBsaWNlbnNlOiBzdHJpbmc7XG4gICAgICAgIHRhcmdldHM6IHN0cmluZ1tdO1xuICAgICAgICBlbmFibGVEZWZhdWx0VGFyZ2V0czogYm9vbGVhbjtcbiAgICAgICAgZW5hYmxlQWxsVGFyZ2V0czogYm9vbGVhbjtcbiAgICAgICAgZW5hYmxlVHlwZURlZjogYm9vbGVhbjtcbiAgICAgICAgZW5hYmxlR2l0aHViQWN0aW9uczogYm9vbGVhbjtcbiAgICAgICAgdGVzdEZyYW1ld29yazogc3RyaW5nO1xuICAgICAgICBkcnlSdW46IGJvb2xlYW47XG4gICAgfTtcbn1cbi8qKlxuICogQ3JlYXRlIGEgbmV3IHByb2plY3Qgd2l0aCBwcmUtY29uZmlndXJlZCBib2lsZXJwbGF0ZVxuICovXG5leHBvcnQgaW50ZXJmYWNlIE5ld09wdGlvbnMge1xuICAgIC8qKlxuICAgICAqIFRoZSBwYXRoIHdoZXJlIHRoZSBOQVBJLVJTIHByb2plY3Qgd2lsbCBiZSBjcmVhdGVkLlxuICAgICAqL1xuICAgIHBhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIHByb2plY3QsIGRlZmF1bHQgdG8gdGhlIG5hbWUgb2YgdGhlIGRpcmVjdG9yeSBpZiBub3QgcHJvdmlkZWRcbiAgICAgKi9cbiAgICBuYW1lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFRoZSBtaW5pbXVtIE5vZGUtQVBJIHZlcnNpb24gdG8gc3VwcG9ydFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgNFxuICAgICAqL1xuICAgIG1pbk5vZGVBcGlWZXJzaW9uPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFRoZSBwYWNrYWdlIG1hbmFnZXIgdG8gdXNlLiBPbmx5IHN1cHBvcnQgeWFybiA0LnggZm9yIG5vdy5cbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICd5YXJuJ1xuICAgICAqL1xuICAgIHBhY2thZ2VNYW5hZ2VyPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIExpY2Vuc2UgZm9yIG9wZW4tc291cmNlZCBwcm9qZWN0XG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAnTUlUJ1xuICAgICAqL1xuICAgIGxpY2Vuc2U/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogQWxsIHRhcmdldHMgdGhlIGNyYXRlIHdpbGwgYmUgY29tcGlsZWQgZm9yLlxuICAgICAqXG4gICAgICogQGRlZmF1bHQgW11cbiAgICAgKi9cbiAgICB0YXJnZXRzPzogc3RyaW5nW107XG4gICAgLyoqXG4gICAgICogV2hldGhlciBlbmFibGUgZGVmYXVsdCB0YXJnZXRzXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCB0cnVlXG4gICAgICovXG4gICAgZW5hYmxlRGVmYXVsdFRhcmdldHM/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgZW5hYmxlIGFsbCB0YXJnZXRzXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgICAqL1xuICAgIGVuYWJsZUFsbFRhcmdldHM/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgZW5hYmxlIHRoZSBgdHlwZS1kZWZgIGZlYXR1cmUgZm9yIHR5cGVzY3JpcHQgZGVmaW5pdGlvbnMgYXV0by1nZW5lcmF0aW9uXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCB0cnVlXG4gICAgICovXG4gICAgZW5hYmxlVHlwZURlZj86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogV2hldGhlciBnZW5lcmF0ZSBwcmVjb25maWd1cmVkIEdpdEh1YiBBY3Rpb25zIHdvcmtmbG93XG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCB0cnVlXG4gICAgICovXG4gICAgZW5hYmxlR2l0aHViQWN0aW9ucz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogVGhlIEphdmFTY3JpcHQgdGVzdCBmcmFtZXdvcmsgdG8gdXNlLCBvbmx5IHN1cHBvcnQgYGF2YWAgZm9yIG5vd1xuICAgICAqXG4gICAgICogQGRlZmF1bHQgJ2F2YSdcbiAgICAgKi9cbiAgICB0ZXN0RnJhbWV3b3JrPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdG8gcnVuIHRoZSBjb21tYW5kIGluIGRyeS1ydW4gbW9kZVxuICAgICAqXG4gICAgICogQGRlZmF1bHQgZmFsc2VcbiAgICAgKi9cbiAgICBkcnlSdW4/OiBib29sZWFuO1xufVxuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gYXBwbHlEZWZhdWx0TmV3T3B0aW9ucyhvcHRpb25zOiBOZXdPcHRpb25zKToge1xuICAgIC8qKlxuICAgICAqIFRoZSBwYXRoIHdoZXJlIHRoZSBOQVBJLVJTIHByb2plY3Qgd2lsbCBiZSBjcmVhdGVkLlxuICAgICAqL1xuICAgIHBhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIHByb2plY3QsIGRlZmF1bHQgdG8gdGhlIG5hbWUgb2YgdGhlIGRpcmVjdG9yeSBpZiBub3QgcHJvdmlkZWRcbiAgICAgKi9cbiAgICBuYW1lPzogc3RyaW5nO1xuICAgIG1pbk5vZGVBcGlWZXJzaW9uOiBudW1iZXI7XG4gICAgcGFja2FnZU1hbmFnZXI6IHN0cmluZztcbiAgICBsaWNlbnNlOiBzdHJpbmc7XG4gICAgdGFyZ2V0czogc3RyaW5nW107XG4gICAgZW5hYmxlRGVmYXVsdFRhcmdldHM6IGJvb2xlYW47XG4gICAgZW5hYmxlQWxsVGFyZ2V0czogYm9vbGVhbjtcbiAgICBlbmFibGVUeXBlRGVmOiBib29sZWFuO1xuICAgIGVuYWJsZUdpdGh1YkFjdGlvbnM6IGJvb2xlYW47XG4gICAgdGVzdEZyYW1ld29yazogc3RyaW5nO1xuICAgIGRyeVJ1bjogYm9vbGVhbjtcbn07XG4iLCJpbXBvcnQgeyB0eXBlIE5ld09wdGlvbnMgYXMgUmF3TmV3T3B0aW9ucyB9IGZyb20gJy4uL2RlZi9uZXcuanMnO1xudHlwZSBOZXdPcHRpb25zID0gUmVxdWlyZWQ8UmF3TmV3T3B0aW9ucz47XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiB1cGRhdGVDYXJnb1RvbWxOb2RlQXBpVmVyc2lvbihmaWxlUGF0aDogc3RyaW5nLCBtaW5Ob2RlQXBpVmVyc2lvbjogbnVtYmVyKTogUHJvbWlzZTx2b2lkPjtcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIG5ld1Byb2plY3QodXNlck9wdGlvbnM6IFJhd05ld09wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuZXhwb3J0IHR5cGUgeyBOZXdPcHRpb25zIH07XG4iLCJpbXBvcnQgeyBDb21tYW5kIH0gZnJvbSAnY2xpcGFuaW9uJztcbmV4cG9ydCBkZWNsYXJlIGFic3RyYWN0IGNsYXNzIEJhc2VQcmVQdWJsaXNoQ29tbWFuZCBleHRlbmRzIENvbW1hbmQge1xuICAgIHN0YXRpYyBwYXRoczogc3RyaW5nW11bXTtcbiAgICBzdGF0aWMgdXNhZ2U6IGltcG9ydChcImNsaXBhbmlvblwiKS5Vc2FnZTtcbiAgICBjd2Q6IHN0cmluZztcbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgIG5wbURpcjogc3RyaW5nO1xuICAgIHRhZ1N0eWxlOiBzdHJpbmc7XG4gICAgZ2hSZWxlYXNlOiBib29sZWFuO1xuICAgIGdoUmVsZWFzZU5hbWU/OiBzdHJpbmc7XG4gICAgZ2hSZWxlYXNlSWQ/OiBzdHJpbmc7XG4gICAgc2tpcE9wdGlvbmFsUHVibGlzaDogYm9vbGVhbjtcbiAgICBkcnlSdW46IGJvb2xlYW47XG4gICAgZ2V0T3B0aW9ucygpOiB7XG4gICAgICAgIGN3ZDogc3RyaW5nO1xuICAgICAgICBjb25maWdQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgICAgICBucG1EaXI6IHN0cmluZztcbiAgICAgICAgdGFnU3R5bGU6IHN0cmluZztcbiAgICAgICAgZ2hSZWxlYXNlOiBib29sZWFuO1xuICAgICAgICBnaFJlbGVhc2VOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGdoUmVsZWFzZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIHNraXBPcHRpb25hbFB1Ymxpc2g6IGJvb2xlYW47XG4gICAgICAgIGRyeVJ1bjogYm9vbGVhbjtcbiAgICB9O1xufVxuLyoqXG4gKiBVcGRhdGUgcGFja2FnZS5qc29uIGFuZCBjb3B5IGFkZG9ucyBpbnRvIHBlciBwbGF0Zm9ybSBwYWNrYWdlc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFByZVB1Ymxpc2hPcHRpb25zIHtcbiAgICAvKipcbiAgICAgKiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGhcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IHByb2Nlc3MuY3dkKClcbiAgICAgKi9cbiAgICBjd2Q/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgICAqL1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgcGFja2FnZS5qc29uYFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgJ3BhY2thZ2UuanNvbidcbiAgICAgKi9cbiAgICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0XG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAnbnBtJ1xuICAgICAqL1xuICAgIG5wbURpcj86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBnaXQgdGFnIHN0eWxlLCBgbnBtYCBvciBgbGVybmFgXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAnbGVybmEnXG4gICAgICovXG4gICAgdGFnU3R5bGU/OiAnbnBtJyB8ICdsZXJuYSc7XG4gICAgLyoqXG4gICAgICogV2hldGhlciBjcmVhdGUgR2l0SHViIHJlbGVhc2VcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICBnaFJlbGVhc2U/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIEdpdEh1YiByZWxlYXNlIG5hbWVcbiAgICAgKi9cbiAgICBnaFJlbGVhc2VOYW1lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEV4aXN0aW5nIEdpdEh1YiByZWxlYXNlIGlkXG4gICAgICovXG4gICAgZ2hSZWxlYXNlSWQ/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogV2hldGhlciBza2lwIG9wdGlvbmFsRGVwZW5kZW5jaWVzIHBhY2thZ2VzIHB1Ymxpc2hcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IGZhbHNlXG4gICAgICovXG4gICAgc2tpcE9wdGlvbmFsUHVibGlzaD86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogRHJ5IHJ1biB3aXRob3V0IHRvdWNoaW5nIGZpbGUgc3lzdGVtXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgICAqL1xuICAgIGRyeVJ1bj86IGJvb2xlYW47XG59XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBhcHBseURlZmF1bHRQcmVQdWJsaXNoT3B0aW9ucyhvcHRpb25zOiBQcmVQdWJsaXNoT3B0aW9ucyk6IHtcbiAgICBjd2Q6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAgICovXG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICBwYWNrYWdlSnNvblBhdGg6IHN0cmluZztcbiAgICBucG1EaXI6IHN0cmluZztcbiAgICB0YWdTdHlsZTogc3RyaW5nO1xuICAgIGdoUmVsZWFzZTogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBHaXRIdWIgcmVsZWFzZSBuYW1lXG4gICAgICovXG4gICAgZ2hSZWxlYXNlTmFtZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBFeGlzdGluZyBHaXRIdWIgcmVsZWFzZSBpZFxuICAgICAqL1xuICAgIGdoUmVsZWFzZUlkPzogc3RyaW5nO1xuICAgIHNraXBPcHRpb25hbFB1Ymxpc2g6IGJvb2xlYW47XG4gICAgZHJ5UnVuOiBib29sZWFuO1xufTtcbiIsImltcG9ydCB7IHR5cGUgUHJlUHVibGlzaE9wdGlvbnMgfSBmcm9tICcuLi9kZWYvcHJlLXB1Ymxpc2guanMnO1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gcHJlUHVibGlzaCh1c2VyT3B0aW9uczogUHJlUHVibGlzaE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuIiwiaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJ2NsaXBhbmlvbic7XG5leHBvcnQgZGVjbGFyZSBhYnN0cmFjdCBjbGFzcyBCYXNlUmVuYW1lQ29tbWFuZCBleHRlbmRzIENvbW1hbmQge1xuICAgIHN0YXRpYyBwYXRoczogc3RyaW5nW11bXTtcbiAgICBzdGF0aWMgdXNhZ2U6IGltcG9ydChcImNsaXBhbmlvblwiKS5Vc2FnZTtcbiAgICBjd2Q6IHN0cmluZztcbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgIG5wbURpcjogc3RyaW5nO1xuICAgICQkbmFtZT86IHN0cmluZztcbiAgICBiaW5hcnlOYW1lPzogc3RyaW5nO1xuICAgIHBhY2thZ2VOYW1lPzogc3RyaW5nO1xuICAgIG1hbmlmZXN0UGF0aDogc3RyaW5nO1xuICAgIHJlcG9zaXRvcnk/OiBzdHJpbmc7XG4gICAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG4gICAgZ2V0T3B0aW9ucygpOiB7XG4gICAgICAgIGN3ZDogc3RyaW5nO1xuICAgICAgICBjb25maWdQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgICAgICBucG1EaXI6IHN0cmluZztcbiAgICAgICAgbmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBiaW5hcnlOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIHBhY2thZ2VOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIG1hbmlmZXN0UGF0aDogc3RyaW5nO1xuICAgICAgICByZXBvc2l0b3J5OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgfTtcbn1cbi8qKlxuICogUmVuYW1lIHRoZSBOQVBJLVJTIHByb2plY3RcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZW5hbWVPcHRpb25zIHtcbiAgICAvKipcbiAgICAgKiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGhcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IHByb2Nlc3MuY3dkKClcbiAgICAgKi9cbiAgICBjd2Q/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgICAqL1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgcGFja2FnZS5qc29uYFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgJ3BhY2thZ2UuanNvbidcbiAgICAgKi9cbiAgICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0XG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAnbnBtJ1xuICAgICAqL1xuICAgIG5wbURpcj86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbmV3IG5hbWUgb2YgdGhlIHByb2plY3RcbiAgICAgKi9cbiAgICBuYW1lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFRoZSBuZXcgYmluYXJ5IG5hbWUgKi5ub2RlIGZpbGVzXG4gICAgICovXG4gICAgYmluYXJ5TmFtZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbmV3IHBhY2thZ2UgbmFtZSBvZiB0aGUgcHJvamVjdFxuICAgICAqL1xuICAgIHBhY2thZ2VOYW1lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYENhcmdvLnRvbWxgXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAnQ2FyZ28udG9tbCdcbiAgICAgKi9cbiAgICBtYW5pZmVzdFBhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIG5ldyByZXBvc2l0b3J5IG9mIHRoZSBwcm9qZWN0XG4gICAgICovXG4gICAgcmVwb3NpdG9yeT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbmV3IGRlc2NyaXB0aW9uIG9mIHRoZSBwcm9qZWN0XG4gICAgICovXG4gICAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG59XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBhcHBseURlZmF1bHRSZW5hbWVPcHRpb25zKG9wdGlvbnM6IFJlbmFtZU9wdGlvbnMpOiB7XG4gICAgY3dkOiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgICAqL1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgbnBtRGlyOiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIG5ldyBuYW1lIG9mIHRoZSBwcm9qZWN0XG4gICAgICovXG4gICAgbmFtZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbmV3IGJpbmFyeSBuYW1lICoubm9kZSBmaWxlc1xuICAgICAqL1xuICAgIGJpbmFyeU5hbWU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIG5ldyBwYWNrYWdlIG5hbWUgb2YgdGhlIHByb2plY3RcbiAgICAgKi9cbiAgICBwYWNrYWdlTmFtZT86IHN0cmluZztcbiAgICBtYW5pZmVzdFBhdGg6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbmV3IHJlcG9zaXRvcnkgb2YgdGhlIHByb2plY3RcbiAgICAgKi9cbiAgICByZXBvc2l0b3J5Pzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFRoZSBuZXcgZGVzY3JpcHRpb24gb2YgdGhlIHByb2plY3RcbiAgICAgKi9cbiAgICBkZXNjcmlwdGlvbj86IHN0cmluZztcbn07XG4iLCJpbXBvcnQgeyB0eXBlIFJlbmFtZU9wdGlvbnMgfSBmcm9tICcuLi9kZWYvcmVuYW1lLmpzJztcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIHJlbmFtZVByb2plY3QodXNlck9wdGlvbnM6IFJlbmFtZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuIiwiaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJ2NsaXBhbmlvbic7XG5leHBvcnQgZGVjbGFyZSBhYnN0cmFjdCBjbGFzcyBCYXNlVW5pdmVyc2FsaXplQ29tbWFuZCBleHRlbmRzIENvbW1hbmQge1xuICAgIHN0YXRpYyBwYXRoczogc3RyaW5nW11bXTtcbiAgICBzdGF0aWMgdXNhZ2U6IGltcG9ydChcImNsaXBhbmlvblwiKS5Vc2FnZTtcbiAgICBjd2Q6IHN0cmluZztcbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgIG91dHB1dERpcjogc3RyaW5nO1xuICAgIGdldE9wdGlvbnMoKToge1xuICAgICAgICBjd2Q6IHN0cmluZztcbiAgICAgICAgY29uZmlnUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBwYWNrYWdlSnNvblBhdGg6IHN0cmluZztcbiAgICAgICAgb3V0cHV0RGlyOiBzdHJpbmc7XG4gICAgfTtcbn1cbi8qKlxuICogQ29tYmlsZSBidWlsdCBiaW5hcmllcyBpbnRvIG9uZSB1bml2ZXJzYWwgYmluYXJ5XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVW5pdmVyc2FsaXplT3B0aW9ucyB7XG4gICAgLyoqXG4gICAgICogVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCBwcm9jZXNzLmN3ZCgpXG4gICAgICovXG4gICAgY3dkPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICAgKi9cbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYHBhY2thZ2UuanNvbmBcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICdwYWNrYWdlLmpzb24nXG4gICAgICovXG4gICAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gdGhlIGZvbGRlciB3aGVyZSBhbGwgYnVpbHQgYC5ub2RlYCBmaWxlcyBwdXQsIHNhbWUgYXMgYC0tb3V0cHV0LWRpcmAgb2YgYnVpbGQgY29tbWFuZFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgJy4vJ1xuICAgICAqL1xuICAgIG91dHB1dERpcj86IHN0cmluZztcbn1cbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGFwcGx5RGVmYXVsdFVuaXZlcnNhbGl6ZU9wdGlvbnMob3B0aW9uczogVW5pdmVyc2FsaXplT3B0aW9ucyk6IHtcbiAgICBjd2Q6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAgICovXG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICBwYWNrYWdlSnNvblBhdGg6IHN0cmluZztcbiAgICBvdXRwdXREaXI6IHN0cmluZztcbn07XG4iLCJpbXBvcnQgeyB0eXBlIFVuaXZlcnNhbGl6ZU9wdGlvbnMgfSBmcm9tICcuLi9kZWYvdW5pdmVyc2FsaXplLmpzJztcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIHVuaXZlcnNhbGl6ZUJpbmFyaWVzKHVzZXJPcHRpb25zOiBVbml2ZXJzYWxpemVPcHRpb25zKTogUHJvbWlzZTx2b2lkPjtcbiIsImltcG9ydCB7IENvbW1hbmQgfSBmcm9tICdjbGlwYW5pb24nO1xuZXhwb3J0IGRlY2xhcmUgYWJzdHJhY3QgY2xhc3MgQmFzZVZlcnNpb25Db21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gICAgc3RhdGljIHBhdGhzOiBzdHJpbmdbXVtdO1xuICAgIHN0YXRpYyB1c2FnZTogaW1wb3J0KFwiY2xpcGFuaW9uXCIpLlVzYWdlO1xuICAgIGN3ZDogc3RyaW5nO1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgbnBtRGlyOiBzdHJpbmc7XG4gICAgZ2V0T3B0aW9ucygpOiB7XG4gICAgICAgIGN3ZDogc3RyaW5nO1xuICAgICAgICBjb25maWdQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgICAgICBucG1EaXI6IHN0cmluZztcbiAgICB9O1xufVxuLyoqXG4gKiBVcGRhdGUgdmVyc2lvbiBpbiBjcmVhdGVkIG5wbSBwYWNrYWdlc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFZlcnNpb25PcHRpb25zIHtcbiAgICAvKipcbiAgICAgKiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGhcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IHByb2Nlc3MuY3dkKClcbiAgICAgKi9cbiAgICBjd2Q/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgICAqL1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgcGFja2FnZS5qc29uYFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgJ3BhY2thZ2UuanNvbidcbiAgICAgKi9cbiAgICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0XG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAnbnBtJ1xuICAgICAqL1xuICAgIG5wbURpcj86IHN0cmluZztcbn1cbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGFwcGx5RGVmYXVsdFZlcnNpb25PcHRpb25zKG9wdGlvbnM6IFZlcnNpb25PcHRpb25zKToge1xuICAgIGN3ZDogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICAgKi9cbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgIG5wbURpcjogc3RyaW5nO1xufTtcbiIsImltcG9ydCB7IHR5cGUgVmVyc2lvbk9wdGlvbnMgfSBmcm9tICcuLi9kZWYvdmVyc2lvbi5qcyc7XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiB2ZXJzaW9uKHVzZXJPcHRpb25zOiBWZXJzaW9uT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG4iLCJpbXBvcnQgeyBCYXNlQXJ0aWZhY3RzQ29tbWFuZCB9IGZyb20gJy4uL2RlZi9hcnRpZmFjdHMuanMnO1xuZXhwb3J0IGRlY2xhcmUgY2xhc3MgQXJ0aWZhY3RzQ29tbWFuZCBleHRlbmRzIEJhc2VBcnRpZmFjdHNDb21tYW5kIHtcbiAgICBzdGF0aWMgdXNhZ2U6IGltcG9ydChcImNsaXBhbmlvblwiKS5Vc2FnZTtcbiAgICBzdGF0aWMgcGF0aHM6IHN0cmluZ1tdW107XG4gICAgZXhlY3V0ZSgpOiBQcm9taXNlPHZvaWQ+O1xufVxuIiwiaW1wb3J0IHsgQmFzZUJ1aWxkQ29tbWFuZCB9IGZyb20gJy4uL2RlZi9idWlsZC5qcyc7XG5leHBvcnQgZGVjbGFyZSBjbGFzcyBCdWlsZENvbW1hbmQgZXh0ZW5kcyBCYXNlQnVpbGRDb21tYW5kIHtcbiAgICBwaXBlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgY2FyZ29PcHRpb25zOiBzdHJpbmdbXTtcbiAgICBleGVjdXRlKCk6IFByb21pc2U8dm9pZD47XG59XG4iLCJpbXBvcnQgeyBCYXNlQ3JlYXRlTnBtRGlyc0NvbW1hbmQgfSBmcm9tICcuLi9kZWYvY3JlYXRlLW5wbS1kaXJzLmpzJztcbmV4cG9ydCBkZWNsYXJlIGNsYXNzIENyZWF0ZU5wbURpcnNDb21tYW5kIGV4dGVuZHMgQmFzZUNyZWF0ZU5wbURpcnNDb21tYW5kIHtcbiAgICBleGVjdXRlKCk6IFByb21pc2U8dm9pZD47XG59XG4iLCJpbXBvcnQgeyBCYXNlTmV3Q29tbWFuZCB9IGZyb20gJy4uL2RlZi9uZXcuanMnO1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gZ2V0TmFwaVZlcnNpb25DaG9pY2VzKCk6IHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgdmFsdWU6IGltcG9ydChcIi4uL3V0aWxzL3ZlcnNpb24uanNcIikuTmFwaVZlcnNpb247XG59W107XG5leHBvcnQgZGVjbGFyZSBjbGFzcyBOZXdDb21tYW5kIGV4dGVuZHMgQmFzZU5ld0NvbW1hbmQge1xuICAgIGludGVyYWN0aXZlOiBib29sZWFuO1xuICAgIGV4ZWN1dGUoKTogUHJvbWlzZTwxIHwgMD47XG4gICAgcHJpdmF0ZSBmZXRjaE9wdGlvbnM7XG4gICAgcHJpdmF0ZSBmZXRjaE5hbWU7XG4gICAgcHJpdmF0ZSBmZXRjaExpY2Vuc2U7XG4gICAgcHJpdmF0ZSBmZXRjaE5hcGlWZXJzaW9uO1xuICAgIHByaXZhdGUgZmV0Y2hUYXJnZXRzO1xuICAgIHByaXZhdGUgZmV0Y2hUeXBlRGVmO1xuICAgIHByaXZhdGUgZmV0Y2hHaXRodWJBY3Rpb25zO1xufVxuIiwiaW1wb3J0IHsgQmFzZVByZVB1Ymxpc2hDb21tYW5kIH0gZnJvbSAnLi4vZGVmL3ByZS1wdWJsaXNoLmpzJztcbmV4cG9ydCBkZWNsYXJlIGNsYXNzIFByZVB1Ymxpc2hDb21tYW5kIGV4dGVuZHMgQmFzZVByZVB1Ymxpc2hDb21tYW5kIHtcbiAgICBleGVjdXRlKCk6IFByb21pc2U8dm9pZD47XG59XG4iLCJpbXBvcnQgeyBCYXNlUmVuYW1lQ29tbWFuZCB9IGZyb20gJy4uL2RlZi9yZW5hbWUuanMnO1xuZXhwb3J0IGRlY2xhcmUgY2xhc3MgUmVuYW1lQ29tbWFuZCBleHRlbmRzIEJhc2VSZW5hbWVDb21tYW5kIHtcbiAgICBleGVjdXRlKCk6IFByb21pc2U8dm9pZD47XG59XG4iLCJpbXBvcnQgeyBCYXNlVW5pdmVyc2FsaXplQ29tbWFuZCB9IGZyb20gJy4uL2RlZi91bml2ZXJzYWxpemUuanMnO1xuZXhwb3J0IGRlY2xhcmUgY2xhc3MgVW5pdmVyc2FsaXplQ29tbWFuZCBleHRlbmRzIEJhc2VVbml2ZXJzYWxpemVDb21tYW5kIHtcbiAgICBleGVjdXRlKCk6IFByb21pc2U8dm9pZD47XG59XG4iLCJpbXBvcnQgeyBCYXNlVmVyc2lvbkNvbW1hbmQgfSBmcm9tICcuLi9kZWYvdmVyc2lvbi5qcyc7XG5leHBvcnQgZGVjbGFyZSBjbGFzcyBWZXJzaW9uQ29tbWFuZCBleHRlbmRzIEJhc2VWZXJzaW9uQ29tbWFuZCB7XG4gICAgZXhlY3V0ZSgpOiBQcm9taXNlPHZvaWQ+O1xufVxuIiwiZXhwb3J0IHR5cGUgUGxhdGZvcm0gPSBOb2RlSlMuUGxhdGZvcm0gfCAnd2FzbScgfCAnd2FzaScgfCAnb3Blbmhhcm1vbnknO1xuZXhwb3J0IGRlY2xhcmUgY29uc3QgVU5JVkVSU0FMX1RBUkdFVFM6IHtcbiAgICByZWFkb25seSAndW5pdmVyc2FsLWFwcGxlLWRhcndpbic6IHJlYWRvbmx5IFtcImFhcmNoNjQtYXBwbGUtZGFyd2luXCIsIFwieDg2XzY0LWFwcGxlLWRhcndpblwiXTtcbn07XG5leHBvcnQgZGVjbGFyZSBjb25zdCBBVkFJTEFCTEVfVEFSR0VUUzogcmVhZG9ubHkgW1wiYWFyY2g2NC1hcHBsZS1kYXJ3aW5cIiwgXCJhYXJjaDY0LWxpbnV4LWFuZHJvaWRcIiwgXCJhYXJjaDY0LXVua25vd24tbGludXgtZ251XCIsIFwiYWFyY2g2NC11bmtub3duLWxpbnV4LW11c2xcIiwgXCJhYXJjaDY0LXVua25vd24tbGludXgtb2hvc1wiLCBcImFhcmNoNjQtcGMtd2luZG93cy1tc3ZjXCIsIFwieDg2XzY0LWFwcGxlLWRhcndpblwiLCBcIng4Nl82NC1wYy13aW5kb3dzLW1zdmNcIiwgXCJ4ODZfNjQtcGMtd2luZG93cy1nbnVcIiwgXCJ4ODZfNjQtdW5rbm93bi1saW51eC1nbnVcIiwgXCJ4ODZfNjQtdW5rbm93bi1saW51eC1tdXNsXCIsIFwieDg2XzY0LXVua25vd24tbGludXgtb2hvc1wiLCBcIng4Nl82NC11bmtub3duLWZyZWVic2RcIiwgXCJpNjg2LXBjLXdpbmRvd3MtbXN2Y1wiLCBcImFybXY3LXVua25vd24tbGludXgtZ251ZWFiaWhmXCIsIFwiYXJtdjctdW5rbm93bi1saW51eC1tdXNsZWFiaWhmXCIsIFwiYXJtdjctbGludXgtYW5kcm9pZGVhYmlcIiwgXCJ1bml2ZXJzYWwtYXBwbGUtZGFyd2luXCIsIFwibG9vbmdhcmNoNjQtdW5rbm93bi1saW51eC1nbnVcIiwgXCJyaXNjdjY0Z2MtdW5rbm93bi1saW51eC1nbnVcIiwgXCJwb3dlcnBjNjRsZS11bmtub3duLWxpbnV4LWdudVwiLCBcInMzOTB4LXVua25vd24tbGludXgtZ251XCIsIFwid2FzbTMyLXdhc2ktcHJldmlldzEtdGhyZWFkc1wiLCBcIndhc20zMi13YXNpcDEtdGhyZWFkc1wiXTtcbmV4cG9ydCB0eXBlIFRhcmdldFRyaXBsZSA9ICh0eXBlb2YgQVZBSUxBQkxFX1RBUkdFVFMpW251bWJlcl07XG5leHBvcnQgZGVjbGFyZSBjb25zdCBERUZBVUxUX1RBUkdFVFM6IHJlYWRvbmx5IFtcIng4Nl82NC1hcHBsZS1kYXJ3aW5cIiwgXCJhYXJjaDY0LWFwcGxlLWRhcndpblwiLCBcIng4Nl82NC1wYy13aW5kb3dzLW1zdmNcIiwgXCJ4ODZfNjQtdW5rbm93bi1saW51eC1nbnVcIl07XG5leHBvcnQgZGVjbGFyZSBjb25zdCBUQVJHRVRfTElOS0VSOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xudHlwZSBOb2RlSlNBcmNoID0gJ2FybScgfCAnYXJtNjQnIHwgJ2lhMzInIHwgJ2xvb25nNjQnIHwgJ21pcHMnIHwgJ21pcHNlbCcgfCAncHBjJyB8ICdwcGM2NCcgfCAncmlzY3Y2NCcgfCAnczM5MCcgfCAnczM5MHgnIHwgJ3gzMicgfCAneDY0JyB8ICd1bml2ZXJzYWwnIHwgJ3dhc20zMic7XG5leHBvcnQgZGVjbGFyZSBjb25zdCBOb2RlQXJjaFRvQ3B1OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuZXhwb3J0IGRlY2xhcmUgY29uc3QgVW5pQXJjaHNCeVBsYXRmb3JtOiBQYXJ0aWFsPFJlY29yZDxQbGF0Zm9ybSwgTm9kZUpTQXJjaFtdPj47XG5leHBvcnQgaW50ZXJmYWNlIFRhcmdldCB7XG4gICAgdHJpcGxlOiBzdHJpbmc7XG4gICAgcGxhdGZvcm1BcmNoQUJJOiBzdHJpbmc7XG4gICAgcGxhdGZvcm06IFBsYXRmb3JtO1xuICAgIGFyY2g6IE5vZGVKU0FyY2g7XG4gICAgYWJpOiBzdHJpbmcgfCBudWxsO1xufVxuLyoqXG4gKiBBIHRyaXBsZSBpcyBhIHNwZWNpZmljIGZvcm1hdCBmb3Igc3BlY2lmeWluZyBhIHRhcmdldCBhcmNoaXRlY3R1cmUuXG4gKiBUcmlwbGVzIG1heSBiZSByZWZlcnJlZCB0byBhcyBhIHRhcmdldCB0cmlwbGUgd2hpY2ggaXMgdGhlIGFyY2hpdGVjdHVyZSBmb3IgdGhlIGFydGlmYWN0IHByb2R1Y2VkLCBhbmQgdGhlIGhvc3QgdHJpcGxlIHdoaWNoIGlzIHRoZSBhcmNoaXRlY3R1cmUgdGhhdCB0aGUgY29tcGlsZXIgaXMgcnVubmluZyBvbi5cbiAqIFRoZSBnZW5lcmFsIGZvcm1hdCBvZiB0aGUgdHJpcGxlIGlzIGA8YXJjaD48c3ViPi08dmVuZG9yPi08c3lzPi08YWJpPmAgd2hlcmU6XG4gKiAgIC0gYGFyY2hgID0gVGhlIGJhc2UgQ1BVIGFyY2hpdGVjdHVyZSwgZm9yIGV4YW1wbGUgYHg4Nl82NGAsIGBpNjg2YCwgYGFybWAsIGB0aHVtYmAsIGBtaXBzYCwgZXRjLlxuICogICAtIGBzdWJgID0gVGhlIENQVSBzdWItYXJjaGl0ZWN0dXJlLCBmb3IgZXhhbXBsZSBgYXJtYCBoYXMgYHY3YCwgYHY3c2AsIGB2NXRlYCwgZXRjLlxuICogICAtIGB2ZW5kb3JgID0gVGhlIHZlbmRvciwgZm9yIGV4YW1wbGUgYHVua25vd25gLCBgYXBwbGVgLCBgcGNgLCBgbnZpZGlhYCwgZXRjLlxuICogICAtIGBzeXNgID0gVGhlIHN5c3RlbSBuYW1lLCBmb3IgZXhhbXBsZSBgbGludXhgLCBgd2luZG93c2AsIGBkYXJ3aW5gLCBldGMuIG5vbmUgaXMgdHlwaWNhbGx5IHVzZWQgZm9yIGJhcmUtbWV0YWwgd2l0aG91dCBhbiBPUy5cbiAqICAgLSBgYWJpYCA9IFRoZSBBQkksIGZvciBleGFtcGxlIGBnbnVgLCBgYW5kcm9pZGAsIGBlYWJpYCwgZXRjLlxuICovXG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBwYXJzZVRyaXBsZShyYXdUcmlwbGU6IHN0cmluZyk6IFRhcmdldDtcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGdldFN5c3RlbURlZmF1bHRUYXJnZXQoKTogVGFyZ2V0O1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gZ2V0VGFyZ2V0TGlua2VyKHRhcmdldDogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gdGFyZ2V0VG9FbnZWYXIodGFyZ2V0OiBzdHJpbmcpOiBzdHJpbmc7XG5leHBvcnQge307XG4iLCJpbXBvcnQgeyB0eXBlIFRhcmdldCB9IGZyb20gJy4vdGFyZ2V0LmpzJztcbmV4cG9ydCB0eXBlIFZhbHVlT2ZDb25zdEFycmF5PFQ+ID0gVFtFeGNsdWRlPGtleW9mIFQsIGtleW9mIEFycmF5PGFueT4+XTtcbmV4cG9ydCBkZWNsYXJlIGNvbnN0IFN1cHBvcnRlZFBhY2thZ2VNYW5hZ2VyczogcmVhZG9ubHkgW1wieWFyblwiLCBcInBucG1cIl07XG5leHBvcnQgZGVjbGFyZSBjb25zdCBTdXBwb3J0ZWRUZXN0RnJhbWV3b3JrczogcmVhZG9ubHkgW1wiYXZhXCJdO1xuZXhwb3J0IHR5cGUgU3VwcG9ydGVkUGFja2FnZU1hbmFnZXIgPSBWYWx1ZU9mQ29uc3RBcnJheTx0eXBlb2YgU3VwcG9ydGVkUGFja2FnZU1hbmFnZXJzPjtcbmV4cG9ydCB0eXBlIFN1cHBvcnRlZFRlc3RGcmFtZXdvcmsgPSBWYWx1ZU9mQ29uc3RBcnJheTx0eXBlb2YgU3VwcG9ydGVkVGVzdEZyYW1ld29ya3M+O1xuZXhwb3J0IGludGVyZmFjZSBVc2VyTmFwaUNvbmZpZyB7XG4gICAgLyoqXG4gICAgICogTmFtZSBvZiB0aGUgYmluYXJ5IHRvIGJlIGdlbmVyYXRlZCwgZGVmYXVsdCB0byBgaW5kZXhgXG4gICAgICovXG4gICAgYmluYXJ5TmFtZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBOYW1lIG9mIHRoZSBucG0gcGFja2FnZSwgZGVmYXVsdCB0byB0aGUgbmFtZSBvZiByb290IHBhY2thZ2UuanNvbiBuYW1lXG4gICAgICpcbiAgICAgKiBBbHdheXMgZ2l2ZW4gYEBzY29wZS9wa2dgIGFuZCBhcmNoIHN1ZmZpeCB3aWxsIGJlIGFwcGVuZGVkIGxpa2UgYEBzY29wZS9wa2ctbGludXgtZ251LXg2NGBcbiAgICAgKi9cbiAgICBwYWNrYWdlTmFtZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBBbGwgdGFyZ2V0cyB0aGUgY3JhdGUgd2lsbCBiZSBjb21waWxlZCBmb3JcbiAgICAgKi9cbiAgICB0YXJnZXRzPzogc3RyaW5nW107XG4gICAgLyoqXG4gICAgICogVGhlIG5wbSBjbGllbnQgcHJvamVjdCB1c2VzLlxuICAgICAqL1xuICAgIG5wbUNsaWVudD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIGdlbmVyYXRlIGNvbnN0IGVudW0gZm9yIHR5cGVzY3JpcHQgYmluZGluZ3NcbiAgICAgKi9cbiAgICBjb25zdEVudW0/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIEVtaXQgYCNbbmFwaShzdHJpbmdfZW51bSldYCBlbnVtcyBhcyBydW50aW1lIGVudW1zIChgZXhwb3J0IGRlY2xhcmUgZW51bWApIHVuZGVyIGAtLW5vLWNvbnN0LWVudW1gLiBEZWZhdWx0OiB0eXBlLW9ubHkgdW5pb24uXG4gICAgICovXG4gICAgcnVudGltZVN0cmluZ0VudW0/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIGR0cyBoZWFkZXIgcHJlcGVuZCB0byB0aGUgZ2VuZXJhdGVkIGR0cyBmaWxlXG4gICAgICovXG4gICAgZHRzSGVhZGVyPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIGR0cyBoZWFkZXIgZmlsZSBwYXRoIHRvIGJlIHByZXBlbmRlZCB0byB0aGUgZ2VuZXJhdGVkIGR0cyBmaWxlXG4gICAgICogaWYgYm90aCBkdHNIZWFkZXIgYW5kIGR0c0hlYWRlckZpbGUgYXJlIHByb3ZpZGVkLCBkdHNIZWFkZXJGaWxlIHdpbGwgYmUgdXNlZFxuICAgICAqL1xuICAgIGR0c0hlYWRlckZpbGU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogd2FzbSBjb21waWxhdGlvbiBvcHRpb25zXG4gICAgICovXG4gICAgd2FzbT86IHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViQXNzZW1ibHkvSmF2YVNjcmlwdF9pbnRlcmZhY2UvTWVtb3J5XG4gICAgICAgICAqIEBkZWZhdWx0IDQwMDAgcGFnZXMgKDI1Nk1pQilcbiAgICAgICAgICovXG4gICAgICAgIGluaXRpYWxNZW1vcnk/OiBudW1iZXI7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZGVmYXVsdCA2NTUzNiBwYWdlcyAoNEdpQilcbiAgICAgICAgICovXG4gICAgICAgIG1heGltdW1NZW1vcnk/OiBudW1iZXI7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCcm93c2VyIHdhc20gYmluZGluZyBjb25maWd1cmF0aW9uXG4gICAgICAgICAqL1xuICAgICAgICBicm93c2VyOiB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFdoZXRoZXIgdG8gdXNlIGZzIG1vZHVsZSBpbiBicm93c2VyXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGZzPzogYm9vbGVhbjtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogV2hldGhlciB0byBpbml0aWFsaXplIHdhc20gYXN5bmNocm9ub3VzbHlcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgYXN5bmNJbml0PzogYm9vbGVhbjtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogV2hldGhlciB0byBpbmplY3QgYGJ1ZmZlcmAgdG8gZW1uYXBpIGNvbnRleHRcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgYnVmZmVyPzogYm9vbGVhbjtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogV2hldGhlciB0byBlbWl0IGN1c3RvbSBldmVudHMgZm9yIGVycm9ycyBpbiB3b3JrZXJcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgZXJyb3JFdmVudD86IGJvb2xlYW47XG4gICAgICAgIH07XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiBAZGVwcmVjYXRlZCBiaW5hcnlOYW1lIGluc3RlYWRcbiAgICAgKi9cbiAgICBuYW1lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEBkZXByZWNhdGVkIHVzZSBwYWNrYWdlTmFtZSBpbnN0ZWFkXG4gICAgICovXG4gICAgcGFja2FnZT86IHtcbiAgICAgICAgbmFtZT86IHN0cmluZztcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEBkZXByZWNhdGVkIHVzZSB0YXJnZXRzIGluc3RlYWRcbiAgICAgKi9cbiAgICB0cmlwbGVzPzoge1xuICAgICAgICAvKipcbiAgICAgICAgICogV2hldGhlciBlbmFibGUgZGVmYXVsdCB0YXJnZXRzXG4gICAgICAgICAqL1xuICAgICAgICBkZWZhdWx0czogYm9vbGVhbjtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFkZGl0aW9uYWwgdGFyZ2V0cyB0byBiZSBjb21waWxlZCBmb3JcbiAgICAgICAgICovXG4gICAgICAgIGFkZGl0aW9uYWw/OiBzdHJpbmdbXTtcbiAgICB9O1xufVxuZXhwb3J0IGludGVyZmFjZSBDb21tb25QYWNrYWdlSnNvbkZpZWxkcyB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHZlcnNpb246IHN0cmluZztcbiAgICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgICBrZXl3b3Jkcz86IHN0cmluZ1tdO1xuICAgIGF1dGhvcj86IHN0cmluZztcbiAgICBhdXRob3JzPzogc3RyaW5nW107XG4gICAgbGljZW5zZT86IHN0cmluZztcbiAgICBjcHU/OiBzdHJpbmdbXTtcbiAgICBvcz86IHN0cmluZ1tdO1xuICAgIGxpYmM/OiBzdHJpbmdbXTtcbiAgICBmaWxlcz86IHN0cmluZ1tdO1xuICAgIHJlcG9zaXRvcnk/OiBhbnk7XG4gICAgaG9tZXBhZ2U/OiBhbnk7XG4gICAgZW5naW5lcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gICAgcHVibGlzaENvbmZpZz86IGFueTtcbiAgICBidWdzPzogYW55O1xuICAgIG5hcGk/OiBVc2VyTmFwaUNvbmZpZztcbiAgICB0eXBlPzogJ21vZHVsZScgfCAnY29tbW9uanMnO1xuICAgIHNjcmlwdHM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAgIG1haW4/OiBzdHJpbmc7XG4gICAgbW9kdWxlPzogc3RyaW5nO1xuICAgIHR5cGVzPzogc3RyaW5nO1xuICAgIGJyb3dzZXI/OiBzdHJpbmc7XG4gICAgZXhwb3J0cz86IGFueTtcbiAgICBkZXBlbmRlbmNpZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAgIGRldkRlcGVuZGVuY2llcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gICAgYXZhPzoge1xuICAgICAgICB0aW1lb3V0Pzogc3RyaW5nO1xuICAgIH07XG59XG5leHBvcnQgdHlwZSBOYXBpQ29uZmlnID0gUmVxdWlyZWQ8UGljazxVc2VyTmFwaUNvbmZpZywgJ2JpbmFyeU5hbWUnIHwgJ3BhY2thZ2VOYW1lJyB8ICducG1DbGllbnQnPj4gJiBQaWNrPFVzZXJOYXBpQ29uZmlnLCAnd2FzbScgfCAnZHRzSGVhZGVyJyB8ICdkdHNIZWFkZXJGaWxlJyB8ICdjb25zdEVudW0nIHwgJ3J1bnRpbWVTdHJpbmdFbnVtJz4gJiB7XG4gICAgdGFyZ2V0czogVGFyZ2V0W107XG4gICAgcGFja2FnZUpzb246IENvbW1vblBhY2thZ2VKc29uRmllbGRzO1xufTtcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIHJlYWROYXBpQ29uZmlnKHBhdGg6IHN0cmluZywgY29uZmlnUGF0aD86IHN0cmluZyk6IFByb21pc2U8TmFwaUNvbmZpZz47XG4iLCJpbXBvcnQgeyBDbGkgfSBmcm9tICdjbGlwYW5pb24nO1xuaW1wb3J0IHsgY29sbGVjdEFydGlmYWN0cyB9IGZyb20gJy4vYXBpL2FydGlmYWN0cy5qcyc7XG5pbXBvcnQgeyBidWlsZFByb2plY3QgfSBmcm9tICcuL2FwaS9idWlsZC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVOcG1EaXJzIH0gZnJvbSAnLi9hcGkvY3JlYXRlLW5wbS1kaXJzLmpzJztcbmltcG9ydCB7IG5ld1Byb2plY3QgfSBmcm9tICcuL2FwaS9uZXcuanMnO1xuaW1wb3J0IHsgcHJlUHVibGlzaCB9IGZyb20gJy4vYXBpL3ByZS1wdWJsaXNoLmpzJztcbmltcG9ydCB7IHJlbmFtZVByb2plY3QgfSBmcm9tICcuL2FwaS9yZW5hbWUuanMnO1xuaW1wb3J0IHsgdW5pdmVyc2FsaXplQmluYXJpZXMgfSBmcm9tICcuL2FwaS91bml2ZXJzYWxpemUuanMnO1xuaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gJy4vYXBpL3ZlcnNpb24uanMnO1xuaW1wb3J0IHsgQXJ0aWZhY3RzQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvYXJ0aWZhY3RzLmpzJztcbmltcG9ydCB7IEJ1aWxkQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvYnVpbGQuanMnO1xuaW1wb3J0IHsgQ3JlYXRlTnBtRGlyc0NvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL2NyZWF0ZS1ucG0tZGlycy5qcyc7XG5pbXBvcnQgeyBOZXdDb21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy9uZXcuanMnO1xuaW1wb3J0IHsgUHJlUHVibGlzaENvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL3ByZS1wdWJsaXNoLmpzJztcbmltcG9ydCB7IFJlbmFtZUNvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL3JlbmFtZS5qcyc7XG5pbXBvcnQgeyBVbml2ZXJzYWxpemVDb21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy91bml2ZXJzYWxpemUuanMnO1xuaW1wb3J0IHsgVmVyc2lvbkNvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL3ZlcnNpb24uanMnO1xuZXhwb3J0IGRlY2xhcmUgY29uc3QgY2xpOiBDbGk8aW1wb3J0KFwiY2xpcGFuaW9uXCIpLkJhc2VDb250ZXh0Pjtcbi8qKlxuICpcbiAqIEB1c2FnZVxuICpcbiAqIGBgYHRzXG4gKiBjb25zdCBjbGkgPSBuZXcgTmFwaUNsaSgpXG4gKlxuICogY2xpLmJ1aWxkKHtcbiAqICAgY3dkOiAnL3BhdGgvdG8veW91ci9wcm9qZWN0JyxcbiAqIH0pXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGRlY2xhcmUgY2xhc3MgTmFwaUNsaSB7XG4gICAgYXJ0aWZhY3RzOiB0eXBlb2YgY29sbGVjdEFydGlmYWN0cztcbiAgICBuZXc6IHR5cGVvZiBuZXdQcm9qZWN0O1xuICAgIGJ1aWxkOiB0eXBlb2YgYnVpbGRQcm9qZWN0O1xuICAgIGNyZWF0ZU5wbURpcnM6IHR5cGVvZiBjcmVhdGVOcG1EaXJzO1xuICAgIHByZVB1Ymxpc2g6IHR5cGVvZiBwcmVQdWJsaXNoO1xuICAgIHJlbmFtZTogdHlwZW9mIHJlbmFtZVByb2plY3Q7XG4gICAgdW5pdmVyc2FsaXplOiB0eXBlb2YgdW5pdmVyc2FsaXplQmluYXJpZXM7XG4gICAgdmVyc2lvbjogdHlwZW9mIHZlcnNpb247XG59XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBjcmVhdGVCdWlsZENvbW1hbmQoYXJnczogc3RyaW5nW10pOiBCdWlsZENvbW1hbmQ7XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBjcmVhdGVBcnRpZmFjdHNDb21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogQXJ0aWZhY3RzQ29tbWFuZDtcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGNyZWF0ZUNyZWF0ZU5wbURpcnNDb21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogQ3JlYXRlTnBtRGlyc0NvbW1hbmQ7XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBjcmVhdGVQcmVQdWJsaXNoQ29tbWFuZChhcmdzOiBzdHJpbmdbXSk6IFByZVB1Ymxpc2hDb21tYW5kO1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gY3JlYXRlUmVuYW1lQ29tbWFuZChhcmdzOiBzdHJpbmdbXSk6IFJlbmFtZUNvbW1hbmQ7XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBjcmVhdGVVbml2ZXJzYWxpemVDb21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogVW5pdmVyc2FsaXplQ29tbWFuZDtcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGNyZWF0ZVZlcnNpb25Db21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogVmVyc2lvbkNvbW1hbmQ7XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBjcmVhdGVOZXdDb21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogTmV3Q29tbWFuZDtcbmV4cG9ydCB7IHBhcnNlVHJpcGxlIH0gZnJvbSAnLi91dGlscy90YXJnZXQuanMnO1xuZXhwb3J0IHsgdHlwZSBHZW5lcmF0ZVR5cGVEZWZPcHRpb25zLCB0eXBlIFdyaXRlSnNCaW5kaW5nT3B0aW9ucywgd3JpdGVKc0JpbmRpbmcsIGdlbmVyYXRlVHlwZURlZiwgfSBmcm9tICcuL2FwaS9idWlsZC5qcyc7XG5leHBvcnQgeyByZWFkTmFwaUNvbmZpZyB9IGZyb20gJy4vdXRpbHMvY29uZmlnLmpzJztcbiJdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsSUFBVyx1QkFBdUI7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