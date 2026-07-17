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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguZC50cyIsIm5hbWVzIjpbIkJ1aWxkT3B0aW9ucyIsIlJhd0J1aWxkT3B0aW9ucyIsIlJhd05ld09wdGlvbnMiXSwic291cmNlcyI6WyIuLi9zcmMvZGVmL2FydGlmYWN0cy5kLnRzIiwiLi4vc3JjL2FwaS9hcnRpZmFjdHMuZC50cyIsIi4uL3NyYy9kZWYvYnVpbGQuZC50cyIsIi4uL3NyYy9hcGkvYnVpbGQuZC50cyIsIi4uL3NyYy9kZWYvY3JlYXRlLW5wbS1kaXJzLmQudHMiLCIuLi9zcmMvYXBpL2NyZWF0ZS1ucG0tZGlycy5kLnRzIiwiLi4vc3JjL2RlZi9uZXcuZC50cyIsIi4uL3NyYy9hcGkvbmV3LmQudHMiLCIuLi9zcmMvZGVmL3ByZS1wdWJsaXNoLmQudHMiLCIuLi9zcmMvYXBpL3ByZS1wdWJsaXNoLmQudHMiLCIuLi9zcmMvZGVmL3JlbmFtZS5kLnRzIiwiLi4vc3JjL2FwaS9yZW5hbWUuZC50cyIsIi4uL3NyYy9kZWYvdW5pdmVyc2FsaXplLmQudHMiLCIuLi9zcmMvYXBpL3VuaXZlcnNhbGl6ZS5kLnRzIiwiLi4vc3JjL2RlZi92ZXJzaW9uLmQudHMiLCIuLi9zcmMvYXBpL3ZlcnNpb24uZC50cyIsIi4uL3NyYy9jb21tYW5kcy9hcnRpZmFjdHMuZC50cyIsIi4uL3NyYy9jb21tYW5kcy9idWlsZC5kLnRzIiwiLi4vc3JjL2NvbW1hbmRzL2NyZWF0ZS1ucG0tZGlycy5kLnRzIiwiLi4vc3JjL2NvbW1hbmRzL25ldy5kLnRzIiwiLi4vc3JjL2NvbW1hbmRzL3ByZS1wdWJsaXNoLmQudHMiLCIuLi9zcmMvY29tbWFuZHMvcmVuYW1lLmQudHMiLCIuLi9zcmMvY29tbWFuZHMvdW5pdmVyc2FsaXplLmQudHMiLCIuLi9zcmMvY29tbWFuZHMvdmVyc2lvbi5kLnRzIiwiLi4vc3JjL3V0aWxzL3RhcmdldC5kLnRzIiwiLi4vc3JjL3V0aWxzL2NvbmZpZy5kLnRzIiwiLi4vc3JjL2luZGV4LmQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJ2NsaXBhbmlvbic7XG5leHBvcnQgZGVjbGFyZSBhYnN0cmFjdCBjbGFzcyBCYXNlQXJ0aWZhY3RzQ29tbWFuZCBleHRlbmRzIENvbW1hbmQge1xuICAgIHN0YXRpYyBwYXRoczogc3RyaW5nW11bXTtcbiAgICBzdGF0aWMgdXNhZ2U6IGltcG9ydChcImNsaXBhbmlvblwiKS5Vc2FnZTtcbiAgICBjd2Q6IHN0cmluZztcbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgIG91dHB1dERpcjogc3RyaW5nO1xuICAgIG5wbURpcjogc3RyaW5nO1xuICAgIGJ1aWxkT3V0cHV0RGlyPzogc3RyaW5nO1xuICAgIGdldE9wdGlvbnMoKToge1xuICAgICAgICBjd2Q6IHN0cmluZztcbiAgICAgICAgY29uZmlnUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBwYWNrYWdlSnNvblBhdGg6IHN0cmluZztcbiAgICAgICAgb3V0cHV0RGlyOiBzdHJpbmc7XG4gICAgICAgIG5wbURpcjogc3RyaW5nO1xuICAgICAgICBidWlsZE91dHB1dERpcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIH07XG59XG4vKipcbiAqIENvcHkgYXJ0aWZhY3RzIGZyb20gR2l0aHViIEFjdGlvbnMgaW50byBucG0gcGFja2FnZXMgYW5kIHJlYWR5IHRvIHB1Ymxpc2hcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBcnRpZmFjdHNPcHRpb25zIHtcbiAgICAvKipcbiAgICAgKiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGhcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IHByb2Nlc3MuY3dkKClcbiAgICAgKi9cbiAgICBjd2Q/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgICAqL1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgcGFja2FnZS5qc29uYFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgJ3BhY2thZ2UuanNvbidcbiAgICAgKi9cbiAgICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIGFsbCBidWlsdCBgLm5vZGVgIGZpbGVzIHB1dCwgc2FtZSBhcyBgLS1vdXRwdXQtZGlyYCBvZiBidWlsZCBjb21tYW5kXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAnLi9hcnRpZmFjdHMnXG4gICAgICovXG4gICAgb3V0cHV0RGlyPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gdGhlIGZvbGRlciB3aGVyZSB0aGUgbnBtIHBhY2thZ2VzIHB1dFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgJ25wbSdcbiAgICAgKi9cbiAgICBucG1EaXI/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byB0aGUgYnVpbGQgb3V0cHV0IGRpciwgb25seSBuZWVkZWQgd2hlbiB0YXJnZXRzIGNvbnRhaW5zIGB3YXNtMzItd2FzaS0qYFxuICAgICAqL1xuICAgIGJ1aWxkT3V0cHV0RGlyPzogc3RyaW5nO1xufVxuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gYXBwbHlEZWZhdWx0QXJ0aWZhY3RzT3B0aW9ucyhvcHRpb25zOiBBcnRpZmFjdHNPcHRpb25zKToge1xuICAgIGN3ZDogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICAgKi9cbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgIG91dHB1dERpcjogc3RyaW5nO1xuICAgIG5wbURpcjogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gdGhlIGJ1aWxkIG91dHB1dCBkaXIsIG9ubHkgbmVlZGVkIHdoZW4gdGFyZ2V0cyBjb250YWlucyBgd2FzbTMyLXdhc2ktKmBcbiAgICAgKi9cbiAgICBidWlsZE91dHB1dERpcj86IHN0cmluZztcbn07XG4iLCJpbXBvcnQgeyB0eXBlIEFydGlmYWN0c09wdGlvbnMgfSBmcm9tICcuLi9kZWYvYXJ0aWZhY3RzLmpzJztcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGNvbGxlY3RBcnRpZmFjdHModXNlck9wdGlvbnM6IEFydGlmYWN0c09wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuIiwiaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJ2NsaXBhbmlvbic7XG5leHBvcnQgZGVjbGFyZSBhYnN0cmFjdCBjbGFzcyBCYXNlQnVpbGRDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gICAgc3RhdGljIHBhdGhzOiBzdHJpbmdbXVtdO1xuICAgIHN0YXRpYyB1c2FnZTogaW1wb3J0KFwiY2xpcGFuaW9uXCIpLlVzYWdlO1xuICAgIHRhcmdldD86IHN0cmluZztcbiAgICBjd2Q/OiBzdHJpbmc7XG4gICAgbWFuaWZlc3RQYXRoPzogc3RyaW5nO1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nO1xuICAgIHRhcmdldERpcj86IHN0cmluZztcbiAgICBvdXRwdXREaXI/OiBzdHJpbmc7XG4gICAgcGxhdGZvcm0/OiBib29sZWFuO1xuICAgIGpzUGFja2FnZU5hbWU/OiBzdHJpbmc7XG4gICAgY29uc3RFbnVtPzogYm9vbGVhbjtcbiAgICBydW50aW1lU3RyaW5nRW51bT86IGJvb2xlYW47XG4gICAganNCaW5kaW5nPzogc3RyaW5nO1xuICAgIG5vSnNCaW5kaW5nPzogYm9vbGVhbjtcbiAgICBkdHM/OiBzdHJpbmc7XG4gICAgZHRzSGVhZGVyPzogc3RyaW5nO1xuICAgIG5vRHRzSGVhZGVyPzogYm9vbGVhbjtcbiAgICBkdHNDYWNoZTogYm9vbGVhbjtcbiAgICBlc20/OiBib29sZWFuO1xuICAgIHN0cmlwPzogYm9vbGVhbjtcbiAgICByZWxlYXNlPzogYm9vbGVhbjtcbiAgICB2ZXJib3NlPzogYm9vbGVhbjtcbiAgICBiaW4/OiBzdHJpbmc7XG4gICAgcGFja2FnZT86IHN0cmluZztcbiAgICBwcm9maWxlPzogc3RyaW5nO1xuICAgIGNyb3NzQ29tcGlsZT86IGJvb2xlYW47XG4gICAgdXNlQ3Jvc3M/OiBib29sZWFuO1xuICAgIHVzZU5hcGlDcm9zcz86IGJvb2xlYW47XG4gICAgd2F0Y2g/OiBib29sZWFuO1xuICAgIGZlYXR1cmVzPzogc3RyaW5nW107XG4gICAgYWxsRmVhdHVyZXM/OiBib29sZWFuO1xuICAgIG5vRGVmYXVsdEZlYXR1cmVzPzogYm9vbGVhbjtcbiAgICBnZXRPcHRpb25zKCk6IHtcbiAgICAgICAgdGFyZ2V0OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGN3ZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBtYW5pZmVzdFBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgY29uZmlnUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBwYWNrYWdlSnNvblBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgdGFyZ2V0RGlyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIG91dHB1dERpcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBwbGF0Zm9ybTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgICAgICAganNQYWNrYWdlTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBjb25zdEVudW06IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gICAgICAgIHJ1bnRpbWVTdHJpbmdFbnVtOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICBqc0JpbmRpbmc6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgbm9Kc0JpbmRpbmc6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gICAgICAgIGR0czogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBkdHNIZWFkZXI6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgbm9EdHNIZWFkZXI6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gICAgICAgIGR0c0NhY2hlOiBib29sZWFuO1xuICAgICAgICBlc206IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gICAgICAgIHN0cmlwOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICByZWxlYXNlOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICB2ZXJib3NlOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgICAgICBiaW46IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgcGFja2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBwcm9maWxlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGNyb3NzQ29tcGlsZTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgICAgICAgdXNlQ3Jvc3M6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gICAgICAgIHVzZU5hcGlDcm9zczogYm9vbGVhbiB8IHVuZGVmaW5lZDtcbiAgICAgICAgd2F0Y2g6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gICAgICAgIGZlYXR1cmVzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcbiAgICAgICAgYWxsRmVhdHVyZXM6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG4gICAgICAgIG5vRGVmYXVsdEZlYXR1cmVzOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuICAgIH07XG59XG4vKipcbiAqIEJ1aWxkIHRoZSBOQVBJLVJTIHByb2plY3RcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCdWlsZE9wdGlvbnMge1xuICAgIC8qKlxuICAgICAqIEJ1aWxkIGZvciB0aGUgdGFyZ2V0IHRyaXBsZSwgYnlwYXNzZWQgdG8gYGNhcmdvIGJ1aWxkIC0tdGFyZ2V0YFxuICAgICAqL1xuICAgIHRhcmdldD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGhcbiAgICAgKi9cbiAgICBjd2Q/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgQ2FyZ28udG9tbGBcbiAgICAgKi9cbiAgICBtYW5pZmVzdFBhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgICAqL1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgcGFja2FnZS5qc29uYFxuICAgICAqL1xuICAgIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBEaXJlY3RvcnkgZm9yIGFsbCBjcmF0ZSBnZW5lcmF0ZWQgYXJ0aWZhY3RzLCBzZWUgYGNhcmdvIGJ1aWxkIC0tdGFyZ2V0LWRpcmBcbiAgICAgKi9cbiAgICB0YXJnZXREaXI/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byB3aGVyZSBhbGwgdGhlIGJ1aWx0IGZpbGVzIHdvdWxkIGJlIHB1dC4gRGVmYXVsdCB0byB0aGUgY3JhdGUgZm9sZGVyXG4gICAgICovXG4gICAgb3V0cHV0RGlyPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEFkZCBwbGF0Zm9ybSB0cmlwbGUgdG8gdGhlIGdlbmVyYXRlZCBub2RlanMgYmluZGluZyBmaWxlLCBlZzogYFtuYW1lXS5saW51eC14NjQtZ251Lm5vZGVgXG4gICAgICovXG4gICAgcGxhdGZvcm0/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFBhY2thZ2UgbmFtZSBpbiBnZW5lcmF0ZWQganMgYmluZGluZyBmaWxlLiBPbmx5IHdvcmtzIHdpdGggYC0tcGxhdGZvcm1gIGZsYWdcbiAgICAgKi9cbiAgICBqc1BhY2thZ2VOYW1lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgZ2VuZXJhdGUgY29uc3QgZW51bSBmb3IgdHlwZXNjcmlwdCBiaW5kaW5nc1xuICAgICAqL1xuICAgIGNvbnN0RW51bT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogRW1pdCBgI1tuYXBpKHN0cmluZ19lbnVtKV1gIGVudW1zIGFzIHJ1bnRpbWUgZW51bXMgKGBleHBvcnQgZGVjbGFyZSBlbnVtYCkgdW5kZXIgYC0tbm8tY29uc3QtZW51bWAuIERlZmF1bHQ6IHR5cGUtb25seSB1bmlvbi5cbiAgICAgKi9cbiAgICBydW50aW1lU3RyaW5nRW51bT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogUGF0aCBhbmQgZmlsZW5hbWUgb2YgZ2VuZXJhdGVkIEpTIGJpbmRpbmcgZmlsZS4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnLiBSZWxhdGl2ZSB0byBgLS1vdXRwdXQtZGlyYC5cbiAgICAgKi9cbiAgICBqc0JpbmRpbmc/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogV2hldGhlciB0byBkaXNhYmxlIHRoZSBnZW5lcmF0aW9uIEpTIGJpbmRpbmcgZmlsZS4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnLlxuICAgICAqL1xuICAgIG5vSnNCaW5kaW5nPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBQYXRoIGFuZCBmaWxlbmFtZSBvZiBnZW5lcmF0ZWQgdHlwZSBkZWYgZmlsZS4gUmVsYXRpdmUgdG8gYC0tb3V0cHV0LWRpcmBcbiAgICAgKi9cbiAgICBkdHM/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogQ3VzdG9tIGZpbGUgaGVhZGVyIGZvciBnZW5lcmF0ZWQgdHlwZSBkZWYgZmlsZS4gT25seSB3b3JrcyB3aGVuIGB0eXBlZGVmYCBmZWF0dXJlIGVuYWJsZWQuXG4gICAgICovXG4gICAgZHRzSGVhZGVyPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdG8gZGlzYWJsZSB0aGUgZGVmYXVsdCBmaWxlIGhlYWRlciBmb3IgZ2VuZXJhdGVkIHR5cGUgZGVmIGZpbGUuIE9ubHkgd29ya3Mgd2hlbiBgdHlwZWRlZmAgZmVhdHVyZSBlbmFibGVkLlxuICAgICAqL1xuICAgIG5vRHRzSGVhZGVyPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRvIGVuYWJsZSB0aGUgZHRzIGNhY2hlLCBkZWZhdWx0IHRvIHRydWVcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICBkdHNDYWNoZT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogV2hldGhlciB0byBlbWl0IGFuIEVTTSBKUyBiaW5kaW5nIGZpbGUgaW5zdGVhZCBvZiBDSlMgZm9ybWF0LiBPbmx5IHdvcmtzIHdpdGggYC0tcGxhdGZvcm1gIGZsYWcuXG4gICAgICovXG4gICAgZXNtPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHN0cmlwIHRoZSBsaWJyYXJ5IHRvIGFjaGlldmUgdGhlIG1pbmltdW0gZmlsZSBzaXplXG4gICAgICovXG4gICAgc3RyaXA/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIEJ1aWxkIGluIHJlbGVhc2UgbW9kZVxuICAgICAqL1xuICAgIHJlbGVhc2U/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFZlcmJvc2VseSBsb2cgYnVpbGQgY29tbWFuZCB0cmFjZVxuICAgICAqL1xuICAgIHZlcmJvc2U/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIEJ1aWxkIG9ubHkgdGhlIHNwZWNpZmllZCBiaW5hcnlcbiAgICAgKi9cbiAgICBiaW4/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogQnVpbGQgdGhlIHNwZWNpZmllZCBsaWJyYXJ5IG9yIHRoZSBvbmUgYXQgY3dkXG4gICAgICovXG4gICAgcGFja2FnZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBCdWlsZCBhcnRpZmFjdHMgd2l0aCB0aGUgc3BlY2lmaWVkIHByb2ZpbGVcbiAgICAgKi9cbiAgICBwcm9maWxlPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFtleHBlcmltZW50YWxdIGNyb3NzIGNvbXBpbGUgYnkgcmVwbGFjaW5nIHRoZSBjYXJnbyBzdWJjb21tYW5kOiBXaW5kb3dzIE1TVkMgdGFyZ2V0cyBmcm9tIGEgbm9uLVdpbmRvd3MgaG9zdCBidWlsZCB3aXRoIGBjYXJnby14d2luYCAoYHdpbmRvd3MtZ251YCB0YXJnZXRzIGFyZSByZWplY3RlZCwgYGNhcmdvLXh3aW5gIGNhbm5vdCBoYW5kbGUgdGhlbSksIG5vbi1XaW5kb3dzIHRhcmdldHMgYnVpbGQgd2l0aCBgY2FyZ28temlnYnVpbGRgIChyZXF1aXJlcyBgemlnYCBvbiBQQVRIKS4gVGhlIHNlbGVjdGVkIHN1YmNvbW1hbmQgaXMgYXV0by1pbnN0YWxsZWQgb24gZmlyc3QgdXNlLiBDYW5ub3QgYmUgY29tYmluZWQgd2l0aCBgLS11c2UtY3Jvc3NgLCBgLS11c2UtbmFwaS1jcm9zc2Agb3IgYC0td2F0Y2hgXG4gICAgICovXG4gICAgY3Jvc3NDb21waWxlPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBbZXhwZXJpbWVudGFsXSBub3QgcmVjb21tZW5kZWQsIHByZWZlciBgLS1jcm9zcy1jb21waWxlYCBvciBgLS11c2UtbmFwaS1jcm9zc2A6IGJ1aWxkIGluIGEgRG9ja2VyIG9yIFBvZG1hbiBjb250YWluZXIgd2l0aCBbY3Jvc3NdKGh0dHBzOi8vZ2l0aHViLmNvbS9jcm9zcy1ycy9jcm9zcyksIHdoaWNoIG11c3QgYmUgaW5zdGFsbGVkIG1hbnVhbGx5IGFuZCBuZWVkcyBhIHJ1bm5pbmcgY29udGFpbmVyIGVuZ2luZS4gQ2Fubm90IGJlIGNvbWJpbmVkIHdpdGggYC0tY3Jvc3MtY29tcGlsZWAsIGAtLXVzZS1uYXBpLWNyb3NzYCBvciBgLS13YXRjaGBcbiAgICAgKi9cbiAgICB1c2VDcm9zcz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogW2V4cGVyaW1lbnRhbF0gZG93bmxvYWQgYSBwcmVidWlsdCBnY2MgY3Jvc3MgdG9vbGNoYWluIGZyb20gYEBuYXBpLXJzL2Nyb3NzLXRvb2xjaGFpbmAgKGdsaWJjIDIuMTcpIGFuZCBzZXQgbGlua2VyIGFuZCBDIGNvbXBpbGVyIGVudmlyb25tZW50IHZhcmlhYmxlcy4gTGludXggZ2xpYmMgdGFyZ2V0cyBvbmx5ICh4NjQsIGFybTY0LCBhcm12NywgcHBjNjRsZSwgczM5MHgpIG9uIGEgTGludXggeDY0IG9yIGFybTY0IGhvc3QsIGFueSBvdGhlciB0YXJnZXQgb3IgaG9zdCBlcnJvcnMuIENhbm5vdCBiZSBjb21iaW5lZCB3aXRoIGAtLWNyb3NzLWNvbXBpbGVgIG9yIGAtLXVzZS1jcm9zc2BcbiAgICAgKi9cbiAgICB1c2VOYXBpQ3Jvc3M/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIHdhdGNoIHRoZSBjcmF0ZSBjaGFuZ2VzIGFuZCBidWlsZCBjb250aW51b3VzbHkgd2l0aCBgY2FyZ28td2F0Y2hgIGNyYXRlc1xuICAgICAqL1xuICAgIHdhdGNoPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBTcGFjZS1zZXBhcmF0ZWQgbGlzdCBvZiBmZWF0dXJlcyB0byBhY3RpdmF0ZVxuICAgICAqL1xuICAgIGZlYXR1cmVzPzogc3RyaW5nW107XG4gICAgLyoqXG4gICAgICogQWN0aXZhdGUgYWxsIGF2YWlsYWJsZSBmZWF0dXJlc1xuICAgICAqL1xuICAgIGFsbEZlYXR1cmVzPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBEbyBub3QgYWN0aXZhdGUgdGhlIGBkZWZhdWx0YCBmZWF0dXJlXG4gICAgICovXG4gICAgbm9EZWZhdWx0RmVhdHVyZXM/OiBib29sZWFuO1xufVxuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gYXBwbHlEZWZhdWx0QnVpbGRPcHRpb25zKG9wdGlvbnM6IEJ1aWxkT3B0aW9ucyk6IHtcbiAgICAvKipcbiAgICAgKiBCdWlsZCBmb3IgdGhlIHRhcmdldCB0cmlwbGUsIGJ5cGFzc2VkIHRvIGBjYXJnbyBidWlsZCAtLXRhcmdldGBcbiAgICAgKi9cbiAgICB0YXJnZXQ/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoXG4gICAgICovXG4gICAgY3dkPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYENhcmdvLnRvbWxgXG4gICAgICovXG4gICAgbWFuaWZlc3RQYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICAgKi9cbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYHBhY2thZ2UuanNvbmBcbiAgICAgKi9cbiAgICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogRGlyZWN0b3J5IGZvciBhbGwgY3JhdGUgZ2VuZXJhdGVkIGFydGlmYWN0cywgc2VlIGBjYXJnbyBidWlsZCAtLXRhcmdldC1kaXJgXG4gICAgICovXG4gICAgdGFyZ2V0RGlyPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gd2hlcmUgYWxsIHRoZSBidWlsdCBmaWxlcyB3b3VsZCBiZSBwdXQuIERlZmF1bHQgdG8gdGhlIGNyYXRlIGZvbGRlclxuICAgICAqL1xuICAgIG91dHB1dERpcj86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBBZGQgcGxhdGZvcm0gdHJpcGxlIHRvIHRoZSBnZW5lcmF0ZWQgbm9kZWpzIGJpbmRpbmcgZmlsZSwgZWc6IGBbbmFtZV0ubGludXgteDY0LWdudS5ub2RlYFxuICAgICAqL1xuICAgIHBsYXRmb3JtPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBQYWNrYWdlIG5hbWUgaW4gZ2VuZXJhdGVkIGpzIGJpbmRpbmcgZmlsZS4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnXG4gICAgICovXG4gICAganNQYWNrYWdlTmFtZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIGdlbmVyYXRlIGNvbnN0IGVudW0gZm9yIHR5cGVzY3JpcHQgYmluZGluZ3NcbiAgICAgKi9cbiAgICBjb25zdEVudW0/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIEVtaXQgYCNbbmFwaShzdHJpbmdfZW51bSldYCBlbnVtcyBhcyBydW50aW1lIGVudW1zIChgZXhwb3J0IGRlY2xhcmUgZW51bWApIHVuZGVyIGAtLW5vLWNvbnN0LWVudW1gLiBEZWZhdWx0OiB0eXBlLW9ubHkgdW5pb24uXG4gICAgICovXG4gICAgcnVudGltZVN0cmluZ0VudW0/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFBhdGggYW5kIGZpbGVuYW1lIG9mIGdlbmVyYXRlZCBKUyBiaW5kaW5nIGZpbGUuIE9ubHkgd29ya3Mgd2l0aCBgLS1wbGF0Zm9ybWAgZmxhZy4gUmVsYXRpdmUgdG8gYC0tb3V0cHV0LWRpcmAuXG4gICAgICovXG4gICAganNCaW5kaW5nPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdG8gZGlzYWJsZSB0aGUgZ2VuZXJhdGlvbiBKUyBiaW5kaW5nIGZpbGUuIE9ubHkgd29ya3Mgd2l0aCBgLS1wbGF0Zm9ybWAgZmxhZy5cbiAgICAgKi9cbiAgICBub0pzQmluZGluZz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogUGF0aCBhbmQgZmlsZW5hbWUgb2YgZ2VuZXJhdGVkIHR5cGUgZGVmIGZpbGUuIFJlbGF0aXZlIHRvIGAtLW91dHB1dC1kaXJgXG4gICAgICovXG4gICAgZHRzPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEN1c3RvbSBmaWxlIGhlYWRlciBmb3IgZ2VuZXJhdGVkIHR5cGUgZGVmIGZpbGUuIE9ubHkgd29ya3Mgd2hlbiBgdHlwZWRlZmAgZmVhdHVyZSBlbmFibGVkLlxuICAgICAqL1xuICAgIGR0c0hlYWRlcj86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRvIGRpc2FibGUgdGhlIGRlZmF1bHQgZmlsZSBoZWFkZXIgZm9yIGdlbmVyYXRlZCB0eXBlIGRlZiBmaWxlLiBPbmx5IHdvcmtzIHdoZW4gYHR5cGVkZWZgIGZlYXR1cmUgZW5hYmxlZC5cbiAgICAgKi9cbiAgICBub0R0c0hlYWRlcj86IGJvb2xlYW47XG4gICAgZHRzQ2FjaGU6IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogV2hldGhlciB0byBlbWl0IGFuIEVTTSBKUyBiaW5kaW5nIGZpbGUgaW5zdGVhZCBvZiBDSlMgZm9ybWF0LiBPbmx5IHdvcmtzIHdpdGggYC0tcGxhdGZvcm1gIGZsYWcuXG4gICAgICovXG4gICAgZXNtPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHN0cmlwIHRoZSBsaWJyYXJ5IHRvIGFjaGlldmUgdGhlIG1pbmltdW0gZmlsZSBzaXplXG4gICAgICovXG4gICAgc3RyaXA/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIEJ1aWxkIGluIHJlbGVhc2UgbW9kZVxuICAgICAqL1xuICAgIHJlbGVhc2U/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIFZlcmJvc2VseSBsb2cgYnVpbGQgY29tbWFuZCB0cmFjZVxuICAgICAqL1xuICAgIHZlcmJvc2U/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIEJ1aWxkIG9ubHkgdGhlIHNwZWNpZmllZCBiaW5hcnlcbiAgICAgKi9cbiAgICBiaW4/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogQnVpbGQgdGhlIHNwZWNpZmllZCBsaWJyYXJ5IG9yIHRoZSBvbmUgYXQgY3dkXG4gICAgICovXG4gICAgcGFja2FnZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBCdWlsZCBhcnRpZmFjdHMgd2l0aCB0aGUgc3BlY2lmaWVkIHByb2ZpbGVcbiAgICAgKi9cbiAgICBwcm9maWxlPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFtleHBlcmltZW50YWxdIGNyb3NzIGNvbXBpbGUgYnkgcmVwbGFjaW5nIHRoZSBjYXJnbyBzdWJjb21tYW5kOiBXaW5kb3dzIE1TVkMgdGFyZ2V0cyBmcm9tIGEgbm9uLVdpbmRvd3MgaG9zdCBidWlsZCB3aXRoIGBjYXJnby14d2luYCAoYHdpbmRvd3MtZ251YCB0YXJnZXRzIGFyZSByZWplY3RlZCwgYGNhcmdvLXh3aW5gIGNhbm5vdCBoYW5kbGUgdGhlbSksIG5vbi1XaW5kb3dzIHRhcmdldHMgYnVpbGQgd2l0aCBgY2FyZ28temlnYnVpbGRgIChyZXF1aXJlcyBgemlnYCBvbiBQQVRIKS4gVGhlIHNlbGVjdGVkIHN1YmNvbW1hbmQgaXMgYXV0by1pbnN0YWxsZWQgb24gZmlyc3QgdXNlLiBDYW5ub3QgYmUgY29tYmluZWQgd2l0aCBgLS11c2UtY3Jvc3NgLCBgLS11c2UtbmFwaS1jcm9zc2Agb3IgYC0td2F0Y2hgXG4gICAgICovXG4gICAgY3Jvc3NDb21waWxlPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBbZXhwZXJpbWVudGFsXSBub3QgcmVjb21tZW5kZWQsIHByZWZlciBgLS1jcm9zcy1jb21waWxlYCBvciBgLS11c2UtbmFwaS1jcm9zc2A6IGJ1aWxkIGluIGEgRG9ja2VyIG9yIFBvZG1hbiBjb250YWluZXIgd2l0aCBbY3Jvc3NdKGh0dHBzOi8vZ2l0aHViLmNvbS9jcm9zcy1ycy9jcm9zcyksIHdoaWNoIG11c3QgYmUgaW5zdGFsbGVkIG1hbnVhbGx5IGFuZCBuZWVkcyBhIHJ1bm5pbmcgY29udGFpbmVyIGVuZ2luZS4gQ2Fubm90IGJlIGNvbWJpbmVkIHdpdGggYC0tY3Jvc3MtY29tcGlsZWAsIGAtLXVzZS1uYXBpLWNyb3NzYCBvciBgLS13YXRjaGBcbiAgICAgKi9cbiAgICB1c2VDcm9zcz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogW2V4cGVyaW1lbnRhbF0gZG93bmxvYWQgYSBwcmVidWlsdCBnY2MgY3Jvc3MgdG9vbGNoYWluIGZyb20gYEBuYXBpLXJzL2Nyb3NzLXRvb2xjaGFpbmAgKGdsaWJjIDIuMTcpIGFuZCBzZXQgbGlua2VyIGFuZCBDIGNvbXBpbGVyIGVudmlyb25tZW50IHZhcmlhYmxlcy4gTGludXggZ2xpYmMgdGFyZ2V0cyBvbmx5ICh4NjQsIGFybTY0LCBhcm12NywgcHBjNjRsZSwgczM5MHgpIG9uIGEgTGludXggeDY0IG9yIGFybTY0IGhvc3QsIGFueSBvdGhlciB0YXJnZXQgb3IgaG9zdCBlcnJvcnMuIENhbm5vdCBiZSBjb21iaW5lZCB3aXRoIGAtLWNyb3NzLWNvbXBpbGVgIG9yIGAtLXVzZS1jcm9zc2BcbiAgICAgKi9cbiAgICB1c2VOYXBpQ3Jvc3M/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIHdhdGNoIHRoZSBjcmF0ZSBjaGFuZ2VzIGFuZCBidWlsZCBjb250aW51b3VzbHkgd2l0aCBgY2FyZ28td2F0Y2hgIGNyYXRlc1xuICAgICAqL1xuICAgIHdhdGNoPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBTcGFjZS1zZXBhcmF0ZWQgbGlzdCBvZiBmZWF0dXJlcyB0byBhY3RpdmF0ZVxuICAgICAqL1xuICAgIGZlYXR1cmVzPzogc3RyaW5nW107XG4gICAgLyoqXG4gICAgICogQWN0aXZhdGUgYWxsIGF2YWlsYWJsZSBmZWF0dXJlc1xuICAgICAqL1xuICAgIGFsbEZlYXR1cmVzPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBEbyBub3QgYWN0aXZhdGUgdGhlIGBkZWZhdWx0YCBmZWF0dXJlXG4gICAgICovXG4gICAgbm9EZWZhdWx0RmVhdHVyZXM/OiBib29sZWFuO1xufTtcbiIsImltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zIGFzIFJhd0J1aWxkT3B0aW9ucyB9IGZyb20gJy4uL2RlZi9idWlsZC5qcyc7XG50eXBlIE91dHB1dEtpbmQgPSAnanMnIHwgJ2R0cycgfCAnbm9kZScgfCAnZXhlJyB8ICd3YXNtJztcbnR5cGUgT3V0cHV0ID0ge1xuICAgIGtpbmQ6IE91dHB1dEtpbmQ7XG4gICAgcGF0aDogc3RyaW5nO1xufTtcbnR5cGUgQnVpbGRPcHRpb25zID0gUmF3QnVpbGRPcHRpb25zICYge1xuICAgIGNhcmdvT3B0aW9ucz86IHN0cmluZ1tdO1xufTtcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGJ1aWxkUHJvamVjdChyYXdPcHRpb25zOiBCdWlsZE9wdGlvbnMpOiBQcm9taXNlPHtcbiAgICB0YXNrOiBQcm9taXNlPE91dHB1dFtdPjtcbiAgICBhYm9ydDogKCkgPT4gdm9pZDtcbn0+O1xuLyoqXG4gKiBWYWxpZGF0ZSB0aGUgY29tYmluYXRpb24gb2YgdGhlIGNyb3NzLWNvbXBpbGF0aW9uIHJlbGF0ZWQgZmxhZ3MuXG4gKlxuICogYC0tdXNlLWNyb3NzYCwgYC0tdXNlLW5hcGktY3Jvc3NgIGFuZCBgLS1jcm9zcy1jb21waWxlYCAoYC14YCkgYXJlIHRocmVlXG4gKiBtdXR1YWxseSBleGNsdXNpdmUgY3Jvc3MtY29tcGlsYXRpb24gbWVjaGFuaXNtczsgY29tYmluaW5nIGFueSB0d28gb2YgdGhlbVxuICogbGVhdmVzIGJvdGggYWN0aXZlIGF0IG9uY2UgYW5kIHByb2R1Y2VzIGJyb2tlbiBidWlsZHMsIHNvIGl0IGlzIHJlamVjdGVkXG4gKiB1cGZyb250IGJlZm9yZSBhbnkgc2lkZSBlZmZlY3QgKGxpa2UgYXV0by1pbnN0YWxsaW5nIGNhcmdvIGJpbmFyaWVzIG9yXG4gKiBkb3dubG9hZGluZyB0b29sY2hhaW5zKSBoYXBwZW5zLlxuICpcbiAqIGAtLWNyb3NzLWNvbXBpbGVgIHdpdGggYSBgd2luZG93cy1nbnVgIHRhcmdldCBpcyByZWplY3RlZCBhcyB3ZWxsOiBvbiBhXG4gKiBub24tV2luZG93cyBob3N0IGl0IHJvdXRlcyB0aGUgYnVpbGQgdG8gYGNhcmdvIHh3aW4gYnVpbGRgLCBidXRcbiAqIGBjYXJnby14d2luYCBvbmx5IHNldHMgdXAgTVNWQyB0b29sY2hhaW5zIOKAlCBmb3IgYHdpbmRvd3MtZ251YCB0YXJnZXRzIGl0XG4gKiBzaWxlbnRseSBkb2VzIG5vdGhpbmcgYW5kIHRoZSBidWlsZCBkaWVzIG11Y2ggbGF0ZXIgd2l0aCBhIGNyeXB0aWNcbiAqIGBgZXJyb3I6IGxpbmtlciBgeDg2XzY0LXc2NC1taW5ndzMyLWdjY2Agbm90IGZvdW5kYGAgdGhhdCBuZXZlciBtZW50aW9uc1xuICogYGNhcmdvLXh3aW5gLiBPbmx5IGFuIGV4cGxpY2l0bHkgcmVxdWVzdGVkIHRhcmdldCAoYC0tdGFyZ2V0YCBvclxuICogYENBUkdPX0JVSUxEX1RBUkdFVGApIGlzIGluc3BlY3RlZCwgc28gdGhpcyB2YWxpZGF0aW9uIG5ldmVyIGhhcyB0byBzcGF3blxuICogYHJ1c3RjIC12VmA7IGEgbm9uLVdpbmRvd3MgaG9zdCdzIGRlZmF1bHQgdGFyZ2V0IGNhbiBuZXZlciBiZVxuICogYHdpbmRvd3MtZ251YCBhbnl3YXkuXG4gKi9cbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIHZhbGlkYXRlQ3Jvc3NDb21waWxlRmxhZ3Mob3B0aW9uczoge1xuICAgIHVzZUNyb3NzPzogYm9vbGVhbjtcbiAgICBjcm9zc0NvbXBpbGU/OiBib29sZWFuO1xuICAgIHVzZU5hcGlDcm9zcz86IGJvb2xlYW47XG4gICAgd2F0Y2g/OiBib29sZWFuO1xuICAgIHRhcmdldD86IHN0cmluZztcbn0sIGhvc3RQbGF0Zm9ybT86IHN0cmluZyk6IHZvaWQ7XG4vKipcbiAqIFZhbGlkYXRlIHRoYXQgYC0tdXNlLW5hcGktY3Jvc3NgIGNhbiBhY3R1YWxseSBoYW5kbGUgdGhlIHJlcXVlc3RlZCB0YXJnZXRcbiAqIG9uIHRoZSBjdXJyZW50IGhvc3QuIFRoZSBzdXBwb3J0ZWQgdGFyZ2V0IHNldCBpcyByZWFkIGZyb20gdGhlXG4gKiBgQG5hcGktcnMvY3Jvc3MtdG9vbGNoYWluYCBwYWNrYWdlLCBhbmQgdGhlIHByZS1idWlsdCB0b29sY2hhaW5zIG9ubHkgcnVuXG4gKiBvbiBMaW51eCB4NjQgYW5kIExpbnV4IGFybTY0IGhvc3RzLlxuICovXG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiB2YWxpZGF0ZU5hcGlDcm9zc1N1cHBvcnQodGFyZ2V0VHJpcGxlOiBzdHJpbmcsIGhvc3RQbGF0Zm9ybT86IHN0cmluZywgaG9zdEFyY2g/OiBzdHJpbmcpOiB2b2lkO1xuLyoqXG4gKiBDb21wdXRlIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgdGhhdCByb3V0ZSBhIGAtLXVzZS1uYXBpLWNyb3NzYCBidWlsZFxuICogdGhyb3VnaCB0aGUgYEBuYXBpLXJzL2Nyb3NzLXRvb2xjaGFpbmAgdG9vbGNoYWluIGV4dHJhY3RlZCBhdFxuICogYHRvb2xjaGFpblBhdGhgLlxuICpcbiAqIEZvbGxvd3MgdGhlIHNhbWUgcnVsZSBhcyBgQnVpbGRlciNzZXRFbnZJZk5vdEV4aXN0c2A6IGEgdmFyaWFibGUgdGhlIHVzZXJcbiAqIGFscmVhZHkgc2V0IGluIGBlbnZgIHdpbnMgYW5kIGlzIG5vdCByZXR1cm5lZCwgYW5kIGEgcHJlc2VudC1idXQtZW1wdHlcbiAqIHZhcmlhYmxlIGNvdW50cyBhcyB1bnNldCAoZmFsc3kgc2VtYW50aWNzKS4gVGhlIG9ubHkgZXhjZXB0aW9ucyBhcmUgdGhlXG4gKiBjbGFuZy1zcGVjaWZpYyBgVEFSR0VUX0NGTEFHU2AvYFRBUkdFVF9DWFhGTEFHU2AsIHdoaWNoIHByZXBlbmQgdGhlIHN5c3Jvb3RcbiAqIGZsYWdzIHRvIHRoZSB1c2VyJ3MgdmFsdWUsIGFuZCBgUEFUSGAsIHdoaWNoIGFsd2F5cyBnZXRzIHRoZSB0b29sY2hhaW5cbiAqIGBiaW5gIGRpcmVjdG9yeSBwcmVwZW5kZWQuXG4gKlxuICogRXhwb3J0ZWQgZm9yIHRlc3RzLlxuICovXG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBuYXBpQ3Jvc3NUb29sY2hhaW5FbnZzKHRvb2xjaGFpblBhdGg6IHN0cmluZywgdGFyZ2V0VHJpcGxlOiBzdHJpbmcsIGVudj86IE5vZGVKUy5Qcm9jZXNzRW52KTogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbmV4cG9ydCBpbnRlcmZhY2UgV3JpdGVKc0JpbmRpbmdPcHRpb25zIHtcbiAgICBwbGF0Zm9ybT86IGJvb2xlYW47XG4gICAgbm9Kc0JpbmRpbmc/OiBib29sZWFuO1xuICAgIGlkZW50czogc3RyaW5nW107XG4gICAganNCaW5kaW5nPzogc3RyaW5nO1xuICAgIGVzbT86IGJvb2xlYW47XG4gICAgYmluYXJ5TmFtZTogc3RyaW5nO1xuICAgIHBhY2thZ2VOYW1lOiBzdHJpbmc7XG4gICAgdmVyc2lvbjogc3RyaW5nO1xuICAgIG91dHB1dERpcjogc3RyaW5nO1xufVxuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gd3JpdGVKc0JpbmRpbmcob3B0aW9uczogV3JpdGVKc0JpbmRpbmdPcHRpb25zKTogUHJvbWlzZTxPdXRwdXQgfCB1bmRlZmluZWQ+O1xuZXhwb3J0IGludGVyZmFjZSBHZW5lcmF0ZVR5cGVEZWZPcHRpb25zIHtcbiAgICB0eXBlRGVmRGlyOiBzdHJpbmc7XG4gICAgbm9EdHNIZWFkZXI/OiBib29sZWFuO1xuICAgIGR0c0hlYWRlcj86IHN0cmluZztcbiAgICBkdHNIZWFkZXJGaWxlPzogc3RyaW5nO1xuICAgIGNvbmZpZ0R0c0hlYWRlcj86IHN0cmluZztcbiAgICBjb25maWdEdHNIZWFkZXJGaWxlPzogc3RyaW5nO1xuICAgIGNvbnN0RW51bT86IGJvb2xlYW47XG4gICAgcnVudGltZVN0cmluZ0VudW0/OiBib29sZWFuO1xuICAgIGN3ZDogc3RyaW5nO1xufVxuLyoqXG4gKiBXYWxrIHRoZSBuYXBpLWRlcml2ZSBpbnRlcm1lZGlhdGUgdHlwZS1kZWYgZGlyZWN0b3J5LCByZW5kZXIgZXZlcnkgZW50cnlcbiAqIGludG8gVHlwZVNjcmlwdCB2aWEge0BsaW5rIHByb2Nlc3NUeXBlRGVmfSwgYW5kIHJldHVybiB0aGUgY29uY2F0ZW5hdGVkXG4gKiBgLmQudHNgIHNvdXJjZSBwbHVzIHRoZSBsaXN0IG9mIGlkZW50aWZpZXJzIHRvIHJlLWV4cG9ydCBmcm9tXG4gKiBgaW5kZXguanNgLlxuICovXG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBnZW5lcmF0ZVR5cGVEZWYob3B0aW9uczogR2VuZXJhdGVUeXBlRGVmT3B0aW9ucyk6IFByb21pc2U8e1xuICAgIGV4cG9ydHM6IHN0cmluZ1tdO1xuICAgIGR0czogc3RyaW5nO1xufT47XG5leHBvcnQge307XG4iLCJpbXBvcnQgeyBDb21tYW5kIH0gZnJvbSAnY2xpcGFuaW9uJztcbmV4cG9ydCBkZWNsYXJlIGFic3RyYWN0IGNsYXNzIEJhc2VDcmVhdGVOcG1EaXJzQ29tbWFuZCBleHRlbmRzIENvbW1hbmQge1xuICAgIHN0YXRpYyBwYXRoczogc3RyaW5nW11bXTtcbiAgICBzdGF0aWMgdXNhZ2U6IGltcG9ydChcImNsaXBhbmlvblwiKS5Vc2FnZTtcbiAgICBjd2Q6IHN0cmluZztcbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgIG5wbURpcjogc3RyaW5nO1xuICAgIGRyeVJ1bjogYm9vbGVhbjtcbiAgICBnZXRPcHRpb25zKCk6IHtcbiAgICAgICAgY3dkOiBzdHJpbmc7XG4gICAgICAgIGNvbmZpZ1BhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgICAgIG5wbURpcjogc3RyaW5nO1xuICAgICAgICBkcnlSdW46IGJvb2xlYW47XG4gICAgfTtcbn1cbi8qKlxuICogQ3JlYXRlIG5wbSBwYWNrYWdlIGRpcnMgZm9yIGRpZmZlcmVudCBwbGF0Zm9ybXNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDcmVhdGVOcG1EaXJzT3B0aW9ucyB7XG4gICAgLyoqXG4gICAgICogVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCBwcm9jZXNzLmN3ZCgpXG4gICAgICovXG4gICAgY3dkPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICAgKi9cbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYHBhY2thZ2UuanNvbmBcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICdwYWNrYWdlLmpzb24nXG4gICAgICovXG4gICAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gdGhlIGZvbGRlciB3aGVyZSB0aGUgbnBtIHBhY2thZ2VzIHB1dFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgJ25wbSdcbiAgICAgKi9cbiAgICBucG1EaXI/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogRHJ5IHJ1biB3aXRob3V0IHRvdWNoaW5nIGZpbGUgc3lzdGVtXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgICAqL1xuICAgIGRyeVJ1bj86IGJvb2xlYW47XG59XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBhcHBseURlZmF1bHRDcmVhdGVOcG1EaXJzT3B0aW9ucyhvcHRpb25zOiBDcmVhdGVOcG1EaXJzT3B0aW9ucyk6IHtcbiAgICBjd2Q6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAgICovXG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICBwYWNrYWdlSnNvblBhdGg6IHN0cmluZztcbiAgICBucG1EaXI6IHN0cmluZztcbiAgICBkcnlSdW46IGJvb2xlYW47XG59O1xuIiwiaW1wb3J0IHsgdHlwZSBDcmVhdGVOcG1EaXJzT3B0aW9ucyB9IGZyb20gJy4uL2RlZi9jcmVhdGUtbnBtLWRpcnMuanMnO1xuZXhwb3J0IGludGVyZmFjZSBQYWNrYWdlTWV0YSB7XG4gICAgJ2Rpc3QtdGFncyc6IHtcbiAgICAgICAgW2luZGV4OiBzdHJpbmddOiBzdHJpbmc7XG4gICAgfTtcbn1cbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGNyZWF0ZU5wbURpcnModXNlck9wdGlvbnM6IENyZWF0ZU5wbURpcnNPcHRpb25zKTogUHJvbWlzZTx2b2lkPjtcbiIsImltcG9ydCB7IENvbW1hbmQgfSBmcm9tICdjbGlwYW5pb24nO1xuZXhwb3J0IGRlY2xhcmUgYWJzdHJhY3QgY2xhc3MgQmFzZU5ld0NvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcbiAgICBzdGF0aWMgcGF0aHM6IHN0cmluZ1tdW107XG4gICAgc3RhdGljIHVzYWdlOiBpbXBvcnQoXCJjbGlwYW5pb25cIikuVXNhZ2U7XG4gICAgJCRwYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgJCRuYW1lPzogc3RyaW5nO1xuICAgIG1pbk5vZGVBcGlWZXJzaW9uOiBudW1iZXI7XG4gICAgcGFja2FnZU1hbmFnZXI6IHN0cmluZztcbiAgICBsaWNlbnNlOiBzdHJpbmc7XG4gICAgdGFyZ2V0czogc3RyaW5nW107XG4gICAgZW5hYmxlRGVmYXVsdFRhcmdldHM6IGJvb2xlYW47XG4gICAgZW5hYmxlQWxsVGFyZ2V0czogYm9vbGVhbjtcbiAgICBlbmFibGVUeXBlRGVmOiBib29sZWFuO1xuICAgIGVuYWJsZUdpdGh1YkFjdGlvbnM6IGJvb2xlYW47XG4gICAgdGVzdEZyYW1ld29yazogc3RyaW5nO1xuICAgIGRyeVJ1bjogYm9vbGVhbjtcbiAgICBnZXRPcHRpb25zKCk6IHtcbiAgICAgICAgcGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgICBuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIG1pbk5vZGVBcGlWZXJzaW9uOiBudW1iZXI7XG4gICAgICAgIHBhY2thZ2VNYW5hZ2VyOiBzdHJpbmc7XG4gICAgICAgIGxpY2Vuc2U6IHN0cmluZztcbiAgICAgICAgdGFyZ2V0czogc3RyaW5nW107XG4gICAgICAgIGVuYWJsZURlZmF1bHRUYXJnZXRzOiBib29sZWFuO1xuICAgICAgICBlbmFibGVBbGxUYXJnZXRzOiBib29sZWFuO1xuICAgICAgICBlbmFibGVUeXBlRGVmOiBib29sZWFuO1xuICAgICAgICBlbmFibGVHaXRodWJBY3Rpb25zOiBib29sZWFuO1xuICAgICAgICB0ZXN0RnJhbWV3b3JrOiBzdHJpbmc7XG4gICAgICAgIGRyeVJ1bjogYm9vbGVhbjtcbiAgICB9O1xufVxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgcHJvamVjdCB3aXRoIHByZS1jb25maWd1cmVkIGJvaWxlcnBsYXRlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTmV3T3B0aW9ucyB7XG4gICAgLyoqXG4gICAgICogVGhlIHBhdGggd2hlcmUgdGhlIE5BUEktUlMgcHJvamVjdCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgICovXG4gICAgcGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbmFtZSBvZiB0aGUgcHJvamVjdCwgZGVmYXVsdCB0byB0aGUgbmFtZSBvZiB0aGUgZGlyZWN0b3J5IGlmIG5vdCBwcm92aWRlZFxuICAgICAqL1xuICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIG1pbmltdW0gTm9kZS1BUEkgdmVyc2lvbiB0byBzdXBwb3J0XG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCA0XG4gICAgICovXG4gICAgbWluTm9kZUFwaVZlcnNpb24/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogVGhlIHBhY2thZ2UgbWFuYWdlciB0byB1c2UuIE9ubHkgc3VwcG9ydCB5YXJuIDQueCBmb3Igbm93LlxuICAgICAqXG4gICAgICogQGRlZmF1bHQgJ3lhcm4nXG4gICAgICovXG4gICAgcGFja2FnZU1hbmFnZXI/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogTGljZW5zZSBmb3Igb3Blbi1zb3VyY2VkIHByb2plY3RcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICdNSVQnXG4gICAgICovXG4gICAgbGljZW5zZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBBbGwgdGFyZ2V0cyB0aGUgY3JhdGUgd2lsbCBiZSBjb21waWxlZCBmb3IuXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCBbXVxuICAgICAqL1xuICAgIHRhcmdldHM/OiBzdHJpbmdbXTtcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIGVuYWJsZSBkZWZhdWx0IHRhcmdldHNcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICBlbmFibGVEZWZhdWx0VGFyZ2V0cz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogV2hldGhlciBlbmFibGUgYWxsIHRhcmdldHNcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IGZhbHNlXG4gICAgICovXG4gICAgZW5hYmxlQWxsVGFyZ2V0cz86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogV2hldGhlciBlbmFibGUgdGhlIGB0eXBlLWRlZmAgZmVhdHVyZSBmb3IgdHlwZXNjcmlwdCBkZWZpbml0aW9ucyBhdXRvLWdlbmVyYXRpb25cbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICBlbmFibGVUeXBlRGVmPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIGdlbmVyYXRlIHByZWNvbmZpZ3VyZWQgR2l0SHViIEFjdGlvbnMgd29ya2Zsb3dcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IHRydWVcbiAgICAgKi9cbiAgICBlbmFibGVHaXRodWJBY3Rpb25zPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBUaGUgSmF2YVNjcmlwdCB0ZXN0IGZyYW1ld29yayB0byB1c2UsIG9ubHkgc3VwcG9ydCBgYXZhYCBmb3Igbm93XG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAnYXZhJ1xuICAgICAqL1xuICAgIHRlc3RGcmFtZXdvcms/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogV2hldGhlciB0byBydW4gdGhlIGNvbW1hbmQgaW4gZHJ5LXJ1biBtb2RlXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgICAqL1xuICAgIGRyeVJ1bj86IGJvb2xlYW47XG59XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBhcHBseURlZmF1bHROZXdPcHRpb25zKG9wdGlvbnM6IE5ld09wdGlvbnMpOiB7XG4gICAgLyoqXG4gICAgICogVGhlIHBhdGggd2hlcmUgdGhlIE5BUEktUlMgcHJvamVjdCB3aWxsIGJlIGNyZWF0ZWQuXG4gICAgICovXG4gICAgcGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbmFtZSBvZiB0aGUgcHJvamVjdCwgZGVmYXVsdCB0byB0aGUgbmFtZSBvZiB0aGUgZGlyZWN0b3J5IGlmIG5vdCBwcm92aWRlZFxuICAgICAqL1xuICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgbWluTm9kZUFwaVZlcnNpb246IG51bWJlcjtcbiAgICBwYWNrYWdlTWFuYWdlcjogc3RyaW5nO1xuICAgIGxpY2Vuc2U6IHN0cmluZztcbiAgICB0YXJnZXRzOiBzdHJpbmdbXTtcbiAgICBlbmFibGVEZWZhdWx0VGFyZ2V0czogYm9vbGVhbjtcbiAgICBlbmFibGVBbGxUYXJnZXRzOiBib29sZWFuO1xuICAgIGVuYWJsZVR5cGVEZWY6IGJvb2xlYW47XG4gICAgZW5hYmxlR2l0aHViQWN0aW9uczogYm9vbGVhbjtcbiAgICB0ZXN0RnJhbWV3b3JrOiBzdHJpbmc7XG4gICAgZHJ5UnVuOiBib29sZWFuO1xufTtcbiIsImltcG9ydCB7IHR5cGUgTmV3T3B0aW9ucyBhcyBSYXdOZXdPcHRpb25zIH0gZnJvbSAnLi4vZGVmL25ldy5qcyc7XG50eXBlIE5ld09wdGlvbnMgPSBSZXF1aXJlZDxSYXdOZXdPcHRpb25zPjtcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIHVwZGF0ZUNhcmdvVG9tbE5vZGVBcGlWZXJzaW9uKGZpbGVQYXRoOiBzdHJpbmcsIG1pbk5vZGVBcGlWZXJzaW9uOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+O1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gbmV3UHJvamVjdCh1c2VyT3B0aW9uczogUmF3TmV3T3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5leHBvcnQgdHlwZSB7IE5ld09wdGlvbnMgfTtcbiIsImltcG9ydCB7IENvbW1hbmQgfSBmcm9tICdjbGlwYW5pb24nO1xuZXhwb3J0IGRlY2xhcmUgYWJzdHJhY3QgY2xhc3MgQmFzZVByZVB1Ymxpc2hDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gICAgc3RhdGljIHBhdGhzOiBzdHJpbmdbXVtdO1xuICAgIHN0YXRpYyB1c2FnZTogaW1wb3J0KFwiY2xpcGFuaW9uXCIpLlVzYWdlO1xuICAgIGN3ZDogc3RyaW5nO1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgbnBtRGlyOiBzdHJpbmc7XG4gICAgdGFnU3R5bGU6IHN0cmluZztcbiAgICBnaFJlbGVhc2U6IGJvb2xlYW47XG4gICAgZ2hSZWxlYXNlTmFtZT86IHN0cmluZztcbiAgICBnaFJlbGVhc2VJZD86IHN0cmluZztcbiAgICBza2lwT3B0aW9uYWxQdWJsaXNoOiBib29sZWFuO1xuICAgIGRyeVJ1bjogYm9vbGVhbjtcbiAgICBnZXRPcHRpb25zKCk6IHtcbiAgICAgICAgY3dkOiBzdHJpbmc7XG4gICAgICAgIGNvbmZpZ1BhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgICAgIG5wbURpcjogc3RyaW5nO1xuICAgICAgICB0YWdTdHlsZTogc3RyaW5nO1xuICAgICAgICBnaFJlbGVhc2U6IGJvb2xlYW47XG4gICAgICAgIGdoUmVsZWFzZU5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgZ2hSZWxlYXNlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgc2tpcE9wdGlvbmFsUHVibGlzaDogYm9vbGVhbjtcbiAgICAgICAgZHJ5UnVuOiBib29sZWFuO1xuICAgIH07XG59XG4vKipcbiAqIFVwZGF0ZSBwYWNrYWdlLmpzb24gYW5kIGNvcHkgYWRkb25zIGludG8gcGVyIHBsYXRmb3JtIHBhY2thZ2VzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHJlUHVibGlzaE9wdGlvbnMge1xuICAgIC8qKlxuICAgICAqIFRoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgcHJvY2Vzcy5jd2QoKVxuICAgICAqL1xuICAgIGN3ZD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAgICovXG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBwYWNrYWdlLmpzb25gXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAncGFja2FnZS5qc29uJ1xuICAgICAqL1xuICAgIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgdGhlIG5wbSBwYWNrYWdlcyBwdXRcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICducG0nXG4gICAgICovXG4gICAgbnBtRGlyPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIGdpdCB0YWcgc3R5bGUsIGBucG1gIG9yIGBsZXJuYWBcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICdsZXJuYSdcbiAgICAgKi9cbiAgICB0YWdTdHlsZT86ICducG0nIHwgJ2xlcm5hJztcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIGNyZWF0ZSBHaXRIdWIgcmVsZWFzZVxuICAgICAqXG4gICAgICogQGRlZmF1bHQgdHJ1ZVxuICAgICAqL1xuICAgIGdoUmVsZWFzZT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogR2l0SHViIHJlbGVhc2UgbmFtZVxuICAgICAqL1xuICAgIGdoUmVsZWFzZU5hbWU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogRXhpc3RpbmcgR2l0SHViIHJlbGVhc2UgaWRcbiAgICAgKi9cbiAgICBnaFJlbGVhc2VJZD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHNraXAgb3B0aW9uYWxEZXBlbmRlbmNpZXMgcGFja2FnZXMgcHVibGlzaFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgZmFsc2VcbiAgICAgKi9cbiAgICBza2lwT3B0aW9uYWxQdWJsaXNoPzogYm9vbGVhbjtcbiAgICAvKipcbiAgICAgKiBEcnkgcnVuIHdpdGhvdXQgdG91Y2hpbmcgZmlsZSBzeXN0ZW1cbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IGZhbHNlXG4gICAgICovXG4gICAgZHJ5UnVuPzogYm9vbGVhbjtcbn1cbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGFwcGx5RGVmYXVsdFByZVB1Ymxpc2hPcHRpb25zKG9wdGlvbnM6IFByZVB1Ymxpc2hPcHRpb25zKToge1xuICAgIGN3ZDogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICAgKi9cbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgIG5wbURpcjogc3RyaW5nO1xuICAgIHRhZ1N0eWxlOiBzdHJpbmc7XG4gICAgZ2hSZWxlYXNlOiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIEdpdEh1YiByZWxlYXNlIG5hbWVcbiAgICAgKi9cbiAgICBnaFJlbGVhc2VOYW1lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEV4aXN0aW5nIEdpdEh1YiByZWxlYXNlIGlkXG4gICAgICovXG4gICAgZ2hSZWxlYXNlSWQ/OiBzdHJpbmc7XG4gICAgc2tpcE9wdGlvbmFsUHVibGlzaDogYm9vbGVhbjtcbiAgICBkcnlSdW46IGJvb2xlYW47XG59O1xuIiwiaW1wb3J0IHsgdHlwZSBQcmVQdWJsaXNoT3B0aW9ucyB9IGZyb20gJy4uL2RlZi9wcmUtcHVibGlzaC5qcyc7XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBwcmVQdWJsaXNoKHVzZXJPcHRpb25zOiBQcmVQdWJsaXNoT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG4iLCJpbXBvcnQgeyBDb21tYW5kIH0gZnJvbSAnY2xpcGFuaW9uJztcbmV4cG9ydCBkZWNsYXJlIGFic3RyYWN0IGNsYXNzIEJhc2VSZW5hbWVDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gICAgc3RhdGljIHBhdGhzOiBzdHJpbmdbXVtdO1xuICAgIHN0YXRpYyB1c2FnZTogaW1wb3J0KFwiY2xpcGFuaW9uXCIpLlVzYWdlO1xuICAgIGN3ZDogc3RyaW5nO1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgbnBtRGlyOiBzdHJpbmc7XG4gICAgJCRuYW1lPzogc3RyaW5nO1xuICAgIGJpbmFyeU5hbWU/OiBzdHJpbmc7XG4gICAgcGFja2FnZU5hbWU/OiBzdHJpbmc7XG4gICAgbWFuaWZlc3RQYXRoOiBzdHJpbmc7XG4gICAgcmVwb3NpdG9yeT86IHN0cmluZztcbiAgICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgICBnZXRPcHRpb25zKCk6IHtcbiAgICAgICAgY3dkOiBzdHJpbmc7XG4gICAgICAgIGNvbmZpZ1BhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgICAgIG5wbURpcjogc3RyaW5nO1xuICAgICAgICBuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIGJpbmFyeU5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgcGFja2FnZU5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgbWFuaWZlc3RQYXRoOiBzdHJpbmc7XG4gICAgICAgIHJlcG9zaXRvcnk6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgZGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICB9O1xufVxuLyoqXG4gKiBSZW5hbWUgdGhlIE5BUEktUlMgcHJvamVjdFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFJlbmFtZU9wdGlvbnMge1xuICAgIC8qKlxuICAgICAqIFRoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgcHJvY2Vzcy5jd2QoKVxuICAgICAqL1xuICAgIGN3ZD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAgICovXG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBwYWNrYWdlLmpzb25gXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAncGFja2FnZS5qc29uJ1xuICAgICAqL1xuICAgIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgdGhlIG5wbSBwYWNrYWdlcyBwdXRcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICducG0nXG4gICAgICovXG4gICAgbnBtRGlyPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFRoZSBuZXcgbmFtZSBvZiB0aGUgcHJvamVjdFxuICAgICAqL1xuICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIG5ldyBiaW5hcnkgbmFtZSAqLm5vZGUgZmlsZXNcbiAgICAgKi9cbiAgICBiaW5hcnlOYW1lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFRoZSBuZXcgcGFja2FnZSBuYW1lIG9mIHRoZSBwcm9qZWN0XG4gICAgICovXG4gICAgcGFja2FnZU5hbWU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgQ2FyZ28udG9tbGBcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICdDYXJnby50b21sJ1xuICAgICAqL1xuICAgIG1hbmlmZXN0UGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbmV3IHJlcG9zaXRvcnkgb2YgdGhlIHByb2plY3RcbiAgICAgKi9cbiAgICByZXBvc2l0b3J5Pzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFRoZSBuZXcgZGVzY3JpcHRpb24gb2YgdGhlIHByb2plY3RcbiAgICAgKi9cbiAgICBkZXNjcmlwdGlvbj86IHN0cmluZztcbn1cbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGFwcGx5RGVmYXVsdFJlbmFtZU9wdGlvbnMob3B0aW9uczogUmVuYW1lT3B0aW9ucyk6IHtcbiAgICBjd2Q6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAgICovXG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICBwYWNrYWdlSnNvblBhdGg6IHN0cmluZztcbiAgICBucG1EaXI6IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbmV3IG5hbWUgb2YgdGhlIHByb2plY3RcbiAgICAgKi9cbiAgICBuYW1lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFRoZSBuZXcgYmluYXJ5IG5hbWUgKi5ub2RlIGZpbGVzXG4gICAgICovXG4gICAgYmluYXJ5TmFtZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgbmV3IHBhY2thZ2UgbmFtZSBvZiB0aGUgcHJvamVjdFxuICAgICAqL1xuICAgIHBhY2thZ2VOYW1lPzogc3RyaW5nO1xuICAgIG1hbmlmZXN0UGF0aDogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFRoZSBuZXcgcmVwb3NpdG9yeSBvZiB0aGUgcHJvamVjdFxuICAgICAqL1xuICAgIHJlcG9zaXRvcnk/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIG5ldyBkZXNjcmlwdGlvbiBvZiB0aGUgcHJvamVjdFxuICAgICAqL1xuICAgIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xufTtcbiIsImltcG9ydCB7IHR5cGUgUmVuYW1lT3B0aW9ucyB9IGZyb20gJy4uL2RlZi9yZW5hbWUuanMnO1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gcmVuYW1lUHJvamVjdCh1c2VyT3B0aW9uczogUmVuYW1lT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG4iLCJpbXBvcnQgeyBDb21tYW5kIH0gZnJvbSAnY2xpcGFuaW9uJztcbmV4cG9ydCBkZWNsYXJlIGFic3RyYWN0IGNsYXNzIEJhc2VVbml2ZXJzYWxpemVDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gICAgc3RhdGljIHBhdGhzOiBzdHJpbmdbXVtdO1xuICAgIHN0YXRpYyB1c2FnZTogaW1wb3J0KFwiY2xpcGFuaW9uXCIpLlVzYWdlO1xuICAgIGN3ZDogc3RyaW5nO1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgb3V0cHV0RGlyOiBzdHJpbmc7XG4gICAgZ2V0T3B0aW9ucygpOiB7XG4gICAgICAgIGN3ZDogc3RyaW5nO1xuICAgICAgICBjb25maWdQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgICAgICBvdXRwdXREaXI6IHN0cmluZztcbiAgICB9O1xufVxuLyoqXG4gKiBDb21iaWxlIGJ1aWx0IGJpbmFyaWVzIGludG8gb25lIHVuaXZlcnNhbCBiaW5hcnlcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBVbml2ZXJzYWxpemVPcHRpb25zIHtcbiAgICAvKipcbiAgICAgKiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGhcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0IHByb2Nlc3MuY3dkKClcbiAgICAgKi9cbiAgICBjd2Q/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgICAqL1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgcGFja2FnZS5qc29uYFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgJ3BhY2thZ2UuanNvbidcbiAgICAgKi9cbiAgICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIGFsbCBidWlsdCBgLm5vZGVgIGZpbGVzIHB1dCwgc2FtZSBhcyBgLS1vdXRwdXQtZGlyYCBvZiBidWlsZCBjb21tYW5kXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAnLi8nXG4gICAgICovXG4gICAgb3V0cHV0RGlyPzogc3RyaW5nO1xufVxuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gYXBwbHlEZWZhdWx0VW5pdmVyc2FsaXplT3B0aW9ucyhvcHRpb25zOiBVbml2ZXJzYWxpemVPcHRpb25zKToge1xuICAgIGN3ZDogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICAgKi9cbiAgICBjb25maWdQYXRoPzogc3RyaW5nO1xuICAgIHBhY2thZ2VKc29uUGF0aDogc3RyaW5nO1xuICAgIG91dHB1dERpcjogc3RyaW5nO1xufTtcbiIsImltcG9ydCB7IHR5cGUgVW5pdmVyc2FsaXplT3B0aW9ucyB9IGZyb20gJy4uL2RlZi91bml2ZXJzYWxpemUuanMnO1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gdW5pdmVyc2FsaXplQmluYXJpZXModXNlck9wdGlvbnM6IFVuaXZlcnNhbGl6ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuIiwiaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJ2NsaXBhbmlvbic7XG5leHBvcnQgZGVjbGFyZSBhYnN0cmFjdCBjbGFzcyBCYXNlVmVyc2lvbkNvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcbiAgICBzdGF0aWMgcGF0aHM6IHN0cmluZ1tdW107XG4gICAgc3RhdGljIHVzYWdlOiBpbXBvcnQoXCJjbGlwYW5pb25cIikuVXNhZ2U7XG4gICAgY3dkOiBzdHJpbmc7XG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICBwYWNrYWdlSnNvblBhdGg6IHN0cmluZztcbiAgICBucG1EaXI6IHN0cmluZztcbiAgICBnZXRPcHRpb25zKCk6IHtcbiAgICAgICAgY3dkOiBzdHJpbmc7XG4gICAgICAgIGNvbmZpZ1BhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgICAgIG5wbURpcjogc3RyaW5nO1xuICAgIH07XG59XG4vKipcbiAqIFVwZGF0ZSB2ZXJzaW9uIGluIGNyZWF0ZWQgbnBtIHBhY2thZ2VzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVmVyc2lvbk9wdGlvbnMge1xuICAgIC8qKlxuICAgICAqIFRoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aFxuICAgICAqXG4gICAgICogQGRlZmF1bHQgcHJvY2Vzcy5jd2QoKVxuICAgICAqL1xuICAgIGN3ZD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAgICovXG4gICAgY29uZmlnUGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIGBwYWNrYWdlLmpzb25gXG4gICAgICpcbiAgICAgKiBAZGVmYXVsdCAncGFja2FnZS5qc29uJ1xuICAgICAqL1xuICAgIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgdGhlIG5wbSBwYWNrYWdlcyBwdXRcbiAgICAgKlxuICAgICAqIEBkZWZhdWx0ICducG0nXG4gICAgICovXG4gICAgbnBtRGlyPzogc3RyaW5nO1xufVxuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gYXBwbHlEZWZhdWx0VmVyc2lvbk9wdGlvbnMob3B0aW9uczogVmVyc2lvbk9wdGlvbnMpOiB7XG4gICAgY3dkOiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgICAqL1xuICAgIGNvbmZpZ1BhdGg/OiBzdHJpbmc7XG4gICAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmc7XG4gICAgbnBtRGlyOiBzdHJpbmc7XG59O1xuIiwiaW1wb3J0IHsgdHlwZSBWZXJzaW9uT3B0aW9ucyB9IGZyb20gJy4uL2RlZi92ZXJzaW9uLmpzJztcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIHZlcnNpb24odXNlck9wdGlvbnM6IFZlcnNpb25PcHRpb25zKTogUHJvbWlzZTx2b2lkPjtcbiIsImltcG9ydCB7IEJhc2VBcnRpZmFjdHNDb21tYW5kIH0gZnJvbSAnLi4vZGVmL2FydGlmYWN0cy5qcyc7XG5leHBvcnQgZGVjbGFyZSBjbGFzcyBBcnRpZmFjdHNDb21tYW5kIGV4dGVuZHMgQmFzZUFydGlmYWN0c0NvbW1hbmQge1xuICAgIHN0YXRpYyB1c2FnZTogaW1wb3J0KFwiY2xpcGFuaW9uXCIpLlVzYWdlO1xuICAgIHN0YXRpYyBwYXRoczogc3RyaW5nW11bXTtcbiAgICBleGVjdXRlKCk6IFByb21pc2U8dm9pZD47XG59XG4iLCJpbXBvcnQgeyBCYXNlQnVpbGRDb21tYW5kIH0gZnJvbSAnLi4vZGVmL2J1aWxkLmpzJztcbmV4cG9ydCBkZWNsYXJlIGNsYXNzIEJ1aWxkQ29tbWFuZCBleHRlbmRzIEJhc2VCdWlsZENvbW1hbmQge1xuICAgIHBpcGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBjYXJnb09wdGlvbnM6IHN0cmluZ1tdO1xuICAgIGV4ZWN1dGUoKTogUHJvbWlzZTx2b2lkPjtcbn1cbiIsImltcG9ydCB7IEJhc2VDcmVhdGVOcG1EaXJzQ29tbWFuZCB9IGZyb20gJy4uL2RlZi9jcmVhdGUtbnBtLWRpcnMuanMnO1xuZXhwb3J0IGRlY2xhcmUgY2xhc3MgQ3JlYXRlTnBtRGlyc0NvbW1hbmQgZXh0ZW5kcyBCYXNlQ3JlYXRlTnBtRGlyc0NvbW1hbmQge1xuICAgIGV4ZWN1dGUoKTogUHJvbWlzZTx2b2lkPjtcbn1cbiIsImltcG9ydCB7IEJhc2VOZXdDb21tYW5kIH0gZnJvbSAnLi4vZGVmL25ldy5qcyc7XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBnZXROYXBpVmVyc2lvbkNob2ljZXMoKToge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICB2YWx1ZTogaW1wb3J0KFwiLi4vdXRpbHMvdmVyc2lvbi5qc1wiKS5OYXBpVmVyc2lvbjtcbn1bXTtcbmV4cG9ydCBkZWNsYXJlIGNsYXNzIE5ld0NvbW1hbmQgZXh0ZW5kcyBCYXNlTmV3Q29tbWFuZCB7XG4gICAgaW50ZXJhY3RpdmU6IGJvb2xlYW47XG4gICAgZXhlY3V0ZSgpOiBQcm9taXNlPDEgfCAwPjtcbiAgICBwcml2YXRlIGZldGNoT3B0aW9ucztcbiAgICBwcml2YXRlIGZldGNoTmFtZTtcbiAgICBwcml2YXRlIGZldGNoTGljZW5zZTtcbiAgICBwcml2YXRlIGZldGNoTmFwaVZlcnNpb247XG4gICAgcHJpdmF0ZSBmZXRjaFRhcmdldHM7XG4gICAgcHJpdmF0ZSBmZXRjaFR5cGVEZWY7XG4gICAgcHJpdmF0ZSBmZXRjaEdpdGh1YkFjdGlvbnM7XG59XG4iLCJpbXBvcnQgeyBCYXNlUHJlUHVibGlzaENvbW1hbmQgfSBmcm9tICcuLi9kZWYvcHJlLXB1Ymxpc2guanMnO1xuZXhwb3J0IGRlY2xhcmUgY2xhc3MgUHJlUHVibGlzaENvbW1hbmQgZXh0ZW5kcyBCYXNlUHJlUHVibGlzaENvbW1hbmQge1xuICAgIGV4ZWN1dGUoKTogUHJvbWlzZTx2b2lkPjtcbn1cbiIsImltcG9ydCB7IEJhc2VSZW5hbWVDb21tYW5kIH0gZnJvbSAnLi4vZGVmL3JlbmFtZS5qcyc7XG5leHBvcnQgZGVjbGFyZSBjbGFzcyBSZW5hbWVDb21tYW5kIGV4dGVuZHMgQmFzZVJlbmFtZUNvbW1hbmQge1xuICAgIGV4ZWN1dGUoKTogUHJvbWlzZTx2b2lkPjtcbn1cbiIsImltcG9ydCB7IEJhc2VVbml2ZXJzYWxpemVDb21tYW5kIH0gZnJvbSAnLi4vZGVmL3VuaXZlcnNhbGl6ZS5qcyc7XG5leHBvcnQgZGVjbGFyZSBjbGFzcyBVbml2ZXJzYWxpemVDb21tYW5kIGV4dGVuZHMgQmFzZVVuaXZlcnNhbGl6ZUNvbW1hbmQge1xuICAgIGV4ZWN1dGUoKTogUHJvbWlzZTx2b2lkPjtcbn1cbiIsImltcG9ydCB7IEJhc2VWZXJzaW9uQ29tbWFuZCB9IGZyb20gJy4uL2RlZi92ZXJzaW9uLmpzJztcbmV4cG9ydCBkZWNsYXJlIGNsYXNzIFZlcnNpb25Db21tYW5kIGV4dGVuZHMgQmFzZVZlcnNpb25Db21tYW5kIHtcbiAgICBleGVjdXRlKCk6IFByb21pc2U8dm9pZD47XG59XG4iLCJleHBvcnQgdHlwZSBQbGF0Zm9ybSA9IE5vZGVKUy5QbGF0Zm9ybSB8ICd3YXNtJyB8ICd3YXNpJyB8ICdvcGVuaGFybW9ueSc7XG5leHBvcnQgZGVjbGFyZSBjb25zdCBVTklWRVJTQUxfVEFSR0VUUzoge1xuICAgIHJlYWRvbmx5ICd1bml2ZXJzYWwtYXBwbGUtZGFyd2luJzogcmVhZG9ubHkgW1wiYWFyY2g2NC1hcHBsZS1kYXJ3aW5cIiwgXCJ4ODZfNjQtYXBwbGUtZGFyd2luXCJdO1xufTtcbmV4cG9ydCBkZWNsYXJlIGNvbnN0IEFWQUlMQUJMRV9UQVJHRVRTOiByZWFkb25seSBbXCJhYXJjaDY0LWFwcGxlLWRhcndpblwiLCBcImFhcmNoNjQtbGludXgtYW5kcm9pZFwiLCBcImFhcmNoNjQtdW5rbm93bi1saW51eC1nbnVcIiwgXCJhYXJjaDY0LXVua25vd24tbGludXgtbXVzbFwiLCBcImFhcmNoNjQtdW5rbm93bi1saW51eC1vaG9zXCIsIFwiYWFyY2g2NC1wYy13aW5kb3dzLW1zdmNcIiwgXCJ4ODZfNjQtYXBwbGUtZGFyd2luXCIsIFwieDg2XzY0LXBjLXdpbmRvd3MtbXN2Y1wiLCBcIng4Nl82NC1wYy13aW5kb3dzLWdudVwiLCBcIng4Nl82NC11bmtub3duLWxpbnV4LWdudVwiLCBcIng4Nl82NC11bmtub3duLWxpbnV4LW11c2xcIiwgXCJ4ODZfNjQtdW5rbm93bi1saW51eC1vaG9zXCIsIFwieDg2XzY0LXVua25vd24tZnJlZWJzZFwiLCBcImk2ODYtcGMtd2luZG93cy1tc3ZjXCIsIFwiYXJtdjctdW5rbm93bi1saW51eC1nbnVlYWJpaGZcIiwgXCJhcm12Ny11bmtub3duLWxpbnV4LW11c2xlYWJpaGZcIiwgXCJhcm12Ny1saW51eC1hbmRyb2lkZWFiaVwiLCBcInVuaXZlcnNhbC1hcHBsZS1kYXJ3aW5cIiwgXCJsb29uZ2FyY2g2NC11bmtub3duLWxpbnV4LWdudVwiLCBcInJpc2N2NjRnYy11bmtub3duLWxpbnV4LWdudVwiLCBcInBvd2VycGM2NGxlLXVua25vd24tbGludXgtZ251XCIsIFwiczM5MHgtdW5rbm93bi1saW51eC1nbnVcIiwgXCJ3YXNtMzItd2FzaS1wcmV2aWV3MS10aHJlYWRzXCIsIFwid2FzbTMyLXdhc2lwMS10aHJlYWRzXCJdO1xuZXhwb3J0IHR5cGUgVGFyZ2V0VHJpcGxlID0gKHR5cGVvZiBBVkFJTEFCTEVfVEFSR0VUUylbbnVtYmVyXTtcbmV4cG9ydCBkZWNsYXJlIGNvbnN0IERFRkFVTFRfVEFSR0VUUzogcmVhZG9ubHkgW1wieDg2XzY0LWFwcGxlLWRhcndpblwiLCBcImFhcmNoNjQtYXBwbGUtZGFyd2luXCIsIFwieDg2XzY0LXBjLXdpbmRvd3MtbXN2Y1wiLCBcIng4Nl82NC11bmtub3duLWxpbnV4LWdudVwiXTtcbmV4cG9ydCBkZWNsYXJlIGNvbnN0IFRBUkdFVF9MSU5LRVI6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG50eXBlIE5vZGVKU0FyY2ggPSAnYXJtJyB8ICdhcm02NCcgfCAnaWEzMicgfCAnbG9vbmc2NCcgfCAnbWlwcycgfCAnbWlwc2VsJyB8ICdwcGMnIHwgJ3BwYzY0JyB8ICdyaXNjdjY0JyB8ICdzMzkwJyB8ICdzMzkweCcgfCAneDMyJyB8ICd4NjQnIHwgJ3VuaXZlcnNhbCcgfCAnd2FzbTMyJztcbmV4cG9ydCBkZWNsYXJlIGNvbnN0IE5vZGVBcmNoVG9DcHU6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG5leHBvcnQgZGVjbGFyZSBjb25zdCBVbmlBcmNoc0J5UGxhdGZvcm06IFBhcnRpYWw8UmVjb3JkPFBsYXRmb3JtLCBOb2RlSlNBcmNoW10+PjtcbmV4cG9ydCBpbnRlcmZhY2UgVGFyZ2V0IHtcbiAgICB0cmlwbGU6IHN0cmluZztcbiAgICBwbGF0Zm9ybUFyY2hBQkk6IHN0cmluZztcbiAgICBwbGF0Zm9ybTogUGxhdGZvcm07XG4gICAgYXJjaDogTm9kZUpTQXJjaDtcbiAgICBhYmk6IHN0cmluZyB8IG51bGw7XG59XG4vKipcbiAqIEEgdHJpcGxlIGlzIGEgc3BlY2lmaWMgZm9ybWF0IGZvciBzcGVjaWZ5aW5nIGEgdGFyZ2V0IGFyY2hpdGVjdHVyZS5cbiAqIFRyaXBsZXMgbWF5IGJlIHJlZmVycmVkIHRvIGFzIGEgdGFyZ2V0IHRyaXBsZSB3aGljaCBpcyB0aGUgYXJjaGl0ZWN0dXJlIGZvciB0aGUgYXJ0aWZhY3QgcHJvZHVjZWQsIGFuZCB0aGUgaG9zdCB0cmlwbGUgd2hpY2ggaXMgdGhlIGFyY2hpdGVjdHVyZSB0aGF0IHRoZSBjb21waWxlciBpcyBydW5uaW5nIG9uLlxuICogVGhlIGdlbmVyYWwgZm9ybWF0IG9mIHRoZSB0cmlwbGUgaXMgYDxhcmNoPjxzdWI+LTx2ZW5kb3I+LTxzeXM+LTxhYmk+YCB3aGVyZTpcbiAqICAgLSBgYXJjaGAgPSBUaGUgYmFzZSBDUFUgYXJjaGl0ZWN0dXJlLCBmb3IgZXhhbXBsZSBgeDg2XzY0YCwgYGk2ODZgLCBgYXJtYCwgYHRodW1iYCwgYG1pcHNgLCBldGMuXG4gKiAgIC0gYHN1YmAgPSBUaGUgQ1BVIHN1Yi1hcmNoaXRlY3R1cmUsIGZvciBleGFtcGxlIGBhcm1gIGhhcyBgdjdgLCBgdjdzYCwgYHY1dGVgLCBldGMuXG4gKiAgIC0gYHZlbmRvcmAgPSBUaGUgdmVuZG9yLCBmb3IgZXhhbXBsZSBgdW5rbm93bmAsIGBhcHBsZWAsIGBwY2AsIGBudmlkaWFgLCBldGMuXG4gKiAgIC0gYHN5c2AgPSBUaGUgc3lzdGVtIG5hbWUsIGZvciBleGFtcGxlIGBsaW51eGAsIGB3aW5kb3dzYCwgYGRhcndpbmAsIGV0Yy4gbm9uZSBpcyB0eXBpY2FsbHkgdXNlZCBmb3IgYmFyZS1tZXRhbCB3aXRob3V0IGFuIE9TLlxuICogICAtIGBhYmlgID0gVGhlIEFCSSwgZm9yIGV4YW1wbGUgYGdudWAsIGBhbmRyb2lkYCwgYGVhYmlgLCBldGMuXG4gKi9cbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIHBhcnNlVHJpcGxlKHJhd1RyaXBsZTogc3RyaW5nKTogVGFyZ2V0O1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gZ2V0U3lzdGVtRGVmYXVsdFRhcmdldCgpOiBUYXJnZXQ7XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBnZXRUYXJnZXRMaW5rZXIodGFyZ2V0OiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiB0YXJnZXRUb0VudlZhcih0YXJnZXQ6IHN0cmluZyk6IHN0cmluZztcbmV4cG9ydCB7fTtcbiIsImltcG9ydCB7IHR5cGUgVGFyZ2V0IH0gZnJvbSAnLi90YXJnZXQuanMnO1xuZXhwb3J0IHR5cGUgVmFsdWVPZkNvbnN0QXJyYXk8VD4gPSBUW0V4Y2x1ZGU8a2V5b2YgVCwga2V5b2YgQXJyYXk8YW55Pj5dO1xuZXhwb3J0IGRlY2xhcmUgY29uc3QgU3VwcG9ydGVkUGFja2FnZU1hbmFnZXJzOiByZWFkb25seSBbXCJ5YXJuXCIsIFwicG5wbVwiXTtcbmV4cG9ydCBkZWNsYXJlIGNvbnN0IFN1cHBvcnRlZFRlc3RGcmFtZXdvcmtzOiByZWFkb25seSBbXCJhdmFcIl07XG5leHBvcnQgdHlwZSBTdXBwb3J0ZWRQYWNrYWdlTWFuYWdlciA9IFZhbHVlT2ZDb25zdEFycmF5PHR5cGVvZiBTdXBwb3J0ZWRQYWNrYWdlTWFuYWdlcnM+O1xuZXhwb3J0IHR5cGUgU3VwcG9ydGVkVGVzdEZyYW1ld29yayA9IFZhbHVlT2ZDb25zdEFycmF5PHR5cGVvZiBTdXBwb3J0ZWRUZXN0RnJhbWV3b3Jrcz47XG5leHBvcnQgaW50ZXJmYWNlIFVzZXJOYXBpQ29uZmlnIHtcbiAgICAvKipcbiAgICAgKiBOYW1lIG9mIHRoZSBiaW5hcnkgdG8gYmUgZ2VuZXJhdGVkLCBkZWZhdWx0IHRvIGBpbmRleGBcbiAgICAgKi9cbiAgICBiaW5hcnlOYW1lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIE5hbWUgb2YgdGhlIG5wbSBwYWNrYWdlLCBkZWZhdWx0IHRvIHRoZSBuYW1lIG9mIHJvb3QgcGFja2FnZS5qc29uIG5hbWVcbiAgICAgKlxuICAgICAqIEFsd2F5cyBnaXZlbiBgQHNjb3BlL3BrZ2AgYW5kIGFyY2ggc3VmZml4IHdpbGwgYmUgYXBwZW5kZWQgbGlrZSBgQHNjb3BlL3BrZy1saW51eC1nbnUteDY0YFxuICAgICAqL1xuICAgIHBhY2thZ2VOYW1lPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEFsbCB0YXJnZXRzIHRoZSBjcmF0ZSB3aWxsIGJlIGNvbXBpbGVkIGZvclxuICAgICAqL1xuICAgIHRhcmdldHM/OiBzdHJpbmdbXTtcbiAgICAvKipcbiAgICAgKiBUaGUgbnBtIGNsaWVudCBwcm9qZWN0IHVzZXMuXG4gICAgICovXG4gICAgbnBtQ2xpZW50Pzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgZ2VuZXJhdGUgY29uc3QgZW51bSBmb3IgdHlwZXNjcmlwdCBiaW5kaW5nc1xuICAgICAqL1xuICAgIGNvbnN0RW51bT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogRW1pdCBgI1tuYXBpKHN0cmluZ19lbnVtKV1gIGVudW1zIGFzIHJ1bnRpbWUgZW51bXMgKGBleHBvcnQgZGVjbGFyZSBlbnVtYCkgdW5kZXIgYC0tbm8tY29uc3QtZW51bWAuIERlZmF1bHQ6IHR5cGUtb25seSB1bmlvbi5cbiAgICAgKi9cbiAgICBydW50aW1lU3RyaW5nRW51bT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogZHRzIGhlYWRlciBwcmVwZW5kIHRvIHRoZSBnZW5lcmF0ZWQgZHRzIGZpbGVcbiAgICAgKi9cbiAgICBkdHNIZWFkZXI/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogZHRzIGhlYWRlciBmaWxlIHBhdGggdG8gYmUgcHJlcGVuZGVkIHRvIHRoZSBnZW5lcmF0ZWQgZHRzIGZpbGVcbiAgICAgKiBpZiBib3RoIGR0c0hlYWRlciBhbmQgZHRzSGVhZGVyRmlsZSBhcmUgcHJvdmlkZWQsIGR0c0hlYWRlckZpbGUgd2lsbCBiZSB1c2VkXG4gICAgICovXG4gICAgZHRzSGVhZGVyRmlsZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiB3YXNtIGNvbXBpbGF0aW9uIG9wdGlvbnNcbiAgICAgKi9cbiAgICB3YXNtPzoge1xuICAgICAgICAvKipcbiAgICAgICAgICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWJBc3NlbWJseS9KYXZhU2NyaXB0X2ludGVyZmFjZS9NZW1vcnlcbiAgICAgICAgICogQGRlZmF1bHQgNDAwMCBwYWdlcyAoMjU2TWlCKVxuICAgICAgICAgKi9cbiAgICAgICAgaW5pdGlhbE1lbW9yeT86IG51bWJlcjtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBkZWZhdWx0IDY1NTM2IHBhZ2VzICg0R2lCKVxuICAgICAgICAgKi9cbiAgICAgICAgbWF4aW11bU1lbW9yeT86IG51bWJlcjtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJyb3dzZXIgd2FzbSBiaW5kaW5nIGNvbmZpZ3VyYXRpb25cbiAgICAgICAgICovXG4gICAgICAgIGJyb3dzZXI6IHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogV2hldGhlciB0byB1c2UgZnMgbW9kdWxlIGluIGJyb3dzZXJcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgZnM/OiBib29sZWFuO1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBXaGV0aGVyIHRvIGluaXRpYWxpemUgd2FzbSBhc3luY2hyb25vdXNseVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBhc3luY0luaXQ/OiBib29sZWFuO1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBXaGV0aGVyIHRvIGluamVjdCBgYnVmZmVyYCB0byBlbW5hcGkgY29udGV4dFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBidWZmZXI/OiBib29sZWFuO1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBXaGV0aGVyIHRvIGVtaXQgY3VzdG9tIGV2ZW50cyBmb3IgZXJyb3JzIGluIHdvcmtlclxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBlcnJvckV2ZW50PzogYm9vbGVhbjtcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIEBkZXByZWNhdGVkIGJpbmFyeU5hbWUgaW5zdGVhZFxuICAgICAqL1xuICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogQGRlcHJlY2F0ZWQgdXNlIHBhY2thZ2VOYW1lIGluc3RlYWRcbiAgICAgKi9cbiAgICBwYWNrYWdlPzoge1xuICAgICAgICBuYW1lPzogc3RyaW5nO1xuICAgIH07XG4gICAgLyoqXG4gICAgICogQGRlcHJlY2F0ZWQgdXNlIHRhcmdldHMgaW5zdGVhZFxuICAgICAqL1xuICAgIHRyaXBsZXM/OiB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXaGV0aGVyIGVuYWJsZSBkZWZhdWx0IHRhcmdldHNcbiAgICAgICAgICovXG4gICAgICAgIGRlZmF1bHRzOiBib29sZWFuO1xuICAgICAgICAvKipcbiAgICAgICAgICogQWRkaXRpb25hbCB0YXJnZXRzIHRvIGJlIGNvbXBpbGVkIGZvclxuICAgICAgICAgKi9cbiAgICAgICAgYWRkaXRpb25hbD86IHN0cmluZ1tdO1xuICAgIH07XG59XG5leHBvcnQgaW50ZXJmYWNlIENvbW1vblBhY2thZ2VKc29uRmllbGRzIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgdmVyc2lvbjogc3RyaW5nO1xuICAgIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICAgIGtleXdvcmRzPzogc3RyaW5nW107XG4gICAgYXV0aG9yPzogc3RyaW5nO1xuICAgIGF1dGhvcnM/OiBzdHJpbmdbXTtcbiAgICBsaWNlbnNlPzogc3RyaW5nO1xuICAgIGNwdT86IHN0cmluZ1tdO1xuICAgIG9zPzogc3RyaW5nW107XG4gICAgbGliYz86IHN0cmluZ1tdO1xuICAgIGZpbGVzPzogc3RyaW5nW107XG4gICAgcmVwb3NpdG9yeT86IGFueTtcbiAgICBob21lcGFnZT86IGFueTtcbiAgICBlbmdpbmVzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgICBwdWJsaXNoQ29uZmlnPzogYW55O1xuICAgIGJ1Z3M/OiBhbnk7XG4gICAgbmFwaT86IFVzZXJOYXBpQ29uZmlnO1xuICAgIHR5cGU/OiAnbW9kdWxlJyB8ICdjb21tb25qcyc7XG4gICAgc2NyaXB0cz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gICAgbWFpbj86IHN0cmluZztcbiAgICBtb2R1bGU/OiBzdHJpbmc7XG4gICAgdHlwZXM/OiBzdHJpbmc7XG4gICAgYnJvd3Nlcj86IHN0cmluZztcbiAgICBleHBvcnRzPzogYW55O1xuICAgIGRlcGVuZGVuY2llcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gICAgZGV2RGVwZW5kZW5jaWVzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcbiAgICBhdmE/OiB7XG4gICAgICAgIHRpbWVvdXQ/OiBzdHJpbmc7XG4gICAgfTtcbn1cbmV4cG9ydCB0eXBlIE5hcGlDb25maWcgPSBSZXF1aXJlZDxQaWNrPFVzZXJOYXBpQ29uZmlnLCAnYmluYXJ5TmFtZScgfCAncGFja2FnZU5hbWUnIHwgJ25wbUNsaWVudCc+PiAmIFBpY2s8VXNlck5hcGlDb25maWcsICd3YXNtJyB8ICdkdHNIZWFkZXInIHwgJ2R0c0hlYWRlckZpbGUnIHwgJ2NvbnN0RW51bScgfCAncnVudGltZVN0cmluZ0VudW0nPiAmIHtcbiAgICB0YXJnZXRzOiBUYXJnZXRbXTtcbiAgICBwYWNrYWdlSnNvbjogQ29tbW9uUGFja2FnZUpzb25GaWVsZHM7XG59O1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gcmVhZE5hcGlDb25maWcocGF0aDogc3RyaW5nLCBjb25maWdQYXRoPzogc3RyaW5nKTogUHJvbWlzZTxOYXBpQ29uZmlnPjtcbiIsImltcG9ydCB7IENsaSB9IGZyb20gJ2NsaXBhbmlvbic7XG5pbXBvcnQgeyBjb2xsZWN0QXJ0aWZhY3RzIH0gZnJvbSAnLi9hcGkvYXJ0aWZhY3RzLmpzJztcbmltcG9ydCB7IGJ1aWxkUHJvamVjdCB9IGZyb20gJy4vYXBpL2J1aWxkLmpzJztcbmltcG9ydCB7IGNyZWF0ZU5wbURpcnMgfSBmcm9tICcuL2FwaS9jcmVhdGUtbnBtLWRpcnMuanMnO1xuaW1wb3J0IHsgbmV3UHJvamVjdCB9IGZyb20gJy4vYXBpL25ldy5qcyc7XG5pbXBvcnQgeyBwcmVQdWJsaXNoIH0gZnJvbSAnLi9hcGkvcHJlLXB1Ymxpc2guanMnO1xuaW1wb3J0IHsgcmVuYW1lUHJvamVjdCB9IGZyb20gJy4vYXBpL3JlbmFtZS5qcyc7XG5pbXBvcnQgeyB1bml2ZXJzYWxpemVCaW5hcmllcyB9IGZyb20gJy4vYXBpL3VuaXZlcnNhbGl6ZS5qcyc7XG5pbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSAnLi9hcGkvdmVyc2lvbi5qcyc7XG5pbXBvcnQgeyBBcnRpZmFjdHNDb21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy9hcnRpZmFjdHMuanMnO1xuaW1wb3J0IHsgQnVpbGRDb21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy9idWlsZC5qcyc7XG5pbXBvcnQgeyBDcmVhdGVOcG1EaXJzQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvY3JlYXRlLW5wbS1kaXJzLmpzJztcbmltcG9ydCB7IE5ld0NvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL25ldy5qcyc7XG5pbXBvcnQgeyBQcmVQdWJsaXNoQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvcHJlLXB1Ymxpc2guanMnO1xuaW1wb3J0IHsgUmVuYW1lQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvcmVuYW1lLmpzJztcbmltcG9ydCB7IFVuaXZlcnNhbGl6ZUNvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL3VuaXZlcnNhbGl6ZS5qcyc7XG5pbXBvcnQgeyBWZXJzaW9uQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvdmVyc2lvbi5qcyc7XG5leHBvcnQgZGVjbGFyZSBjb25zdCBjbGk6IENsaTxpbXBvcnQoXCJjbGlwYW5pb25cIikuQmFzZUNvbnRleHQ+O1xuLyoqXG4gKlxuICogQHVzYWdlXG4gKlxuICogYGBgdHNcbiAqIGNvbnN0IGNsaSA9IG5ldyBOYXBpQ2xpKClcbiAqXG4gKiBjbGkuYnVpbGQoe1xuICogICBjd2Q6ICcvcGF0aC90by95b3VyL3Byb2plY3QnLFxuICogfSlcbiAqIGBgYFxuICovXG5leHBvcnQgZGVjbGFyZSBjbGFzcyBOYXBpQ2xpIHtcbiAgICBhcnRpZmFjdHM6IHR5cGVvZiBjb2xsZWN0QXJ0aWZhY3RzO1xuICAgIG5ldzogdHlwZW9mIG5ld1Byb2plY3Q7XG4gICAgYnVpbGQ6IHR5cGVvZiBidWlsZFByb2plY3Q7XG4gICAgY3JlYXRlTnBtRGlyczogdHlwZW9mIGNyZWF0ZU5wbURpcnM7XG4gICAgcHJlUHVibGlzaDogdHlwZW9mIHByZVB1Ymxpc2g7XG4gICAgcmVuYW1lOiB0eXBlb2YgcmVuYW1lUHJvamVjdDtcbiAgICB1bml2ZXJzYWxpemU6IHR5cGVvZiB1bml2ZXJzYWxpemVCaW5hcmllcztcbiAgICB2ZXJzaW9uOiB0eXBlb2YgdmVyc2lvbjtcbn1cbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGNyZWF0ZUJ1aWxkQ29tbWFuZChhcmdzOiBzdHJpbmdbXSk6IEJ1aWxkQ29tbWFuZDtcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGNyZWF0ZUFydGlmYWN0c0NvbW1hbmQoYXJnczogc3RyaW5nW10pOiBBcnRpZmFjdHNDb21tYW5kO1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gY3JlYXRlQ3JlYXRlTnBtRGlyc0NvbW1hbmQoYXJnczogc3RyaW5nW10pOiBDcmVhdGVOcG1EaXJzQ29tbWFuZDtcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGNyZWF0ZVByZVB1Ymxpc2hDb21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogUHJlUHVibGlzaENvbW1hbmQ7XG5leHBvcnQgZGVjbGFyZSBmdW5jdGlvbiBjcmVhdGVSZW5hbWVDb21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogUmVuYW1lQ29tbWFuZDtcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGNyZWF0ZVVuaXZlcnNhbGl6ZUNvbW1hbmQoYXJnczogc3RyaW5nW10pOiBVbml2ZXJzYWxpemVDb21tYW5kO1xuZXhwb3J0IGRlY2xhcmUgZnVuY3Rpb24gY3JlYXRlVmVyc2lvbkNvbW1hbmQoYXJnczogc3RyaW5nW10pOiBWZXJzaW9uQ29tbWFuZDtcbmV4cG9ydCBkZWNsYXJlIGZ1bmN0aW9uIGNyZWF0ZU5ld0NvbW1hbmQoYXJnczogc3RyaW5nW10pOiBOZXdDb21tYW5kO1xuZXhwb3J0IHsgcGFyc2VUcmlwbGUgfSBmcm9tICcuL3V0aWxzL3RhcmdldC5qcyc7XG5leHBvcnQgeyB0eXBlIEdlbmVyYXRlVHlwZURlZk9wdGlvbnMsIHR5cGUgV3JpdGVKc0JpbmRpbmdPcHRpb25zLCB3cml0ZUpzQmluZGluZywgZ2VuZXJhdGVUeXBlRGVmLCB9IGZyb20gJy4vYXBpL2J1aWxkLmpzJztcbmV4cG9ydCB7IHJlYWROYXBpQ29uZmlnIH0gZnJvbSAnLi91dGlscy9jb25maWcuanMnO1xuIl0sIm1hcHBpbmdzIjoiOzs7QUFDQSxJQUFXLHVCQUF1QjtDQUFDO09BQVUsQ0FBQyxPQUFPO0NBQUc7RUFBQztFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0NBQUU7QUFBQztBQUM1SCxJQUFXLG1CQUFtQjtDQUFDO09BQVUsQ0FBQztDQUFHO0VBQUM7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0NBQUU7QUFBQzs7OztBQ0RyRSxJQUFXLG1CQUFtQjtDQUFDO09BQVUsQ0FBQyxrQkFBa0IsT0FBTztDQUFHO0VBQUM7RUFBSTtFQUFJO0NBQUU7QUFBQzs7OztBQ0FsRixJQUFXLG1CQUFtQjtDQUFDO09BQVUsQ0FBQyxPQUFPO0NBQUc7RUFBQztFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtDQUFFO0FBQUM7QUFDaFUsSUFBV0EsaUJBQWU7Q0FBQztPQUFVLENBQUM7Q0FBRztFQUFDO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0VBQUk7RUFBSTtFQUFJO0NBQUU7QUFBQzs7OztBQ0RySyxJQUFJLGFBQWE7Q0FBQztPQUFVLENB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