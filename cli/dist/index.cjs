Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let clipanion = require("clipanion");
let node_path = require("node:path");
node_path = __toESM(node_path, 1);
let colorette = require("colorette");
colorette = __toESM(colorette, 1);
let obug = require("obug");
let node_fs_promises = require("node:fs/promises");
let node_child_process = require("node:child_process");
let node_fs = require("node:fs");
node_fs = __toESM(node_fs, 1);
let es_toolkit = require("es-toolkit");
let node_crypto = require("node:crypto");
let node_module = require("node:module");
let node_os = require("node:os");
let semver = require("semver");
let js_yaml = require("js-yaml");
let typanion = require("typanion");
typanion = __toESM(typanion, 1);
let _octokit_rest = require("@octokit/rest");
let _inquirer_prompts = require("@inquirer/prompts");
//#region src/def/artifacts.ts
var BaseArtifactsCommand = class extends clipanion.Command {
	static paths = [["artifacts"]];
	static usage = clipanion.Command.Usage({ description: "Copy artifacts from Github Actions into npm packages and ready to publish" });
	cwd = clipanion.Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = clipanion.Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = clipanion.Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	outputDir = clipanion.Option.String("--output-dir,-o,-d", "./artifacts", { description: "Path to the folder where all built `.node` files put, same as `--output-dir` of build command" });
	npmDir = clipanion.Option.String("--npm-dir", "npm", { description: "Path to the folder where the npm packages put" });
	buildOutputDir = clipanion.Option.String("--build-output-dir", { description: "Path to the build output dir, only needed when targets contains `wasm32-wasi-*`" });
	getOptions() {
		return {
			cwd: this.cwd,
			configPath: this.configPath,
			packageJsonPath: this.packageJsonPath,
			outputDir: this.outputDir,
			npmDir: this.npmDir,
			buildOutputDir: this.buildOutputDir
		};
	}
};
function applyDefaultArtifactsOptions(options) {
	return {
		cwd: process.cwd(),
		packageJsonPath: "package.json",
		outputDir: "./artifacts",
		npmDir: "npm",
		...options
	};
}
//#endregion
//#region src/utils/log.ts
const debugFactory = (namespace) => {
	const debug = (0, obug.createDebug)(`napi:${namespace}`, { formatters: { i(v) {
		return colorette.green(v);
	} } });
	debug.info = (...args) => console.error(colorette.black(colorette.bgGreen(" INFO ")), ...args);
	debug.warn = (...args) => console.error(colorette.black(colorette.bgYellow(" WARNING ")), ...args);
	debug.error = (...args) => console.error(colorette.white(colorette.bgRed(" ERROR ")), ...args.map((arg) => arg instanceof Error ? arg.stack ?? arg.message : arg));
	return debug;
};
const debug$10 = debugFactory("utils");
//#endregion
//#region package.json
var version$1 = "3.7.3";
//#endregion
//#region src/utils/misc.ts
const readFileAsync = node_fs_promises.readFile;
const writeFileAsync = node_fs_promises.writeFile;
const unlinkAsync = node_fs_promises.unlink;
const copyFileAsync = node_fs_promises.copyFile;
const mkdirAsync = node_fs_promises.mkdir;
const statAsync = node_fs_promises.stat;
const readdirAsync = node_fs_promises.readdir;
function fileExists(path) {
	return (0, node_fs_promises.access)(path).then(() => true, () => false);
}
async function dirExistsAsync(path) {
	try {
		return (await statAsync(path)).isDirectory();
	} catch {
		return false;
	}
}
function pick$1(o, ...keys) {
	return keys.reduce((acc, key) => {
		acc[key] = o[key];
		return acc;
	}, {});
}
function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function mergePackageJson(old, partial) {
	const merged = { ...old };
	for (const [key, value] of Object.entries(partial)) if (isPlainObject(merged[key]) && isPlainObject(value)) merged[key] = mergePackageJson(merged[key], value);
	else merged[key] = value;
	return merged;
}
async function updatePackageJson(path, partial) {
	if (!await fileExists(path)) {
		debug$10(`File not exists ${path}`);
		return;
	}
	const old = JSON.parse(await readFileAsync(path, "utf8"));
	await writeFileAsync(path, JSON.stringify(mergePackageJson(old, partial), null, 2));
}
const CLI_VERSION = version$1;
//#endregion
//#region src/utils/target.ts
const SUB_SYSTEMS = /* @__PURE__ */ new Set(["android", "ohos"]);
const AVAILABLE_TARGETS = [
	"aarch64-apple-darwin",
	"aarch64-linux-android",
	"aarch64-unknown-linux-gnu",
	"aarch64-unknown-linux-musl",
	"aarch64-unknown-linux-ohos",
	"aarch64-pc-windows-msvc",
	"x86_64-apple-darwin",
	"x86_64-pc-windows-msvc",
	"x86_64-pc-windows-gnu",
	"x86_64-unknown-linux-gnu",
	"x86_64-unknown-linux-musl",
	"x86_64-unknown-linux-ohos",
	"x86_64-unknown-freebsd",
	"i686-pc-windows-msvc",
	"armv7-unknown-linux-gnueabihf",
	"armv7-unknown-linux-musleabihf",
	"armv7-linux-androideabi",
	"universal-apple-darwin",
	"loongarch64-unknown-linux-gnu",
	"riscv64gc-unknown-linux-gnu",
	"powerpc64le-unknown-linux-gnu",
	"s390x-unknown-linux-gnu",
	"wasm32-wasi-preview1-threads",
	"wasm32-wasip1-threads"
];
const DEFAULT_TARGETS = [
	"x86_64-apple-darwin",
	"aarch64-apple-darwin",
	"x86_64-pc-windows-msvc",
	"x86_64-unknown-linux-gnu"
];
const TARGET_LINKER = {
	"aarch64-unknown-linux-musl": "aarch64-linux-musl-gcc",
	"loongarch64-unknown-linux-gnu": "loongarch64-linux-gnu-gcc-13",
	"riscv64gc-unknown-linux-gnu": "riscv64-linux-gnu-gcc",
	"powerpc64le-unknown-linux-gnu": "powerpc64le-linux-gnu-gcc",
	"s390x-unknown-linux-gnu": "s390x-linux-gnu-gcc"
};
const CpuToNodeArch = {
	x86_64: "x64",
	aarch64: "arm64",
	i686: "ia32",
	armv7: "arm",
	loongarch64: "loong64",
	riscv64gc: "riscv64",
	powerpc64le: "ppc64"
};
const SysToNodePlatform = {
	linux: "linux",
	freebsd: "freebsd",
	darwin: "darwin",
	windows: "win32",
	ohos: "openharmony"
};
const UniArchsByPlatform = { darwin: ["x64", "arm64"] };
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
function parseTriple(rawTriple) {
	if (rawTriple === "wasm32-wasi" || rawTriple === "wasm32-wasi-preview1-threads" || rawTriple.startsWith("wasm32-wasip")) return {
		triple: rawTriple,
		platformArchABI: "wasm32-wasi",
		platform: "wasi",
		arch: "wasm32",
		abi: "wasi"
	};
	const triples = (rawTriple.endsWith("eabi") ? `${rawTriple.slice(0, -4)}-eabi` : rawTriple).split("-");
	let cpu;
	let sys;
	let abi = null;
	if (triples.length === 2) [cpu, sys] = triples;
	else [cpu, , sys, abi = null] = triples;
	if (abi && SUB_SYSTEMS.has(abi)) {
		sys = abi;
		abi = null;
	}
	const platform = SysToNodePlatform[sys] ?? sys;
	const arch = CpuToNodeArch[cpu] ?? cpu;
	return {
		triple: rawTriple,
		platformArchABI: abi ? `${platform}-${arch}-${abi}` : `${platform}-${arch}`,
		platform,
		arch,
		abi
	};
}
function getSystemDefaultTarget() {
	const host = (0, node_child_process.execSync)(`rustc -vV`, { env: process.env }).toString("utf8").split("\n").find((line) => line.startsWith("host: "));
	const triple = host === null || host === void 0 ? void 0 : host.slice(6);
	if (!triple) throw new TypeError(`Can not parse target triple from host`);
	return parseTriple(triple);
}
function getTargetLinker(target) {
	return TARGET_LINKER[target];
}
function targetToEnvVar(target) {
	return target.replace(/-/g, "_").toUpperCase();
}
//#endregion
//#region src/utils/version.ts
let NapiVersion = /* @__PURE__ */ function(NapiVersion) {
	NapiVersion[NapiVersion["Napi1"] = 1] = "Napi1";
	NapiVersion[NapiVersion["Napi2"] = 2] = "Napi2";
	NapiVersion[NapiVersion["Napi3"] = 3] = "Napi3";
	NapiVersion[NapiVersion["Napi4"] = 4] = "Napi4";
	NapiVersion[NapiVersion["Napi5"] = 5] = "Napi5";
	NapiVersion[NapiVersion["Napi6"] = 6] = "Napi6";
	NapiVersion[NapiVersion["Napi7"] = 7] = "Napi7";
	NapiVersion[NapiVersion["Napi8"] = 8] = "Napi8";
	NapiVersion[NapiVersion["Napi9"] = 9] = "Napi9";
	NapiVersion[NapiVersion["Napi10"] = 10] = "Napi10";
	return NapiVersion;
}({});
const NAPI_VERSION_MATRIX = /* @__PURE__ */ new Map([
	[1, "8.6.0 | 9.0.0 | 10.0.0"],
	[2, "8.10.0 | 9.3.0 | 10.0.0"],
	[3, "6.14.2 | 8.11.2 | 9.11.0 | 10.0.0"],
	[4, "10.16.0 | 11.8.0 | 12.0.0"],
	[5, "10.17.0 | 12.11.0 | 13.0.0"],
	[6, "10.20.0 | 12.17.0 | 14.0.0"],
	[7, "10.23.0 | 12.19.0 | 14.12.0 | 15.0.0"],
	[8, "12.22.0 | 14.17.0 | 15.12.0 | 16.0.0"],
	[9, "18.17.0 | 20.3.0 | 21.1.0"],
	[10, "22.14.0 | 23.6.0"]
]);
const SUPPORTED_NAPI_VERSIONS = Object.values(NapiVersion).filter((v) => typeof v === "number");
function parseNodeVersion(v) {
	const matches = v.match(/v?([0-9]+)\.([0-9]+)\.([0-9]+)/i);
	if (!matches) throw new Error("Unknown node version number: " + v);
	const [, major, minor, patch] = matches;
	return {
		major: parseInt(major),
		minor: parseInt(minor),
		patch: parseInt(patch)
	};
}
function requiredNodeVersions(napiVersion) {
	const requirement = NAPI_VERSION_MATRIX.get(napiVersion);
	if (!requirement) return [parseNodeVersion("10.0.0")];
	return requirement.split("|").map(parseNodeVersion);
}
function toEngineRequirement(versions) {
	const requirements = [];
	versions.forEach((v, i) => {
		let req = "";
		if (i !== 0) {
			const lastVersion = versions[i - 1];
			req += `< ${lastVersion.major + 1}`;
		}
		req += `${i === 0 ? "" : " || "}>= ${v.major}.${v.minor}.${v.patch}`;
		requirements.push(req);
	});
	return requirements.join(" ");
}
function napiEngineRequirement(napiVersion) {
	return toEngineRequirement(requiredNodeVersions(napiVersion));
}
//#endregion
//#region src/utils/metadata.ts
const debug$9 = debugFactory("metadata");
function getNapiDeriveDependentCrates(metadata) {
	var _metadata$resolve;
	const resolveNodes = (_metadata$resolve = metadata.resolve) === null || _metadata$resolve === void 0 ? void 0 : _metadata$resolve.nodes;
	if (!resolveNodes) return metadata.packages.filter((crate) => crate.dependencies.some((d) => d.name === "napi-derive"));
	const napiDerivePackageIds = new Set(metadata.packages.filter((p) => p.name === "napi-derive").map((p) => p.id));
	const dependentPackageIds = new Set(resolveNodes.filter((node) => node.deps.some((dep) => napiDerivePackageIds.has(dep.pkg))).map((node) => node.id));
	return metadata.packages.filter((crate) => dependentPackageIds.has(crate.id));
}
async function parseMetadata(manifestPath, featureOptions) {
	var _featureOptions$featu;
	if (!node_fs.default.existsSync(manifestPath)) throw new Error(`No crate found in manifest: ${manifestPath}`);
	const featureArgs = [];
	if (featureOptions === null || featureOptions === void 0 ? void 0 : featureOptions.allFeatures) featureArgs.push("--all-features");
	if (featureOptions === null || featureOptions === void 0 ? void 0 : featureOptions.noDefaultFeatures) featureArgs.push("--no-default-features");
	if (featureOptions === null || featureOptions === void 0 || (_featureOptions$featu = featureOptions.features) === null || _featureOptions$featu === void 0 ? void 0 : _featureOptions$featu.length) featureArgs.push("--features", featureOptions.features.join(","));
	if (featureArgs.length) try {
		return await execCargoMetadata(manifestPath, featureArgs);
	} catch (e) {
		debug$9.warn(`cargo metadata failed with feature flags, retrying without them: ${e}`);
	}
	return execCargoMetadata(manifestPath, []);
}
async function execCargoMetadata(manifestPath, extraArgs) {
	const childProcess = (0, node_child_process.spawn)("cargo", [
		"metadata",
		"--manifest-path",
		manifestPath,
		"--format-version",
		"1",
		...extraArgs
	], { stdio: "pipe" });
	let stdout = "";
	let stderr = "";
	let status = 0;
	let error = null;
	childProcess.stdout.on("data", (data) => {
		stdout += data;
	});
	childProcess.stderr.on("data", (data) => {
		stderr += data;
	});
	childProcess.on("error", (err) => {
		error = err;
	});
	await new Promise((resolve) => {
		childProcess.on("close", (code) => {
			status = code ?? 0;
			resolve();
		});
	});
	if (error) throw new Error("cargo metadata failed to run", { cause: error });
	if (status !== 0) {
		const simpleMessage = `cargo metadata exited with code ${status}`;
		throw new Error(`${simpleMessage} and error message:\n\n${stderr}`, { cause: new Error(simpleMessage) });
	}
	try {
		return JSON.parse(stdout);
	} catch (e) {
		throw new Error("Failed to parse cargo metadata JSON", { cause: e });
	}
}
//#endregion
//#region src/utils/config.ts
async function readNapiConfig(path, configPath) {
	if (configPath && !await fileExists(configPath)) throw new Error(`NAPI-RS config not found at ${configPath}`);
	if (!await fileExists(path)) throw new Error(`package.json not found at ${path}`);
	const content = await readFileAsync(path, "utf8");
	let pkgJson;
	try {
		pkgJson = JSON.parse(content);
	} catch (e) {
		throw new Error(`Failed to parse package.json at ${path}`, { cause: e });
	}
	let separatedConfig;
	if (configPath) {
		const configContent = await readFileAsync(configPath, "utf8");
		try {
			separatedConfig = JSON.parse(configContent);
		} catch (e) {
			throw new Error(`Failed to parse NAPI-RS config at ${configPath}`, { cause: e });
		}
	}
	const userNapiConfig = pkgJson.napi ?? {};
	if (pkgJson.napi && separatedConfig) {
		const pkgJsonPath = (0, colorette.underline)(path);
		const configPathUnderline = (0, colorette.underline)(configPath);
		console.warn((0, colorette.yellow)(`Both napi field in ${pkgJsonPath} and [NAPI-RS config](${configPathUnderline}) file are found, the NAPI-RS config file will be used.`));
	}
	if (separatedConfig) Object.assign(userNapiConfig, separatedConfig);
	const napiConfig = (0, es_toolkit.merge)({
		binaryName: "index",
		packageName: pkgJson.name,
		targets: [],
		packageJson: pkgJson,
		npmClient: "npm"
	}, (0, es_toolkit.omit)(userNapiConfig, ["targets"]));
	let targets = userNapiConfig.targets ?? [];
	if (userNapiConfig === null || userNapiConfig === void 0 ? void 0 : userNapiConfig.name) {
		console.warn((0, colorette.yellow)(`[DEPRECATED] napi.name is deprecated, use napi.binaryName instead.`));
		napiConfig.binaryName = userNapiConfig.name;
	}
	if (!targets.length) {
		var _userNapiConfig$tripl, _userNapiConfig$tripl2;
		let deprecatedWarned = false;
		const warning = (0, colorette.yellow)(`[DEPRECATED] napi.triples is deprecated, use napi.targets instead.`);
		if ((_userNapiConfig$tripl = userNapiConfig.triples) === null || _userNapiConfig$tripl === void 0 ? void 0 : _userNapiConfig$tripl.defaults) {
			deprecatedWarned = true;
			console.warn(warning);
			targets = targets.concat(DEFAULT_TARGETS);
		}
		if ((_userNapiConfig$tripl2 = userNapiConfig.triples) === null || _userNapiConfig$tripl2 === void 0 || (_userNapiConfig$tripl2 = _userNapiConfig$tripl2.additional) === null || _userNapiConfig$tripl2 === void 0 ? void 0 : _userNapiConfig$tripl2.length) {
			targets = targets.concat(userNapiConfig.triples.additional);
			if (!deprecatedWarned) console.warn(warning);
		}
	}
	if (new Set(targets).size !== targets.length) {
		const duplicateTarget = targets.find((target, index) => targets.indexOf(target) !== index);
		throw new Error(`Duplicate targets are not allowed: ${duplicateTarget}`);
	}
	napiConfig.targets = targets.map(parseTriple);
	return napiConfig;
}
//#endregion
//#region src/utils/cargo.ts
function tryInstallCargoBinary(name, bin) {
	if (detectCargoBinary(bin)) {
		debug$10("Cargo binary already installed: %s", name);
		return;
	}
	try {
		debug$10("Installing cargo binary: %s", name);
		(0, node_child_process.execSync)(`cargo install ${name}`, { stdio: "inherit" });
	} catch (e) {
		throw new Error(`Failed to install cargo binary: ${name}`, { cause: e });
	}
}
function detectCargoBinary(bin) {
	debug$10("Detecting cargo binary: %s", bin);
	try {
		(0, node_child_process.execSync)(`cargo help ${bin}`, { stdio: "ignore" });
		debug$10("Cargo binary detected: %s", bin);
		return true;
	} catch {
		debug$10("Cargo binary not detected: %s", bin);
		return false;
	}
}
//#endregion
//#region src/utils/typegen.ts
const TOP_LEVEL_NAMESPACE = "__TOP_LEVEL_MODULE__";
const DEFAULT_TYPE_DEF_HEADER = `/* auto-generated by NAPI-RS */
/* eslint-disable */
`;
/**
* Render a single intermediate type-def line as the TypeScript source it
* should produce in `index.d.ts`.
*
* @param line - The intermediate type-def entry to render.
* @param constEnum - When true, emit numeric and string `#[napi]` enums as
*   `const enum`. When false (`--no-const-enum`), numeric enums become
*   regular runtime enums and string enums fall back to a type-only union
*   unless `runtimeStringEnum` is also true.
* @param runtimeStringEnum - When true under `--no-const-enum`, emit
*   `#[napi(string_enum)]` as a runtime enum (`export declare enum`)
*   instead of a type-only union. No-op when `constEnum` is true.
* @param ident - Indentation level applied to the rendered output.
* @param ambient - When true, emit declarations in the ambient form used
*   inside `declare namespace` blocks (e.g. drop the `declare` keyword).
*/
function prettyPrint(line, constEnum, runtimeStringEnum, ident, ambient = false) {
	let s = line.js_doc ?? "";
	switch (line.kind) {
		case "interface":
			s += `export interface ${line.name} {\n${line.def}\n}`;
			break;
		case "type":
			s += `export type ${line.name} = \n${line.def}`;
			break;
		case "enum": {
			const enumName = constEnum ? "const enum" : "enum";
			s += `${exportDeclare(ambient)} ${enumName} ${line.name} {\n${line.def}\n}`;
			break;
		}
		case "string_enum":
			if (constEnum) s += `${exportDeclare(ambient)} const enum ${line.name} {\n${line.def}\n}`;
			else if (runtimeStringEnum) s += `${exportDeclare(ambient)} enum ${line.name} {\n${line.def}\n}`;
			else s += `export type ${line.name} = ${line.def.replaceAll(/.*=/g, "").replaceAll(",", "|")};`;
			break;
		case "struct":
			const extendsDef = line.extends ? ` extends ${line.extends}` : "";
			if (line.extends) {
				const genericMatch = line.extends.match(/Iterator<(.+)>$/);
				if (genericMatch) {
					const [T, TResult, TNext] = genericMatch[1].split(",").map((p) => p.trim());
					line.def = line.def + `\nnext(value?: ${TNext}): IteratorResult<${T}, ${TResult}>`;
				}
			}
			s += `${exportDeclare(ambient)} class ${line.name}${extendsDef} {\n${line.def}\n}`;
			if (line.original_name && line.original_name !== line.name) s += `\nexport type ${line.original_name} = ${line.name}`;
			break;
		case "fn":
			s += `${exportDeclare(ambient)} ${line.def}`;
			break;
		default: s += line.def;
	}
	return correctStringIdent(s, ident);
}
function exportDeclare(ambient) {
	if (ambient) return "export";
	return "export declare";
}
/**
* Read the napi-derive-emitted intermediate type-def file and render its
* entries into the `index.d.ts` source string plus the list of names to
* re-export from `index.js`.
*
* @param intermediateTypeFile - Path to the JSONL type-def file produced
*   by napi-derive (one entry per `#[napi]` item).
* @param constEnum - See {@link prettyPrint}.
* @param runtimeStringEnum - See {@link prettyPrint}. Defaults to `false`.
*/
async function processTypeDef(intermediateTypeFile, constEnum, runtimeStringEnum = false) {
	const exports = [];
	const groupedDefs = preprocessTypeDef(await readIntermediateTypeFile(intermediateTypeFile));
	return {
		dts: (0, es_toolkit.sortBy)(Array.from(groupedDefs), [([namespace]) => namespace]).map(([namespace, defs]) => {
			if (namespace === TOP_LEVEL_NAMESPACE) return defs.map((def) => {
				switch (def.kind) {
					case "const":
					case "enum":
					case "string_enum":
					case "fn":
					case "struct":
						exports.push(def.name);
						if (def.original_name && def.original_name !== def.name) exports.push(def.original_name);
						break;
					default: break;
				}
				return prettyPrint(def, constEnum, runtimeStringEnum, 0);
			}).join("\n\n");
			else {
				exports.push(namespace);
				let declaration = "";
				declaration += `export declare namespace ${namespace} {\n`;
				for (const def of defs) declaration += prettyPrint(def, constEnum, runtimeStringEnum, 2, true) + "\n";
				declaration += "}";
				return declaration;
			}
		}).join("\n\n") + "\n",
		exports
	};
}
async function readIntermediateTypeFile(file) {
	return (await readFileAsync(file, "utf8")).split("\n").filter(Boolean).map((line) => {
		line = line.trim();
		const parsed = JSON.parse(line);
		if (parsed.js_doc) parsed.js_doc = parsed.js_doc.replace(/\\n/g, "\n");
		if (parsed.def) parsed.def = parsed.def.replace(/\\n/g, "\n");
		return parsed;
	}).sort((a, b) => {
		if (a.kind === "struct") {
			if (b.kind === "struct") return a.name.localeCompare(b.name);
			return -1;
		} else if (b.kind === "struct") return 1;
		else return a.name.localeCompare(b.name);
	});
}
function preprocessTypeDef(defs) {
	const namespaceGrouped = /* @__PURE__ */ new Map();
	const classDefs = /* @__PURE__ */ new Map();
	for (const def of defs) {
		const namespace = def.js_mod ?? TOP_LEVEL_NAMESPACE;
		if (!namespaceGrouped.has(namespace)) namespaceGrouped.set(namespace, []);
		const group = namespaceGrouped.get(namespace);
		if (def.kind === "struct") {
			group.push(def);
			classDefs.set(def.name, def);
		} else if (def.kind === "extends") {
			const classDef = classDefs.get(def.name);
			if (classDef) classDef.extends = def.def;
		} else if (def.kind === "impl") {
			const classDef = classDefs.get(def.name);
			if (classDef) {
				if (classDef.def) classDef.def += "\n";
				classDef.def += def.def;
				if (classDef.def) classDef.def = classDef.def.replace(/\\n/g, "\n");
			}
		} else group.push(def);
	}
	return namespaceGrouped;
}
function correctStringIdent(src, ident) {
	let bracketDepth = 0;
	return src.split("\n").map((line) => {
		line = line.trim();
		if (line === "") return "";
		const isInMultilineComment = line.startsWith("*");
		const isClosingBracket = line.endsWith("}");
		const isOpeningBracket = line.endsWith("{");
		const isTypeDeclaration = line.endsWith("=");
		const isTypeVariant = line.startsWith("|");
		let rightIndent = ident;
		if ((isOpeningBracket || isTypeDeclaration) && !isInMultilineComment) {
			bracketDepth += 1;
			rightIndent += (bracketDepth - 1) * 2;
		} else {
			if (isClosingBracket && bracketDepth > 0 && !isInMultilineComment && !isTypeVariant) bracketDepth -= 1;
			rightIndent += bracketDepth * 2;
		}
		if (isInMultilineComment) rightIndent += 1;
		return `${" ".repeat(rightIndent)}${line}`;
	}).join("\n");
}
//#endregion
//#region src/utils/read-config.ts
async function readConfig(options) {
	const resolvePath = (...paths) => (0, node_path.resolve)(options.cwd, ...paths);
	return await readNapiConfig(resolvePath(options.packageJsonPath ?? "package.json"), options.configPath ? resolvePath(options.configPath) : void 0);
}
//#endregion
//#region src/api/artifacts.ts
const debug$8 = debugFactory("artifacts");
async function collectArtifacts(userOptions) {
	const options = applyDefaultArtifactsOptions(userOptions);
	const resolvePath = (...paths) => (0, node_path.resolve)(options.cwd, ...paths);
	const packageJsonPath = resolvePath(options.packageJsonPath);
	const { targets, binaryName, packageName } = await readNapiConfig(packageJsonPath, options.configPath ? resolvePath(options.configPath) : void 0);
	const distDirs = targets.map((platform) => (0, node_path.join)(options.cwd, options.npmDir, platform.platformArchABI));
	const universalSourceBins = new Set(targets.filter((platform) => platform.arch === "universal").flatMap((p) => {
		var _UniArchsByPlatform$p;
		return (_UniArchsByPlatform$p = UniArchsByPlatform[p.platform]) === null || _UniArchsByPlatform$p === void 0 ? void 0 : _UniArchsByPlatform$p.map((a) => `${p.platform}-${a}`);
	}).filter(Boolean));
	await collectNodeBinaries((0, node_path.join)(options.cwd, options.outputDir)).then((output) => Promise.all(output.map(async (filePath) => {
		debug$8.info(`Read [${colorette.yellowBright(filePath)}]`);
		const sourceContent = await readFileAsync(filePath);
		const parsedName = (0, node_path.parse)(filePath);
		const terms = parsedName.name.split(".");
		const platformArchABI = terms.pop();
		const _binaryName = terms.join(".");
		if (_binaryName !== binaryName) {
			debug$8.warn(`[${_binaryName}] is not matched with [${binaryName}], skip`);
			return;
		}
		const dir = distDirs.find((dir) => dir.includes(platformArchABI));
		if (!dir && universalSourceBins.has(platformArchABI)) {
			debug$8.warn(`[${platformArchABI}] has no dist dir but it is source bin for universal arch, skip`);
			return;
		}
		if (!dir) throw new Error(`No dist dir found for ${filePath}`);
		const distFilePath = (0, node_path.join)(dir, parsedName.base);
		debug$8.info(`Write file content to [${colorette.yellowBright(distFilePath)}]`);
		await writeFileAsync(distFilePath, sourceContent);
		const distFilePathLocal = (0, node_path.join)((0, node_path.parse)(packageJsonPath).dir, parsedName.base);
		debug$8.info(`Write file content to [${colorette.yellowBright(distFilePathLocal)}]`);
		await writeFileAsync(distFilePathLocal, sourceContent);
	})));
	const wasiTarget = targets.find((t) => t.platform === "wasi");
	if (wasiTarget) {
		const buildOutputDir = options.buildOutputDir ? (0, node_path.resolve)(options.cwd, options.buildOutputDir) : options.cwd;
		const wasiDir = (0, node_path.join)(options.cwd, options.npmDir, wasiTarget.platformArchABI);
		const cjsFile = (0, node_path.join)(buildOutputDir, `${binaryName}.wasi.cjs`);
		const workerFile = (0, node_path.join)(buildOutputDir, `wasi-worker.mjs`);
		const browserEntry = (0, node_path.join)(buildOutputDir, `${binaryName}.wasi-browser.js`);
		const browserWorkerFile = (0, node_path.join)(buildOutputDir, `wasi-worker-browser.mjs`);
		debug$8.info(`Move wasi binding file [${colorette.yellowBright(cjsFile)}] to [${colorette.yellowBright(wasiDir)}]`);
		await writeFileAsync((0, node_path.join)(wasiDir, `${binaryName}.wasi.cjs`), await readFileAsync(cjsFile));
		debug$8.info(`Move wasi worker file [${colorette.yellowBright(workerFile)}] to [${colorette.yellowBright(wasiDir)}]`);
		await writeFileAsync((0, node_path.join)(wasiDir, `wasi-worker.mjs`), await readFileAsync(workerFile));
		debug$8.info(`Move wasi browser entry file [${colorette.yellowBright(browserEntry)}] to [${colorette.yellowBright(wasiDir)}]`);
		await writeFileAsync((0, node_path.join)(wasiDir, `${binaryName}.wasi-browser.js`), (await readFileAsync(browserEntry, "utf8")).replace(`new URL('./wasi-worker-browser.mjs', import.meta.url)`, `new URL('${packageName}-wasm32-wasi/wasi-worker-browser.mjs', import.meta.url)`));
		debug$8.info(`Move wasi browser worker file [${colorette.yellowBright(browserWorkerFile)}] to [${colorette.yellowBright(wasiDir)}]`);
		await writeFileAsync((0, node_path.join)(wasiDir, `wasi-worker-browser.mjs`), await readFileAsync(browserWorkerFile));
	}
}
async function collectNodeBinaries(root) {
	const files = await readdirAsync(root, { withFileTypes: true });
	const nodeBinaries = files.filter((file) => file.isFile() && (file.name.endsWith(".node") || file.name.endsWith(".wasm"))).map((file) => (0, node_path.join)(root, file.name));
	const dirs = files.filter((file) => file.isDirectory());
	for (const dir of dirs) if (dir.name !== "node_modules") nodeBinaries.push(...await collectNodeBinaries((0, node_path.join)(root, dir.name)));
	return nodeBinaries;
}
//#endregion
//#region src/api/templates/js-binding.ts
function createCjsBinding(localName, pkgName, idents, packageVersion) {
	return `${bindingHeader}
${createCommonBinding(localName, pkgName, packageVersion)}
module.exports = nativeBinding
${idents.map((ident) => `module.exports.${ident} = nativeBinding.${ident}`).join("\n")}
`;
}
function createEsmBinding(localName, pkgName, idents, packageVersion) {
	return `${bindingHeader}
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const __dirname = new URL('.', import.meta.url).pathname

${createCommonBinding(localName, pkgName, packageVersion)}
const { ${idents.join(", ")} } = nativeBinding
${idents.map((ident) => `export { ${ident} }`).join("\n")}
`;
}
const bindingHeader = `// prettier-ignore
/* eslint-disable */
// @ts-nocheck
/* auto-generated by NAPI-RS */
`;
function createCommonBinding(localName, pkgName, packageVersion) {
	function requireTuple(tuple, identSize = 8) {
		const identLow = " ".repeat(identSize - 2);
		const ident = " ".repeat(identSize);
		return `try {
${ident}return require('./${localName}.${tuple}.node')
${identLow}} catch (e) {
${ident}loadErrors.push(e)
${identLow}}${packageVersion ? `
${identLow}try {
${ident}const binding = require('${pkgName}-${tuple}')
${ident}const bindingPackageVersion = require('${pkgName}-${tuple}/package.json').version
${ident}if (bindingPackageVersion !== '${packageVersion}' && process.env.NAPI_RS_ENFORCE_VERSION_CHECK && process.env.NAPI_RS_ENFORCE_VERSION_CHECK !== '0') {
${ident}  throw new Error(\`Native binding package version mismatch, expected ${packageVersion} but got \${bindingPackageVersion}. You can reinstall dependencies to fix this issue.\`)
${ident}}
${ident}return binding
${identLow}} catch (e) {
${ident}loadErrors.push(e)
${identLow}}` : `
${identLow}try {
${ident}return require('${pkgName}-${tuple}')
${identLow}} catch (e) {
${ident}loadErrors.push(e)
${identLow}}`}`;
	}
	return `const { readFileSync } = require('fs')
let nativeBinding = null
const loadErrors = []

const isMusl = () => {
  let musl = false
  if (process.platform === 'linux') {
    musl = isMuslFromFilesystem()
    if (musl === null) {
      musl = isMuslFromReport()
    }
    if (musl === null) {
      musl = isMuslFromChildProcess()
    }
  }
  return musl
}

const isFileMusl = (f) => f.includes('libc.musl-') || f.includes('ld-musl-')

const isMuslFromFilesystem = () => {
  try {
    return readFileSync('/usr/bin/ldd', 'utf-8').includes('musl')
  } catch {
    return null
  }
}

const isMuslFromReport = () => {
  let report = null
  if (process.report && typeof process.report.getReport === 'function') {
    process.report.excludeNetwork = true
    report = process.report.getReport()
  }
  if (!report) {
    return null
  }
  if (report.header && report.header.glibcVersionRuntime) {
    return false
  }
  if (Array.isArray(report.sharedObjects)) {
    if (report.sharedObjects.some(isFileMusl)) {
      return true
    }
  }
  return false
}

const isMuslFromChildProcess = () => {
  try {
    return require('child_process').execSync('ldd --version', { encoding: 'utf8' }).includes('musl')
  } catch (e) {
    // If we reach this case, we don't know if the system is musl or not, so is better to just fallback to false
    return false
  }
}

function requireNative() {
  if (process.env.NAPI_RS_NATIVE_LIBRARY_PATH) {
    try {
      return require(process.env.NAPI_RS_NATIVE_LIBRARY_PATH);
    } catch (err) {
      loadErrors.push(err)
    }
  } else if (process.platform === 'android') {
    if (process.arch === 'arm64') {
      ${requireTuple("android-arm64")}
    } else if (process.arch === 'arm') {
      ${requireTuple("android-arm-eabi")}
    } else {
      loadErrors.push(new Error(\`Unsupported architecture on Android \${process.arch}\`))
    }
  } else if (process.platform === 'win32') {
    if (process.arch === 'x64') {
      if ((process.config && process.config.variables && process.config.variables.shlib_suffix === 'dll.a') || (process.config && process.config.variables && process.config.variables.node_target_type === 'shared_library')) {
        ${requireTuple("win32-x64-gnu")}
      } else {
        ${requireTuple("win32-x64-msvc")}
      }
    } else if (process.arch === 'ia32') {
      ${requireTuple("win32-ia32-msvc")}
    } else if (process.arch === 'arm64') {
      ${requireTuple("win32-arm64-msvc")}
    } else {
      loadErrors.push(new Error(\`Unsupported architecture on Windows: \${process.arch}\`))
    }
  } else if (process.platform === 'darwin') {
    ${requireTuple("darwin-universal", 6)}
    if (process.arch === 'x64') {
      ${requireTuple("darwin-x64")}
    } else if (process.arch === 'arm64') {
      ${requireTuple("darwin-arm64")}
    } else {
      loadErrors.push(new Error(\`Unsupported architecture on macOS: \${process.arch}\`))
    }
  } else if (process.platform === 'freebsd') {
    if (process.arch === 'x64') {
      ${requireTuple("freebsd-x64")}
    } else if (process.arch === 'arm64') {
      ${requireTuple("freebsd-arm64")}
    } else {
      loadErrors.push(new Error(\`Unsupported architecture on FreeBSD: \${process.arch}\`))
    }
  } else if (process.platform === 'linux') {
    if (process.arch === 'x64') {
      if (isMusl()) {
        ${requireTuple("linux-x64-musl", 10)}
      } else {
        ${requireTuple("linux-x64-gnu", 10)}
      }
    } else if (process.arch === 'arm64') {
      if (isMusl()) {
        ${requireTuple("linux-arm64-musl", 10)}
      } else {
        ${requireTuple("linux-arm64-gnu", 10)}
      }
    } else if (process.arch === 'arm') {
      if (isMusl()) {
        ${requireTuple("linux-arm-musleabihf", 10)}
      } else {
        ${requireTuple("linux-arm-gnueabihf", 10)}
      }
    } else if (process.arch === 'loong64') {
      if (isMusl()) {
        ${requireTuple("linux-loong64-musl", 10)}
      } else {
        ${requireTuple("linux-loong64-gnu", 10)}
      }
    } else if (process.arch === 'riscv64') {
      if (isMusl()) {
        ${requireTuple("linux-riscv64-musl", 10)}
      } else {
        ${requireTuple("linux-riscv64-gnu", 10)}
      }
    } else if (process.arch === 'ppc64') {
      ${requireTuple("linux-ppc64-gnu")}
    } else if (process.arch === 's390x') {
      ${requireTuple("linux-s390x-gnu")}
    } else {
      loadErrors.push(new Error(\`Unsupported architecture on Linux: \${process.arch}\`))
    }
  } else if (process.platform === 'openharmony') {
    if (process.arch === 'arm64') {
      ${requireTuple("openharmony-arm64")}
    } else if (process.arch === 'x64') {
      ${requireTuple("openharmony-x64")}
    } else if (process.arch === 'arm') {
      ${requireTuple("openharmony-arm")}
    } else {
      loadErrors.push(new Error(\`Unsupported architecture on OpenHarmony: \${process.arch}\`))
    }
  } else {
    loadErrors.push(new Error(\`Unsupported OS: \${process.platform}, architecture: \${process.arch}\`))
  }
}

nativeBinding = requireNative()

// NAPI_RS_FORCE_WASI is a tri-state flag:
//   unset / any other value → native binding preferred, WASI is only a fallback
//   'true'                   → force WASI fallback even if native loaded
//   'error'                  → force WASI and throw if no WASI binding is found
// Treating any non-empty string as truthy (the historical behavior) meant
// NAPI_RS_FORCE_WASI=false, NAPI_RS_FORCE_WASI=0, etc. inadvertently triggered
// the WASI path, causing ENOENT for packages shipped without a .wasi.cjs file.
const forceWasi =
  process.env.NAPI_RS_FORCE_WASI === 'true' || process.env.NAPI_RS_FORCE_WASI === 'error'

if (!nativeBinding || forceWasi) {
  let wasiBinding = null
  let wasiBindingError = null
  try {
    wasiBinding = require('./${localName}.wasi.cjs')
    nativeBinding = wasiBinding
  } catch (err) {
    if (forceWasi) {
      wasiBindingError = err
    }
  }
  if (!nativeBinding || forceWasi) {
    try {
      wasiBinding = require('${pkgName}-wasm32-wasi')
      nativeBinding = wasiBinding
    } catch (err) {
      if (forceWasi) {
        if (!wasiBindingError) {
          wasiBindingError = err
        } else {
          wasiBindingError.cause = err
        }
        loadErrors.push(err)
      }
    }
  }
  if (process.env.NAPI_RS_FORCE_WASI === 'error' && !wasiBinding) {
    const error = new Error('WASI binding not found and NAPI_RS_FORCE_WASI is set to error')
    error.cause = wasiBindingError
    throw error
  }
}

if (!nativeBinding) {
  if (loadErrors.length > 0) {
    const error = new Error(
      \`Cannot find native binding. \` +
        \`npm has a bug related to optional dependencies (https://github.com/npm/cli/issues/4828). \` +
        'Please try \`npm i\` again after removing both package-lock.json and node_modules directory.',
    )
    // assign instead of the \`new Error(message, { cause })\` options form,
    // which Node < 16.9 silently ignores
    error.cause = loadErrors.reduce((err, cur) => {
      cur.cause = err
      return cur
    })
    throw error
  }
  throw new Error(\`Failed to load native binding\`)
}
`;
}
//#endregion
//#region src/api/templates/load-wasi-template.ts
const createWasiBrowserBinding = (wasiFilename, initialMemory = 4e3, maximumMemory = 65536, fs = false, asyncInit = false, buffer = false, errorEvent = false) => {
	return `import {
  createOnMessage as __wasmCreateOnMessageForFsProxy,
  getDefaultContext as __emnapiGetDefaultContext,
  ${asyncInit ? `instantiateNapiModule as __emnapiInstantiateNapiModule` : `instantiateNapiModuleSync as __emnapiInstantiateNapiModuleSync`},
  WASI as __WASI,
} from '@napi-rs/wasm-runtime'
${fs ? buffer ? `import { memfs, Buffer } from '@napi-rs/wasm-runtime/fs'` : `import { memfs } from '@napi-rs/wasm-runtime/fs'` : ""}
${buffer && !fs ? `import { Buffer } from 'buffer'` : ""}
${fs ? `
export const { fs: __fs, vol: __volume } = memfs()

const __wasi = new __WASI({
  version: 'preview1',
  fs: __fs,
  preopens: {
    '/': '/',
  },
})` : `
const __wasi = new __WASI({
  version: 'preview1',
})`}

const __wasmUrl = new URL('./${wasiFilename}.wasm', import.meta.url).href
const __emnapiContext = __emnapiGetDefaultContext()
${buffer ? "__emnapiContext.feature.Buffer = Buffer" : ""}

const __sharedMemory = new WebAssembly.Memory({
  initial: ${initialMemory},
  maximum: ${maximumMemory},
  shared: true,
})

const __wasmFile = await fetch(__wasmUrl).then((res) => res.arrayBuffer())

const {
  instance: __napiInstance,
  module: __wasiModule,
  napiModule: __napiModule,
} = ${asyncInit ? `await __emnapiInstantiateNapiModule` : `__emnapiInstantiateNapiModuleSync`}(__wasmFile, {
  context: __emnapiContext,
  asyncWorkPoolSize: 4,
  wasi: __wasi,
  onCreateWorker() {
    const worker = new Worker(new URL('./wasi-worker-browser.mjs', import.meta.url), {
      type: 'module',
    })
${fs ? `    worker.addEventListener('message', __wasmCreateOnMessageForFsProxy(__fs))\n` : ""}
${errorEvent ? `    worker.addEventListener('message', (event) => {
      if (event.data && typeof event.data === 'object' && event.data.type === 'error') {
        window.dispatchEvent(new CustomEvent('napi-rs-worker-error', { detail: event.data }))
      }
    })
` : ""}
    return worker
  },
  overwriteImports(importObject) {
    importObject.env = {
      ...importObject.env,
      ...importObject.napi,
      ...importObject.emnapi,
      memory: __sharedMemory,
    }
    return importObject
  },
  beforeInit({ instance }) {
    for (const name of Object.keys(instance.exports)) {
      if (name.startsWith('__napi_register__')) {
        instance.exports[name]()
      }
    }
  },
})
`;
};
const createWasiBinding = (wasmFileName, packageName, initialMemory = 4e3, maximumMemory = 65536) => `/* eslint-disable */
/* prettier-ignore */

/* auto-generated by NAPI-RS */

const __nodeFs = require('node:fs')
const __nodePath = require('node:path')
const { WASI: __nodeWASI } = require('node:wasi')
const { Worker } = require('node:worker_threads')

const {
  createOnMessage: __wasmCreateOnMessageForFsProxy,
  getDefaultContext: __emnapiGetDefaultContext,
  instantiateNapiModuleSync: __emnapiInstantiateNapiModuleSync,
} = require('@napi-rs/wasm-runtime')

const __rootDir = __nodePath.parse(process.cwd()).root

const __wasi = new __nodeWASI({
  version: 'preview1',
  env: process.env,
  preopens: {
    [__rootDir]: __rootDir,
  }
})

const __emnapiContext = __emnapiGetDefaultContext()

const __sharedMemory = new WebAssembly.Memory({
  initial: ${initialMemory},
  maximum: ${maximumMemory},
  shared: true,
})

let __wasmFilePath = __nodePath.join(__dirname, '${wasmFileName}.wasm')
const __wasmDebugFilePath = __nodePath.join(__dirname, '${wasmFileName}.debug.wasm')

if (__nodeFs.existsSync(__wasmDebugFilePath)) {
  __wasmFilePath = __wasmDebugFilePath
} else if (!__nodeFs.existsSync(__wasmFilePath)) {
  try {
    __wasmFilePath = require.resolve('${packageName}-wasm32-wasi/${wasmFileName}.wasm')
  } catch {
    throw new Error('Cannot find ${wasmFileName}.wasm file, and ${packageName}-wasm32-wasi package is not installed.')
  }
}

const { instance: __napiInstance, module: __wasiModule, napiModule: __napiModule } = __emnapiInstantiateNapiModuleSync(__nodeFs.readFileSync(__wasmFilePath), {
  context: __emnapiContext,
  asyncWorkPoolSize: (function() {
    const threadsSizeFromEnv = Number(process.env.NAPI_RS_ASYNC_WORK_POOL_SIZE ?? process.env.UV_THREADPOOL_SIZE)
    // NaN > 0 is false
    if (threadsSizeFromEnv > 0) {
      return threadsSizeFromEnv
    } else {
      return 4
    }
  })(),
  reuseWorker: true,
  wasi: __wasi,
  onCreateWorker() {
    const worker = new Worker(__nodePath.join(__dirname, 'wasi-worker.mjs'), {
      env: process.env,
    })
    worker.onmessage = ({ data }) => {
      __wasmCreateOnMessageForFsProxy(__nodeFs)(data)
    }

    // The main thread of Node.js waits for all the active handles before exiting.
    // But Rust threads are never waited without \`thread::join\`.
    // So here we hack the code of Node.js to prevent the workers from being referenced (active).
    // According to https://github.com/nodejs/node/blob/19e0d472728c79d418b74bddff588bea70a403d0/lib/internal/worker.js#L415,
    // a worker is consist of two handles: kPublicPort and kHandle.
    {
      const kPublicPort = Object.getOwnPropertySymbols(worker).find(s =>
        s.toString().includes("kPublicPort")
      );
      if (kPublicPort) {
        worker[kPublicPort].ref = () => {};
      }

      const kHandle = Object.getOwnPropertySymbols(worker).find(s =>
        s.toString().includes("kHandle")
      );
      if (kHandle) {
        worker[kHandle].ref = () => {};
      }

      worker.unref();
    }
    return worker
  },
  overwriteImports(importObject) {
    importObject.env = {
      ...importObject.env,
      ...importObject.napi,
      ...importObject.emnapi,
      memory: __sharedMemory,
    }
    return importObject
  },
  beforeInit({ instance }) {
    for (const name of Object.keys(instance.exports)) {
      if (name.startsWith('__napi_register__')) {
        instance.exports[name]()
      }
    }
  },
})
`;
//#endregion
//#region src/api/templates/wasi-worker-template.ts
const WASI_WORKER_TEMPLATE = `import fs from "node:fs";
import { createRequire } from "node:module";
import { parse } from "node:path";
import { WASI } from "node:wasi";
import { parentPort, Worker } from "node:worker_threads";

const require = createRequire(import.meta.url);

const { instantiateNapiModuleSync, MessageHandler, getDefaultContext } = require("@napi-rs/wasm-runtime");

if (parentPort) {
  parentPort.on("message", (data) => {
    globalThis.onmessage({ data });
  });
}

Object.assign(globalThis, {
  self: globalThis,
  require,
  Worker,
  importScripts: function (f) {
    ;(0, eval)(fs.readFileSync(f, "utf8") + "//# sourceURL=" + f);
  },
  postMessage: function (msg) {
    if (parentPort) {
      parentPort.postMessage(msg);
    }
  },
});

const emnapiContext = getDefaultContext();

const __rootDir = parse(process.cwd()).root;

const handler = new MessageHandler({
  onLoad({ wasmModule, wasmMemory }) {
    const wasi = new WASI({
      version: 'preview1',
      env: process.env,
      preopens: {
        [__rootDir]: __rootDir,
      },
    });

    return instantiateNapiModuleSync(wasmModule, {
      childThread: true,
      wasi,
      context: emnapiContext,
      overwriteImports(importObject) {
        importObject.env = {
          ...importObject.env,
          ...importObject.napi,
          ...importObject.emnapi,
          memory: wasmMemory
        };
      },
    });
  },
});

globalThis.onmessage = function (e) {
  handler.handle(e);
};
`;
const createWasiBrowserWorkerBinding = (fs, errorEvent) => {
	const fsImport = fs ? `import { instantiateNapiModuleSync, MessageHandler, WASI, createFsProxy } from '@napi-rs/wasm-runtime'
import { memfsExported as __memfsExported } from '@napi-rs/wasm-runtime/fs'

const fs = createFsProxy(__memfsExported)` : `import { instantiateNapiModuleSync, MessageHandler, WASI } from '@napi-rs/wasm-runtime'`;
	const errorOutputsAppend = errorEvent ? `\n        errorOutputs.push([...arguments])` : "";
	const wasiCreation = fs ? `const wasi = new WASI({
      fs,
      preopens: {
        '/': '/',
      },
      print: function () {
        // eslint-disable-next-line no-console
        console.log.apply(console, arguments)
      },
      printErr: function() {
        // eslint-disable-next-line no-console
        console.error.apply(console, arguments)
        ${errorOutputsAppend}
      },
    })` : `const wasi = new WASI({
      print: function () {
        // eslint-disable-next-line no-console
        console.log.apply(console, arguments)
      },
      printErr: function() {
        // eslint-disable-next-line no-console
        console.error.apply(console, arguments)
        ${errorOutputsAppend}
      },
    })`;
	return `${fsImport}
${errorEvent ? `\nconst errorOutputs = []\n` : ""}
const handler = new MessageHandler({
  onLoad({ wasmModule, wasmMemory }) {
    ${wasiCreation}
    return instantiateNapiModuleSync(wasmModule, {
      childThread: true,
      wasi,
      overwriteImports(importObject) {
        importObject.env = {
          ...importObject.env,
          ...importObject.napi,
          ...importObject.emnapi,
          memory: wasmMemory,
        }
      },
    })
  },
  ${errorEvent ? `onError(error) {
    postMessage({ type: 'error', error, errorOutputs })
    errorOutputs.length = 0
  }` : ""}
})

globalThis.onmessage = function (e) {
  handler.handle(e)
}
`;
};
//#endregion
//#region src/api/build.ts
const debug$7 = debugFactory("build");
const require$2 = (0, node_module.createRequire)(require("url").pathToFileURL(__filename).href);
async function buildProject(rawOptions) {
	debug$7("napi build command receive options: %O", rawOptions);
	const options = {
		dtsCache: true,
		...rawOptions,
		cwd: rawOptions.cwd ?? process.cwd()
	};
	validateCrossCompileFlags(options);
	if (options.useNapiCross) {
		validateNapiCrossHost();
		validateNapiCrossSupport(resolveTarget(options.target).triple);
	}
	const resolvePath = (...paths) => (0, node_path.resolve)(options.cwd, ...paths);
	const manifestPath = resolvePath(options.manifestPath ?? "Cargo.toml");
	const metadata = await parseMetadata(manifestPath, {
		features: options.features,
		allFeatures: options.allFeatures,
		noDefaultFeatures: options.noDefaultFeatures
	});
	const crate = metadata.packages.find((p) => {
		if (options.package) return p.name === options.package;
		else return p.manifest_path === manifestPath;
	});
	if (!crate) throw new Error("Unable to find crate to build. It seems you are trying to build a crate in a workspace, try using `--package` option to specify the package to build.");
	return new Builder(metadata, crate, await readNapiConfig(resolvePath(options.packageJsonPath ?? "package.json"), options.configPath ? resolvePath(options.configPath) : void 0), options).build();
}
/**
* Resolve the target triple the build will run against, following the same
* precedence the build itself uses: the explicit `--target` option, then the
* `CARGO_BUILD_TARGET` environment variable, then the host default target.
*/
function resolveTarget(targetOption) {
	return targetOption ? parseTriple(targetOption) : process.env.CARGO_BUILD_TARGET ? parseTriple(process.env.CARGO_BUILD_TARGET) : getSystemDefaultTarget();
}
/**
* Validate the combination of the cross-compilation related flags.
*
* `--use-cross`, `--use-napi-cross` and `--cross-compile` (`-x`) are three
* mutually exclusive cross-compilation mechanisms; combining any two of them
* leaves both active at once and produces broken builds, so it is rejected
* upfront before any side effect (like auto-installing cargo binaries or
* downloading toolchains) happens.
*
* `--cross-compile` with a `windows-gnu` target is rejected as well: on a
* non-Windows host it routes the build to `cargo xwin build`, but
* `cargo-xwin` only sets up MSVC toolchains — for `windows-gnu` targets it
* silently does nothing and the build dies much later with a cryptic
* ``error: linker `x86_64-w64-mingw32-gcc` not found`` that never mentions
* `cargo-xwin`. Only an explicitly requested target (`--target` or
* `CARGO_BUILD_TARGET`) is inspected, so this validation never has to spawn
* `rustc -vV`; a non-Windows host's default target can never be
* `windows-gnu` anyway.
*/
function validateCrossCompileFlags(options, hostPlatform = process.platform) {
	const enabledCrossFlags = [
		options.useCross ? "`--use-cross`" : null,
		options.useNapiCross ? "`--use-napi-cross`" : null,
		options.crossCompile ? "`--cross-compile` (`-x`)" : null
	].filter((flag) => flag !== null);
	if (enabledCrossFlags.length > 1) throw new Error(`${enabledCrossFlags.join(" and ")} cannot be used together. Please pick exactly one cross-compilation mechanism: \`--use-cross\`, \`--use-napi-cross\`, or \`--cross-compile\` (\`-x\`).`);
	if (options.watch && options.useCross) throw new Error("`--watch` cannot be used with `--use-cross`. `cargo watch` only supports the plain `cargo build` flow, please drop one of the two flags.");
	if (options.watch && options.crossCompile) throw new Error("`--watch` cannot be used with `--cross-compile` (`-x`). `cargo watch` only supports the plain `cargo build` flow, please drop one of the two flags.");
	if (options.crossCompile && hostPlatform !== "win32") {
		const explicitTarget = options.target ?? process.env.CARGO_BUILD_TARGET;
		if (explicitTarget) {
			var _target$abi;
			const target = parseTriple(explicitTarget);
			if (target.platform === "win32" && ((_target$abi = target.abi) === null || _target$abi === void 0 ? void 0 : _target$abi.startsWith("gnu"))) {
				const msvcTriple = explicitTarget.replace(/gnu(llvm)?$/, "msvc");
				const toolchainHint = target.abi === "gnullvm" ? `an llvm-mingw (LLVM/Clang) toolchain on the \`PATH\` (\`rustc\` has no default working linker for ${explicitTarget} without one; \`napi-build\` additionally needs \`libnode.dll\` via the \`LIBNODE_PATH\` environment variable)` : `a mingw-w64 toolchain (\`rustc\` uses the \`${explicitTarget.split("-")[0]}-w64-mingw32-gcc\` linker; \`napi-build\` additionally needs \`libnode.dll\` via the \`LIBNODE_PATH\` environment variable)`;
				throw new Error(`\`--cross-compile\` (\`-x\`) does not support the target ${explicitTarget}: \`cargo-xwin\` only handles MSVC targets and the build would fail at link time. Drop \`-x\` and build with ${toolchainHint}, or target ${msvcTriple} instead.`);
			}
		}
	}
}
/**
* Validate that the current host can run the `@napi-rs/cross-toolchain`
* pre-built toolchains at all: they only run on Linux x64 and Linux arm64
* hosts. This check is separate from (and must run before) the per-target
* validation, because resolving the target may need to spawn `rustc`.
*/
function validateNapiCrossHost(hostPlatform = process.platform, hostArch = process.arch) {
	if (hostPlatform !== "linux" || hostArch !== "x64" && hostArch !== "arm64") throw new Error(`\`--use-napi-cross\` requires a Linux x64 or Linux arm64 host, but the current host is ${hostPlatform}-${hostArch}. Please use \`--cross-compile\` (\`-x\`) or \`--use-cross\` to cross compile on this host.`);
}
/**
* Validate that `--use-napi-cross` can actually handle the requested target
* on the current host. The supported target set is read from the
* `@napi-rs/cross-toolchain` package, and the pre-built toolchains only run
* on Linux x64 and Linux arm64 hosts.
*/
function validateNapiCrossSupport(targetTriple, hostPlatform = process.platform, hostArch = process.arch) {
	validateNapiCrossHost(hostPlatform, hostArch);
	const toolchains = require$2("@napi-rs/cross-toolchain");
	const supportedTargets = Object.keys(toolchains[hostArch]);
	if (!supportedTargets.includes(targetTriple)) throw new Error(`\`--use-napi-cross\` does not support the target ${targetTriple}. Supported targets: ${supportedTargets.join(", ")}. Please use \`--cross-compile\` (\`-x\`) or \`--use-cross\` for this target.`);
}
/**
* Compute the environment variables that route a `--use-napi-cross` build
* through the `@napi-rs/cross-toolchain` toolchain extracted at
* `toolchainPath`.
*
* Follows the same rule as `Builder#setEnvIfNotExists`: a variable the user
* already set in `env` wins and is not returned, and a present-but-empty
* variable counts as unset (falsy semantics). The only exceptions are the
* clang-specific `TARGET_CFLAGS`/`TARGET_CXXFLAGS`, which prepend the sysroot
* flags to the user's value, and `PATH`, which always gets the toolchain
* `bin` directory prepended.
*
* Exported for tests.
*/
function napiCrossToolchainEnvs(toolchainPath, targetTriple, env = process.env) {
	const alias = { "s390x-unknown-linux-gnu": "s390x-ibm-linux-gnu" };
	const envs = {};
	const setEnvIfNotExists = (name, value) => {
		if (!env[name]) envs[name] = value;
	};
	const upperCaseTarget = targetToEnvVar(targetTriple);
	const crossTargetName = alias[targetTriple] ?? targetTriple;
	setEnvIfNotExists(`CARGO_TARGET_${upperCaseTarget}_LINKER`, (0, node_path.join)(toolchainPath, "bin", `${crossTargetName}-gcc`));
	setEnvIfNotExists("TARGET_SYSROOT", (0, node_path.join)(toolchainPath, crossTargetName, "sysroot"));
	setEnvIfNotExists("TARGET_AR", (0, node_path.join)(toolchainPath, "bin", `${crossTargetName}-ar`));
	setEnvIfNotExists("TARGET_RANLIB", (0, node_path.join)(toolchainPath, "bin", `${crossTargetName}-ranlib`));
	setEnvIfNotExists("TARGET_READELF", (0, node_path.join)(toolchainPath, "bin", `${crossTargetName}-readelf`));
	setEnvIfNotExists("TARGET_C_INCLUDE_PATH", (0, node_path.join)(toolchainPath, crossTargetName, "sysroot", "usr", "include/"));
	setEnvIfNotExists("TARGET_CC", (0, node_path.join)(toolchainPath, "bin", `${crossTargetName}-gcc`));
	setEnvIfNotExists("TARGET_CXX", (0, node_path.join)(toolchainPath, "bin", `${crossTargetName}-g++`));
	const targetSysroot = env.TARGET_SYSROOT || envs.TARGET_SYSROOT;
	setEnvIfNotExists("BINDGEN_EXTRA_CLANG_ARGS", `--sysroot=${targetSysroot}`);
	const ccWrappers = /* @__PURE__ */ new Set([
		"ccache",
		"distcc",
		"sccache",
		"icecc",
		"cachepot",
		"buildcache",
		"kache"
	]);
	const clangExecutableName = /(^|-)clang(\+\+)?(-\d+)?$/;
	const isExistingFile = (path) => {
		try {
			var _statSync;
			return ((_statSync = (0, node_fs.statSync)(path, { throwIfNoEntry: false })) === null || _statSync === void 0 ? void 0 : _statSync.isFile()) ?? false;
		} catch {
			return false;
		}
	};
	const isClangCompiler = (value) => {
		if (!value) return false;
		const trimmed = value.trim();
		if (isExistingFile(trimmed)) return clangExecutableName.test((0, node_path.basename)(trimmed));
		const [first, second] = trimmed.split(/\s+/);
		const compiler = first && ccWrappers.has((0, node_path.basename)(first)) ? second : first;
		return compiler !== void 0 && clangExecutableName.test((0, node_path.basename)(compiler));
	};
	if (isClangCompiler(env.TARGET_CC || envs.TARGET_CC || env.CC)) envs.TARGET_CFLAGS = `--sysroot=${targetSysroot} --gcc-toolchain=${toolchainPath} ${env.TARGET_CFLAGS || ""}`;
	if (isClangCompiler(env.TARGET_CXX || envs.TARGET_CXX || env.CXX)) envs.TARGET_CXXFLAGS = `--sysroot=${targetSysroot} --gcc-toolchain=${toolchainPath} ${env.TARGET_CXXFLAGS || ""}`;
	envs.PATH = env.PATH ? `${toolchainPath}/bin:${env.PATH}` : `${toolchainPath}/bin`;
	return envs;
}
var Builder = class {
	metadata;
	crate;
	config;
	options;
	args = [];
	envs = {};
	outputs = [];
	target;
	crateDir;
	outputDir;
	targetDir;
	enableTypeDef = false;
	constructor(metadata, crate, config, options) {
		this.metadata = metadata;
		this.crate = crate;
		this.config = config;
		this.options = options;
		this.target = resolveTarget(options.target);
		this.crateDir = (0, node_path.parse)(crate.manifest_path).dir;
		this.outputDir = (0, node_path.resolve)(this.options.cwd, options.outputDir ?? this.crateDir);
		this.targetDir = options.targetDir ?? process.env.CARGO_BUILD_TARGET_DIR ?? metadata.target_directory;
		this.enableTypeDef = this.crate.dependencies.some((dep) => dep.name === "napi-derive" && (dep.uses_default_features || dep.features.includes("type-def")));
		if (!this.enableTypeDef) {
			const requirementWarning = "`napi-derive` crate is not used or `type-def` feature is not enabled for `napi-derive` crate";
			debug$7.warn(`${requirementWarning}. Will skip binding generation for \`.node\`, \`.wasi\` and \`.d.ts\` files.`);
			if (this.options.dts || this.options.dtsHeader || this.config.dtsHeader || this.config.dtsHeaderFile) debug$7.warn(`${requirementWarning}. \`dts\` related options are enabled but will be ignored.`);
		}
	}
	get cdyLibName() {
		var _this$crate$targets$f;
		if (this.options.bin) return;
		return (_this$crate$targets$f = this.crate.targets.find((t) => t.crate_types.includes("cdylib"))) === null || _this$crate$targets$f === void 0 ? void 0 : _this$crate$targets$f.name;
	}
	get binName() {
		var _this$crate$targets$f2;
		return this.options.bin ?? (this.cdyLibName ? null : (_this$crate$targets$f2 = this.crate.targets.find((t) => t.crate_types.includes("bin"))) === null || _this$crate$targets$f2 === void 0 ? void 0 : _this$crate$targets$f2.name);
	}
	build() {
		validateCrossCompileFlags(this.options);
		if (this.options.useNapiCross) validateNapiCrossSupport(this.target.triple);
		if (this.options.bin) debug$7.warn(`Building Cargo binary target ${this.binName}; the result will be an executable, not a Node.js addon.`);
		else if (!this.cdyLibName) {
			const warning = "Missing `crate-type = [\"cdylib\"]` in [lib] config. The build result will not be available as node addon.";
			if (this.binName) debug$7.warn(warning);
			else throw new Error(warning);
		}
		return this.pickBinary().setPackage().setFeatures().setTarget().pickCrossToolchain().setEnvs().setBypassArgs().exec();
	}
	pickCrossToolchain() {
		if (!this.options.useNapiCross) return this;
		try {
			const { version, download } = require$2("@napi-rs/cross-toolchain");
			const toolchainPath = (0, node_path.join)((0, node_os.homedir)(), ".napi-rs", "cross-toolchain", version, this.target.triple);
			(0, node_fs.mkdirSync)(toolchainPath, { recursive: true });
			if ((0, node_fs.existsSync)((0, node_path.join)(toolchainPath, "package.json"))) debug$7(`Toolchain ${toolchainPath} exists, skip extracting`);
			else download(process.arch, this.target.triple).unpack(toolchainPath);
			Object.assign(this.envs, napiCrossToolchainEnvs(toolchainPath, this.target.triple));
		} catch (e) {
			throw new Error(`Failed to set up the \`--use-napi-cross\` toolchain for ${this.target.triple}: ${e.message}. Check filesystem permissions and network connectivity to the npm registry, then retry, or use \`--cross-compile\` (\`-x\`) / \`--use-cross\` instead.`, { cause: e });
		}
		return this;
	}
	exec() {
		debug$7(`Start building crate: ${this.crate.name}`);
		debug$7("  %i", `cargo ${this.args.join(" ")}`);
		const controller = new AbortController();
		const watch = this.options.watch;
		return {
			task: new Promise((resolve, reject) => {
				var _buildProcess$stderr;
				const cargoOverride = process.env.CARGO;
				if (cargoOverride && (this.options.useCross || this.options.crossCompile)) {
					const expectedBinary = this.options.useCross ? "cross" : "cargo";
					const requestedFlag = this.options.useCross ? "`--use-cross`" : "`--cross-compile` (`-x`)";
					debug$7.warn(`The \`CARGO\` environment variable is set to \`${cargoOverride}\`; it will be spawned instead of the \`${expectedBinary}\` binary that ${requestedFlag} relies on. Unset \`CARGO\` if this is not intended.`);
				}
				const buildProcess = (0, node_child_process.spawn)(cargoOverride ?? (this.options.useCross ? "cross" : "cargo"), this.args, {
					env: {
						...process.env,
						...this.envs
					},
					stdio: watch ? [
						"inherit",
						"inherit",
						"pipe"
					] : "inherit",
					cwd: this.options.cwd,
					signal: controller.signal
				});
				buildProcess.once("exit", (code) => {
					if (code === 0) {
						debug$7("%i", `Build crate ${this.crate.name} successfully!`);
						resolve();
					} else reject(/* @__PURE__ */ new Error(`Build failed with exit code ${code}`));
				});
				buildProcess.once("error", (e) => {
					reject(new Error(`Build failed with error: ${e.message}`, { cause: e }));
				});
				(_buildProcess$stderr = buildProcess.stderr) === null || _buildProcess$stderr === void 0 || _buildProcess$stderr.on("data", (data) => {
					const output = data.toString();
					console.error(output);
					if (/Finished\s(`dev`|`release`)/.test(output)) this.postBuild().catch(() => {});
				});
			}).then(() => this.postBuild()),
			abort: () => controller.abort()
		};
	}
	pickBinary() {
		let set = false;
		if (this.options.watch) if (process.env.CI) debug$7.warn("Watch mode is not supported in CI environment");
		else {
			debug$7("Use %i", "cargo-watch");
			tryInstallCargoBinary("cargo-watch", "watch");
			this.args.push("watch", "--why", "-i", "*.{js,ts,node}", "-w", this.crateDir, "--", "cargo", "build");
			set = true;
		}
		if (this.options.crossCompile) if (this.target.platform === "win32") if (process.platform === "win32") debug$7.warn("You are trying to cross compile to win32 platform on win32 platform which is unnecessary.");
		else {
			debug$7("Use %i", "cargo-xwin");
			tryInstallCargoBinary("cargo-xwin", "xwin");
			this.args.push("xwin", "build");
			if (this.target.arch === "ia32") this.envs.XWIN_ARCH = "x86";
			set = true;
		}
		else {
			debug$7("Use %i", "cargo-zigbuild");
			tryInstallCargoBinary("cargo-zigbuild", "zigbuild");
			this.args.push("zigbuild");
			set = true;
		}
		if (!set) this.args.push("build");
		return this;
	}
	setPackage() {
		const args = [];
		if (this.options.package) args.push("--package", this.options.package);
		if (this.binName) args.push("--bin", this.binName);
		if (args.length) {
			debug$7("Set package flags: ");
			debug$7("  %O", args);
			this.args.push(...args);
		}
		return this;
	}
	setTarget() {
		debug$7("Set compiling target to: ");
		debug$7("  %i", this.target.triple);
		this.args.push("--target", this.target.triple);
		return this;
	}
	setEnvs() {
		var _this$target$abi;
		if (this.enableTypeDef) {
			this.envs.NAPI_TYPE_DEF_TMP_FOLDER = this.generateIntermediateTypeDefFolder();
			this.setForceBuildEnvs(this.envs.NAPI_TYPE_DEF_TMP_FOLDER);
		}
		let rustflags = process.env.RUSTFLAGS ?? process.env.CARGO_BUILD_RUSTFLAGS ?? "";
		if (((_this$target$abi = this.target.abi) === null || _this$target$abi === void 0 ? void 0 : _this$target$abi.includes("musl")) && !rustflags.includes("target-feature=-crt-static")) rustflags += " -C target-feature=-crt-static";
		if (this.options.strip && !rustflags.includes("link-arg=-s")) rustflags += " -C link-arg=-s";
		if (rustflags.length) this.envs.RUSTFLAGS = rustflags;
		const linker = this.options.crossCompile ? void 0 : getTargetLinker(this.target.triple);
		const linkerEnv = `CARGO_TARGET_${targetToEnvVar(this.target.triple)}_LINKER`;
		if (linker && !process.env[linkerEnv] && !this.envs[linkerEnv]) this.envs[linkerEnv] = linker;
		if (this.target.platform === "android") this.setAndroidEnv();
		if (this.target.platform === "wasi") this.setWasiEnv();
		if (this.target.platform === "openharmony") this.setOpenHarmonyEnv();
		debug$7("Set envs: ");
		Object.entries(this.envs).forEach(([k, v]) => {
			debug$7("  %i", `${k}=${v}`);
		});
		return this;
	}
	setForceBuildEnvs(typeDefTmpFolder) {
		getNapiDeriveDependentCrates(this.metadata).forEach((crate) => {
			if (!(0, node_fs.existsSync)((0, node_path.join)(typeDefTmpFolder, crate.name))) this.envs[`NAPI_FORCE_BUILD_${crate.name.replace(/-/g, "_").toUpperCase()}`] = Date.now().toString();
		});
	}
	setAndroidEnv() {
		if (process.platform === "android" || this.options.useCross) return;
		const { ANDROID_NDK_LATEST_HOME } = process.env;
		if (!ANDROID_NDK_LATEST_HOME) throw new Error(`${colorette.red("ANDROID_NDK_LATEST_HOME")} environment variable is required when building an Android target from a non-Android host`);
		const targetArch = this.target.arch === "arm" ? "armv7a" : "aarch64";
		const targetPlatform = this.target.arch === "arm" ? "androideabi24" : "android24";
		const hostPlatform = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
		Object.assign(this.envs, {
			CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER: `${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/${hostPlatform}-x86_64/bin/${targetArch}-linux-android24-clang`,
			CARGO_TARGET_ARMV7_LINUX_ANDROIDEABI_LINKER: `${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/${hostPlatform}-x86_64/bin/${targetArch}-linux-androideabi24-clang`,
			TARGET_CC: `${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/${hostPlatform}-x86_64/bin/${targetArch}-linux-${targetPlatform}-clang`,
			TARGET_CXX: `${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/${hostPlatform}-x86_64/bin/${targetArch}-linux-${targetPlatform}-clang++`,
			TARGET_AR: `${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/${hostPlatform}-x86_64/bin/llvm-ar`,
			TARGET_RANLIB: `${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/${hostPlatform}-x86_64/bin/llvm-ranlib`,
			ANDROID_NDK: ANDROID_NDK_LATEST_HOME,
			PATH: `${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/${hostPlatform}-x86_64/bin${process.platform === "win32" ? ";" : ":"}${process.env.PATH}`
		});
	}
	setWasiEnv() {
		const emnapi = (0, node_path.join)(require$2.resolve("emnapi"), "..", "lib", "wasm32-wasip1-threads");
		this.envs.EMNAPI_LINK_DIR = emnapi;
		const emnapiVersion = require$2("emnapi/package.json").version;
		const projectRequire = (0, node_module.createRequire)((0, node_path.join)(this.options.cwd, "package.json"));
		const emnapiCoreVersion = projectRequire("@emnapi/core").version;
		const emnapiRuntimeVersion = projectRequire("@emnapi/runtime").version;
		if (emnapiVersion !== emnapiCoreVersion || emnapiVersion !== emnapiRuntimeVersion) throw new Error(`emnapi version mismatch: emnapi@${emnapiVersion}, @emnapi/core@${emnapiCoreVersion}, @emnapi/runtime@${emnapiRuntimeVersion}. Please ensure all emnapi packages are the same version.`);
		const { WASI_SDK_PATH } = process.env;
		if (WASI_SDK_PATH && (0, node_fs.existsSync)(WASI_SDK_PATH)) {
			this.envs.CARGO_TARGET_WASM32_WASI_PREVIEW1_THREADS_LINKER = (0, node_path.join)(WASI_SDK_PATH, "bin", "wasm-ld");
			this.envs.CARGO_TARGET_WASM32_WASIP1_LINKER = (0, node_path.join)(WASI_SDK_PATH, "bin", "wasm-ld");
			this.envs.CARGO_TARGET_WASM32_WASIP1_THREADS_LINKER = (0, node_path.join)(WASI_SDK_PATH, "bin", "wasm-ld");
			this.envs.CARGO_TARGET_WASM32_WASIP2_LINKER = (0, node_path.join)(WASI_SDK_PATH, "bin", "wasm-ld");
			this.setEnvIfNotExists("TARGET_CC", (0, node_path.join)(WASI_SDK_PATH, "bin", "clang"));
			this.setEnvIfNotExists("TARGET_CXX", (0, node_path.join)(WASI_SDK_PATH, "bin", "clang++"));
			this.setEnvIfNotExists("TARGET_AR", (0, node_path.join)(WASI_SDK_PATH, "bin", "ar"));
			this.setEnvIfNotExists("TARGET_RANLIB", (0, node_path.join)(WASI_SDK_PATH, "bin", "ranlib"));
			this.setEnvIfNotExists("TARGET_CFLAGS", `--target=wasm32-wasip1-threads --sysroot=${WASI_SDK_PATH}/share/wasi-sysroot -pthread -mllvm -wasm-enable-sjlj`);
			this.setEnvIfNotExists("TARGET_CXXFLAGS", `--target=wasm32-wasip1-threads --sysroot=${WASI_SDK_PATH}/share/wasi-sysroot -pthread -mllvm -wasm-enable-sjlj`);
			this.setEnvIfNotExists(`TARGET_LDFLAGS`, `-fuse-ld=${WASI_SDK_PATH}/bin/wasm-ld --target=wasm32-wasip1-threads`);
		}
	}
	setOpenHarmonyEnv() {
		const { OHOS_SDK_PATH, OHOS_SDK_NATIVE } = process.env;
		const ndkPath = OHOS_SDK_PATH ? `${OHOS_SDK_PATH}/native` : OHOS_SDK_NATIVE;
		if (!ndkPath && process.platform !== "openharmony") {
			debug$7.warn(`${colorette.red("OHOS_SDK_PATH")} or ${colorette.red("OHOS_SDK_NATIVE")} environment variable is missing`);
			return;
		}
		const linkerName = `CARGO_TARGET_${this.target.triple.toUpperCase().replace(/-/g, "_")}_LINKER`;
		const ranPath = `${ndkPath}/llvm/bin/llvm-ranlib`;
		const arPath = `${ndkPath}/llvm/bin/llvm-ar`;
		const ccPath = `${ndkPath}/llvm/bin/${this.target.triple}-clang`;
		const cxxPath = `${ndkPath}/llvm/bin/${this.target.triple}-clang++`;
		const asPath = `${ndkPath}/llvm/bin/llvm-as`;
		const ldPath = `${ndkPath}/llvm/bin/ld.lld`;
		const stripPath = `${ndkPath}/llvm/bin/llvm-strip`;
		const objDumpPath = `${ndkPath}/llvm/bin/llvm-objdump`;
		const objCopyPath = `${ndkPath}/llvm/bin/llvm-objcopy`;
		const nmPath = `${ndkPath}/llvm/bin/llvm-nm`;
		const binPath = `${ndkPath}/llvm/bin`;
		const libPath = `${ndkPath}/llvm/lib`;
		this.setEnvIfNotExists("LIBCLANG_PATH", libPath);
		this.setEnvIfNotExists("DEP_ATOMIC", "clang_rt.builtins");
		this.setEnvIfNotExists(linkerName, ccPath);
		this.setEnvIfNotExists("TARGET_CC", ccPath);
		this.setEnvIfNotExists("TARGET_CXX", cxxPath);
		this.setEnvIfNotExists("TARGET_AR", arPath);
		this.setEnvIfNotExists("TARGET_RANLIB", ranPath);
		this.setEnvIfNotExists("TARGET_AS", asPath);
		this.setEnvIfNotExists("TARGET_LD", ldPath);
		this.setEnvIfNotExists("TARGET_STRIP", stripPath);
		this.setEnvIfNotExists("TARGET_OBJDUMP", objDumpPath);
		this.setEnvIfNotExists("TARGET_OBJCOPY", objCopyPath);
		this.setEnvIfNotExists("TARGET_NM", nmPath);
		this.envs.PATH = `${binPath}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}`;
	}
	setFeatures() {
		const args = [];
		if (this.options.allFeatures && this.options.noDefaultFeatures) throw new Error("Cannot specify --all-features and --no-default-features together");
		if (this.options.allFeatures) args.push("--all-features");
		else if (this.options.noDefaultFeatures) args.push("--no-default-features");
		if (this.options.features) args.push("--features", ...this.options.features);
		debug$7("Set features flags: ");
		debug$7("  %O", args);
		this.args.push(...args);
		return this;
	}
	setBypassArgs() {
		var _this$options$cargoOp;
		if (this.options.release) this.args.push("--release");
		if (this.options.verbose) this.args.push("--verbose");
		if (this.options.targetDir) this.args.push("--target-dir", this.options.targetDir);
		if (this.options.profile) this.args.push("--profile", this.options.profile);
		if (this.options.manifestPath) this.args.push("--manifest-path", this.options.manifestPath);
		if ((_this$options$cargoOp = this.options.cargoOptions) === null || _this$options$cargoOp === void 0 ? void 0 : _this$options$cargoOp.length) this.args.push(...this.options.cargoOptions);
		return this;
	}
	generateIntermediateTypeDefFolder() {
		let folder = (0, node_path.join)(this.targetDir, "napi-rs", `${this.crate.name}-${(0, node_crypto.createHash)("sha256").update(this.crate.manifest_path).update(CLI_VERSION).digest("hex").substring(0, 8)}`);
		if (!this.options.dtsCache) {
			(0, node_fs.rmSync)(folder, {
				recursive: true,
				force: true
			});
			folder += `_${Date.now()}`;
		}
		mkdirAsync(folder, { recursive: true });
		return folder;
	}
	async postBuild() {
		try {
			debug$7(`Try to create output directory:`);
			debug$7("  %i", this.outputDir);
			await mkdirAsync(this.outputDir, { recursive: true });
			debug$7(`Output directory created`);
		} catch (e) {
			throw new Error(`Failed to create output directory ${this.outputDir}`, { cause: e });
		}
		const wasmBinaryName = await this.copyArtifact();
		if (this.cdyLibName) {
			const idents = await this.generateTypeDef();
			const jsOutput = await this.writeJsBinding(idents);
			const wasmBindingsOutput = await this.writeWasiBinding(wasmBinaryName, idents);
			if (jsOutput) this.outputs.push(jsOutput);
			if (wasmBindingsOutput) this.outputs.push(...wasmBindingsOutput);
		}
		return this.outputs;
	}
	async copyArtifact() {
		const [srcName, destName, wasmBinaryName] = this.getArtifactNames();
		if (!srcName || !destName) return;
		const profile = this.options.profile ?? (this.options.release ? "release" : "debug");
		const src = (0, node_path.join)(this.targetDir, this.target.triple, profile, srcName);
		debug$7(`Copy artifact from: [${src}]`);
		const dest = (0, node_path.join)(this.outputDir, destName);
		const isWasm = dest.endsWith(".wasm");
		try {
			if (await fileExists(dest)) {
				debug$7("Old artifact found, remove it first");
				await unlinkAsync(dest);
			}
			debug$7("Copy artifact to:");
			debug$7("  %i", dest);
			if (isWasm) {
				const { ModuleConfig } = await import("@napi-rs/wasm-tools");
				debug$7("Generate debug wasm module");
				try {
					const debugWasmBinary = new ModuleConfig().generateDwarf(true).generateNameSection(true).generateProducersSection(true).preserveCodeTransform(true).strictValidate(false).parse(await readFileAsync(src)).emitWasm(true);
					await writeFileAsync(dest.replace(/\.wasm$/, ".debug.wasm"), debugWasmBinary);
					debug$7("Generate release wasm module");
					await writeFileAsync(dest, new ModuleConfig().generateDwarf(false).generateNameSection(false).generateProducersSection(false).preserveCodeTransform(false).strictValidate(false).onlyStableFeatures(false).parse(debugWasmBinary).emitWasm(false));
				} catch (e) {
					debug$7.warn(`Failed to generate debug wasm module: ${e.message ?? e}`);
					await copyFileAsync(src, dest);
				}
			} else await copyFileAsync(src, dest);
			this.outputs.push({
				kind: dest.endsWith(".node") ? "node" : isWasm ? "wasm" : "exe",
				path: dest
			});
			return wasmBinaryName ? (0, node_path.join)(this.outputDir, wasmBinaryName) : null;
		} catch (e) {
			throw new Error("Failed to copy artifact", { cause: e });
		}
	}
	getArtifactNames() {
		if (this.cdyLibName) {
			const cdyLib = this.cdyLibName.replace(/-/g, "_");
			const wasiTarget = this.config.targets.find((t) => t.platform === "wasi");
			const srcName = this.target.platform === "darwin" ? `lib${cdyLib}.dylib` : this.target.platform === "win32" ? `${cdyLib}.dll` : this.target.platform === "wasi" || this.target.platform === "wasm" ? `${cdyLib}.wasm` : `lib${cdyLib}.so`;
			let destName = this.config.binaryName;
			if (this.options.platform) destName += `.${this.target.platformArchABI}`;
			if (srcName.endsWith(".wasm")) destName += ".wasm";
			else destName += ".node";
			return [
				srcName,
				destName,
				wasiTarget ? `${this.config.binaryName}.${wasiTarget.platformArchABI}.wasm` : null
			];
		} else if (this.binName) {
			const srcName = this.target.platform === "win32" ? `${this.binName}.exe` : this.binName;
			return [srcName, srcName];
		}
		return [];
	}
	async generateTypeDef() {
		const typeDefDir = this.envs.NAPI_TYPE_DEF_TMP_FOLDER;
		if (!this.enableTypeDef) return [];
		const { exports, dts } = await generateTypeDef({
			typeDefDir,
			noDtsHeader: this.options.noDtsHeader,
			dtsHeader: this.options.dtsHeader,
			configDtsHeader: this.config.dtsHeader,
			configDtsHeaderFile: this.config.dtsHeaderFile,
			constEnum: this.options.constEnum ?? this.config.constEnum,
			runtimeStringEnum: this.options.runtimeStringEnum ?? this.config.runtimeStringEnum,
			cwd: this.options.cwd
		});
		const dest = (0, node_path.join)(this.outputDir, this.options.dts ?? "index.d.ts");
		try {
			debug$7("Writing type def to:");
			debug$7("  %i", dest);
			await writeFileAsync(dest, dts, "utf-8");
		} catch (e) {
			debug$7.error("Failed to write type def file");
			debug$7.error(e);
		}
		if (exports.length > 0) {
			const dest = (0, node_path.join)(this.outputDir, this.options.dts ?? "index.d.ts");
			this.outputs.push({
				kind: "dts",
				path: dest
			});
		}
		return exports;
	}
	async writeJsBinding(idents) {
		return writeJsBinding({
			platform: this.options.platform,
			noJsBinding: this.options.noJsBinding,
			idents,
			jsBinding: this.options.jsBinding,
			esm: this.options.esm,
			binaryName: this.config.binaryName,
			packageName: this.options.jsPackageName ?? this.config.packageName,
			version: process.env.npm_new_version ?? this.config.packageJson.version,
			outputDir: this.outputDir
		});
	}
	async writeWasiBinding(distFileName, idents) {
		if (distFileName) {
			var _this$config$wasm, _this$config$wasm2, _this$config$wasm3, _this$config$wasm4, _this$config$wasm5, _this$config$wasm6, _this$config$wasm7, _this$config$wasm8, _this$config$wasm9, _this$config$wasm10;
			const { name, dir } = (0, node_path.parse)(distFileName);
			const bindingPath = (0, node_path.join)(dir, `${this.config.binaryName}.wasi.cjs`);
			const browserBindingPath = (0, node_path.join)(dir, `${this.config.binaryName}.wasi-browser.js`);
			const workerPath = (0, node_path.join)(dir, "wasi-worker.mjs");
			const browserWorkerPath = (0, node_path.join)(dir, "wasi-worker-browser.mjs");
			const browserEntryPath = (0, node_path.join)(dir, "browser.js");
			const exportsCode = `module.exports = __napiModule.exports\n` + idents.map((ident) => `module.exports.${ident} = __napiModule.exports.${ident}`).join("\n");
			await writeFileAsync(bindingPath, createWasiBinding(name, this.config.packageName, (_this$config$wasm = this.config.wasm) === null || _this$config$wasm === void 0 ? void 0 : _this$config$wasm.initialMemory, (_this$config$wasm2 = this.config.wasm) === null || _this$config$wasm2 === void 0 ? void 0 : _this$config$wasm2.maximumMemory) + exportsCode + "\n", "utf8");
			await writeFileAsync(browserBindingPath, createWasiBrowserBinding(name, (_this$config$wasm3 = this.config.wasm) === null || _this$config$wasm3 === void 0 ? void 0 : _this$config$wasm3.initialMemory, (_this$config$wasm4 = this.config.wasm) === null || _this$config$wasm4 === void 0 ? void 0 : _this$config$wasm4.maximumMemory, (_this$config$wasm5 = this.config.wasm) === null || _this$config$wasm5 === void 0 || (_this$config$wasm5 = _this$config$wasm5.browser) === null || _this$config$wasm5 === void 0 ? void 0 : _this$config$wasm5.fs, (_this$config$wasm6 = this.config.wasm) === null || _this$config$wasm6 === void 0 || (_this$config$wasm6 = _this$config$wasm6.browser) === null || _this$config$wasm6 === void 0 ? void 0 : _this$config$wasm6.asyncInit, (_this$config$wasm7 = this.config.wasm) === null || _this$config$wasm7 === void 0 || (_this$config$wasm7 = _this$config$wasm7.browser) === null || _this$config$wasm7 === void 0 ? void 0 : _this$config$wasm7.buffer, (_this$config$wasm8 = this.config.wasm) === null || _this$config$wasm8 === void 0 || (_this$config$wasm8 = _this$config$wasm8.browser) === null || _this$config$wasm8 === void 0 ? void 0 : _this$config$wasm8.errorEvent) + `export default __napiModule.exports\n` + idents.map((ident) => `export const ${ident} = __napiModule.exports.${ident}`).join("\n") + "\n", "utf8");
			await writeFileAsync(workerPath, WASI_WORKER_TEMPLATE, "utf8");
			await writeFileAsync(browserWorkerPath, createWasiBrowserWorkerBinding(((_this$config$wasm9 = this.config.wasm) === null || _this$config$wasm9 === void 0 || (_this$config$wasm9 = _this$config$wasm9.browser) === null || _this$config$wasm9 === void 0 ? void 0 : _this$config$wasm9.fs) ?? false, ((_this$config$wasm10 = this.config.wasm) === null || _this$config$wasm10 === void 0 || (_this$config$wasm10 = _this$config$wasm10.browser) === null || _this$config$wasm10 === void 0 ? void 0 : _this$config$wasm10.errorEvent) ?? false), "utf8");
			await writeFileAsync(browserEntryPath, `export * from '${this.config.packageName}-wasm32-wasi'\n`);
			return [
				{
					kind: "js",
					path: bindingPath
				},
				{
					kind: "js",
					path: browserBindingPath
				},
				{
					kind: "js",
					path: workerPath
				},
				{
					kind: "js",
					path: browserWorkerPath
				},
				{
					kind: "js",
					path: browserEntryPath
				}
			];
		}
		return [];
	}
	setEnvIfNotExists(env, value) {
		if (!process.env[env]) this.envs[env] = value;
	}
};
async function writeJsBinding(options) {
	if (!options.platform || options.noJsBinding || options.idents.length === 0) return;
	const name = options.jsBinding ?? "index.js";
	const binding = (options.esm ? createEsmBinding : createCjsBinding)(options.binaryName, options.packageName, options.idents, options.version);
	try {
		const dest = (0, node_path.join)(options.outputDir, name);
		debug$7("Writing js binding to:");
		debug$7("  %i", dest);
		await writeFileAsync(dest, binding, "utf-8");
		return {
			kind: "js",
			path: dest
		};
	} catch (e) {
		throw new Error("Failed to write js binding file", { cause: e });
	}
}
/**
* Walk the napi-derive intermediate type-def directory, render every entry
* into TypeScript via {@link processTypeDef}, and return the concatenated
* `.d.ts` source plus the list of identifiers to re-export from
* `index.js`.
*/
async function generateTypeDef(options) {
	if (!await dirExistsAsync(options.typeDefDir)) return {
		exports: [],
		dts: ""
	};
	let header = "";
	let dts = "";
	let exports = [];
	if (!options.noDtsHeader) {
		const dtsHeader = options.dtsHeader ?? options.configDtsHeader;
		const dtsHeaderFile = options.dtsHeaderFile ?? options.configDtsHeaderFile;
		if (dtsHeaderFile) try {
			header = await readFileAsync((0, node_path.join)(options.cwd, dtsHeaderFile), "utf-8");
		} catch (e) {
			debug$7.warn(`Failed to read dts header file ${dtsHeaderFile}`, e);
		}
		else if (dtsHeader) header = dtsHeader;
		else header = DEFAULT_TYPE_DEF_HEADER;
	}
	const files = await readdirAsync(options.typeDefDir, { withFileTypes: true });
	if (!files.length) {
		debug$7("No type def files found. Skip generating dts file.");
		return {
			exports: [],
			dts: ""
		};
	}
	const typeDefFiles = files.filter((file) => file.isFile()).sort((a, b) => a.name.localeCompare(b.name));
	const constEnum = options.constEnum ?? true;
	const runtimeStringEnum = options.runtimeStringEnum ?? false;
	if (runtimeStringEnum && constEnum) debug$7.warn("`--runtime-string-enum` has no effect when `--const-enum` is enabled (the default). Pass `--no-const-enum` to activate runtime string enum emission.");
	const processedTypeDefs = await Promise.all(typeDefFiles.map((file) => processTypeDef((0, node_path.join)(options.typeDefDir, file.name), constEnum, runtimeStringEnum)));
	dts = processedTypeDefs.map(({ dts }) => dts).join("");
	exports = processedTypeDefs.flatMap(({ exports }) => exports);
	if (dts.indexOf("ExternalObject<") > -1) header += `
export declare class ExternalObject<T> {
  readonly '': {
    readonly '': unique symbol
    [K: symbol]: T
  }
}
`;
	if (dts.indexOf("TypedArray") > -1) header += `
export type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array
`;
	dts = header + dts;
	return {
		exports,
		dts
	};
}
//#endregion
//#region src/def/create-npm-dirs.ts
var BaseCreateNpmDirsCommand = class extends clipanion.Command {
	static paths = [["create-npm-dirs"]];
	static usage = clipanion.Command.Usage({ description: "Create npm package dirs for different platforms" });
	cwd = clipanion.Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = clipanion.Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = clipanion.Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	npmDir = clipanion.Option.String("--npm-dir", "npm", { description: "Path to the folder where the npm packages put" });
	dryRun = clipanion.Option.Boolean("--dry-run", false, { description: "Dry run without touching file system" });
	getOptions() {
		return {
			cwd: this.cwd,
			configPath: this.configPath,
			packageJsonPath: this.packageJsonPath,
			npmDir: this.npmDir,
			dryRun: this.dryRun
		};
	}
};
function applyDefaultCreateNpmDirsOptions(options) {
	return {
		cwd: process.cwd(),
		packageJsonPath: "package.json",
		npmDir: "npm",
		dryRun: false,
		...options
	};
}
//#endregion
//#region src/api/create-npm-dirs.ts
const require$1 = (0, node_module.createRequire)(require("url").pathToFileURL(__filename).href);
const minimumWasiNodeVersion = ">=14.0.0";
const debug$6 = debugFactory("create-npm-dirs");
const WASM_RUNTIME_PACKAGE_NAME = "@napi-rs/wasm-runtime";
async function getLatestWasmRuntimeVersion() {
	var _process$env$npm_conf, _packageMeta$distTag;
	const packageMetadataUrl = `${((_process$env$npm_conf = process.env.npm_config_registry) === null || _process$env$npm_conf === void 0 ? void 0 : _process$env$npm_conf.replace(/\/?$/, "/")) ?? "https://registry.npmjs.org/"}${WASM_RUNTIME_PACKAGE_NAME}`;
	let response;
	try {
		response = await fetch(packageMetadataUrl);
	} catch (error) {
		throw new Error(`Failed to fetch ${packageMetadataUrl} while resolving ${WASM_RUNTIME_PACKAGE_NAME}. Check your network connection and npm registry availability.`, { cause: error });
	}
	if (!response.ok) throw new Error(`Failed to fetch ${packageMetadataUrl} while resolving ${WASM_RUNTIME_PACKAGE_NAME}: npm registry responded with ${response.status} ${response.statusText || "Unknown Status"}`);
	let packageMeta;
	try {
		packageMeta = await response.json();
	} catch (error) {
		throw new Error(`Failed to parse npm registry metadata for ${WASM_RUNTIME_PACKAGE_NAME} from ${packageMetadataUrl}`, { cause: error });
	}
	const latestVersion = (_packageMeta$distTag = packageMeta["dist-tags"]) === null || _packageMeta$distTag === void 0 ? void 0 : _packageMeta$distTag.latest;
	if (typeof latestVersion !== "string" || latestVersion.trim().length === 0) throw new Error(`npm registry metadata for ${WASM_RUNTIME_PACKAGE_NAME} from ${packageMetadataUrl} did not include a latest dist-tag`);
	return latestVersion.trim();
}
async function createNpmDirs(userOptions) {
	const options = applyDefaultCreateNpmDirsOptions(userOptions);
	async function mkdirAsync$1(dir) {
		debug$6("Try to create dir: %i", dir);
		if (options.dryRun) return;
		await mkdirAsync(dir, { recursive: true });
	}
	async function writeFileAsync$1(file, content) {
		debug$6("Writing file %i", file);
		if (options.dryRun) {
			debug$6(content);
			return;
		}
		await writeFileAsync(file, content);
	}
	const packageJsonPath = (0, node_path.resolve)(options.cwd, options.packageJsonPath);
	const npmPath = (0, node_path.resolve)(options.cwd, options.npmDir);
	debug$6(`Read content from [${options.configPath ?? packageJsonPath}]`);
	const { targets, binaryName, packageName, packageJson } = await readNapiConfig(packageJsonPath, options.configPath ? (0, node_path.resolve)(options.cwd, options.configPath) : void 0);
	const wasmRuntimeVersion = targets.some((target) => target.arch === "wasm32") ? await getLatestWasmRuntimeVersion() : void 0;
	for (const target of targets) {
		const targetDir = (0, node_path.join)(npmPath, `${target.platformArchABI}`);
		await mkdirAsync$1(targetDir);
		const binaryFileName = target.arch === "wasm32" ? `${binaryName}.${target.platformArchABI}.wasm` : `${binaryName}.${target.platformArchABI}.node`;
		const scopedPackageJson = {
			name: `${packageName}-${target.platformArchABI}`,
			version: packageJson.version,
			cpu: target.arch !== "universal" ? [target.arch] : void 0,
			main: binaryFileName,
			files: [binaryFileName],
			...pick$1(packageJson, "description", "keywords", "author", "authors", "homepage", "license", "engines", "repository", "bugs")
		};
		if (packageJson.publishConfig) scopedPackageJson.publishConfig = pick$1(packageJson.publishConfig, "registry", "access");
		if (target.arch !== "wasm32") scopedPackageJson.os = [target.platform];
		else {
			var _scopedPackageJson$fi, _scopedPackageJson$en;
			const entry = `${binaryName}.wasi.cjs`;
			scopedPackageJson.main = entry;
			scopedPackageJson.browser = `${binaryName}.wasi-browser.js`;
			(_scopedPackageJson$fi = scopedPackageJson.files) === null || _scopedPackageJson$fi === void 0 || _scopedPackageJson$fi.push(entry, scopedPackageJson.browser, `wasi-worker.mjs`, `wasi-worker-browser.mjs`);
			scopedPackageJson.engines = {
				...scopedPackageJson.engines,
				node: ((_scopedPackageJson$en = scopedPackageJson.engines) === null || _scopedPackageJson$en === void 0 ? void 0 : _scopedPackageJson$en.node) ? restrictWasiNodeEngine(scopedPackageJson.engines.node) : minimumWasiNodeVersion
			};
			const emnapiVersion = require$1("emnapi/package.json").version;
			scopedPackageJson.dependencies = {
				"@napi-rs/wasm-runtime": `^${wasmRuntimeVersion}`,
				"@emnapi/core": emnapiVersion,
				"@emnapi/runtime": emnapiVersion
			};
		}
		if (target.abi === "gnu") scopedPackageJson.libc = ["glibc"];
		else if (target.abi === "musl") scopedPackageJson.libc = ["musl"];
		await writeFileAsync$1((0, node_path.join)(targetDir, "package.json"), JSON.stringify(scopedPackageJson, null, 2) + "\n");
		await writeFileAsync$1((0, node_path.join)(targetDir, "README.md"), readme(packageName, target));
		debug$6.info(`${packageName} -${target.platformArchABI} created`);
	}
}
function readme(packageName, target) {
	return `# \`${packageName}-${target.platformArchABI}\`

This is the **${target.triple}** binary for \`${packageName}\`
`;
}
function restrictWasiNodeEngine(nodeRange) {
	try {
		if ((0, semver.subset)(nodeRange, minimumWasiNodeVersion)) return nodeRange;
		if ((0, semver.subset)(minimumWasiNodeVersion, nodeRange)) return minimumWasiNodeVersion;
		const minimumComparator = new semver.Comparator(minimumWasiNodeVersion);
		const restrictedRangeSets = new semver.Range(nodeRange).set.map((comparators) => normalizeComparatorSet([...comparators, minimumComparator])).filter((candidate) => candidate !== void 0 && (0, semver.minVersion)(candidate) !== null);
		if (restrictedRangeSets.length > 0) return restrictedRangeSets.join(" || ");
	} catch {}
	return minimumWasiNodeVersion;
}
function normalizeComparatorSet(comparators) {
	const exactMatch = comparators.find(({ operator }) => operator === "");
	if (exactMatch) return comparators.every((comparator) => comparator.test(exactMatch.semver)) ? exactMatch.value : void 0;
	let lowerBound;
	let upperBound;
	for (const comparator of comparators) if (comparator.operator === ">" || comparator.operator === ">=") {
		if (!lowerBound || comparator.semver.compare(lowerBound.semver) > 0 || comparator.semver.compare(lowerBound.semver) === 0 && comparator.operator === ">") lowerBound = comparator;
	} else if (comparator.operator === "<" || comparator.operator === "<=") {
		if (!upperBound || comparator.semver.compare(upperBound.semver) < 0 || comparator.semver.compare(upperBound.semver) === 0 && comparator.operator === "<") upperBound = comparator;
	}
	return [lowerBound === null || lowerBound === void 0 ? void 0 : lowerBound.value, upperBound === null || upperBound === void 0 ? void 0 : upperBound.value].filter(Boolean).join(" ");
}
//#endregion
//#region ../node_modules/@std/toml/stringify.js
function joinKeys(keys) {
	return keys.map((str) => {
		return str.length === 0 || str.match(/[^A-Za-z0-9_-]/) ? JSON.stringify(str) : str;
	}).join(".");
}
var Dumper = class {
	maxPad = 0;
	srcObject;
	output = [];
	#arrayTypeCache = /* @__PURE__ */ new Map();
	constructor(srcObjc) {
		this.srcObject = srcObjc;
	}
	dump(fmtOptions = {}) {
		this.output = this.#printObject(this.srcObject);
		this.output = this.#format(fmtOptions);
		return this.output;
	}
	#printObject(obj, keys = []) {
		const out = [];
		const props = Object.keys(obj);
		const inlineProps = [];
		const multilineProps = [];
		for (const prop of props) if (this.#isSimplySerializable(obj[prop])) inlineProps.push(prop);
		else multilineProps.push(prop);
		const sortedProps = inlineProps.concat(multilineProps);
		for (const prop of sortedProps) {
			const value = obj[prop];
			if (value instanceof Date) out.push(this.#dateDeclaration([prop], value));
			else if (typeof value === "string" || value instanceof RegExp) out.push(this.#strDeclaration([prop], value.toString()));
			else if (typeof value === "number") out.push(this.#numberDeclaration([prop], value));
			else if (typeof value === "boolean") out.push(this.#boolDeclaration([prop], value));
			else if (value instanceof Array) {
				const arrayType = this.#getTypeOfArray(value);
				if (arrayType === "ONLY_PRIMITIVE") out.push(this.#arrayDeclaration([prop], value));
				else if (arrayType === "ONLY_OBJECT_EXCLUDING_ARRAY") for (let i = 0; i < value.length; i++) {
					out.push("");
					out.push(this.#headerGroup([...keys, prop]));
					out.push(...this.#printObject(value[i], [...keys, prop]));
				}
				else {
					const str = value.map((x) => this.#printAsInlineValue(x)).join(",");
					out.push(`${this.#declaration([prop])}[${str}]`);
				}
			} else if (typeof value === "object") {
				out.push("");
				out.push(this.#header([...keys, prop]));
				if (value) {
					const toParse = value;
					out.push(...this.#printObject(toParse, [...keys, prop]));
				}
			}
		}
		out.push("");
		return out;
	}
	#isPrimitive(value) {
		return value instanceof Date || value instanceof RegExp || [
			"string",
			"number",
			"boolean"
		].includes(typeof value);
	}
	#getTypeOfArray(arr) {
		if (this.#arrayTypeCache.has(arr)) return this.#arrayTypeCache.get(arr);
		const type = this.#doGetTypeOfArray(arr);
		this.#arrayTypeCache.set(arr, type);
		return type;
	}
	#doGetTypeOfArray(arr) {
		if (!arr.length) return "ONLY_PRIMITIVE";
		const onlyPrimitive = this.#isPrimitive(arr[0]);
		if (arr[0] instanceof Array) return "MIXED";
		for (let i = 1; i < arr.length; i++) if (onlyPrimitive !== this.#isPrimitive(arr[i]) || arr[i] instanceof Array) return "MIXED";
		return onlyPrimitive ? "ONLY_PRIMITIVE" : "ONLY_OBJECT_EXCLUDING_ARRAY";
	}
	#printAsInlineValue(value) {
		if (value instanceof Date) return `"${this.#printDate(value)}"`;
		else if (typeof value === "string" || value instanceof RegExp) return JSON.stringify(value.toString());
		else if (typeof value === "number") return value;
		else if (typeof value === "boolean") return value.toString();
		else if (value instanceof Array) return `[${value.map((x) => this.#printAsInlineValue(x)).join(",")}]`;
		else if (typeof value === "object") {
			if (!value) throw new Error("Should never reach");
			return `{${Object.keys(value).map((key) => {
				return `${joinKeys([key])} = ${this.#printAsInlineValue(value[key])}`;
			}).join(",")}}`;
		}
		throw new Error("Should never reach");
	}
	#isSimplySerializable(value) {
		return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof RegExp || value instanceof Date || value instanceof Array && this.#getTypeOfArray(value) !== "ONLY_OBJECT_EXCLUDING_ARRAY";
	}
	#header(keys) {
		return `[${joinKeys(keys)}]`;
	}
	#headerGroup(keys) {
		return `[[${joinKeys(keys)}]]`;
	}
	#declaration(keys) {
		const title = joinKeys(keys);
		if (title.length > this.maxPad) this.maxPad = title.length;
		return `${title} = `;
	}
	#arrayDeclaration(keys, value) {
		return `${this.#declaration(keys)}${JSON.stringify(value)}`;
	}
	#strDeclaration(keys, value) {
		return `${this.#declaration(keys)}${JSON.stringify(value)}`;
	}
	#numberDeclaration(keys, value) {
		if (Number.isNaN(value)) return `${this.#declaration(keys)}nan`;
		switch (value) {
			case Infinity: return `${this.#declaration(keys)}inf`;
			case -Infinity: return `${this.#declaration(keys)}-inf`;
			default: return `${this.#declaration(keys)}${value}`;
		}
	}
	#boolDeclaration(keys, value) {
		return `${this.#declaration(keys)}${value}`;
	}
	#printDate(value) {
		function dtPad(v, lPad = 2) {
			return v.padStart(lPad, "0");
		}
		const m = dtPad((value.getUTCMonth() + 1).toString());
		const d = dtPad(value.getUTCDate().toString());
		const h = dtPad(value.getUTCHours().toString());
		const min = dtPad(value.getUTCMinutes().toString());
		const s = dtPad(value.getUTCSeconds().toString());
		const ms = dtPad(value.getUTCMilliseconds().toString(), 3);
		return `${value.getUTCFullYear()}-${m}-${d}T${h}:${min}:${s}.${ms}`;
	}
	#dateDeclaration(keys, value) {
		return `${this.#declaration(keys)}${this.#printDate(value)}`;
	}
	#format(options = {}) {
		const { keyAlignment = false } = options;
		const rDeclaration = /^(\".*\"|[^=]*)\s=/;
		const out = [];
		for (let i = 0; i < this.output.length; i++) {
			const l = this.output[i];
			if (l[0] === "[" && l[1] !== "[") {
				var _this$output;
				if (this.output[i + 1] === "" && ((_this$output = this.output[i + 2]) === null || _this$output === void 0 ? void 0 : _this$output.slice(0, l.length)) === l.slice(0, -1) + ".") {
					i += 1;
					continue;
				}
				out.push(l);
			} else if (keyAlignment) {
				const m = rDeclaration.exec(l);
				if (m && m[1]) out.push(l.replace(m[1], m[1].padEnd(this.maxPad)));
				else out.push(l);
			} else out.push(l);
		}
		const cleanedOutput = [];
		for (let i = 0; i < out.length; i++) {
			const l = out[i];
			if (!(l === "" && out[i + 1] === "")) cleanedOutput.push(l);
		}
		return cleanedOutput;
	}
};
/**
* Converts an object to a {@link https://toml.io | TOML} string.
*
* @example Usage
* ```ts
* import { stringify } from "@std/toml/stringify";
* import { assertEquals } from "@std/assert";
*
* const obj = {
*   title: "TOML Example",
*   owner: {
*     name: "Bob",
*     bio: "Bob is a cool guy",
*  }
* };
* const tomlString = stringify(obj);
* assertEquals(tomlString, `title = "TOML Example"\n\n[owner]\nname = "Bob"\nbio = "Bob is a cool guy"\n`);
* ```
* @param obj Source object
* @param options Options for stringifying.
* @returns TOML string
*/ function stringify(obj, options) {
	return new Dumper(obj).dump(options).join("\n");
}
//#endregion
//#region ../node_modules/@jsr/std__collections/deep_merge.js
/** Default merging options - cached to avoid object allocation on each call */ const DEFAULT_OPTIONS = {
	arrays: "merge",
	sets: "merge",
	maps: "merge"
};
function deepMerge(record, other, options) {
	return deepMergeInternal(record, other, /* @__PURE__ */ new Set(), options ?? DEFAULT_OPTIONS);
}
function deepMergeInternal(record, other, seen, options) {
	const result = {};
	const keys = /* @__PURE__ */ new Set([...getKeys(record), ...getKeys(other)]);
	for (const key of keys) {
		if (key === "__proto__") continue;
		const a = record[key];
		if (!Object.hasOwn(other, key)) {
			result[key] = a;
			continue;
		}
		const b = other[key];
		if (isNonNullObject(a) && isNonNullObject(b) && !seen.has(a) && !seen.has(b)) {
			seen.add(a);
			seen.add(b);
			result[key] = mergeObjects(a, b, seen, options);
			continue;
		}
		result[key] = b;
	}
	return result;
}
function mergeObjects(left, right, seen, options) {
	if (isMergeable(left) && isMergeable(right)) return deepMergeInternal(left, right, seen, options);
	if (isIterable(left) && isIterable(right)) {
		if (Array.isArray(left) && Array.isArray(right)) {
			if (options.arrays === "merge") return left.concat(right);
			return right;
		}
		if (left instanceof Map && right instanceof Map) {
			if (options.maps === "merge") {
				const result = new Map(left);
				for (const [k, v] of right) result.set(k, v);
				return result;
			}
			return right;
		}
		if (left instanceof Set && right instanceof Set) {
			if (options.sets === "merge") {
				const result = new Set(left);
				for (const v of right) result.add(v);
				return result;
			}
			return right;
		}
	}
	return right;
}
/**
* Test whether a value is mergeable or not
* Builtins that look like objects, null and user defined classes
* are not considered mergeable (it means that reference will be copied)
*/ function isMergeable(value) {
	return Object.getPrototypeOf(value) === Object.prototype;
}
function isIterable(value) {
	return typeof value[Symbol.iterator] === "function";
}
function isNonNullObject(value) {
	return value !== null && typeof value === "object";
}
function getKeys(record) {
	const keys = Object.keys(record);
	const symbols = Object.getOwnPropertySymbols(record);
	if (symbols.length === 0) return keys;
	for (const sym of symbols) if (Object.prototype.propertyIsEnumerable.call(record, sym)) keys.push(sym);
	return keys;
}
//#endregion
//#region ../node_modules/@std/toml/_parser.js
/**
* Copy of `import { isLeap } from "@std/datetime";` because it cannot be impoted as long as it is unstable.
*/ function isLeap(yearNumber) {
	return yearNumber % 4 === 0 && yearNumber % 100 !== 0 || yearNumber % 400 === 0;
}
var Scanner = class {
	#whitespace = /[ \t]/;
	#position = 0;
	#source;
	constructor(source) {
		this.#source = source;
	}
	get position() {
		return this.#position;
	}
	get source() {
		return this.#source;
	}
	/**
	* Get current character
	* @param index - relative index from current position
	*/ char(index = 0) {
		return this.#source[this.#position + index] ?? "";
	}
	/**
	* Get sliced string
	* @param start - start position relative from current position
	* @param end - end position relative from current position
	*/ slice(start, end) {
		return this.#source.slice(this.#position + start, this.#position + end);
	}
	/**
	* Move position to next
	*/ next(count = 1) {
		this.#position += count;
	}
	skipWhitespaces() {
		while (this.#whitespace.test(this.char()) && !this.eof()) this.next();
		if (!this.isCurrentCharEOL() && /\s/.test(this.char())) {
			const escaped = "\\u" + this.char().charCodeAt(0).toString(16);
			const position = this.#position;
			throw new SyntaxError(`Cannot parse the TOML: It contains invalid whitespace at position '${position}': \`${escaped}\``);
		}
	}
	nextUntilChar(options = { skipComments: true }) {
		while (!this.eof()) {
			const char = this.char();
			if (this.#whitespace.test(char) || this.isCurrentCharEOL()) this.next();
			else if (options.skipComments && this.char() === "#") while (!this.isCurrentCharEOL() && !this.eof()) this.next();
			else break;
		}
	}
	/**
	* Position reached EOF or not
	*/ eof() {
		return this.#position >= this.#source.length;
	}
	isCurrentCharEOL() {
		return this.char() === "\n" || this.startsWith("\r\n");
	}
	startsWith(searchString) {
		return this.#source.startsWith(searchString, this.#position);
	}
	match(regExp) {
		if (!regExp.sticky) throw new Error(`RegExp ${regExp} does not have a sticky 'y' flag`);
		regExp.lastIndex = this.#position;
		return this.#source.match(regExp);
	}
};
function success(body) {
	return {
		ok: true,
		body
	};
}
function failure() {
	return { ok: false };
}
/**
* Creates a nested object from the keys and values.
*
* e.g. `unflat(["a", "b", "c"], 1)` returns `{ a: { b: { c: 1 } } }`
*/ function unflat(keys, values = { __proto__: null }) {
	return keys.reduceRight((acc, key) => ({ [key]: acc }), values);
}
function isObject(value) {
	return typeof value === "object" && value !== null;
}
function getTargetValue(target, keys) {
	const key = keys[0];
	if (!key) throw new Error("Cannot parse the TOML: key length is not a positive number");
	return target[key];
}
function deepAssignTable(target, table) {
	const { keys, type, value } = table;
	const currentValue = getTargetValue(target, keys);
	if (currentValue === void 0) return Object.assign(target, unflat(keys, value));
	if (Array.isArray(currentValue)) {
		deepAssign(currentValue.at(-1), {
			type,
			keys: keys.slice(1),
			value
		});
		return target;
	}
	if (isObject(currentValue)) {
		deepAssign(currentValue, {
			type,
			keys: keys.slice(1),
			value
		});
		return target;
	}
	throw new Error("Unexpected assign");
}
function deepAssignTableArray(target, table) {
	const { type, keys, value } = table;
	const currentValue = getTargetValue(target, keys);
	if (currentValue === void 0) return Object.assign(target, unflat(keys, [value]));
	if (Array.isArray(currentValue)) {
		if (table.keys.length === 1) currentValue.push(value);
		else deepAssign(currentValue.at(-1), {
			type: table.type,
			keys: table.keys.slice(1),
			value: table.value
		});
		return target;
	}
	if (isObject(currentValue)) {
		deepAssign(currentValue, {
			type,
			keys: keys.slice(1),
			value
		});
		return target;
	}
	throw new Error("Unexpected assign");
}
function deepAssign(target, body) {
	switch (body.type) {
		case "Block": return deepMerge(target, body.value);
		case "Table": return deepAssignTable(target, body);
		case "TableArray": return deepAssignTableArray(target, body);
	}
}
function or(parsers) {
	return (scanner) => {
		for (const parse of parsers) {
			const result = parse(scanner);
			if (result.ok) return result;
		}
		return failure();
	};
}
/** Join the parse results of the given parser into an array.
*
* If the parser fails at the first attempt, it will return an empty array.
*/ function join$5(parser, separator) {
	const Separator = character(separator);
	return (scanner) => {
		const out = [];
		const first = parser(scanner);
		if (!first.ok) return success(out);
		out.push(first.body);
		while (!scanner.eof()) {
			if (!Separator(scanner).ok) break;
			const result = parser(scanner);
			if (!result.ok) throw new SyntaxError(`Invalid token after "${separator}"`);
			out.push(result.body);
		}
		return success(out);
	};
}
/** Join the parse results of the given parser into an array.
*
* This requires the parser to succeed at least once.
*/ function join1(parser, separator) {
	const Separator = character(separator);
	return (scanner) => {
		const first = parser(scanner);
		if (!first.ok) return failure();
		const out = [first.body];
		while (!scanner.eof()) {
			if (!Separator(scanner).ok) break;
			const result = parser(scanner);
			if (!result.ok) throw new SyntaxError(`Invalid token after "${separator}"`);
			out.push(result.body);
		}
		return success(out);
	};
}
function kv(keyParser, separator, valueParser) {
	const Separator = character(separator);
	return (scanner) => {
		const position = scanner.position;
		const key = keyParser(scanner);
		if (!key.ok) return failure();
		if (!Separator(scanner).ok) throw new SyntaxError(`key/value pair doesn't have "${separator}"`);
		const value = valueParser(scanner);
		if (!value.ok) {
			const lineEndIndex = scanner.source.indexOf("\n", scanner.position);
			const endPosition = lineEndIndex > 0 ? lineEndIndex : scanner.source.length;
			const line = scanner.source.slice(position, endPosition);
			throw new SyntaxError(`Cannot parse value on line '${line}'`);
		}
		return success(unflat(key.body, value.body));
	};
}
function merge$1(parser) {
	return (scanner) => {
		const result = parser(scanner);
		if (!result.ok) return failure();
		let body = { __proto__: null };
		for (const record of result.body) if (typeof record === "object" && record !== null) body = deepMerge(body, record);
		return success(body);
	};
}
function repeat(parser) {
	return (scanner) => {
		const body = [];
		while (!scanner.eof()) {
			const result = parser(scanner);
			if (!result.ok) break;
			body.push(result.body);
			scanner.nextUntilChar();
		}
		if (body.length === 0) return failure();
		return success(body);
	};
}
function surround(left, parser, right) {
	const Left = character(left);
	const Right = character(right);
	return (scanner) => {
		if (!Left(scanner).ok) return failure();
		const result = parser(scanner);
		if (!result.ok) throw new SyntaxError(`Invalid token after "${left}"`);
		if (!Right(scanner).ok) throw new SyntaxError(`Not closed by "${right}" after started with "${left}"`);
		return success(result.body);
	};
}
function character(str) {
	return (scanner) => {
		scanner.skipWhitespaces();
		if (!scanner.startsWith(str)) return failure();
		scanner.next(str.length);
		scanner.skipWhitespaces();
		return success(void 0);
	};
}
const BARE_KEY_REGEXP = /[A-Za-z0-9_-]+/y;
function bareKey(scanner) {
	var _scanner$match;
	scanner.skipWhitespaces();
	const key = (_scanner$match = scanner.match(BARE_KEY_REGEXP)) === null || _scanner$match === void 0 ? void 0 : _scanner$match[0];
	if (!key) return failure();
	scanner.next(key.length);
	return success(key);
}
function escapeSequence(scanner) {
	if (scanner.char() !== "\\") return failure();
	scanner.next();
	switch (scanner.char()) {
		case "b":
			scanner.next();
			return success("\b");
		case "t":
			scanner.next();
			return success("	");
		case "n":
			scanner.next();
			return success("\n");
		case "f":
			scanner.next();
			return success("\f");
		case "r":
			scanner.next();
			return success("\r");
		case "u":
		case "U": {
			const codePointLen = scanner.char() === "u" ? 4 : 6;
			const codePoint = parseInt("0x" + scanner.slice(1, 1 + codePointLen), 16);
			const str = String.fromCodePoint(codePoint);
			scanner.next(codePointLen + 1);
			return success(str);
		}
		case "\"":
			scanner.next();
			return success("\"");
		case "\\":
			scanner.next();
			return success("\\");
		default: throw new SyntaxError(`Invalid escape sequence: \\${scanner.char()}`);
	}
}
function basicString(scanner) {
	scanner.skipWhitespaces();
	if (scanner.char() !== "\"") return failure();
	scanner.next();
	const acc = [];
	while (scanner.char() !== "\"" && !scanner.eof()) {
		if (scanner.char() === "\n") throw new SyntaxError("Single-line string cannot contain EOL");
		const escapedChar = escapeSequence(scanner);
		if (escapedChar.ok) acc.push(escapedChar.body);
		else {
			acc.push(scanner.char());
			scanner.next();
		}
	}
	if (scanner.eof()) throw new SyntaxError(`Single-line string is not closed:\n${acc.join("")}`);
	scanner.next();
	return success(acc.join(""));
}
function literalString(scanner) {
	scanner.skipWhitespaces();
	if (scanner.char() !== "'") return failure();
	scanner.next();
	const acc = [];
	while (scanner.char() !== "'" && !scanner.eof()) {
		if (scanner.char() === "\n") throw new SyntaxError("Single-line string cannot contain EOL");
		acc.push(scanner.char());
		scanner.next();
	}
	if (scanner.eof()) throw new SyntaxError(`Single-line string is not closed:\n${acc.join("")}`);
	scanner.next();
	return success(acc.join(""));
}
function multilineBasicString(scanner) {
	scanner.skipWhitespaces();
	if (!scanner.startsWith("\"\"\"")) return failure();
	scanner.next(3);
	if (scanner.char() === "\n") scanner.next();
	else if (scanner.startsWith("\r\n")) scanner.next(2);
	const acc = [];
	while (!scanner.startsWith("\"\"\"") && !scanner.eof()) {
		if (scanner.startsWith("\\\n")) {
			scanner.next();
			scanner.nextUntilChar({ skipComments: false });
			continue;
		} else if (scanner.startsWith("\\\r\n")) {
			scanner.next();
			scanner.nextUntilChar({ skipComments: false });
			continue;
		}
		const escapedChar = escapeSequence(scanner);
		if (escapedChar.ok) acc.push(escapedChar.body);
		else {
			acc.push(scanner.char());
			scanner.next();
		}
	}
	if (scanner.eof()) throw new SyntaxError(`Multi-line string is not closed:\n${acc.join("")}`);
	if (scanner.char(3) === "\"") {
		acc.push("\"");
		scanner.next();
	}
	scanner.next(3);
	return success(acc.join(""));
}
function multilineLiteralString(scanner) {
	scanner.skipWhitespaces();
	if (!scanner.startsWith("'''")) return failure();
	scanner.next(3);
	if (scanner.char() === "\n") scanner.next();
	else if (scanner.startsWith("\r\n")) scanner.next(2);
	const acc = [];
	while (!scanner.startsWith("'''") && !scanner.eof()) {
		acc.push(scanner.char());
		scanner.next();
	}
	if (scanner.eof()) throw new SyntaxError(`Multi-line string is not closed:\n${acc.join("")}`);
	if (scanner.char(3) === "'") {
		acc.push("'");
		scanner.next();
	}
	scanner.next(3);
	return success(acc.join(""));
}
const BOOLEAN_REGEXP = /(?:true|false)\b/y;
function boolean(scanner) {
	scanner.skipWhitespaces();
	const match = scanner.match(BOOLEAN_REGEXP);
	if (!match) return failure();
	const string = match[0];
	scanner.next(string.length);
	return success(string === "true");
}
const INFINITY_MAP = /* @__PURE__ */ new Map([
	["inf", Infinity],
	["+inf", Infinity],
	["-inf", -Infinity]
]);
const INFINITY_REGEXP = /[+-]?inf\b/y;
function infinity(scanner) {
	scanner.skipWhitespaces();
	const match = scanner.match(INFINITY_REGEXP);
	if (!match) return failure();
	const string = match[0];
	scanner.next(string.length);
	return success(INFINITY_MAP.get(string));
}
const NAN_REGEXP = /[+-]?nan\b/y;
function nan(scanner) {
	scanner.skipWhitespaces();
	const match = scanner.match(NAN_REGEXP);
	if (!match) return failure();
	const string = match[0];
	scanner.next(string.length);
	return success(NaN);
}
const dottedKey = join1(or([
	bareKey,
	basicString,
	literalString
]), ".");
const BINARY_REGEXP = /0b[01]+(?:_[01]+)*\b/y;
function binary(scanner) {
	var _scanner$match2;
	scanner.skipWhitespaces();
	const match = (_scanner$match2 = scanner.match(BINARY_REGEXP)) === null || _scanner$match2 === void 0 ? void 0 : _scanner$match2[0];
	if (!match) return failure();
	scanner.next(match.length);
	const value = match.slice(2).replaceAll("_", "");
	const number = parseInt(value, 2);
	return isNaN(number) ? failure() : success(number);
}
const OCTAL_REGEXP = /0o[0-7]+(?:_[0-7]+)*\b/y;
function octal(scanner) {
	var _scanner$match3;
	scanner.skipWhitespaces();
	const match = (_scanner$match3 = scanner.match(OCTAL_REGEXP)) === null || _scanner$match3 === void 0 ? void 0 : _scanner$match3[0];
	if (!match) return failure();
	scanner.next(match.length);
	const value = match.slice(2).replaceAll("_", "");
	const number = parseInt(value, 8);
	return isNaN(number) ? failure() : success(number);
}
const HEX_REGEXP = /0x[0-9a-f]+(?:_[0-9a-f]+)*\b/iy;
function hex(scanner) {
	var _scanner$match4;
	scanner.skipWhitespaces();
	const match = (_scanner$match4 = scanner.match(HEX_REGEXP)) === null || _scanner$match4 === void 0 ? void 0 : _scanner$match4[0];
	if (!match) return failure();
	scanner.next(match.length);
	const value = match.slice(2).replaceAll("_", "");
	const number = parseInt(value, 16);
	return isNaN(number) ? failure() : success(number);
}
const INTEGER_REGEXP = /[+-]?(?:0|[1-9][0-9]*(?:_[0-9]+)*)\b/y;
function integer(scanner) {
	var _scanner$match5;
	scanner.skipWhitespaces();
	const match = (_scanner$match5 = scanner.match(INTEGER_REGEXP)) === null || _scanner$match5 === void 0 ? void 0 : _scanner$match5[0];
	if (!match) return failure();
	scanner.next(match.length);
	const value = match.replaceAll("_", "");
	return success(parseInt(value, 10));
}
const FLOAT_REGEXP = /[+-]?(?:0|[1-9][0-9]*(?:_[0-9]+)*)(?:\.[0-9]+(?:_[0-9]+)*)?(?:e[+-]?[0-9]+(?:_[0-9]+)*)?\b/iy;
function float(scanner) {
	var _scanner$match6;
	scanner.skipWhitespaces();
	const match = (_scanner$match6 = scanner.match(FLOAT_REGEXP)) === null || _scanner$match6 === void 0 ? void 0 : _scanner$match6[0];
	if (!match) return failure();
	scanner.next(match.length);
	const value = match.replaceAll("_", "");
	const float = parseFloat(value);
	if (isNaN(float)) return failure();
	return success(float);
}
const DATE_TIME_REGEXP = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})(?:[ 0-9TZ.:+-]+)?\b/y;
function dateTime(scanner) {
	scanner.skipWhitespaces();
	const match = scanner.match(DATE_TIME_REGEXP);
	if (!match) return failure();
	const string = match[0];
	scanner.next(string.length);
	const groups = match.groups;
	if (groups.month == "02") {
		const days = parseInt(groups.day);
		if (days > 29) throw new SyntaxError(`Invalid date string "${match}"`);
		const year = parseInt(groups.year);
		if (days > 28 && !isLeap(year)) throw new SyntaxError(`Invalid date string "${match}"`);
	}
	const date = new Date(string.trim());
	if (isNaN(date.getTime())) throw new SyntaxError(`Invalid date string "${match}"`);
	return success(date);
}
const LOCAL_TIME_REGEXP = /(\d{2}):(\d{2}):(\d{2})(?:\.[0-9]+)?\b/y;
function localTime(scanner) {
	var _scanner$match7;
	scanner.skipWhitespaces();
	const match = (_scanner$match7 = scanner.match(LOCAL_TIME_REGEXP)) === null || _scanner$match7 === void 0 ? void 0 : _scanner$match7[0];
	if (!match) return failure();
	scanner.next(match.length);
	return success(match);
}
function arrayValue(scanner) {
	scanner.skipWhitespaces();
	if (scanner.char() !== "[") return failure();
	scanner.next();
	const array = [];
	while (!scanner.eof()) {
		scanner.nextUntilChar();
		const result = value(scanner);
		if (!result.ok) break;
		array.push(result.body);
		scanner.skipWhitespaces();
		if (scanner.char() !== ",") break;
		scanner.next();
	}
	scanner.nextUntilChar();
	if (scanner.char() !== "]") throw new SyntaxError("Array is not closed");
	scanner.next();
	return success(array);
}
function inlineTable(scanner) {
	scanner.nextUntilChar();
	if (scanner.char(1) === "}") {
		scanner.next(2);
		return success({ __proto__: null });
	}
	const pairs = surround("{", join$5(pair, ","), "}")(scanner);
	if (!pairs.ok) return failure();
	let table = { __proto__: null };
	for (const pair of pairs.body) table = deepMerge(table, pair);
	return success(table);
}
const value = or([
	multilineBasicString,
	multilineLiteralString,
	basicString,
	literalString,
	boolean,
	infinity,
	nan,
	dateTime,
	localTime,
	binary,
	octal,
	hex,
	float,
	integer,
	arrayValue,
	inlineTable
]);
const pair = kv(dottedKey, "=", value);
function block(scanner) {
	scanner.nextUntilChar();
	const result = merge$1(repeat(pair))(scanner);
	if (result.ok) return success({
		type: "Block",
		value: result.body
	});
	return failure();
}
const tableHeader = surround("[", dottedKey, "]");
function table(scanner) {
	scanner.nextUntilChar();
	const header = tableHeader(scanner);
	if (!header.ok) return failure();
	scanner.nextUntilChar();
	const b = block(scanner);
	return success({
		type: "Table",
		keys: header.body,
		value: b.ok ? b.body.value : { __proto__: null }
	});
}
const tableArrayHeader = surround("[[", dottedKey, "]]");
function tableArray(scanner) {
	scanner.nextUntilChar();
	const header = tableArrayHeader(scanner);
	if (!header.ok) return failure();
	scanner.nextUntilChar();
	const b = block(scanner);
	return success({
		type: "TableArray",
		keys: header.body,
		value: b.ok ? b.body.value : { __proto__: null }
	});
}
function toml(scanner) {
	const blocks = repeat(or([
		block,
		tableArray,
		table
	]))(scanner);
	if (!blocks.ok) return success({ __proto__: null });
	return success(blocks.body.reduce(deepAssign, { __proto__: null }));
}
function createParseErrorMessage(scanner, message) {
	var _lines$at;
	const lines = scanner.source.slice(0, scanner.position).split("\n");
	return `Parse error on line ${lines.length}, column ${((_lines$at = lines.at(-1)) === null || _lines$at === void 0 ? void 0 : _lines$at.length) ?? 0}: ${message}`;
}
function parserFactory(parser) {
	return (tomlString) => {
		const scanner = new Scanner(tomlString);
		try {
			const result = parser(scanner);
			if (result.ok && scanner.eof()) return result.body;
			const message = `Unexpected character: "${scanner.char()}"`;
			throw new SyntaxError(createParseErrorMessage(scanner, message));
		} catch (error) {
			if (error instanceof Error) throw new SyntaxError(createParseErrorMessage(scanner, error.message));
			throw new SyntaxError(createParseErrorMessage(scanner, "Invalid error type caught"));
		}
	};
}
//#endregion
//#region ../node_modules/@std/toml/parse.js
/**
* Parses a {@link https://toml.io | TOML} string into an object.
*
* @example Usage
* ```ts
* import { parse } from "@std/toml/parse";
* import { assertEquals } from "@std/assert";
*
* const tomlString = `title = "TOML Example"
* [owner]
* name = "Alice"
* bio = "Alice is a programmer."`;
*
* const obj = parse(tomlString);
* assertEquals(obj, { title: "TOML Example", owner: { name: "Alice", bio: "Alice is a programmer." } });
* ```
* @param tomlString TOML string to be parsed.
* @returns The parsed JS object.
*/ function parse(tomlString) {
	return parserFactory(toml)(tomlString);
}
//#endregion
//#region src/def/new.ts
var BaseNewCommand = class extends clipanion.Command {
	static paths = [["new"]];
	static usage = clipanion.Command.Usage({ description: "Create a new project with pre-configured boilerplate" });
	$$path = clipanion.Option.String({ required: false });
	$$name = clipanion.Option.String("--name,-n", { description: "The name of the project, default to the name of the directory if not provided" });
	minNodeApiVersion = clipanion.Option.String("--min-node-api,-v", "4", {
		validator: typanion.isNumber(),
		description: "The minimum Node-API version to support"
	});
	packageManager = clipanion.Option.String("--package-manager", "yarn", { description: "The package manager to use. Only support yarn 4.x for now." });
	license = clipanion.Option.String("--license,-l", "MIT", { description: "License for open-sourced project" });
	targets = clipanion.Option.Array("--targets,-t", [], { description: "All targets the crate will be compiled for." });
	enableDefaultTargets = clipanion.Option.Boolean("--enable-default-targets", true, { description: "Whether enable default targets" });
	enableAllTargets = clipanion.Option.Boolean("--enable-all-targets", false, { description: "Whether enable all targets" });
	enableTypeDef = clipanion.Option.Boolean("--enable-type-def", true, { description: "Whether enable the `type-def` feature for typescript definitions auto-generation" });
	enableGithubActions = clipanion.Option.Boolean("--enable-github-actions", true, { description: "Whether generate preconfigured GitHub Actions workflow" });
	testFramework = clipanion.Option.String("--test-framework", "ava", { description: "The JavaScript test framework to use, only support `ava` for now" });
	dryRun = clipanion.Option.Boolean("--dry-run", false, { description: "Whether to run the command in dry-run mode" });
	getOptions() {
		return {
			path: this.$$path,
			name: this.$$name,
			minNodeApiVersion: this.minNodeApiVersion,
			packageManager: this.packageManager,
			license: this.license,
			targets: this.targets,
			enableDefaultTargets: this.enableDefaultTargets,
			enableAllTargets: this.enableAllTargets,
			enableTypeDef: this.enableTypeDef,
			enableGithubActions: this.enableGithubActions,
			testFramework: this.testFramework,
			dryRun: this.dryRun
		};
	}
};
function applyDefaultNewOptions(options) {
	return {
		minNodeApiVersion: 4,
		packageManager: "yarn",
		license: "MIT",
		targets: [],
		enableDefaultTargets: true,
		enableAllTargets: false,
		enableTypeDef: true,
		enableGithubActions: true,
		testFramework: "ava",
		dryRun: false,
		...options
	};
}
//#endregion
//#region ../node_modules/empathic/resolve.mjs
/**
* Resolve an absolute path from {@link root}, but only
* if {@link input} isn't already absolute.
*
* @param input The path to resolve.
* @param root The base path; default = process.cwd()
* @returns The resolved absolute path.
*/
function absolute(input, root) {
	return (0, node_path.isAbsolute)(input) ? input : (0, node_path.resolve)(root || ".", input);
}
//#endregion
//#region ../node_modules/empathic/walk.mjs
/**
* Get all parent directories of {@link base}.
* Stops after {@link Options['last']} is processed.
*
* @returns An array of absolute paths of all parent directories.
*/
function up(base, options) {
	let { last, cwd } = options || {};
	let tmp = absolute(base, cwd);
	let root = absolute(last || "/", cwd);
	let prev, arr = [];
	while (prev !== root) {
		arr.push(tmp);
		tmp = (0, node_path.dirname)(prev = tmp);
		if (tmp === prev) break;
	}
	return arr;
}
//#endregion
//#region ../node_modules/empathic/find.mjs
/**
* Find a directory by name, walking parent directories until found.
*
* > [NOTE]
* > This function only returns a value for directory matches.
* > A file match with the same name will be ignored.
*
* @param name The directory name to find.
* @returns The absolute path to the file, if found.
*/
function dir(name, options) {
	let dir, tmp;
	for (dir of up(options && options.cwd || "", options)) try {
		tmp = (0, node_path.join)(dir, name);
		if ((0, node_fs.statSync)(tmp).isDirectory()) return tmp;
	} catch {}
}
//#endregion
//#region src/def/rename.ts
var BaseRenameCommand = class extends clipanion.Command {
	static paths = [["rename"]];
	static usage = clipanion.Command.Usage({ description: "Rename the NAPI-RS project" });
	cwd = clipanion.Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = clipanion.Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = clipanion.Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	npmDir = clipanion.Option.String("--npm-dir", "npm", { description: "Path to the folder where the npm packages put" });
	$$name = clipanion.Option.String("--name,-n", { description: "The new name of the project" });
	binaryName = clipanion.Option.String("--binary-name,-b", { description: "The new binary name *.node files" });
	packageName = clipanion.Option.String("--package-name", { description: "The new package name of the project" });
	manifestPath = clipanion.Option.String("--manifest-path", "Cargo.toml", { description: "Path to `Cargo.toml`" });
	repository = clipanion.Option.String("--repository", { description: "The new repository of the project" });
	description = clipanion.Option.String("--description", { description: "The new description of the project" });
	getOptions() {
		return {
			cwd: this.cwd,
			configPath: this.configPath,
			packageJsonPath: this.packageJsonPath,
			npmDir: this.npmDir,
			name: this.$$name,
			binaryName: this.binaryName,
			packageName: this.packageName,
			manifestPath: this.manifestPath,
			repository: this.repository,
			description: this.description
		};
	}
};
function applyDefaultRenameOptions(options) {
	return {
		cwd: process.cwd(),
		packageJsonPath: "package.json",
		npmDir: "npm",
		manifestPath: "Cargo.toml",
		...options
	};
}
//#endregion
//#region src/api/rename.ts
async function renameProject(userOptions) {
	const options = applyDefaultRenameOptions(userOptions);
	const oldName = (await readConfig(options)).binaryName;
	const packageJsonPath = (0, node_path.resolve)(options.cwd, options.packageJsonPath);
	const cargoTomlPath = (0, node_path.resolve)(options.cwd, options.manifestPath);
	const packageJsonContent = await readFileAsync(packageJsonPath, "utf8");
	const packageJsonData = JSON.parse(packageJsonContent);
	(0, es_toolkit.merge)((0, es_toolkit.merge)(packageJsonData, (0, es_toolkit.omitBy)((0, es_toolkit.pick)(options, [
		"name",
		"description",
		"author",
		"license"
	]), es_toolkit.isNil)), { napi: (0, es_toolkit.omitBy)({
		binaryName: options.binaryName,
		packageName: options.packageName
	}, es_toolkit.isNil) });
	if (options.repository) if (packageJsonData.repository && typeof packageJsonData.repository === "object" && !Array.isArray(packageJsonData.repository)) packageJsonData.repository.url = options.repository;
	else packageJsonData.repository = options.repository;
	if (options.configPath) {
		const configPath = (0, node_path.resolve)(options.cwd, options.configPath);
		const configContent = await readFileAsync(configPath, "utf8");
		const configData = JSON.parse(configContent);
		(0, es_toolkit.merge)(configData, (0, es_toolkit.omitBy)({
			binaryName: options.binaryName,
			packageName: options.packageName
		}, es_toolkit.isNil));
		await writeFileAsync(configPath, JSON.stringify(configData, null, 2));
	}
	await writeFileAsync(packageJsonPath, JSON.stringify(packageJsonData, null, 2));
	const cargoToml = parse(await readFileAsync(cargoTomlPath, "utf8"));
	if (cargoToml.package && options.binaryName) {
		const sanitizedName = options.binaryName.replace("@", "").replace("/", "_").replace(/-/g, "_").toLowerCase();
		cargoToml.package.name = sanitizedName;
	}
	await writeFileAsync(cargoTomlPath, stringify(cargoToml));
	if (options.binaryName && oldName !== options.binaryName) {
		const githubActionsPath = dir(".github", { cwd: options.cwd });
		if (githubActionsPath) {
			const githubActionsCIYmlPath = (0, node_path.join)(githubActionsPath, "workflows", "CI.yml");
			if ((0, node_fs.existsSync)(githubActionsCIYmlPath)) {
				var _githubActionsData$en;
				const githubActionsData = (0, js_yaml.load)(await readFileAsync(githubActionsCIYmlPath, "utf8"));
				if ((_githubActionsData$en = githubActionsData.env) === null || _githubActionsData$en === void 0 ? void 0 : _githubActionsData$en.APP_NAME) {
					githubActionsData.env.APP_NAME = options.binaryName;
					await writeFileAsync(githubActionsCIYmlPath, (0, js_yaml.dump)(githubActionsData, {
						lineWidth: -1,
						noRefs: true,
						sortKeys: false
					}));
				}
			}
		}
		const oldWasiBrowserBindingPath = (0, node_path.join)(options.cwd, `${oldName}.wasi-browser.js`);
		if ((0, node_fs.existsSync)(oldWasiBrowserBindingPath)) await (0, node_fs_promises.rename)(oldWasiBrowserBindingPath, (0, node_path.join)(options.cwd, `${options.binaryName}.wasi-browser.js`));
		const oldWasiBindingPath = (0, node_path.join)(options.cwd, `${oldName}.wasi.cjs`);
		if ((0, node_fs.existsSync)(oldWasiBindingPath)) await (0, node_fs_promises.rename)(oldWasiBindingPath, (0, node_path.join)(options.cwd, `${options.binaryName}.wasi.cjs`));
		const gitAttributesPath = (0, node_path.join)(options.cwd, ".gitattributes");
		if ((0, node_fs.existsSync)(gitAttributesPath)) await writeFileAsync(gitAttributesPath, (await readFileAsync(gitAttributesPath, "utf8")).split("\n").map((line) => {
			return line.replace(`${oldName}.wasi-browser.js`, `${options.binaryName}.wasi-browser.js`).replace(`${oldName}.wasi.cjs`, `${options.binaryName}.wasi.cjs`);
		}).join("\n"));
	}
}
//#endregion
//#region src/api/new.ts
const debug$5 = debugFactory("new");
const TEMPLATE_REPOS = {
	yarn: "https://github.com/napi-rs/package-template",
	pnpm: "https://github.com/napi-rs/package-template-pnpm"
};
const WASI_TARGET = "wasm32-wasip1-threads";
async function checkGitCommand() {
	return new Promise((resolve) => {
		const cp = (0, node_child_process.exec)("git --version");
		cp.on("error", () => {
			resolve(false);
		});
		cp.on("exit", (code) => {
			resolve(code === 0);
		});
	});
}
async function ensureCacheDir(packageManager) {
	const cacheDir = node_path.default.join((0, node_os.homedir)(), ".napi-rs", "template", packageManager);
	await mkdirAsync(cacheDir, { recursive: true });
	return cacheDir;
}
async function downloadTemplate(packageManager, cacheDir) {
	const repoUrl = TEMPLATE_REPOS[packageManager];
	const templatePath = node_path.default.join(cacheDir, "repo");
	if ((0, node_fs.existsSync)(templatePath)) {
		debug$5(`Template cache found at ${templatePath}, updating...`);
		try {
			await new Promise((resolve, reject) => {
				const cp = (0, node_child_process.exec)("git fetch origin", { cwd: templatePath });
				cp.on("error", reject);
				cp.on("exit", (code) => {
					if (code === 0) resolve();
					else reject(/* @__PURE__ */ new Error(`Failed to fetch latest changes, git process exited with code ${code}`));
				});
			});
			(0, node_child_process.execSync)("git reset --hard origin/main", {
				cwd: templatePath,
				stdio: "ignore"
			});
			debug$5("Template updated successfully");
		} catch (error) {
			debug$5(`Failed to update template: ${error}`);
			throw new Error(`Failed to update template from ${repoUrl}: ${error}`);
		}
	} else {
		debug$5(`Cloning template from ${repoUrl}...`);
		try {
			(0, node_child_process.execSync)(`git clone ${repoUrl} repo`, {
				cwd: cacheDir,
				stdio: "inherit"
			});
			debug$5("Template cloned successfully");
		} catch (error) {
			throw new Error(`Failed to clone template from ${repoUrl}: ${error}`);
		}
	}
}
async function copyDirectory(src, dest, includeWasiBindings) {
	await mkdirAsync(dest, { recursive: true });
	const entries = await node_fs.promises.readdir(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = node_path.default.join(src, entry.name);
		const destPath = node_path.default.join(dest, entry.name);
		if (entry.name === ".git") continue;
		if (entry.isDirectory()) await copyDirectory(srcPath, destPath, includeWasiBindings);
		else {
			if (!includeWasiBindings && (entry.name.endsWith(".wasi-browser.js") || entry.name.endsWith(".wasi.cjs") || entry.name.endsWith("wasi-worker-browser.mjs") || entry.name.endsWith("wasi-worker.mjs") || entry.name === "browser.js")) continue;
			await node_fs.promises.copyFile(srcPath, destPath);
		}
	}
}
async function filterTargetsInPackageJson(filePath, enabledTargets) {
	var _packageJson$napi;
	const content = await node_fs.promises.readFile(filePath, "utf-8");
	const packageJson = JSON.parse(content);
	const includeWasiBindings = enabledTargets.includes(WASI_TARGET);
	if ((_packageJson$napi = packageJson.napi) === null || _packageJson$napi === void 0 ? void 0 : _packageJson$napi.targets) packageJson.napi.targets = packageJson.napi.targets.filter((target) => enabledTargets.includes(target));
	if (!includeWasiBindings) {
		if (packageJson.browser === "browser.js" || packageJson.browser === "./browser.js") delete packageJson.browser;
		if (Array.isArray(packageJson.files)) packageJson.files = packageJson.files.filter((file) => file !== "browser.js" && file !== "./browser.js");
	}
	await node_fs.promises.writeFile(filePath, JSON.stringify(packageJson, null, 2) + "\n");
}
async function updateCargoTomlTypeDef(filePath, enableTypeDef) {
	if (enableTypeDef) return;
	const cargoToml = parse(await node_fs.promises.readFile(filePath, "utf-8"));
	const dependencies = cargoToml.dependencies;
	if (!dependencies || !dependencies["napi-derive"]) return;
	const napiDeriveDependency = dependencies["napi-derive"];
	const dependencyConfig = typeof napiDeriveDependency === "string" ? { version: napiDeriveDependency } : { ...napiDeriveDependency };
	const existingFeatures = Array.isArray(dependencyConfig.features) ? dependencyConfig.features.filter((feature) => typeof feature === "string") : [];
	dependencyConfig["default-features"] = false;
	dependencyConfig.features = ["strict", ...existingFeatures.filter((feature) => feature !== "strict")].filter((feature) => feature !== "type-def");
	dependencies["napi-derive"] = dependencyConfig;
	await node_fs.promises.writeFile(filePath, stringify(cargoToml));
}
async function updateCargoTomlNodeApiVersion(filePath, minNodeApiVersion) {
	const cargoToml = parse(await node_fs.promises.readFile(filePath, "utf-8"));
	const dependencies = cargoToml.dependencies;
	if (!dependencies || !dependencies.napi) return;
	const napiDependency = dependencies.napi;
	const dependencyConfig = typeof napiDependency === "string" ? { version: napiDependency } : { ...napiDependency };
	const usedDefaultFeatures = dependencyConfig["default-features"] !== false;
	const existingFeatures = Array.isArray(dependencyConfig.features) ? dependencyConfig.features.filter((feature) => typeof feature === "string") : [];
	dependencyConfig.features = [`napi${minNodeApiVersion}`, ...existingFeatures.filter((feature) => !/^napi\d+$/.test(feature))];
	if (minNodeApiVersion < 4) {
		dependencyConfig["default-features"] = false;
		if (usedDefaultFeatures && !dependencyConfig.features.includes("dyn-symbols")) dependencyConfig.features.push("dyn-symbols");
	}
	dependencies.napi = dependencyConfig;
	await node_fs.promises.writeFile(filePath, stringify(cargoToml));
}
async function filterTargetsInGithubActions(filePath, enabledTargets) {
	var _yaml$jobs, _yaml$jobs5;
	const yaml = (0, js_yaml.load)(await node_fs.promises.readFile(filePath, "utf-8"));
	const linuxTargets = /* @__PURE__ */ new Set([
		"x86_64-unknown-linux-gnu",
		"x86_64-unknown-linux-musl",
		"aarch64-unknown-linux-gnu",
		"aarch64-unknown-linux-musl",
		"armv7-unknown-linux-gnueabihf",
		"armv7-unknown-linux-musleabihf",
		"loongarch64-unknown-linux-gnu",
		"riscv64gc-unknown-linux-gnu",
		"powerpc64le-unknown-linux-gnu",
		"s390x-unknown-linux-gnu",
		"aarch64-linux-android",
		"armv7-linux-androideabi"
	]);
	const hasLinuxTargets = enabledTargets.some((target) => linuxTargets.has(target));
	const hasMacOSOrWindowsTargets = enabledTargets.some((target) => {
		const platform = parseTriple(target).platform;
		return platform === "darwin" || platform === "win32";
	});
	if (yaml === null || yaml === void 0 || (_yaml$jobs = yaml.jobs) === null || _yaml$jobs === void 0 || (_yaml$jobs = _yaml$jobs.build) === null || _yaml$jobs === void 0 || (_yaml$jobs = _yaml$jobs.strategy) === null || _yaml$jobs === void 0 || (_yaml$jobs = _yaml$jobs.matrix) === null || _yaml$jobs === void 0 ? void 0 : _yaml$jobs.settings) yaml.jobs.build.strategy.matrix.settings = yaml.jobs.build.strategy.matrix.settings.filter((setting) => {
		if (setting.target) return enabledTargets.includes(setting.target);
		return true;
	});
	const jobsToRemove = [];
	if (!hasMacOSOrWindowsTargets) jobsToRemove.push("test-macOS-windows-binding");
	else {
		var _yaml$jobs2;
		if (yaml === null || yaml === void 0 || (_yaml$jobs2 = yaml.jobs) === null || _yaml$jobs2 === void 0 || (_yaml$jobs2 = _yaml$jobs2["test-macOS-windows-binding"]) === null || _yaml$jobs2 === void 0 || (_yaml$jobs2 = _yaml$jobs2.strategy) === null || _yaml$jobs2 === void 0 || (_yaml$jobs2 = _yaml$jobs2.matrix) === null || _yaml$jobs2 === void 0 ? void 0 : _yaml$jobs2.settings) yaml.jobs["test-macOS-windows-binding"].strategy.matrix.settings = yaml.jobs["test-macOS-windows-binding"].strategy.matrix.settings.filter((setting) => {
			if (setting.target) return enabledTargets.includes(setting.target);
			return true;
		});
	}
	if (!hasLinuxTargets) {
		var _yaml$jobs3;
		if (yaml === null || yaml === void 0 || (_yaml$jobs3 = yaml.jobs) === null || _yaml$jobs3 === void 0 ? void 0 : _yaml$jobs3["test-linux-binding"]) jobsToRemove.push("test-linux-binding");
	} else {
		var _yaml$jobs4;
		if (yaml === null || yaml === void 0 || (_yaml$jobs4 = yaml.jobs) === null || _yaml$jobs4 === void 0 || (_yaml$jobs4 = _yaml$jobs4["test-linux-binding"]) === null || _yaml$jobs4 === void 0 || (_yaml$jobs4 = _yaml$jobs4.strategy) === null || _yaml$jobs4 === void 0 || (_yaml$jobs4 = _yaml$jobs4.matrix) === null || _yaml$jobs4 === void 0 ? void 0 : _yaml$jobs4.target) yaml.jobs["test-linux-binding"].strategy.matrix.target = yaml.jobs["test-linux-binding"].strategy.matrix.target.filter((target) => {
			if (target) return enabledTargets.includes(target);
			return true;
		});
	}
	if (!enabledTargets.includes(WASI_TARGET)) jobsToRemove.push("test-wasi");
	if (!enabledTargets.includes("x86_64-unknown-freebsd")) jobsToRemove.push("build-freebsd");
	for (const [jobName, jobConfig] of Object.entries(yaml.jobs || {})) if (jobName.startsWith("test-") && jobName !== "test-macOS-windows-binding" && jobName !== "test-linux-x64-gnu-binding") {
		var _job$strategy;
		const job = jobConfig;
		if ((_job$strategy = job.strategy) === null || _job$strategy === void 0 || (_job$strategy = _job$strategy.matrix) === null || _job$strategy === void 0 || (_job$strategy = _job$strategy.settings) === null || _job$strategy === void 0 || (_job$strategy = _job$strategy[0]) === null || _job$strategy === void 0 ? void 0 : _job$strategy.target) {
			const target = job.strategy.matrix.settings[0].target;
			if (!enabledTargets.includes(target)) jobsToRemove.push(jobName);
		}
	}
	for (const jobName of jobsToRemove) delete yaml.jobs[jobName];
	if (Array.isArray((_yaml$jobs5 = yaml.jobs) === null || _yaml$jobs5 === void 0 || (_yaml$jobs5 = _yaml$jobs5.publish) === null || _yaml$jobs5 === void 0 ? void 0 : _yaml$jobs5.needs)) yaml.jobs.publish.needs = yaml.jobs.publish.needs.filter((need) => !jobsToRemove.includes(need));
	const updatedYaml = (0, js_yaml.dump)(yaml, {
		lineWidth: -1,
		noRefs: true,
		sortKeys: false
	});
	await node_fs.promises.writeFile(filePath, updatedYaml);
}
function processOptions(options) {
	var _options$targets;
	debug$5("Processing options...");
	const minNodeApiVersion = options.minNodeApiVersion ?? 4;
	if (!Number.isInteger(minNodeApiVersion) || !SUPPORTED_NAPI_VERSIONS.some((version) => version === minNodeApiVersion)) throw new RangeError(`Unsupported Node-API version ${minNodeApiVersion}. Expected one of: ${SUPPORTED_NAPI_VERSIONS.join(", ")}`);
	options.minNodeApiVersion = minNodeApiVersion;
	if (!options.path) throw new Error("Please provide the path as the argument");
	options.path = node_path.default.resolve(process.cwd(), options.path);
	debug$5(`Resolved target path to: ${options.path}`);
	if (!options.name) {
		options.name = node_path.default.parse(options.path).base;
		debug$5(`No project name provided, fix it to dir name: ${options.name}`);
	}
	if (!((_options$targets = options.targets) === null || _options$targets === void 0 ? void 0 : _options$targets.length)) if (options.enableAllTargets) {
		options.targets = AVAILABLE_TARGETS.concat();
		debug$5("Enable all targets");
	} else if (options.enableDefaultTargets) {
		options.targets = DEFAULT_TARGETS.concat();
		debug$5("Enable default targets");
	} else throw new Error("At least one target must be enabled");
	if (options.targets.some((target) => target === "wasm32-wasi-preview1-threads")) {
		if ((0, node_child_process.execSync)(`rustup target list`, { encoding: "utf8" }).includes(WASI_TARGET)) options.targets = options.targets.map((target) => target === "wasm32-wasi-preview1-threads" ? WASI_TARGET : target);
	}
	return applyDefaultNewOptions(options);
}
async function newProject(userOptions) {
	debug$5("Will create napi-rs project with given options:");
	debug$5(userOptions);
	const options = processOptions(userOptions);
	debug$5("Targets to be enabled:");
	debug$5(options.targets);
	if (!await checkGitCommand()) throw new Error("Git is not installed or not available in PATH. Please install Git to continue.");
	const packageManager = options.packageManager;
	await ensurePath(options.path, options.dryRun);
	if (!options.dryRun) try {
		const cacheDir = await ensureCacheDir(packageManager);
		await downloadTemplate(packageManager, cacheDir);
		await copyDirectory(node_path.default.join(cacheDir, "repo"), options.path, options.targets.includes(WASI_TARGET));
		await renameProject({
			cwd: options.path,
			name: options.name,
			binaryName: getBinaryName(options.name)
		});
		const cargoTomlPath = node_path.default.join(options.path, "Cargo.toml");
		if ((0, node_fs.existsSync)(cargoTomlPath)) {
			await updateCargoTomlTypeDef(cargoTomlPath, options.enableTypeDef);
			await updateCargoTomlNodeApiVersion(cargoTomlPath, options.minNodeApiVersion);
		}
		const packageJsonPath = node_path.default.join(options.path, "package.json");
		if ((0, node_fs.existsSync)(packageJsonPath)) await filterTargetsInPackageJson(packageJsonPath, options.targets);
		const ciPath = node_path.default.join(options.path, ".github", "workflows", "CI.yml");
		if ((0, node_fs.existsSync)(ciPath) && options.enableGithubActions) await filterTargetsInGithubActions(ciPath, options.targets);
		else if (!options.enableGithubActions && (0, node_fs.existsSync)(node_path.default.join(options.path, ".github"))) await node_fs.promises.rm(node_path.default.join(options.path, ".github"), {
			recursive: true,
			force: true
		});
		const pkgJsonContent = await node_fs.promises.readFile(packageJsonPath, "utf-8");
		const pkgJson = JSON.parse(pkgJsonContent);
		if (!pkgJson.engines) pkgJson.engines = {};
		pkgJson.engines.node = napiEngineRequirement(options.minNodeApiVersion);
		if (options.license && pkgJson.license !== options.license) pkgJson.license = options.license;
		if (options.testFramework !== "ava") debug$5(`Test framework ${options.testFramework} requested but not yet implemented`);
		await node_fs.promises.writeFile(packageJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");
	} catch (error) {
		throw new Error(`Failed to create project: ${error}`);
	}
	debug$5(`Project created at: ${options.path}`);
}
async function ensurePath(path, dryRun = false) {
	const stat = await statAsync(path, {}).catch(() => void 0);
	if (stat) {
		if (stat.isFile()) throw new Error(`Path ${path} for creating new napi-rs project already exists and it's not a directory.`);
		else if (stat.isDirectory()) {
			if ((await readdirAsync(path)).length) throw new Error(`Path ${path} for creating new napi-rs project already exists and it's not empty.`);
		}
	}
	if (!dryRun) try {
		debug$5(`Try to create target directory: ${path}`);
		if (!dryRun) await mkdirAsync(path, { recursive: true });
	} catch (e) {
		throw new Error(`Failed to create target directory: ${path}`, { cause: e });
	}
}
function getBinaryName(name) {
	return name.split("/").pop();
}
//#endregion
//#region src/def/pre-publish.ts
var BasePrePublishCommand = class extends clipanion.Command {
	static paths = [["pre-publish"], ["prepublish"]];
	static usage = clipanion.Command.Usage({ description: "Update package.json and copy addons into per platform packages" });
	cwd = clipanion.Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = clipanion.Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = clipanion.Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	npmDir = clipanion.Option.String("--npm-dir,-p", "npm", { description: "Path to the folder where the npm packages put" });
	tagStyle = clipanion.Option.String("--tag-style,--tagstyle,-t", "lerna", { description: "git tag style, `npm` or `lerna`" });
	ghRelease = clipanion.Option.Boolean("--gh-release", true, { description: "Whether create GitHub release" });
	ghReleaseName = clipanion.Option.String("--gh-release-name", { description: "GitHub release name" });
	ghReleaseId = clipanion.Option.String("--gh-release-id", { description: "Existing GitHub release id" });
	skipOptionalPublish = clipanion.Option.Boolean("--skip-optional-publish", false, { description: "Whether skip optionalDependencies packages publish" });
	dryRun = clipanion.Option.Boolean("--dry-run", false, { description: "Dry run without touching file system" });
	getOptions() {
		return {
			cwd: this.cwd,
			configPath: this.configPath,
			packageJsonPath: this.packageJsonPath,
			npmDir: this.npmDir,
			tagStyle: this.tagStyle,
			ghRelease: this.ghRelease,
			ghReleaseName: this.ghReleaseName,
			ghReleaseId: this.ghReleaseId,
			skipOptionalPublish: this.skipOptionalPublish,
			dryRun: this.dryRun
		};
	}
};
function applyDefaultPrePublishOptions(options) {
	return {
		cwd: process.cwd(),
		packageJsonPath: "package.json",
		npmDir: "npm",
		tagStyle: "lerna",
		ghRelease: true,
		skipOptionalPublish: false,
		dryRun: false,
		...options
	};
}
//#endregion
//#region src/def/version.ts
var BaseVersionCommand = class extends clipanion.Command {
	static paths = [["version"]];
	static usage = clipanion.Command.Usage({ description: "Update version in created npm packages" });
	cwd = clipanion.Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = clipanion.Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = clipanion.Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	npmDir = clipanion.Option.String("--npm-dir", "npm", { description: "Path to the folder where the npm packages put" });
	getOptions() {
		return {
			cwd: this.cwd,
			configPath: this.configPath,
			packageJsonPath: this.packageJsonPath,
			npmDir: this.npmDir
		};
	}
};
function applyDefaultVersionOptions(options) {
	return {
		cwd: process.cwd(),
		packageJsonPath: "package.json",
		npmDir: "npm",
		...options
	};
}
//#endregion
//#region src/api/version.ts
const debug$4 = debugFactory("version");
async function version(userOptions) {
	const options = applyDefaultVersionOptions(userOptions);
	const config = await readNapiConfig((0, node_path.resolve)(options.cwd, options.packageJsonPath), options.configPath ? (0, node_path.resolve)(options.cwd, options.configPath) : void 0);
	for (const target of config.targets) {
		const pkgDir = (0, node_path.resolve)(options.cwd, options.npmDir, target.platformArchABI);
		debug$4(`Update version to %i in [%i]`, config.packageJson.version, pkgDir);
		await updatePackageJson((0, node_path.join)(pkgDir, "package.json"), { version: config.packageJson.version });
	}
}
//#endregion
//#region src/api/pre-publish.ts
const debug$3 = debugFactory("pre-publish");
async function prePublish(userOptions) {
	debug$3("Receive pre-publish options:");
	debug$3("  %O", userOptions);
	const options = applyDefaultPrePublishOptions(userOptions);
	const packageJsonPath = (0, node_path.resolve)(options.cwd, options.packageJsonPath);
	const { packageJson, targets, packageName, binaryName, npmClient } = await readNapiConfig(packageJsonPath, options.configPath ? (0, node_path.resolve)(options.cwd, options.configPath) : void 0);
	async function createGhRelease(packageName, version) {
		if (!options.ghRelease) return {
			owner: null,
			repo: null,
			pkgInfo: {
				name: null,
				version: null,
				tag: null
			}
		};
		const { repo, owner, pkgInfo, octokit } = getRepoInfo(packageName, version);
		if (!repo || !owner) return {
			owner: null,
			repo: null,
			pkgInfo: {
				name: null,
				version: null,
				tag: null
			}
		};
		if (!options.dryRun) try {
			await octokit.repos.createRelease({
				owner,
				repo,
				tag_name: pkgInfo.tag,
				name: options.ghReleaseName,
				prerelease: version.includes("alpha") || version.includes("beta") || version.includes("rc")
			});
		} catch (e) {
			debug$3(`Params: ${JSON.stringify({
				owner,
				repo,
				tag_name: pkgInfo.tag
			}, null, 2)}`);
			console.error(e);
		}
		return {
			owner,
			repo,
			pkgInfo,
			octokit
		};
	}
	function getRepoInfo(packageName, version) {
		const headCommit = (0, node_child_process.execSync)("git log -1 --pretty=%B", {
			cwd: options.cwd,
			encoding: "utf-8"
		}).trim();
		const { GITHUB_REPOSITORY } = process.env;
		if (!GITHUB_REPOSITORY) return {
			owner: null,
			repo: null,
			pkgInfo: {
				name: null,
				version: null,
				tag: null
			}
		};
		debug$3(`Github repository: ${GITHUB_REPOSITORY}`);
		const [owner, repo] = GITHUB_REPOSITORY.split("/");
		const octokit = new _octokit_rest.Octokit({ auth: process.env.GITHUB_TOKEN });
		let pkgInfo;
		if (options.tagStyle === "lerna") {
			pkgInfo = headCommit.split("\n").map((line) => line.trim()).filter((line, index) => line.length && index).map((line) => line.substring(2)).map(parseTag).find((pkgInfo) => pkgInfo.name === packageName);
			if (!pkgInfo) throw new TypeError(`No release commit found with ${packageName}, original commit info: ${headCommit}`);
		} else pkgInfo = {
			tag: `v${version}`,
			version,
			name: packageName
		};
		return {
			owner,
			repo,
			pkgInfo,
			octokit
		};
	}
	if (!options.dryRun) {
		await version(userOptions);
		await updatePackageJson(packageJsonPath, { optionalDependencies: targets.reduce((deps, target) => {
			deps[`${packageName}-${target.platformArchABI}`] = packageJson.version;
			return deps;
		}, {}) });
	}
	const { owner, repo, pkgInfo, octokit } = options.ghReleaseId ? getRepoInfo(packageName, packageJson.version) : await createGhRelease(packageName, packageJson.version);
	for (const target of targets) {
		const pkgDir = (0, node_path.resolve)(options.cwd, options.npmDir, `${target.platformArchABI}`);
		const ext = target.platform === "wasi" || target.platform === "wasm" ? "wasm" : "node";
		const filename = `${binaryName}.${target.platformArchABI}.${ext}`;
		const dstPath = (0, node_path.join)(pkgDir, filename);
		if (!options.dryRun) {
			if (!(0, node_fs.existsSync)(dstPath)) {
				debug$3.warn(`%s doesn't exist`, dstPath);
				continue;
			}
			if (!options.skipOptionalPublish) try {
				const output = (0, node_child_process.execSync)(`${npmClient} publish`, {
					cwd: pkgDir,
					env: process.env,
					stdio: "pipe"
				});
				process.stdout.write(output);
			} catch (e) {
				if (e instanceof Error && e.message.includes("You cannot publish over the previously published versions")) {
					console.info(e.message);
					debug$3.warn(`${pkgDir} has been published, skipping`);
				} else throw e;
			}
			if (options.ghRelease && repo && owner) {
				debug$3.info(`Creating GitHub release ${pkgInfo.tag}`);
				try {
					const releaseId = options.ghReleaseId ? Number(options.ghReleaseId) : (await octokit.repos.getReleaseByTag({
						repo,
						owner,
						tag: pkgInfo.tag
					})).data.id;
					const dstFileStats = (0, node_fs.statSync)(dstPath);
					const assetInfo = await octokit.repos.uploadReleaseAsset({
						owner,
						repo,
						name: filename,
						release_id: releaseId,
						mediaType: { format: "raw" },
						headers: {
							"content-length": dstFileStats.size,
							"content-type": "application/octet-stream"
						},
						data: await readFileAsync(dstPath)
					});
					debug$3.info(`GitHub release created`);
					debug$3.info(`Download URL: %s`, assetInfo.data.browser_download_url);
				} catch (e) {
					debug$3.error(`Param: ${JSON.stringify({
						owner,
						repo,
						tag: pkgInfo.tag,
						filename: dstPath
					}, null, 2)}`);
					debug$3.error(e);
				}
			}
		}
	}
}
function parseTag(tag) {
	const segments = tag.split("@");
	const version = segments.pop();
	return {
		name: segments.join("@"),
		version,
		tag
	};
}
//#endregion
//#region src/def/universalize.ts
var BaseUniversalizeCommand = class extends clipanion.Command {
	static paths = [["universalize"]];
	static usage = clipanion.Command.Usage({ description: "Combile built binaries into one universal binary" });
	cwd = clipanion.Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = clipanion.Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = clipanion.Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	outputDir = clipanion.Option.String("--output-dir,-o", "./", { description: "Path to the folder where all built `.node` files put, same as `--output-dir` of build command" });
	getOptions() {
		return {
			cwd: this.cwd,
			configPath: this.configPath,
			packageJsonPath: this.packageJsonPath,
			outputDir: this.outputDir
		};
	}
};
function applyDefaultUniversalizeOptions(options) {
	return {
		cwd: process.cwd(),
		packageJsonPath: "package.json",
		outputDir: "./",
		...options
	};
}
//#endregion
//#region src/api/universalize.ts
const debug$2 = debugFactory("universalize");
function createDarwinUniversalBinary(inputs, output) {
	const result = (0, node_child_process.spawnSync)("lipo", [
		"-create",
		"-output",
		output,
		...inputs
	], { stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.signal) throw new Error(`Failed to create universal binary '${output}': lipo terminated with signal ${result.signal}.`);
	if (result.status !== 0) throw new Error(`Failed to create universal binary '${output}': lipo exited with status ${result.status}.`);
}
const universalizers = { darwin: createDarwinUniversalBinary };
async function universalizeBinaries(userOptions) {
	var _UniArchsByPlatform$p, _universalizers$proce;
	const options = applyDefaultUniversalizeOptions(userOptions);
	const config = await readNapiConfig((0, node_path.resolve)(options.cwd, options.packageJsonPath), options.configPath ? (0, node_path.resolve)(options.cwd, options.configPath) : void 0);
	if (!config.targets.find((t) => t.platform === process.platform && t.arch === "universal")) throw new Error(`'universal' arch for platform '${process.platform}' not found in config!`);
	const srcFiles = (_UniArchsByPlatform$p = UniArchsByPlatform[process.platform]) === null || _UniArchsByPlatform$p === void 0 ? void 0 : _UniArchsByPlatform$p.map((arch) => (0, node_path.resolve)(options.cwd, options.outputDir, `${config.binaryName}.${process.platform}-${arch}.node`));
	if (!srcFiles || !universalizers[process.platform]) throw new Error(`'universal' arch for platform '${process.platform}' not supported.`);
	debug$2(`Looking up source binaries to combine: `);
	debug$2("  %O", srcFiles);
	const srcFileLookup = await Promise.all(srcFiles.map((f) => fileExists(f)));
	const notFoundFiles = srcFiles.filter((_, i) => !srcFileLookup[i]);
	if (notFoundFiles.length) throw new Error(`Some binary files were not found: ${JSON.stringify(notFoundFiles)}`);
	const output = (0, node_path.resolve)(options.cwd, options.outputDir, `${config.binaryName}.${process.platform}-universal.node`);
	(_universalizers$proce = universalizers[process.platform]) === null || _universalizers$proce === void 0 || _universalizers$proce.call(universalizers, srcFiles, output);
	if (!await fileExists(output)) throw new Error(`Universal binary was not created: ${output}`);
	debug$2(`Produced universal binary: ${output}`);
}
//#endregion
//#region src/commands/artifacts.ts
var ArtifactsCommand = class extends BaseArtifactsCommand {
	static usage = clipanion.Command.Usage({
		description: "Copy artifacts from Github Actions into specified dir",
		examples: [["$0 artifacts --output-dir ./artifacts --dist ./npm", `Copy [binaryName].[platform].node under current dir(.) into packages under npm dir.
e.g: index.linux-x64-gnu.node --> ./npm/linux-x64-gnu/index.linux-x64-gnu.node`]]
	});
	static paths = [["artifacts"]];
	async execute() {
		await collectArtifacts(this.getOptions());
	}
};
//#endregion
//#region src/def/build.ts
var BaseBuildCommand = class extends clipanion.Command {
	static paths = [["build"]];
	static usage = clipanion.Command.Usage({ description: "Build the NAPI-RS project" });
	target = clipanion.Option.String("--target,-t", { description: "Build for the target triple, bypassed to `cargo build --target`" });
	cwd = clipanion.Option.String("--cwd", { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	manifestPath = clipanion.Option.String("--manifest-path", { description: "Path to `Cargo.toml`" });
	configPath = clipanion.Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = clipanion.Option.String("--package-json-path", { description: "Path to `package.json`" });
	targetDir = clipanion.Option.String("--target-dir", { description: "Directory for all crate generated artifacts, see `cargo build --target-dir`" });
	outputDir = clipanion.Option.String("--output-dir,-o", { description: "Path to where all the built files would be put. Default to the crate folder" });
	platform = clipanion.Option.Boolean("--platform", { description: "Add platform triple to the generated nodejs binding file, eg: `[name].linux-x64-gnu.node`" });
	jsPackageName = clipanion.Option.String("--js-package-name", { description: "Package name in generated js binding file. Only works with `--platform` flag" });
	constEnum = clipanion.Option.Boolean("--const-enum", { description: "Whether generate const enum for typescript bindings" });
	runtimeStringEnum = clipanion.Option.Boolean("--runtime-string-enum", { description: "Emit `#[napi(string_enum)]` enums as runtime enums (`export declare enum`) under `--no-const-enum`. Default: type-only union." });
	jsBinding = clipanion.Option.String("--js", { description: "Path and filename of generated JS binding file. Only works with `--platform` flag. Relative to `--output-dir`." });
	noJsBinding = clipanion.Option.Boolean("--no-js", { description: "Whether to disable the generation JS binding file. Only works with `--platform` flag." });
	dts = clipanion.Option.String("--dts", { description: "Path and filename of generated type def file. Relative to `--output-dir`" });
	dtsHeader = clipanion.Option.String("--dts-header", { description: "Custom file header for generated type def file. Only works when `typedef` feature enabled." });
	noDtsHeader = clipanion.Option.Boolean("--no-dts-header", { description: "Whether to disable the default file header for generated type def file. Only works when `typedef` feature enabled." });
	dtsCache = clipanion.Option.Boolean("--dts-cache", true, { description: "Whether to enable the dts cache, default to true" });
	esm = clipanion.Option.Boolean("--esm", { description: "Whether to emit an ESM JS binding file instead of CJS format. Only works with `--platform` flag." });
	strip = clipanion.Option.Boolean("--strip,-s", { description: "Whether strip the library to achieve the minimum file size" });
	release = clipanion.Option.Boolean("--release,-r", { description: "Build in release mode" });
	verbose = clipanion.Option.Boolean("--verbose,-v", { description: "Verbosely log build command trace" });
	bin = clipanion.Option.String("--bin", { description: "Build only the specified binary" });
	package = clipanion.Option.String("--package,-p", { description: "Build the specified library or the one at cwd" });
	profile = clipanion.Option.String("--profile", { description: "Build artifacts with the specified profile" });
	crossCompile = clipanion.Option.Boolean("--cross-compile,-x", { description: "[experimental] cross compile by replacing the cargo subcommand: Windows MSVC targets from a non-Windows host build with `cargo-xwin` (`windows-gnu` targets are rejected, `cargo-xwin` cannot handle them), non-Windows targets build with `cargo-zigbuild` (requires `zig` on PATH). The selected subcommand is auto-installed on first use. Cannot be combined with `--use-cross`, `--use-napi-cross` or `--watch`" });
	useCross = clipanion.Option.Boolean("--use-cross", { description: "[experimental] not recommended, prefer `--cross-compile` or `--use-napi-cross`: build in a Docker or Podman container with [cross](https://github.com/cross-rs/cross), which must be installed manually and needs a running container engine. Cannot be combined with `--cross-compile`, `--use-napi-cross` or `--watch`" });
	useNapiCross = clipanion.Option.Boolean("--use-napi-cross", { description: "[experimental] download a prebuilt gcc cross toolchain from `@napi-rs/cross-toolchain` (glibc 2.17) and set linker and C compiler environment variables. Linux glibc targets only (x64, arm64, armv7, ppc64le, s390x) on a Linux x64 or arm64 host, any other target or host errors. Cannot be combined with `--cross-compile` or `--use-cross`" });
	watch = clipanion.Option.Boolean("--watch,-w", { description: "watch the crate changes and build continuously with `cargo-watch` crates" });
	features = clipanion.Option.Array("--features,-F", { description: "Space-separated list of features to activate" });
	allFeatures = clipanion.Option.Boolean("--all-features", { description: "Activate all available features" });
	noDefaultFeatures = clipanion.Option.Boolean("--no-default-features", { description: "Do not activate the `default` feature" });
	getOptions() {
		return {
			target: this.target,
			cwd: this.cwd,
			manifestPath: this.manifestPath,
			configPath: this.configPath,
			packageJsonPath: this.packageJsonPath,
			targetDir: this.targetDir,
			outputDir: this.outputDir,
			platform: this.platform,
			jsPackageName: this.jsPackageName,
			constEnum: this.constEnum,
			runtimeStringEnum: this.runtimeStringEnum,
			jsBinding: this.jsBinding,
			noJsBinding: this.noJsBinding,
			dts: this.dts,
			dtsHeader: this.dtsHeader,
			noDtsHeader: this.noDtsHeader,
			dtsCache: this.dtsCache,
			esm: this.esm,
			strip: this.strip,
			release: this.release,
			verbose: this.verbose,
			bin: this.bin,
			package: this.package,
			profile: this.profile,
			crossCompile: this.crossCompile,
			useCross: this.useCross,
			useNapiCross: this.useNapiCross,
			watch: this.watch,
			features: this.features,
			allFeatures: this.allFeatures,
			noDefaultFeatures: this.noDefaultFeatures
		};
	}
};
//#endregion
//#region src/commands/build.ts
const debug$1 = debugFactory("build");
var BuildCommand = class extends BaseBuildCommand {
	pipe = clipanion.Option.String("--pipe", { description: "Pipe all outputs file to given command. e.g. `napi build --pipe \"npx prettier --write\"`" });
	cargoOptions = clipanion.Option.Rest();
	async execute() {
		const { task } = await buildProject({
			...this.getOptions(),
			cargoOptions: this.cargoOptions
		});
		const outputs = await task;
		if (this.pipe) for (const output of outputs) {
			debug$1("Piping output file to command: %s", this.pipe);
			try {
				(0, node_child_process.execSync)(`${this.pipe} ${output.path}`, {
					stdio: "inherit",
					cwd: this.cwd
				});
			} catch (e) {
				debug$1.error(`Failed to pipe output file ${output.path} to command`);
				debug$1.error(e);
				throw e;
			}
		}
	}
};
//#endregion
//#region src/commands/cli-version.ts
/**
* A command that prints the version of the CLI.
*
* Paths: `-v`, `--version`
*/
var CliVersionCommand = class extends clipanion.Command {
	static paths = [[`-v`], [`--version`]];
	async execute() {
		await this.context.stdout.write(`${CLI_VERSION}\n`);
	}
};
//#endregion
//#region src/commands/create-npm-dirs.ts
var CreateNpmDirsCommand = class extends BaseCreateNpmDirsCommand {
	async execute() {
		await createNpmDirs(this.getOptions());
	}
};
//#endregion
//#region src/commands/help.ts
/**
* A command that prints the usage of all commands.
*
* Paths: `-h`, `--help`
*/
var HelpCommand = class extends clipanion.Command {
	static paths = [[`-h`], [`--help`]];
	async execute() {
		await this.context.stdout.write(this.cli.usage());
	}
};
//#endregion
//#region src/commands/new.ts
const debug = debugFactory("new");
function getNapiVersionChoices() {
	return SUPPORTED_NAPI_VERSIONS.map((version) => ({
		name: `napi${version} (${napiEngineRequirement(version)})`,
		value: version
	}));
}
var NewCommand = class extends BaseNewCommand {
	interactive = clipanion.Option.Boolean("--interactive,-i", true, { description: "Ask project basic information interactively without just using the default." });
	async execute() {
		try {
			await newProject(await this.fetchOptions());
			return 0;
		} catch (e) {
			debug("Failed to create new project");
			debug.error(e);
			return 1;
		}
	}
	async fetchOptions() {
		const cmdOptions = super.getOptions();
		if (this.interactive) {
			const targetPath = cmdOptions.path ? cmdOptions.path : await inquirerProjectPath();
			cmdOptions.path = targetPath;
			return {
				...cmdOptions,
				name: await this.fetchName(node_path.default.parse(targetPath).base),
				minNodeApiVersion: await this.fetchNapiVersion(),
				targets: await this.fetchTargets(),
				license: await this.fetchLicense(),
				enableTypeDef: await this.fetchTypeDef(),
				enableGithubActions: await this.fetchGithubActions()
			};
		}
		return cmdOptions;
	}
	async fetchName(defaultName) {
		return this.$$name ?? (0, _inquirer_prompts.input)({
			message: "Package name (the name field in your package.json file)",
			default: defaultName
		});
	}
	async fetchLicense() {
		return (0, _inquirer_prompts.input)({
			message: "License for open-sourced project",
			default: this.license
		});
	}
	async fetchNapiVersion() {
		return (0, _inquirer_prompts.select)({
			message: "Minimum node-api version (with node version requirement)",
			loop: false,
			pageSize: 10,
			choices: getNapiVersionChoices(),
			default: this.minNodeApiVersion - 1
		});
	}
	async fetchTargets() {
		if (this.enableAllTargets) return AVAILABLE_TARGETS.concat();
		return await (0, _inquirer_prompts.checkbox)({
			loop: false,
			message: "Choose target(s) your crate will be compiled to",
			choices: AVAILABLE_TARGETS.map((target) => ({
				name: target,
				value: target,
				checked: DEFAULT_TARGETS.includes(target)
			}))
		});
	}
	async fetchTypeDef() {
		return await (0, _inquirer_prompts.confirm)({
			message: "Enable type definition auto-generation",
			default: this.enableTypeDef
		});
	}
	async fetchGithubActions() {
		return await (0, _inquirer_prompts.confirm)({
			message: "Enable Github Actions CI",
			default: this.enableGithubActions
		});
	}
};
async function inquirerProjectPath() {
	return (0, _inquirer_prompts.input)({ message: "Target path to create the project, relative to cwd." }).then((path) => {
		if (!path) return inquirerProjectPath();
		return path;
	});
}
//#endregion
//#region src/commands/pre-publish.ts
var PrePublishCommand = class extends BasePrePublishCommand {
	async execute() {
		await prePublish(this.getOptions());
	}
};
//#endregion
//#region src/commands/rename.ts
var RenameCommand = class extends BaseRenameCommand {
	async execute() {
		const options = this.getOptions();
		if (!options.name) options.name = await (0, _inquirer_prompts.input)({
			message: `Enter the new package name in the package.json`,
			required: true
		});
		if (!options.binaryName) options.binaryName = await (0, _inquirer_prompts.input)({
			message: `Enter the new binary name`,
			required: true
		});
		await renameProject(options);
	}
};
//#endregion
//#region src/commands/universalize.ts
var UniversalizeCommand = class extends BaseUniversalizeCommand {
	async execute() {
		await universalizeBinaries(this.getOptions());
	}
};
//#endregion
//#region src/commands/version.ts
var VersionCommand = class extends BaseVersionCommand {
	async execute() {
		await version(this.getOptions());
	}
};
//#endregion
//#region src/index.ts
const cli = new clipanion.Cli({
	binaryName: "napi",
	binaryVersion: CLI_VERSION
});
cli.register(NewCommand);
cli.register(BuildCommand);
cli.register(CreateNpmDirsCommand);
cli.register(ArtifactsCommand);
cli.register(UniversalizeCommand);
cli.register(RenameCommand);
cli.register(PrePublishCommand);
cli.register(VersionCommand);
cli.register(HelpCommand);
cli.register(CliVersionCommand);
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
var NapiCli = class {
	artifacts = collectArtifacts;
	new = newProject;
	build = buildProject;
	createNpmDirs = createNpmDirs;
	prePublish = prePublish;
	rename = renameProject;
	universalize = universalizeBinaries;
	version = version;
};
function createBuildCommand(args) {
	return cli.process(["build", ...args]);
}
function createArtifactsCommand(args) {
	return cli.process(["artifacts", ...args]);
}
function createCreateNpmDirsCommand(args) {
	return cli.process(["create-npm-dirs", ...args]);
}
function createPrePublishCommand(args) {
	return cli.process(["pre-publish", ...args]);
}
function createRenameCommand(args) {
	return cli.process(["rename", ...args]);
}
function createUniversalizeCommand(args) {
	return cli.process(["universalize", ...args]);
}
function createVersionCommand(args) {
	return cli.process(["version", ...args]);
}
function createNewCommand(args) {
	return cli.process(["new", ...args]);
}
//#endregion
exports.NapiCli = NapiCli;
exports.cli = cli;
exports.createArtifactsCommand = createArtifactsCommand;
exports.createBuildCommand = createBuildCommand;
exports.createCreateNpmDirsCommand = createCreateNpmDirsCommand;
exports.createNewCommand = createNewCommand;
exports.createPrePublishCommand = createPrePublishCommand;
exports.createRenameCommand = createRenameCommand;
exports.createUniversalizeCommand = createUniversalizeCommand;
exports.createVersionCommand = createVersionCommand;
exports.generateTypeDef = generateTypeDef;
exports.parseTriple = parseTriple;
exports.readNapiConfig = readNapiConfig;
exports.writeJsBinding = writeJsBinding;

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguY2pzIiwibmFtZXMiOlsiQ29tbWFuZCIsIk9wdGlvbiIsImNvbG9ycyIsImRlYnVnIiwicmVhZEZpbGUiLCJ3cml0ZUZpbGUiLCJ1bmxpbmsiLCJjb3B5RmlsZSIsIm1rZGlyIiwic3RhdCIsInJlYWRkaXIiLCJwaWNrIiwicGtnSnNvbi52ZXJzaW9uIiwiZGVidWciLCJmcyIsImRlYnVnIiwiY29sb3JzIiwiZGVidWciLCJyZXF1aXJlIiwiY29sb3JzIiwiQ29tbWFuZCIsIk9wdGlvbiIsInJlcXVpcmUiLCJkZWJ1ZyIsIm1rZGlyQXN5bmMiLCJyYXdNa2RpckFzeW5jIiwid3JpdGVGaWxlQXN5bmMiLCJyYXdXcml0ZUZpbGVBc3luYyIsInBpY2siLCJDb21wYXJhdG9yIiwiUmFuZ2UiLCIjcHJpbnRPYmplY3QiLCIjZm9ybWF0IiwiI2lzU2ltcGx5U2VyaWFsaXphYmxlIiwiI2RhdGVEZWNsYXJhdGlvbiIsIiNzdHJEZWNsYXJhdGlvbiIsIiNudW1iZXJEZWNsYXJhdGlvbiIsIiNib29sRGVjbGFyYXRpb24iLCIjZ2V0VHlwZU9mQXJyYXkiLCIjYXJyYXlEZWNsYXJhdGlvbiIsIiNoZWFkZXJHcm91cCIsIiNwcmludEFzSW5saW5lVmFsdWUiLCIjZGVjbGFyYXRpb24iLCIjaGVhZGVyIiwiI2FycmF5VHlwZUNhY2hlIiwiI2RvR2V0VHlwZU9mQXJyYXkiLCIjaXNQcmltaXRpdmUiLCIjcHJpbnREYXRlIiwiI3NvdXJjZSIsIiNwb3NpdGlvbiIsIiN3aGl0ZXNwYWNlIiwiam9pbiIsIm1lcmdlIiwiQ29tbWFuZCIsIk9wdGlvbiIsIndhbGsudXAiLCJDb21tYW5kIiwiT3B0aW9uIiwiaXNOaWwiLCJwYXJzZVRvbWwiLCJzdHJpbmdpZnlUb21sIiwiZmluZC5kaXIiLCJkZWJ1ZyIsInBhdGgiLCJmcyIsInBhcnNlVG9tbCIsInN0cmluZ2lmeVRvbWwiLCJDb21tYW5kIiwiT3B0aW9uIiwiQ29tbWFuZCIsIk9wdGlvbiIsImRlYnVnIiwiZGVidWciLCJPY3Rva2l0IiwiQ29tbWFuZCIsIk9wdGlvbiIsImRlYnVnIiwiQ29tbWFuZCIsIkNvbW1hbmQiLCJPcHRpb24iLCJkZWJ1ZyIsIk9wdGlvbiIsIkNvbW1hbmQiLCJDb21tYW5kIiwiT3B0aW9uIiwicGF0aCIsIkNsaSJdLCJzb3VyY2VzIjpbIi4uL3NyYy9kZWYvYXJ0aWZhY3RzLnRzIiwiLi4vc3JjL3V0aWxzL2xvZy50cyIsIi4uL3BhY2thZ2UuanNvbiIsIi4uL3NyYy91dGlscy9taXNjLnRzIiwiLi4vc3JjL3V0aWxzL3RhcmdldC50cyIsIi4uL3NyYy91dGlscy92ZXJzaW9uLnRzIiwiLi4vc3JjL3V0aWxzL21ldGFkYXRhLnRzIiwiLi4vc3JjL3V0aWxzL2NvbmZpZy50cyIsIi4uL3NyYy91dGlscy9jYXJnby50cyIsIi4uL3NyYy91dGlscy90eXBlZ2VuLnRzIiwiLi4vc3JjL3V0aWxzL3JlYWQtY29uZmlnLnRzIiwiLi4vc3JjL2FwaS9hcnRpZmFjdHMudHMiLCIuLi9zcmMvYXBpL3RlbXBsYXRlcy9qcy1iaW5kaW5nLnRzIiwiLi4vc3JjL2FwaS90ZW1wbGF0ZXMvbG9hZC13YXNpLXRlbXBsYXRlLnRzIiwiLi4vc3JjL2FwaS90ZW1wbGF0ZXMvd2FzaS13b3JrZXItdGVtcGxhdGUudHMiLCIuLi9zcmMvYXBpL2J1aWxkLnRzIiwiLi4vc3JjL2RlZi9jcmVhdGUtbnBtLWRpcnMudHMiLCIuLi9zcmMvYXBpL2NyZWF0ZS1ucG0tZGlycy50cyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ac3RkL3RvbWwvc3RyaW5naWZ5LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0Bqc3Ivc3RkX19jb2xsZWN0aW9ucy9kZWVwX21lcmdlLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0BzdGQvdG9tbC9fcGFyc2VyLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL0BzdGQvdG9tbC9wYXJzZS5qcyIsIi4uL3NyYy9kZWYvbmV3LnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2VtcGF0aGljL3Jlc29sdmUubWpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2VtcGF0aGljL3dhbGsubWpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL2VtcGF0aGljL2ZpbmQubWpzIiwiLi4vc3JjL2RlZi9yZW5hbWUudHMiLCIuLi9zcmMvYXBpL3JlbmFtZS50cyIsIi4uL3NyYy9hcGkvbmV3LnRzIiwiLi4vc3JjL2RlZi9wcmUtcHVibGlzaC50cyIsIi4uL3NyYy9kZWYvdmVyc2lvbi50cyIsIi4uL3NyYy9hcGkvdmVyc2lvbi50cyIsIi4uL3NyYy9hcGkvcHJlLXB1Ymxpc2gudHMiLCIuLi9zcmMvZGVmL3VuaXZlcnNhbGl6ZS50cyIsIi4uL3NyYy9hcGkvdW5pdmVyc2FsaXplLnRzIiwiLi4vc3JjL2NvbW1hbmRzL2FydGlmYWN0cy50cyIsIi4uL3NyYy9kZWYvYnVpbGQudHMiLCIuLi9zcmMvY29tbWFuZHMvYnVpbGQudHMiLCIuLi9zcmMvY29tbWFuZHMvY2xpLXZlcnNpb24udHMiLCIuLi9zcmMvY29tbWFuZHMvY3JlYXRlLW5wbS1kaXJzLnRzIiwiLi4vc3JjL2NvbW1hbmRzL2hlbHAudHMiLCIuLi9zcmMvY29tbWFuZHMvbmV3LnRzIiwiLi4vc3JjL2NvbW1hbmRzL3ByZS1wdWJsaXNoLnRzIiwiLi4vc3JjL2NvbW1hbmRzL3JlbmFtZS50cyIsIi4uL3NyYy9jb21tYW5kcy91bml2ZXJzYWxpemUudHMiLCIuLi9zcmMvY29tbWFuZHMvdmVyc2lvbi50cyIsIi4uL3NyYy9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBUaGlzIGZpbGUgaXMgZ2VuZXJhdGVkIGJ5IGNvZGVnZW4vaW5kZXgudHNcbi8vIERvIG5vdCBlZGl0IHRoaXMgZmlsZSBtYW51YWxseVxuaW1wb3J0IHsgQ29tbWFuZCwgT3B0aW9uIH0gZnJvbSAnY2xpcGFuaW9uJ1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZUFydGlmYWN0c0NvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcbiAgc3RhdGljIHBhdGhzID0gW1snYXJ0aWZhY3RzJ11dXG5cbiAgc3RhdGljIHVzYWdlID0gQ29tbWFuZC5Vc2FnZSh7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnQ29weSBhcnRpZmFjdHMgZnJvbSBHaXRodWIgQWN0aW9ucyBpbnRvIG5wbSBwYWNrYWdlcyBhbmQgcmVhZHkgdG8gcHVibGlzaCcsXG4gIH0pXG5cbiAgY3dkID0gT3B0aW9uLlN0cmluZygnLS1jd2QnLCBwcm9jZXNzLmN3ZCgpLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoJyxcbiAgfSlcblxuICBjb25maWdQYXRoPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1jb25maWctcGF0aCwtYycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGUnLFxuICB9KVxuXG4gIHBhY2thZ2VKc29uUGF0aCA9IE9wdGlvbi5TdHJpbmcoJy0tcGFja2FnZS1qc29uLXBhdGgnLCAncGFja2FnZS5qc29uJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgcGFja2FnZS5qc29uYCcsXG4gIH0pXG5cbiAgb3V0cHV0RGlyID0gT3B0aW9uLlN0cmluZygnLS1vdXRwdXQtZGlyLC1vLC1kJywgJy4vYXJ0aWZhY3RzJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1BhdGggdG8gdGhlIGZvbGRlciB3aGVyZSBhbGwgYnVpbHQgYC5ub2RlYCBmaWxlcyBwdXQsIHNhbWUgYXMgYC0tb3V0cHV0LWRpcmAgb2YgYnVpbGQgY29tbWFuZCcsXG4gIH0pXG5cbiAgbnBtRGlyID0gT3B0aW9uLlN0cmluZygnLS1ucG0tZGlyJywgJ25wbScsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gdGhlIGZvbGRlciB3aGVyZSB0aGUgbnBtIHBhY2thZ2VzIHB1dCcsXG4gIH0pXG5cbiAgYnVpbGRPdXRwdXREaXI/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWJ1aWxkLW91dHB1dC1kaXInLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnUGF0aCB0byB0aGUgYnVpbGQgb3V0cHV0IGRpciwgb25seSBuZWVkZWQgd2hlbiB0YXJnZXRzIGNvbnRhaW5zIGB3YXNtMzItd2FzaS0qYCcsXG4gIH0pXG5cbiAgZ2V0T3B0aW9ucygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY3dkOiB0aGlzLmN3ZCxcbiAgICAgIGNvbmZpZ1BhdGg6IHRoaXMuY29uZmlnUGF0aCxcbiAgICAgIHBhY2thZ2VKc29uUGF0aDogdGhpcy5wYWNrYWdlSnNvblBhdGgsXG4gICAgICBvdXRwdXREaXI6IHRoaXMub3V0cHV0RGlyLFxuICAgICAgbnBtRGlyOiB0aGlzLm5wbURpcixcbiAgICAgIGJ1aWxkT3V0cHV0RGlyOiB0aGlzLmJ1aWxkT3V0cHV0RGlyLFxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENvcHkgYXJ0aWZhY3RzIGZyb20gR2l0aHViIEFjdGlvbnMgaW50byBucG0gcGFja2FnZXMgYW5kIHJlYWR5IHRvIHB1Ymxpc2hcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBBcnRpZmFjdHNPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aFxuICAgKlxuICAgKiBAZGVmYXVsdCBwcm9jZXNzLmN3ZCgpXG4gICAqL1xuICBjd2Q/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICovXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gYHBhY2thZ2UuanNvbmBcbiAgICpcbiAgICogQGRlZmF1bHQgJ3BhY2thZ2UuanNvbidcbiAgICovXG4gIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIGFsbCBidWlsdCBgLm5vZGVgIGZpbGVzIHB1dCwgc2FtZSBhcyBgLS1vdXRwdXQtZGlyYCBvZiBidWlsZCBjb21tYW5kXG4gICAqXG4gICAqIEBkZWZhdWx0ICcuL2FydGlmYWN0cydcbiAgICovXG4gIG91dHB1dERpcj86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0XG4gICAqXG4gICAqIEBkZWZhdWx0ICducG0nXG4gICAqL1xuICBucG1EaXI/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gdGhlIGJ1aWxkIG91dHB1dCBkaXIsIG9ubHkgbmVlZGVkIHdoZW4gdGFyZ2V0cyBjb250YWlucyBgd2FzbTMyLXdhc2ktKmBcbiAgICovXG4gIGJ1aWxkT3V0cHV0RGlyPzogc3RyaW5nXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseURlZmF1bHRBcnRpZmFjdHNPcHRpb25zKG9wdGlvbnM6IEFydGlmYWN0c09wdGlvbnMpIHtcbiAgcmV0dXJuIHtcbiAgICBjd2Q6IHByb2Nlc3MuY3dkKCksXG4gICAgcGFja2FnZUpzb25QYXRoOiAncGFja2FnZS5qc29uJyxcbiAgICBvdXRwdXREaXI6ICcuL2FydGlmYWN0cycsXG4gICAgbnBtRGlyOiAnbnBtJyxcbiAgICAuLi5vcHRpb25zLFxuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBjb2xvcnMgZnJvbSAnY29sb3JldHRlJ1xuaW1wb3J0IHsgY3JlYXRlRGVidWcgfSBmcm9tICdvYnVnJ1xuXG5kZWNsYXJlIG1vZHVsZSAnb2J1Zycge1xuICBpbnRlcmZhY2UgRGVidWdnZXIge1xuICAgIGluZm86IHR5cGVvZiBjb25zb2xlLmVycm9yXG4gICAgd2FybjogdHlwZW9mIGNvbnNvbGUuZXJyb3JcbiAgICBlcnJvcjogdHlwZW9mIGNvbnNvbGUuZXJyb3JcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgZGVidWdGYWN0b3J5ID0gKG5hbWVzcGFjZTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGRlYnVnID0gY3JlYXRlRGVidWcoYG5hcGk6JHtuYW1lc3BhY2V9YCwge1xuICAgIGZvcm1hdHRlcnM6IHtcbiAgICAgIC8vIGRlYnVnKCclaScsICdUaGlzIGlzIGFuIGluZm8nKVxuICAgICAgaSh2KSB7XG4gICAgICAgIHJldHVybiBjb2xvcnMuZ3JlZW4odilcbiAgICAgIH0sXG4gICAgfSxcbiAgfSlcblxuICBkZWJ1Zy5pbmZvID0gKC4uLmFyZ3M6IGFueVtdKSA9PlxuICAgIGNvbnNvbGUuZXJyb3IoY29sb3JzLmJsYWNrKGNvbG9ycy5iZ0dyZWVuKCcgSU5GTyAnKSksIC4uLmFyZ3MpXG4gIGRlYnVnLndhcm4gPSAoLi4uYXJnczogYW55W10pID0+XG4gICAgY29uc29sZS5lcnJvcihjb2xvcnMuYmxhY2soY29sb3JzLmJnWWVsbG93KCcgV0FSTklORyAnKSksIC4uLmFyZ3MpXG4gIGRlYnVnLmVycm9yID0gKC4uLmFyZ3M6IGFueVtdKSA9PlxuICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICBjb2xvcnMud2hpdGUoY29sb3JzLmJnUmVkKCcgRVJST1IgJykpLFxuICAgICAgLi4uYXJncy5tYXAoKGFyZykgPT5cbiAgICAgICAgYXJnIGluc3RhbmNlb2YgRXJyb3IgPyAoYXJnLnN0YWNrID8/IGFyZy5tZXNzYWdlKSA6IGFyZyxcbiAgICAgICksXG4gICAgKVxuXG4gIHJldHVybiBkZWJ1Z1xufVxuZXhwb3J0IGNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCd1dGlscycpXG4iLCIiLCJpbXBvcnQge1xuICByZWFkRmlsZSxcbiAgd3JpdGVGaWxlLFxuICB1bmxpbmssXG4gIGNvcHlGaWxlLFxuICBta2RpcixcbiAgc3RhdCxcbiAgcmVhZGRpcixcbiAgYWNjZXNzLFxufSBmcm9tICdub2RlOmZzL3Byb21pc2VzJ1xuXG5pbXBvcnQgcGtnSnNvbiBmcm9tICcuLi8uLi9wYWNrYWdlLmpzb24nIHdpdGggeyB0eXBlOiAnanNvbicgfVxuaW1wb3J0IHsgZGVidWcgfSBmcm9tICcuL2xvZy5qcydcblxuZXhwb3J0IGNvbnN0IHJlYWRGaWxlQXN5bmMgPSByZWFkRmlsZVxuZXhwb3J0IGNvbnN0IHdyaXRlRmlsZUFzeW5jID0gd3JpdGVGaWxlXG5leHBvcnQgY29uc3QgdW5saW5rQXN5bmMgPSB1bmxpbmtcbmV4cG9ydCBjb25zdCBjb3B5RmlsZUFzeW5jID0gY29weUZpbGVcbmV4cG9ydCBjb25zdCBta2RpckFzeW5jID0gbWtkaXJcbmV4cG9ydCBjb25zdCBzdGF0QXN5bmMgPSBzdGF0XG5leHBvcnQgY29uc3QgcmVhZGRpckFzeW5jID0gcmVhZGRpclxuXG5leHBvcnQgZnVuY3Rpb24gZmlsZUV4aXN0cyhwYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgcmV0dXJuIGFjY2VzcyhwYXRoKS50aGVuKFxuICAgICgpID0+IHRydWUsXG4gICAgKCkgPT4gZmFsc2UsXG4gIClcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRpckV4aXN0c0FzeW5jKHBhdGg6IHN0cmluZykge1xuICB0cnkge1xuICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgc3RhdEFzeW5jKHBhdGgpXG4gICAgcmV0dXJuIHN0YXRzLmlzRGlyZWN0b3J5KClcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBpY2s8TywgSyBleHRlbmRzIGtleW9mIE8+KG86IE8sIC4uLmtleXM6IEtbXSk6IFBpY2s8TywgSz4ge1xuICByZXR1cm4ga2V5cy5yZWR1Y2UoKGFjYywga2V5KSA9PiB7XG4gICAgYWNjW2tleV0gPSBvW2tleV1cbiAgICByZXR1cm4gYWNjXG4gIH0sIHt9IGFzIE8pXG59XG5cbmZ1bmN0aW9uIGlzUGxhaW5PYmplY3QodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgcmV0dXJuIHZhbHVlICE9PSBudWxsICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkodmFsdWUpXG59XG5cbmZ1bmN0aW9uIG1lcmdlUGFja2FnZUpzb24oXG4gIG9sZDogUmVjb3JkPHN0cmluZywgYW55PixcbiAgcGFydGlhbDogUmVjb3JkPHN0cmluZywgYW55Pixcbik6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICBjb25zdCBtZXJnZWQgPSB7IC4uLm9sZCB9XG5cbiAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMocGFydGlhbCkpIHtcbiAgICBpZiAoaXNQbGFpbk9iamVjdChtZXJnZWRba2V5XSkgJiYgaXNQbGFpbk9iamVjdCh2YWx1ZSkpIHtcbiAgICAgIG1lcmdlZFtrZXldID0gbWVyZ2VQYWNrYWdlSnNvbihtZXJnZWRba2V5XSwgdmFsdWUpXG4gICAgfSBlbHNlIHtcbiAgICAgIG1lcmdlZFtrZXldID0gdmFsdWVcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWVyZ2VkXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB1cGRhdGVQYWNrYWdlSnNvbihcbiAgcGF0aDogc3RyaW5nLFxuICBwYXJ0aWFsOiBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuKSB7XG4gIGNvbnN0IGV4aXN0cyA9IGF3YWl0IGZpbGVFeGlzdHMocGF0aClcbiAgaWYgKCFleGlzdHMpIHtcbiAgICBkZWJ1ZyhgRmlsZSBub3QgZXhpc3RzICR7cGF0aH1gKVxuICAgIHJldHVyblxuICB9XG4gIGNvbnN0IG9sZCA9IEpTT04ucGFyc2UoYXdhaXQgcmVhZEZpbGVBc3luYyhwYXRoLCAndXRmOCcpKVxuICBhd2FpdCB3cml0ZUZpbGVBc3luYyhcbiAgICBwYXRoLFxuICAgIEpTT04uc3RyaW5naWZ5KG1lcmdlUGFja2FnZUpzb24ob2xkLCBwYXJ0aWFsKSwgbnVsbCwgMiksXG4gIClcbn1cblxuZXhwb3J0IGNvbnN0IENMSV9WRVJTSU9OID0gcGtnSnNvbi52ZXJzaW9uXG4iLCJpbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ25vZGU6Y2hpbGRfcHJvY2VzcydcblxuZXhwb3J0IHR5cGUgUGxhdGZvcm0gPSBOb2RlSlMuUGxhdGZvcm0gfCAnd2FzbScgfCAnd2FzaScgfCAnb3Blbmhhcm1vbnknXG5cbmV4cG9ydCBjb25zdCBVTklWRVJTQUxfVEFSR0VUUyA9IHtcbiAgJ3VuaXZlcnNhbC1hcHBsZS1kYXJ3aW4nOiBbJ2FhcmNoNjQtYXBwbGUtZGFyd2luJywgJ3g4Nl82NC1hcHBsZS1kYXJ3aW4nXSxcbn0gYXMgY29uc3RcblxuY29uc3QgU1VCX1NZU1RFTVMgPSBuZXcgU2V0KFsnYW5kcm9pZCcsICdvaG9zJ10pXG5cbmV4cG9ydCBjb25zdCBBVkFJTEFCTEVfVEFSR0VUUyA9IFtcbiAgJ2FhcmNoNjQtYXBwbGUtZGFyd2luJyxcbiAgJ2FhcmNoNjQtbGludXgtYW5kcm9pZCcsXG4gICdhYXJjaDY0LXVua25vd24tbGludXgtZ251JyxcbiAgJ2FhcmNoNjQtdW5rbm93bi1saW51eC1tdXNsJyxcbiAgJ2FhcmNoNjQtdW5rbm93bi1saW51eC1vaG9zJyxcbiAgJ2FhcmNoNjQtcGMtd2luZG93cy1tc3ZjJyxcbiAgJ3g4Nl82NC1hcHBsZS1kYXJ3aW4nLFxuICAneDg2XzY0LXBjLXdpbmRvd3MtbXN2YycsXG4gICd4ODZfNjQtcGMtd2luZG93cy1nbnUnLFxuICAneDg2XzY0LXVua25vd24tbGludXgtZ251JyxcbiAgJ3g4Nl82NC11bmtub3duLWxpbnV4LW11c2wnLFxuICAneDg2XzY0LXVua25vd24tbGludXgtb2hvcycsXG4gICd4ODZfNjQtdW5rbm93bi1mcmVlYnNkJyxcbiAgJ2k2ODYtcGMtd2luZG93cy1tc3ZjJyxcbiAgJ2FybXY3LXVua25vd24tbGludXgtZ251ZWFiaWhmJyxcbiAgJ2FybXY3LXVua25vd24tbGludXgtbXVzbGVhYmloZicsXG4gICdhcm12Ny1saW51eC1hbmRyb2lkZWFiaScsXG4gICd1bml2ZXJzYWwtYXBwbGUtZGFyd2luJyxcbiAgJ2xvb25nYXJjaDY0LXVua25vd24tbGludXgtZ251JyxcbiAgJ3Jpc2N2NjRnYy11bmtub3duLWxpbnV4LWdudScsXG4gICdwb3dlcnBjNjRsZS11bmtub3duLWxpbnV4LWdudScsXG4gICdzMzkweC11bmtub3duLWxpbnV4LWdudScsXG4gICd3YXNtMzItd2FzaS1wcmV2aWV3MS10aHJlYWRzJyxcbiAgJ3dhc20zMi13YXNpcDEtdGhyZWFkcycsXG5dIGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFRhcmdldFRyaXBsZSA9ICh0eXBlb2YgQVZBSUxBQkxFX1RBUkdFVFMpW251bWJlcl1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfVEFSR0VUUyA9IFtcbiAgJ3g4Nl82NC1hcHBsZS1kYXJ3aW4nLFxuICAnYWFyY2g2NC1hcHBsZS1kYXJ3aW4nLFxuICAneDg2XzY0LXBjLXdpbmRvd3MtbXN2YycsXG4gICd4ODZfNjQtdW5rbm93bi1saW51eC1nbnUnLFxuXSBhcyBjb25zdFxuXG5leHBvcnQgY29uc3QgVEFSR0VUX0xJTktFUjogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgJ2FhcmNoNjQtdW5rbm93bi1saW51eC1tdXNsJzogJ2FhcmNoNjQtbGludXgtbXVzbC1nY2MnLFxuICAvLyBUT0RPOiBTd2l0Y2ggdG8gbG9vbmdhcmNoNjQtbGludXgtZ251LWdjYyB3aGVuIGF2YWlsYWJsZVxuICAnbG9vbmdhcmNoNjQtdW5rbm93bi1saW51eC1nbnUnOiAnbG9vbmdhcmNoNjQtbGludXgtZ251LWdjYy0xMycsXG4gICdyaXNjdjY0Z2MtdW5rbm93bi1saW51eC1nbnUnOiAncmlzY3Y2NC1saW51eC1nbnUtZ2NjJyxcbiAgJ3Bvd2VycGM2NGxlLXVua25vd24tbGludXgtZ251JzogJ3Bvd2VycGM2NGxlLWxpbnV4LWdudS1nY2MnLFxuICAnczM5MHgtdW5rbm93bi1saW51eC1nbnUnOiAnczM5MHgtbGludXgtZ251LWdjYycsXG59XG5cbi8vIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvcHJvY2Vzcy5odG1sI3Byb2Nlc3NfcHJvY2Vzc19hcmNoXG50eXBlIE5vZGVKU0FyY2ggPVxuICB8ICdhcm0nXG4gIHwgJ2FybTY0J1xuICB8ICdpYTMyJ1xuICB8ICdsb29uZzY0J1xuICB8ICdtaXBzJ1xuICB8ICdtaXBzZWwnXG4gIHwgJ3BwYydcbiAgfCAncHBjNjQnXG4gIHwgJ3Jpc2N2NjQnXG4gIHwgJ3MzOTAnXG4gIHwgJ3MzOTB4J1xuICB8ICd4MzInXG4gIHwgJ3g2NCdcbiAgfCAndW5pdmVyc2FsJ1xuICB8ICd3YXNtMzInXG5cbmNvbnN0IENwdVRvTm9kZUFyY2g6IFJlY29yZDxzdHJpbmcsIE5vZGVKU0FyY2g+ID0ge1xuICB4ODZfNjQ6ICd4NjQnLFxuICBhYXJjaDY0OiAnYXJtNjQnLFxuICBpNjg2OiAnaWEzMicsXG4gIGFybXY3OiAnYXJtJyxcbiAgbG9vbmdhcmNoNjQ6ICdsb29uZzY0JyxcbiAgcmlzY3Y2NGdjOiAncmlzY3Y2NCcsXG4gIHBvd2VycGM2NGxlOiAncHBjNjQnLFxufVxuXG5leHBvcnQgY29uc3QgTm9kZUFyY2hUb0NwdTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgeDY0OiAneDg2XzY0JyxcbiAgYXJtNjQ6ICdhYXJjaDY0JyxcbiAgaWEzMjogJ2k2ODYnLFxuICBhcm06ICdhcm12NycsXG4gIGxvb25nNjQ6ICdsb29uZ2FyY2g2NCcsXG4gIHJpc2N2NjQ6ICdyaXNjdjY0Z2MnLFxuICBwcGM2NDogJ3Bvd2VycGM2NGxlJyxcbn1cblxuY29uc3QgU3lzVG9Ob2RlUGxhdGZvcm06IFJlY29yZDxzdHJpbmcsIFBsYXRmb3JtPiA9IHtcbiAgbGludXg6ICdsaW51eCcsXG4gIGZyZWVic2Q6ICdmcmVlYnNkJyxcbiAgZGFyd2luOiAnZGFyd2luJyxcbiAgd2luZG93czogJ3dpbjMyJyxcbiAgb2hvczogJ29wZW5oYXJtb255Jyxcbn1cblxuZXhwb3J0IGNvbnN0IFVuaUFyY2hzQnlQbGF0Zm9ybTogUGFydGlhbDxSZWNvcmQ8UGxhdGZvcm0sIE5vZGVKU0FyY2hbXT4+ID0ge1xuICBkYXJ3aW46IFsneDY0JywgJ2FybTY0J10sXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFyZ2V0IHtcbiAgdHJpcGxlOiBzdHJpbmdcbiAgcGxhdGZvcm1BcmNoQUJJOiBzdHJpbmdcbiAgcGxhdGZvcm06IFBsYXRmb3JtXG4gIGFyY2g6IE5vZGVKU0FyY2hcbiAgYWJpOiBzdHJpbmcgfCBudWxsXG59XG5cbi8qKlxuICogQSB0cmlwbGUgaXMgYSBzcGVjaWZpYyBmb3JtYXQgZm9yIHNwZWNpZnlpbmcgYSB0YXJnZXQgYXJjaGl0ZWN0dXJlLlxuICogVHJpcGxlcyBtYXkgYmUgcmVmZXJyZWQgdG8gYXMgYSB0YXJnZXQgdHJpcGxlIHdoaWNoIGlzIHRoZSBhcmNoaXRlY3R1cmUgZm9yIHRoZSBhcnRpZmFjdCBwcm9kdWNlZCwgYW5kIHRoZSBob3N0IHRyaXBsZSB3aGljaCBpcyB0aGUgYXJjaGl0ZWN0dXJlIHRoYXQgdGhlIGNvbXBpbGVyIGlzIHJ1bm5pbmcgb24uXG4gKiBUaGUgZ2VuZXJhbCBmb3JtYXQgb2YgdGhlIHRyaXBsZSBpcyBgPGFyY2g+PHN1Yj4tPHZlbmRvcj4tPHN5cz4tPGFiaT5gIHdoZXJlOlxuICogICAtIGBhcmNoYCA9IFRoZSBiYXNlIENQVSBhcmNoaXRlY3R1cmUsIGZvciBleGFtcGxlIGB4ODZfNjRgLCBgaTY4NmAsIGBhcm1gLCBgdGh1bWJgLCBgbWlwc2AsIGV0Yy5cbiAqICAgLSBgc3ViYCA9IFRoZSBDUFUgc3ViLWFyY2hpdGVjdHVyZSwgZm9yIGV4YW1wbGUgYGFybWAgaGFzIGB2N2AsIGB2N3NgLCBgdjV0ZWAsIGV0Yy5cbiAqICAgLSBgdmVuZG9yYCA9IFRoZSB2ZW5kb3IsIGZvciBleGFtcGxlIGB1bmtub3duYCwgYGFwcGxlYCwgYHBjYCwgYG52aWRpYWAsIGV0Yy5cbiAqICAgLSBgc3lzYCA9IFRoZSBzeXN0ZW0gbmFtZSwgZm9yIGV4YW1wbGUgYGxpbnV4YCwgYHdpbmRvd3NgLCBgZGFyd2luYCwgZXRjLiBub25lIGlzIHR5cGljYWxseSB1c2VkIGZvciBiYXJlLW1ldGFsIHdpdGhvdXQgYW4gT1MuXG4gKiAgIC0gYGFiaWAgPSBUaGUgQUJJLCBmb3IgZXhhbXBsZSBgZ251YCwgYGFuZHJvaWRgLCBgZWFiaWAsIGV0Yy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVHJpcGxlKHJhd1RyaXBsZTogc3RyaW5nKTogVGFyZ2V0IHtcbiAgaWYgKFxuICAgIHJhd1RyaXBsZSA9PT0gJ3dhc20zMi13YXNpJyB8fFxuICAgIHJhd1RyaXBsZSA9PT0gJ3dhc20zMi13YXNpLXByZXZpZXcxLXRocmVhZHMnIHx8XG4gICAgcmF3VHJpcGxlLnN0YXJ0c1dpdGgoJ3dhc20zMi13YXNpcCcpXG4gICkge1xuICAgIHJldHVybiB7XG4gICAgICB0cmlwbGU6IHJhd1RyaXBsZSxcbiAgICAgIHBsYXRmb3JtQXJjaEFCSTogJ3dhc20zMi13YXNpJyxcbiAgICAgIHBsYXRmb3JtOiAnd2FzaScsXG4gICAgICBhcmNoOiAnd2FzbTMyJyxcbiAgICAgIGFiaTogJ3dhc2knLFxuICAgIH1cbiAgfVxuICBjb25zdCB0cmlwbGUgPSByYXdUcmlwbGUuZW5kc1dpdGgoJ2VhYmknKVxuICAgID8gYCR7cmF3VHJpcGxlLnNsaWNlKDAsIC00KX0tZWFiaWBcbiAgICA6IHJhd1RyaXBsZVxuICBjb25zdCB0cmlwbGVzID0gdHJpcGxlLnNwbGl0KCctJylcbiAgbGV0IGNwdTogc3RyaW5nXG4gIGxldCBzeXM6IHN0cmluZ1xuICBsZXQgYWJpOiBzdHJpbmcgfCBudWxsID0gbnVsbFxuICBpZiAodHJpcGxlcy5sZW5ndGggPT09IDIpIHtcbiAgICAvLyBhYXJjaDY0LWZ1Y2hzaWFcbiAgICAvLyBeIGNwdSAgIF4gc3lzXG4gICAgO1tjcHUsIHN5c10gPSB0cmlwbGVzXG4gIH0gZWxzZSB7XG4gICAgLy8gYWFyY2g2NC11bmtub3duLWxpbnV4LW11c2xcbiAgICAvLyBeIGNwdSAgIF52ZW5kb3IgXiBzeXMgXiBhYmlcbiAgICAvLyBhYXJjaDY0LWFwcGxlLWRhcndpblxuICAgIC8vIF4gY3B1ICAgICAgICAgXiBzeXMgIChhYmkgaXMgTm9uZSlcbiAgICA7W2NwdSwgLCBzeXMsIGFiaSA9IG51bGxdID0gdHJpcGxlc1xuICB9XG5cbiAgaWYgKGFiaSAmJiBTVUJfU1lTVEVNUy5oYXMoYWJpKSkge1xuICAgIHN5cyA9IGFiaVxuICAgIGFiaSA9IG51bGxcbiAgfVxuICBjb25zdCBwbGF0Zm9ybSA9IFN5c1RvTm9kZVBsYXRmb3JtW3N5c10gPz8gKHN5cyBhcyBQbGF0Zm9ybSlcbiAgY29uc3QgYXJjaCA9IENwdVRvTm9kZUFyY2hbY3B1XSA/PyAoY3B1IGFzIE5vZGVKU0FyY2gpXG5cbiAgcmV0dXJuIHtcbiAgICB0cmlwbGU6IHJhd1RyaXBsZSxcbiAgICBwbGF0Zm9ybUFyY2hBQkk6IGFiaSA/IGAke3BsYXRmb3JtfS0ke2FyY2h9LSR7YWJpfWAgOiBgJHtwbGF0Zm9ybX0tJHthcmNofWAsXG4gICAgcGxhdGZvcm0sXG4gICAgYXJjaCxcbiAgICBhYmksXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN5c3RlbURlZmF1bHRUYXJnZXQoKTogVGFyZ2V0IHtcbiAgY29uc3QgaG9zdCA9IGV4ZWNTeW5jKGBydXN0YyAtdlZgLCB7XG4gICAgZW52OiBwcm9jZXNzLmVudixcbiAgfSlcbiAgICAudG9TdHJpbmcoJ3V0ZjgnKVxuICAgIC5zcGxpdCgnXFxuJylcbiAgICAuZmluZCgobGluZSkgPT4gbGluZS5zdGFydHNXaXRoKCdob3N0OiAnKSlcbiAgY29uc3QgdHJpcGxlID0gaG9zdD8uc2xpY2UoJ2hvc3Q6ICcubGVuZ3RoKVxuICBpZiAoIXRyaXBsZSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYENhbiBub3QgcGFyc2UgdGFyZ2V0IHRyaXBsZSBmcm9tIGhvc3RgKVxuICB9XG4gIHJldHVybiBwYXJzZVRyaXBsZSh0cmlwbGUpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRUYXJnZXRMaW5rZXIodGFyZ2V0OiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICByZXR1cm4gVEFSR0VUX0xJTktFUlt0YXJnZXRdXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0YXJnZXRUb0VudlZhcih0YXJnZXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB0YXJnZXQucmVwbGFjZSgvLS9nLCAnXycpLnRvVXBwZXJDYXNlKClcbn1cbiIsImV4cG9ydCBlbnVtIE5hcGlWZXJzaW9uIHtcbiAgTmFwaTEgPSAxLFxuICBOYXBpMixcbiAgTmFwaTMsXG4gIE5hcGk0LFxuICBOYXBpNSxcbiAgTmFwaTYsXG4gIE5hcGk3LFxuICBOYXBpOCxcbiAgTmFwaTksXG4gIE5hcGkxMCxcbn1cblxuLy8vIGJlY2F1c2Ugbm9kZSBzdXBwb3J0IG5ldyBuYXBpIHZlcnNpb24gaW4gc29tZSBtaW5vciB2ZXJzaW9uIHVwZGF0ZXMsIHNvIHdlIG1pZ2h0IG1lZXQgc3VjaCBzaXR1YXRpb246XG4vLy8gYG5vZGUgdjEwLjIwLjBgIHN1cHBvcnRzIGBuYXBpNWAgYW5kIGBuYXBpNmAsIGJ1dCBgbm9kZSB2MTIuMC4wYCBvbmx5IHN1cHBvcnQgYG5hcGk0YCxcbi8vLyBieSB3aGljaCwgd2UgY2FuIG5vdCB0ZWxsIGRpcmVjdGx5IG5hcGkgdmVyc2lvbiBzdXBwb3J0bGVzcyBmcm9tIG5vZGUgdmVyc2lvbiBkaXJlY3RseS5cbmNvbnN0IE5BUElfVkVSU0lPTl9NQVRSSVggPSBuZXcgTWFwPE5hcGlWZXJzaW9uLCBzdHJpbmc+KFtcbiAgW05hcGlWZXJzaW9uLk5hcGkxLCAnOC42LjAgfCA5LjAuMCB8IDEwLjAuMCddLFxuICBbTmFwaVZlcnNpb24uTmFwaTIsICc4LjEwLjAgfCA5LjMuMCB8IDEwLjAuMCddLFxuICBbTmFwaVZlcnNpb24uTmFwaTMsICc2LjE0LjIgfCA4LjExLjIgfCA5LjExLjAgfCAxMC4wLjAnXSxcbiAgW05hcGlWZXJzaW9uLk5hcGk0LCAnMTAuMTYuMCB8IDExLjguMCB8IDEyLjAuMCddLFxuICBbTmFwaVZlcnNpb24uTmFwaTUsICcxMC4xNy4wIHwgMTIuMTEuMCB8IDEzLjAuMCddLFxuICBbTmFwaVZlcnNpb24uTmFwaTYsICcxMC4yMC4wIHwgMTIuMTcuMCB8IDE0LjAuMCddLFxuICBbTmFwaVZlcnNpb24uTmFwaTcsICcxMC4yMy4wIHwgMTIuMTkuMCB8IDE0LjEyLjAgfCAxNS4wLjAnXSxcbiAgW05hcGlWZXJzaW9uLk5hcGk4LCAnMTIuMjIuMCB8IDE0LjE3LjAgfCAxNS4xMi4wIHwgMTYuMC4wJ10sXG4gIFtOYXBpVmVyc2lvbi5OYXBpOSwgJzE4LjE3LjAgfCAyMC4zLjAgfCAyMS4xLjAnXSxcbiAgW05hcGlWZXJzaW9uLk5hcGkxMCwgJzIyLjE0LjAgfCAyMy42LjAnXSxcbl0pXG5cbmV4cG9ydCBjb25zdCBTVVBQT1JURURfTkFQSV9WRVJTSU9OUyA9IE9iamVjdC52YWx1ZXMoTmFwaVZlcnNpb24pLmZpbHRlcihcbiAgKHYpOiB2IGlzIE5hcGlWZXJzaW9uID0+IHR5cGVvZiB2ID09PSAnbnVtYmVyJyxcbilcblxuaW50ZXJmYWNlIE5vZGVWZXJzaW9uIHtcbiAgbWFqb3I6IG51bWJlclxuICBtaW5vcjogbnVtYmVyXG4gIHBhdGNoOiBudW1iZXJcbn1cblxuZnVuY3Rpb24gcGFyc2VOb2RlVmVyc2lvbih2OiBzdHJpbmcpOiBOb2RlVmVyc2lvbiB7XG4gIGNvbnN0IG1hdGNoZXMgPSB2Lm1hdGNoKC92PyhbMC05XSspXFwuKFswLTldKylcXC4oWzAtOV0rKS9pKVxuXG4gIGlmICghbWF0Y2hlcykge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBub2RlIHZlcnNpb24gbnVtYmVyOiAnICsgdilcbiAgfVxuXG4gIGNvbnN0IFssIG1ham9yLCBtaW5vciwgcGF0Y2hdID0gbWF0Y2hlc1xuXG4gIHJldHVybiB7XG4gICAgbWFqb3I6IHBhcnNlSW50KG1ham9yKSxcbiAgICBtaW5vcjogcGFyc2VJbnQobWlub3IpLFxuICAgIHBhdGNoOiBwYXJzZUludChwYXRjaCksXG4gIH1cbn1cblxuZnVuY3Rpb24gcmVxdWlyZWROb2RlVmVyc2lvbnMobmFwaVZlcnNpb246IE5hcGlWZXJzaW9uKTogTm9kZVZlcnNpb25bXSB7XG4gIGNvbnN0IHJlcXVpcmVtZW50ID0gTkFQSV9WRVJTSU9OX01BVFJJWC5nZXQobmFwaVZlcnNpb24pXG5cbiAgaWYgKCFyZXF1aXJlbWVudCkge1xuICAgIHJldHVybiBbcGFyc2VOb2RlVmVyc2lvbignMTAuMC4wJyldXG4gIH1cblxuICByZXR1cm4gcmVxdWlyZW1lbnQuc3BsaXQoJ3wnKS5tYXAocGFyc2VOb2RlVmVyc2lvbilcbn1cblxuZnVuY3Rpb24gdG9FbmdpbmVSZXF1aXJlbWVudCh2ZXJzaW9uczogTm9kZVZlcnNpb25bXSk6IHN0cmluZyB7XG4gIGNvbnN0IHJlcXVpcmVtZW50czogc3RyaW5nW10gPSBbXVxuICB2ZXJzaW9ucy5mb3JFYWNoKCh2LCBpKSA9PiB7XG4gICAgbGV0IHJlcSA9ICcnXG4gICAgaWYgKGkgIT09IDApIHtcbiAgICAgIGNvbnN0IGxhc3RWZXJzaW9uID0gdmVyc2lvbnNbaSAtIDFdXG4gICAgICByZXEgKz0gYDwgJHtsYXN0VmVyc2lvbi5tYWpvciArIDF9YFxuICAgIH1cblxuICAgIHJlcSArPSBgJHtpID09PSAwID8gJycgOiAnIHx8ICd9Pj0gJHt2Lm1ham9yfS4ke3YubWlub3J9LiR7di5wYXRjaH1gXG4gICAgcmVxdWlyZW1lbnRzLnB1c2gocmVxKVxuICB9KVxuXG4gIHJldHVybiByZXF1aXJlbWVudHMuam9pbignICcpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuYXBpRW5naW5lUmVxdWlyZW1lbnQobmFwaVZlcnNpb246IE5hcGlWZXJzaW9uKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRvRW5naW5lUmVxdWlyZW1lbnQocmVxdWlyZWROb2RlVmVyc2lvbnMobmFwaVZlcnNpb24pKVxufVxuIiwiaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcydcblxuaW1wb3J0IHsgZGVidWdGYWN0b3J5IH0gZnJvbSAnLi9sb2cuanMnXG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCdtZXRhZGF0YScpXG5cbmV4cG9ydCB0eXBlIENyYXRlVGFyZ2V0S2luZCA9XG4gIHwgJ2JpbidcbiAgfCAnZXhhbXBsZSdcbiAgfCAndGVzdCdcbiAgfCAnYmVuY2gnXG4gIHwgJ2xpYidcbiAgfCAncmxpYidcbiAgfCAnY2R5bGliJ1xuICB8ICdjdXN0b20tYnVpbGQnXG5cbmV4cG9ydCBpbnRlcmZhY2UgQ3JhdGVUYXJnZXQge1xuICBuYW1lOiBzdHJpbmdcbiAga2luZDogQ3JhdGVUYXJnZXRLaW5kW11cbiAgY3JhdGVfdHlwZXM6IENyYXRlVGFyZ2V0S2luZFtdXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ3JhdGUge1xuICBpZDogc3RyaW5nXG4gIG5hbWU6IHN0cmluZ1xuICBzcmNfcGF0aDogc3RyaW5nXG4gIHZlcnNpb246IHN0cmluZ1xuICBlZGl0aW9uOiBzdHJpbmdcbiAgdGFyZ2V0czogQ3JhdGVUYXJnZXRbXVxuICBmZWF0dXJlczogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+XG4gIG1hbmlmZXN0X3BhdGg6IHN0cmluZ1xuICBkZXBlbmRlbmNpZXM6IEFycmF5PHtcbiAgICBuYW1lOiBzdHJpbmdcbiAgICBzb3VyY2U6IHN0cmluZ1xuICAgIHJlcTogc3RyaW5nXG4gICAga2luZDogc3RyaW5nIHwgbnVsbFxuICAgIHJlbmFtZTogc3RyaW5nIHwgbnVsbFxuICAgIG9wdGlvbmFsOiBib29sZWFuXG4gICAgdXNlc19kZWZhdWx0X2ZlYXR1cmVzOiBib29sZWFuXG4gICAgZmVhdHVyZXM6IHN0cmluZ1tdXG4gICAgdGFyZ2V0OiBzdHJpbmcgfCBudWxsXG4gICAgcmVnaXN0cnk6IHN0cmluZyB8IG51bGxcbiAgfT5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBDcmF0ZVJlc29sdmVOb2RlIHtcbiAgaWQ6IHN0cmluZ1xuICBkZXBzOiBBcnJheTx7XG4gICAgbmFtZTogc3RyaW5nXG4gICAgcGtnOiBzdHJpbmdcbiAgfT5cbiAgZmVhdHVyZXM6IHN0cmluZ1tdXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FyZ29Xb3Jrc3BhY2VNZXRhZGF0YSB7XG4gIHZlcnNpb246IG51bWJlclxuICBwYWNrYWdlczogQ3JhdGVbXVxuICB3b3Jrc3BhY2VfbWVtYmVyczogc3RyaW5nW11cbiAgdGFyZ2V0X2RpcmVjdG9yeTogc3RyaW5nXG4gIHdvcmtzcGFjZV9yb290OiBzdHJpbmdcbiAgcmVzb2x2ZT86IHtcbiAgICBub2RlczogQ3JhdGVSZXNvbHZlTm9kZVtdXG4gICAgcm9vdDogc3RyaW5nIHwgbnVsbFxuICB9IHwgbnVsbFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENhcmdvRmVhdHVyZU9wdGlvbnMge1xuICBmZWF0dXJlcz86IHN0cmluZ1tdXG4gIGFsbEZlYXR1cmVzPzogYm9vbGVhblxuICBub0RlZmF1bHRGZWF0dXJlcz86IGJvb2xlYW5cbn1cblxuLy8gQ3JhdGVzIHRoYXQgd2lsbCBhY3R1YWxseSBjb21waWxlIGBuYXBpLWRlcml2ZWAgaW4gdGhpcyBidWlsZCwgYW5kIGFyZSB0aGVyZWZvcmVcbi8vIGV4cGVjdGVkIHRvIGVtaXQgYSB0eXBlLWRlZiBpbnRlcm1lZGlhdGUgZmlsZS4gUHJlZmVyIHRoZSByZXNvbHZlZCBkZXBlbmRlbmN5IGdyYXBoOlxuLy8gYSBjcmF0ZSB3aG9zZSBgbmFwaS1kZXJpdmVgIGRlcGVuZGVuY3kgaXMgb3B0aW9uYWwgYW5kIHN0YXlzIGRpc2FibGVkIG5ldmVyIGVtaXRzIGFcbi8vIHR5cGUtZGVmIGZpbGUsIHNvIGZvcmNlLWJ1aWxkaW5nIGl0IHdvdWxkIGludmFsaWRhdGUgY2FyZ28ncyBmaW5nZXJwcmludCBvbiBldmVyeVxuLy8gYnVpbGQgd2l0aG91dCBldmVyIHNhdGlzZnlpbmcgdGhlIHR5cGUtZGVmIGNoZWNrLiBGYWxsIGJhY2sgdG8gZGVjbGFyZWQgZGVwZW5kZW5jaWVzXG4vLyB3aGVuIHRoZSByZXNvbHZlIGdyYXBoIGlzIHVuYXZhaWxhYmxlLlxuZXhwb3J0IGZ1bmN0aW9uIGdldE5hcGlEZXJpdmVEZXBlbmRlbnRDcmF0ZXMoXG4gIG1ldGFkYXRhOiBDYXJnb1dvcmtzcGFjZU1ldGFkYXRhLFxuKTogQ3JhdGVbXSB7XG4gIGNvbnN0IHJlc29sdmVOb2RlcyA9IG1ldGFkYXRhLnJlc29sdmU/Lm5vZGVzXG4gIGlmICghcmVzb2x2ZU5vZGVzKSB7XG4gICAgcmV0dXJuIG1ldGFkYXRhLnBhY2thZ2VzLmZpbHRlcigoY3JhdGUpID0+XG4gICAgICBjcmF0ZS5kZXBlbmRlbmNpZXMuc29tZSgoZCkgPT4gZC5uYW1lID09PSAnbmFwaS1kZXJpdmUnKSxcbiAgICApXG4gIH1cbiAgY29uc3QgbmFwaURlcml2ZVBhY2thZ2VJZHMgPSBuZXcgU2V0KFxuICAgIG1ldGFkYXRhLnBhY2thZ2VzLmZpbHRlcigocCkgPT4gcC5uYW1lID09PSAnbmFwaS1kZXJpdmUnKS5tYXAoKHApID0+IHAuaWQpLFxuICApXG4gIGNvbnN0IGRlcGVuZGVudFBhY2thZ2VJZHMgPSBuZXcgU2V0KFxuICAgIHJlc29sdmVOb2Rlc1xuICAgICAgLmZpbHRlcigobm9kZSkgPT5cbiAgICAgICAgbm9kZS5kZXBzLnNvbWUoKGRlcCkgPT4gbmFwaURlcml2ZVBhY2thZ2VJZHMuaGFzKGRlcC5wa2cpKSxcbiAgICAgIClcbiAgICAgIC5tYXAoKG5vZGUpID0+IG5vZGUuaWQpLFxuICApXG4gIHJldHVybiBtZXRhZGF0YS5wYWNrYWdlcy5maWx0ZXIoKGNyYXRlKSA9PiBkZXBlbmRlbnRQYWNrYWdlSWRzLmhhcyhjcmF0ZS5pZCkpXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwYXJzZU1ldGFkYXRhKFxuICBtYW5pZmVzdFBhdGg6IHN0cmluZyxcbiAgZmVhdHVyZU9wdGlvbnM/OiBDYXJnb0ZlYXR1cmVPcHRpb25zLFxuKSB7XG4gIGlmICghZnMuZXhpc3RzU3luYyhtYW5pZmVzdFBhdGgpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBObyBjcmF0ZSBmb3VuZCBpbiBtYW5pZmVzdDogJHttYW5pZmVzdFBhdGh9YClcbiAgfVxuXG4gIGNvbnN0IGZlYXR1cmVBcmdzOiBzdHJpbmdbXSA9IFtdXG4gIGlmIChmZWF0dXJlT3B0aW9ucz8uYWxsRmVhdHVyZXMpIHtcbiAgICBmZWF0dXJlQXJncy5wdXNoKCctLWFsbC1mZWF0dXJlcycpXG4gIH1cbiAgaWYgKGZlYXR1cmVPcHRpb25zPy5ub0RlZmF1bHRGZWF0dXJlcykge1xuICAgIGZlYXR1cmVBcmdzLnB1c2goJy0tbm8tZGVmYXVsdC1mZWF0dXJlcycpXG4gIH1cbiAgaWYgKGZlYXR1cmVPcHRpb25zPy5mZWF0dXJlcz8ubGVuZ3RoKSB7XG4gICAgZmVhdHVyZUFyZ3MucHVzaCgnLS1mZWF0dXJlcycsIGZlYXR1cmVPcHRpb25zLmZlYXR1cmVzLmpvaW4oJywnKSlcbiAgfVxuXG4gIC8vIFJlc29sdmluZyB3aXRoIHRoZSBidWlsZCdzIGZlYXR1cmUgZmxhZ3Mga2VlcHMgYG1ldGFkYXRhLnJlc29sdmVgIGluIHN5bmMgd2l0aCB3aGF0XG4gIC8vIGBjYXJnbyBidWlsZGAgd2lsbCBhY3R1YWxseSBjb21waWxlLiBGZWF0dXJlIGZsYWdzIGFyZSByZWplY3RlZCBpbiBzb21lIHNldHVwc1xuICAvLyAoZS5nLiBhIHZpcnR1YWwgd29ya3NwYWNlIHJvb3QgbWFuaWZlc3QpLCBzbyBmYWxsIGJhY2sgdG8gYSBwbGFpbiBpbnZvY2F0aW9uLlxuICBpZiAoZmVhdHVyZUFyZ3MubGVuZ3RoKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBleGVjQ2FyZ29NZXRhZGF0YShtYW5pZmVzdFBhdGgsIGZlYXR1cmVBcmdzKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGRlYnVnLndhcm4oXG4gICAgICAgIGBjYXJnbyBtZXRhZGF0YSBmYWlsZWQgd2l0aCBmZWF0dXJlIGZsYWdzLCByZXRyeWluZyB3aXRob3V0IHRoZW06ICR7ZX1gLFxuICAgICAgKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBleGVjQ2FyZ29NZXRhZGF0YShtYW5pZmVzdFBhdGgsIFtdKVxufVxuXG5hc3luYyBmdW5jdGlvbiBleGVjQ2FyZ29NZXRhZGF0YShtYW5pZmVzdFBhdGg6IHN0cmluZywgZXh0cmFBcmdzOiBzdHJpbmdbXSkge1xuICBjb25zdCBjaGlsZFByb2Nlc3MgPSBzcGF3bihcbiAgICAnY2FyZ28nLFxuICAgIFtcbiAgICAgICdtZXRhZGF0YScsXG4gICAgICAnLS1tYW5pZmVzdC1wYXRoJyxcbiAgICAgIG1hbmlmZXN0UGF0aCxcbiAgICAgICctLWZvcm1hdC12ZXJzaW9uJyxcbiAgICAgICcxJyxcbiAgICAgIC4uLmV4dHJhQXJncyxcbiAgICBdLFxuICAgIHtcbiAgICAgIHN0ZGlvOiAncGlwZScsXG4gICAgfSxcbiAgKVxuXG4gIGxldCBzdGRvdXQgPSAnJ1xuICBsZXQgc3RkZXJyID0gJydcbiAgbGV0IHN0YXR1cyA9IDBcbiAgbGV0IGVycm9yOiBFcnJvciB8IG51bGwgPSBudWxsXG5cbiAgY2hpbGRQcm9jZXNzLnN0ZG91dC5vbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgc3Rkb3V0ICs9IGRhdGFcbiAgfSlcblxuICBjaGlsZFByb2Nlc3Muc3RkZXJyLm9uKCdkYXRhJywgKGRhdGEpID0+IHtcbiAgICBzdGRlcnIgKz0gZGF0YVxuICB9KVxuXG4gIGNoaWxkUHJvY2Vzcy5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgZXJyb3IgPSBlcnJcbiAgfSlcblxuICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgIGNoaWxkUHJvY2Vzcy5vbignY2xvc2UnLCAoY29kZSkgPT4ge1xuICAgICAgc3RhdHVzID0gY29kZSA/PyAwXG4gICAgICByZXNvbHZlKClcbiAgICB9KVxuICB9KVxuXG4gIGlmIChlcnJvcikge1xuICAgIHRocm93IG5ldyBFcnJvcignY2FyZ28gbWV0YWRhdGEgZmFpbGVkIHRvIHJ1bicsIHsgY2F1c2U6IGVycm9yIH0pXG4gIH1cbiAgaWYgKHN0YXR1cyAhPT0gMCkge1xuICAgIGNvbnN0IHNpbXBsZU1lc3NhZ2UgPSBgY2FyZ28gbWV0YWRhdGEgZXhpdGVkIHdpdGggY29kZSAke3N0YXR1c31gXG4gICAgdGhyb3cgbmV3IEVycm9yKGAke3NpbXBsZU1lc3NhZ2V9IGFuZCBlcnJvciBtZXNzYWdlOlxcblxcbiR7c3RkZXJyfWAsIHtcbiAgICAgIGNhdXNlOiBuZXcgRXJyb3Ioc2ltcGxlTWVzc2FnZSksXG4gICAgfSlcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2Uoc3Rkb3V0KSBhcyBDYXJnb1dvcmtzcGFjZU1ldGFkYXRhXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBwYXJzZSBjYXJnbyBtZXRhZGF0YSBKU09OJywgeyBjYXVzZTogZSB9KVxuICB9XG59XG4iLCJpbXBvcnQgeyB1bmRlcmxpbmUsIHllbGxvdyB9IGZyb20gJ2NvbG9yZXR0ZSdcbmltcG9ydCB7IG1lcmdlLCBvbWl0IH0gZnJvbSAnZXMtdG9vbGtpdCdcblxuaW1wb3J0IHsgZmlsZUV4aXN0cywgcmVhZEZpbGVBc3luYyB9IGZyb20gJy4vbWlzYy5qcydcbmltcG9ydCB7IERFRkFVTFRfVEFSR0VUUywgcGFyc2VUcmlwbGUsIHR5cGUgVGFyZ2V0IH0gZnJvbSAnLi90YXJnZXQuanMnXG5cbmV4cG9ydCB0eXBlIFZhbHVlT2ZDb25zdEFycmF5PFQ+ID0gVFtFeGNsdWRlPGtleW9mIFQsIGtleW9mIEFycmF5PGFueT4+XVxuXG5leHBvcnQgY29uc3QgU3VwcG9ydGVkUGFja2FnZU1hbmFnZXJzID0gWyd5YXJuJywgJ3BucG0nXSBhcyBjb25zdFxuZXhwb3J0IGNvbnN0IFN1cHBvcnRlZFRlc3RGcmFtZXdvcmtzID0gWydhdmEnXSBhcyBjb25zdFxuXG5leHBvcnQgdHlwZSBTdXBwb3J0ZWRQYWNrYWdlTWFuYWdlciA9IFZhbHVlT2ZDb25zdEFycmF5PFxuICB0eXBlb2YgU3VwcG9ydGVkUGFja2FnZU1hbmFnZXJzXG4+XG5leHBvcnQgdHlwZSBTdXBwb3J0ZWRUZXN0RnJhbWV3b3JrID0gVmFsdWVPZkNvbnN0QXJyYXk8XG4gIHR5cGVvZiBTdXBwb3J0ZWRUZXN0RnJhbWV3b3Jrc1xuPlxuXG5leHBvcnQgaW50ZXJmYWNlIFVzZXJOYXBpQ29uZmlnIHtcbiAgLyoqXG4gICAqIE5hbWUgb2YgdGhlIGJpbmFyeSB0byBiZSBnZW5lcmF0ZWQsIGRlZmF1bHQgdG8gYGluZGV4YFxuICAgKi9cbiAgYmluYXJ5TmFtZT86IHN0cmluZ1xuICAvKipcbiAgICogTmFtZSBvZiB0aGUgbnBtIHBhY2thZ2UsIGRlZmF1bHQgdG8gdGhlIG5hbWUgb2Ygcm9vdCBwYWNrYWdlLmpzb24gbmFtZVxuICAgKlxuICAgKiBBbHdheXMgZ2l2ZW4gYEBzY29wZS9wa2dgIGFuZCBhcmNoIHN1ZmZpeCB3aWxsIGJlIGFwcGVuZGVkIGxpa2UgYEBzY29wZS9wa2ctbGludXgtZ251LXg2NGBcbiAgICovXG4gIHBhY2thZ2VOYW1lPzogc3RyaW5nXG4gIC8qKlxuICAgKiBBbGwgdGFyZ2V0cyB0aGUgY3JhdGUgd2lsbCBiZSBjb21waWxlZCBmb3JcbiAgICovXG4gIHRhcmdldHM/OiBzdHJpbmdbXVxuXG4gIC8qKlxuICAgKiBUaGUgbnBtIGNsaWVudCBwcm9qZWN0IHVzZXMuXG4gICAqL1xuICBucG1DbGllbnQ/OiBzdHJpbmdcblxuICAvKipcbiAgICogV2hldGhlciBnZW5lcmF0ZSBjb25zdCBlbnVtIGZvciB0eXBlc2NyaXB0IGJpbmRpbmdzXG4gICAqL1xuICBjb25zdEVudW0/OiBib29sZWFuXG5cbiAgLyoqXG4gICAqIEVtaXQgYCNbbmFwaShzdHJpbmdfZW51bSldYCBlbnVtcyBhcyBydW50aW1lIGVudW1zIChgZXhwb3J0IGRlY2xhcmUgZW51bWApIHVuZGVyIGAtLW5vLWNvbnN0LWVudW1gLiBEZWZhdWx0OiB0eXBlLW9ubHkgdW5pb24uXG4gICAqL1xuICBydW50aW1lU3RyaW5nRW51bT86IGJvb2xlYW5cblxuICAvKipcbiAgICogZHRzIGhlYWRlciBwcmVwZW5kIHRvIHRoZSBnZW5lcmF0ZWQgZHRzIGZpbGVcbiAgICovXG4gIGR0c0hlYWRlcj86IHN0cmluZ1xuXG4gIC8qKlxuICAgKiBkdHMgaGVhZGVyIGZpbGUgcGF0aCB0byBiZSBwcmVwZW5kZWQgdG8gdGhlIGdlbmVyYXRlZCBkdHMgZmlsZVxuICAgKiBpZiBib3RoIGR0c0hlYWRlciBhbmQgZHRzSGVhZGVyRmlsZSBhcmUgcHJvdmlkZWQsIGR0c0hlYWRlckZpbGUgd2lsbCBiZSB1c2VkXG4gICAqL1xuICBkdHNIZWFkZXJGaWxlPzogc3RyaW5nXG5cbiAgLyoqXG4gICAqIHdhc20gY29tcGlsYXRpb24gb3B0aW9uc1xuICAgKi9cbiAgd2FzbT86IHtcbiAgICAvKipcbiAgICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYkFzc2VtYmx5L0phdmFTY3JpcHRfaW50ZXJmYWNlL01lbW9yeVxuICAgICAqIEBkZWZhdWx0IDQwMDAgcGFnZXMgKDI1Nk1pQilcbiAgICAgKi9cbiAgICBpbml0aWFsTWVtb3J5PzogbnVtYmVyXG4gICAgLyoqXG4gICAgICogQGRlZmF1bHQgNjU1MzYgcGFnZXMgKDRHaUIpXG4gICAgICovXG4gICAgbWF4aW11bU1lbW9yeT86IG51bWJlclxuXG4gICAgLyoqXG4gICAgICogQnJvd3NlciB3YXNtIGJpbmRpbmcgY29uZmlndXJhdGlvblxuICAgICAqL1xuICAgIGJyb3dzZXI6IHtcbiAgICAgIC8qKlxuICAgICAgICogV2hldGhlciB0byB1c2UgZnMgbW9kdWxlIGluIGJyb3dzZXJcbiAgICAgICAqL1xuICAgICAgZnM/OiBib29sZWFuXG4gICAgICAvKipcbiAgICAgICAqIFdoZXRoZXIgdG8gaW5pdGlhbGl6ZSB3YXNtIGFzeW5jaHJvbm91c2x5XG4gICAgICAgKi9cbiAgICAgIGFzeW5jSW5pdD86IGJvb2xlYW5cbiAgICAgIC8qKlxuICAgICAgICogV2hldGhlciB0byBpbmplY3QgYGJ1ZmZlcmAgdG8gZW1uYXBpIGNvbnRleHRcbiAgICAgICAqL1xuICAgICAgYnVmZmVyPzogYm9vbGVhblxuICAgICAgLyoqXG4gICAgICAgKiBXaGV0aGVyIHRvIGVtaXQgY3VzdG9tIGV2ZW50cyBmb3IgZXJyb3JzIGluIHdvcmtlclxuICAgICAgICovXG4gICAgICBlcnJvckV2ZW50PzogYm9vbGVhblxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZCBiaW5hcnlOYW1lIGluc3RlYWRcbiAgICovXG4gIG5hbWU/OiBzdHJpbmdcbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIHVzZSBwYWNrYWdlTmFtZSBpbnN0ZWFkXG4gICAqL1xuICBwYWNrYWdlPzoge1xuICAgIG5hbWU/OiBzdHJpbmdcbiAgfVxuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgdXNlIHRhcmdldHMgaW5zdGVhZFxuICAgKi9cbiAgdHJpcGxlcz86IHtcbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIGVuYWJsZSBkZWZhdWx0IHRhcmdldHNcbiAgICAgKi9cbiAgICBkZWZhdWx0czogYm9vbGVhblxuICAgIC8qKlxuICAgICAqIEFkZGl0aW9uYWwgdGFyZ2V0cyB0byBiZSBjb21waWxlZCBmb3JcbiAgICAgKi9cbiAgICBhZGRpdGlvbmFsPzogc3RyaW5nW11cbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbW1vblBhY2thZ2VKc29uRmllbGRzIHtcbiAgbmFtZTogc3RyaW5nXG4gIHZlcnNpb246IHN0cmluZ1xuICBkZXNjcmlwdGlvbj86IHN0cmluZ1xuICBrZXl3b3Jkcz86IHN0cmluZ1tdXG4gIGF1dGhvcj86IHN0cmluZ1xuICBhdXRob3JzPzogc3RyaW5nW11cbiAgbGljZW5zZT86IHN0cmluZ1xuICBjcHU/OiBzdHJpbmdbXVxuICBvcz86IHN0cmluZ1tdXG4gIGxpYmM/OiBzdHJpbmdbXVxuICBmaWxlcz86IHN0cmluZ1tdXG4gIHJlcG9zaXRvcnk/OiBhbnlcbiAgaG9tZXBhZ2U/OiBhbnlcbiAgZW5naW5lcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz5cbiAgcHVibGlzaENvbmZpZz86IGFueVxuICBidWdzPzogYW55XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11c2UtYmVmb3JlLWRlZmluZVxuICBuYXBpPzogVXNlck5hcGlDb25maWdcbiAgdHlwZT86ICdtb2R1bGUnIHwgJ2NvbW1vbmpzJ1xuICBzY3JpcHRzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPlxuXG4gIC8vIG1vZHVsZXNcbiAgbWFpbj86IHN0cmluZ1xuICBtb2R1bGU/OiBzdHJpbmdcbiAgdHlwZXM/OiBzdHJpbmdcbiAgYnJvd3Nlcj86IHN0cmluZ1xuICBleHBvcnRzPzogYW55XG5cbiAgZGVwZW5kZW5jaWVzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPlxuICBkZXZEZXBlbmRlbmNpZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG5cbiAgYXZhPzoge1xuICAgIHRpbWVvdXQ/OiBzdHJpbmdcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBOYXBpQ29uZmlnID0gUmVxdWlyZWQ8XG4gIFBpY2s8VXNlck5hcGlDb25maWcsICdiaW5hcnlOYW1lJyB8ICdwYWNrYWdlTmFtZScgfCAnbnBtQ2xpZW50Jz5cbj4gJlxuICBQaWNrPFxuICAgIFVzZXJOYXBpQ29uZmlnLFxuICAgICd3YXNtJyB8ICdkdHNIZWFkZXInIHwgJ2R0c0hlYWRlckZpbGUnIHwgJ2NvbnN0RW51bScgfCAncnVudGltZVN0cmluZ0VudW0nXG4gID4gJiB7XG4gICAgdGFyZ2V0czogVGFyZ2V0W11cbiAgICBwYWNrYWdlSnNvbjogQ29tbW9uUGFja2FnZUpzb25GaWVsZHNcbiAgfVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVhZE5hcGlDb25maWcoXG4gIHBhdGg6IHN0cmluZyxcbiAgY29uZmlnUGF0aD86IHN0cmluZyxcbik6IFByb21pc2U8TmFwaUNvbmZpZz4ge1xuICBpZiAoY29uZmlnUGF0aCAmJiAhKGF3YWl0IGZpbGVFeGlzdHMoY29uZmlnUGF0aCkpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBOQVBJLVJTIGNvbmZpZyBub3QgZm91bmQgYXQgJHtjb25maWdQYXRofWApXG4gIH1cbiAgaWYgKCEoYXdhaXQgZmlsZUV4aXN0cyhwYXRoKSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHBhY2thZ2UuanNvbiBub3QgZm91bmQgYXQgJHtwYXRofWApXG4gIH1cbiAgLy8gTWF5IHN1cHBvcnQgbXVsdGlwbGUgY29uZmlnIHNvdXJjZXMgbGF0ZXIgb24uXG4gIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCByZWFkRmlsZUFzeW5jKHBhdGgsICd1dGY4JylcbiAgbGV0IHBrZ0pzb25cbiAgdHJ5IHtcbiAgICBwa2dKc29uID0gSlNPTi5wYXJzZShjb250ZW50KSBhcyBDb21tb25QYWNrYWdlSnNvbkZpZWxkc1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcGFyc2UgcGFja2FnZS5qc29uIGF0ICR7cGF0aH1gLCB7XG4gICAgICBjYXVzZTogZSxcbiAgICB9KVxuICB9XG5cbiAgbGV0IHNlcGFyYXRlZENvbmZpZzogVXNlck5hcGlDb25maWcgfCB1bmRlZmluZWRcbiAgaWYgKGNvbmZpZ1BhdGgpIHtcbiAgICBjb25zdCBjb25maWdDb250ZW50ID0gYXdhaXQgcmVhZEZpbGVBc3luYyhjb25maWdQYXRoLCAndXRmOCcpXG4gICAgdHJ5IHtcbiAgICAgIHNlcGFyYXRlZENvbmZpZyA9IEpTT04ucGFyc2UoY29uZmlnQ29udGVudCkgYXMgVXNlck5hcGlDb25maWdcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBwYXJzZSBOQVBJLVJTIGNvbmZpZyBhdCAke2NvbmZpZ1BhdGh9YCwge1xuICAgICAgICBjYXVzZTogZSxcbiAgICAgIH0pXG4gICAgfVxuICB9XG5cbiAgY29uc3QgdXNlck5hcGlDb25maWcgPSBwa2dKc29uLm5hcGkgPz8ge31cbiAgaWYgKHBrZ0pzb24ubmFwaSAmJiBzZXBhcmF0ZWRDb25maWcpIHtcbiAgICBjb25zdCBwa2dKc29uUGF0aCA9IHVuZGVybGluZShwYXRoKVxuICAgIGNvbnN0IGNvbmZpZ1BhdGhVbmRlcmxpbmUgPSB1bmRlcmxpbmUoY29uZmlnUGF0aCEpXG4gICAgY29uc29sZS53YXJuKFxuICAgICAgeWVsbG93KFxuICAgICAgICBgQm90aCBuYXBpIGZpZWxkIGluICR7cGtnSnNvblBhdGh9IGFuZCBbTkFQSS1SUyBjb25maWddKCR7Y29uZmlnUGF0aFVuZGVybGluZX0pIGZpbGUgYXJlIGZvdW5kLCB0aGUgTkFQSS1SUyBjb25maWcgZmlsZSB3aWxsIGJlIHVzZWQuYCxcbiAgICAgICksXG4gICAgKVxuICB9XG4gIGlmIChzZXBhcmF0ZWRDb25maWcpIHtcbiAgICBPYmplY3QuYXNzaWduKHVzZXJOYXBpQ29uZmlnLCBzZXBhcmF0ZWRDb25maWcpXG4gIH1cbiAgY29uc3QgbmFwaUNvbmZpZzogTmFwaUNvbmZpZyA9IG1lcmdlKFxuICAgIHtcbiAgICAgIGJpbmFyeU5hbWU6ICdpbmRleCcsXG4gICAgICBwYWNrYWdlTmFtZTogcGtnSnNvbi5uYW1lLFxuICAgICAgdGFyZ2V0czogW10sXG4gICAgICBwYWNrYWdlSnNvbjogcGtnSnNvbixcbiAgICAgIG5wbUNsaWVudDogJ25wbScsXG4gICAgfSxcbiAgICBvbWl0KHVzZXJOYXBpQ29uZmlnLCBbJ3RhcmdldHMnXSksXG4gIClcblxuICBsZXQgdGFyZ2V0czogc3RyaW5nW10gPSB1c2VyTmFwaUNvbmZpZy50YXJnZXRzID8/IFtdXG5cbiAgLy8gY29tcGF0aWJsZSB3aXRoIG9sZCBjb25maWdcbiAgaWYgKHVzZXJOYXBpQ29uZmlnPy5uYW1lKSB7XG4gICAgY29uc29sZS53YXJuKFxuICAgICAgeWVsbG93KFxuICAgICAgICBgW0RFUFJFQ0FURURdIG5hcGkubmFtZSBpcyBkZXByZWNhdGVkLCB1c2UgbmFwaS5iaW5hcnlOYW1lIGluc3RlYWQuYCxcbiAgICAgICksXG4gICAgKVxuICAgIG5hcGlDb25maWcuYmluYXJ5TmFtZSA9IHVzZXJOYXBpQ29uZmlnLm5hbWVcbiAgfVxuXG4gIGlmICghdGFyZ2V0cy5sZW5ndGgpIHtcbiAgICBsZXQgZGVwcmVjYXRlZFdhcm5lZCA9IGZhbHNlXG4gICAgY29uc3Qgd2FybmluZyA9IHllbGxvdyhcbiAgICAgIGBbREVQUkVDQVRFRF0gbmFwaS50cmlwbGVzIGlzIGRlcHJlY2F0ZWQsIHVzZSBuYXBpLnRhcmdldHMgaW5zdGVhZC5gLFxuICAgIClcbiAgICBpZiAodXNlck5hcGlDb25maWcudHJpcGxlcz8uZGVmYXVsdHMpIHtcbiAgICAgIGRlcHJlY2F0ZWRXYXJuZWQgPSB0cnVlXG4gICAgICBjb25zb2xlLndhcm4od2FybmluZylcbiAgICAgIHRhcmdldHMgPSB0YXJnZXRzLmNvbmNhdChERUZBVUxUX1RBUkdFVFMpXG4gICAgfVxuXG4gICAgaWYgKHVzZXJOYXBpQ29uZmlnLnRyaXBsZXM/LmFkZGl0aW9uYWw/Lmxlbmd0aCkge1xuICAgICAgdGFyZ2V0cyA9IHRhcmdldHMuY29uY2F0KHVzZXJOYXBpQ29uZmlnLnRyaXBsZXMuYWRkaXRpb25hbClcbiAgICAgIGlmICghZGVwcmVjYXRlZFdhcm5lZCkge1xuICAgICAgICBjb25zb2xlLndhcm4od2FybmluZylcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBmaW5kIGR1cGxpY2F0ZSB0YXJnZXRzXG4gIGNvbnN0IHVuaXF1ZVRhcmdldHMgPSBuZXcgU2V0KHRhcmdldHMpXG4gIGlmICh1bmlxdWVUYXJnZXRzLnNpemUgIT09IHRhcmdldHMubGVuZ3RoKSB7XG4gICAgY29uc3QgZHVwbGljYXRlVGFyZ2V0ID0gdGFyZ2V0cy5maW5kKFxuICAgICAgKHRhcmdldCwgaW5kZXgpID0+IHRhcmdldHMuaW5kZXhPZih0YXJnZXQpICE9PSBpbmRleCxcbiAgICApXG4gICAgdGhyb3cgbmV3IEVycm9yKGBEdXBsaWNhdGUgdGFyZ2V0cyBhcmUgbm90IGFsbG93ZWQ6ICR7ZHVwbGljYXRlVGFyZ2V0fWApXG4gIH1cblxuICBuYXBpQ29uZmlnLnRhcmdldHMgPSB0YXJnZXRzLm1hcChwYXJzZVRyaXBsZSlcblxuICByZXR1cm4gbmFwaUNvbmZpZ1xufVxuIiwiaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnXG5cbmltcG9ydCB7IGRlYnVnIH0gZnJvbSAnLi9sb2cuanMnXG5cbmV4cG9ydCBmdW5jdGlvbiB0cnlJbnN0YWxsQ2FyZ29CaW5hcnkobmFtZTogc3RyaW5nLCBiaW46IHN0cmluZykge1xuICBpZiAoZGV0ZWN0Q2FyZ29CaW5hcnkoYmluKSkge1xuICAgIGRlYnVnKCdDYXJnbyBiaW5hcnkgYWxyZWFkeSBpbnN0YWxsZWQ6ICVzJywgbmFtZSlcbiAgICByZXR1cm5cbiAgfVxuXG4gIHRyeSB7XG4gICAgZGVidWcoJ0luc3RhbGxpbmcgY2FyZ28gYmluYXJ5OiAlcycsIG5hbWUpXG4gICAgZXhlY1N5bmMoYGNhcmdvIGluc3RhbGwgJHtuYW1lfWAsIHtcbiAgICAgIHN0ZGlvOiAnaW5oZXJpdCcsXG4gICAgfSlcbiAgfSBjYXRjaCAoZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGluc3RhbGwgY2FyZ28gYmluYXJ5OiAke25hbWV9YCwge1xuICAgICAgY2F1c2U6IGUsXG4gICAgfSlcbiAgfVxufVxuXG5mdW5jdGlvbiBkZXRlY3RDYXJnb0JpbmFyeShiaW46IHN0cmluZykge1xuICBkZWJ1ZygnRGV0ZWN0aW5nIGNhcmdvIGJpbmFyeTogJXMnLCBiaW4pXG4gIHRyeSB7XG4gICAgZXhlY1N5bmMoYGNhcmdvIGhlbHAgJHtiaW59YCwge1xuICAgICAgc3RkaW86ICdpZ25vcmUnLFxuICAgIH0pXG4gICAgZGVidWcoJ0NhcmdvIGJpbmFyeSBkZXRlY3RlZDogJXMnLCBiaW4pXG4gICAgcmV0dXJuIHRydWVcbiAgfSBjYXRjaCB7XG4gICAgZGVidWcoJ0NhcmdvIGJpbmFyeSBub3QgZGV0ZWN0ZWQ6ICVzJywgYmluKVxuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG4iLCJpbXBvcnQgeyBzb3J0QnkgfSBmcm9tICdlcy10b29sa2l0J1xuXG5pbXBvcnQgeyByZWFkRmlsZUFzeW5jIH0gZnJvbSAnLi9taXNjLmpzJ1xuXG5jb25zdCBUT1BfTEVWRUxfTkFNRVNQQUNFID0gJ19fVE9QX0xFVkVMX01PRFVMRV9fJ1xuZXhwb3J0IGNvbnN0IERFRkFVTFRfVFlQRV9ERUZfSEVBREVSID0gYC8qIGF1dG8tZ2VuZXJhdGVkIGJ5IE5BUEktUlMgKi9cbi8qIGVzbGludC1kaXNhYmxlICovXG5gXG5cbmVudW0gVHlwZURlZktpbmQge1xuICBDb25zdCA9ICdjb25zdCcsXG4gIEVudW0gPSAnZW51bScsXG4gIFN0cmluZ0VudW0gPSAnc3RyaW5nX2VudW0nLFxuICBJbnRlcmZhY2UgPSAnaW50ZXJmYWNlJyxcbiAgVHlwZSA9ICd0eXBlJyxcbiAgRm4gPSAnZm4nLFxuICBTdHJ1Y3QgPSAnc3RydWN0JyxcbiAgRXh0ZW5kcyA9ICdleHRlbmRzJyxcbiAgSW1wbCA9ICdpbXBsJyxcbn1cblxuaW50ZXJmYWNlIFR5cGVEZWZMaW5lIHtcbiAga2luZDogVHlwZURlZktpbmRcbiAgbmFtZTogc3RyaW5nXG4gIG9yaWdpbmFsX25hbWU/OiBzdHJpbmdcbiAgZGVmOiBzdHJpbmdcbiAgZXh0ZW5kcz86IHN0cmluZ1xuICBqc19kb2M/OiBzdHJpbmdcbiAganNfbW9kPzogc3RyaW5nXG59XG5cbi8qKlxuICogUmVuZGVyIGEgc2luZ2xlIGludGVybWVkaWF0ZSB0eXBlLWRlZiBsaW5lIGFzIHRoZSBUeXBlU2NyaXB0IHNvdXJjZSBpdFxuICogc2hvdWxkIHByb2R1Y2UgaW4gYGluZGV4LmQudHNgLlxuICpcbiAqIEBwYXJhbSBsaW5lIC0gVGhlIGludGVybWVkaWF0ZSB0eXBlLWRlZiBlbnRyeSB0byByZW5kZXIuXG4gKiBAcGFyYW0gY29uc3RFbnVtIC0gV2hlbiB0cnVlLCBlbWl0IG51bWVyaWMgYW5kIHN0cmluZyBgI1tuYXBpXWAgZW51bXMgYXNcbiAqICAgYGNvbnN0IGVudW1gLiBXaGVuIGZhbHNlIChgLS1uby1jb25zdC1lbnVtYCksIG51bWVyaWMgZW51bXMgYmVjb21lXG4gKiAgIHJlZ3VsYXIgcnVudGltZSBlbnVtcyBhbmQgc3RyaW5nIGVudW1zIGZhbGwgYmFjayB0byBhIHR5cGUtb25seSB1bmlvblxuICogICB1bmxlc3MgYHJ1bnRpbWVTdHJpbmdFbnVtYCBpcyBhbHNvIHRydWUuXG4gKiBAcGFyYW0gcnVudGltZVN0cmluZ0VudW0gLSBXaGVuIHRydWUgdW5kZXIgYC0tbm8tY29uc3QtZW51bWAsIGVtaXRcbiAqICAgYCNbbmFwaShzdHJpbmdfZW51bSldYCBhcyBhIHJ1bnRpbWUgZW51bSAoYGV4cG9ydCBkZWNsYXJlIGVudW1gKVxuICogICBpbnN0ZWFkIG9mIGEgdHlwZS1vbmx5IHVuaW9uLiBOby1vcCB3aGVuIGBjb25zdEVudW1gIGlzIHRydWUuXG4gKiBAcGFyYW0gaWRlbnQgLSBJbmRlbnRhdGlvbiBsZXZlbCBhcHBsaWVkIHRvIHRoZSByZW5kZXJlZCBvdXRwdXQuXG4gKiBAcGFyYW0gYW1iaWVudCAtIFdoZW4gdHJ1ZSwgZW1pdCBkZWNsYXJhdGlvbnMgaW4gdGhlIGFtYmllbnQgZm9ybSB1c2VkXG4gKiAgIGluc2lkZSBgZGVjbGFyZSBuYW1lc3BhY2VgIGJsb2NrcyAoZS5nLiBkcm9wIHRoZSBgZGVjbGFyZWAga2V5d29yZCkuXG4gKi9cbmZ1bmN0aW9uIHByZXR0eVByaW50KFxuICBsaW5lOiBUeXBlRGVmTGluZSxcbiAgY29uc3RFbnVtOiBib29sZWFuLFxuICBydW50aW1lU3RyaW5nRW51bTogYm9vbGVhbixcbiAgaWRlbnQ6IG51bWJlcixcbiAgYW1iaWVudCA9IGZhbHNlLFxuKTogc3RyaW5nIHtcbiAgbGV0IHMgPSBsaW5lLmpzX2RvYyA/PyAnJ1xuICBzd2l0Y2ggKGxpbmUua2luZCkge1xuICAgIGNhc2UgVHlwZURlZktpbmQuSW50ZXJmYWNlOlxuICAgICAgcyArPSBgZXhwb3J0IGludGVyZmFjZSAke2xpbmUubmFtZX0ge1xcbiR7bGluZS5kZWZ9XFxufWBcbiAgICAgIGJyZWFrXG5cbiAgICBjYXNlIFR5cGVEZWZLaW5kLlR5cGU6XG4gICAgICBzICs9IGBleHBvcnQgdHlwZSAke2xpbmUubmFtZX0gPSBcXG4ke2xpbmUuZGVmfWBcbiAgICAgIGJyZWFrXG5cbiAgICBjYXNlIFR5cGVEZWZLaW5kLkVudW06IHtcbiAgICAgIGNvbnN0IGVudW1OYW1lID0gY29uc3RFbnVtID8gJ2NvbnN0IGVudW0nIDogJ2VudW0nXG4gICAgICBzICs9IGAke2V4cG9ydERlY2xhcmUoYW1iaWVudCl9ICR7ZW51bU5hbWV9ICR7bGluZS5uYW1lfSB7XFxuJHtsaW5lLmRlZn1cXG59YFxuICAgICAgYnJlYWtcbiAgICB9XG5cbiAgICBjYXNlIFR5cGVEZWZLaW5kLlN0cmluZ0VudW06IHtcbiAgICAgIGlmIChjb25zdEVudW0pIHtcbiAgICAgICAgcyArPSBgJHtleHBvcnREZWNsYXJlKGFtYmllbnQpfSBjb25zdCBlbnVtICR7bGluZS5uYW1lfSB7XFxuJHtsaW5lLmRlZn1cXG59YFxuICAgICAgfSBlbHNlIGlmIChydW50aW1lU3RyaW5nRW51bSkge1xuICAgICAgICBzICs9IGAke2V4cG9ydERlY2xhcmUoYW1iaWVudCl9IGVudW0gJHtsaW5lLm5hbWV9IHtcXG4ke2xpbmUuZGVmfVxcbn1gXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzICs9IGBleHBvcnQgdHlwZSAke2xpbmUubmFtZX0gPSAke2xpbmUuZGVmLnJlcGxhY2VBbGwoLy4qPS9nLCAnJykucmVwbGFjZUFsbCgnLCcsICd8Jyl9O2BcbiAgICAgIH1cbiAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgY2FzZSBUeXBlRGVmS2luZC5TdHJ1Y3Q6XG4gICAgICBjb25zdCBleHRlbmRzRGVmID0gbGluZS5leHRlbmRzID8gYCBleHRlbmRzICR7bGluZS5leHRlbmRzfWAgOiAnJ1xuICAgICAgaWYgKGxpbmUuZXh0ZW5kcykge1xuICAgICAgICAvLyBFeHRyYWN0IGdlbmVyaWMgcGFyYW1zIGZyb20gZXh0ZW5kcyB0eXBlIGxpa2UgSXRlcmF0b3I8VCwgVFJlc3VsdCwgVE5leHQ+XG4gICAgICAgIGNvbnN0IGdlbmVyaWNNYXRjaCA9IGxpbmUuZXh0ZW5kcy5tYXRjaCgvSXRlcmF0b3I8KC4rKT4kLylcbiAgICAgICAgaWYgKGdlbmVyaWNNYXRjaCkge1xuICAgICAgICAgIGNvbnN0IFtULCBUUmVzdWx0LCBUTmV4dF0gPSBnZW5lcmljTWF0Y2hbMV1cbiAgICAgICAgICAgIC5zcGxpdCgnLCcpXG4gICAgICAgICAgICAubWFwKChwKSA9PiBwLnRyaW0oKSlcbiAgICAgICAgICBsaW5lLmRlZiA9XG4gICAgICAgICAgICBsaW5lLmRlZiArXG4gICAgICAgICAgICBgXFxubmV4dCh2YWx1ZT86ICR7VE5leHR9KTogSXRlcmF0b3JSZXN1bHQ8JHtUfSwgJHtUUmVzdWx0fT5gXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHMgKz0gYCR7ZXhwb3J0RGVjbGFyZShhbWJpZW50KX0gY2xhc3MgJHtsaW5lLm5hbWV9JHtleHRlbmRzRGVmfSB7XFxuJHtsaW5lLmRlZn1cXG59YFxuICAgICAgaWYgKGxpbmUub3JpZ2luYWxfbmFtZSAmJiBsaW5lLm9yaWdpbmFsX25hbWUgIT09IGxpbmUubmFtZSkge1xuICAgICAgICBzICs9IGBcXG5leHBvcnQgdHlwZSAke2xpbmUub3JpZ2luYWxfbmFtZX0gPSAke2xpbmUubmFtZX1gXG4gICAgICB9XG4gICAgICBicmVha1xuXG4gICAgY2FzZSBUeXBlRGVmS2luZC5GbjpcbiAgICAgIHMgKz0gYCR7ZXhwb3J0RGVjbGFyZShhbWJpZW50KX0gJHtsaW5lLmRlZn1gXG4gICAgICBicmVha1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHMgKz0gbGluZS5kZWZcbiAgfVxuXG4gIHJldHVybiBjb3JyZWN0U3RyaW5nSWRlbnQocywgaWRlbnQpXG59XG5cbmZ1bmN0aW9uIGV4cG9ydERlY2xhcmUoYW1iaWVudDogYm9vbGVhbik6IHN0cmluZyB7XG4gIGlmIChhbWJpZW50KSB7XG4gICAgcmV0dXJuICdleHBvcnQnXG4gIH1cblxuICByZXR1cm4gJ2V4cG9ydCBkZWNsYXJlJ1xufVxuXG4vKipcbiAqIFJlYWQgdGhlIG5hcGktZGVyaXZlLWVtaXR0ZWQgaW50ZXJtZWRpYXRlIHR5cGUtZGVmIGZpbGUgYW5kIHJlbmRlciBpdHNcbiAqIGVudHJpZXMgaW50byB0aGUgYGluZGV4LmQudHNgIHNvdXJjZSBzdHJpbmcgcGx1cyB0aGUgbGlzdCBvZiBuYW1lcyB0b1xuICogcmUtZXhwb3J0IGZyb20gYGluZGV4LmpzYC5cbiAqXG4gKiBAcGFyYW0gaW50ZXJtZWRpYXRlVHlwZUZpbGUgLSBQYXRoIHRvIHRoZSBKU09OTCB0eXBlLWRlZiBmaWxlIHByb2R1Y2VkXG4gKiAgIGJ5IG5hcGktZGVyaXZlIChvbmUgZW50cnkgcGVyIGAjW25hcGldYCBpdGVtKS5cbiAqIEBwYXJhbSBjb25zdEVudW0gLSBTZWUge0BsaW5rIHByZXR0eVByaW50fS5cbiAqIEBwYXJhbSBydW50aW1lU3RyaW5nRW51bSAtIFNlZSB7QGxpbmsgcHJldHR5UHJpbnR9LiBEZWZhdWx0cyB0byBgZmFsc2VgLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc1R5cGVEZWYoXG4gIGludGVybWVkaWF0ZVR5cGVGaWxlOiBzdHJpbmcsXG4gIGNvbnN0RW51bTogYm9vbGVhbixcbiAgcnVudGltZVN0cmluZ0VudW06IGJvb2xlYW4gPSBmYWxzZSxcbikge1xuICBjb25zdCBleHBvcnRzOiBzdHJpbmdbXSA9IFtdXG4gIGNvbnN0IGRlZnMgPSBhd2FpdCByZWFkSW50ZXJtZWRpYXRlVHlwZUZpbGUoaW50ZXJtZWRpYXRlVHlwZUZpbGUpXG4gIGNvbnN0IGdyb3VwZWREZWZzID0gcHJlcHJvY2Vzc1R5cGVEZWYoZGVmcylcblxuICBjb25zdCBkdHMgPVxuICAgIHNvcnRCeShBcnJheS5mcm9tKGdyb3VwZWREZWZzKSwgWyhbbmFtZXNwYWNlXSkgPT4gbmFtZXNwYWNlXSlcbiAgICAgIC5tYXAoKFtuYW1lc3BhY2UsIGRlZnNdKSA9PiB7XG4gICAgICAgIGlmIChuYW1lc3BhY2UgPT09IFRPUF9MRVZFTF9OQU1FU1BBQ0UpIHtcbiAgICAgICAgICByZXR1cm4gZGVmc1xuICAgICAgICAgICAgLm1hcCgoZGVmKSA9PiB7XG4gICAgICAgICAgICAgIHN3aXRjaCAoZGVmLmtpbmQpIHtcbiAgICAgICAgICAgICAgICBjYXNlIFR5cGVEZWZLaW5kLkNvbnN0OlxuICAgICAgICAgICAgICAgIGNhc2UgVHlwZURlZktpbmQuRW51bTpcbiAgICAgICAgICAgICAgICBjYXNlIFR5cGVEZWZLaW5kLlN0cmluZ0VudW06XG4gICAgICAgICAgICAgICAgY2FzZSBUeXBlRGVmS2luZC5GbjpcbiAgICAgICAgICAgICAgICBjYXNlIFR5cGVEZWZLaW5kLlN0cnVjdDoge1xuICAgICAgICAgICAgICAgICAgZXhwb3J0cy5wdXNoKGRlZi5uYW1lKVxuICAgICAgICAgICAgICAgICAgaWYgKGRlZi5vcmlnaW5hbF9uYW1lICYmIGRlZi5vcmlnaW5hbF9uYW1lICE9PSBkZWYubmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBleHBvcnRzLnB1c2goZGVmLm9yaWdpbmFsX25hbWUpXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gcHJldHR5UHJpbnQoZGVmLCBjb25zdEVudW0sIHJ1bnRpbWVTdHJpbmdFbnVtLCAwKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5qb2luKCdcXG5cXG4nKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV4cG9ydHMucHVzaChuYW1lc3BhY2UpXG4gICAgICAgICAgbGV0IGRlY2xhcmF0aW9uID0gJydcbiAgICAgICAgICBkZWNsYXJhdGlvbiArPSBgZXhwb3J0IGRlY2xhcmUgbmFtZXNwYWNlICR7bmFtZXNwYWNlfSB7XFxuYFxuICAgICAgICAgIGZvciAoY29uc3QgZGVmIG9mIGRlZnMpIHtcbiAgICAgICAgICAgIGRlY2xhcmF0aW9uICs9XG4gICAgICAgICAgICAgIHByZXR0eVByaW50KGRlZiwgY29uc3RFbnVtLCBydW50aW1lU3RyaW5nRW51bSwgMiwgdHJ1ZSkgKyAnXFxuJ1xuICAgICAgICAgIH1cbiAgICAgICAgICBkZWNsYXJhdGlvbiArPSAnfSdcbiAgICAgICAgICByZXR1cm4gZGVjbGFyYXRpb25cbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5qb2luKCdcXG5cXG4nKSArICdcXG4nXG5cbiAgcmV0dXJuIHtcbiAgICBkdHMsXG4gICAgZXhwb3J0cyxcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiByZWFkSW50ZXJtZWRpYXRlVHlwZUZpbGUoZmlsZTogc3RyaW5nKSB7XG4gIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCByZWFkRmlsZUFzeW5jKGZpbGUsICd1dGY4JylcblxuICBjb25zdCBkZWZzID0gY29udGVudFxuICAgIC5zcGxpdCgnXFxuJylcbiAgICAuZmlsdGVyKEJvb2xlYW4pXG4gICAgLm1hcCgobGluZSkgPT4ge1xuICAgICAgbGluZSA9IGxpbmUudHJpbSgpXG4gICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGxpbmUpIGFzIFR5cGVEZWZMaW5lXG4gICAgICAvLyBDb252ZXJ0IGVzY2FwZWQgbmV3bGluZXMgYmFjayB0byBhY3R1YWwgbmV3bGluZXMgaW4ganNfZG9jIGZpZWxkc1xuICAgICAgaWYgKHBhcnNlZC5qc19kb2MpIHtcbiAgICAgICAgcGFyc2VkLmpzX2RvYyA9IHBhcnNlZC5qc19kb2MucmVwbGFjZSgvXFxcXG4vZywgJ1xcbicpXG4gICAgICB9XG4gICAgICAvLyBDb252ZXJ0IGVzY2FwZWQgbmV3bGluZXMgdG8gYWN0dWFsIG5ld2xpbmVzIGluIGRlZiBmaWVsZHMgZm9yIHN0cnVjdC9jbGFzcy9pbnRlcmZhY2UvdHlwZSB0eXBlc1xuICAgICAgLy8gd2hlcmUgXFxuIHJlcHJlc2VudHMgbWV0aG9kL2ZpZWxkIHNlcGFyYXRvcnMgdGhhdCBzaG91bGQgYmUgYWN0dWFsIG5ld2xpbmVzXG4gICAgICBpZiAocGFyc2VkLmRlZikge1xuICAgICAgICBwYXJzZWQuZGVmID0gcGFyc2VkLmRlZi5yZXBsYWNlKC9cXFxcbi9nLCAnXFxuJylcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJzZWRcbiAgICB9KVxuXG4gIC8vIG1vdmUgYWxsIGBzdHJ1Y3RgIGRlZiB0byB0aGUgdmVyeSB0b3BcbiAgLy8gYW5kIG9yZGVyIHRoZSByZXN0IGFscGhhYmV0aWNhbGx5LlxuICByZXR1cm4gZGVmcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgaWYgKGEua2luZCA9PT0gVHlwZURlZktpbmQuU3RydWN0KSB7XG4gICAgICBpZiAoYi5raW5kID09PSBUeXBlRGVmS2luZC5TdHJ1Y3QpIHtcbiAgICAgICAgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSlcbiAgICAgIH1cbiAgICAgIHJldHVybiAtMVxuICAgIH0gZWxzZSBpZiAoYi5raW5kID09PSBUeXBlRGVmS2luZC5TdHJ1Y3QpIHtcbiAgICAgIHJldHVybiAxXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpXG4gICAgfVxuICB9KVxufVxuXG5mdW5jdGlvbiBwcmVwcm9jZXNzVHlwZURlZihkZWZzOiBUeXBlRGVmTGluZVtdKTogTWFwPHN0cmluZywgVHlwZURlZkxpbmVbXT4ge1xuICBjb25zdCBuYW1lc3BhY2VHcm91cGVkID0gbmV3IE1hcDxzdHJpbmcsIFR5cGVEZWZMaW5lW10+KClcbiAgY29uc3QgY2xhc3NEZWZzID0gbmV3IE1hcDxzdHJpbmcsIFR5cGVEZWZMaW5lPigpXG5cbiAgZm9yIChjb25zdCBkZWYgb2YgZGVmcykge1xuICAgIGNvbnN0IG5hbWVzcGFjZSA9IGRlZi5qc19tb2QgPz8gVE9QX0xFVkVMX05BTUVTUEFDRVxuICAgIGlmICghbmFtZXNwYWNlR3JvdXBlZC5oYXMobmFtZXNwYWNlKSkge1xuICAgICAgbmFtZXNwYWNlR3JvdXBlZC5zZXQobmFtZXNwYWNlLCBbXSlcbiAgICB9XG5cbiAgICBjb25zdCBncm91cCA9IG5hbWVzcGFjZUdyb3VwZWQuZ2V0KG5hbWVzcGFjZSkhXG5cbiAgICBpZiAoZGVmLmtpbmQgPT09IFR5cGVEZWZLaW5kLlN0cnVjdCkge1xuICAgICAgZ3JvdXAucHVzaChkZWYpXG4gICAgICBjbGFzc0RlZnMuc2V0KGRlZi5uYW1lLCBkZWYpXG4gICAgfSBlbHNlIGlmIChkZWYua2luZCA9PT0gVHlwZURlZktpbmQuRXh0ZW5kcykge1xuICAgICAgY29uc3QgY2xhc3NEZWYgPSBjbGFzc0RlZnMuZ2V0KGRlZi5uYW1lKVxuICAgICAgaWYgKGNsYXNzRGVmKSB7XG4gICAgICAgIGNsYXNzRGVmLmV4dGVuZHMgPSBkZWYuZGVmXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChkZWYua2luZCA9PT0gVHlwZURlZktpbmQuSW1wbCkge1xuICAgICAgLy8gbWVyZ2UgYGltcGxgIGludG8gY2xhc3MgZGVmaW5pdGlvblxuICAgICAgY29uc3QgY2xhc3NEZWYgPSBjbGFzc0RlZnMuZ2V0KGRlZi5uYW1lKVxuICAgICAgaWYgKGNsYXNzRGVmKSB7XG4gICAgICAgIGlmIChjbGFzc0RlZi5kZWYpIHtcbiAgICAgICAgICBjbGFzc0RlZi5kZWYgKz0gJ1xcbidcbiAgICAgICAgfVxuXG4gICAgICAgIGNsYXNzRGVmLmRlZiArPSBkZWYuZGVmXG4gICAgICAgIC8vIENvbnZlcnQgYW55IHJlbWFpbmluZyBcXG4gc2VxdWVuY2VzIGluIHRoZSBtZXJnZWQgZGVmIHRvIGFjdHVhbCBuZXdsaW5lc1xuICAgICAgICBpZiAoY2xhc3NEZWYuZGVmKSB7XG4gICAgICAgICAgY2xhc3NEZWYuZGVmID0gY2xhc3NEZWYuZGVmLnJlcGxhY2UoL1xcXFxuL2csICdcXG4nKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGdyb3VwLnB1c2goZGVmKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lc3BhY2VHcm91cGVkXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb3JyZWN0U3RyaW5nSWRlbnQoc3JjOiBzdHJpbmcsIGlkZW50OiBudW1iZXIpOiBzdHJpbmcge1xuICBsZXQgYnJhY2tldERlcHRoID0gMFxuICBjb25zdCByZXN1bHQgPSBzcmNcbiAgICAuc3BsaXQoJ1xcbicpXG4gICAgLm1hcCgobGluZSkgPT4ge1xuICAgICAgbGluZSA9IGxpbmUudHJpbSgpXG4gICAgICBpZiAobGluZSA9PT0gJycpIHtcbiAgICAgICAgcmV0dXJuICcnXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGlzSW5NdWx0aWxpbmVDb21tZW50ID0gbGluZS5zdGFydHNXaXRoKCcqJylcbiAgICAgIGNvbnN0IGlzQ2xvc2luZ0JyYWNrZXQgPSBsaW5lLmVuZHNXaXRoKCd9JylcbiAgICAgIGNvbnN0IGlzT3BlbmluZ0JyYWNrZXQgPSBsaW5lLmVuZHNXaXRoKCd7JylcbiAgICAgIGNvbnN0IGlzVHlwZURlY2xhcmF0aW9uID0gbGluZS5lbmRzV2l0aCgnPScpXG4gICAgICBjb25zdCBpc1R5cGVWYXJpYW50ID0gbGluZS5zdGFydHNXaXRoKCd8JylcblxuICAgICAgbGV0IHJpZ2h0SW5kZW50ID0gaWRlbnRcbiAgICAgIGlmICgoaXNPcGVuaW5nQnJhY2tldCB8fCBpc1R5cGVEZWNsYXJhdGlvbikgJiYgIWlzSW5NdWx0aWxpbmVDb21tZW50KSB7XG4gICAgICAgIGJyYWNrZXREZXB0aCArPSAxXG4gICAgICAgIHJpZ2h0SW5kZW50ICs9IChicmFja2V0RGVwdGggLSAxKSAqIDJcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBpc0Nsb3NpbmdCcmFja2V0ICYmXG4gICAgICAgICAgYnJhY2tldERlcHRoID4gMCAmJlxuICAgICAgICAgICFpc0luTXVsdGlsaW5lQ29tbWVudCAmJlxuICAgICAgICAgICFpc1R5cGVWYXJpYW50XG4gICAgICAgICkge1xuICAgICAgICAgIGJyYWNrZXREZXB0aCAtPSAxXG4gICAgICAgIH1cbiAgICAgICAgcmlnaHRJbmRlbnQgKz0gYnJhY2tldERlcHRoICogMlxuICAgICAgfVxuXG4gICAgICBpZiAoaXNJbk11bHRpbGluZUNvbW1lbnQpIHtcbiAgICAgICAgcmlnaHRJbmRlbnQgKz0gMVxuICAgICAgfVxuXG4gICAgICBjb25zdCBzID0gYCR7JyAnLnJlcGVhdChyaWdodEluZGVudCl9JHtsaW5lfWBcblxuICAgICAgcmV0dXJuIHNcbiAgICB9KVxuICAgIC5qb2luKCdcXG4nKVxuXG4gIHJldHVybiByZXN1bHRcbn1cbiIsImltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdub2RlOnBhdGgnXG5cbmltcG9ydCB7IHJlYWROYXBpQ29uZmlnIH0gZnJvbSAnLi9jb25maWcuanMnXG5cbmludGVyZmFjZSBNaW5pbWFsTmFwaU9wdGlvbnMge1xuICBjd2Q6IHN0cmluZ1xuICBjb25maWdQYXRoPzogc3RyaW5nXG4gIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZ1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVhZENvbmZpZyhvcHRpb25zOiBNaW5pbWFsTmFwaU9wdGlvbnMpIHtcbiAgY29uc3QgcmVzb2x2ZVBhdGggPSAoLi4ucGF0aHM6IHN0cmluZ1tdKSA9PiByZXNvbHZlKG9wdGlvbnMuY3dkLCAuLi5wYXRocylcbiAgY29uc3QgY29uZmlnID0gYXdhaXQgcmVhZE5hcGlDb25maWcoXG4gICAgcmVzb2x2ZVBhdGgob3B0aW9ucy5wYWNrYWdlSnNvblBhdGggPz8gJ3BhY2thZ2UuanNvbicpLFxuICAgIG9wdGlvbnMuY29uZmlnUGF0aCA/IHJlc29sdmVQYXRoKG9wdGlvbnMuY29uZmlnUGF0aCkgOiB1bmRlZmluZWQsXG4gIClcbiAgcmV0dXJuIGNvbmZpZ1xufVxuIiwiaW1wb3J0IHsgam9pbiwgcmVzb2x2ZSwgcGFyc2UgfSBmcm9tICdub2RlOnBhdGgnXG5cbmltcG9ydCAqIGFzIGNvbG9ycyBmcm9tICdjb2xvcmV0dGUnXG5cbmltcG9ydCB7XG4gIGFwcGx5RGVmYXVsdEFydGlmYWN0c09wdGlvbnMsXG4gIHR5cGUgQXJ0aWZhY3RzT3B0aW9ucyxcbn0gZnJvbSAnLi4vZGVmL2FydGlmYWN0cy5qcydcbmltcG9ydCB7XG4gIHJlYWROYXBpQ29uZmlnLFxuICBkZWJ1Z0ZhY3RvcnksXG4gIHJlYWRGaWxlQXN5bmMsXG4gIHdyaXRlRmlsZUFzeW5jLFxuICBVbmlBcmNoc0J5UGxhdGZvcm0sXG4gIHJlYWRkaXJBc3luYyxcbn0gZnJvbSAnLi4vdXRpbHMvaW5kZXguanMnXG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCdhcnRpZmFjdHMnKVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29sbGVjdEFydGlmYWN0cyh1c2VyT3B0aW9uczogQXJ0aWZhY3RzT3B0aW9ucykge1xuICBjb25zdCBvcHRpb25zID0gYXBwbHlEZWZhdWx0QXJ0aWZhY3RzT3B0aW9ucyh1c2VyT3B0aW9ucylcblxuICBjb25zdCByZXNvbHZlUGF0aCA9ICguLi5wYXRoczogc3RyaW5nW10pID0+IHJlc29sdmUob3B0aW9ucy5jd2QsIC4uLnBhdGhzKVxuICBjb25zdCBwYWNrYWdlSnNvblBhdGggPSByZXNvbHZlUGF0aChvcHRpb25zLnBhY2thZ2VKc29uUGF0aClcbiAgY29uc3QgeyB0YXJnZXRzLCBiaW5hcnlOYW1lLCBwYWNrYWdlTmFtZSB9ID0gYXdhaXQgcmVhZE5hcGlDb25maWcoXG4gICAgcGFja2FnZUpzb25QYXRoLFxuICAgIG9wdGlvbnMuY29uZmlnUGF0aCA/IHJlc29sdmVQYXRoKG9wdGlvbnMuY29uZmlnUGF0aCkgOiB1bmRlZmluZWQsXG4gIClcblxuICBjb25zdCBkaXN0RGlycyA9IHRhcmdldHMubWFwKChwbGF0Zm9ybSkgPT5cbiAgICBqb2luKG9wdGlvbnMuY3dkLCBvcHRpb25zLm5wbURpciwgcGxhdGZvcm0ucGxhdGZvcm1BcmNoQUJJKSxcbiAgKVxuXG4gIGNvbnN0IHVuaXZlcnNhbFNvdXJjZUJpbnMgPSBuZXcgU2V0KFxuICAgIHRhcmdldHNcbiAgICAgIC5maWx0ZXIoKHBsYXRmb3JtKSA9PiBwbGF0Zm9ybS5hcmNoID09PSAndW5pdmVyc2FsJylcbiAgICAgIC5mbGF0TWFwKChwKSA9PlxuICAgICAgICBVbmlBcmNoc0J5UGxhdGZvcm1bcC5wbGF0Zm9ybV0/Lm1hcCgoYSkgPT4gYCR7cC5wbGF0Zm9ybX0tJHthfWApLFxuICAgICAgKVxuICAgICAgLmZpbHRlcihCb29sZWFuKSBhcyBzdHJpbmdbXSxcbiAgKVxuXG4gIGF3YWl0IGNvbGxlY3ROb2RlQmluYXJpZXMoam9pbihvcHRpb25zLmN3ZCwgb3B0aW9ucy5vdXRwdXREaXIpKS50aGVuKFxuICAgIChvdXRwdXQpID0+XG4gICAgICBQcm9taXNlLmFsbChcbiAgICAgICAgb3V0cHV0Lm1hcChhc3luYyAoZmlsZVBhdGgpID0+IHtcbiAgICAgICAgICBkZWJ1Zy5pbmZvKGBSZWFkIFske2NvbG9ycy55ZWxsb3dCcmlnaHQoZmlsZVBhdGgpfV1gKVxuICAgICAgICAgIGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBhd2FpdCByZWFkRmlsZUFzeW5jKGZpbGVQYXRoKVxuICAgICAgICAgIGNvbnN0IHBhcnNlZE5hbWUgPSBwYXJzZShmaWxlUGF0aClcbiAgICAgICAgICBjb25zdCB0ZXJtcyA9IHBhcnNlZE5hbWUubmFtZS5zcGxpdCgnLicpXG4gICAgICAgICAgY29uc3QgcGxhdGZvcm1BcmNoQUJJID0gdGVybXMucG9wKCkhXG4gICAgICAgICAgY29uc3QgX2JpbmFyeU5hbWUgPSB0ZXJtcy5qb2luKCcuJylcblxuICAgICAgICAgIGlmIChfYmluYXJ5TmFtZSAhPT0gYmluYXJ5TmFtZSkge1xuICAgICAgICAgICAgZGVidWcud2FybihcbiAgICAgICAgICAgICAgYFske19iaW5hcnlOYW1lfV0gaXMgbm90IG1hdGNoZWQgd2l0aCBbJHtiaW5hcnlOYW1lfV0sIHNraXBgLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGRpciA9IGRpc3REaXJzLmZpbmQoKGRpcikgPT4gZGlyLmluY2x1ZGVzKHBsYXRmb3JtQXJjaEFCSSkpXG4gICAgICAgICAgaWYgKCFkaXIgJiYgdW5pdmVyc2FsU291cmNlQmlucy5oYXMocGxhdGZvcm1BcmNoQUJJKSkge1xuICAgICAgICAgICAgZGVidWcud2FybihcbiAgICAgICAgICAgICAgYFske3BsYXRmb3JtQXJjaEFCSX1dIGhhcyBubyBkaXN0IGRpciBidXQgaXQgaXMgc291cmNlIGJpbiBmb3IgdW5pdmVyc2FsIGFyY2gsIHNraXBgLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghZGlyKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIGRpc3QgZGlyIGZvdW5kIGZvciAke2ZpbGVQYXRofWApXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZGlzdEZpbGVQYXRoID0gam9pbihkaXIsIHBhcnNlZE5hbWUuYmFzZSlcbiAgICAgICAgICBkZWJ1Zy5pbmZvKFxuICAgICAgICAgICAgYFdyaXRlIGZpbGUgY29udGVudCB0byBbJHtjb2xvcnMueWVsbG93QnJpZ2h0KGRpc3RGaWxlUGF0aCl9XWAsXG4gICAgICAgICAgKVxuICAgICAgICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKGRpc3RGaWxlUGF0aCwgc291cmNlQ29udGVudClcbiAgICAgICAgICBjb25zdCBkaXN0RmlsZVBhdGhMb2NhbCA9IGpvaW4oXG4gICAgICAgICAgICBwYXJzZShwYWNrYWdlSnNvblBhdGgpLmRpcixcbiAgICAgICAgICAgIHBhcnNlZE5hbWUuYmFzZSxcbiAgICAgICAgICApXG4gICAgICAgICAgZGVidWcuaW5mbyhcbiAgICAgICAgICAgIGBXcml0ZSBmaWxlIGNvbnRlbnQgdG8gWyR7Y29sb3JzLnllbGxvd0JyaWdodChkaXN0RmlsZVBhdGhMb2NhbCl9XWAsXG4gICAgICAgICAgKVxuICAgICAgICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKGRpc3RGaWxlUGF0aExvY2FsLCBzb3VyY2VDb250ZW50KVxuICAgICAgICB9KSxcbiAgICAgICksXG4gIClcblxuICBjb25zdCB3YXNpVGFyZ2V0ID0gdGFyZ2V0cy5maW5kKCh0KSA9PiB0LnBsYXRmb3JtID09PSAnd2FzaScpXG4gIGlmICh3YXNpVGFyZ2V0KSB7XG4gICAgY29uc3QgYnVpbGRPdXRwdXREaXIgPSBvcHRpb25zLmJ1aWxkT3V0cHV0RGlyXG4gICAgICA/IHJlc29sdmUob3B0aW9ucy5jd2QsIG9wdGlvbnMuYnVpbGRPdXRwdXREaXIpXG4gICAgICA6IG9wdGlvbnMuY3dkXG4gICAgY29uc3Qgd2FzaURpciA9IGpvaW4oXG4gICAgICBvcHRpb25zLmN3ZCxcbiAgICAgIG9wdGlvbnMubnBtRGlyLFxuICAgICAgd2FzaVRhcmdldC5wbGF0Zm9ybUFyY2hBQkksXG4gICAgKVxuICAgIGNvbnN0IGNqc0ZpbGUgPSBqb2luKGJ1aWxkT3V0cHV0RGlyLCBgJHtiaW5hcnlOYW1lfS53YXNpLmNqc2ApXG4gICAgY29uc3Qgd29ya2VyRmlsZSA9IGpvaW4oYnVpbGRPdXRwdXREaXIsIGB3YXNpLXdvcmtlci5tanNgKVxuICAgIGNvbnN0IGJyb3dzZXJFbnRyeSA9IGpvaW4oYnVpbGRPdXRwdXREaXIsIGAke2JpbmFyeU5hbWV9Lndhc2ktYnJvd3Nlci5qc2ApXG4gICAgY29uc3QgYnJvd3NlcldvcmtlckZpbGUgPSBqb2luKGJ1aWxkT3V0cHV0RGlyLCBgd2FzaS13b3JrZXItYnJvd3Nlci5tanNgKVxuICAgIGRlYnVnLmluZm8oXG4gICAgICBgTW92ZSB3YXNpIGJpbmRpbmcgZmlsZSBbJHtjb2xvcnMueWVsbG93QnJpZ2h0KFxuICAgICAgICBjanNGaWxlLFxuICAgICAgKX1dIHRvIFske2NvbG9ycy55ZWxsb3dCcmlnaHQod2FzaURpcil9XWAsXG4gICAgKVxuICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKFxuICAgICAgam9pbih3YXNpRGlyLCBgJHtiaW5hcnlOYW1lfS53YXNpLmNqc2ApLFxuICAgICAgYXdhaXQgcmVhZEZpbGVBc3luYyhjanNGaWxlKSxcbiAgICApXG4gICAgZGVidWcuaW5mbyhcbiAgICAgIGBNb3ZlIHdhc2kgd29ya2VyIGZpbGUgWyR7Y29sb3JzLnllbGxvd0JyaWdodChcbiAgICAgICAgd29ya2VyRmlsZSxcbiAgICAgICl9XSB0byBbJHtjb2xvcnMueWVsbG93QnJpZ2h0KHdhc2lEaXIpfV1gLFxuICAgIClcbiAgICBhd2FpdCB3cml0ZUZpbGVBc3luYyhcbiAgICAgIGpvaW4od2FzaURpciwgYHdhc2ktd29ya2VyLm1qc2ApLFxuICAgICAgYXdhaXQgcmVhZEZpbGVBc3luYyh3b3JrZXJGaWxlKSxcbiAgICApXG4gICAgZGVidWcuaW5mbyhcbiAgICAgIGBNb3ZlIHdhc2kgYnJvd3NlciBlbnRyeSBmaWxlIFske2NvbG9ycy55ZWxsb3dCcmlnaHQoXG4gICAgICAgIGJyb3dzZXJFbnRyeSxcbiAgICAgICl9XSB0byBbJHtjb2xvcnMueWVsbG93QnJpZ2h0KHdhc2lEaXIpfV1gLFxuICAgIClcbiAgICBhd2FpdCB3cml0ZUZpbGVBc3luYyhcbiAgICAgIGpvaW4od2FzaURpciwgYCR7YmluYXJ5TmFtZX0ud2FzaS1icm93c2VyLmpzYCksXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vdml0ZWpzL3ZpdGUvaXNzdWVzLzg0MjdcbiAgICAgIChhd2FpdCByZWFkRmlsZUFzeW5jKGJyb3dzZXJFbnRyeSwgJ3V0ZjgnKSkucmVwbGFjZShcbiAgICAgICAgYG5ldyBVUkwoJy4vd2FzaS13b3JrZXItYnJvd3Nlci5tanMnLCBpbXBvcnQubWV0YS51cmwpYCxcbiAgICAgICAgYG5ldyBVUkwoJyR7cGFja2FnZU5hbWV9LXdhc20zMi13YXNpL3dhc2ktd29ya2VyLWJyb3dzZXIubWpzJywgaW1wb3J0Lm1ldGEudXJsKWAsXG4gICAgICApLFxuICAgIClcbiAgICBkZWJ1Zy5pbmZvKFxuICAgICAgYE1vdmUgd2FzaSBicm93c2VyIHdvcmtlciBmaWxlIFske2NvbG9ycy55ZWxsb3dCcmlnaHQoXG4gICAgICAgIGJyb3dzZXJXb3JrZXJGaWxlLFxuICAgICAgKX1dIHRvIFske2NvbG9ycy55ZWxsb3dCcmlnaHQod2FzaURpcil9XWAsXG4gICAgKVxuICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKFxuICAgICAgam9pbih3YXNpRGlyLCBgd2FzaS13b3JrZXItYnJvd3Nlci5tanNgKSxcbiAgICAgIGF3YWl0IHJlYWRGaWxlQXN5bmMoYnJvd3NlcldvcmtlckZpbGUpLFxuICAgIClcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBjb2xsZWN0Tm9kZUJpbmFyaWVzKHJvb3Q6IHN0cmluZykge1xuICBjb25zdCBmaWxlcyA9IGF3YWl0IHJlYWRkaXJBc3luYyhyb290LCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcbiAgY29uc3Qgbm9kZUJpbmFyaWVzID0gZmlsZXNcbiAgICAuZmlsdGVyKFxuICAgICAgKGZpbGUpID0+XG4gICAgICAgIGZpbGUuaXNGaWxlKCkgJiZcbiAgICAgICAgKGZpbGUubmFtZS5lbmRzV2l0aCgnLm5vZGUnKSB8fCBmaWxlLm5hbWUuZW5kc1dpdGgoJy53YXNtJykpLFxuICAgIClcbiAgICAubWFwKChmaWxlKSA9PiBqb2luKHJvb3QsIGZpbGUubmFtZSkpXG5cbiAgY29uc3QgZGlycyA9IGZpbGVzLmZpbHRlcigoZmlsZSkgPT4gZmlsZS5pc0RpcmVjdG9yeSgpKVxuICBmb3IgKGNvbnN0IGRpciBvZiBkaXJzKSB7XG4gICAgaWYgKGRpci5uYW1lICE9PSAnbm9kZV9tb2R1bGVzJykge1xuICAgICAgbm9kZUJpbmFyaWVzLnB1c2goLi4uKGF3YWl0IGNvbGxlY3ROb2RlQmluYXJpZXMoam9pbihyb290LCBkaXIubmFtZSkpKSlcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5vZGVCaW5hcmllc1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNqc0JpbmRpbmcoXG4gIGxvY2FsTmFtZTogc3RyaW5nLFxuICBwa2dOYW1lOiBzdHJpbmcsXG4gIGlkZW50czogc3RyaW5nW10sXG4gIHBhY2thZ2VWZXJzaW9uPzogc3RyaW5nLFxuKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAke2JpbmRpbmdIZWFkZXJ9XG4ke2NyZWF0ZUNvbW1vbkJpbmRpbmcobG9jYWxOYW1lLCBwa2dOYW1lLCBwYWNrYWdlVmVyc2lvbil9XG5tb2R1bGUuZXhwb3J0cyA9IG5hdGl2ZUJpbmRpbmdcbiR7aWRlbnRzXG4gIC5tYXAoKGlkZW50KSA9PiBgbW9kdWxlLmV4cG9ydHMuJHtpZGVudH0gPSBuYXRpdmVCaW5kaW5nLiR7aWRlbnR9YClcbiAgLmpvaW4oJ1xcbicpfVxuYFxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRXNtQmluZGluZyhcbiAgbG9jYWxOYW1lOiBzdHJpbmcsXG4gIHBrZ05hbWU6IHN0cmluZyxcbiAgaWRlbnRzOiBzdHJpbmdbXSxcbiAgcGFja2FnZVZlcnNpb24/OiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICByZXR1cm4gYCR7YmluZGluZ0hlYWRlcn1cbmltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdtb2R1bGUnXG5jb25zdCByZXF1aXJlID0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpXG5jb25zdCBfX2Rpcm5hbWUgPSBuZXcgVVJMKCcuJywgaW1wb3J0Lm1ldGEudXJsKS5wYXRobmFtZVxuXG4ke2NyZWF0ZUNvbW1vbkJpbmRpbmcobG9jYWxOYW1lLCBwa2dOYW1lLCBwYWNrYWdlVmVyc2lvbil9XG5jb25zdCB7ICR7aWRlbnRzLmpvaW4oJywgJyl9IH0gPSBuYXRpdmVCaW5kaW5nXG4ke2lkZW50cy5tYXAoKGlkZW50KSA9PiBgZXhwb3J0IHsgJHtpZGVudH0gfWApLmpvaW4oJ1xcbicpfVxuYFxufVxuXG5jb25zdCBiaW5kaW5nSGVhZGVyID0gYC8vIHByZXR0aWVyLWlnbm9yZVxuLyogZXNsaW50LWRpc2FibGUgKi9cbi8vIEB0cy1ub2NoZWNrXG4vKiBhdXRvLWdlbmVyYXRlZCBieSBOQVBJLVJTICovXG5gXG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbW1vbkJpbmRpbmcoXG4gIGxvY2FsTmFtZTogc3RyaW5nLFxuICBwa2dOYW1lOiBzdHJpbmcsXG4gIHBhY2thZ2VWZXJzaW9uPzogc3RyaW5nLFxuKTogc3RyaW5nIHtcbiAgZnVuY3Rpb24gcmVxdWlyZVR1cGxlKHR1cGxlOiBzdHJpbmcsIGlkZW50U2l6ZSA9IDgpIHtcbiAgICBjb25zdCBpZGVudExvdyA9ICcgJy5yZXBlYXQoaWRlbnRTaXplIC0gMilcbiAgICBjb25zdCBpZGVudCA9ICcgJy5yZXBlYXQoaWRlbnRTaXplKVxuICAgIGNvbnN0IHZlcnNpb25DaGVjayA9IHBhY2thZ2VWZXJzaW9uXG4gICAgICA/IGBcbiR7aWRlbnRMb3d9dHJ5IHtcbiR7aWRlbnR9Y29uc3QgYmluZGluZyA9IHJlcXVpcmUoJyR7cGtnTmFtZX0tJHt0dXBsZX0nKVxuJHtpZGVudH1jb25zdCBiaW5kaW5nUGFja2FnZVZlcnNpb24gPSByZXF1aXJlKCcke3BrZ05hbWV9LSR7dHVwbGV9L3BhY2thZ2UuanNvbicpLnZlcnNpb25cbiR7aWRlbnR9aWYgKGJpbmRpbmdQYWNrYWdlVmVyc2lvbiAhPT0gJyR7cGFja2FnZVZlcnNpb259JyAmJiBwcm9jZXNzLmVudi5OQVBJX1JTX0VORk9SQ0VfVkVSU0lPTl9DSEVDSyAmJiBwcm9jZXNzLmVudi5OQVBJX1JTX0VORk9SQ0VfVkVSU0lPTl9DSEVDSyAhPT0gJzAnKSB7XG4ke2lkZW50fSAgdGhyb3cgbmV3IEVycm9yKFxcYE5hdGl2ZSBiaW5kaW5nIHBhY2thZ2UgdmVyc2lvbiBtaXNtYXRjaCwgZXhwZWN0ZWQgJHtwYWNrYWdlVmVyc2lvbn0gYnV0IGdvdCBcXCR7YmluZGluZ1BhY2thZ2VWZXJzaW9ufS4gWW91IGNhbiByZWluc3RhbGwgZGVwZW5kZW5jaWVzIHRvIGZpeCB0aGlzIGlzc3VlLlxcYClcbiR7aWRlbnR9fVxuJHtpZGVudH1yZXR1cm4gYmluZGluZ1xuJHtpZGVudExvd319IGNhdGNoIChlKSB7XG4ke2lkZW50fWxvYWRFcnJvcnMucHVzaChlKVxuJHtpZGVudExvd319YFxuICAgICAgOiBgXG4ke2lkZW50TG93fXRyeSB7XG4ke2lkZW50fXJldHVybiByZXF1aXJlKCcke3BrZ05hbWV9LSR7dHVwbGV9JylcbiR7aWRlbnRMb3d9fSBjYXRjaCAoZSkge1xuJHtpZGVudH1sb2FkRXJyb3JzLnB1c2goZSlcbiR7aWRlbnRMb3d9fWBcbiAgICByZXR1cm4gYHRyeSB7XG4ke2lkZW50fXJldHVybiByZXF1aXJlKCcuLyR7bG9jYWxOYW1lfS4ke3R1cGxlfS5ub2RlJylcbiR7aWRlbnRMb3d9fSBjYXRjaCAoZSkge1xuJHtpZGVudH1sb2FkRXJyb3JzLnB1c2goZSlcbiR7aWRlbnRMb3d9fSR7dmVyc2lvbkNoZWNrfWBcbiAgfVxuXG4gIHJldHVybiBgY29uc3QgeyByZWFkRmlsZVN5bmMgfSA9IHJlcXVpcmUoJ2ZzJylcbmxldCBuYXRpdmVCaW5kaW5nID0gbnVsbFxuY29uc3QgbG9hZEVycm9ycyA9IFtdXG5cbmNvbnN0IGlzTXVzbCA9ICgpID0+IHtcbiAgbGV0IG11c2wgPSBmYWxzZVxuICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgIG11c2wgPSBpc011c2xGcm9tRmlsZXN5c3RlbSgpXG4gICAgaWYgKG11c2wgPT09IG51bGwpIHtcbiAgICAgIG11c2wgPSBpc011c2xGcm9tUmVwb3J0KClcbiAgICB9XG4gICAgaWYgKG11c2wgPT09IG51bGwpIHtcbiAgICAgIG11c2wgPSBpc011c2xGcm9tQ2hpbGRQcm9jZXNzKClcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG11c2xcbn1cblxuY29uc3QgaXNGaWxlTXVzbCA9IChmKSA9PiBmLmluY2x1ZGVzKCdsaWJjLm11c2wtJykgfHwgZi5pbmNsdWRlcygnbGQtbXVzbC0nKVxuXG5jb25zdCBpc011c2xGcm9tRmlsZXN5c3RlbSA9ICgpID0+IHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcmVhZEZpbGVTeW5jKCcvdXNyL2Jpbi9sZGQnLCAndXRmLTgnKS5pbmNsdWRlcygnbXVzbCcpXG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsXG4gIH1cbn1cblxuY29uc3QgaXNNdXNsRnJvbVJlcG9ydCA9ICgpID0+IHtcbiAgbGV0IHJlcG9ydCA9IG51bGxcbiAgaWYgKHByb2Nlc3MucmVwb3J0ICYmIHR5cGVvZiBwcm9jZXNzLnJlcG9ydC5nZXRSZXBvcnQgPT09ICdmdW5jdGlvbicpIHtcbiAgICBwcm9jZXNzLnJlcG9ydC5leGNsdWRlTmV0d29yayA9IHRydWVcbiAgICByZXBvcnQgPSBwcm9jZXNzLnJlcG9ydC5nZXRSZXBvcnQoKVxuICB9XG4gIGlmICghcmVwb3J0KSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuICBpZiAocmVwb3J0LmhlYWRlciAmJiByZXBvcnQuaGVhZGVyLmdsaWJjVmVyc2lvblJ1bnRpbWUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheShyZXBvcnQuc2hhcmVkT2JqZWN0cykpIHtcbiAgICBpZiAocmVwb3J0LnNoYXJlZE9iamVjdHMuc29tZShpc0ZpbGVNdXNsKSkge1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlXG59XG5cbmNvbnN0IGlzTXVzbEZyb21DaGlsZFByb2Nlc3MgPSAoKSA9PiB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKS5leGVjU3luYygnbGRkIC0tdmVyc2lvbicsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KS5pbmNsdWRlcygnbXVzbCcpXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBJZiB3ZSByZWFjaCB0aGlzIGNhc2UsIHdlIGRvbid0IGtub3cgaWYgdGhlIHN5c3RlbSBpcyBtdXNsIG9yIG5vdCwgc28gaXMgYmV0dGVyIHRvIGp1c3QgZmFsbGJhY2sgdG8gZmFsc2VcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5mdW5jdGlvbiByZXF1aXJlTmF0aXZlKCkge1xuICBpZiAocHJvY2Vzcy5lbnYuTkFQSV9SU19OQVRJVkVfTElCUkFSWV9QQVRIKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiByZXF1aXJlKHByb2Nlc3MuZW52Lk5BUElfUlNfTkFUSVZFX0xJQlJBUllfUEFUSCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBsb2FkRXJyb3JzLnB1c2goZXJyKVxuICAgIH1cbiAgfSBlbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnYW5kcm9pZCcpIHtcbiAgICBpZiAocHJvY2Vzcy5hcmNoID09PSAnYXJtNjQnKSB7XG4gICAgICAke3JlcXVpcmVUdXBsZSgnYW5kcm9pZC1hcm02NCcpfVxuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5hcmNoID09PSAnYXJtJykge1xuICAgICAgJHtyZXF1aXJlVHVwbGUoJ2FuZHJvaWQtYXJtLWVhYmknKX1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9hZEVycm9ycy5wdXNoKG5ldyBFcnJvcihcXGBVbnN1cHBvcnRlZCBhcmNoaXRlY3R1cmUgb24gQW5kcm9pZCBcXCR7cHJvY2Vzcy5hcmNofVxcYCkpXG4gICAgfVxuICB9IGVsc2UgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcbiAgICBpZiAocHJvY2Vzcy5hcmNoID09PSAneDY0Jykge1xuICAgICAgaWYgKChwcm9jZXNzLmNvbmZpZyAmJiBwcm9jZXNzLmNvbmZpZy52YXJpYWJsZXMgJiYgcHJvY2Vzcy5jb25maWcudmFyaWFibGVzLnNobGliX3N1ZmZpeCA9PT0gJ2RsbC5hJykgfHwgKHByb2Nlc3MuY29uZmlnICYmIHByb2Nlc3MuY29uZmlnLnZhcmlhYmxlcyAmJiBwcm9jZXNzLmNvbmZpZy52YXJpYWJsZXMubm9kZV90YXJnZXRfdHlwZSA9PT0gJ3NoYXJlZF9saWJyYXJ5JykpIHtcbiAgICAgICAgJHtyZXF1aXJlVHVwbGUoJ3dpbjMyLXg2NC1nbnUnKX1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICR7cmVxdWlyZVR1cGxlKCd3aW4zMi14NjQtbXN2YycpfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5hcmNoID09PSAnaWEzMicpIHtcbiAgICAgICR7cmVxdWlyZVR1cGxlKCd3aW4zMi1pYTMyLW1zdmMnKX1cbiAgICB9IGVsc2UgaWYgKHByb2Nlc3MuYXJjaCA9PT0gJ2FybTY0Jykge1xuICAgICAgJHtyZXF1aXJlVHVwbGUoJ3dpbjMyLWFybTY0LW1zdmMnKX1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9hZEVycm9ycy5wdXNoKG5ldyBFcnJvcihcXGBVbnN1cHBvcnRlZCBhcmNoaXRlY3R1cmUgb24gV2luZG93czogXFwke3Byb2Nlc3MuYXJjaH1cXGApKVxuICAgIH1cbiAgfSBlbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuICAgICR7cmVxdWlyZVR1cGxlKCdkYXJ3aW4tdW5pdmVyc2FsJywgNil9XG4gICAgaWYgKHByb2Nlc3MuYXJjaCA9PT0gJ3g2NCcpIHtcbiAgICAgICR7cmVxdWlyZVR1cGxlKCdkYXJ3aW4teDY0Jyl9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICdhcm02NCcpIHtcbiAgICAgICR7cmVxdWlyZVR1cGxlKCdkYXJ3aW4tYXJtNjQnKX1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9hZEVycm9ycy5wdXNoKG5ldyBFcnJvcihcXGBVbnN1cHBvcnRlZCBhcmNoaXRlY3R1cmUgb24gbWFjT1M6IFxcJHtwcm9jZXNzLmFyY2h9XFxgKSlcbiAgICB9XG4gIH0gZWxzZSBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2ZyZWVic2QnKSB7XG4gICAgaWYgKHByb2Nlc3MuYXJjaCA9PT0gJ3g2NCcpIHtcbiAgICAgICR7cmVxdWlyZVR1cGxlKCdmcmVlYnNkLXg2NCcpfVxuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5hcmNoID09PSAnYXJtNjQnKSB7XG4gICAgICAke3JlcXVpcmVUdXBsZSgnZnJlZWJzZC1hcm02NCcpfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2FkRXJyb3JzLnB1c2gobmV3IEVycm9yKFxcYFVuc3VwcG9ydGVkIGFyY2hpdGVjdHVyZSBvbiBGcmVlQlNEOiBcXCR7cHJvY2Vzcy5hcmNofVxcYCkpXG4gICAgfVxuICB9IGVsc2UgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgICBpZiAocHJvY2Vzcy5hcmNoID09PSAneDY0Jykge1xuICAgICAgaWYgKGlzTXVzbCgpKSB7XG4gICAgICAgICR7cmVxdWlyZVR1cGxlKCdsaW51eC14NjQtbXVzbCcsIDEwKX1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICR7cmVxdWlyZVR1cGxlKCdsaW51eC14NjQtZ251JywgMTApfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5hcmNoID09PSAnYXJtNjQnKSB7XG4gICAgICBpZiAoaXNNdXNsKCkpIHtcbiAgICAgICAgJHtyZXF1aXJlVHVwbGUoJ2xpbnV4LWFybTY0LW11c2wnLCAxMCl9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAke3JlcXVpcmVUdXBsZSgnbGludXgtYXJtNjQtZ251JywgMTApfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5hcmNoID09PSAnYXJtJykge1xuICAgICAgaWYgKGlzTXVzbCgpKSB7XG4gICAgICAgICR7cmVxdWlyZVR1cGxlKCdsaW51eC1hcm0tbXVzbGVhYmloZicsIDEwKX1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICR7cmVxdWlyZVR1cGxlKCdsaW51eC1hcm0tZ251ZWFiaWhmJywgMTApfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5hcmNoID09PSAnbG9vbmc2NCcpIHtcbiAgICAgIGlmIChpc011c2woKSkge1xuICAgICAgICAke3JlcXVpcmVUdXBsZSgnbGludXgtbG9vbmc2NC1tdXNsJywgMTApfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgJHtyZXF1aXJlVHVwbGUoJ2xpbnV4LWxvb25nNjQtZ251JywgMTApfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5hcmNoID09PSAncmlzY3Y2NCcpIHtcbiAgICAgIGlmIChpc011c2woKSkge1xuICAgICAgICAke3JlcXVpcmVUdXBsZSgnbGludXgtcmlzY3Y2NC1tdXNsJywgMTApfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgJHtyZXF1aXJlVHVwbGUoJ2xpbnV4LXJpc2N2NjQtZ251JywgMTApfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5hcmNoID09PSAncHBjNjQnKSB7XG4gICAgICAke3JlcXVpcmVUdXBsZSgnbGludXgtcHBjNjQtZ251Jyl9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICdzMzkweCcpIHtcbiAgICAgICR7cmVxdWlyZVR1cGxlKCdsaW51eC1zMzkweC1nbnUnKX1cbiAgICB9IGVsc2Uge1xuICAgICAgbG9hZEVycm9ycy5wdXNoKG5ldyBFcnJvcihcXGBVbnN1cHBvcnRlZCBhcmNoaXRlY3R1cmUgb24gTGludXg6IFxcJHtwcm9jZXNzLmFyY2h9XFxgKSlcbiAgICB9XG4gIH0gZWxzZSBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ29wZW5oYXJtb255Jykge1xuICAgIGlmIChwcm9jZXNzLmFyY2ggPT09ICdhcm02NCcpIHtcbiAgICAgICR7cmVxdWlyZVR1cGxlKCdvcGVuaGFybW9ueS1hcm02NCcpfVxuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5hcmNoID09PSAneDY0Jykge1xuICAgICAgJHtyZXF1aXJlVHVwbGUoJ29wZW5oYXJtb255LXg2NCcpfVxuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5hcmNoID09PSAnYXJtJykge1xuICAgICAgJHtyZXF1aXJlVHVwbGUoJ29wZW5oYXJtb255LWFybScpfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2FkRXJyb3JzLnB1c2gobmV3IEVycm9yKFxcYFVuc3VwcG9ydGVkIGFyY2hpdGVjdHVyZSBvbiBPcGVuSGFybW9ueTogXFwke3Byb2Nlc3MuYXJjaH1cXGApKVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBsb2FkRXJyb3JzLnB1c2gobmV3IEVycm9yKFxcYFVuc3VwcG9ydGVkIE9TOiBcXCR7cHJvY2Vzcy5wbGF0Zm9ybX0sIGFyY2hpdGVjdHVyZTogXFwke3Byb2Nlc3MuYXJjaH1cXGApKVxuICB9XG59XG5cbm5hdGl2ZUJpbmRpbmcgPSByZXF1aXJlTmF0aXZlKClcblxuLy8gTkFQSV9SU19GT1JDRV9XQVNJIGlzIGEgdHJpLXN0YXRlIGZsYWc6XG4vLyAgIHVuc2V0IC8gYW55IG90aGVyIHZhbHVlIOKGkiBuYXRpdmUgYmluZGluZyBwcmVmZXJyZWQsIFdBU0kgaXMgb25seSBhIGZhbGxiYWNrXG4vLyAgICd0cnVlJyAgICAgICAgICAgICAgICAgICDihpIgZm9yY2UgV0FTSSBmYWxsYmFjayBldmVuIGlmIG5hdGl2ZSBsb2FkZWRcbi8vICAgJ2Vycm9yJyAgICAgICAgICAgICAgICAgIOKGkiBmb3JjZSBXQVNJIGFuZCB0aHJvdyBpZiBubyBXQVNJIGJpbmRpbmcgaXMgZm91bmRcbi8vIFRyZWF0aW5nIGFueSBub24tZW1wdHkgc3RyaW5nIGFzIHRydXRoeSAodGhlIGhpc3RvcmljYWwgYmVoYXZpb3IpIG1lYW50XG4vLyBOQVBJX1JTX0ZPUkNFX1dBU0k9ZmFsc2UsIE5BUElfUlNfRk9SQ0VfV0FTST0wLCBldGMuIGluYWR2ZXJ0ZW50bHkgdHJpZ2dlcmVkXG4vLyB0aGUgV0FTSSBwYXRoLCBjYXVzaW5nIEVOT0VOVCBmb3IgcGFja2FnZXMgc2hpcHBlZCB3aXRob3V0IGEgLndhc2kuY2pzIGZpbGUuXG5jb25zdCBmb3JjZVdhc2kgPVxuICBwcm9jZXNzLmVudi5OQVBJX1JTX0ZPUkNFX1dBU0kgPT09ICd0cnVlJyB8fCBwcm9jZXNzLmVudi5OQVBJX1JTX0ZPUkNFX1dBU0kgPT09ICdlcnJvcidcblxuaWYgKCFuYXRpdmVCaW5kaW5nIHx8IGZvcmNlV2FzaSkge1xuICBsZXQgd2FzaUJpbmRpbmcgPSBudWxsXG4gIGxldCB3YXNpQmluZGluZ0Vycm9yID0gbnVsbFxuICB0cnkge1xuICAgIHdhc2lCaW5kaW5nID0gcmVxdWlyZSgnLi8ke2xvY2FsTmFtZX0ud2FzaS5janMnKVxuICAgIG5hdGl2ZUJpbmRpbmcgPSB3YXNpQmluZGluZ1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZm9yY2VXYXNpKSB7XG4gICAgICB3YXNpQmluZGluZ0Vycm9yID0gZXJyXG4gICAgfVxuICB9XG4gIGlmICghbmF0aXZlQmluZGluZyB8fCBmb3JjZVdhc2kpIHtcbiAgICB0cnkge1xuICAgICAgd2FzaUJpbmRpbmcgPSByZXF1aXJlKCcke3BrZ05hbWV9LXdhc20zMi13YXNpJylcbiAgICAgIG5hdGl2ZUJpbmRpbmcgPSB3YXNpQmluZGluZ1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGZvcmNlV2FzaSkge1xuICAgICAgICBpZiAoIXdhc2lCaW5kaW5nRXJyb3IpIHtcbiAgICAgICAgICB3YXNpQmluZGluZ0Vycm9yID0gZXJyXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgd2FzaUJpbmRpbmdFcnJvci5jYXVzZSA9IGVyclxuICAgICAgICB9XG4gICAgICAgIGxvYWRFcnJvcnMucHVzaChlcnIpXG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChwcm9jZXNzLmVudi5OQVBJX1JTX0ZPUkNFX1dBU0kgPT09ICdlcnJvcicgJiYgIXdhc2lCaW5kaW5nKSB7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoJ1dBU0kgYmluZGluZyBub3QgZm91bmQgYW5kIE5BUElfUlNfRk9SQ0VfV0FTSSBpcyBzZXQgdG8gZXJyb3InKVxuICAgIGVycm9yLmNhdXNlID0gd2FzaUJpbmRpbmdFcnJvclxuICAgIHRocm93IGVycm9yXG4gIH1cbn1cblxuaWYgKCFuYXRpdmVCaW5kaW5nKSB7XG4gIGlmIChsb2FkRXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihcbiAgICAgIFxcYENhbm5vdCBmaW5kIG5hdGl2ZSBiaW5kaW5nLiBcXGAgK1xuICAgICAgICBcXGBucG0gaGFzIGEgYnVnIHJlbGF0ZWQgdG8gb3B0aW9uYWwgZGVwZW5kZW5jaWVzIChodHRwczovL2dpdGh1Yi5jb20vbnBtL2NsaS9pc3N1ZXMvNDgyOCkuIFxcYCArXG4gICAgICAgICdQbGVhc2UgdHJ5IFxcYG5wbSBpXFxgIGFnYWluIGFmdGVyIHJlbW92aW5nIGJvdGggcGFja2FnZS1sb2NrLmpzb24gYW5kIG5vZGVfbW9kdWxlcyBkaXJlY3RvcnkuJyxcbiAgICApXG4gICAgLy8gYXNzaWduIGluc3RlYWQgb2YgdGhlIFxcYG5ldyBFcnJvcihtZXNzYWdlLCB7IGNhdXNlIH0pXFxgIG9wdGlvbnMgZm9ybSxcbiAgICAvLyB3aGljaCBOb2RlIDwgMTYuOSBzaWxlbnRseSBpZ25vcmVzXG4gICAgZXJyb3IuY2F1c2UgPSBsb2FkRXJyb3JzLnJlZHVjZSgoZXJyLCBjdXIpID0+IHtcbiAgICAgIGN1ci5jYXVzZSA9IGVyclxuICAgICAgcmV0dXJuIGN1clxuICAgIH0pXG4gICAgdGhyb3cgZXJyb3JcbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoXFxgRmFpbGVkIHRvIGxvYWQgbmF0aXZlIGJpbmRpbmdcXGApXG59XG5gXG59XG4iLCJleHBvcnQgY29uc3QgY3JlYXRlV2FzaUJyb3dzZXJCaW5kaW5nID0gKFxuICB3YXNpRmlsZW5hbWU6IHN0cmluZyxcbiAgaW5pdGlhbE1lbW9yeSA9IDQwMDAsXG4gIG1heGltdW1NZW1vcnkgPSA2NTUzNixcbiAgZnMgPSBmYWxzZSxcbiAgYXN5bmNJbml0ID0gZmFsc2UsXG4gIGJ1ZmZlciA9IGZhbHNlLFxuICBlcnJvckV2ZW50ID0gZmFsc2UsXG4pID0+IHtcbiAgY29uc3QgZnNJbXBvcnQgPSBmc1xuICAgID8gYnVmZmVyXG4gICAgICA/IGBpbXBvcnQgeyBtZW1mcywgQnVmZmVyIH0gZnJvbSAnQG5hcGktcnMvd2FzbS1ydW50aW1lL2ZzJ2BcbiAgICAgIDogYGltcG9ydCB7IG1lbWZzIH0gZnJvbSAnQG5hcGktcnMvd2FzbS1ydW50aW1lL2ZzJ2BcbiAgICA6ICcnXG4gIGNvbnN0IGJ1ZmZlckltcG9ydCA9IGJ1ZmZlciAmJiAhZnMgPyBgaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSAnYnVmZmVyJ2AgOiAnJ1xuICBjb25zdCB3YXNpQ3JlYXRpb24gPSBmc1xuICAgID8gYFxuZXhwb3J0IGNvbnN0IHsgZnM6IF9fZnMsIHZvbDogX192b2x1bWUgfSA9IG1lbWZzKClcblxuY29uc3QgX193YXNpID0gbmV3IF9fV0FTSSh7XG4gIHZlcnNpb246ICdwcmV2aWV3MScsXG4gIGZzOiBfX2ZzLFxuICBwcmVvcGVuczoge1xuICAgICcvJzogJy8nLFxuICB9LFxufSlgXG4gICAgOiBgXG5jb25zdCBfX3dhc2kgPSBuZXcgX19XQVNJKHtcbiAgdmVyc2lvbjogJ3ByZXZpZXcxJyxcbn0pYFxuXG4gIGNvbnN0IHdvcmtlckZzSGFuZGxlciA9IGZzXG4gICAgPyBgICAgIHdvcmtlci5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgX193YXNtQ3JlYXRlT25NZXNzYWdlRm9yRnNQcm94eShfX2ZzKSlcXG5gXG4gICAgOiAnJ1xuXG4gIGNvbnN0IHdvcmtlckVycm9ySGFuZGxlciA9IGVycm9yRXZlbnRcbiAgICA/IGAgICAgd29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCAoZXZlbnQpID0+IHtcbiAgICAgIGlmIChldmVudC5kYXRhICYmIHR5cGVvZiBldmVudC5kYXRhID09PSAnb2JqZWN0JyAmJiBldmVudC5kYXRhLnR5cGUgPT09ICdlcnJvcicpIHtcbiAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCduYXBpLXJzLXdvcmtlci1lcnJvcicsIHsgZGV0YWlsOiBldmVudC5kYXRhIH0pKVxuICAgICAgfVxuICAgIH0pXG5gXG4gICAgOiAnJ1xuXG4gIGNvbnN0IGVtbmFwaUluamVjdEJ1ZmZlciA9IGJ1ZmZlclxuICAgID8gJ19fZW1uYXBpQ29udGV4dC5mZWF0dXJlLkJ1ZmZlciA9IEJ1ZmZlcidcbiAgICA6ICcnXG4gIGNvbnN0IGVtbmFwaUluc3RhbnRpYXRlSW1wb3J0ID0gYXN5bmNJbml0XG4gICAgPyBgaW5zdGFudGlhdGVOYXBpTW9kdWxlIGFzIF9fZW1uYXBpSW5zdGFudGlhdGVOYXBpTW9kdWxlYFxuICAgIDogYGluc3RhbnRpYXRlTmFwaU1vZHVsZVN5bmMgYXMgX19lbW5hcGlJbnN0YW50aWF0ZU5hcGlNb2R1bGVTeW5jYFxuICBjb25zdCBlbW5hcGlJbnN0YW50aWF0ZUNhbGwgPSBhc3luY0luaXRcbiAgICA/IGBhd2FpdCBfX2VtbmFwaUluc3RhbnRpYXRlTmFwaU1vZHVsZWBcbiAgICA6IGBfX2VtbmFwaUluc3RhbnRpYXRlTmFwaU1vZHVsZVN5bmNgXG5cbiAgcmV0dXJuIGBpbXBvcnQge1xuICBjcmVhdGVPbk1lc3NhZ2UgYXMgX193YXNtQ3JlYXRlT25NZXNzYWdlRm9yRnNQcm94eSxcbiAgZ2V0RGVmYXVsdENvbnRleHQgYXMgX19lbW5hcGlHZXREZWZhdWx0Q29udGV4dCxcbiAgJHtlbW5hcGlJbnN0YW50aWF0ZUltcG9ydH0sXG4gIFdBU0kgYXMgX19XQVNJLFxufSBmcm9tICdAbmFwaS1ycy93YXNtLXJ1bnRpbWUnXG4ke2ZzSW1wb3J0fVxuJHtidWZmZXJJbXBvcnR9XG4ke3dhc2lDcmVhdGlvbn1cblxuY29uc3QgX193YXNtVXJsID0gbmV3IFVSTCgnLi8ke3dhc2lGaWxlbmFtZX0ud2FzbScsIGltcG9ydC5tZXRhLnVybCkuaHJlZlxuY29uc3QgX19lbW5hcGlDb250ZXh0ID0gX19lbW5hcGlHZXREZWZhdWx0Q29udGV4dCgpXG4ke2VtbmFwaUluamVjdEJ1ZmZlcn1cblxuY29uc3QgX19zaGFyZWRNZW1vcnkgPSBuZXcgV2ViQXNzZW1ibHkuTWVtb3J5KHtcbiAgaW5pdGlhbDogJHtpbml0aWFsTWVtb3J5fSxcbiAgbWF4aW11bTogJHttYXhpbXVtTWVtb3J5fSxcbiAgc2hhcmVkOiB0cnVlLFxufSlcblxuY29uc3QgX193YXNtRmlsZSA9IGF3YWl0IGZldGNoKF9fd2FzbVVybCkudGhlbigocmVzKSA9PiByZXMuYXJyYXlCdWZmZXIoKSlcblxuY29uc3Qge1xuICBpbnN0YW5jZTogX19uYXBpSW5zdGFuY2UsXG4gIG1vZHVsZTogX193YXNpTW9kdWxlLFxuICBuYXBpTW9kdWxlOiBfX25hcGlNb2R1bGUsXG59ID0gJHtlbW5hcGlJbnN0YW50aWF0ZUNhbGx9KF9fd2FzbUZpbGUsIHtcbiAgY29udGV4dDogX19lbW5hcGlDb250ZXh0LFxuICBhc3luY1dvcmtQb29sU2l6ZTogNCxcbiAgd2FzaTogX193YXNpLFxuICBvbkNyZWF0ZVdvcmtlcigpIHtcbiAgICBjb25zdCB3b3JrZXIgPSBuZXcgV29ya2VyKG5ldyBVUkwoJy4vd2FzaS13b3JrZXItYnJvd3Nlci5tanMnLCBpbXBvcnQubWV0YS51cmwpLCB7XG4gICAgICB0eXBlOiAnbW9kdWxlJyxcbiAgICB9KVxuJHt3b3JrZXJGc0hhbmRsZXJ9XG4ke3dvcmtlckVycm9ySGFuZGxlcn1cbiAgICByZXR1cm4gd29ya2VyXG4gIH0sXG4gIG92ZXJ3cml0ZUltcG9ydHMoaW1wb3J0T2JqZWN0KSB7XG4gICAgaW1wb3J0T2JqZWN0LmVudiA9IHtcbiAgICAgIC4uLmltcG9ydE9iamVjdC5lbnYsXG4gICAgICAuLi5pbXBvcnRPYmplY3QubmFwaSxcbiAgICAgIC4uLmltcG9ydE9iamVjdC5lbW5hcGksXG4gICAgICBtZW1vcnk6IF9fc2hhcmVkTWVtb3J5LFxuICAgIH1cbiAgICByZXR1cm4gaW1wb3J0T2JqZWN0XG4gIH0sXG4gIGJlZm9yZUluaXQoeyBpbnN0YW5jZSB9KSB7XG4gICAgZm9yIChjb25zdCBuYW1lIG9mIE9iamVjdC5rZXlzKGluc3RhbmNlLmV4cG9ydHMpKSB7XG4gICAgICBpZiAobmFtZS5zdGFydHNXaXRoKCdfX25hcGlfcmVnaXN0ZXJfXycpKSB7XG4gICAgICAgIGluc3RhbmNlLmV4cG9ydHNbbmFtZV0oKVxuICAgICAgfVxuICAgIH1cbiAgfSxcbn0pXG5gXG59XG5cbmV4cG9ydCBjb25zdCBjcmVhdGVXYXNpQmluZGluZyA9IChcbiAgd2FzbUZpbGVOYW1lOiBzdHJpbmcsXG4gIHBhY2thZ2VOYW1lOiBzdHJpbmcsXG4gIGluaXRpYWxNZW1vcnkgPSA0MDAwLFxuICBtYXhpbXVtTWVtb3J5ID0gNjU1MzYsXG4pID0+IGAvKiBlc2xpbnQtZGlzYWJsZSAqL1xuLyogcHJldHRpZXItaWdub3JlICovXG5cbi8qIGF1dG8tZ2VuZXJhdGVkIGJ5IE5BUEktUlMgKi9cblxuY29uc3QgX19ub2RlRnMgPSByZXF1aXJlKCdub2RlOmZzJylcbmNvbnN0IF9fbm9kZVBhdGggPSByZXF1aXJlKCdub2RlOnBhdGgnKVxuY29uc3QgeyBXQVNJOiBfX25vZGVXQVNJIH0gPSByZXF1aXJlKCdub2RlOndhc2knKVxuY29uc3QgeyBXb3JrZXIgfSA9IHJlcXVpcmUoJ25vZGU6d29ya2VyX3RocmVhZHMnKVxuXG5jb25zdCB7XG4gIGNyZWF0ZU9uTWVzc2FnZTogX193YXNtQ3JlYXRlT25NZXNzYWdlRm9yRnNQcm94eSxcbiAgZ2V0RGVmYXVsdENvbnRleHQ6IF9fZW1uYXBpR2V0RGVmYXVsdENvbnRleHQsXG4gIGluc3RhbnRpYXRlTmFwaU1vZHVsZVN5bmM6IF9fZW1uYXBpSW5zdGFudGlhdGVOYXBpTW9kdWxlU3luYyxcbn0gPSByZXF1aXJlKCdAbmFwaS1ycy93YXNtLXJ1bnRpbWUnKVxuXG5jb25zdCBfX3Jvb3REaXIgPSBfX25vZGVQYXRoLnBhcnNlKHByb2Nlc3MuY3dkKCkpLnJvb3RcblxuY29uc3QgX193YXNpID0gbmV3IF9fbm9kZVdBU0koe1xuICB2ZXJzaW9uOiAncHJldmlldzEnLFxuICBlbnY6IHByb2Nlc3MuZW52LFxuICBwcmVvcGVuczoge1xuICAgIFtfX3Jvb3REaXJdOiBfX3Jvb3REaXIsXG4gIH1cbn0pXG5cbmNvbnN0IF9fZW1uYXBpQ29udGV4dCA9IF9fZW1uYXBpR2V0RGVmYXVsdENvbnRleHQoKVxuXG5jb25zdCBfX3NoYXJlZE1lbW9yeSA9IG5ldyBXZWJBc3NlbWJseS5NZW1vcnkoe1xuICBpbml0aWFsOiAke2luaXRpYWxNZW1vcnl9LFxuICBtYXhpbXVtOiAke21heGltdW1NZW1vcnl9LFxuICBzaGFyZWQ6IHRydWUsXG59KVxuXG5sZXQgX193YXNtRmlsZVBhdGggPSBfX25vZGVQYXRoLmpvaW4oX19kaXJuYW1lLCAnJHt3YXNtRmlsZU5hbWV9Lndhc20nKVxuY29uc3QgX193YXNtRGVidWdGaWxlUGF0aCA9IF9fbm9kZVBhdGguam9pbihfX2Rpcm5hbWUsICcke3dhc21GaWxlTmFtZX0uZGVidWcud2FzbScpXG5cbmlmIChfX25vZGVGcy5leGlzdHNTeW5jKF9fd2FzbURlYnVnRmlsZVBhdGgpKSB7XG4gIF9fd2FzbUZpbGVQYXRoID0gX193YXNtRGVidWdGaWxlUGF0aFxufSBlbHNlIGlmICghX19ub2RlRnMuZXhpc3RzU3luYyhfX3dhc21GaWxlUGF0aCkpIHtcbiAgdHJ5IHtcbiAgICBfX3dhc21GaWxlUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgnJHtwYWNrYWdlTmFtZX0td2FzbTMyLXdhc2kvJHt3YXNtRmlsZU5hbWV9Lndhc20nKVxuICB9IGNhdGNoIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBmaW5kICR7d2FzbUZpbGVOYW1lfS53YXNtIGZpbGUsIGFuZCAke3BhY2thZ2VOYW1lfS13YXNtMzItd2FzaSBwYWNrYWdlIGlzIG5vdCBpbnN0YWxsZWQuJylcbiAgfVxufVxuXG5jb25zdCB7IGluc3RhbmNlOiBfX25hcGlJbnN0YW5jZSwgbW9kdWxlOiBfX3dhc2lNb2R1bGUsIG5hcGlNb2R1bGU6IF9fbmFwaU1vZHVsZSB9ID0gX19lbW5hcGlJbnN0YW50aWF0ZU5hcGlNb2R1bGVTeW5jKF9fbm9kZUZzLnJlYWRGaWxlU3luYyhfX3dhc21GaWxlUGF0aCksIHtcbiAgY29udGV4dDogX19lbW5hcGlDb250ZXh0LFxuICBhc3luY1dvcmtQb29sU2l6ZTogKGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHRocmVhZHNTaXplRnJvbUVudiA9IE51bWJlcihwcm9jZXNzLmVudi5OQVBJX1JTX0FTWU5DX1dPUktfUE9PTF9TSVpFID8/IHByb2Nlc3MuZW52LlVWX1RIUkVBRFBPT0xfU0laRSlcbiAgICAvLyBOYU4gPiAwIGlzIGZhbHNlXG4gICAgaWYgKHRocmVhZHNTaXplRnJvbUVudiA+IDApIHtcbiAgICAgIHJldHVybiB0aHJlYWRzU2l6ZUZyb21FbnZcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIDRcbiAgICB9XG4gIH0pKCksXG4gIHJldXNlV29ya2VyOiB0cnVlLFxuICB3YXNpOiBfX3dhc2ksXG4gIG9uQ3JlYXRlV29ya2VyKCkge1xuICAgIGNvbnN0IHdvcmtlciA9IG5ldyBXb3JrZXIoX19ub2RlUGF0aC5qb2luKF9fZGlybmFtZSwgJ3dhc2ktd29ya2VyLm1qcycpLCB7XG4gICAgICBlbnY6IHByb2Nlc3MuZW52LFxuICAgIH0pXG4gICAgd29ya2VyLm9ubWVzc2FnZSA9ICh7IGRhdGEgfSkgPT4ge1xuICAgICAgX193YXNtQ3JlYXRlT25NZXNzYWdlRm9yRnNQcm94eShfX25vZGVGcykoZGF0YSlcbiAgICB9XG5cbiAgICAvLyBUaGUgbWFpbiB0aHJlYWQgb2YgTm9kZS5qcyB3YWl0cyBmb3IgYWxsIHRoZSBhY3RpdmUgaGFuZGxlcyBiZWZvcmUgZXhpdGluZy5cbiAgICAvLyBCdXQgUnVzdCB0aHJlYWRzIGFyZSBuZXZlciB3YWl0ZWQgd2l0aG91dCBcXGB0aHJlYWQ6OmpvaW5cXGAuXG4gICAgLy8gU28gaGVyZSB3ZSBoYWNrIHRoZSBjb2RlIG9mIE5vZGUuanMgdG8gcHJldmVudCB0aGUgd29ya2VycyBmcm9tIGJlaW5nIHJlZmVyZW5jZWQgKGFjdGl2ZSkuXG4gICAgLy8gQWNjb3JkaW5nIHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iLzE5ZTBkNDcyNzI4Yzc5ZDQxOGI3NGJkZGZmNTg4YmVhNzBhNDAzZDAvbGliL2ludGVybmFsL3dvcmtlci5qcyNMNDE1LFxuICAgIC8vIGEgd29ya2VyIGlzIGNvbnNpc3Qgb2YgdHdvIGhhbmRsZXM6IGtQdWJsaWNQb3J0IGFuZCBrSGFuZGxlLlxuICAgIHtcbiAgICAgIGNvbnN0IGtQdWJsaWNQb3J0ID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyh3b3JrZXIpLmZpbmQocyA9PlxuICAgICAgICBzLnRvU3RyaW5nKCkuaW5jbHVkZXMoXCJrUHVibGljUG9ydFwiKVxuICAgICAgKTtcbiAgICAgIGlmIChrUHVibGljUG9ydCkge1xuICAgICAgICB3b3JrZXJba1B1YmxpY1BvcnRdLnJlZiA9ICgpID0+IHt9O1xuICAgICAgfVxuXG4gICAgICBjb25zdCBrSGFuZGxlID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyh3b3JrZXIpLmZpbmQocyA9PlxuICAgICAgICBzLnRvU3RyaW5nKCkuaW5jbHVkZXMoXCJrSGFuZGxlXCIpXG4gICAgICApO1xuICAgICAgaWYgKGtIYW5kbGUpIHtcbiAgICAgICAgd29ya2VyW2tIYW5kbGVdLnJlZiA9ICgpID0+IHt9O1xuICAgICAgfVxuXG4gICAgICB3b3JrZXIudW5yZWYoKTtcbiAgICB9XG4gICAgcmV0dXJuIHdvcmtlclxuICB9LFxuICBvdmVyd3JpdGVJbXBvcnRzKGltcG9ydE9iamVjdCkge1xuICAgIGltcG9ydE9iamVjdC5lbnYgPSB7XG4gICAgICAuLi5pbXBvcnRPYmplY3QuZW52LFxuICAgICAgLi4uaW1wb3J0T2JqZWN0Lm5hcGksXG4gICAgICAuLi5pbXBvcnRPYmplY3QuZW1uYXBpLFxuICAgICAgbWVtb3J5OiBfX3NoYXJlZE1lbW9yeSxcbiAgICB9XG4gICAgcmV0dXJuIGltcG9ydE9iamVjdFxuICB9LFxuICBiZWZvcmVJbml0KHsgaW5zdGFuY2UgfSkge1xuICAgIGZvciAoY29uc3QgbmFtZSBvZiBPYmplY3Qua2V5cyhpbnN0YW5jZS5leHBvcnRzKSkge1xuICAgICAgaWYgKG5hbWUuc3RhcnRzV2l0aCgnX19uYXBpX3JlZ2lzdGVyX18nKSkge1xuICAgICAgICBpbnN0YW5jZS5leHBvcnRzW25hbWVdKClcbiAgICAgIH1cbiAgICB9XG4gIH0sXG59KVxuYFxuIiwiZXhwb3J0IGNvbnN0IFdBU0lfV09SS0VSX1RFTVBMQVRFID0gYGltcG9ydCBmcyBmcm9tIFwibm9kZTpmc1wiO1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gXCJub2RlOm1vZHVsZVwiO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBXQVNJIH0gZnJvbSBcIm5vZGU6d2FzaVwiO1xuaW1wb3J0IHsgcGFyZW50UG9ydCwgV29ya2VyIH0gZnJvbSBcIm5vZGU6d29ya2VyX3RocmVhZHNcIjtcblxuY29uc3QgcmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUoaW1wb3J0Lm1ldGEudXJsKTtcblxuY29uc3QgeyBpbnN0YW50aWF0ZU5hcGlNb2R1bGVTeW5jLCBNZXNzYWdlSGFuZGxlciwgZ2V0RGVmYXVsdENvbnRleHQgfSA9IHJlcXVpcmUoXCJAbmFwaS1ycy93YXNtLXJ1bnRpbWVcIik7XG5cbmlmIChwYXJlbnRQb3J0KSB7XG4gIHBhcmVudFBvcnQub24oXCJtZXNzYWdlXCIsIChkYXRhKSA9PiB7XG4gICAgZ2xvYmFsVGhpcy5vbm1lc3NhZ2UoeyBkYXRhIH0pO1xuICB9KTtcbn1cblxuT2JqZWN0LmFzc2lnbihnbG9iYWxUaGlzLCB7XG4gIHNlbGY6IGdsb2JhbFRoaXMsXG4gIHJlcXVpcmUsXG4gIFdvcmtlcixcbiAgaW1wb3J0U2NyaXB0czogZnVuY3Rpb24gKGYpIHtcbiAgICA7KDAsIGV2YWwpKGZzLnJlYWRGaWxlU3luYyhmLCBcInV0ZjhcIikgKyBcIi8vIyBzb3VyY2VVUkw9XCIgKyBmKTtcbiAgfSxcbiAgcG9zdE1lc3NhZ2U6IGZ1bmN0aW9uIChtc2cpIHtcbiAgICBpZiAocGFyZW50UG9ydCkge1xuICAgICAgcGFyZW50UG9ydC5wb3N0TWVzc2FnZShtc2cpO1xuICAgIH1cbiAgfSxcbn0pO1xuXG5jb25zdCBlbW5hcGlDb250ZXh0ID0gZ2V0RGVmYXVsdENvbnRleHQoKTtcblxuY29uc3QgX19yb290RGlyID0gcGFyc2UocHJvY2Vzcy5jd2QoKSkucm9vdDtcblxuY29uc3QgaGFuZGxlciA9IG5ldyBNZXNzYWdlSGFuZGxlcih7XG4gIG9uTG9hZCh7IHdhc21Nb2R1bGUsIHdhc21NZW1vcnkgfSkge1xuICAgIGNvbnN0IHdhc2kgPSBuZXcgV0FTSSh7XG4gICAgICB2ZXJzaW9uOiAncHJldmlldzEnLFxuICAgICAgZW52OiBwcm9jZXNzLmVudixcbiAgICAgIHByZW9wZW5zOiB7XG4gICAgICAgIFtfX3Jvb3REaXJdOiBfX3Jvb3REaXIsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGluc3RhbnRpYXRlTmFwaU1vZHVsZVN5bmMod2FzbU1vZHVsZSwge1xuICAgICAgY2hpbGRUaHJlYWQ6IHRydWUsXG4gICAgICB3YXNpLFxuICAgICAgY29udGV4dDogZW1uYXBpQ29udGV4dCxcbiAgICAgIG92ZXJ3cml0ZUltcG9ydHMoaW1wb3J0T2JqZWN0KSB7XG4gICAgICAgIGltcG9ydE9iamVjdC5lbnYgPSB7XG4gICAgICAgICAgLi4uaW1wb3J0T2JqZWN0LmVudixcbiAgICAgICAgICAuLi5pbXBvcnRPYmplY3QubmFwaSxcbiAgICAgICAgICAuLi5pbXBvcnRPYmplY3QuZW1uYXBpLFxuICAgICAgICAgIG1lbW9yeTogd2FzbU1lbW9yeVxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICB9KTtcbiAgfSxcbn0pO1xuXG5nbG9iYWxUaGlzLm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChlKSB7XG4gIGhhbmRsZXIuaGFuZGxlKGUpO1xufTtcbmBcblxuZXhwb3J0IGNvbnN0IGNyZWF0ZVdhc2lCcm93c2VyV29ya2VyQmluZGluZyA9IChcbiAgZnM6IGJvb2xlYW4sXG4gIGVycm9yRXZlbnQ6IGJvb2xlYW4sXG4pID0+IHtcbiAgY29uc3QgZnNJbXBvcnQgPSBmc1xuICAgID8gYGltcG9ydCB7IGluc3RhbnRpYXRlTmFwaU1vZHVsZVN5bmMsIE1lc3NhZ2VIYW5kbGVyLCBXQVNJLCBjcmVhdGVGc1Byb3h5IH0gZnJvbSAnQG5hcGktcnMvd2FzbS1ydW50aW1lJ1xuaW1wb3J0IHsgbWVtZnNFeHBvcnRlZCBhcyBfX21lbWZzRXhwb3J0ZWQgfSBmcm9tICdAbmFwaS1ycy93YXNtLXJ1bnRpbWUvZnMnXG5cbmNvbnN0IGZzID0gY3JlYXRlRnNQcm94eShfX21lbWZzRXhwb3J0ZWQpYFxuICAgIDogYGltcG9ydCB7IGluc3RhbnRpYXRlTmFwaU1vZHVsZVN5bmMsIE1lc3NhZ2VIYW5kbGVyLCBXQVNJIH0gZnJvbSAnQG5hcGktcnMvd2FzbS1ydW50aW1lJ2BcbiAgY29uc3QgZXJyb3JPdXRwdXRzQXBwZW5kID0gZXJyb3JFdmVudFxuICAgID8gYFxcbiAgICAgICAgZXJyb3JPdXRwdXRzLnB1c2goWy4uLmFyZ3VtZW50c10pYFxuICAgIDogJydcbiAgY29uc3Qgd2FzaUNyZWF0aW9uID0gZnNcbiAgICA/IGBjb25zdCB3YXNpID0gbmV3IFdBU0koe1xuICAgICAgZnMsXG4gICAgICBwcmVvcGVuczoge1xuICAgICAgICAnLyc6ICcvJyxcbiAgICAgIH0sXG4gICAgICBwcmludDogZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgICAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBhcmd1bWVudHMpXG4gICAgICB9LFxuICAgICAgcHJpbnRFcnI6IGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgICAgICBjb25zb2xlLmVycm9yLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cylcbiAgICAgICAgJHtlcnJvck91dHB1dHNBcHBlbmR9XG4gICAgICB9LFxuICAgIH0pYFxuICAgIDogYGNvbnN0IHdhc2kgPSBuZXcgV0FTSSh7XG4gICAgICBwcmludDogZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgICAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBhcmd1bWVudHMpXG4gICAgICB9LFxuICAgICAgcHJpbnRFcnI6IGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgICAgICBjb25zb2xlLmVycm9yLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cylcbiAgICAgICAgJHtlcnJvck91dHB1dHNBcHBlbmR9XG4gICAgICB9LFxuICAgIH0pYFxuICBjb25zdCBlcnJvckhhbmRsZXIgPSBlcnJvckV2ZW50XG4gICAgPyBgb25FcnJvcihlcnJvcikge1xuICAgIHBvc3RNZXNzYWdlKHsgdHlwZTogJ2Vycm9yJywgZXJyb3IsIGVycm9yT3V0cHV0cyB9KVxuICAgIGVycm9yT3V0cHV0cy5sZW5ndGggPSAwXG4gIH1gXG4gICAgOiAnJ1xuICBjb25zdCBlcnJvck91dHB1dHNEZWNsID0gZXJyb3JFdmVudCA/IGBcXG5jb25zdCBlcnJvck91dHB1dHMgPSBbXVxcbmAgOiAnJ1xuICByZXR1cm4gYCR7ZnNJbXBvcnR9XG4ke2Vycm9yT3V0cHV0c0RlY2x9XG5jb25zdCBoYW5kbGVyID0gbmV3IE1lc3NhZ2VIYW5kbGVyKHtcbiAgb25Mb2FkKHsgd2FzbU1vZHVsZSwgd2FzbU1lbW9yeSB9KSB7XG4gICAgJHt3YXNpQ3JlYXRpb259XG4gICAgcmV0dXJuIGluc3RhbnRpYXRlTmFwaU1vZHVsZVN5bmMod2FzbU1vZHVsZSwge1xuICAgICAgY2hpbGRUaHJlYWQ6IHRydWUsXG4gICAgICB3YXNpLFxuICAgICAgb3ZlcndyaXRlSW1wb3J0cyhpbXBvcnRPYmplY3QpIHtcbiAgICAgICAgaW1wb3J0T2JqZWN0LmVudiA9IHtcbiAgICAgICAgICAuLi5pbXBvcnRPYmplY3QuZW52LFxuICAgICAgICAgIC4uLmltcG9ydE9iamVjdC5uYXBpLFxuICAgICAgICAgIC4uLmltcG9ydE9iamVjdC5lbW5hcGksXG4gICAgICAgICAgbWVtb3J5OiB3YXNtTWVtb3J5LFxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pXG4gIH0sXG4gICR7ZXJyb3JIYW5kbGVyfVxufSlcblxuZ2xvYmFsVGhpcy5vbm1lc3NhZ2UgPSBmdW5jdGlvbiAoZSkge1xuICBoYW5kbGVyLmhhbmRsZShlKVxufVxuYFxufVxuIiwiaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnbm9kZTpjcnlwdG8nXG5pbXBvcnQgeyBleGlzdHNTeW5jLCBta2RpclN5bmMsIHJtU3luYywgc3RhdFN5bmMgfSBmcm9tICdub2RlOmZzJ1xuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ25vZGU6bW9kdWxlJ1xuaW1wb3J0IHsgaG9tZWRpciB9IGZyb20gJ25vZGU6b3MnXG5pbXBvcnQgeyBiYXNlbmFtZSwgcGFyc2UsIGpvaW4sIHJlc29sdmUgfSBmcm9tICdub2RlOnBhdGgnXG5cbmltcG9ydCAqIGFzIGNvbG9ycyBmcm9tICdjb2xvcmV0dGUnXG5cbmltcG9ydCB0eXBlIHsgQnVpbGRPcHRpb25zIGFzIFJhd0J1aWxkT3B0aW9ucyB9IGZyb20gJy4uL2RlZi9idWlsZC5qcydcbmltcG9ydCB7XG4gIENMSV9WRVJTSU9OLFxuICBjb3B5RmlsZUFzeW5jLFxuICB0eXBlIENyYXRlLFxuICBkZWJ1Z0ZhY3RvcnksXG4gIERFRkFVTFRfVFlQRV9ERUZfSEVBREVSLFxuICBmaWxlRXhpc3RzLFxuICBnZXRTeXN0ZW1EZWZhdWx0VGFyZ2V0LFxuICBnZXROYXBpRGVyaXZlRGVwZW5kZW50Q3JhdGVzLFxuICBnZXRUYXJnZXRMaW5rZXIsXG4gIG1rZGlyQXN5bmMsXG4gIHR5cGUgTmFwaUNvbmZpZyxcbiAgcGFyc2VNZXRhZGF0YSxcbiAgcGFyc2VUcmlwbGUsXG4gIHByb2Nlc3NUeXBlRGVmLFxuICByZWFkRmlsZUFzeW5jLFxuICByZWFkTmFwaUNvbmZpZyxcbiAgdHlwZSBUYXJnZXQsXG4gIHRhcmdldFRvRW52VmFyLFxuICB0cnlJbnN0YWxsQ2FyZ29CaW5hcnksXG4gIHVubGlua0FzeW5jLFxuICB3cml0ZUZpbGVBc3luYyxcbiAgZGlyRXhpc3RzQXN5bmMsXG4gIHJlYWRkaXJBc3luYyxcbiAgdHlwZSBDYXJnb1dvcmtzcGFjZU1ldGFkYXRhLFxufSBmcm9tICcuLi91dGlscy9pbmRleC5qcydcblxuaW1wb3J0IHsgY3JlYXRlQ2pzQmluZGluZywgY3JlYXRlRXNtQmluZGluZyB9IGZyb20gJy4vdGVtcGxhdGVzL2luZGV4LmpzJ1xuaW1wb3J0IHtcbiAgY3JlYXRlV2FzaUJpbmRpbmcsXG4gIGNyZWF0ZVdhc2lCcm93c2VyQmluZGluZyxcbn0gZnJvbSAnLi90ZW1wbGF0ZXMvbG9hZC13YXNpLXRlbXBsYXRlLmpzJ1xuaW1wb3J0IHtcbiAgY3JlYXRlV2FzaUJyb3dzZXJXb3JrZXJCaW5kaW5nLFxuICBXQVNJX1dPUktFUl9URU1QTEFURSxcbn0gZnJvbSAnLi90ZW1wbGF0ZXMvd2FzaS13b3JrZXItdGVtcGxhdGUuanMnXG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCdidWlsZCcpXG5jb25zdCByZXF1aXJlID0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpXG5cbnR5cGUgT3V0cHV0S2luZCA9ICdqcycgfCAnZHRzJyB8ICdub2RlJyB8ICdleGUnIHwgJ3dhc20nXG50eXBlIE91dHB1dCA9IHsga2luZDogT3V0cHV0S2luZDsgcGF0aDogc3RyaW5nIH1cblxudHlwZSBCdWlsZE9wdGlvbnMgPSBSYXdCdWlsZE9wdGlvbnMgJiB7IGNhcmdvT3B0aW9ucz86IHN0cmluZ1tdIH1cbnR5cGUgUGFyc2VkQnVpbGRPcHRpb25zID0gT21pdDxCdWlsZE9wdGlvbnMsICdjd2QnPiAmIHsgY3dkOiBzdHJpbmcgfVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVpbGRQcm9qZWN0KHJhd09wdGlvbnM6IEJ1aWxkT3B0aW9ucykge1xuICBkZWJ1ZygnbmFwaSBidWlsZCBjb21tYW5kIHJlY2VpdmUgb3B0aW9uczogJU8nLCByYXdPcHRpb25zKVxuXG4gIGNvbnN0IG9wdGlvbnM6IFBhcnNlZEJ1aWxkT3B0aW9ucyA9IHtcbiAgICBkdHNDYWNoZTogdHJ1ZSxcbiAgICAuLi5yYXdPcHRpb25zLFxuICAgIGN3ZDogcmF3T3B0aW9ucy5jd2QgPz8gcHJvY2Vzcy5jd2QoKSxcbiAgfVxuXG4gIC8vIFJlamVjdCBpbnZhbGlkIGNyb3NzLWNvbXBpbGF0aW9uIGZsYWcgY29tYmluYXRpb25zIGJlZm9yZSBhbnl0aGluZyB3aXRoXG4gIC8vIGEgc2lkZSBlZmZlY3QgcnVucyAoYGNhcmdvIG1ldGFkYXRhYCwgY2FyZ28gYmluYXJ5IGF1dG8taW5zdGFsbHMsXG4gIC8vIHRvb2xjaGFpbiBkb3dubG9hZHMsIC4uLiksIHNvIHRoZSB1c2VyIGFsd2F5cyBnZXRzIHRoZSB2YWxpZGF0aW9uIGVycm9yXG4gIC8vIHJhdGhlciB0aGFuIGFuIHVucmVsYXRlZCBmYWlsdXJlIGZyb20gdGhvc2Ugc3RlcHMuXG4gIHZhbGlkYXRlQ3Jvc3NDb21waWxlRmxhZ3Mob3B0aW9ucylcbiAgaWYgKG9wdGlvbnMudXNlTmFwaUNyb3NzKSB7XG4gICAgLy8gQ2hlY2sgdGhlIGhvc3QgY29uc3RyYWludCBiZWZvcmUgcmVzb2x2aW5nIHRoZSB0YXJnZXQ6IHdpdGhvdXQgYW5cbiAgICAvLyBleHBsaWNpdCBgLS10YXJnZXRgIChvciBgQ0FSR09fQlVJTERfVEFSR0VUYCkgdGhlIHRhcmdldCByZXNvbHV0aW9uXG4gICAgLy8gc3Bhd25zIGBydXN0YyAtdlZgLCBhbmQgb24gYW4gdW5zdXBwb3J0ZWQgaG9zdCB3aXRob3V0IFJ1c3Qgb24gdGhlXG4gICAgLy8gYFBBVEhgIHRoYXQgc3Bhd24gZmFpbHVyZSB3b3VsZCBtYXNrIHRoZSBhY3R1YWwgdmFsaWRhdGlvbiBlcnJvci5cbiAgICB2YWxpZGF0ZU5hcGlDcm9zc0hvc3QoKVxuICAgIHZhbGlkYXRlTmFwaUNyb3NzU3VwcG9ydChyZXNvbHZlVGFyZ2V0KG9wdGlvbnMudGFyZ2V0KS50cmlwbGUpXG4gIH1cblxuICBjb25zdCByZXNvbHZlUGF0aCA9ICguLi5wYXRoczogc3RyaW5nW10pID0+IHJlc29sdmUob3B0aW9ucy5jd2QsIC4uLnBhdGhzKVxuXG4gIGNvbnN0IG1hbmlmZXN0UGF0aCA9IHJlc29sdmVQYXRoKG9wdGlvbnMubWFuaWZlc3RQYXRoID8/ICdDYXJnby50b21sJylcbiAgY29uc3QgbWV0YWRhdGEgPSBhd2FpdCBwYXJzZU1ldGFkYXRhKG1hbmlmZXN0UGF0aCwge1xuICAgIGZlYXR1cmVzOiBvcHRpb25zLmZlYXR1cmVzLFxuICAgIGFsbEZlYXR1cmVzOiBvcHRpb25zLmFsbEZlYXR1cmVzLFxuICAgIG5vRGVmYXVsdEZlYXR1cmVzOiBvcHRpb25zLm5vRGVmYXVsdEZlYXR1cmVzLFxuICB9KVxuXG4gIGNvbnN0IGNyYXRlID0gbWV0YWRhdGEucGFja2FnZXMuZmluZCgocCkgPT4ge1xuICAgIC8vIHBhY2thZ2Ugd2l0aCBnaXZlbiBuYW1lXG4gICAgaWYgKG9wdGlvbnMucGFja2FnZSkge1xuICAgICAgcmV0dXJuIHAubmFtZSA9PT0gb3B0aW9ucy5wYWNrYWdlXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBwLm1hbmlmZXN0X3BhdGggPT09IG1hbmlmZXN0UGF0aFxuICAgIH1cbiAgfSlcblxuICBpZiAoIWNyYXRlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ1VuYWJsZSB0byBmaW5kIGNyYXRlIHRvIGJ1aWxkLiBJdCBzZWVtcyB5b3UgYXJlIHRyeWluZyB0byBidWlsZCBhIGNyYXRlIGluIGEgd29ya3NwYWNlLCB0cnkgdXNpbmcgYC0tcGFja2FnZWAgb3B0aW9uIHRvIHNwZWNpZnkgdGhlIHBhY2thZ2UgdG8gYnVpbGQuJyxcbiAgICApXG4gIH1cbiAgY29uc3QgY29uZmlnID0gYXdhaXQgcmVhZE5hcGlDb25maWcoXG4gICAgcmVzb2x2ZVBhdGgob3B0aW9ucy5wYWNrYWdlSnNvblBhdGggPz8gJ3BhY2thZ2UuanNvbicpLFxuICAgIG9wdGlvbnMuY29uZmlnUGF0aCA/IHJlc29sdmVQYXRoKG9wdGlvbnMuY29uZmlnUGF0aCkgOiB1bmRlZmluZWQsXG4gIClcblxuICBjb25zdCBidWlsZGVyID0gbmV3IEJ1aWxkZXIobWV0YWRhdGEsIGNyYXRlLCBjb25maWcsIG9wdGlvbnMpXG5cbiAgcmV0dXJuIGJ1aWxkZXIuYnVpbGQoKVxufVxuXG4vKipcbiAqIFJlc29sdmUgdGhlIHRhcmdldCB0cmlwbGUgdGhlIGJ1aWxkIHdpbGwgcnVuIGFnYWluc3QsIGZvbGxvd2luZyB0aGUgc2FtZVxuICogcHJlY2VkZW5jZSB0aGUgYnVpbGQgaXRzZWxmIHVzZXM6IHRoZSBleHBsaWNpdCBgLS10YXJnZXRgIG9wdGlvbiwgdGhlbiB0aGVcbiAqIGBDQVJHT19CVUlMRF9UQVJHRVRgIGVudmlyb25tZW50IHZhcmlhYmxlLCB0aGVuIHRoZSBob3N0IGRlZmF1bHQgdGFyZ2V0LlxuICovXG5mdW5jdGlvbiByZXNvbHZlVGFyZ2V0KHRhcmdldE9wdGlvbj86IHN0cmluZyk6IFRhcmdldCB7XG4gIHJldHVybiB0YXJnZXRPcHRpb25cbiAgICA/IHBhcnNlVHJpcGxlKHRhcmdldE9wdGlvbilcbiAgICA6IHByb2Nlc3MuZW52LkNBUkdPX0JVSUxEX1RBUkdFVFxuICAgICAgPyBwYXJzZVRyaXBsZShwcm9jZXNzLmVudi5DQVJHT19CVUlMRF9UQVJHRVQpXG4gICAgICA6IGdldFN5c3RlbURlZmF1bHRUYXJnZXQoKVxufVxuXG4vKipcbiAqIFZhbGlkYXRlIHRoZSBjb21iaW5hdGlvbiBvZiB0aGUgY3Jvc3MtY29tcGlsYXRpb24gcmVsYXRlZCBmbGFncy5cbiAqXG4gKiBgLS11c2UtY3Jvc3NgLCBgLS11c2UtbmFwaS1jcm9zc2AgYW5kIGAtLWNyb3NzLWNvbXBpbGVgIChgLXhgKSBhcmUgdGhyZWVcbiAqIG11dHVhbGx5IGV4Y2x1c2l2ZSBjcm9zcy1jb21waWxhdGlvbiBtZWNoYW5pc21zOyBjb21iaW5pbmcgYW55IHR3byBvZiB0aGVtXG4gKiBsZWF2ZXMgYm90aCBhY3RpdmUgYXQgb25jZSBhbmQgcHJvZHVjZXMgYnJva2VuIGJ1aWxkcywgc28gaXQgaXMgcmVqZWN0ZWRcbiAqIHVwZnJvbnQgYmVmb3JlIGFueSBzaWRlIGVmZmVjdCAobGlrZSBhdXRvLWluc3RhbGxpbmcgY2FyZ28gYmluYXJpZXMgb3JcbiAqIGRvd25sb2FkaW5nIHRvb2xjaGFpbnMpIGhhcHBlbnMuXG4gKlxuICogYC0tY3Jvc3MtY29tcGlsZWAgd2l0aCBhIGB3aW5kb3dzLWdudWAgdGFyZ2V0IGlzIHJlamVjdGVkIGFzIHdlbGw6IG9uIGFcbiAqIG5vbi1XaW5kb3dzIGhvc3QgaXQgcm91dGVzIHRoZSBidWlsZCB0byBgY2FyZ28geHdpbiBidWlsZGAsIGJ1dFxuICogYGNhcmdvLXh3aW5gIG9ubHkgc2V0cyB1cCBNU1ZDIHRvb2xjaGFpbnMg4oCUIGZvciBgd2luZG93cy1nbnVgIHRhcmdldHMgaXRcbiAqIHNpbGVudGx5IGRvZXMgbm90aGluZyBhbmQgdGhlIGJ1aWxkIGRpZXMgbXVjaCBsYXRlciB3aXRoIGEgY3J5cHRpY1xuICogYGBlcnJvcjogbGlua2VyIGB4ODZfNjQtdzY0LW1pbmd3MzItZ2NjYCBub3QgZm91bmRgYCB0aGF0IG5ldmVyIG1lbnRpb25zXG4gKiBgY2FyZ28teHdpbmAuIE9ubHkgYW4gZXhwbGljaXRseSByZXF1ZXN0ZWQgdGFyZ2V0IChgLS10YXJnZXRgIG9yXG4gKiBgQ0FSR09fQlVJTERfVEFSR0VUYCkgaXMgaW5zcGVjdGVkLCBzbyB0aGlzIHZhbGlkYXRpb24gbmV2ZXIgaGFzIHRvIHNwYXduXG4gKiBgcnVzdGMgLXZWYDsgYSBub24tV2luZG93cyBob3N0J3MgZGVmYXVsdCB0YXJnZXQgY2FuIG5ldmVyIGJlXG4gKiBgd2luZG93cy1nbnVgIGFueXdheS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlQ3Jvc3NDb21waWxlRmxhZ3MoXG4gIG9wdGlvbnM6IHtcbiAgICB1c2VDcm9zcz86IGJvb2xlYW5cbiAgICBjcm9zc0NvbXBpbGU/OiBib29sZWFuXG4gICAgdXNlTmFwaUNyb3NzPzogYm9vbGVhblxuICAgIHdhdGNoPzogYm9vbGVhblxuICAgIHRhcmdldD86IHN0cmluZ1xuICB9LFxuICBob3N0UGxhdGZvcm06IHN0cmluZyA9IHByb2Nlc3MucGxhdGZvcm0sXG4pOiB2b2lkIHtcbiAgY29uc3QgZW5hYmxlZENyb3NzRmxhZ3MgPSBbXG4gICAgb3B0aW9ucy51c2VDcm9zcyA/ICdgLS11c2UtY3Jvc3NgJyA6IG51bGwsXG4gICAgb3B0aW9ucy51c2VOYXBpQ3Jvc3MgPyAnYC0tdXNlLW5hcGktY3Jvc3NgJyA6IG51bGwsXG4gICAgb3B0aW9ucy5jcm9zc0NvbXBpbGUgPyAnYC0tY3Jvc3MtY29tcGlsZWAgKGAteGApJyA6IG51bGwsXG4gIF0uZmlsdGVyKChmbGFnKTogZmxhZyBpcyBzdHJpbmcgPT4gZmxhZyAhPT0gbnVsbClcblxuICBpZiAoZW5hYmxlZENyb3NzRmxhZ3MubGVuZ3RoID4gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGAke2VuYWJsZWRDcm9zc0ZsYWdzLmpvaW4oJyBhbmQgJyl9IGNhbm5vdCBiZSB1c2VkIHRvZ2V0aGVyLiBQbGVhc2UgcGljayBleGFjdGx5IG9uZSBjcm9zcy1jb21waWxhdGlvbiBtZWNoYW5pc206IFxcYC0tdXNlLWNyb3NzXFxgLCBcXGAtLXVzZS1uYXBpLWNyb3NzXFxgLCBvciBcXGAtLWNyb3NzLWNvbXBpbGVcXGAgKFxcYC14XFxgKS5gLFxuICAgIClcbiAgfVxuXG4gIGlmIChvcHRpb25zLndhdGNoICYmIG9wdGlvbnMudXNlQ3Jvc3MpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnYC0td2F0Y2hgIGNhbm5vdCBiZSB1c2VkIHdpdGggYC0tdXNlLWNyb3NzYC4gYGNhcmdvIHdhdGNoYCBvbmx5IHN1cHBvcnRzIHRoZSBwbGFpbiBgY2FyZ28gYnVpbGRgIGZsb3csIHBsZWFzZSBkcm9wIG9uZSBvZiB0aGUgdHdvIGZsYWdzLicsXG4gICAgKVxuICB9XG5cbiAgaWYgKG9wdGlvbnMud2F0Y2ggJiYgb3B0aW9ucy5jcm9zc0NvbXBpbGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnYC0td2F0Y2hgIGNhbm5vdCBiZSB1c2VkIHdpdGggYC0tY3Jvc3MtY29tcGlsZWAgKGAteGApLiBgY2FyZ28gd2F0Y2hgIG9ubHkgc3VwcG9ydHMgdGhlIHBsYWluIGBjYXJnbyBidWlsZGAgZmxvdywgcGxlYXNlIGRyb3Agb25lIG9mIHRoZSB0d28gZmxhZ3MuJyxcbiAgICApXG4gIH1cblxuICAvLyBPbiBhIFdpbmRvd3MgaG9zdCBgLS1jcm9zcy1jb21waWxlYCBuZXZlciBwaWNrcyBgY2FyZ28teHdpbmAgKGl0IGZhbGxzXG4gIC8vIGJhY2sgdG8gYSBwbGFpbiBgY2FyZ28gYnVpbGRgKSwgc28gd2luZG93cy1nbnUgdGFyZ2V0cyBhcmUgb25seSBicm9rZW5cbiAgLy8gb24gbm9uLVdpbmRvd3MgaG9zdHMuXG4gIGlmIChvcHRpb25zLmNyb3NzQ29tcGlsZSAmJiBob3N0UGxhdGZvcm0gIT09ICd3aW4zMicpIHtcbiAgICBjb25zdCBleHBsaWNpdFRhcmdldCA9IG9wdGlvbnMudGFyZ2V0ID8/IHByb2Nlc3MuZW52LkNBUkdPX0JVSUxEX1RBUkdFVFxuICAgIGlmIChleHBsaWNpdFRhcmdldCkge1xuICAgICAgY29uc3QgdGFyZ2V0ID0gcGFyc2VUcmlwbGUoZXhwbGljaXRUYXJnZXQpXG4gICAgICBpZiAodGFyZ2V0LnBsYXRmb3JtID09PSAnd2luMzInICYmIHRhcmdldC5hYmk/LnN0YXJ0c1dpdGgoJ2dudScpKSB7XG4gICAgICAgIGNvbnN0IG1zdmNUcmlwbGUgPSBleHBsaWNpdFRhcmdldC5yZXBsYWNlKC9nbnUobGx2bSk/JC8sICdtc3ZjJylcbiAgICAgICAgLy8gYCotd2luZG93cy1nbnVgIGxpbmtzIHdpdGggYSBtaW5ndy13NjQgR0NDIHRvb2xjaGFpbiwgd2hpbGVcbiAgICAgICAgLy8gYCotd2luZG93cy1nbnVsbHZtYCBuZWVkcyBhbiBMTFZNIHRvb2xjaGFpbiAobGx2bS1taW5ndyk6IGBydXN0Y2BcbiAgICAgICAgLy8gaGFzIG5vIGRlZmF1bHQgd29ya2luZyBsaW5rZXIgZm9yIGl0IHdpdGhvdXQgb25lIG9uIHRoZSBgUEFUSGAuXG4gICAgICAgIGNvbnN0IHRvb2xjaGFpbkhpbnQgPVxuICAgICAgICAgIHRhcmdldC5hYmkgPT09ICdnbnVsbHZtJ1xuICAgICAgICAgICAgPyBgYW4gbGx2bS1taW5ndyAoTExWTS9DbGFuZykgdG9vbGNoYWluIG9uIHRoZSBcXGBQQVRIXFxgIChcXGBydXN0Y1xcYCBoYXMgbm8gZGVmYXVsdCB3b3JraW5nIGxpbmtlciBmb3IgJHtleHBsaWNpdFRhcmdldH0gd2l0aG91dCBvbmU7IFxcYG5hcGktYnVpbGRcXGAgYWRkaXRpb25hbGx5IG5lZWRzIFxcYGxpYm5vZGUuZGxsXFxgIHZpYSB0aGUgXFxgTElCTk9ERV9QQVRIXFxgIGVudmlyb25tZW50IHZhcmlhYmxlKWBcbiAgICAgICAgICAgIDogYGEgbWluZ3ctdzY0IHRvb2xjaGFpbiAoXFxgcnVzdGNcXGAgdXNlcyB0aGUgXFxgJHtleHBsaWNpdFRhcmdldC5zcGxpdCgnLScpWzBdfS13NjQtbWluZ3czMi1nY2NcXGAgbGlua2VyOyBcXGBuYXBpLWJ1aWxkXFxgIGFkZGl0aW9uYWxseSBuZWVkcyBcXGBsaWJub2RlLmRsbFxcYCB2aWEgdGhlIFxcYExJQk5PREVfUEFUSFxcYCBlbnZpcm9ubWVudCB2YXJpYWJsZSlgXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgXFxgLS1jcm9zcy1jb21waWxlXFxgIChcXGAteFxcYCkgZG9lcyBub3Qgc3VwcG9ydCB0aGUgdGFyZ2V0ICR7ZXhwbGljaXRUYXJnZXR9OiBcXGBjYXJnby14d2luXFxgIG9ubHkgaGFuZGxlcyBNU1ZDIHRhcmdldHMgYW5kIHRoZSBidWlsZCB3b3VsZCBmYWlsIGF0IGxpbmsgdGltZS4gRHJvcCBcXGAteFxcYCBhbmQgYnVpbGQgd2l0aCAke3Rvb2xjaGFpbkhpbnR9LCBvciB0YXJnZXQgJHttc3ZjVHJpcGxlfSBpbnN0ZWFkLmAsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBWYWxpZGF0ZSB0aGF0IHRoZSBjdXJyZW50IGhvc3QgY2FuIHJ1biB0aGUgYEBuYXBpLXJzL2Nyb3NzLXRvb2xjaGFpbmBcbiAqIHByZS1idWlsdCB0b29sY2hhaW5zIGF0IGFsbDogdGhleSBvbmx5IHJ1biBvbiBMaW51eCB4NjQgYW5kIExpbnV4IGFybTY0XG4gKiBob3N0cy4gVGhpcyBjaGVjayBpcyBzZXBhcmF0ZSBmcm9tIChhbmQgbXVzdCBydW4gYmVmb3JlKSB0aGUgcGVyLXRhcmdldFxuICogdmFsaWRhdGlvbiwgYmVjYXVzZSByZXNvbHZpbmcgdGhlIHRhcmdldCBtYXkgbmVlZCB0byBzcGF3biBgcnVzdGNgLlxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZU5hcGlDcm9zc0hvc3QoXG4gIGhvc3RQbGF0Zm9ybTogc3RyaW5nID0gcHJvY2Vzcy5wbGF0Zm9ybSxcbiAgaG9zdEFyY2g6IHN0cmluZyA9IHByb2Nlc3MuYXJjaCxcbik6IGFzc2VydHMgaG9zdEFyY2ggaXMgJ3g2NCcgfCAnYXJtNjQnIHtcbiAgaWYgKFxuICAgIGhvc3RQbGF0Zm9ybSAhPT0gJ2xpbnV4JyB8fFxuICAgIChob3N0QXJjaCAhPT0gJ3g2NCcgJiYgaG9zdEFyY2ggIT09ICdhcm02NCcpXG4gICkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBcXGAtLXVzZS1uYXBpLWNyb3NzXFxgIHJlcXVpcmVzIGEgTGludXggeDY0IG9yIExpbnV4IGFybTY0IGhvc3QsIGJ1dCB0aGUgY3VycmVudCBob3N0IGlzICR7aG9zdFBsYXRmb3JtfS0ke2hvc3RBcmNofS4gUGxlYXNlIHVzZSBcXGAtLWNyb3NzLWNvbXBpbGVcXGAgKFxcYC14XFxgKSBvciBcXGAtLXVzZS1jcm9zc1xcYCB0byBjcm9zcyBjb21waWxlIG9uIHRoaXMgaG9zdC5gLFxuICAgIClcbiAgfVxufVxuXG4vKipcbiAqIFZhbGlkYXRlIHRoYXQgYC0tdXNlLW5hcGktY3Jvc3NgIGNhbiBhY3R1YWxseSBoYW5kbGUgdGhlIHJlcXVlc3RlZCB0YXJnZXRcbiAqIG9uIHRoZSBjdXJyZW50IGhvc3QuIFRoZSBzdXBwb3J0ZWQgdGFyZ2V0IHNldCBpcyByZWFkIGZyb20gdGhlXG4gKiBgQG5hcGktcnMvY3Jvc3MtdG9vbGNoYWluYCBwYWNrYWdlLCBhbmQgdGhlIHByZS1idWlsdCB0b29sY2hhaW5zIG9ubHkgcnVuXG4gKiBvbiBMaW51eCB4NjQgYW5kIExpbnV4IGFybTY0IGhvc3RzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVOYXBpQ3Jvc3NTdXBwb3J0KFxuICB0YXJnZXRUcmlwbGU6IHN0cmluZyxcbiAgaG9zdFBsYXRmb3JtOiBzdHJpbmcgPSBwcm9jZXNzLnBsYXRmb3JtLFxuICBob3N0QXJjaDogc3RyaW5nID0gcHJvY2Vzcy5hcmNoLFxuKTogdm9pZCB7XG4gIHZhbGlkYXRlTmFwaUNyb3NzSG9zdChob3N0UGxhdGZvcm0sIGhvc3RBcmNoKVxuXG4gIGNvbnN0IHRvb2xjaGFpbnM6IFJlY29yZDxcbiAgICAneDY0JyB8ICdhcm02NCcsXG4gICAgUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgdW5kZWZpbmVkPlxuICA+ID0gcmVxdWlyZSgnQG5hcGktcnMvY3Jvc3MtdG9vbGNoYWluJylcbiAgY29uc3Qgc3VwcG9ydGVkVGFyZ2V0cyA9IE9iamVjdC5rZXlzKHRvb2xjaGFpbnNbaG9zdEFyY2hdKVxuXG4gIGlmICghc3VwcG9ydGVkVGFyZ2V0cy5pbmNsdWRlcyh0YXJnZXRUcmlwbGUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFxcYC0tdXNlLW5hcGktY3Jvc3NcXGAgZG9lcyBub3Qgc3VwcG9ydCB0aGUgdGFyZ2V0ICR7dGFyZ2V0VHJpcGxlfS4gU3VwcG9ydGVkIHRhcmdldHM6ICR7c3VwcG9ydGVkVGFyZ2V0cy5qb2luKCcsICcpfS4gUGxlYXNlIHVzZSBcXGAtLWNyb3NzLWNvbXBpbGVcXGAgKFxcYC14XFxgKSBvciBcXGAtLXVzZS1jcm9zc1xcYCBmb3IgdGhpcyB0YXJnZXQuYCxcbiAgICApXG4gIH1cbn1cblxuLyoqXG4gKiBDb21wdXRlIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgdGhhdCByb3V0ZSBhIGAtLXVzZS1uYXBpLWNyb3NzYCBidWlsZFxuICogdGhyb3VnaCB0aGUgYEBuYXBpLXJzL2Nyb3NzLXRvb2xjaGFpbmAgdG9vbGNoYWluIGV4dHJhY3RlZCBhdFxuICogYHRvb2xjaGFpblBhdGhgLlxuICpcbiAqIEZvbGxvd3MgdGhlIHNhbWUgcnVsZSBhcyBgQnVpbGRlciNzZXRFbnZJZk5vdEV4aXN0c2A6IGEgdmFyaWFibGUgdGhlIHVzZXJcbiAqIGFscmVhZHkgc2V0IGluIGBlbnZgIHdpbnMgYW5kIGlzIG5vdCByZXR1cm5lZCwgYW5kIGEgcHJlc2VudC1idXQtZW1wdHlcbiAqIHZhcmlhYmxlIGNvdW50cyBhcyB1bnNldCAoZmFsc3kgc2VtYW50aWNzKS4gVGhlIG9ubHkgZXhjZXB0aW9ucyBhcmUgdGhlXG4gKiBjbGFuZy1zcGVjaWZpYyBgVEFSR0VUX0NGTEFHU2AvYFRBUkdFVF9DWFhGTEFHU2AsIHdoaWNoIHByZXBlbmQgdGhlIHN5c3Jvb3RcbiAqIGZsYWdzIHRvIHRoZSB1c2VyJ3MgdmFsdWUsIGFuZCBgUEFUSGAsIHdoaWNoIGFsd2F5cyBnZXRzIHRoZSB0b29sY2hhaW5cbiAqIGBiaW5gIGRpcmVjdG9yeSBwcmVwZW5kZWQuXG4gKlxuICogRXhwb3J0ZWQgZm9yIHRlc3RzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbmFwaUNyb3NzVG9vbGNoYWluRW52cyhcbiAgdG9vbGNoYWluUGF0aDogc3RyaW5nLFxuICB0YXJnZXRUcmlwbGU6IHN0cmluZyxcbiAgZW52OiBOb2RlSlMuUHJvY2Vzc0VudiA9IHByb2Nlc3MuZW52LFxuKTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB7XG4gIGNvbnN0IGFsaWFzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICdzMzkweC11bmtub3duLWxpbnV4LWdudSc6ICdzMzkweC1pYm0tbGludXgtZ251JyxcbiAgfVxuXG4gIGNvbnN0IGVudnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fVxuICBjb25zdCBzZXRFbnZJZk5vdEV4aXN0cyA9IChuYW1lOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoIWVudltuYW1lXSkge1xuICAgICAgZW52c1tuYW1lXSA9IHZhbHVlXG4gICAgfVxuICB9XG5cbiAgY29uc3QgdXBwZXJDYXNlVGFyZ2V0ID0gdGFyZ2V0VG9FbnZWYXIodGFyZ2V0VHJpcGxlKVxuICBjb25zdCBjcm9zc1RhcmdldE5hbWUgPSBhbGlhc1t0YXJnZXRUcmlwbGVdID8/IHRhcmdldFRyaXBsZVxuICBzZXRFbnZJZk5vdEV4aXN0cyhcbiAgICBgQ0FSR09fVEFSR0VUXyR7dXBwZXJDYXNlVGFyZ2V0fV9MSU5LRVJgLFxuICAgIGpvaW4odG9vbGNoYWluUGF0aCwgJ2JpbicsIGAke2Nyb3NzVGFyZ2V0TmFtZX0tZ2NjYCksXG4gIClcbiAgc2V0RW52SWZOb3RFeGlzdHMoXG4gICAgJ1RBUkdFVF9TWVNST09UJyxcbiAgICBqb2luKHRvb2xjaGFpblBhdGgsIGNyb3NzVGFyZ2V0TmFtZSwgJ3N5c3Jvb3QnKSxcbiAgKVxuICBzZXRFbnZJZk5vdEV4aXN0cyhcbiAgICAnVEFSR0VUX0FSJyxcbiAgICBqb2luKHRvb2xjaGFpblBhdGgsICdiaW4nLCBgJHtjcm9zc1RhcmdldE5hbWV9LWFyYCksXG4gIClcbiAgc2V0RW52SWZOb3RFeGlzdHMoXG4gICAgJ1RBUkdFVF9SQU5MSUInLFxuICAgIGpvaW4odG9vbGNoYWluUGF0aCwgJ2JpbicsIGAke2Nyb3NzVGFyZ2V0TmFtZX0tcmFubGliYCksXG4gIClcbiAgc2V0RW52SWZOb3RFeGlzdHMoXG4gICAgJ1RBUkdFVF9SRUFERUxGJyxcbiAgICBqb2luKHRvb2xjaGFpblBhdGgsICdiaW4nLCBgJHtjcm9zc1RhcmdldE5hbWV9LXJlYWRlbGZgKSxcbiAgKVxuICBzZXRFbnZJZk5vdEV4aXN0cyhcbiAgICAnVEFSR0VUX0NfSU5DTFVERV9QQVRIJyxcbiAgICBqb2luKHRvb2xjaGFpblBhdGgsIGNyb3NzVGFyZ2V0TmFtZSwgJ3N5c3Jvb3QnLCAndXNyJywgJ2luY2x1ZGUvJyksXG4gIClcbiAgc2V0RW52SWZOb3RFeGlzdHMoXG4gICAgJ1RBUkdFVF9DQycsXG4gICAgam9pbih0b29sY2hhaW5QYXRoLCAnYmluJywgYCR7Y3Jvc3NUYXJnZXROYW1lfS1nY2NgKSxcbiAgKVxuICBzZXRFbnZJZk5vdEV4aXN0cyhcbiAgICAnVEFSR0VUX0NYWCcsXG4gICAgam9pbih0b29sY2hhaW5QYXRoLCAnYmluJywgYCR7Y3Jvc3NUYXJnZXROYW1lfS1nKytgKSxcbiAgKVxuICAvLyBgc2V0RW52SWZOb3RFeGlzdHNgIHNraXBzIGBlbnZzYCB3aGVuIHRoZSB1c2VyIGFscmVhZHkgc2V0IHRoZSB2YXJpYWJsZVxuICAvLyBpbiB0aGVpciBlbnZpcm9ubWVudCwgc28gcmVhZCB0aGUgZWZmZWN0aXZlIHZhbHVlIGJhY2sgZnJvbSBgZW52YCBmaXJzdFxuICAvLyDigJQgd2l0aCB0aGUgc2FtZSBmYWxzeSBzZW1hbnRpY3M6IGEgcHJlc2VudC1idXQtZW1wdHkgYFRBUkdFVF9TWVNST09UYFxuICAvLyBjb3VudHMgYXMgdW5zZXQgYW5kIGZhbGxzIGJhY2sgdG8gdGhlIGRvd25sb2FkZWQgc3lzcm9vdCAoYD8/YCB3b3VsZFxuICAvLyBrZWVwIHRoZSBlbXB0eSBzdHJpbmcgYW5kIHByb2R1Y2UgYSBicm9rZW4gYC0tc3lzcm9vdD1gKS5cbiAgY29uc3QgdGFyZ2V0U3lzcm9vdCA9IGVudi5UQVJHRVRfU1lTUk9PVCB8fCBlbnZzLlRBUkdFVF9TWVNST09UXG4gIHNldEVudklmTm90RXhpc3RzKCdCSU5ER0VOX0VYVFJBX0NMQU5HX0FSR1MnLCBgLS1zeXNyb290PSR7dGFyZ2V0U3lzcm9vdH1gKVxuXG4gIC8vIGNjLXJzIHBhcnNlcyB0aGUgZW52IHZhbHVlIGJlZm9yZSBleGVjdXRpbmcgaXQgKGBlbnZfdG9vbGAgaW4gY2Mnc1xuICAvLyBsaWIucnMpOiB3aGVuIHRoZSBXSE9MRSB2YWx1ZSBleGlzdHMgb24gdGhlIGZpbGVzeXN0ZW0gKGBjaGVja19leGVgKVxuICAvLyBpdCBpcyB0aGUgY29tcGlsZXIgYXMtaXMg4oCUIHRoYXQgaXMgaG93IGl0IHN1cHBvcnRzIHNwYWNlcyBpbiBwYXRoc1xuICAvLyBsaWtlIGAvb3B0L0xMVk0gMTgvYmluL2NsYW5nYCDigJQgYW5kIG9ubHkgb3RoZXJ3aXNlIGlzIHRoZSB2YWx1ZSBzcGxpdFxuICAvLyBvbiB3aGl0ZXNwYWNlOyB0aGVuLCB3aGVuIHRoZSBmaXJzdCB0b2tlbiBpcyBhIGtub3duIHdyYXBwZXJcbiAgLy8gKGBzY2NhY2hlIGNsYW5nYCkgdGhlIHNlY29uZCB0b2tlbiBpcyB0aGUgY29tcGlsZXIgdGhhdCBhY3R1YWxseSBydW5zLFxuICAvLyBvdGhlcndpc2UgdGhlIGZpcnN0IHRva2VuIGlzIGFuZCB0aGUgcmVzdCBhcmUgYXJndW1lbnRzXG4gIC8vIChgY2xhbmcgLXRhcmdldCDigKZgKS4gTWlycm9yIHRoYXQgb3JkZXJpbmcsIGZpbGVzeXN0ZW0gcHJvYmUgaW5jbHVkZWQ6XG4gIC8vIGEgcHVyZSB3aG9sZS12YWx1ZSBiYXNlbmFtZSBoZXVyaXN0aWMgd291bGQgbWlzcmVhZCBhcmd1bWVudCBmb3Jtc1xuICAvLyB0aGF0IG1lcmVseSBFTkQgaW4gYGNsYW5nYCwgbGlrZSBgZ2NjIC0tc3lzcm9vdD0vb3B0L2NsYW5nYCwgYW5kXG4gIC8vIGluamVjdCBjbGFuZy1vbmx5IGZsYWdzIGludG8gYSBnY2MgY29tcGlsZS4gTWF0Y2ggb24gdGhlIGV4ZWN1dGFibGVcbiAgLy8gbmFtZSBzbyBwYXRoLXF1YWxpZmllZCAoYC91c3IvYmluL2NsYW5nYCksIHRyaXBsZS1wcmVmaXhlZFxuICAvLyAoYGFhcmNoNjQtbGludXgtZ251LWNsYW5nYCkgYW5kIHZlcnNpb25lZCAoYGNsYW5nLTE4YCkgY29tcGlsZXJzIGFyZVxuICAvLyBhbGwgcmVjb2duaXplZCDigJQgYnV0IG5vdCBjbGFuZy1mYW1pbHkgdG9vbHMgdGhhdCBhcmUgbm90IGNvbXBpbGVyc1xuICAvLyAoYGNsYW5nLWZvcm1hdGApLlxuICBjb25zdCBjY1dyYXBwZXJzID0gbmV3IFNldChbXG4gICAgJ2NjYWNoZScsXG4gICAgJ2Rpc3RjYycsXG4gICAgJ3NjY2FjaGUnLFxuICAgICdpY2VjYycsXG4gICAgJ2NhY2hlcG90JyxcbiAgICAnYnVpbGRjYWNoZScsXG4gICAgJ2thY2hlJyxcbiAgXSlcbiAgY29uc3QgY2xhbmdFeGVjdXRhYmxlTmFtZSA9IC8oXnwtKWNsYW5nKFxcK1xcKyk/KC1cXGQrKT8kL1xuICAvLyBjYy1ycydzIGBjaGVja19leGVgIG9ubHkgcHJvYmVzIGZvciBleGlzdGVuY2UgKHBsdXMgYW4gYC5leGVgIHJldHJ5IG9uXG4gIC8vIFdpbmRvd3MsIHdoZXJlIHRoaXMgbmFwaS1jcm9zcyBwYXRoIG5ldmVyIHJ1bnMpOyByZXF1aXJpbmcgYSByZWd1bGFyXG4gIC8vIGZpbGUgYWRkaXRpb25hbGx5IGtlZXBzIGRpcmVjdG9yaWVzIGZyb20gYmVpbmcgdGFrZW4gZm9yIGNvbXBpbGVycy5cbiAgY29uc3QgaXNFeGlzdGluZ0ZpbGUgPSAocGF0aDogc3RyaW5nKTogYm9vbGVhbiA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBzdGF0U3luYyhwYXRoLCB7IHRocm93SWZOb0VudHJ5OiBmYWxzZSB9KT8uaXNGaWxlKCkgPz8gZmFsc2VcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuICBjb25zdCBpc0NsYW5nQ29tcGlsZXIgPSAodmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IGJvb2xlYW4gPT4ge1xuICAgIGlmICghdmFsdWUpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBjb25zdCB0cmltbWVkID0gdmFsdWUudHJpbSgpXG4gICAgaWYgKGlzRXhpc3RpbmdGaWxlKHRyaW1tZWQpKSB7XG4gICAgICByZXR1cm4gY2xhbmdFeGVjdXRhYmxlTmFtZS50ZXN0KGJhc2VuYW1lKHRyaW1tZWQpKVxuICAgIH1cbiAgICBjb25zdCBbZmlyc3QsIHNlY29uZF0gPSB0cmltbWVkLnNwbGl0KC9cXHMrLylcbiAgICBjb25zdCBjb21waWxlciA9IGZpcnN0ICYmIGNjV3JhcHBlcnMuaGFzKGJhc2VuYW1lKGZpcnN0KSkgPyBzZWNvbmQgOiBmaXJzdFxuICAgIHJldHVybiAoXG4gICAgICBjb21waWxlciAhPT0gdW5kZWZpbmVkICYmIGNsYW5nRXhlY3V0YWJsZU5hbWUudGVzdChiYXNlbmFtZShjb21waWxlcikpXG4gICAgKVxuICB9XG5cbiAgLy8gRGV0ZWN0IGNsYW5nIG9uIHRoZSBFRkZFQ1RJVkUgdGFyZ2V0IGNvbXBpbGVyOiB0aGUgdXNlcidzIFRBUkdFVF9DQyBpZlxuICAvLyBzZXQsIG90aGVyd2lzZSB0aGUgdG9vbGNoYWluIGdjYyBleHBvcnRlZCBhYm92ZSAoYGVudnMuVEFSR0VUX0NDYCkuXG4gIC8vIGNjLXJzIHByZWZlcnMgVEFSR0VUX0NDIG92ZXIgQ0MgZm9yIGNyb3NzIGJ1aWxkcywgc28gYSBwbGFpbiBgQ0M9Y2xhbmdgXG4gIC8vIG5ldmVyIHJ1bnMgaGVyZSBhbmQgbXVzdCBub3QgdHJpZ2dlciB0aGUgY2xhbmctb25seSBgLS1nY2MtdG9vbGNoYWluPWBcbiAgLy8gZmxhZyAoZ2NjIGhhcmQtZXJyb3JzIG9uIGl0KS4gVGhlIHRyYWlsaW5nIGBlbnYuQ0NgL2BlbnYuQ1hYYCB0ZXJtcyBhcmVcbiAgLy8gdW5yZWFjaGFibGUgdG9kYXkgKGV4YWN0bHkgb25lIG9mIHRoZSBmaXJzdCB0d28gaXMgYWx3YXlzIHRydXRoeSkgYnV0XG4gIC8vIGtlZXAgdGhlIGNoZWNrIGNvcnJlY3QgaWYgdGhlIHRvb2xjaGFpbiBkZWZhdWx0IGV2ZXIgYmVjb21lcyBjb25kaXRpb25hbC5cbiAgaWYgKGlzQ2xhbmdDb21waWxlcihlbnYuVEFSR0VUX0NDIHx8IGVudnMuVEFSR0VUX0NDIHx8IGVudi5DQykpIHtcbiAgICBjb25zdCBUQVJHRVRfQ0ZMQUdTID0gZW52LlRBUkdFVF9DRkxBR1MgfHwgJydcbiAgICBlbnZzLlRBUkdFVF9DRkxBR1MgPSBgLS1zeXNyb290PSR7dGFyZ2V0U3lzcm9vdH0gLS1nY2MtdG9vbGNoYWluPSR7dG9vbGNoYWluUGF0aH0gJHtUQVJHRVRfQ0ZMQUdTfWBcbiAgfVxuICBpZiAoaXNDbGFuZ0NvbXBpbGVyKGVudi5UQVJHRVRfQ1hYIHx8IGVudnMuVEFSR0VUX0NYWCB8fCBlbnYuQ1hYKSkge1xuICAgIGNvbnN0IFRBUkdFVF9DWFhGTEFHUyA9IGVudi5UQVJHRVRfQ1hYRkxBR1MgfHwgJydcbiAgICBlbnZzLlRBUkdFVF9DWFhGTEFHUyA9IGAtLXN5c3Jvb3Q9JHt0YXJnZXRTeXNyb290fSAtLWdjYy10b29sY2hhaW49JHt0b29sY2hhaW5QYXRofSAke1RBUkdFVF9DWFhGTEFHU31gXG4gIH1cbiAgZW52cy5QQVRIID0gZW52LlBBVEhcbiAgICA/IGAke3Rvb2xjaGFpblBhdGh9L2Jpbjoke2Vudi5QQVRIfWBcbiAgICA6IGAke3Rvb2xjaGFpblBhdGh9L2JpbmBcbiAgcmV0dXJuIGVudnNcbn1cblxuY2xhc3MgQnVpbGRlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgYXJnczogc3RyaW5nW10gPSBbXVxuICBwcml2YXRlIHJlYWRvbmx5IGVudnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fVxuICBwcml2YXRlIHJlYWRvbmx5IG91dHB1dHM6IE91dHB1dFtdID0gW11cblxuICBwcml2YXRlIHJlYWRvbmx5IHRhcmdldDogVGFyZ2V0XG4gIHByaXZhdGUgcmVhZG9ubHkgY3JhdGVEaXI6IHN0cmluZ1xuICBwcml2YXRlIHJlYWRvbmx5IG91dHB1dERpcjogc3RyaW5nXG4gIHByaXZhdGUgcmVhZG9ubHkgdGFyZ2V0RGlyOiBzdHJpbmdcbiAgcHJpdmF0ZSByZWFkb25seSBlbmFibGVUeXBlRGVmOiBib29sZWFuID0gZmFsc2VcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IG1ldGFkYXRhOiBDYXJnb1dvcmtzcGFjZU1ldGFkYXRhLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY3JhdGU6IENyYXRlLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY29uZmlnOiBOYXBpQ29uZmlnLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogUGFyc2VkQnVpbGRPcHRpb25zLFxuICApIHtcbiAgICB0aGlzLnRhcmdldCA9IHJlc29sdmVUYXJnZXQob3B0aW9ucy50YXJnZXQpXG4gICAgdGhpcy5jcmF0ZURpciA9IHBhcnNlKGNyYXRlLm1hbmlmZXN0X3BhdGgpLmRpclxuICAgIHRoaXMub3V0cHV0RGlyID0gcmVzb2x2ZShcbiAgICAgIHRoaXMub3B0aW9ucy5jd2QsXG4gICAgICBvcHRpb25zLm91dHB1dERpciA/PyB0aGlzLmNyYXRlRGlyLFxuICAgIClcbiAgICB0aGlzLnRhcmdldERpciA9XG4gICAgICBvcHRpb25zLnRhcmdldERpciA/P1xuICAgICAgcHJvY2Vzcy5lbnYuQ0FSR09fQlVJTERfVEFSR0VUX0RJUiA/P1xuICAgICAgbWV0YWRhdGEudGFyZ2V0X2RpcmVjdG9yeVxuICAgIHRoaXMuZW5hYmxlVHlwZURlZiA9IHRoaXMuY3JhdGUuZGVwZW5kZW5jaWVzLnNvbWUoXG4gICAgICAoZGVwKSA9PlxuICAgICAgICBkZXAubmFtZSA9PT0gJ25hcGktZGVyaXZlJyAmJlxuICAgICAgICAoZGVwLnVzZXNfZGVmYXVsdF9mZWF0dXJlcyB8fCBkZXAuZmVhdHVyZXMuaW5jbHVkZXMoJ3R5cGUtZGVmJykpLFxuICAgIClcblxuICAgIGlmICghdGhpcy5lbmFibGVUeXBlRGVmKSB7XG4gICAgICBjb25zdCByZXF1aXJlbWVudFdhcm5pbmcgPVxuICAgICAgICAnYG5hcGktZGVyaXZlYCBjcmF0ZSBpcyBub3QgdXNlZCBvciBgdHlwZS1kZWZgIGZlYXR1cmUgaXMgbm90IGVuYWJsZWQgZm9yIGBuYXBpLWRlcml2ZWAgY3JhdGUnXG4gICAgICBkZWJ1Zy53YXJuKFxuICAgICAgICBgJHtyZXF1aXJlbWVudFdhcm5pbmd9LiBXaWxsIHNraXAgYmluZGluZyBnZW5lcmF0aW9uIGZvciBcXGAubm9kZVxcYCwgXFxgLndhc2lcXGAgYW5kIFxcYC5kLnRzXFxgIGZpbGVzLmAsXG4gICAgICApXG5cbiAgICAgIGlmIChcbiAgICAgICAgdGhpcy5vcHRpb25zLmR0cyB8fFxuICAgICAgICB0aGlzLm9wdGlvbnMuZHRzSGVhZGVyIHx8XG4gICAgICAgIHRoaXMuY29uZmlnLmR0c0hlYWRlciB8fFxuICAgICAgICB0aGlzLmNvbmZpZy5kdHNIZWFkZXJGaWxlXG4gICAgICApIHtcbiAgICAgICAgZGVidWcud2FybihcbiAgICAgICAgICBgJHtyZXF1aXJlbWVudFdhcm5pbmd9LiBcXGBkdHNcXGAgcmVsYXRlZCBvcHRpb25zIGFyZSBlbmFibGVkIGJ1dCB3aWxsIGJlIGlnbm9yZWQuYCxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdldCBjZHlMaWJOYW1lKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMuYmluKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuY3JhdGUudGFyZ2V0cy5maW5kKCh0KSA9PiB0LmNyYXRlX3R5cGVzLmluY2x1ZGVzKCdjZHlsaWInKSlcbiAgICAgID8ubmFtZVxuICB9XG5cbiAgZ2V0IGJpbk5hbWUoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMub3B0aW9ucy5iaW4gPz9cbiAgICAgIC8vIG9ubHkgYXZhaWxhYmxlIGlmIG5vdCBjZHlsaWIgb3IgYmluIG5hbWUgc3BlY2lmaWVkXG4gICAgICAodGhpcy5jZHlMaWJOYW1lXG4gICAgICAgID8gbnVsbFxuICAgICAgICA6IHRoaXMuY3JhdGUudGFyZ2V0cy5maW5kKCh0KSA9PiB0LmNyYXRlX3R5cGVzLmluY2x1ZGVzKCdiaW4nKSk/Lm5hbWUpXG4gICAgKVxuICB9XG5cbiAgYnVpbGQoKSB7XG4gICAgLy8gQmFja3N0b3Agb25seTogYGJ1aWxkUHJvamVjdCgpYCBhbHJlYWR5IHZhbGlkYXRlZCB0aGVzZSBiZWZvcmUgcnVubmluZ1xuICAgIC8vIGFueXRoaW5nIHdpdGggYSBzaWRlIGVmZmVjdCAoc2VlIHRoZSB0b3Agb2YgYGJ1aWxkUHJvamVjdGApLiBLZXB0IGhlcmVcbiAgICAvLyBzbyBhIGRpcmVjdGx5IGNvbnN0cnVjdGVkIGBCdWlsZGVyYCBjYW5ub3Qgc2tpcCB0aGUgdmFsaWRhdGlvbi5cbiAgICB2YWxpZGF0ZUNyb3NzQ29tcGlsZUZsYWdzKHRoaXMub3B0aW9ucylcbiAgICBpZiAodGhpcy5vcHRpb25zLnVzZU5hcGlDcm9zcykge1xuICAgICAgdmFsaWRhdGVOYXBpQ3Jvc3NTdXBwb3J0KHRoaXMudGFyZ2V0LnRyaXBsZSlcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmJpbikge1xuICAgICAgZGVidWcud2FybihcbiAgICAgICAgYEJ1aWxkaW5nIENhcmdvIGJpbmFyeSB0YXJnZXQgJHt0aGlzLmJpbk5hbWV9OyB0aGUgcmVzdWx0IHdpbGwgYmUgYW4gZXhlY3V0YWJsZSwgbm90IGEgTm9kZS5qcyBhZGRvbi5gLFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoIXRoaXMuY2R5TGliTmFtZSkge1xuICAgICAgY29uc3Qgd2FybmluZyA9XG4gICAgICAgICdNaXNzaW5nIGBjcmF0ZS10eXBlID0gW1wiY2R5bGliXCJdYCBpbiBbbGliXSBjb25maWcuIFRoZSBidWlsZCByZXN1bHQgd2lsbCBub3QgYmUgYXZhaWxhYmxlIGFzIG5vZGUgYWRkb24uJ1xuXG4gICAgICBpZiAodGhpcy5iaW5OYW1lKSB7XG4gICAgICAgIGRlYnVnLndhcm4od2FybmluZylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcih3YXJuaW5nKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnBpY2tCaW5hcnkoKVxuICAgICAgLnNldFBhY2thZ2UoKVxuICAgICAgLnNldEZlYXR1cmVzKClcbiAgICAgIC5zZXRUYXJnZXQoKVxuICAgICAgLnBpY2tDcm9zc1Rvb2xjaGFpbigpXG4gICAgICAuc2V0RW52cygpXG4gICAgICAuc2V0QnlwYXNzQXJncygpXG4gICAgICAuZXhlYygpXG4gIH1cblxuICBwcml2YXRlIHBpY2tDcm9zc1Rvb2xjaGFpbigpIHtcbiAgICBpZiAoIXRoaXMub3B0aW9ucy51c2VOYXBpQ3Jvc3MpIHtcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHsgdmVyc2lvbiwgZG93bmxvYWQgfSA9IHJlcXVpcmUoJ0BuYXBpLXJzL2Nyb3NzLXRvb2xjaGFpbicpXG5cbiAgICAgIGNvbnN0IHRvb2xjaGFpblBhdGggPSBqb2luKFxuICAgICAgICBob21lZGlyKCksXG4gICAgICAgICcubmFwaS1ycycsXG4gICAgICAgICdjcm9zcy10b29sY2hhaW4nLFxuICAgICAgICB2ZXJzaW9uLFxuICAgICAgICB0aGlzLnRhcmdldC50cmlwbGUsXG4gICAgICApXG4gICAgICBta2RpclN5bmModG9vbGNoYWluUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSlcbiAgICAgIGlmIChleGlzdHNTeW5jKGpvaW4odG9vbGNoYWluUGF0aCwgJ3BhY2thZ2UuanNvbicpKSkge1xuICAgICAgICBkZWJ1ZyhgVG9vbGNoYWluICR7dG9vbGNoYWluUGF0aH0gZXhpc3RzLCBza2lwIGV4dHJhY3RpbmdgKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgdGFyQXJjaGl2ZSA9IGRvd25sb2FkKHByb2Nlc3MuYXJjaCwgdGhpcy50YXJnZXQudHJpcGxlKVxuICAgICAgICB0YXJBcmNoaXZlLnVucGFjayh0b29sY2hhaW5QYXRoKVxuICAgICAgfVxuICAgICAgT2JqZWN0LmFzc2lnbihcbiAgICAgICAgdGhpcy5lbnZzLFxuICAgICAgICBuYXBpQ3Jvc3NUb29sY2hhaW5FbnZzKHRvb2xjaGFpblBhdGgsIHRoaXMudGFyZ2V0LnRyaXBsZSksXG4gICAgICApXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgRmFpbGVkIHRvIHNldCB1cCB0aGUgXFxgLS11c2UtbmFwaS1jcm9zc1xcYCB0b29sY2hhaW4gZm9yICR7dGhpcy50YXJnZXQudHJpcGxlfTogJHsoZSBhcyBFcnJvcikubWVzc2FnZX0uIENoZWNrIGZpbGVzeXN0ZW0gcGVybWlzc2lvbnMgYW5kIG5ldHdvcmsgY29ubmVjdGl2aXR5IHRvIHRoZSBucG0gcmVnaXN0cnksIHRoZW4gcmV0cnksIG9yIHVzZSBcXGAtLWNyb3NzLWNvbXBpbGVcXGAgKFxcYC14XFxgKSAvIFxcYC0tdXNlLWNyb3NzXFxgIGluc3RlYWQuYCxcbiAgICAgICAgeyBjYXVzZTogZSB9LFxuICAgICAgKVxuICAgIH1cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgcHJpdmF0ZSBleGVjKCkge1xuICAgIGRlYnVnKGBTdGFydCBidWlsZGluZyBjcmF0ZTogJHt0aGlzLmNyYXRlLm5hbWV9YClcbiAgICBkZWJ1ZygnICAlaScsIGBjYXJnbyAke3RoaXMuYXJncy5qb2luKCcgJyl9YClcblxuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcblxuICAgIGNvbnN0IHdhdGNoID0gdGhpcy5vcHRpb25zLndhdGNoXG4gICAgY29uc3QgYnVpbGRUYXNrID0gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgY2FyZ29PdmVycmlkZSA9IHByb2Nlc3MuZW52LkNBUkdPXG4gICAgICBpZiAoXG4gICAgICAgIGNhcmdvT3ZlcnJpZGUgJiZcbiAgICAgICAgKHRoaXMub3B0aW9ucy51c2VDcm9zcyB8fCB0aGlzLm9wdGlvbnMuY3Jvc3NDb21waWxlKVxuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkQmluYXJ5ID0gdGhpcy5vcHRpb25zLnVzZUNyb3NzID8gJ2Nyb3NzJyA6ICdjYXJnbydcbiAgICAgICAgY29uc3QgcmVxdWVzdGVkRmxhZyA9IHRoaXMub3B0aW9ucy51c2VDcm9zc1xuICAgICAgICAgID8gJ2AtLXVzZS1jcm9zc2AnXG4gICAgICAgICAgOiAnYC0tY3Jvc3MtY29tcGlsZWAgKGAteGApJ1xuICAgICAgICBkZWJ1Zy53YXJuKFxuICAgICAgICAgIGBUaGUgXFxgQ0FSR09cXGAgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgc2V0IHRvIFxcYCR7Y2FyZ29PdmVycmlkZX1cXGA7IGl0IHdpbGwgYmUgc3Bhd25lZCBpbnN0ZWFkIG9mIHRoZSBcXGAke2V4cGVjdGVkQmluYXJ5fVxcYCBiaW5hcnkgdGhhdCAke3JlcXVlc3RlZEZsYWd9IHJlbGllcyBvbi4gVW5zZXQgXFxgQ0FSR09cXGAgaWYgdGhpcyBpcyBub3QgaW50ZW5kZWQuYCxcbiAgICAgICAgKVxuICAgICAgfVxuICAgICAgY29uc3QgY29tbWFuZCA9XG4gICAgICAgIGNhcmdvT3ZlcnJpZGUgPz8gKHRoaXMub3B0aW9ucy51c2VDcm9zcyA/ICdjcm9zcycgOiAnY2FyZ28nKVxuICAgICAgY29uc3QgYnVpbGRQcm9jZXNzID0gc3Bhd24oY29tbWFuZCwgdGhpcy5hcmdzLCB7XG4gICAgICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgLi4udGhpcy5lbnZzIH0sXG4gICAgICAgIHN0ZGlvOiB3YXRjaCA/IFsnaW5oZXJpdCcsICdpbmhlcml0JywgJ3BpcGUnXSA6ICdpbmhlcml0JyxcbiAgICAgICAgY3dkOiB0aGlzLm9wdGlvbnMuY3dkLFxuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgfSlcblxuICAgICAgYnVpbGRQcm9jZXNzLm9uY2UoJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgICBpZiAoY29kZSA9PT0gMCkge1xuICAgICAgICAgIGRlYnVnKCclaScsIGBCdWlsZCBjcmF0ZSAke3RoaXMuY3JhdGUubmFtZX0gc3VjY2Vzc2Z1bGx5IWApXG4gICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgQnVpbGQgZmFpbGVkIHdpdGggZXhpdCBjb2RlICR7Y29kZX1gKSlcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgYnVpbGRQcm9jZXNzLm9uY2UoJ2Vycm9yJywgKGUpID0+IHtcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgQnVpbGQgZmFpbGVkIHdpdGggZXJyb3I6ICR7ZS5tZXNzYWdlfWAsIHsgY2F1c2U6IGUgfSkpXG4gICAgICB9KVxuXG4gICAgICAvLyB3YXRjaCBtb2RlIG9ubHksIHRoZXkgYXJlIHBpcGVkIHRocm91Z2ggc3RkZXJyXG4gICAgICBidWlsZFByb2Nlc3Muc3RkZXJyPy5vbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgICAgIGNvbnN0IG91dHB1dCA9IGRhdGEudG9TdHJpbmcoKVxuICAgICAgICBjb25zb2xlLmVycm9yKG91dHB1dClcbiAgICAgICAgaWYgKC9GaW5pc2hlZFxccyhgZGV2YHxgcmVsZWFzZWApLy50ZXN0KG91dHB1dCkpIHtcbiAgICAgICAgICB0aGlzLnBvc3RCdWlsZCgpLmNhdGNoKCgpID0+IHt9KVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0pXG5cbiAgICByZXR1cm4ge1xuICAgICAgdGFzazogYnVpbGRUYXNrLnRoZW4oKCkgPT4gdGhpcy5wb3N0QnVpbGQoKSksXG4gICAgICBhYm9ydDogKCkgPT4gY29udHJvbGxlci5hYm9ydCgpLFxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcGlja0JpbmFyeSgpIHtcbiAgICBsZXQgc2V0ID0gZmFsc2VcbiAgICBpZiAodGhpcy5vcHRpb25zLndhdGNoKSB7XG4gICAgICBpZiAocHJvY2Vzcy5lbnYuQ0kpIHtcbiAgICAgICAgZGVidWcud2FybignV2F0Y2ggbW9kZSBpcyBub3Qgc3VwcG9ydGVkIGluIENJIGVudmlyb25tZW50JylcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlYnVnKCdVc2UgJWknLCAnY2FyZ28td2F0Y2gnKVxuICAgICAgICB0cnlJbnN0YWxsQ2FyZ29CaW5hcnkoJ2NhcmdvLXdhdGNoJywgJ3dhdGNoJylcbiAgICAgICAgLy8geWFybiBuYXBpIHdhdGNoIC0tdGFyZ2V0IHg4Nl82NC11bmtub3duLWxpbnV4LWdudVxuICAgICAgICAvLyA9PT0+XG4gICAgICAgIC8vIGNhcmdvIHdhdGNoIFsuLi5dIC0tIGNhcmdvIGJ1aWxkIC0tdGFyZ2V0IHg4Nl82NC11bmtub3duLWxpbnV4LWdudVxuICAgICAgICB0aGlzLmFyZ3MucHVzaChcbiAgICAgICAgICAnd2F0Y2gnLFxuICAgICAgICAgICctLXdoeScsXG4gICAgICAgICAgJy1pJyxcbiAgICAgICAgICAnKi57anMsdHMsbm9kZX0nLFxuICAgICAgICAgICctdycsXG4gICAgICAgICAgdGhpcy5jcmF0ZURpcixcbiAgICAgICAgICAnLS0nLFxuICAgICAgICAgICdjYXJnbycsXG4gICAgICAgICAgJ2J1aWxkJyxcbiAgICAgICAgKVxuICAgICAgICBzZXQgPSB0cnVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jcm9zc0NvbXBpbGUpIHtcbiAgICAgIGlmICh0aGlzLnRhcmdldC5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgICAgICAgIGRlYnVnLndhcm4oXG4gICAgICAgICAgICAnWW91IGFyZSB0cnlpbmcgdG8gY3Jvc3MgY29tcGlsZSB0byB3aW4zMiBwbGF0Zm9ybSBvbiB3aW4zMiBwbGF0Zm9ybSB3aGljaCBpcyB1bm5lY2Vzc2FyeS4nLFxuICAgICAgICAgIClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB1c2UgY2FyZ28teHdpbiB0byBjcm9zcyBjb21waWxlIHRvIHdpbjMyIHBsYXRmb3JtXG4gICAgICAgICAgZGVidWcoJ1VzZSAlaScsICdjYXJnby14d2luJylcbiAgICAgICAgICB0cnlJbnN0YWxsQ2FyZ29CaW5hcnkoJ2NhcmdvLXh3aW4nLCAneHdpbicpXG4gICAgICAgICAgdGhpcy5hcmdzLnB1c2goJ3h3aW4nLCAnYnVpbGQnKVxuICAgICAgICAgIGlmICh0aGlzLnRhcmdldC5hcmNoID09PSAnaWEzMicpIHtcbiAgICAgICAgICAgIHRoaXMuZW52cy5YV0lOX0FSQ0ggPSAneDg2J1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZXQgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHVzZSBjYXJnby16aWdidWlsZCB0byBjcm9zcyBjb21waWxlIHRvIG90aGVyIHBsYXRmb3Jtc1xuICAgICAgICBkZWJ1ZygnVXNlICVpJywgJ2NhcmdvLXppZ2J1aWxkJylcbiAgICAgICAgdHJ5SW5zdGFsbENhcmdvQmluYXJ5KCdjYXJnby16aWdidWlsZCcsICd6aWdidWlsZCcpXG4gICAgICAgIHRoaXMuYXJncy5wdXNoKCd6aWdidWlsZCcpXG4gICAgICAgIHNldCA9IHRydWVcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXNldCkge1xuICAgICAgdGhpcy5hcmdzLnB1c2goJ2J1aWxkJylcbiAgICB9XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIHByaXZhdGUgc2V0UGFja2FnZSgpIHtcbiAgICBjb25zdCBhcmdzID0gW11cblxuICAgIGlmICh0aGlzLm9wdGlvbnMucGFja2FnZSkge1xuICAgICAgYXJncy5wdXNoKCctLXBhY2thZ2UnLCB0aGlzLm9wdGlvbnMucGFja2FnZSlcbiAgICB9XG5cbiAgICBpZiAodGhpcy5iaW5OYW1lKSB7XG4gICAgICBhcmdzLnB1c2goJy0tYmluJywgdGhpcy5iaW5OYW1lKVxuICAgIH1cblxuICAgIGlmIChhcmdzLmxlbmd0aCkge1xuICAgICAgZGVidWcoJ1NldCBwYWNrYWdlIGZsYWdzOiAnKVxuICAgICAgZGVidWcoJyAgJU8nLCBhcmdzKVxuICAgICAgdGhpcy5hcmdzLnB1c2goLi4uYXJncylcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgcHJpdmF0ZSBzZXRUYXJnZXQoKSB7XG4gICAgZGVidWcoJ1NldCBjb21waWxpbmcgdGFyZ2V0IHRvOiAnKVxuICAgIGRlYnVnKCcgICVpJywgdGhpcy50YXJnZXQudHJpcGxlKVxuXG4gICAgdGhpcy5hcmdzLnB1c2goJy0tdGFyZ2V0JywgdGhpcy50YXJnZXQudHJpcGxlKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIHByaXZhdGUgc2V0RW52cygpIHtcbiAgICAvLyBUWVBFIERFRlxuICAgIGlmICh0aGlzLmVuYWJsZVR5cGVEZWYpIHtcbiAgICAgIHRoaXMuZW52cy5OQVBJX1RZUEVfREVGX1RNUF9GT0xERVIgPVxuICAgICAgICB0aGlzLmdlbmVyYXRlSW50ZXJtZWRpYXRlVHlwZURlZkZvbGRlcigpXG4gICAgICB0aGlzLnNldEZvcmNlQnVpbGRFbnZzKHRoaXMuZW52cy5OQVBJX1RZUEVfREVGX1RNUF9GT0xERVIpXG4gICAgfVxuXG4gICAgLy8gUlVTVEZMQUdTXG4gICAgbGV0IHJ1c3RmbGFncyA9XG4gICAgICBwcm9jZXNzLmVudi5SVVNURkxBR1MgPz8gcHJvY2Vzcy5lbnYuQ0FSR09fQlVJTERfUlVTVEZMQUdTID8/ICcnXG5cbiAgICBpZiAoXG4gICAgICB0aGlzLnRhcmdldC5hYmk/LmluY2x1ZGVzKCdtdXNsJykgJiZcbiAgICAgICFydXN0ZmxhZ3MuaW5jbHVkZXMoJ3RhcmdldC1mZWF0dXJlPS1jcnQtc3RhdGljJylcbiAgICApIHtcbiAgICAgIHJ1c3RmbGFncyArPSAnIC1DIHRhcmdldC1mZWF0dXJlPS1jcnQtc3RhdGljJ1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaXAgJiYgIXJ1c3RmbGFncy5pbmNsdWRlcygnbGluay1hcmc9LXMnKSkge1xuICAgICAgcnVzdGZsYWdzICs9ICcgLUMgbGluay1hcmc9LXMnXG4gICAgfVxuXG4gICAgaWYgKHJ1c3RmbGFncy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuZW52cy5SVVNURkxBR1MgPSBydXN0ZmxhZ3NcbiAgICB9XG4gICAgLy8gRU5EIFJVU1RGTEFHU1xuXG4gICAgLy8gTElOS0VSXG4gICAgY29uc3QgbGlua2VyID0gdGhpcy5vcHRpb25zLmNyb3NzQ29tcGlsZVxuICAgICAgPyB2b2lkIDBcbiAgICAgIDogZ2V0VGFyZ2V0TGlua2VyKHRoaXMudGFyZ2V0LnRyaXBsZSlcbiAgICAvLyBUT0RPOlxuICAgIC8vICAgZGlyZWN0bHkgc2V0IENBUkdPX1RBUkdFVF88dGFyZ2V0Pl9MSU5LRVIgd2lsbCBjb3ZlciAuY2FyZ28vY29uZmlnLnRvbWxcbiAgICAvLyAgIHdpbGwgZGV0ZWN0IGJ5IGNhcmdvIGNvbmZpZyB3aGVuIGl0IGJlY29tZXMgc3RhYmxlXG4gICAgLy8gICBzZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9ydXN0LWxhbmcvY2FyZ28vaXNzdWVzLzkzMDFcbiAgICBjb25zdCBsaW5rZXJFbnYgPSBgQ0FSR09fVEFSR0VUXyR7dGFyZ2V0VG9FbnZWYXIoXG4gICAgICB0aGlzLnRhcmdldC50cmlwbGUsXG4gICAgKX1fTElOS0VSYFxuICAgIGlmIChsaW5rZXIgJiYgIXByb2Nlc3MuZW52W2xpbmtlckVudl0gJiYgIXRoaXMuZW52c1tsaW5rZXJFbnZdKSB7XG4gICAgICB0aGlzLmVudnNbbGlua2VyRW52XSA9IGxpbmtlclxuICAgIH1cblxuICAgIGlmICh0aGlzLnRhcmdldC5wbGF0Zm9ybSA9PT0gJ2FuZHJvaWQnKSB7XG4gICAgICB0aGlzLnNldEFuZHJvaWRFbnYoKVxuICAgIH1cblxuICAgIGlmICh0aGlzLnRhcmdldC5wbGF0Zm9ybSA9PT0gJ3dhc2knKSB7XG4gICAgICB0aGlzLnNldFdhc2lFbnYoKVxuICAgIH1cblxuICAgIGlmICh0aGlzLnRhcmdldC5wbGF0Zm9ybSA9PT0gJ29wZW5oYXJtb255Jykge1xuICAgICAgdGhpcy5zZXRPcGVuSGFybW9ueUVudigpXG4gICAgfVxuXG4gICAgZGVidWcoJ1NldCBlbnZzOiAnKVxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuZW52cykuZm9yRWFjaCgoW2ssIHZdKSA9PiB7XG4gICAgICBkZWJ1ZygnICAlaScsIGAke2t9PSR7dn1gKVxuICAgIH0pXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgcHJpdmF0ZSBzZXRGb3JjZUJ1aWxkRW52cyh0eXBlRGVmVG1wRm9sZGVyOiBzdHJpbmcpIHtcbiAgICAvLyBkeW5hbWljYWxseSBjaGVjayBhbGwgbmFwaS1ycyBkZXBzIGFuZCBzZXQgYE5BUElfRk9SQ0VfQlVJTERfe3VwcGVyY2FzZShzbmFrZV9jYXNlKG5hbWUpKX0gPSB0aW1lc3RhbXBgXG4gICAgZ2V0TmFwaURlcml2ZURlcGVuZGVudENyYXRlcyh0aGlzLm1ldGFkYXRhKS5mb3JFYWNoKChjcmF0ZSkgPT4ge1xuICAgICAgaWYgKCFleGlzdHNTeW5jKGpvaW4odHlwZURlZlRtcEZvbGRlciwgY3JhdGUubmFtZSkpKSB7XG4gICAgICAgIHRoaXMuZW52c1tcbiAgICAgICAgICBgTkFQSV9GT1JDRV9CVUlMRF8ke2NyYXRlLm5hbWUucmVwbGFjZSgvLS9nLCAnXycpLnRvVXBwZXJDYXNlKCl9YFxuICAgICAgICBdID0gRGF0ZS5ub3coKS50b1N0cmluZygpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIHByaXZhdGUgc2V0QW5kcm9pZEVudigpIHtcbiAgICAvLyBOYXRpdmUgQW5kcm9pZCBob3N0cyBhbmQgYGNyb3NzYCBwcm92aWRlIHRoZWlyIG93biBBbmRyb2lkIHRvb2xjaGFpbnMuXG4gICAgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdhbmRyb2lkJyB8fCB0aGlzLm9wdGlvbnMudXNlQ3Jvc3MpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGNvbnN0IHsgQU5EUk9JRF9OREtfTEFURVNUX0hPTUUgfSA9IHByb2Nlc3MuZW52XG4gICAgaWYgKCFBTkRST0lEX05ES19MQVRFU1RfSE9NRSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgJHtjb2xvcnMucmVkKFxuICAgICAgICAgICdBTkRST0lEX05ES19MQVRFU1RfSE9NRScsXG4gICAgICAgICl9IGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHJlcXVpcmVkIHdoZW4gYnVpbGRpbmcgYW4gQW5kcm9pZCB0YXJnZXQgZnJvbSBhIG5vbi1BbmRyb2lkIGhvc3RgLFxuICAgICAgKVxuICAgIH1cblxuICAgIGNvbnN0IHRhcmdldEFyY2ggPSB0aGlzLnRhcmdldC5hcmNoID09PSAnYXJtJyA/ICdhcm12N2EnIDogJ2FhcmNoNjQnXG4gICAgY29uc3QgdGFyZ2V0UGxhdGZvcm0gPVxuICAgICAgdGhpcy50YXJnZXQuYXJjaCA9PT0gJ2FybScgPyAnYW5kcm9pZGVhYmkyNCcgOiAnYW5kcm9pZDI0J1xuICAgIGNvbnN0IGhvc3RQbGF0Zm9ybSA9XG4gICAgICBwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJ1xuICAgICAgICA/ICdkYXJ3aW4nXG4gICAgICAgIDogcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJ1xuICAgICAgICAgID8gJ3dpbmRvd3MnXG4gICAgICAgICAgOiAnbGludXgnXG4gICAgT2JqZWN0LmFzc2lnbih0aGlzLmVudnMsIHtcbiAgICAgIENBUkdPX1RBUkdFVF9BQVJDSDY0X0xJTlVYX0FORFJPSURfTElOS0VSOiBgJHtBTkRST0lEX05ES19MQVRFU1RfSE9NRX0vdG9vbGNoYWlucy9sbHZtL3ByZWJ1aWx0LyR7aG9zdFBsYXRmb3JtfS14ODZfNjQvYmluLyR7dGFyZ2V0QXJjaH0tbGludXgtYW5kcm9pZDI0LWNsYW5nYCxcbiAgICAgIENBUkdPX1RBUkdFVF9BUk1WN19MSU5VWF9BTkRST0lERUFCSV9MSU5LRVI6IGAke0FORFJPSURfTkRLX0xBVEVTVF9IT01FfS90b29sY2hhaW5zL2xsdm0vcHJlYnVpbHQvJHtob3N0UGxhdGZvcm19LXg4Nl82NC9iaW4vJHt0YXJnZXRBcmNofS1saW51eC1hbmRyb2lkZWFiaTI0LWNsYW5nYCxcbiAgICAgIFRBUkdFVF9DQzogYCR7QU5EUk9JRF9OREtfTEFURVNUX0hPTUV9L3Rvb2xjaGFpbnMvbGx2bS9wcmVidWlsdC8ke2hvc3RQbGF0Zm9ybX0teDg2XzY0L2Jpbi8ke3RhcmdldEFyY2h9LWxpbnV4LSR7dGFyZ2V0UGxhdGZvcm19LWNsYW5nYCxcbiAgICAgIFRBUkdFVF9DWFg6IGAke0FORFJPSURfTkRLX0xBVEVTVF9IT01FfS90b29sY2hhaW5zL2xsdm0vcHJlYnVpbHQvJHtob3N0UGxhdGZvcm19LXg4Nl82NC9iaW4vJHt0YXJnZXRBcmNofS1saW51eC0ke3RhcmdldFBsYXRmb3JtfS1jbGFuZysrYCxcbiAgICAgIFRBUkdFVF9BUjogYCR7QU5EUk9JRF9OREtfTEFURVNUX0hPTUV9L3Rvb2xjaGFpbnMvbGx2bS9wcmVidWlsdC8ke2hvc3RQbGF0Zm9ybX0teDg2XzY0L2Jpbi9sbHZtLWFyYCxcbiAgICAgIFRBUkdFVF9SQU5MSUI6IGAke0FORFJPSURfTkRLX0xBVEVTVF9IT01FfS90b29sY2hhaW5zL2xsdm0vcHJlYnVpbHQvJHtob3N0UGxhdGZvcm19LXg4Nl82NC9iaW4vbGx2bS1yYW5saWJgLFxuICAgICAgQU5EUk9JRF9OREs6IEFORFJPSURfTkRLX0xBVEVTVF9IT01FLFxuICAgICAgUEFUSDogYCR7QU5EUk9JRF9OREtfTEFURVNUX0hPTUV9L3Rvb2xjaGFpbnMvbGx2bS9wcmVidWlsdC8ke2hvc3RQbGF0Zm9ybX0teDg2XzY0L2JpbiR7cHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICc7JyA6ICc6J30ke3Byb2Nlc3MuZW52LlBBVEh9YCxcbiAgICB9KVxuICB9XG5cbiAgcHJpdmF0ZSBzZXRXYXNpRW52KCkge1xuICAgIGNvbnN0IGVtbmFwaSA9IGpvaW4oXG4gICAgICByZXF1aXJlLnJlc29sdmUoJ2VtbmFwaScpLFxuICAgICAgJy4uJyxcbiAgICAgICdsaWInLFxuICAgICAgJ3dhc20zMi13YXNpcDEtdGhyZWFkcycsXG4gICAgKVxuICAgIHRoaXMuZW52cy5FTU5BUElfTElOS19ESVIgPSBlbW5hcGlcbiAgICBjb25zdCBlbW5hcGlWZXJzaW9uID0gcmVxdWlyZSgnZW1uYXBpL3BhY2thZ2UuanNvbicpLnZlcnNpb25cbiAgICBjb25zdCBwcm9qZWN0UmVxdWlyZSA9IGNyZWF0ZVJlcXVpcmUoam9pbih0aGlzLm9wdGlvbnMuY3dkLCAncGFja2FnZS5qc29uJykpXG4gICAgY29uc3QgZW1uYXBpQ29yZVZlcnNpb24gPSBwcm9qZWN0UmVxdWlyZSgnQGVtbmFwaS9jb3JlJykudmVyc2lvblxuICAgIGNvbnN0IGVtbmFwaVJ1bnRpbWVWZXJzaW9uID0gcHJvamVjdFJlcXVpcmUoJ0BlbW5hcGkvcnVudGltZScpLnZlcnNpb25cblxuICAgIGlmIChcbiAgICAgIGVtbmFwaVZlcnNpb24gIT09IGVtbmFwaUNvcmVWZXJzaW9uIHx8XG4gICAgICBlbW5hcGlWZXJzaW9uICE9PSBlbW5hcGlSdW50aW1lVmVyc2lvblxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgZW1uYXBpIHZlcnNpb24gbWlzbWF0Y2g6IGVtbmFwaUAke2VtbmFwaVZlcnNpb259LCBAZW1uYXBpL2NvcmVAJHtlbW5hcGlDb3JlVmVyc2lvbn0sIEBlbW5hcGkvcnVudGltZUAke2VtbmFwaVJ1bnRpbWVWZXJzaW9ufS4gUGxlYXNlIGVuc3VyZSBhbGwgZW1uYXBpIHBhY2thZ2VzIGFyZSB0aGUgc2FtZSB2ZXJzaW9uLmAsXG4gICAgICApXG4gICAgfVxuICAgIGNvbnN0IHsgV0FTSV9TREtfUEFUSCB9ID0gcHJvY2Vzcy5lbnZcblxuICAgIGlmIChXQVNJX1NES19QQVRIICYmIGV4aXN0c1N5bmMoV0FTSV9TREtfUEFUSCkpIHtcbiAgICAgIHRoaXMuZW52cy5DQVJHT19UQVJHRVRfV0FTTTMyX1dBU0lfUFJFVklFVzFfVEhSRUFEU19MSU5LRVIgPSBqb2luKFxuICAgICAgICBXQVNJX1NES19QQVRILFxuICAgICAgICAnYmluJyxcbiAgICAgICAgJ3dhc20tbGQnLFxuICAgICAgKVxuICAgICAgdGhpcy5lbnZzLkNBUkdPX1RBUkdFVF9XQVNNMzJfV0FTSVAxX0xJTktFUiA9IGpvaW4oXG4gICAgICAgIFdBU0lfU0RLX1BBVEgsXG4gICAgICAgICdiaW4nLFxuICAgICAgICAnd2FzbS1sZCcsXG4gICAgICApXG4gICAgICB0aGlzLmVudnMuQ0FSR09fVEFSR0VUX1dBU00zMl9XQVNJUDFfVEhSRUFEU19MSU5LRVIgPSBqb2luKFxuICAgICAgICBXQVNJX1NES19QQVRILFxuICAgICAgICAnYmluJyxcbiAgICAgICAgJ3dhc20tbGQnLFxuICAgICAgKVxuICAgICAgdGhpcy5lbnZzLkNBUkdPX1RBUkdFVF9XQVNNMzJfV0FTSVAyX0xJTktFUiA9IGpvaW4oXG4gICAgICAgIFdBU0lfU0RLX1BBVEgsXG4gICAgICAgICdiaW4nLFxuICAgICAgICAnd2FzbS1sZCcsXG4gICAgICApXG4gICAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKCdUQVJHRVRfQ0MnLCBqb2luKFdBU0lfU0RLX1BBVEgsICdiaW4nLCAnY2xhbmcnKSlcbiAgICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoXG4gICAgICAgICdUQVJHRVRfQ1hYJyxcbiAgICAgICAgam9pbihXQVNJX1NES19QQVRILCAnYmluJywgJ2NsYW5nKysnKSxcbiAgICAgIClcbiAgICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoJ1RBUkdFVF9BUicsIGpvaW4oV0FTSV9TREtfUEFUSCwgJ2JpbicsICdhcicpKVxuICAgICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cyhcbiAgICAgICAgJ1RBUkdFVF9SQU5MSUInLFxuICAgICAgICBqb2luKFdBU0lfU0RLX1BBVEgsICdiaW4nLCAncmFubGliJyksXG4gICAgICApXG4gICAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKFxuICAgICAgICAnVEFSR0VUX0NGTEFHUycsXG4gICAgICAgIGAtLXRhcmdldD13YXNtMzItd2FzaXAxLXRocmVhZHMgLS1zeXNyb290PSR7V0FTSV9TREtfUEFUSH0vc2hhcmUvd2FzaS1zeXNyb290IC1wdGhyZWFkIC1tbGx2bSAtd2FzbS1lbmFibGUtc2psamAsXG4gICAgICApXG4gICAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKFxuICAgICAgICAnVEFSR0VUX0NYWEZMQUdTJyxcbiAgICAgICAgYC0tdGFyZ2V0PXdhc20zMi13YXNpcDEtdGhyZWFkcyAtLXN5c3Jvb3Q9JHtXQVNJX1NES19QQVRIfS9zaGFyZS93YXNpLXN5c3Jvb3QgLXB0aHJlYWQgLW1sbHZtIC13YXNtLWVuYWJsZS1zamxqYCxcbiAgICAgIClcbiAgICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoXG4gICAgICAgIGBUQVJHRVRfTERGTEFHU2AsXG4gICAgICAgIGAtZnVzZS1sZD0ke1dBU0lfU0RLX1BBVEh9L2Jpbi93YXNtLWxkIC0tdGFyZ2V0PXdhc20zMi13YXNpcDEtdGhyZWFkc2AsXG4gICAgICApXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBzZXRPcGVuSGFybW9ueUVudigpIHtcbiAgICBjb25zdCB7IE9IT1NfU0RLX1BBVEgsIE9IT1NfU0RLX05BVElWRSB9ID0gcHJvY2Vzcy5lbnZcbiAgICBjb25zdCBuZGtQYXRoID0gT0hPU19TREtfUEFUSCA/IGAke09IT1NfU0RLX1BBVEh9L25hdGl2ZWAgOiBPSE9TX1NES19OQVRJVkVcbiAgICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gICAgaWYgKCFuZGtQYXRoICYmIHByb2Nlc3MucGxhdGZvcm0gIT09ICdvcGVuaGFybW9ueScpIHtcbiAgICAgIGRlYnVnLndhcm4oXG4gICAgICAgIGAke2NvbG9ycy5yZWQoJ09IT1NfU0RLX1BBVEgnKX0gb3IgJHtjb2xvcnMucmVkKCdPSE9TX1NES19OQVRJVkUnKX0gZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgbWlzc2luZ2AsXG4gICAgICApXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgY29uc3QgbGlua2VyTmFtZSA9IGBDQVJHT19UQVJHRVRfJHt0aGlzLnRhcmdldC50cmlwbGUudG9VcHBlckNhc2UoKS5yZXBsYWNlKC8tL2csICdfJyl9X0xJTktFUmBcbiAgICBjb25zdCByYW5QYXRoID0gYCR7bmRrUGF0aH0vbGx2bS9iaW4vbGx2bS1yYW5saWJgXG4gICAgY29uc3QgYXJQYXRoID0gYCR7bmRrUGF0aH0vbGx2bS9iaW4vbGx2bS1hcmBcbiAgICBjb25zdCBjY1BhdGggPSBgJHtuZGtQYXRofS9sbHZtL2Jpbi8ke3RoaXMudGFyZ2V0LnRyaXBsZX0tY2xhbmdgXG4gICAgY29uc3QgY3h4UGF0aCA9IGAke25ka1BhdGh9L2xsdm0vYmluLyR7dGhpcy50YXJnZXQudHJpcGxlfS1jbGFuZysrYFxuICAgIGNvbnN0IGFzUGF0aCA9IGAke25ka1BhdGh9L2xsdm0vYmluL2xsdm0tYXNgXG4gICAgY29uc3QgbGRQYXRoID0gYCR7bmRrUGF0aH0vbGx2bS9iaW4vbGQubGxkYFxuICAgIGNvbnN0IHN0cmlwUGF0aCA9IGAke25ka1BhdGh9L2xsdm0vYmluL2xsdm0tc3RyaXBgXG4gICAgY29uc3Qgb2JqRHVtcFBhdGggPSBgJHtuZGtQYXRofS9sbHZtL2Jpbi9sbHZtLW9iamR1bXBgXG4gICAgY29uc3Qgb2JqQ29weVBhdGggPSBgJHtuZGtQYXRofS9sbHZtL2Jpbi9sbHZtLW9iamNvcHlgXG4gICAgY29uc3Qgbm1QYXRoID0gYCR7bmRrUGF0aH0vbGx2bS9iaW4vbGx2bS1ubWBcbiAgICBjb25zdCBiaW5QYXRoID0gYCR7bmRrUGF0aH0vbGx2bS9iaW5gXG4gICAgY29uc3QgbGliUGF0aCA9IGAke25ka1BhdGh9L2xsdm0vbGliYFxuXG4gICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cygnTElCQ0xBTkdfUEFUSCcsIGxpYlBhdGgpXG4gICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cygnREVQX0FUT01JQycsICdjbGFuZ19ydC5idWlsdGlucycpXG4gICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cyhsaW5rZXJOYW1lLCBjY1BhdGgpXG4gICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cygnVEFSR0VUX0NDJywgY2NQYXRoKVxuICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoJ1RBUkdFVF9DWFgnLCBjeHhQYXRoKVxuICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoJ1RBUkdFVF9BUicsIGFyUGF0aClcbiAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKCdUQVJHRVRfUkFOTElCJywgcmFuUGF0aClcbiAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKCdUQVJHRVRfQVMnLCBhc1BhdGgpXG4gICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cygnVEFSR0VUX0xEJywgbGRQYXRoKVxuICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoJ1RBUkdFVF9TVFJJUCcsIHN0cmlwUGF0aClcbiAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKCdUQVJHRVRfT0JKRFVNUCcsIG9iakR1bXBQYXRoKVxuICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoJ1RBUkdFVF9PQkpDT1BZJywgb2JqQ29weVBhdGgpXG4gICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cygnVEFSR0VUX05NJywgbm1QYXRoKVxuICAgIHRoaXMuZW52cy5QQVRIID0gYCR7YmluUGF0aH0ke3Byb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicgPyAnOycgOiAnOid9JHtwcm9jZXNzLmVudi5QQVRIfWBcbiAgfVxuXG4gIHByaXZhdGUgc2V0RmVhdHVyZXMoKSB7XG4gICAgY29uc3QgYXJncyA9IFtdXG4gICAgaWYgKHRoaXMub3B0aW9ucy5hbGxGZWF0dXJlcyAmJiB0aGlzLm9wdGlvbnMubm9EZWZhdWx0RmVhdHVyZXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ0Nhbm5vdCBzcGVjaWZ5IC0tYWxsLWZlYXR1cmVzIGFuZCAtLW5vLWRlZmF1bHQtZmVhdHVyZXMgdG9nZXRoZXInLFxuICAgICAgKVxuICAgIH1cbiAgICBpZiAodGhpcy5vcHRpb25zLmFsbEZlYXR1cmVzKSB7XG4gICAgICBhcmdzLnB1c2goJy0tYWxsLWZlYXR1cmVzJylcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5ub0RlZmF1bHRGZWF0dXJlcykge1xuICAgICAgYXJncy5wdXNoKCctLW5vLWRlZmF1bHQtZmVhdHVyZXMnKVxuICAgIH1cbiAgICBpZiAodGhpcy5vcHRpb25zLmZlYXR1cmVzKSB7XG4gICAgICBhcmdzLnB1c2goJy0tZmVhdHVyZXMnLCAuLi50aGlzLm9wdGlvbnMuZmVhdHVyZXMpXG4gICAgfVxuXG4gICAgZGVidWcoJ1NldCBmZWF0dXJlcyBmbGFnczogJylcbiAgICBkZWJ1ZygnICAlTycsIGFyZ3MpXG4gICAgdGhpcy5hcmdzLnB1c2goLi4uYXJncylcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBwcml2YXRlIHNldEJ5cGFzc0FyZ3MoKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5yZWxlYXNlKSB7XG4gICAgICB0aGlzLmFyZ3MucHVzaCgnLS1yZWxlYXNlJylcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnZlcmJvc2UpIHtcbiAgICAgIHRoaXMuYXJncy5wdXNoKCctLXZlcmJvc2UnKVxuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMudGFyZ2V0RGlyKSB7XG4gICAgICB0aGlzLmFyZ3MucHVzaCgnLS10YXJnZXQtZGlyJywgdGhpcy5vcHRpb25zLnRhcmdldERpcilcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnByb2ZpbGUpIHtcbiAgICAgIHRoaXMuYXJncy5wdXNoKCctLXByb2ZpbGUnLCB0aGlzLm9wdGlvbnMucHJvZmlsZSlcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLm1hbmlmZXN0UGF0aCkge1xuICAgICAgdGhpcy5hcmdzLnB1c2goJy0tbWFuaWZlc3QtcGF0aCcsIHRoaXMub3B0aW9ucy5tYW5pZmVzdFBhdGgpXG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5jYXJnb09wdGlvbnM/Lmxlbmd0aCkge1xuICAgICAgdGhpcy5hcmdzLnB1c2goLi4udGhpcy5vcHRpb25zLmNhcmdvT3B0aW9ucylcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgcHJpdmF0ZSBnZW5lcmF0ZUludGVybWVkaWF0ZVR5cGVEZWZGb2xkZXIoKSB7XG4gICAgbGV0IGZvbGRlciA9IGpvaW4oXG4gICAgICB0aGlzLnRhcmdldERpcixcbiAgICAgICduYXBpLXJzJyxcbiAgICAgIGAke3RoaXMuY3JhdGUubmFtZX0tJHtjcmVhdGVIYXNoKCdzaGEyNTYnKVxuICAgICAgICAudXBkYXRlKHRoaXMuY3JhdGUubWFuaWZlc3RfcGF0aClcbiAgICAgICAgLnVwZGF0ZShDTElfVkVSU0lPTilcbiAgICAgICAgLmRpZ2VzdCgnaGV4JylcbiAgICAgICAgLnN1YnN0cmluZygwLCA4KX1gLFxuICAgIClcblxuICAgIGlmICghdGhpcy5vcHRpb25zLmR0c0NhY2hlKSB7XG4gICAgICBybVN5bmMoZm9sZGVyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9yY2U6IHRydWUgfSlcbiAgICAgIGZvbGRlciArPSBgXyR7RGF0ZS5ub3coKX1gXG4gICAgfVxuXG4gICAgbWtkaXJBc3luYyhmb2xkZXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pXG5cbiAgICByZXR1cm4gZm9sZGVyXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHBvc3RCdWlsZCgpIHtcbiAgICB0cnkge1xuICAgICAgZGVidWcoYFRyeSB0byBjcmVhdGUgb3V0cHV0IGRpcmVjdG9yeTpgKVxuICAgICAgZGVidWcoJyAgJWknLCB0aGlzLm91dHB1dERpcilcbiAgICAgIGF3YWl0IG1rZGlyQXN5bmModGhpcy5vdXRwdXREaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pXG4gICAgICBkZWJ1ZyhgT3V0cHV0IGRpcmVjdG9yeSBjcmVhdGVkYClcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBjcmVhdGUgb3V0cHV0IGRpcmVjdG9yeSAke3RoaXMub3V0cHV0RGlyfWAsIHtcbiAgICAgICAgY2F1c2U6IGUsXG4gICAgICB9KVxuICAgIH1cblxuICAgIGNvbnN0IHdhc21CaW5hcnlOYW1lID0gYXdhaXQgdGhpcy5jb3B5QXJ0aWZhY3QoKVxuXG4gICAgLy8gb25seSBmb3IgY2R5bGliXG4gICAgaWYgKHRoaXMuY2R5TGliTmFtZSkge1xuICAgICAgY29uc3QgaWRlbnRzID0gYXdhaXQgdGhpcy5nZW5lcmF0ZVR5cGVEZWYoKVxuICAgICAgY29uc3QganNPdXRwdXQgPSBhd2FpdCB0aGlzLndyaXRlSnNCaW5kaW5nKGlkZW50cylcbiAgICAgIGNvbnN0IHdhc21CaW5kaW5nc091dHB1dCA9IGF3YWl0IHRoaXMud3JpdGVXYXNpQmluZGluZyhcbiAgICAgICAgd2FzbUJpbmFyeU5hbWUsXG4gICAgICAgIGlkZW50cyxcbiAgICAgIClcbiAgICAgIGlmIChqc091dHB1dCkge1xuICAgICAgICB0aGlzLm91dHB1dHMucHVzaChqc091dHB1dClcbiAgICAgIH1cbiAgICAgIGlmICh3YXNtQmluZGluZ3NPdXRwdXQpIHtcbiAgICAgICAgdGhpcy5vdXRwdXRzLnB1c2goLi4ud2FzbUJpbmRpbmdzT3V0cHV0KVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLm91dHB1dHNcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgY29weUFydGlmYWN0KCkge1xuICAgIGNvbnN0IFtzcmNOYW1lLCBkZXN0TmFtZSwgd2FzbUJpbmFyeU5hbWVdID0gdGhpcy5nZXRBcnRpZmFjdE5hbWVzKClcbiAgICBpZiAoIXNyY05hbWUgfHwgIWRlc3ROYW1lKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCBwcm9maWxlID1cbiAgICAgIHRoaXMub3B0aW9ucy5wcm9maWxlID8/ICh0aGlzLm9wdGlvbnMucmVsZWFzZSA/ICdyZWxlYXNlJyA6ICdkZWJ1ZycpXG4gICAgY29uc3Qgc3JjID0gam9pbih0aGlzLnRhcmdldERpciwgdGhpcy50YXJnZXQudHJpcGxlLCBwcm9maWxlLCBzcmNOYW1lKVxuICAgIGRlYnVnKGBDb3B5IGFydGlmYWN0IGZyb206IFske3NyY31dYClcbiAgICBjb25zdCBkZXN0ID0gam9pbih0aGlzLm91dHB1dERpciwgZGVzdE5hbWUpXG4gICAgY29uc3QgaXNXYXNtID0gZGVzdC5lbmRzV2l0aCgnLndhc20nKVxuXG4gICAgdHJ5IHtcbiAgICAgIGlmIChhd2FpdCBmaWxlRXhpc3RzKGRlc3QpKSB7XG4gICAgICAgIGRlYnVnKCdPbGQgYXJ0aWZhY3QgZm91bmQsIHJlbW92ZSBpdCBmaXJzdCcpXG4gICAgICAgIGF3YWl0IHVubGlua0FzeW5jKGRlc3QpXG4gICAgICB9XG4gICAgICBkZWJ1ZygnQ29weSBhcnRpZmFjdCB0bzonKVxuICAgICAgZGVidWcoJyAgJWknLCBkZXN0KVxuICAgICAgaWYgKGlzV2FzbSkge1xuICAgICAgICBjb25zdCB7IE1vZHVsZUNvbmZpZyB9ID0gYXdhaXQgaW1wb3J0KCdAbmFwaS1ycy93YXNtLXRvb2xzJylcbiAgICAgICAgZGVidWcoJ0dlbmVyYXRlIGRlYnVnIHdhc20gbW9kdWxlJylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBkZWJ1Z1dhc21Nb2R1bGUgPSBuZXcgTW9kdWxlQ29uZmlnKClcbiAgICAgICAgICAgIC5nZW5lcmF0ZUR3YXJmKHRydWUpXG4gICAgICAgICAgICAuZ2VuZXJhdGVOYW1lU2VjdGlvbih0cnVlKVxuICAgICAgICAgICAgLmdlbmVyYXRlUHJvZHVjZXJzU2VjdGlvbih0cnVlKVxuICAgICAgICAgICAgLnByZXNlcnZlQ29kZVRyYW5zZm9ybSh0cnVlKVxuICAgICAgICAgICAgLnN0cmljdFZhbGlkYXRlKGZhbHNlKVxuICAgICAgICAgICAgLnBhcnNlKGF3YWl0IHJlYWRGaWxlQXN5bmMoc3JjKSlcbiAgICAgICAgICBjb25zdCBkZWJ1Z1dhc21CaW5hcnkgPSBkZWJ1Z1dhc21Nb2R1bGUuZW1pdFdhc20odHJ1ZSlcbiAgICAgICAgICBhd2FpdCB3cml0ZUZpbGVBc3luYyhcbiAgICAgICAgICAgIGRlc3QucmVwbGFjZSgvXFwud2FzbSQvLCAnLmRlYnVnLndhc20nKSxcbiAgICAgICAgICAgIGRlYnVnV2FzbUJpbmFyeSxcbiAgICAgICAgICApXG4gICAgICAgICAgZGVidWcoJ0dlbmVyYXRlIHJlbGVhc2Ugd2FzbSBtb2R1bGUnKVxuICAgICAgICAgIGNvbnN0IHJlbGVhc2VXYXNtTW9kdWxlID0gbmV3IE1vZHVsZUNvbmZpZygpXG4gICAgICAgICAgICAuZ2VuZXJhdGVEd2FyZihmYWxzZSlcbiAgICAgICAgICAgIC5nZW5lcmF0ZU5hbWVTZWN0aW9uKGZhbHNlKVxuICAgICAgICAgICAgLmdlbmVyYXRlUHJvZHVjZXJzU2VjdGlvbihmYWxzZSlcbiAgICAgICAgICAgIC5wcmVzZXJ2ZUNvZGVUcmFuc2Zvcm0oZmFsc2UpXG4gICAgICAgICAgICAuc3RyaWN0VmFsaWRhdGUoZmFsc2UpXG4gICAgICAgICAgICAub25seVN0YWJsZUZlYXR1cmVzKGZhbHNlKVxuICAgICAgICAgICAgLnBhcnNlKGRlYnVnV2FzbUJpbmFyeSlcbiAgICAgICAgICBjb25zdCByZWxlYXNlV2FzbUJpbmFyeSA9IHJlbGVhc2VXYXNtTW9kdWxlLmVtaXRXYXNtKGZhbHNlKVxuICAgICAgICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKGRlc3QsIHJlbGVhc2VXYXNtQmluYXJ5KVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgZGVidWcud2FybihcbiAgICAgICAgICAgIGBGYWlsZWQgdG8gZ2VuZXJhdGUgZGVidWcgd2FzbSBtb2R1bGU6ICR7KGUgYXMgYW55KS5tZXNzYWdlID8/IGV9YCxcbiAgICAgICAgICApXG4gICAgICAgICAgYXdhaXQgY29weUZpbGVBc3luYyhzcmMsIGRlc3QpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IGNvcHlGaWxlQXN5bmMoc3JjLCBkZXN0KVxuICAgICAgfVxuICAgICAgdGhpcy5vdXRwdXRzLnB1c2goe1xuICAgICAgICBraW5kOiBkZXN0LmVuZHNXaXRoKCcubm9kZScpID8gJ25vZGUnIDogaXNXYXNtID8gJ3dhc20nIDogJ2V4ZScsXG4gICAgICAgIHBhdGg6IGRlc3QsXG4gICAgICB9KVxuICAgICAgcmV0dXJuIHdhc21CaW5hcnlOYW1lID8gam9pbih0aGlzLm91dHB1dERpciwgd2FzbUJpbmFyeU5hbWUpIDogbnVsbFxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGNvcHkgYXJ0aWZhY3QnLCB7IGNhdXNlOiBlIH0pXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXRBcnRpZmFjdE5hbWVzKCkge1xuICAgIGlmICh0aGlzLmNkeUxpYk5hbWUpIHtcbiAgICAgIGNvbnN0IGNkeUxpYiA9IHRoaXMuY2R5TGliTmFtZS5yZXBsYWNlKC8tL2csICdfJylcbiAgICAgIGNvbnN0IHdhc2lUYXJnZXQgPSB0aGlzLmNvbmZpZy50YXJnZXRzLmZpbmQoKHQpID0+IHQucGxhdGZvcm0gPT09ICd3YXNpJylcblxuICAgICAgY29uc3Qgc3JjTmFtZSA9XG4gICAgICAgIHRoaXMudGFyZ2V0LnBsYXRmb3JtID09PSAnZGFyd2luJ1xuICAgICAgICAgID8gYGxpYiR7Y2R5TGlifS5keWxpYmBcbiAgICAgICAgICA6IHRoaXMudGFyZ2V0LnBsYXRmb3JtID09PSAnd2luMzInXG4gICAgICAgICAgICA/IGAke2NkeUxpYn0uZGxsYFxuICAgICAgICAgICAgOiB0aGlzLnRhcmdldC5wbGF0Zm9ybSA9PT0gJ3dhc2knIHx8IHRoaXMudGFyZ2V0LnBsYXRmb3JtID09PSAnd2FzbSdcbiAgICAgICAgICAgICAgPyBgJHtjZHlMaWJ9Lndhc21gXG4gICAgICAgICAgICAgIDogYGxpYiR7Y2R5TGlifS5zb2BcblxuICAgICAgbGV0IGRlc3ROYW1lID0gdGhpcy5jb25maWcuYmluYXJ5TmFtZVxuICAgICAgLy8gYWRkIHBsYXRmb3JtIHN1ZmZpeCB0byBiaW5hcnkgbmFtZVxuICAgICAgLy8gaW5kZXhbLmxpbnV4LXg2NC1nbnVdLm5vZGVcbiAgICAgIC8vICAgICAgIF5eXl5eXl5eXl5eXl5eXG4gICAgICBpZiAodGhpcy5vcHRpb25zLnBsYXRmb3JtKSB7XG4gICAgICAgIGRlc3ROYW1lICs9IGAuJHt0aGlzLnRhcmdldC5wbGF0Zm9ybUFyY2hBQkl9YFxuICAgICAgfVxuICAgICAgaWYgKHNyY05hbWUuZW5kc1dpdGgoJy53YXNtJykpIHtcbiAgICAgICAgZGVzdE5hbWUgKz0gJy53YXNtJ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVzdE5hbWUgKz0gJy5ub2RlJ1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gW1xuICAgICAgICBzcmNOYW1lLFxuICAgICAgICBkZXN0TmFtZSxcbiAgICAgICAgd2FzaVRhcmdldFxuICAgICAgICAgID8gYCR7dGhpcy5jb25maWcuYmluYXJ5TmFtZX0uJHt3YXNpVGFyZ2V0LnBsYXRmb3JtQXJjaEFCSX0ud2FzbWBcbiAgICAgICAgICA6IG51bGwsXG4gICAgICBdXG4gICAgfSBlbHNlIGlmICh0aGlzLmJpbk5hbWUpIHtcbiAgICAgIGNvbnN0IHNyY05hbWUgPVxuICAgICAgICB0aGlzLnRhcmdldC5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/IGAke3RoaXMuYmluTmFtZX0uZXhlYCA6IHRoaXMuYmluTmFtZVxuXG4gICAgICByZXR1cm4gW3NyY05hbWUsIHNyY05hbWVdXG4gICAgfVxuXG4gICAgcmV0dXJuIFtdXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGdlbmVyYXRlVHlwZURlZigpIHtcbiAgICBjb25zdCB0eXBlRGVmRGlyID0gdGhpcy5lbnZzLk5BUElfVFlQRV9ERUZfVE1QX0ZPTERFUlxuICAgIGlmICghdGhpcy5lbmFibGVUeXBlRGVmKSB7XG4gICAgICByZXR1cm4gW11cbiAgICB9XG5cbiAgICBjb25zdCB7IGV4cG9ydHMsIGR0cyB9ID0gYXdhaXQgZ2VuZXJhdGVUeXBlRGVmKHtcbiAgICAgIHR5cGVEZWZEaXIsXG4gICAgICBub0R0c0hlYWRlcjogdGhpcy5vcHRpb25zLm5vRHRzSGVhZGVyLFxuICAgICAgZHRzSGVhZGVyOiB0aGlzLm9wdGlvbnMuZHRzSGVhZGVyLFxuICAgICAgY29uZmlnRHRzSGVhZGVyOiB0aGlzLmNvbmZpZy5kdHNIZWFkZXIsXG4gICAgICBjb25maWdEdHNIZWFkZXJGaWxlOiB0aGlzLmNvbmZpZy5kdHNIZWFkZXJGaWxlLFxuICAgICAgY29uc3RFbnVtOiB0aGlzLm9wdGlvbnMuY29uc3RFbnVtID8/IHRoaXMuY29uZmlnLmNvbnN0RW51bSxcbiAgICAgIHJ1bnRpbWVTdHJpbmdFbnVtOlxuICAgICAgICB0aGlzLm9wdGlvbnMucnVudGltZVN0cmluZ0VudW0gPz8gdGhpcy5jb25maWcucnVudGltZVN0cmluZ0VudW0sXG4gICAgICBjd2Q6IHRoaXMub3B0aW9ucy5jd2QsXG4gICAgfSlcblxuICAgIGNvbnN0IGRlc3QgPSBqb2luKHRoaXMub3V0cHV0RGlyLCB0aGlzLm9wdGlvbnMuZHRzID8/ICdpbmRleC5kLnRzJylcblxuICAgIHRyeSB7XG4gICAgICBkZWJ1ZygnV3JpdGluZyB0eXBlIGRlZiB0bzonKVxuICAgICAgZGVidWcoJyAgJWknLCBkZXN0KVxuICAgICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoZGVzdCwgZHRzLCAndXRmLTgnKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGRlYnVnLmVycm9yKCdGYWlsZWQgdG8gd3JpdGUgdHlwZSBkZWYgZmlsZScpXG4gICAgICBkZWJ1Zy5lcnJvcihlIGFzIEVycm9yKVxuICAgIH1cblxuICAgIGlmIChleHBvcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGRlc3QgPSBqb2luKHRoaXMub3V0cHV0RGlyLCB0aGlzLm9wdGlvbnMuZHRzID8/ICdpbmRleC5kLnRzJylcbiAgICAgIHRoaXMub3V0cHV0cy5wdXNoKHsga2luZDogJ2R0cycsIHBhdGg6IGRlc3QgfSlcbiAgICB9XG5cbiAgICByZXR1cm4gZXhwb3J0c1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyB3cml0ZUpzQmluZGluZyhpZGVudHM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIHdyaXRlSnNCaW5kaW5nKHtcbiAgICAgIHBsYXRmb3JtOiB0aGlzLm9wdGlvbnMucGxhdGZvcm0sXG4gICAgICBub0pzQmluZGluZzogdGhpcy5vcHRpb25zLm5vSnNCaW5kaW5nLFxuICAgICAgaWRlbnRzLFxuICAgICAganNCaW5kaW5nOiB0aGlzLm9wdGlvbnMuanNCaW5kaW5nLFxuICAgICAgZXNtOiB0aGlzLm9wdGlvbnMuZXNtLFxuICAgICAgYmluYXJ5TmFtZTogdGhpcy5jb25maWcuYmluYXJ5TmFtZSxcbiAgICAgIHBhY2thZ2VOYW1lOiB0aGlzLm9wdGlvbnMuanNQYWNrYWdlTmFtZSA/PyB0aGlzLmNvbmZpZy5wYWNrYWdlTmFtZSxcbiAgICAgIHZlcnNpb246IHByb2Nlc3MuZW52Lm5wbV9uZXdfdmVyc2lvbiA/PyB0aGlzLmNvbmZpZy5wYWNrYWdlSnNvbi52ZXJzaW9uLFxuICAgICAgb3V0cHV0RGlyOiB0aGlzLm91dHB1dERpcixcbiAgICB9KVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyB3cml0ZVdhc2lCaW5kaW5nKFxuICAgIGRpc3RGaWxlTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkIHwgbnVsbCxcbiAgICBpZGVudHM6IHN0cmluZ1tdLFxuICApIHtcbiAgICBpZiAoZGlzdEZpbGVOYW1lKSB7XG4gICAgICBjb25zdCB7IG5hbWUsIGRpciB9ID0gcGFyc2UoZGlzdEZpbGVOYW1lKVxuICAgICAgY29uc3QgYmluZGluZ1BhdGggPSBqb2luKGRpciwgYCR7dGhpcy5jb25maWcuYmluYXJ5TmFtZX0ud2FzaS5janNgKVxuICAgICAgY29uc3QgYnJvd3NlckJpbmRpbmdQYXRoID0gam9pbihcbiAgICAgICAgZGlyLFxuICAgICAgICBgJHt0aGlzLmNvbmZpZy5iaW5hcnlOYW1lfS53YXNpLWJyb3dzZXIuanNgLFxuICAgICAgKVxuICAgICAgY29uc3Qgd29ya2VyUGF0aCA9IGpvaW4oZGlyLCAnd2FzaS13b3JrZXIubWpzJylcbiAgICAgIGNvbnN0IGJyb3dzZXJXb3JrZXJQYXRoID0gam9pbihkaXIsICd3YXNpLXdvcmtlci1icm93c2VyLm1qcycpXG4gICAgICBjb25zdCBicm93c2VyRW50cnlQYXRoID0gam9pbihkaXIsICdicm93c2VyLmpzJylcbiAgICAgIGNvbnN0IGV4cG9ydHNDb2RlID1cbiAgICAgICAgYG1vZHVsZS5leHBvcnRzID0gX19uYXBpTW9kdWxlLmV4cG9ydHNcXG5gICtcbiAgICAgICAgaWRlbnRzXG4gICAgICAgICAgLm1hcChcbiAgICAgICAgICAgIChpZGVudCkgPT5cbiAgICAgICAgICAgICAgYG1vZHVsZS5leHBvcnRzLiR7aWRlbnR9ID0gX19uYXBpTW9kdWxlLmV4cG9ydHMuJHtpZGVudH1gLFxuICAgICAgICAgIClcbiAgICAgICAgICAuam9pbignXFxuJylcbiAgICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKFxuICAgICAgICBiaW5kaW5nUGF0aCxcbiAgICAgICAgY3JlYXRlV2FzaUJpbmRpbmcoXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICB0aGlzLmNvbmZpZy5wYWNrYWdlTmFtZSxcbiAgICAgICAgICB0aGlzLmNvbmZpZy53YXNtPy5pbml0aWFsTWVtb3J5LFxuICAgICAgICAgIHRoaXMuY29uZmlnLndhc20/Lm1heGltdW1NZW1vcnksXG4gICAgICAgICkgK1xuICAgICAgICAgIGV4cG9ydHNDb2RlICtcbiAgICAgICAgICAnXFxuJyxcbiAgICAgICAgJ3V0ZjgnLFxuICAgICAgKVxuICAgICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoXG4gICAgICAgIGJyb3dzZXJCaW5kaW5nUGF0aCxcbiAgICAgICAgY3JlYXRlV2FzaUJyb3dzZXJCaW5kaW5nKFxuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgdGhpcy5jb25maWcud2FzbT8uaW5pdGlhbE1lbW9yeSxcbiAgICAgICAgICB0aGlzLmNvbmZpZy53YXNtPy5tYXhpbXVtTWVtb3J5LFxuICAgICAgICAgIHRoaXMuY29uZmlnLndhc20/LmJyb3dzZXI/LmZzLFxuICAgICAgICAgIHRoaXMuY29uZmlnLndhc20/LmJyb3dzZXI/LmFzeW5jSW5pdCxcbiAgICAgICAgICB0aGlzLmNvbmZpZy53YXNtPy5icm93c2VyPy5idWZmZXIsXG4gICAgICAgICAgdGhpcy5jb25maWcud2FzbT8uYnJvd3Nlcj8uZXJyb3JFdmVudCxcbiAgICAgICAgKSArXG4gICAgICAgICAgYGV4cG9ydCBkZWZhdWx0IF9fbmFwaU1vZHVsZS5leHBvcnRzXFxuYCArXG4gICAgICAgICAgaWRlbnRzXG4gICAgICAgICAgICAubWFwKFxuICAgICAgICAgICAgICAoaWRlbnQpID0+XG4gICAgICAgICAgICAgICAgYGV4cG9ydCBjb25zdCAke2lkZW50fSA9IF9fbmFwaU1vZHVsZS5leHBvcnRzLiR7aWRlbnR9YCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5qb2luKCdcXG4nKSArXG4gICAgICAgICAgJ1xcbicsXG4gICAgICAgICd1dGY4JyxcbiAgICAgIClcbiAgICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKHdvcmtlclBhdGgsIFdBU0lfV09SS0VSX1RFTVBMQVRFLCAndXRmOCcpXG4gICAgICBhd2FpdCB3cml0ZUZpbGVBc3luYyhcbiAgICAgICAgYnJvd3NlcldvcmtlclBhdGgsXG4gICAgICAgIGNyZWF0ZVdhc2lCcm93c2VyV29ya2VyQmluZGluZyhcbiAgICAgICAgICB0aGlzLmNvbmZpZy53YXNtPy5icm93c2VyPy5mcyA/PyBmYWxzZSxcbiAgICAgICAgICB0aGlzLmNvbmZpZy53YXNtPy5icm93c2VyPy5lcnJvckV2ZW50ID8/IGZhbHNlLFxuICAgICAgICApLFxuICAgICAgICAndXRmOCcsXG4gICAgICApXG4gICAgICBhd2FpdCB3cml0ZUZpbGVBc3luYyhcbiAgICAgICAgYnJvd3NlckVudHJ5UGF0aCxcbiAgICAgICAgYGV4cG9ydCAqIGZyb20gJyR7dGhpcy5jb25maWcucGFja2FnZU5hbWV9LXdhc20zMi13YXNpJ1xcbmAsXG4gICAgICApXG4gICAgICByZXR1cm4gW1xuICAgICAgICB7IGtpbmQ6ICdqcycsIHBhdGg6IGJpbmRpbmdQYXRoIH0sXG4gICAgICAgIHsga2luZDogJ2pzJywgcGF0aDogYnJvd3NlckJpbmRpbmdQYXRoIH0sXG4gICAgICAgIHsga2luZDogJ2pzJywgcGF0aDogd29ya2VyUGF0aCB9LFxuICAgICAgICB7IGtpbmQ6ICdqcycsIHBhdGg6IGJyb3dzZXJXb3JrZXJQYXRoIH0sXG4gICAgICAgIHsga2luZDogJ2pzJywgcGF0aDogYnJvd3NlckVudHJ5UGF0aCB9LFxuICAgICAgXSBzYXRpc2ZpZXMgT3V0cHV0W11cbiAgICB9XG4gICAgcmV0dXJuIFtdXG4gIH1cblxuICBwcml2YXRlIHNldEVudklmTm90RXhpc3RzKGVudjogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKSB7XG4gICAgaWYgKCFwcm9jZXNzLmVudltlbnZdKSB7XG4gICAgICB0aGlzLmVudnNbZW52XSA9IHZhbHVlXG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV3JpdGVKc0JpbmRpbmdPcHRpb25zIHtcbiAgcGxhdGZvcm0/OiBib29sZWFuXG4gIG5vSnNCaW5kaW5nPzogYm9vbGVhblxuICBpZGVudHM6IHN0cmluZ1tdXG4gIGpzQmluZGluZz86IHN0cmluZ1xuICBlc20/OiBib29sZWFuXG4gIGJpbmFyeU5hbWU6IHN0cmluZ1xuICBwYWNrYWdlTmFtZTogc3RyaW5nXG4gIHZlcnNpb246IHN0cmluZ1xuICBvdXRwdXREaXI6IHN0cmluZ1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd3JpdGVKc0JpbmRpbmcoXG4gIG9wdGlvbnM6IFdyaXRlSnNCaW5kaW5nT3B0aW9ucyxcbik6IFByb21pc2U8T3V0cHV0IHwgdW5kZWZpbmVkPiB7XG4gIGlmIChcbiAgICAhb3B0aW9ucy5wbGF0Zm9ybSB8fFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvcHJlZmVyLW51bGxpc2gtY29hbGVzY2luZ1xuICAgIG9wdGlvbnMubm9Kc0JpbmRpbmcgfHxcbiAgICBvcHRpb25zLmlkZW50cy5sZW5ndGggPT09IDBcbiAgKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBjb25zdCBuYW1lID0gb3B0aW9ucy5qc0JpbmRpbmcgPz8gJ2luZGV4LmpzJ1xuXG4gIGNvbnN0IGNyZWF0ZUJpbmRpbmcgPSBvcHRpb25zLmVzbSA/IGNyZWF0ZUVzbUJpbmRpbmcgOiBjcmVhdGVDanNCaW5kaW5nXG4gIGNvbnN0IGJpbmRpbmcgPSBjcmVhdGVCaW5kaW5nKFxuICAgIG9wdGlvbnMuYmluYXJ5TmFtZSxcbiAgICBvcHRpb25zLnBhY2thZ2VOYW1lLFxuICAgIG9wdGlvbnMuaWRlbnRzLFxuICAgIC8vIGluIG5wbSBwcmV2ZXJzaW9uIGhvb2tcbiAgICBvcHRpb25zLnZlcnNpb24sXG4gIClcblxuICB0cnkge1xuICAgIGNvbnN0IGRlc3QgPSBqb2luKG9wdGlvbnMub3V0cHV0RGlyLCBuYW1lKVxuICAgIGRlYnVnKCdXcml0aW5nIGpzIGJpbmRpbmcgdG86JylcbiAgICBkZWJ1ZygnICAlaScsIGRlc3QpXG4gICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoZGVzdCwgYmluZGluZywgJ3V0Zi04JylcbiAgICByZXR1cm4geyBraW5kOiAnanMnLCBwYXRoOiBkZXN0IH0gc2F0aXNmaWVzIE91dHB1dFxuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gd3JpdGUganMgYmluZGluZyBmaWxlJywgeyBjYXVzZTogZSB9KVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR2VuZXJhdGVUeXBlRGVmT3B0aW9ucyB7XG4gIHR5cGVEZWZEaXI6IHN0cmluZ1xuICBub0R0c0hlYWRlcj86IGJvb2xlYW5cbiAgZHRzSGVhZGVyPzogc3RyaW5nXG4gIGR0c0hlYWRlckZpbGU/OiBzdHJpbmdcbiAgY29uZmlnRHRzSGVhZGVyPzogc3RyaW5nXG4gIGNvbmZpZ0R0c0hlYWRlckZpbGU/OiBzdHJpbmdcbiAgY29uc3RFbnVtPzogYm9vbGVhblxuICBydW50aW1lU3RyaW5nRW51bT86IGJvb2xlYW5cbiAgY3dkOiBzdHJpbmdcbn1cblxuLyoqXG4gKiBXYWxrIHRoZSBuYXBpLWRlcml2ZSBpbnRlcm1lZGlhdGUgdHlwZS1kZWYgZGlyZWN0b3J5LCByZW5kZXIgZXZlcnkgZW50cnlcbiAqIGludG8gVHlwZVNjcmlwdCB2aWEge0BsaW5rIHByb2Nlc3NUeXBlRGVmfSwgYW5kIHJldHVybiB0aGUgY29uY2F0ZW5hdGVkXG4gKiBgLmQudHNgIHNvdXJjZSBwbHVzIHRoZSBsaXN0IG9mIGlkZW50aWZpZXJzIHRvIHJlLWV4cG9ydCBmcm9tXG4gKiBgaW5kZXguanNgLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVUeXBlRGVmKFxuICBvcHRpb25zOiBHZW5lcmF0ZVR5cGVEZWZPcHRpb25zLFxuKTogUHJvbWlzZTx7IGV4cG9ydHM6IHN0cmluZ1tdOyBkdHM6IHN0cmluZyB9PiB7XG4gIGlmICghKGF3YWl0IGRpckV4aXN0c0FzeW5jKG9wdGlvbnMudHlwZURlZkRpcikpKSB7XG4gICAgcmV0dXJuIHsgZXhwb3J0czogW10sIGR0czogJycgfVxuICB9XG5cbiAgbGV0IGhlYWRlciA9ICcnXG4gIGxldCBkdHMgPSAnJ1xuICBsZXQgZXhwb3J0czogc3RyaW5nW10gPSBbXVxuXG4gIGlmICghb3B0aW9ucy5ub0R0c0hlYWRlcikge1xuICAgIGNvbnN0IGR0c0hlYWRlciA9IG9wdGlvbnMuZHRzSGVhZGVyID8/IG9wdGlvbnMuY29uZmlnRHRzSGVhZGVyXG4gICAgY29uc3QgZHRzSGVhZGVyRmlsZSA9IG9wdGlvbnMuZHRzSGVhZGVyRmlsZSA/PyBvcHRpb25zLmNvbmZpZ0R0c0hlYWRlckZpbGVcbiAgICAvLyBBbiBleHBsaWNpdCBBUEkgaGVhZGVyIGZpbGUgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHRoZSBjb25maWcgZmlsZTtcbiAgICAvLyBlaXRoZXIgZmlsZSB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgaW5saW5lIGhlYWRlciB0ZXh0LlxuICAgIGlmIChkdHNIZWFkZXJGaWxlKSB7XG4gICAgICB0cnkge1xuICAgICAgICBoZWFkZXIgPSBhd2FpdCByZWFkRmlsZUFzeW5jKGpvaW4ob3B0aW9ucy5jd2QsIGR0c0hlYWRlckZpbGUpLCAndXRmLTgnKVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBkZWJ1Zy53YXJuKGBGYWlsZWQgdG8gcmVhZCBkdHMgaGVhZGVyIGZpbGUgJHtkdHNIZWFkZXJGaWxlfWAsIGUpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChkdHNIZWFkZXIpIHtcbiAgICAgIGhlYWRlciA9IGR0c0hlYWRlclxuICAgIH0gZWxzZSB7XG4gICAgICBoZWFkZXIgPSBERUZBVUxUX1RZUEVfREVGX0hFQURFUlxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGZpbGVzID0gYXdhaXQgcmVhZGRpckFzeW5jKG9wdGlvbnMudHlwZURlZkRpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG5cbiAgaWYgKCFmaWxlcy5sZW5ndGgpIHtcbiAgICBkZWJ1ZygnTm8gdHlwZSBkZWYgZmlsZXMgZm91bmQuIFNraXAgZ2VuZXJhdGluZyBkdHMgZmlsZS4nKVxuICAgIHJldHVybiB7IGV4cG9ydHM6IFtdLCBkdHM6ICcnIH1cbiAgfVxuXG4gIGNvbnN0IHR5cGVEZWZGaWxlcyA9IGZpbGVzXG4gICAgLmZpbHRlcigoZmlsZSkgPT4gZmlsZS5pc0ZpbGUoKSlcbiAgICAuc29ydCgoYSwgYikgPT4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSlcblxuICBjb25zdCBjb25zdEVudW0gPSBvcHRpb25zLmNvbnN0RW51bSA/PyB0cnVlXG4gIGNvbnN0IHJ1bnRpbWVTdHJpbmdFbnVtID0gb3B0aW9ucy5ydW50aW1lU3RyaW5nRW51bSA/PyBmYWxzZVxuICBpZiAocnVudGltZVN0cmluZ0VudW0gJiYgY29uc3RFbnVtKSB7XG4gICAgZGVidWcud2FybihcbiAgICAgICdgLS1ydW50aW1lLXN0cmluZy1lbnVtYCBoYXMgbm8gZWZmZWN0IHdoZW4gYC0tY29uc3QtZW51bWAgaXMgZW5hYmxlZCAodGhlIGRlZmF1bHQpLiBQYXNzIGAtLW5vLWNvbnN0LWVudW1gIHRvIGFjdGl2YXRlIHJ1bnRpbWUgc3RyaW5nIGVudW0gZW1pc3Npb24uJyxcbiAgICApXG4gIH1cblxuICBjb25zdCBwcm9jZXNzZWRUeXBlRGVmcyA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgIHR5cGVEZWZGaWxlcy5tYXAoKGZpbGUpID0+XG4gICAgICBwcm9jZXNzVHlwZURlZihcbiAgICAgICAgam9pbihvcHRpb25zLnR5cGVEZWZEaXIsIGZpbGUubmFtZSksXG4gICAgICAgIGNvbnN0RW51bSxcbiAgICAgICAgcnVudGltZVN0cmluZ0VudW0sXG4gICAgICApLFxuICAgICksXG4gIClcblxuICBkdHMgPSBwcm9jZXNzZWRUeXBlRGVmcy5tYXAoKHsgZHRzIH0pID0+IGR0cykuam9pbignJylcbiAgZXhwb3J0cyA9IHByb2Nlc3NlZFR5cGVEZWZzLmZsYXRNYXAoKHsgZXhwb3J0cyB9KSA9PiBleHBvcnRzKVxuXG4gIGlmIChkdHMuaW5kZXhPZignRXh0ZXJuYWxPYmplY3Q8JykgPiAtMSkge1xuICAgIGhlYWRlciArPSBgXG5leHBvcnQgZGVjbGFyZSBjbGFzcyBFeHRlcm5hbE9iamVjdDxUPiB7XG4gIHJlYWRvbmx5ICcnOiB7XG4gICAgcmVhZG9ubHkgJyc6IHVuaXF1ZSBzeW1ib2xcbiAgICBbSzogc3ltYm9sXTogVFxuICB9XG59XG5gXG4gIH1cblxuICBpZiAoZHRzLmluZGV4T2YoJ1R5cGVkQXJyYXknKSA+IC0xKSB7XG4gICAgaGVhZGVyICs9IGBcbmV4cG9ydCB0eXBlIFR5cGVkQXJyYXkgPSBJbnQ4QXJyYXkgfCBVaW50OEFycmF5IHwgVWludDhDbGFtcGVkQXJyYXkgfCBJbnQxNkFycmF5IHwgVWludDE2QXJyYXkgfCBJbnQzMkFycmF5IHwgVWludDMyQXJyYXkgfCBGbG9hdDMyQXJyYXkgfCBGbG9hdDY0QXJyYXkgfCBCaWdJbnQ2NEFycmF5IHwgQmlnVWludDY0QXJyYXlcbmBcbiAgfVxuXG4gIGR0cyA9IGhlYWRlciArIGR0c1xuXG4gIHJldHVybiB7XG4gICAgZXhwb3J0cyxcbiAgICBkdHMsXG4gIH1cbn1cbiIsIi8vIFRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgYnkgY29kZWdlbi9pbmRleC50c1xuLy8gRG8gbm90IGVkaXQgdGhpcyBmaWxlIG1hbnVhbGx5XG5pbXBvcnQgeyBDb21tYW5kLCBPcHRpb24gfSBmcm9tICdjbGlwYW5pb24nXG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlQ3JlYXRlTnBtRGlyc0NvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcbiAgc3RhdGljIHBhdGhzID0gW1snY3JlYXRlLW5wbS1kaXJzJ11dXG5cbiAgc3RhdGljIHVzYWdlID0gQ29tbWFuZC5Vc2FnZSh7XG4gICAgZGVzY3JpcHRpb246ICdDcmVhdGUgbnBtIHBhY2thZ2UgZGlycyBmb3IgZGlmZmVyZW50IHBsYXRmb3JtcycsXG4gIH0pXG5cbiAgY3dkID0gT3B0aW9uLlN0cmluZygnLS1jd2QnLCBwcm9jZXNzLmN3ZCgpLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoJyxcbiAgfSlcblxuICBjb25maWdQYXRoPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1jb25maWctcGF0aCwtYycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGUnLFxuICB9KVxuXG4gIHBhY2thZ2VKc29uUGF0aCA9IE9wdGlvbi5TdHJpbmcoJy0tcGFja2FnZS1qc29uLXBhdGgnLCAncGFja2FnZS5qc29uJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgcGFja2FnZS5qc29uYCcsXG4gIH0pXG5cbiAgbnBtRGlyID0gT3B0aW9uLlN0cmluZygnLS1ucG0tZGlyJywgJ25wbScsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gdGhlIGZvbGRlciB3aGVyZSB0aGUgbnBtIHBhY2thZ2VzIHB1dCcsXG4gIH0pXG5cbiAgZHJ5UnVuID0gT3B0aW9uLkJvb2xlYW4oJy0tZHJ5LXJ1bicsIGZhbHNlLCB7XG4gICAgZGVzY3JpcHRpb246ICdEcnkgcnVuIHdpdGhvdXQgdG91Y2hpbmcgZmlsZSBzeXN0ZW0nLFxuICB9KVxuXG4gIGdldE9wdGlvbnMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGN3ZDogdGhpcy5jd2QsXG4gICAgICBjb25maWdQYXRoOiB0aGlzLmNvbmZpZ1BhdGgsXG4gICAgICBwYWNrYWdlSnNvblBhdGg6IHRoaXMucGFja2FnZUpzb25QYXRoLFxuICAgICAgbnBtRGlyOiB0aGlzLm5wbURpcixcbiAgICAgIGRyeVJ1bjogdGhpcy5kcnlSdW4sXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlIG5wbSBwYWNrYWdlIGRpcnMgZm9yIGRpZmZlcmVudCBwbGF0Zm9ybXNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDcmVhdGVOcG1EaXJzT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGhcbiAgICpcbiAgICogQGRlZmF1bHQgcHJvY2Vzcy5jd2QoKVxuICAgKi9cbiAgY3dkPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAqL1xuICBjb25maWdQYXRoPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIGBwYWNrYWdlLmpzb25gXG4gICAqXG4gICAqIEBkZWZhdWx0ICdwYWNrYWdlLmpzb24nXG4gICAqL1xuICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gdGhlIGZvbGRlciB3aGVyZSB0aGUgbnBtIHBhY2thZ2VzIHB1dFxuICAgKlxuICAgKiBAZGVmYXVsdCAnbnBtJ1xuICAgKi9cbiAgbnBtRGlyPzogc3RyaW5nXG4gIC8qKlxuICAgKiBEcnkgcnVuIHdpdGhvdXQgdG91Y2hpbmcgZmlsZSBzeXN0ZW1cbiAgICpcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIGRyeVJ1bj86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5RGVmYXVsdENyZWF0ZU5wbURpcnNPcHRpb25zKFxuICBvcHRpb25zOiBDcmVhdGVOcG1EaXJzT3B0aW9ucyxcbikge1xuICByZXR1cm4ge1xuICAgIGN3ZDogcHJvY2Vzcy5jd2QoKSxcbiAgICBwYWNrYWdlSnNvblBhdGg6ICdwYWNrYWdlLmpzb24nLFxuICAgIG5wbURpcjogJ25wbScsXG4gICAgZHJ5UnVuOiBmYWxzZSxcbiAgICAuLi5vcHRpb25zLFxuICB9XG59XG4iLCJpbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSAnbm9kZTptb2R1bGUnXG5pbXBvcnQgeyBqb2luLCByZXNvbHZlIH0gZnJvbSAnbm9kZTpwYXRoJ1xuXG5pbXBvcnQgeyBDb21wYXJhdG9yLCBSYW5nZSwgbWluVmVyc2lvbiwgc3Vic2V0IH0gZnJvbSAnc2VtdmVyJ1xuXG5jb25zdCByZXF1aXJlID0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpXG5jb25zdCBtaW5pbXVtV2FzaU5vZGVWZXJzaW9uID0gJz49MTQuMC4wJ1xuXG5pbXBvcnQge1xuICBhcHBseURlZmF1bHRDcmVhdGVOcG1EaXJzT3B0aW9ucyxcbiAgdHlwZSBDcmVhdGVOcG1EaXJzT3B0aW9ucyxcbn0gZnJvbSAnLi4vZGVmL2NyZWF0ZS1ucG0tZGlycy5qcydcbmltcG9ydCB7XG4gIGRlYnVnRmFjdG9yeSxcbiAgcmVhZE5hcGlDb25maWcsXG4gIG1rZGlyQXN5bmMgYXMgcmF3TWtkaXJBc3luYyxcbiAgcGljayxcbiAgd3JpdGVGaWxlQXN5bmMgYXMgcmF3V3JpdGVGaWxlQXN5bmMsXG4gIHR5cGUgVGFyZ2V0LFxuICB0eXBlIENvbW1vblBhY2thZ2VKc29uRmllbGRzLFxufSBmcm9tICcuLi91dGlscy9pbmRleC5qcydcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ2NyZWF0ZS1ucG0tZGlycycpXG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFja2FnZU1ldGEge1xuICAnZGlzdC10YWdzJzogeyBbaW5kZXg6IHN0cmluZ106IHN0cmluZyB9XG59XG5cbmNvbnN0IFdBU01fUlVOVElNRV9QQUNLQUdFX05BTUUgPSAnQG5hcGktcnMvd2FzbS1ydW50aW1lJ1xuXG5hc3luYyBmdW5jdGlvbiBnZXRMYXRlc3RXYXNtUnVudGltZVZlcnNpb24oKSB7XG4gIGNvbnN0IG5wbVJlZ2lzdHJ5QmFzZSA9XG4gICAgcHJvY2Vzcy5lbnYubnBtX2NvbmZpZ19yZWdpc3RyeT8ucmVwbGFjZSgvXFwvPyQvLCAnLycpID8/XG4gICAgJ2h0dHBzOi8vcmVnaXN0cnkubnBtanMub3JnLydcbiAgY29uc3QgcGFja2FnZU1ldGFkYXRhVXJsID0gYCR7bnBtUmVnaXN0cnlCYXNlfSR7V0FTTV9SVU5USU1FX1BBQ0tBR0VfTkFNRX1gXG4gIGxldCByZXNwb25zZTogUmVzcG9uc2VcblxuICB0cnkge1xuICAgIHJlc3BvbnNlID0gYXdhaXQgZmV0Y2gocGFja2FnZU1ldGFkYXRhVXJsKVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBGYWlsZWQgdG8gZmV0Y2ggJHtwYWNrYWdlTWV0YWRhdGFVcmx9IHdoaWxlIHJlc29sdmluZyAke1dBU01fUlVOVElNRV9QQUNLQUdFX05BTUV9LiBDaGVjayB5b3VyIG5ldHdvcmsgY29ubmVjdGlvbiBhbmQgbnBtIHJlZ2lzdHJ5IGF2YWlsYWJpbGl0eS5gLFxuICAgICAgeyBjYXVzZTogZXJyb3IgfSxcbiAgICApXG4gIH1cblxuICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEZhaWxlZCB0byBmZXRjaCAke3BhY2thZ2VNZXRhZGF0YVVybH0gd2hpbGUgcmVzb2x2aW5nICR7V0FTTV9SVU5USU1FX1BBQ0tBR0VfTkFNRX06IG5wbSByZWdpc3RyeSByZXNwb25kZWQgd2l0aCAke3Jlc3BvbnNlLnN0YXR1c30gJHtyZXNwb25zZS5zdGF0dXNUZXh0IHx8ICdVbmtub3duIFN0YXR1cyd9YCxcbiAgICApXG4gIH1cblxuICBsZXQgcGFja2FnZU1ldGE6IFBhY2thZ2VNZXRhXG5cbiAgdHJ5IHtcbiAgICBwYWNrYWdlTWV0YSA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIFBhY2thZ2VNZXRhXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEZhaWxlZCB0byBwYXJzZSBucG0gcmVnaXN0cnkgbWV0YWRhdGEgZm9yICR7V0FTTV9SVU5USU1FX1BBQ0tBR0VfTkFNRX0gZnJvbSAke3BhY2thZ2VNZXRhZGF0YVVybH1gLFxuICAgICAgeyBjYXVzZTogZXJyb3IgfSxcbiAgICApXG4gIH1cblxuICBjb25zdCBsYXRlc3RWZXJzaW9uID0gcGFja2FnZU1ldGFbJ2Rpc3QtdGFncyddPy5sYXRlc3RcblxuICBpZiAodHlwZW9mIGxhdGVzdFZlcnNpb24gIT09ICdzdHJpbmcnIHx8IGxhdGVzdFZlcnNpb24udHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBucG0gcmVnaXN0cnkgbWV0YWRhdGEgZm9yICR7V0FTTV9SVU5USU1FX1BBQ0tBR0VfTkFNRX0gZnJvbSAke3BhY2thZ2VNZXRhZGF0YVVybH0gZGlkIG5vdCBpbmNsdWRlIGEgbGF0ZXN0IGRpc3QtdGFnYCxcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGF0ZXN0VmVyc2lvbi50cmltKClcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZU5wbURpcnModXNlck9wdGlvbnM6IENyZWF0ZU5wbURpcnNPcHRpb25zKSB7XG4gIGNvbnN0IG9wdGlvbnMgPSBhcHBseURlZmF1bHRDcmVhdGVOcG1EaXJzT3B0aW9ucyh1c2VyT3B0aW9ucylcblxuICBhc3luYyBmdW5jdGlvbiBta2RpckFzeW5jKGRpcjogc3RyaW5nKSB7XG4gICAgZGVidWcoJ1RyeSB0byBjcmVhdGUgZGlyOiAlaScsIGRpcilcbiAgICBpZiAob3B0aW9ucy5kcnlSdW4pIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGF3YWl0IHJhd01rZGlyQXN5bmMoZGlyLCB7XG4gICAgICByZWN1cnNpdmU6IHRydWUsXG4gICAgfSlcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIHdyaXRlRmlsZUFzeW5jKGZpbGU6IHN0cmluZywgY29udGVudDogc3RyaW5nKSB7XG4gICAgZGVidWcoJ1dyaXRpbmcgZmlsZSAlaScsIGZpbGUpXG5cbiAgICBpZiAob3B0aW9ucy5kcnlSdW4pIHtcbiAgICAgIGRlYnVnKGNvbnRlbnQpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBhd2FpdCByYXdXcml0ZUZpbGVBc3luYyhmaWxlLCBjb250ZW50KVxuICB9XG5cbiAgY29uc3QgcGFja2FnZUpzb25QYXRoID0gcmVzb2x2ZShvcHRpb25zLmN3ZCwgb3B0aW9ucy5wYWNrYWdlSnNvblBhdGgpXG4gIGNvbnN0IG5wbVBhdGggPSByZXNvbHZlKG9wdGlvbnMuY3dkLCBvcHRpb25zLm5wbURpcilcblxuICBkZWJ1ZyhgUmVhZCBjb250ZW50IGZyb20gWyR7b3B0aW9ucy5jb25maWdQYXRoID8/IHBhY2thZ2VKc29uUGF0aH1dYClcblxuICBjb25zdCB7IHRhcmdldHMsIGJpbmFyeU5hbWUsIHBhY2thZ2VOYW1lLCBwYWNrYWdlSnNvbiB9ID1cbiAgICBhd2FpdCByZWFkTmFwaUNvbmZpZyhcbiAgICAgIHBhY2thZ2VKc29uUGF0aCxcbiAgICAgIG9wdGlvbnMuY29uZmlnUGF0aCA/IHJlc29sdmUob3B0aW9ucy5jd2QsIG9wdGlvbnMuY29uZmlnUGF0aCkgOiB1bmRlZmluZWQsXG4gICAgKVxuICBjb25zdCB3YXNtUnVudGltZVZlcnNpb24gPSB0YXJnZXRzLnNvbWUoKHRhcmdldCkgPT4gdGFyZ2V0LmFyY2ggPT09ICd3YXNtMzInKVxuICAgID8gYXdhaXQgZ2V0TGF0ZXN0V2FzbVJ1bnRpbWVWZXJzaW9uKClcbiAgICA6IHVuZGVmaW5lZFxuXG4gIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICBjb25zdCB0YXJnZXREaXIgPSBqb2luKG5wbVBhdGgsIGAke3RhcmdldC5wbGF0Zm9ybUFyY2hBQkl9YClcbiAgICBhd2FpdCBta2RpckFzeW5jKHRhcmdldERpcilcblxuICAgIGNvbnN0IGJpbmFyeUZpbGVOYW1lID1cbiAgICAgIHRhcmdldC5hcmNoID09PSAnd2FzbTMyJ1xuICAgICAgICA/IGAke2JpbmFyeU5hbWV9LiR7dGFyZ2V0LnBsYXRmb3JtQXJjaEFCSX0ud2FzbWBcbiAgICAgICAgOiBgJHtiaW5hcnlOYW1lfS4ke3RhcmdldC5wbGF0Zm9ybUFyY2hBQkl9Lm5vZGVgXG4gICAgY29uc3Qgc2NvcGVkUGFja2FnZUpzb246IENvbW1vblBhY2thZ2VKc29uRmllbGRzID0ge1xuICAgICAgbmFtZTogYCR7cGFja2FnZU5hbWV9LSR7dGFyZ2V0LnBsYXRmb3JtQXJjaEFCSX1gLFxuICAgICAgdmVyc2lvbjogcGFja2FnZUpzb24udmVyc2lvbixcbiAgICAgIGNwdTogdGFyZ2V0LmFyY2ggIT09ICd1bml2ZXJzYWwnID8gW3RhcmdldC5hcmNoXSA6IHVuZGVmaW5lZCxcbiAgICAgIG1haW46IGJpbmFyeUZpbGVOYW1lLFxuICAgICAgZmlsZXM6IFtiaW5hcnlGaWxlTmFtZV0sXG4gICAgICAuLi5waWNrKFxuICAgICAgICBwYWNrYWdlSnNvbixcbiAgICAgICAgJ2Rlc2NyaXB0aW9uJyxcbiAgICAgICAgJ2tleXdvcmRzJyxcbiAgICAgICAgJ2F1dGhvcicsXG4gICAgICAgICdhdXRob3JzJyxcbiAgICAgICAgJ2hvbWVwYWdlJyxcbiAgICAgICAgJ2xpY2Vuc2UnLFxuICAgICAgICAnZW5naW5lcycsXG4gICAgICAgICdyZXBvc2l0b3J5JyxcbiAgICAgICAgJ2J1Z3MnLFxuICAgICAgKSxcbiAgICB9XG4gICAgaWYgKHBhY2thZ2VKc29uLnB1Ymxpc2hDb25maWcpIHtcbiAgICAgIHNjb3BlZFBhY2thZ2VKc29uLnB1Ymxpc2hDb25maWcgPSBwaWNrKFxuICAgICAgICBwYWNrYWdlSnNvbi5wdWJsaXNoQ29uZmlnLFxuICAgICAgICAncmVnaXN0cnknLFxuICAgICAgICAnYWNjZXNzJyxcbiAgICAgIClcbiAgICB9XG4gICAgaWYgKHRhcmdldC5hcmNoICE9PSAnd2FzbTMyJykge1xuICAgICAgc2NvcGVkUGFja2FnZUpzb24ub3MgPSBbdGFyZ2V0LnBsYXRmb3JtXVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBlbnRyeSA9IGAke2JpbmFyeU5hbWV9Lndhc2kuY2pzYFxuICAgICAgc2NvcGVkUGFja2FnZUpzb24ubWFpbiA9IGVudHJ5XG4gICAgICBzY29wZWRQYWNrYWdlSnNvbi5icm93c2VyID0gYCR7YmluYXJ5TmFtZX0ud2FzaS1icm93c2VyLmpzYFxuICAgICAgc2NvcGVkUGFja2FnZUpzb24uZmlsZXM/LnB1c2goXG4gICAgICAgIGVudHJ5LFxuICAgICAgICBzY29wZWRQYWNrYWdlSnNvbi5icm93c2VyLFxuICAgICAgICBgd2FzaS13b3JrZXIubWpzYCxcbiAgICAgICAgYHdhc2ktd29ya2VyLWJyb3dzZXIubWpzYCxcbiAgICAgIClcbiAgICAgIHNjb3BlZFBhY2thZ2VKc29uLmVuZ2luZXMgPSB7XG4gICAgICAgIC4uLnNjb3BlZFBhY2thZ2VKc29uLmVuZ2luZXMsXG4gICAgICAgIG5vZGU6IHNjb3BlZFBhY2thZ2VKc29uLmVuZ2luZXM/Lm5vZGVcbiAgICAgICAgICA/IHJlc3RyaWN0V2FzaU5vZGVFbmdpbmUoc2NvcGVkUGFja2FnZUpzb24uZW5naW5lcy5ub2RlKVxuICAgICAgICAgIDogbWluaW11bVdhc2lOb2RlVmVyc2lvbixcbiAgICAgIH1cbiAgICAgIGNvbnN0IGVtbmFwaVZlcnNpb24gPSByZXF1aXJlKCdlbW5hcGkvcGFja2FnZS5qc29uJykudmVyc2lvblxuICAgICAgc2NvcGVkUGFja2FnZUpzb24uZGVwZW5kZW5jaWVzID0ge1xuICAgICAgICAnQG5hcGktcnMvd2FzbS1ydW50aW1lJzogYF4ke3dhc21SdW50aW1lVmVyc2lvbn1gLFxuICAgICAgICAnQGVtbmFwaS9jb3JlJzogZW1uYXBpVmVyc2lvbixcbiAgICAgICAgJ0BlbW5hcGkvcnVudGltZSc6IGVtbmFwaVZlcnNpb24sXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRhcmdldC5hYmkgPT09ICdnbnUnKSB7XG4gICAgICBzY29wZWRQYWNrYWdlSnNvbi5saWJjID0gWydnbGliYyddXG4gICAgfSBlbHNlIGlmICh0YXJnZXQuYWJpID09PSAnbXVzbCcpIHtcbiAgICAgIHNjb3BlZFBhY2thZ2VKc29uLmxpYmMgPSBbJ211c2wnXVxuICAgIH1cblxuICAgIGNvbnN0IHRhcmdldFBhY2thZ2VKc29uID0gam9pbih0YXJnZXREaXIsICdwYWNrYWdlLmpzb24nKVxuICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKFxuICAgICAgdGFyZ2V0UGFja2FnZUpzb24sXG4gICAgICBKU09OLnN0cmluZ2lmeShzY29wZWRQYWNrYWdlSnNvbiwgbnVsbCwgMikgKyAnXFxuJyxcbiAgICApXG4gICAgY29uc3QgdGFyZ2V0UmVhZG1lID0gam9pbih0YXJnZXREaXIsICdSRUFETUUubWQnKVxuICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKHRhcmdldFJlYWRtZSwgcmVhZG1lKHBhY2thZ2VOYW1lLCB0YXJnZXQpKVxuXG4gICAgZGVidWcuaW5mbyhgJHtwYWNrYWdlTmFtZX0gLSR7dGFyZ2V0LnBsYXRmb3JtQXJjaEFCSX0gY3JlYXRlZGApXG4gIH1cbn1cblxuZnVuY3Rpb24gcmVhZG1lKHBhY2thZ2VOYW1lOiBzdHJpbmcsIHRhcmdldDogVGFyZ2V0KSB7XG4gIHJldHVybiBgIyBcXGAke3BhY2thZ2VOYW1lfS0ke3RhcmdldC5wbGF0Zm9ybUFyY2hBQkl9XFxgXG5cblRoaXMgaXMgdGhlICoqJHt0YXJnZXQudHJpcGxlfSoqIGJpbmFyeSBmb3IgXFxgJHtwYWNrYWdlTmFtZX1cXGBcbmBcbn1cblxuZnVuY3Rpb24gcmVzdHJpY3RXYXNpTm9kZUVuZ2luZShub2RlUmFuZ2U6IHN0cmluZykge1xuICB0cnkge1xuICAgIGlmIChzdWJzZXQobm9kZVJhbmdlLCBtaW5pbXVtV2FzaU5vZGVWZXJzaW9uKSkge1xuICAgICAgcmV0dXJuIG5vZGVSYW5nZVxuICAgIH1cblxuICAgIGlmIChzdWJzZXQobWluaW11bVdhc2lOb2RlVmVyc2lvbiwgbm9kZVJhbmdlKSkge1xuICAgICAgcmV0dXJuIG1pbmltdW1XYXNpTm9kZVZlcnNpb25cbiAgICB9XG5cbiAgICBjb25zdCBtaW5pbXVtQ29tcGFyYXRvciA9IG5ldyBDb21wYXJhdG9yKG1pbmltdW1XYXNpTm9kZVZlcnNpb24pXG4gICAgY29uc3QgcmVzdHJpY3RlZFJhbmdlU2V0cyA9IG5ldyBSYW5nZShub2RlUmFuZ2UpLnNldFxuICAgICAgLm1hcCgoY29tcGFyYXRvcnMpID0+XG4gICAgICAgIG5vcm1hbGl6ZUNvbXBhcmF0b3JTZXQoWy4uLmNvbXBhcmF0b3JzLCBtaW5pbXVtQ29tcGFyYXRvcl0pLFxuICAgICAgKVxuICAgICAgLmZpbHRlcihcbiAgICAgICAgKGNhbmRpZGF0ZSk6IGNhbmRpZGF0ZSBpcyBzdHJpbmcgPT5cbiAgICAgICAgICBjYW5kaWRhdGUgIT09IHVuZGVmaW5lZCAmJiBtaW5WZXJzaW9uKGNhbmRpZGF0ZSkgIT09IG51bGwsXG4gICAgICApXG5cbiAgICBpZiAocmVzdHJpY3RlZFJhbmdlU2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gcmVzdHJpY3RlZFJhbmdlU2V0cy5qb2luKCcgfHwgJylcbiAgICB9XG4gIH0gY2F0Y2gge1xuICAgIC8vIGlnbm9yZVxuICB9XG5cbiAgcmV0dXJuIG1pbmltdW1XYXNpTm9kZVZlcnNpb25cbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ29tcGFyYXRvclNldChjb21wYXJhdG9yczogQ29tcGFyYXRvcltdKSB7XG4gIGNvbnN0IGV4YWN0TWF0Y2ggPSBjb21wYXJhdG9ycy5maW5kKCh7IG9wZXJhdG9yIH0pID0+IG9wZXJhdG9yID09PSAnJylcbiAgaWYgKGV4YWN0TWF0Y2gpIHtcbiAgICByZXR1cm4gY29tcGFyYXRvcnMuZXZlcnkoKGNvbXBhcmF0b3IpID0+IGNvbXBhcmF0b3IudGVzdChleGFjdE1hdGNoLnNlbXZlcikpXG4gICAgICA/IGV4YWN0TWF0Y2gudmFsdWVcbiAgICAgIDogdW5kZWZpbmVkXG4gIH1cblxuICBsZXQgbG93ZXJCb3VuZDogQ29tcGFyYXRvciB8IHVuZGVmaW5lZFxuICBsZXQgdXBwZXJCb3VuZDogQ29tcGFyYXRvciB8IHVuZGVmaW5lZFxuXG4gIGZvciAoY29uc3QgY29tcGFyYXRvciBvZiBjb21wYXJhdG9ycykge1xuICAgIGlmIChjb21wYXJhdG9yLm9wZXJhdG9yID09PSAnPicgfHwgY29tcGFyYXRvci5vcGVyYXRvciA9PT0gJz49Jykge1xuICAgICAgaWYgKFxuICAgICAgICAhbG93ZXJCb3VuZCB8fFxuICAgICAgICBjb21wYXJhdG9yLnNlbXZlci5jb21wYXJlKGxvd2VyQm91bmQuc2VtdmVyKSA+IDAgfHxcbiAgICAgICAgKGNvbXBhcmF0b3Iuc2VtdmVyLmNvbXBhcmUobG93ZXJCb3VuZC5zZW12ZXIpID09PSAwICYmXG4gICAgICAgICAgY29tcGFyYXRvci5vcGVyYXRvciA9PT0gJz4nKVxuICAgICAgKSB7XG4gICAgICAgIGxvd2VyQm91bmQgPSBjb21wYXJhdG9yXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjb21wYXJhdG9yLm9wZXJhdG9yID09PSAnPCcgfHwgY29tcGFyYXRvci5vcGVyYXRvciA9PT0gJzw9Jykge1xuICAgICAgaWYgKFxuICAgICAgICAhdXBwZXJCb3VuZCB8fFxuICAgICAgICBjb21wYXJhdG9yLnNlbXZlci5jb21wYXJlKHVwcGVyQm91bmQuc2VtdmVyKSA8IDAgfHxcbiAgICAgICAgKGNvbXBhcmF0b3Iuc2VtdmVyLmNvbXBhcmUodXBwZXJCb3VuZC5zZW12ZXIpID09PSAwICYmXG4gICAgICAgICAgY29tcGFyYXRvci5vcGVyYXRvciA9PT0gJzwnKVxuICAgICAgKSB7XG4gICAgICAgIHVwcGVyQm91bmQgPSBjb21wYXJhdG9yXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIFtsb3dlckJvdW5kPy52YWx1ZSwgdXBwZXJCb3VuZD8udmFsdWVdLmZpbHRlcihCb29sZWFuKS5qb2luKCcgJylcbn1cbiIsIi8vIENvcHlyaWdodCAyMDE4LTIwMjUgdGhlIERlbm8gYXV0aG9ycy4gTUlUIGxpY2Vuc2UuXG4vLyBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG4vLyBCYXJlIGtleXMgbWF5IG9ubHkgY29udGFpbiBBU0NJSSBsZXR0ZXJzLFxuLy8gQVNDSUkgZGlnaXRzLCB1bmRlcnNjb3JlcywgYW5kIGRhc2hlcyAoQS1aYS16MC05Xy0pLlxuZnVuY3Rpb24gam9pbktleXMoa2V5cykge1xuICAvLyBEb3R0ZWQga2V5cyBhcmUgYSBzZXF1ZW5jZSBvZiBiYXJlIG9yIHF1b3RlZCBrZXlzIGpvaW5lZCB3aXRoIGEgZG90LlxuICAvLyBUaGlzIGFsbG93cyBmb3IgZ3JvdXBpbmcgc2ltaWxhciBwcm9wZXJ0aWVzIHRvZ2V0aGVyOlxuICByZXR1cm4ga2V5cy5tYXAoKHN0cik9PntcbiAgICByZXR1cm4gc3RyLmxlbmd0aCA9PT0gMCB8fCBzdHIubWF0Y2goL1teQS1aYS16MC05Xy1dLykgPyBKU09OLnN0cmluZ2lmeShzdHIpIDogc3RyO1xuICB9KS5qb2luKFwiLlwiKTtcbn1cbmNsYXNzIER1bXBlciB7XG4gIG1heFBhZCA9IDA7XG4gIHNyY09iamVjdDtcbiAgb3V0cHV0ID0gW107XG4gICNhcnJheVR5cGVDYWNoZSA9IG5ldyBNYXAoKTtcbiAgY29uc3RydWN0b3Ioc3JjT2JqYyl7XG4gICAgdGhpcy5zcmNPYmplY3QgPSBzcmNPYmpjO1xuICB9XG4gIGR1bXAoZm10T3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICB0aGlzLm91dHB1dCA9IHRoaXMuI3ByaW50T2JqZWN0KHRoaXMuc3JjT2JqZWN0KTtcbiAgICB0aGlzLm91dHB1dCA9IHRoaXMuI2Zvcm1hdChmbXRPcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5vdXRwdXQ7XG4gIH1cbiAgI3ByaW50T2JqZWN0KG9iaiwga2V5cyA9IFtdKSB7XG4gICAgY29uc3Qgb3V0ID0gW107XG4gICAgY29uc3QgcHJvcHMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgIGNvbnN0IGlubGluZVByb3BzID0gW107XG4gICAgY29uc3QgbXVsdGlsaW5lUHJvcHMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHByb3Agb2YgcHJvcHMpe1xuICAgICAgaWYgKHRoaXMuI2lzU2ltcGx5U2VyaWFsaXphYmxlKG9ialtwcm9wXSkpIHtcbiAgICAgICAgaW5saW5lUHJvcHMucHVzaChwcm9wKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG11bHRpbGluZVByb3BzLnB1c2gocHJvcCk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHNvcnRlZFByb3BzID0gaW5saW5lUHJvcHMuY29uY2F0KG11bHRpbGluZVByb3BzKTtcbiAgICBmb3IgKGNvbnN0IHByb3Agb2Ygc29ydGVkUHJvcHMpe1xuICAgICAgY29uc3QgdmFsdWUgPSBvYmpbcHJvcF07XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgIG91dC5wdXNoKHRoaXMuI2RhdGVEZWNsYXJhdGlvbihbXG4gICAgICAgICAgcHJvcFxuICAgICAgICBdLCB2YWx1ZSkpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIgfHwgdmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgb3V0LnB1c2godGhpcy4jc3RyRGVjbGFyYXRpb24oW1xuICAgICAgICAgIHByb3BcbiAgICAgICAgXSwgdmFsdWUudG9TdHJpbmcoKSkpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgb3V0LnB1c2godGhpcy4jbnVtYmVyRGVjbGFyYXRpb24oW1xuICAgICAgICAgIHByb3BcbiAgICAgICAgXSwgdmFsdWUpKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcImJvb2xlYW5cIikge1xuICAgICAgICBvdXQucHVzaCh0aGlzLiNib29sRGVjbGFyYXRpb24oW1xuICAgICAgICAgIHByb3BcbiAgICAgICAgXSwgdmFsdWUpKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBjb25zdCBhcnJheVR5cGUgPSB0aGlzLiNnZXRUeXBlT2ZBcnJheSh2YWx1ZSk7XG4gICAgICAgIGlmIChhcnJheVR5cGUgPT09IFwiT05MWV9QUklNSVRJVkVcIikge1xuICAgICAgICAgIG91dC5wdXNoKHRoaXMuI2FycmF5RGVjbGFyYXRpb24oW1xuICAgICAgICAgICAgcHJvcFxuICAgICAgICAgIF0sIHZhbHVlKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoYXJyYXlUeXBlID09PSBcIk9OTFlfT0JKRUNUX0VYQ0xVRElOR19BUlJBWVwiKSB7XG4gICAgICAgICAgLy8gYXJyYXkgb2Ygb2JqZWN0c1xuICAgICAgICAgIGZvcihsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBvdXQucHVzaChcIlwiKTtcbiAgICAgICAgICAgIG91dC5wdXNoKHRoaXMuI2hlYWRlckdyb3VwKFtcbiAgICAgICAgICAgICAgLi4ua2V5cyxcbiAgICAgICAgICAgICAgcHJvcFxuICAgICAgICAgICAgXSkpO1xuICAgICAgICAgICAgb3V0LnB1c2goLi4udGhpcy4jcHJpbnRPYmplY3QodmFsdWVbaV0sIFtcbiAgICAgICAgICAgICAgLi4ua2V5cyxcbiAgICAgICAgICAgICAgcHJvcFxuICAgICAgICAgICAgXSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyB0aGlzIGlzIGEgY29tcGxleCBhcnJheSwgdXNlIHRoZSBpbmxpbmUgZm9ybWF0LlxuICAgICAgICAgIGNvbnN0IHN0ciA9IHZhbHVlLm1hcCgoeCk9PnRoaXMuI3ByaW50QXNJbmxpbmVWYWx1ZSh4KSkuam9pbihcIixcIik7XG4gICAgICAgICAgb3V0LnB1c2goYCR7dGhpcy4jZGVjbGFyYXRpb24oW1xuICAgICAgICAgICAgcHJvcFxuICAgICAgICAgIF0pfVske3N0cn1dYCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIG91dC5wdXNoKFwiXCIpO1xuICAgICAgICBvdXQucHVzaCh0aGlzLiNoZWFkZXIoW1xuICAgICAgICAgIC4uLmtleXMsXG4gICAgICAgICAgcHJvcFxuICAgICAgICBdKSk7XG4gICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgIGNvbnN0IHRvUGFyc2UgPSB2YWx1ZTtcbiAgICAgICAgICBvdXQucHVzaCguLi50aGlzLiNwcmludE9iamVjdCh0b1BhcnNlLCBbXG4gICAgICAgICAgICAuLi5rZXlzLFxuICAgICAgICAgICAgcHJvcFxuICAgICAgICAgIF0pKTtcbiAgICAgICAgfVxuICAgICAgLy8gb3V0LnB1c2goLi4udGhpcy5fcGFyc2UodmFsdWUsIGAke3BhdGh9JHtwcm9wfS5gKSk7XG4gICAgICB9XG4gICAgfVxuICAgIG91dC5wdXNoKFwiXCIpO1xuICAgIHJldHVybiBvdXQ7XG4gIH1cbiAgI2lzUHJpbWl0aXZlKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgRGF0ZSB8fCB2YWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCB8fCBbXG4gICAgICBcInN0cmluZ1wiLFxuICAgICAgXCJudW1iZXJcIixcbiAgICAgIFwiYm9vbGVhblwiXG4gICAgXS5pbmNsdWRlcyh0eXBlb2YgdmFsdWUpO1xuICB9XG4gICNnZXRUeXBlT2ZBcnJheShhcnIpIHtcbiAgICBpZiAodGhpcy4jYXJyYXlUeXBlQ2FjaGUuaGFzKGFycikpIHtcbiAgICAgIHJldHVybiB0aGlzLiNhcnJheVR5cGVDYWNoZS5nZXQoYXJyKTtcbiAgICB9XG4gICAgY29uc3QgdHlwZSA9IHRoaXMuI2RvR2V0VHlwZU9mQXJyYXkoYXJyKTtcbiAgICB0aGlzLiNhcnJheVR5cGVDYWNoZS5zZXQoYXJyLCB0eXBlKTtcbiAgICByZXR1cm4gdHlwZTtcbiAgfVxuICAjZG9HZXRUeXBlT2ZBcnJheShhcnIpIHtcbiAgICBpZiAoIWFyci5sZW5ndGgpIHtcbiAgICAgIC8vIGFueSB0eXBlIHNob3VsZCBiZSBmaW5lXG4gICAgICByZXR1cm4gXCJPTkxZX1BSSU1JVElWRVwiO1xuICAgIH1cbiAgICBjb25zdCBvbmx5UHJpbWl0aXZlID0gdGhpcy4jaXNQcmltaXRpdmUoYXJyWzBdKTtcbiAgICBpZiAoYXJyWzBdIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIHJldHVybiBcIk1JWEVEXCI7XG4gICAgfVxuICAgIGZvcihsZXQgaSA9IDE7IGkgPCBhcnIubGVuZ3RoOyBpKyspe1xuICAgICAgaWYgKG9ubHlQcmltaXRpdmUgIT09IHRoaXMuI2lzUHJpbWl0aXZlKGFycltpXSkgfHwgYXJyW2ldIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgcmV0dXJuIFwiTUlYRURcIjtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9ubHlQcmltaXRpdmUgPyBcIk9OTFlfUFJJTUlUSVZFXCIgOiBcIk9OTFlfT0JKRUNUX0VYQ0xVRElOR19BUlJBWVwiO1xuICB9XG4gICNwcmludEFzSW5saW5lVmFsdWUodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICByZXR1cm4gYFwiJHt0aGlzLiNwcmludERhdGUodmFsdWUpfVwiYDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIiB8fCB2YWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHZhbHVlLnRvU3RyaW5nKCkpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICByZXR1cm4gdmFsdWUudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIGNvbnN0IHN0ciA9IHZhbHVlLm1hcCgoeCk9PnRoaXMuI3ByaW50QXNJbmxpbmVWYWx1ZSh4KSkuam9pbihcIixcIik7XG4gICAgICByZXR1cm4gYFske3N0cn1dYDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTaG91bGQgbmV2ZXIgcmVhY2hcIik7XG4gICAgICB9XG4gICAgICBjb25zdCBzdHIgPSBPYmplY3Qua2V5cyh2YWx1ZSkubWFwKChrZXkpPT57XG4gICAgICAgIHJldHVybiBgJHtqb2luS2V5cyhbXG4gICAgICAgICAga2V5XG4gICAgICAgIF0pfSA9ICR7Ly8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgICAgdGhpcy4jcHJpbnRBc0lubGluZVZhbHVlKHZhbHVlW2tleV0pfWA7XG4gICAgICB9KS5qb2luKFwiLFwiKTtcbiAgICAgIHJldHVybiBgeyR7c3RyfX1gO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJTaG91bGQgbmV2ZXIgcmVhY2hcIik7XG4gIH1cbiAgI2lzU2ltcGx5U2VyaWFsaXphYmxlKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIiB8fCB0eXBlb2YgdmFsdWUgPT09IFwibnVtYmVyXCIgfHwgdHlwZW9mIHZhbHVlID09PSBcImJvb2xlYW5cIiB8fCB2YWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCB8fCB2YWx1ZSBpbnN0YW5jZW9mIERhdGUgfHwgdmFsdWUgaW5zdGFuY2VvZiBBcnJheSAmJiB0aGlzLiNnZXRUeXBlT2ZBcnJheSh2YWx1ZSkgIT09IFwiT05MWV9PQkpFQ1RfRVhDTFVESU5HX0FSUkFZXCI7XG4gIH1cbiAgI2hlYWRlcihrZXlzKSB7XG4gICAgcmV0dXJuIGBbJHtqb2luS2V5cyhrZXlzKX1dYDtcbiAgfVxuICAjaGVhZGVyR3JvdXAoa2V5cykge1xuICAgIHJldHVybiBgW1ske2pvaW5LZXlzKGtleXMpfV1dYDtcbiAgfVxuICAjZGVjbGFyYXRpb24oa2V5cykge1xuICAgIGNvbnN0IHRpdGxlID0gam9pbktleXMoa2V5cyk7XG4gICAgaWYgKHRpdGxlLmxlbmd0aCA+IHRoaXMubWF4UGFkKSB7XG4gICAgICB0aGlzLm1heFBhZCA9IHRpdGxlLmxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIGAke3RpdGxlfSA9IGA7XG4gIH1cbiAgI2FycmF5RGVjbGFyYXRpb24oa2V5cywgdmFsdWUpIHtcbiAgICByZXR1cm4gYCR7dGhpcy4jZGVjbGFyYXRpb24oa2V5cyl9JHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YDtcbiAgfVxuICAjc3RyRGVjbGFyYXRpb24oa2V5cywgdmFsdWUpIHtcbiAgICByZXR1cm4gYCR7dGhpcy4jZGVjbGFyYXRpb24oa2V5cyl9JHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YDtcbiAgfVxuICAjbnVtYmVyRGVjbGFyYXRpb24oa2V5cywgdmFsdWUpIHtcbiAgICBpZiAoTnVtYmVyLmlzTmFOKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGAke3RoaXMuI2RlY2xhcmF0aW9uKGtleXMpfW5hbmA7XG4gICAgfVxuICAgIHN3aXRjaCh2YWx1ZSl7XG4gICAgICBjYXNlIEluZmluaXR5OlxuICAgICAgICByZXR1cm4gYCR7dGhpcy4jZGVjbGFyYXRpb24oa2V5cyl9aW5mYDtcbiAgICAgIGNhc2UgLUluZmluaXR5OlxuICAgICAgICByZXR1cm4gYCR7dGhpcy4jZGVjbGFyYXRpb24oa2V5cyl9LWluZmA7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gYCR7dGhpcy4jZGVjbGFyYXRpb24oa2V5cyl9JHt2YWx1ZX1gO1xuICAgIH1cbiAgfVxuICAjYm9vbERlY2xhcmF0aW9uKGtleXMsIHZhbHVlKSB7XG4gICAgcmV0dXJuIGAke3RoaXMuI2RlY2xhcmF0aW9uKGtleXMpfSR7dmFsdWV9YDtcbiAgfVxuICAjcHJpbnREYXRlKHZhbHVlKSB7XG4gICAgZnVuY3Rpb24gZHRQYWQodiwgbFBhZCA9IDIpIHtcbiAgICAgIHJldHVybiB2LnBhZFN0YXJ0KGxQYWQsIFwiMFwiKTtcbiAgICB9XG4gICAgY29uc3QgbSA9IGR0UGFkKCh2YWx1ZS5nZXRVVENNb250aCgpICsgMSkudG9TdHJpbmcoKSk7XG4gICAgY29uc3QgZCA9IGR0UGFkKHZhbHVlLmdldFVUQ0RhdGUoKS50b1N0cmluZygpKTtcbiAgICBjb25zdCBoID0gZHRQYWQodmFsdWUuZ2V0VVRDSG91cnMoKS50b1N0cmluZygpKTtcbiAgICBjb25zdCBtaW4gPSBkdFBhZCh2YWx1ZS5nZXRVVENNaW51dGVzKCkudG9TdHJpbmcoKSk7XG4gICAgY29uc3QgcyA9IGR0UGFkKHZhbHVlLmdldFVUQ1NlY29uZHMoKS50b1N0cmluZygpKTtcbiAgICBjb25zdCBtcyA9IGR0UGFkKHZhbHVlLmdldFVUQ01pbGxpc2Vjb25kcygpLnRvU3RyaW5nKCksIDMpO1xuICAgIC8vIGZvcm1hdHRlZCBkYXRlXG4gICAgY29uc3QgZkRhdGEgPSBgJHt2YWx1ZS5nZXRVVENGdWxsWWVhcigpfS0ke219LSR7ZH1UJHtofToke21pbn06JHtzfS4ke21zfWA7XG4gICAgcmV0dXJuIGZEYXRhO1xuICB9XG4gICNkYXRlRGVjbGFyYXRpb24oa2V5cywgdmFsdWUpIHtcbiAgICByZXR1cm4gYCR7dGhpcy4jZGVjbGFyYXRpb24oa2V5cyl9JHt0aGlzLiNwcmludERhdGUodmFsdWUpfWA7XG4gIH1cbiAgI2Zvcm1hdChvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7IGtleUFsaWdubWVudCA9IGZhbHNlIH0gPSBvcHRpb25zO1xuICAgIGNvbnN0IHJEZWNsYXJhdGlvbiA9IC9eKFxcXCIuKlxcXCJ8W149XSopXFxzPS87XG4gICAgY29uc3Qgb3V0ID0gW107XG4gICAgZm9yKGxldCBpID0gMDsgaSA8IHRoaXMub3V0cHV0Lmxlbmd0aDsgaSsrKXtcbiAgICAgIGNvbnN0IGwgPSB0aGlzLm91dHB1dFtpXTtcbiAgICAgIC8vIHdlIGtlZXAgZW1wdHkgZW50cnkgZm9yIGFycmF5IG9mIG9iamVjdHNcbiAgICAgIGlmIChsWzBdID09PSBcIltcIiAmJiBsWzFdICE9PSBcIltcIikge1xuICAgICAgICAvLyBub24tZW1wdHkgb2JqZWN0IHdpdGggb25seSBzdWJvYmplY3RzIGFzIHByb3BlcnRpZXNcbiAgICAgICAgaWYgKHRoaXMub3V0cHV0W2kgKyAxXSA9PT0gXCJcIiAmJiB0aGlzLm91dHB1dFtpICsgMl0/LnNsaWNlKDAsIGwubGVuZ3RoKSA9PT0gbC5zbGljZSgwLCAtMSkgKyBcIi5cIikge1xuICAgICAgICAgIGkgKz0gMTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBvdXQucHVzaChsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChrZXlBbGlnbm1lbnQpIHtcbiAgICAgICAgICBjb25zdCBtID0gckRlY2xhcmF0aW9uLmV4ZWMobCk7XG4gICAgICAgICAgaWYgKG0gJiYgbVsxXSkge1xuICAgICAgICAgICAgb3V0LnB1c2gobC5yZXBsYWNlKG1bMV0sIG1bMV0ucGFkRW5kKHRoaXMubWF4UGFkKSkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvdXQucHVzaChsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3V0LnB1c2gobCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQ2xlYW5pbmcgbXVsdGlwbGUgc3BhY2VzXG4gICAgY29uc3QgY2xlYW5lZE91dHB1dCA9IFtdO1xuICAgIGZvcihsZXQgaSA9IDA7IGkgPCBvdXQubGVuZ3RoOyBpKyspe1xuICAgICAgY29uc3QgbCA9IG91dFtpXTtcbiAgICAgIGlmICghKGwgPT09IFwiXCIgJiYgb3V0W2kgKyAxXSA9PT0gXCJcIikpIHtcbiAgICAgICAgY2xlYW5lZE91dHB1dC5wdXNoKGwpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY2xlYW5lZE91dHB1dDtcbiAgfVxufVxuLyoqXG4gKiBDb252ZXJ0cyBhbiBvYmplY3QgdG8gYSB7QGxpbmsgaHR0cHM6Ly90b21sLmlvIHwgVE9NTH0gc3RyaW5nLlxuICpcbiAqIEBleGFtcGxlIFVzYWdlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgc3RyaW5naWZ5IH0gZnJvbSBcIkBzdGQvdG9tbC9zdHJpbmdpZnlcIjtcbiAqIGltcG9ydCB7IGFzc2VydEVxdWFscyB9IGZyb20gXCJAc3RkL2Fzc2VydFwiO1xuICpcbiAqIGNvbnN0IG9iaiA9IHtcbiAqICAgdGl0bGU6IFwiVE9NTCBFeGFtcGxlXCIsXG4gKiAgIG93bmVyOiB7XG4gKiAgICAgbmFtZTogXCJCb2JcIixcbiAqICAgICBiaW86IFwiQm9iIGlzIGEgY29vbCBndXlcIixcbiAqICB9XG4gKiB9O1xuICogY29uc3QgdG9tbFN0cmluZyA9IHN0cmluZ2lmeShvYmopO1xuICogYXNzZXJ0RXF1YWxzKHRvbWxTdHJpbmcsIGB0aXRsZSA9IFwiVE9NTCBFeGFtcGxlXCJcXG5cXG5bb3duZXJdXFxubmFtZSA9IFwiQm9iXCJcXG5iaW8gPSBcIkJvYiBpcyBhIGNvb2wgZ3V5XCJcXG5gKTtcbiAqIGBgYFxuICogQHBhcmFtIG9iaiBTb3VyY2Ugb2JqZWN0XG4gKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIGZvciBzdHJpbmdpZnlpbmcuXG4gKiBAcmV0dXJucyBUT01MIHN0cmluZ1xuICovIGV4cG9ydCBmdW5jdGlvbiBzdHJpbmdpZnkob2JqLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgRHVtcGVyKG9iaikuZHVtcChvcHRpb25zKS5qb2luKFwiXFxuXCIpO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c3RyaW5naWZ5LmpzLm1hcCIsIi8vIENvcHlyaWdodCAyMDE4LTIwMjYgdGhlIERlbm8gYXV0aG9ycy4gTUlUIGxpY2Vuc2UuXG4vLyBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG4vKiogRGVmYXVsdCBtZXJnaW5nIG9wdGlvbnMgLSBjYWNoZWQgdG8gYXZvaWQgb2JqZWN0IGFsbG9jYXRpb24gb24gZWFjaCBjYWxsICovIGNvbnN0IERFRkFVTFRfT1BUSU9OUyA9IHtcbiAgYXJyYXlzOiBcIm1lcmdlXCIsXG4gIHNldHM6IFwibWVyZ2VcIixcbiAgbWFwczogXCJtZXJnZVwiXG59O1xuZXhwb3J0IGZ1bmN0aW9uIGRlZXBNZXJnZShyZWNvcmQsIG90aGVyLCBvcHRpb25zKSB7XG4gIHJldHVybiBkZWVwTWVyZ2VJbnRlcm5hbChyZWNvcmQsIG90aGVyLCBuZXcgU2V0KCksIG9wdGlvbnMgPz8gREVGQVVMVF9PUFRJT05TKTtcbn1cbmZ1bmN0aW9uIGRlZXBNZXJnZUludGVybmFsKHJlY29yZCwgb3RoZXIsIHNlZW4sIG9wdGlvbnMpIHtcbiAgY29uc3QgcmVzdWx0ID0ge307XG4gIGNvbnN0IGtleXMgPSBuZXcgU2V0KFtcbiAgICAuLi5nZXRLZXlzKHJlY29yZCksXG4gICAgLi4uZ2V0S2V5cyhvdGhlcilcbiAgXSk7XG4gIC8vIEl0ZXJhdGUgdGhyb3VnaCBlYWNoIGtleSBvZiBvdGhlciBvYmplY3QgYW5kIHVzZSBjb3JyZWN0IG1lcmdpbmcgc3RyYXRlZ3lcbiAgZm9yIChjb25zdCBrZXkgb2Yga2V5cyl7XG4gICAgLy8gU2tpcCB0byBwcmV2ZW50IE9iamVjdC5wcm90b3R5cGUuX19wcm90b19fIGFjY2Vzc29yIHByb3BlcnR5IGNhbGxzIG9uIG5vbi1EZW5vIHBsYXRmb3Jtc1xuICAgIGlmIChrZXkgPT09IFwiX19wcm90b19fXCIpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCBhID0gcmVjb3JkW2tleV07XG4gICAgaWYgKCFPYmplY3QuaGFzT3duKG90aGVyLCBrZXkpKSB7XG4gICAgICByZXN1bHRba2V5XSA9IGE7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgYiA9IG90aGVyW2tleV07XG4gICAgaWYgKGlzTm9uTnVsbE9iamVjdChhKSAmJiBpc05vbk51bGxPYmplY3QoYikgJiYgIXNlZW4uaGFzKGEpICYmICFzZWVuLmhhcyhiKSkge1xuICAgICAgc2Vlbi5hZGQoYSk7XG4gICAgICBzZWVuLmFkZChiKTtcbiAgICAgIHJlc3VsdFtrZXldID0gbWVyZ2VPYmplY3RzKGEsIGIsIHNlZW4sIG9wdGlvbnMpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIC8vIE92ZXJyaWRlIHZhbHVlXG4gICAgcmVzdWx0W2tleV0gPSBiO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5mdW5jdGlvbiBtZXJnZU9iamVjdHMobGVmdCwgcmlnaHQsIHNlZW4sIG9wdGlvbnMpIHtcbiAgLy8gUmVjdXJzaXZlbHkgbWVyZ2UgbWVyZ2VhYmxlIG9iamVjdHNcbiAgaWYgKGlzTWVyZ2VhYmxlKGxlZnQpICYmIGlzTWVyZ2VhYmxlKHJpZ2h0KSkge1xuICAgIHJldHVybiBkZWVwTWVyZ2VJbnRlcm5hbChsZWZ0LCByaWdodCwgc2Vlbiwgb3B0aW9ucyk7XG4gIH1cbiAgaWYgKGlzSXRlcmFibGUobGVmdCkgJiYgaXNJdGVyYWJsZShyaWdodCkpIHtcbiAgICAvLyBIYW5kbGUgYXJyYXlzXG4gICAgaWYgKEFycmF5LmlzQXJyYXkobGVmdCkgJiYgQXJyYXkuaXNBcnJheShyaWdodCkpIHtcbiAgICAgIGlmIChvcHRpb25zLmFycmF5cyA9PT0gXCJtZXJnZVwiKSB7XG4gICAgICAgIHJldHVybiBsZWZ0LmNvbmNhdChyaWdodCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmlnaHQ7XG4gICAgfVxuICAgIC8vIEhhbmRsZSBtYXBzXG4gICAgaWYgKGxlZnQgaW5zdGFuY2VvZiBNYXAgJiYgcmlnaHQgaW5zdGFuY2VvZiBNYXApIHtcbiAgICAgIGlmIChvcHRpb25zLm1hcHMgPT09IFwibWVyZ2VcIikge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBuZXcgTWFwKGxlZnQpO1xuICAgICAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiByaWdodCl7XG4gICAgICAgICAgcmVzdWx0LnNldChrLCB2KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJpZ2h0O1xuICAgIH1cbiAgICAvLyBIYW5kbGUgc2V0c1xuICAgIGlmIChsZWZ0IGluc3RhbmNlb2YgU2V0ICYmIHJpZ2h0IGluc3RhbmNlb2YgU2V0KSB7XG4gICAgICBpZiAob3B0aW9ucy5zZXRzID09PSBcIm1lcmdlXCIpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gbmV3IFNldChsZWZ0KTtcbiAgICAgICAgZm9yIChjb25zdCB2IG9mIHJpZ2h0KXtcbiAgICAgICAgICByZXN1bHQuYWRkKHYpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmlnaHQ7XG4gICAgfVxuICB9XG4gIHJldHVybiByaWdodDtcbn1cbi8qKlxuICogVGVzdCB3aGV0aGVyIGEgdmFsdWUgaXMgbWVyZ2VhYmxlIG9yIG5vdFxuICogQnVpbHRpbnMgdGhhdCBsb29rIGxpa2Ugb2JqZWN0cywgbnVsbCBhbmQgdXNlciBkZWZpbmVkIGNsYXNzZXNcbiAqIGFyZSBub3QgY29uc2lkZXJlZCBtZXJnZWFibGUgKGl0IG1lYW5zIHRoYXQgcmVmZXJlbmNlIHdpbGwgYmUgY29waWVkKVxuICovIGZ1bmN0aW9uIGlzTWVyZ2VhYmxlKHZhbHVlKSB7XG4gIHJldHVybiBPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpID09PSBPYmplY3QucHJvdG90eXBlO1xufVxuZnVuY3Rpb24gaXNJdGVyYWJsZSh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlW1N5bWJvbC5pdGVyYXRvcl0gPT09IFwiZnVuY3Rpb25cIjtcbn1cbmZ1bmN0aW9uIGlzTm9uTnVsbE9iamVjdCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT09IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiO1xufVxuZnVuY3Rpb24gZ2V0S2V5cyhyZWNvcmQpIHtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHJlY29yZCk7XG4gIGNvbnN0IHN5bWJvbHMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHJlY29yZCk7XG4gIC8vIEZhc3QgcGF0aDogbW9zdCBvYmplY3RzIGhhdmUgbm8gc3ltYm9sIGtleXNcbiAgaWYgKHN5bWJvbHMubGVuZ3RoID09PSAwKSByZXR1cm4ga2V5cztcbiAgZm9yIChjb25zdCBzeW0gb2Ygc3ltYm9scyl7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChyZWNvcmQsIHN5bSkpIHtcbiAgICAgIGtleXMucHVzaChzeW0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4ga2V5cztcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRlZXBfbWVyZ2UuanMubWFwIiwiLy8gQ29weXJpZ2h0IDIwMTgtMjAyNSB0aGUgRGVubyBhdXRob3JzLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cbmltcG9ydCB7IGRlZXBNZXJnZSB9IGZyb20gXCJAanNyL3N0ZF9fY29sbGVjdGlvbnMvZGVlcC1tZXJnZVwiO1xuLyoqXG4gKiBDb3B5IG9mIGBpbXBvcnQgeyBpc0xlYXAgfSBmcm9tIFwiQHN0ZC9kYXRldGltZVwiO2AgYmVjYXVzZSBpdCBjYW5ub3QgYmUgaW1wb3RlZCBhcyBsb25nIGFzIGl0IGlzIHVuc3RhYmxlLlxuICovIGZ1bmN0aW9uIGlzTGVhcCh5ZWFyTnVtYmVyKSB7XG4gIHJldHVybiB5ZWFyTnVtYmVyICUgNCA9PT0gMCAmJiB5ZWFyTnVtYmVyICUgMTAwICE9PSAwIHx8IHllYXJOdW1iZXIgJSA0MDAgPT09IDA7XG59XG5leHBvcnQgY2xhc3MgU2Nhbm5lciB7XG4gICN3aGl0ZXNwYWNlID0gL1sgXFx0XS87XG4gICNwb3NpdGlvbiA9IDA7XG4gICNzb3VyY2U7XG4gIGNvbnN0cnVjdG9yKHNvdXJjZSl7XG4gICAgdGhpcy4jc291cmNlID0gc291cmNlO1xuICB9XG4gIGdldCBwb3NpdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy4jcG9zaXRpb247XG4gIH1cbiAgZ2V0IHNvdXJjZSgpIHtcbiAgICByZXR1cm4gdGhpcy4jc291cmNlO1xuICB9XG4gIC8qKlxuICAgKiBHZXQgY3VycmVudCBjaGFyYWN0ZXJcbiAgICogQHBhcmFtIGluZGV4IC0gcmVsYXRpdmUgaW5kZXggZnJvbSBjdXJyZW50IHBvc2l0aW9uXG4gICAqLyBjaGFyKGluZGV4ID0gMCkge1xuICAgIHJldHVybiB0aGlzLiNzb3VyY2VbdGhpcy4jcG9zaXRpb24gKyBpbmRleF0gPz8gXCJcIjtcbiAgfVxuICAvKipcbiAgICogR2V0IHNsaWNlZCBzdHJpbmdcbiAgICogQHBhcmFtIHN0YXJ0IC0gc3RhcnQgcG9zaXRpb24gcmVsYXRpdmUgZnJvbSBjdXJyZW50IHBvc2l0aW9uXG4gICAqIEBwYXJhbSBlbmQgLSBlbmQgcG9zaXRpb24gcmVsYXRpdmUgZnJvbSBjdXJyZW50IHBvc2l0aW9uXG4gICAqLyBzbGljZShzdGFydCwgZW5kKSB7XG4gICAgcmV0dXJuIHRoaXMuI3NvdXJjZS5zbGljZSh0aGlzLiNwb3NpdGlvbiArIHN0YXJ0LCB0aGlzLiNwb3NpdGlvbiArIGVuZCk7XG4gIH1cbiAgLyoqXG4gICAqIE1vdmUgcG9zaXRpb24gdG8gbmV4dFxuICAgKi8gbmV4dChjb3VudCA9IDEpIHtcbiAgICB0aGlzLiNwb3NpdGlvbiArPSBjb3VudDtcbiAgfVxuICBza2lwV2hpdGVzcGFjZXMoKSB7XG4gICAgd2hpbGUodGhpcy4jd2hpdGVzcGFjZS50ZXN0KHRoaXMuY2hhcigpKSAmJiAhdGhpcy5lb2YoKSl7XG4gICAgICB0aGlzLm5leHQoKTtcbiAgICB9XG4gICAgLy8gSW52YWxpZCBpZiBjdXJyZW50IGNoYXIgaXMgb3RoZXIga2luZHMgb2Ygd2hpdGVzcGFjZVxuICAgIGlmICghdGhpcy5pc0N1cnJlbnRDaGFyRU9MKCkgJiYgL1xccy8udGVzdCh0aGlzLmNoYXIoKSkpIHtcbiAgICAgIGNvbnN0IGVzY2FwZWQgPSBcIlxcXFx1XCIgKyB0aGlzLmNoYXIoKS5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KTtcbiAgICAgIGNvbnN0IHBvc2l0aW9uID0gdGhpcy4jcG9zaXRpb247XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYENhbm5vdCBwYXJzZSB0aGUgVE9NTDogSXQgY29udGFpbnMgaW52YWxpZCB3aGl0ZXNwYWNlIGF0IHBvc2l0aW9uICcke3Bvc2l0aW9ufSc6IFxcYCR7ZXNjYXBlZH1cXGBgKTtcbiAgICB9XG4gIH1cbiAgbmV4dFVudGlsQ2hhcihvcHRpb25zID0ge1xuICAgIHNraXBDb21tZW50czogdHJ1ZVxuICB9KSB7XG4gICAgd2hpbGUoIXRoaXMuZW9mKCkpe1xuICAgICAgY29uc3QgY2hhciA9IHRoaXMuY2hhcigpO1xuICAgICAgaWYgKHRoaXMuI3doaXRlc3BhY2UudGVzdChjaGFyKSB8fCB0aGlzLmlzQ3VycmVudENoYXJFT0woKSkge1xuICAgICAgICB0aGlzLm5leHQoKTtcbiAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5za2lwQ29tbWVudHMgJiYgdGhpcy5jaGFyKCkgPT09IFwiI1wiKSB7XG4gICAgICAgIC8vIGVudGVyaW5nIGNvbW1lbnRcbiAgICAgICAgd2hpbGUoIXRoaXMuaXNDdXJyZW50Q2hhckVPTCgpICYmICF0aGlzLmVvZigpKXtcbiAgICAgICAgICB0aGlzLm5leHQoKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBQb3NpdGlvbiByZWFjaGVkIEVPRiBvciBub3RcbiAgICovIGVvZigpIHtcbiAgICByZXR1cm4gdGhpcy4jcG9zaXRpb24gPj0gdGhpcy4jc291cmNlLmxlbmd0aDtcbiAgfVxuICBpc0N1cnJlbnRDaGFyRU9MKCkge1xuICAgIHJldHVybiB0aGlzLmNoYXIoKSA9PT0gXCJcXG5cIiB8fCB0aGlzLnN0YXJ0c1dpdGgoXCJcXHJcXG5cIik7XG4gIH1cbiAgc3RhcnRzV2l0aChzZWFyY2hTdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy4jc291cmNlLnN0YXJ0c1dpdGgoc2VhcmNoU3RyaW5nLCB0aGlzLiNwb3NpdGlvbik7XG4gIH1cbiAgbWF0Y2gocmVnRXhwKSB7XG4gICAgaWYgKCFyZWdFeHAuc3RpY2t5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFJlZ0V4cCAke3JlZ0V4cH0gZG9lcyBub3QgaGF2ZSBhIHN0aWNreSAneScgZmxhZ2ApO1xuICAgIH1cbiAgICByZWdFeHAubGFzdEluZGV4ID0gdGhpcy4jcG9zaXRpb247XG4gICAgcmV0dXJuIHRoaXMuI3NvdXJjZS5tYXRjaChyZWdFeHApO1xuICB9XG59XG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gVXRpbGl0aWVzXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuZnVuY3Rpb24gc3VjY2Vzcyhib2R5KSB7XG4gIHJldHVybiB7XG4gICAgb2s6IHRydWUsXG4gICAgYm9keVxuICB9O1xufVxuZnVuY3Rpb24gZmFpbHVyZSgpIHtcbiAgcmV0dXJuIHtcbiAgICBvazogZmFsc2VcbiAgfTtcbn1cbi8qKlxuICogQ3JlYXRlcyBhIG5lc3RlZCBvYmplY3QgZnJvbSB0aGUga2V5cyBhbmQgdmFsdWVzLlxuICpcbiAqIGUuZy4gYHVuZmxhdChbXCJhXCIsIFwiYlwiLCBcImNcIl0sIDEpYCByZXR1cm5zIGB7IGE6IHsgYjogeyBjOiAxIH0gfSB9YFxuICovIGV4cG9ydCBmdW5jdGlvbiB1bmZsYXQoa2V5cywgdmFsdWVzID0ge1xuICBfX3Byb3RvX186IG51bGxcbn0pIHtcbiAgcmV0dXJuIGtleXMucmVkdWNlUmlnaHQoKGFjYywga2V5KT0+KHtcbiAgICAgIFtrZXldOiBhY2NcbiAgICB9KSwgdmFsdWVzKTtcbn1cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgJiYgdmFsdWUgIT09IG51bGw7XG59XG5mdW5jdGlvbiBnZXRUYXJnZXRWYWx1ZSh0YXJnZXQsIGtleXMpIHtcbiAgY29uc3Qga2V5ID0ga2V5c1swXTtcbiAgaWYgKCFrZXkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgcGFyc2UgdGhlIFRPTUw6IGtleSBsZW5ndGggaXMgbm90IGEgcG9zaXRpdmUgbnVtYmVyXCIpO1xuICB9XG4gIHJldHVybiB0YXJnZXRba2V5XTtcbn1cbmZ1bmN0aW9uIGRlZXBBc3NpZ25UYWJsZSh0YXJnZXQsIHRhYmxlKSB7XG4gIGNvbnN0IHsga2V5cywgdHlwZSwgdmFsdWUgfSA9IHRhYmxlO1xuICBjb25zdCBjdXJyZW50VmFsdWUgPSBnZXRUYXJnZXRWYWx1ZSh0YXJnZXQsIGtleXMpO1xuICBpZiAoY3VycmVudFZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih0YXJnZXQsIHVuZmxhdChrZXlzLCB2YWx1ZSkpO1xuICB9XG4gIGlmIChBcnJheS5pc0FycmF5KGN1cnJlbnRWYWx1ZSkpIHtcbiAgICBjb25zdCBsYXN0ID0gY3VycmVudFZhbHVlLmF0KC0xKTtcbiAgICBkZWVwQXNzaWduKGxhc3QsIHtcbiAgICAgIHR5cGUsXG4gICAgICBrZXlzOiBrZXlzLnNsaWNlKDEpLFxuICAgICAgdmFsdWVcbiAgICB9KTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG4gIGlmIChpc09iamVjdChjdXJyZW50VmFsdWUpKSB7XG4gICAgZGVlcEFzc2lnbihjdXJyZW50VmFsdWUsIHtcbiAgICAgIHR5cGUsXG4gICAgICBrZXlzOiBrZXlzLnNsaWNlKDEpLFxuICAgICAgdmFsdWVcbiAgICB9KTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG4gIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgYXNzaWduXCIpO1xufVxuZnVuY3Rpb24gZGVlcEFzc2lnblRhYmxlQXJyYXkodGFyZ2V0LCB0YWJsZSkge1xuICBjb25zdCB7IHR5cGUsIGtleXMsIHZhbHVlIH0gPSB0YWJsZTtcbiAgY29uc3QgY3VycmVudFZhbHVlID0gZ2V0VGFyZ2V0VmFsdWUodGFyZ2V0LCBrZXlzKTtcbiAgaWYgKGN1cnJlbnRWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24odGFyZ2V0LCB1bmZsYXQoa2V5cywgW1xuICAgICAgdmFsdWVcbiAgICBdKSk7XG4gIH1cbiAgaWYgKEFycmF5LmlzQXJyYXkoY3VycmVudFZhbHVlKSkge1xuICAgIGlmICh0YWJsZS5rZXlzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgY3VycmVudFZhbHVlLnB1c2godmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBsYXN0ID0gY3VycmVudFZhbHVlLmF0KC0xKTtcbiAgICAgIGRlZXBBc3NpZ24obGFzdCwge1xuICAgICAgICB0eXBlOiB0YWJsZS50eXBlLFxuICAgICAgICBrZXlzOiB0YWJsZS5rZXlzLnNsaWNlKDEpLFxuICAgICAgICB2YWx1ZTogdGFibGUudmFsdWVcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG4gIGlmIChpc09iamVjdChjdXJyZW50VmFsdWUpKSB7XG4gICAgZGVlcEFzc2lnbihjdXJyZW50VmFsdWUsIHtcbiAgICAgIHR5cGUsXG4gICAgICBrZXlzOiBrZXlzLnNsaWNlKDEpLFxuICAgICAgdmFsdWVcbiAgICB9KTtcbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG4gIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgYXNzaWduXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGRlZXBBc3NpZ24odGFyZ2V0LCBib2R5KSB7XG4gIHN3aXRjaChib2R5LnR5cGUpe1xuICAgIGNhc2UgXCJCbG9ja1wiOlxuICAgICAgcmV0dXJuIGRlZXBNZXJnZSh0YXJnZXQsIGJvZHkudmFsdWUpO1xuICAgIGNhc2UgXCJUYWJsZVwiOlxuICAgICAgcmV0dXJuIGRlZXBBc3NpZ25UYWJsZSh0YXJnZXQsIGJvZHkpO1xuICAgIGNhc2UgXCJUYWJsZUFycmF5XCI6XG4gICAgICByZXR1cm4gZGVlcEFzc2lnblRhYmxlQXJyYXkodGFyZ2V0LCBib2R5KTtcbiAgfVxufVxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBQYXJzZXIgY29tYmluYXRvcnMgYW5kIGdlbmVyYXRvcnNcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmZ1bmN0aW9uIG9yKHBhcnNlcnMpIHtcbiAgcmV0dXJuIChzY2FubmVyKT0+e1xuICAgIGZvciAoY29uc3QgcGFyc2Ugb2YgcGFyc2Vycyl7XG4gICAgICBjb25zdCByZXN1bHQgPSBwYXJzZShzY2FubmVyKTtcbiAgICAgIGlmIChyZXN1bHQub2spIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIHJldHVybiBmYWlsdXJlKCk7XG4gIH07XG59XG4vKiogSm9pbiB0aGUgcGFyc2UgcmVzdWx0cyBvZiB0aGUgZ2l2ZW4gcGFyc2VyIGludG8gYW4gYXJyYXkuXG4gKlxuICogSWYgdGhlIHBhcnNlciBmYWlscyBhdCB0aGUgZmlyc3QgYXR0ZW1wdCwgaXQgd2lsbCByZXR1cm4gYW4gZW1wdHkgYXJyYXkuXG4gKi8gZnVuY3Rpb24gam9pbihwYXJzZXIsIHNlcGFyYXRvcikge1xuICBjb25zdCBTZXBhcmF0b3IgPSBjaGFyYWN0ZXIoc2VwYXJhdG9yKTtcbiAgcmV0dXJuIChzY2FubmVyKT0+e1xuICAgIGNvbnN0IG91dCA9IFtdO1xuICAgIGNvbnN0IGZpcnN0ID0gcGFyc2VyKHNjYW5uZXIpO1xuICAgIGlmICghZmlyc3Qub2spIHJldHVybiBzdWNjZXNzKG91dCk7XG4gICAgb3V0LnB1c2goZmlyc3QuYm9keSk7XG4gICAgd2hpbGUoIXNjYW5uZXIuZW9mKCkpe1xuICAgICAgaWYgKCFTZXBhcmF0b3Ioc2Nhbm5lcikub2spIGJyZWFrO1xuICAgICAgY29uc3QgcmVzdWx0ID0gcGFyc2VyKHNjYW5uZXIpO1xuICAgICAgaWYgKCFyZXN1bHQub2spIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuIGFmdGVyIFwiJHtzZXBhcmF0b3J9XCJgKTtcbiAgICAgIH1cbiAgICAgIG91dC5wdXNoKHJlc3VsdC5ib2R5KTtcbiAgICB9XG4gICAgcmV0dXJuIHN1Y2Nlc3Mob3V0KTtcbiAgfTtcbn1cbi8qKiBKb2luIHRoZSBwYXJzZSByZXN1bHRzIG9mIHRoZSBnaXZlbiBwYXJzZXIgaW50byBhbiBhcnJheS5cbiAqXG4gKiBUaGlzIHJlcXVpcmVzIHRoZSBwYXJzZXIgdG8gc3VjY2VlZCBhdCBsZWFzdCBvbmNlLlxuICovIGZ1bmN0aW9uIGpvaW4xKHBhcnNlciwgc2VwYXJhdG9yKSB7XG4gIGNvbnN0IFNlcGFyYXRvciA9IGNoYXJhY3RlcihzZXBhcmF0b3IpO1xuICByZXR1cm4gKHNjYW5uZXIpPT57XG4gICAgY29uc3QgZmlyc3QgPSBwYXJzZXIoc2Nhbm5lcik7XG4gICAgaWYgKCFmaXJzdC5vaykgcmV0dXJuIGZhaWx1cmUoKTtcbiAgICBjb25zdCBvdXQgPSBbXG4gICAgICBmaXJzdC5ib2R5XG4gICAgXTtcbiAgICB3aGlsZSghc2Nhbm5lci5lb2YoKSl7XG4gICAgICBpZiAoIVNlcGFyYXRvcihzY2FubmVyKS5vaykgYnJlYWs7XG4gICAgICBjb25zdCByZXN1bHQgPSBwYXJzZXIoc2Nhbm5lcik7XG4gICAgICBpZiAoIXJlc3VsdC5vaykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgdG9rZW4gYWZ0ZXIgXCIke3NlcGFyYXRvcn1cImApO1xuICAgICAgfVxuICAgICAgb3V0LnB1c2gocmVzdWx0LmJvZHkpO1xuICAgIH1cbiAgICByZXR1cm4gc3VjY2VzcyhvdXQpO1xuICB9O1xufVxuZnVuY3Rpb24ga3Yoa2V5UGFyc2VyLCBzZXBhcmF0b3IsIHZhbHVlUGFyc2VyKSB7XG4gIGNvbnN0IFNlcGFyYXRvciA9IGNoYXJhY3RlcihzZXBhcmF0b3IpO1xuICByZXR1cm4gKHNjYW5uZXIpPT57XG4gICAgY29uc3QgcG9zaXRpb24gPSBzY2FubmVyLnBvc2l0aW9uO1xuICAgIGNvbnN0IGtleSA9IGtleVBhcnNlcihzY2FubmVyKTtcbiAgICBpZiAoIWtleS5vaykgcmV0dXJuIGZhaWx1cmUoKTtcbiAgICBjb25zdCBzZXAgPSBTZXBhcmF0b3Ioc2Nhbm5lcik7XG4gICAgaWYgKCFzZXAub2spIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihga2V5L3ZhbHVlIHBhaXIgZG9lc24ndCBoYXZlIFwiJHtzZXBhcmF0b3J9XCJgKTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSB2YWx1ZVBhcnNlcihzY2FubmVyKTtcbiAgICBpZiAoIXZhbHVlLm9rKSB7XG4gICAgICBjb25zdCBsaW5lRW5kSW5kZXggPSBzY2FubmVyLnNvdXJjZS5pbmRleE9mKFwiXFxuXCIsIHNjYW5uZXIucG9zaXRpb24pO1xuICAgICAgY29uc3QgZW5kUG9zaXRpb24gPSBsaW5lRW5kSW5kZXggPiAwID8gbGluZUVuZEluZGV4IDogc2Nhbm5lci5zb3VyY2UubGVuZ3RoO1xuICAgICAgY29uc3QgbGluZSA9IHNjYW5uZXIuc291cmNlLnNsaWNlKHBvc2l0aW9uLCBlbmRQb3NpdGlvbik7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYENhbm5vdCBwYXJzZSB2YWx1ZSBvbiBsaW5lICcke2xpbmV9J2ApO1xuICAgIH1cbiAgICByZXR1cm4gc3VjY2Vzcyh1bmZsYXQoa2V5LmJvZHksIHZhbHVlLmJvZHkpKTtcbiAgfTtcbn1cbmZ1bmN0aW9uIG1lcmdlKHBhcnNlcikge1xuICByZXR1cm4gKHNjYW5uZXIpPT57XG4gICAgY29uc3QgcmVzdWx0ID0gcGFyc2VyKHNjYW5uZXIpO1xuICAgIGlmICghcmVzdWx0Lm9rKSByZXR1cm4gZmFpbHVyZSgpO1xuICAgIGxldCBib2R5ID0ge1xuICAgICAgX19wcm90b19fOiBudWxsXG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IHJlY29yZCBvZiByZXN1bHQuYm9keSl7XG4gICAgICBpZiAodHlwZW9mIHJlY29yZCA9PT0gXCJvYmplY3RcIiAmJiByZWNvcmQgIT09IG51bGwpIHtcbiAgICAgICAgYm9keSA9IGRlZXBNZXJnZShib2R5LCByZWNvcmQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3VjY2Vzcyhib2R5KTtcbiAgfTtcbn1cbmZ1bmN0aW9uIHJlcGVhdChwYXJzZXIpIHtcbiAgcmV0dXJuIChzY2FubmVyKT0+e1xuICAgIGNvbnN0IGJvZHkgPSBbXTtcbiAgICB3aGlsZSghc2Nhbm5lci5lb2YoKSl7XG4gICAgICBjb25zdCByZXN1bHQgPSBwYXJzZXIoc2Nhbm5lcik7XG4gICAgICBpZiAoIXJlc3VsdC5vaykgYnJlYWs7XG4gICAgICBib2R5LnB1c2gocmVzdWx0LmJvZHkpO1xuICAgICAgc2Nhbm5lci5uZXh0VW50aWxDaGFyKCk7XG4gICAgfVxuICAgIGlmIChib2R5Lmxlbmd0aCA9PT0gMCkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgICByZXR1cm4gc3VjY2Vzcyhib2R5KTtcbiAgfTtcbn1cbmZ1bmN0aW9uIHN1cnJvdW5kKGxlZnQsIHBhcnNlciwgcmlnaHQpIHtcbiAgY29uc3QgTGVmdCA9IGNoYXJhY3RlcihsZWZ0KTtcbiAgY29uc3QgUmlnaHQgPSBjaGFyYWN0ZXIocmlnaHQpO1xuICByZXR1cm4gKHNjYW5uZXIpPT57XG4gICAgaWYgKCFMZWZ0KHNjYW5uZXIpLm9rKSB7XG4gICAgICByZXR1cm4gZmFpbHVyZSgpO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSBwYXJzZXIoc2Nhbm5lcik7XG4gICAgaWYgKCFyZXN1bHQub2spIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCB0b2tlbiBhZnRlciBcIiR7bGVmdH1cImApO1xuICAgIH1cbiAgICBpZiAoIVJpZ2h0KHNjYW5uZXIpLm9rKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYE5vdCBjbG9zZWQgYnkgXCIke3JpZ2h0fVwiIGFmdGVyIHN0YXJ0ZWQgd2l0aCBcIiR7bGVmdH1cImApO1xuICAgIH1cbiAgICByZXR1cm4gc3VjY2VzcyhyZXN1bHQuYm9keSk7XG4gIH07XG59XG5mdW5jdGlvbiBjaGFyYWN0ZXIoc3RyKSB7XG4gIHJldHVybiAoc2Nhbm5lcik9PntcbiAgICBzY2FubmVyLnNraXBXaGl0ZXNwYWNlcygpO1xuICAgIGlmICghc2Nhbm5lci5zdGFydHNXaXRoKHN0cikpIHJldHVybiBmYWlsdXJlKCk7XG4gICAgc2Nhbm5lci5uZXh0KHN0ci5sZW5ndGgpO1xuICAgIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gICAgcmV0dXJuIHN1Y2Nlc3ModW5kZWZpbmVkKTtcbiAgfTtcbn1cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBQYXJzZXIgY29tcG9uZW50c1xuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbmNvbnN0IEJBUkVfS0VZX1JFR0VYUCA9IC9bQS1aYS16MC05Xy1dKy95O1xuZXhwb3J0IGZ1bmN0aW9uIGJhcmVLZXkoc2Nhbm5lcikge1xuICBzY2FubmVyLnNraXBXaGl0ZXNwYWNlcygpO1xuICBjb25zdCBrZXkgPSBzY2FubmVyLm1hdGNoKEJBUkVfS0VZX1JFR0VYUCk/LlswXTtcbiAgaWYgKCFrZXkpIHJldHVybiBmYWlsdXJlKCk7XG4gIHNjYW5uZXIubmV4dChrZXkubGVuZ3RoKTtcbiAgcmV0dXJuIHN1Y2Nlc3Moa2V5KTtcbn1cbmZ1bmN0aW9uIGVzY2FwZVNlcXVlbmNlKHNjYW5uZXIpIHtcbiAgaWYgKHNjYW5uZXIuY2hhcigpICE9PSBcIlxcXFxcIikgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KCk7XG4gIC8vIFNlZSBodHRwczovL3RvbWwuaW8vZW4vdjEuMC4wLXJjLjMjc3RyaW5nXG4gIHN3aXRjaChzY2FubmVyLmNoYXIoKSl7XG4gICAgY2FzZSBcImJcIjpcbiAgICAgIHNjYW5uZXIubmV4dCgpO1xuICAgICAgcmV0dXJuIHN1Y2Nlc3MoXCJcXGJcIik7XG4gICAgY2FzZSBcInRcIjpcbiAgICAgIHNjYW5uZXIubmV4dCgpO1xuICAgICAgcmV0dXJuIHN1Y2Nlc3MoXCJcXHRcIik7XG4gICAgY2FzZSBcIm5cIjpcbiAgICAgIHNjYW5uZXIubmV4dCgpO1xuICAgICAgcmV0dXJuIHN1Y2Nlc3MoXCJcXG5cIik7XG4gICAgY2FzZSBcImZcIjpcbiAgICAgIHNjYW5uZXIubmV4dCgpO1xuICAgICAgcmV0dXJuIHN1Y2Nlc3MoXCJcXGZcIik7XG4gICAgY2FzZSBcInJcIjpcbiAgICAgIHNjYW5uZXIubmV4dCgpO1xuICAgICAgcmV0dXJuIHN1Y2Nlc3MoXCJcXHJcIik7XG4gICAgY2FzZSBcInVcIjpcbiAgICBjYXNlIFwiVVwiOlxuICAgICAge1xuICAgICAgICAvLyBVbmljb2RlIGNoYXJhY3RlclxuICAgICAgICBjb25zdCBjb2RlUG9pbnRMZW4gPSBzY2FubmVyLmNoYXIoKSA9PT0gXCJ1XCIgPyA0IDogNjtcbiAgICAgICAgY29uc3QgY29kZVBvaW50ID0gcGFyc2VJbnQoXCIweFwiICsgc2Nhbm5lci5zbGljZSgxLCAxICsgY29kZVBvaW50TGVuKSwgMTYpO1xuICAgICAgICBjb25zdCBzdHIgPSBTdHJpbmcuZnJvbUNvZGVQb2ludChjb2RlUG9pbnQpO1xuICAgICAgICBzY2FubmVyLm5leHQoY29kZVBvaW50TGVuICsgMSk7XG4gICAgICAgIHJldHVybiBzdWNjZXNzKHN0cik7XG4gICAgICB9XG4gICAgY2FzZSAnXCInOlxuICAgICAgc2Nhbm5lci5uZXh0KCk7XG4gICAgICByZXR1cm4gc3VjY2VzcygnXCInKTtcbiAgICBjYXNlIFwiXFxcXFwiOlxuICAgICAgc2Nhbm5lci5uZXh0KCk7XG4gICAgICByZXR1cm4gc3VjY2VzcyhcIlxcXFxcIik7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCBlc2NhcGUgc2VxdWVuY2U6IFxcXFwke3NjYW5uZXIuY2hhcigpfWApO1xuICB9XG59XG5leHBvcnQgZnVuY3Rpb24gYmFzaWNTdHJpbmcoc2Nhbm5lcikge1xuICBzY2FubmVyLnNraXBXaGl0ZXNwYWNlcygpO1xuICBpZiAoc2Nhbm5lci5jaGFyKCkgIT09ICdcIicpIHJldHVybiBmYWlsdXJlKCk7XG4gIHNjYW5uZXIubmV4dCgpO1xuICBjb25zdCBhY2MgPSBbXTtcbiAgd2hpbGUoc2Nhbm5lci5jaGFyKCkgIT09ICdcIicgJiYgIXNjYW5uZXIuZW9mKCkpe1xuICAgIGlmIChzY2FubmVyLmNoYXIoKSA9PT0gXCJcXG5cIikge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiU2luZ2xlLWxpbmUgc3RyaW5nIGNhbm5vdCBjb250YWluIEVPTFwiKTtcbiAgICB9XG4gICAgY29uc3QgZXNjYXBlZENoYXIgPSBlc2NhcGVTZXF1ZW5jZShzY2FubmVyKTtcbiAgICBpZiAoZXNjYXBlZENoYXIub2spIHtcbiAgICAgIGFjYy5wdXNoKGVzY2FwZWRDaGFyLmJvZHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhY2MucHVzaChzY2FubmVyLmNoYXIoKSk7XG4gICAgICBzY2FubmVyLm5leHQoKTtcbiAgICB9XG4gIH1cbiAgaWYgKHNjYW5uZXIuZW9mKCkpIHtcbiAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFNpbmdsZS1saW5lIHN0cmluZyBpcyBub3QgY2xvc2VkOlxcbiR7YWNjLmpvaW4oXCJcIil9YCk7XG4gIH1cbiAgc2Nhbm5lci5uZXh0KCk7IC8vIHNraXAgbGFzdCAnXCJcIlxuICByZXR1cm4gc3VjY2VzcyhhY2Muam9pbihcIlwiKSk7XG59XG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbFN0cmluZyhzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGlmIChzY2FubmVyLmNoYXIoKSAhPT0gXCInXCIpIHJldHVybiBmYWlsdXJlKCk7XG4gIHNjYW5uZXIubmV4dCgpO1xuICBjb25zdCBhY2MgPSBbXTtcbiAgd2hpbGUoc2Nhbm5lci5jaGFyKCkgIT09IFwiJ1wiICYmICFzY2FubmVyLmVvZigpKXtcbiAgICBpZiAoc2Nhbm5lci5jaGFyKCkgPT09IFwiXFxuXCIpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcIlNpbmdsZS1saW5lIHN0cmluZyBjYW5ub3QgY29udGFpbiBFT0xcIik7XG4gICAgfVxuICAgIGFjYy5wdXNoKHNjYW5uZXIuY2hhcigpKTtcbiAgICBzY2FubmVyLm5leHQoKTtcbiAgfVxuICBpZiAoc2Nhbm5lci5lb2YoKSkge1xuICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgU2luZ2xlLWxpbmUgc3RyaW5nIGlzIG5vdCBjbG9zZWQ6XFxuJHthY2Muam9pbihcIlwiKX1gKTtcbiAgfVxuICBzY2FubmVyLm5leHQoKTsgLy8gc2tpcCBsYXN0IFwiJ1wiXG4gIHJldHVybiBzdWNjZXNzKGFjYy5qb2luKFwiXCIpKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtdWx0aWxpbmVCYXNpY1N0cmluZyhzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGlmICghc2Nhbm5lci5zdGFydHNXaXRoKCdcIlwiXCInKSkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KDMpO1xuICBpZiAoc2Nhbm5lci5jaGFyKCkgPT09IFwiXFxuXCIpIHtcbiAgICAvLyBUaGUgZmlyc3QgbmV3bGluZSAoTEYpIGlzIHRyaW1tZWRcbiAgICBzY2FubmVyLm5leHQoKTtcbiAgfSBlbHNlIGlmIChzY2FubmVyLnN0YXJ0c1dpdGgoXCJcXHJcXG5cIikpIHtcbiAgICAvLyBUaGUgZmlyc3QgbmV3bGluZSAoQ1JMRikgaXMgdHJpbW1lZFxuICAgIHNjYW5uZXIubmV4dCgyKTtcbiAgfVxuICBjb25zdCBhY2MgPSBbXTtcbiAgd2hpbGUoIXNjYW5uZXIuc3RhcnRzV2l0aCgnXCJcIlwiJykgJiYgIXNjYW5uZXIuZW9mKCkpe1xuICAgIC8vIGxpbmUgZW5kaW5nIGJhY2tzbGFzaFxuICAgIGlmIChzY2FubmVyLnN0YXJ0c1dpdGgoXCJcXFxcXFxuXCIpKSB7XG4gICAgICBzY2FubmVyLm5leHQoKTtcbiAgICAgIHNjYW5uZXIubmV4dFVudGlsQ2hhcih7XG4gICAgICAgIHNraXBDb21tZW50czogZmFsc2VcbiAgICAgIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIGlmIChzY2FubmVyLnN0YXJ0c1dpdGgoXCJcXFxcXFxyXFxuXCIpKSB7XG4gICAgICBzY2FubmVyLm5leHQoKTtcbiAgICAgIHNjYW5uZXIubmV4dFVudGlsQ2hhcih7XG4gICAgICAgIHNraXBDb21tZW50czogZmFsc2VcbiAgICAgIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IGVzY2FwZWRDaGFyID0gZXNjYXBlU2VxdWVuY2Uoc2Nhbm5lcik7XG4gICAgaWYgKGVzY2FwZWRDaGFyLm9rKSB7XG4gICAgICBhY2MucHVzaChlc2NhcGVkQ2hhci5ib2R5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgYWNjLnB1c2goc2Nhbm5lci5jaGFyKCkpO1xuICAgICAgc2Nhbm5lci5uZXh0KCk7XG4gICAgfVxuICB9XG4gIGlmIChzY2FubmVyLmVvZigpKSB7XG4gICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBNdWx0aS1saW5lIHN0cmluZyBpcyBub3QgY2xvc2VkOlxcbiR7YWNjLmpvaW4oXCJcIil9YCk7XG4gIH1cbiAgLy8gaWYgZW5kcyB3aXRoIDQgYFwiYCwgcHVzaCB0aGUgZmlzdCBgXCJgIHRvIHN0cmluZ1xuICBpZiAoc2Nhbm5lci5jaGFyKDMpID09PSAnXCInKSB7XG4gICAgYWNjLnB1c2goJ1wiJyk7XG4gICAgc2Nhbm5lci5uZXh0KCk7XG4gIH1cbiAgc2Nhbm5lci5uZXh0KDMpOyAvLyBza2lwIGxhc3QgJ1wiXCJcIlwiXG4gIHJldHVybiBzdWNjZXNzKGFjYy5qb2luKFwiXCIpKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtdWx0aWxpbmVMaXRlcmFsU3RyaW5nKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgaWYgKCFzY2FubmVyLnN0YXJ0c1dpdGgoXCInJydcIikpIHJldHVybiBmYWlsdXJlKCk7XG4gIHNjYW5uZXIubmV4dCgzKTtcbiAgaWYgKHNjYW5uZXIuY2hhcigpID09PSBcIlxcblwiKSB7XG4gICAgLy8gVGhlIGZpcnN0IG5ld2xpbmUgKExGKSBpcyB0cmltbWVkXG4gICAgc2Nhbm5lci5uZXh0KCk7XG4gIH0gZWxzZSBpZiAoc2Nhbm5lci5zdGFydHNXaXRoKFwiXFxyXFxuXCIpKSB7XG4gICAgLy8gVGhlIGZpcnN0IG5ld2xpbmUgKENSTEYpIGlzIHRyaW1tZWRcbiAgICBzY2FubmVyLm5leHQoMik7XG4gIH1cbiAgY29uc3QgYWNjID0gW107XG4gIHdoaWxlKCFzY2FubmVyLnN0YXJ0c1dpdGgoXCInJydcIikgJiYgIXNjYW5uZXIuZW9mKCkpe1xuICAgIGFjYy5wdXNoKHNjYW5uZXIuY2hhcigpKTtcbiAgICBzY2FubmVyLm5leHQoKTtcbiAgfVxuICBpZiAoc2Nhbm5lci5lb2YoKSkge1xuICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgTXVsdGktbGluZSBzdHJpbmcgaXMgbm90IGNsb3NlZDpcXG4ke2FjYy5qb2luKFwiXCIpfWApO1xuICB9XG4gIC8vIGlmIGVuZHMgd2l0aCA0IGAnYCwgcHVzaCB0aGUgZmlzdCBgJ2AgdG8gc3RyaW5nXG4gIGlmIChzY2FubmVyLmNoYXIoMykgPT09IFwiJ1wiKSB7XG4gICAgYWNjLnB1c2goXCInXCIpO1xuICAgIHNjYW5uZXIubmV4dCgpO1xuICB9XG4gIHNjYW5uZXIubmV4dCgzKTsgLy8gc2tpcCBsYXN0IFwiJycnXCJcbiAgcmV0dXJuIHN1Y2Nlc3MoYWNjLmpvaW4oXCJcIikpO1xufVxuY29uc3QgQk9PTEVBTl9SRUdFWFAgPSAvKD86dHJ1ZXxmYWxzZSlcXGIveTtcbmV4cG9ydCBmdW5jdGlvbiBib29sZWFuKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgY29uc3QgbWF0Y2ggPSBzY2FubmVyLm1hdGNoKEJPT0xFQU5fUkVHRVhQKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgY29uc3Qgc3RyaW5nID0gbWF0Y2hbMF07XG4gIHNjYW5uZXIubmV4dChzdHJpbmcubGVuZ3RoKTtcbiAgY29uc3QgdmFsdWUgPSBzdHJpbmcgPT09IFwidHJ1ZVwiO1xuICByZXR1cm4gc3VjY2Vzcyh2YWx1ZSk7XG59XG5jb25zdCBJTkZJTklUWV9NQVAgPSBuZXcgTWFwKFtcbiAgW1xuICAgIFwiaW5mXCIsXG4gICAgSW5maW5pdHlcbiAgXSxcbiAgW1xuICAgIFwiK2luZlwiLFxuICAgIEluZmluaXR5XG4gIF0sXG4gIFtcbiAgICBcIi1pbmZcIixcbiAgICAtSW5maW5pdHlcbiAgXVxuXSk7XG5jb25zdCBJTkZJTklUWV9SRUdFWFAgPSAvWystXT9pbmZcXGIveTtcbmV4cG9ydCBmdW5jdGlvbiBpbmZpbml0eShzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGNvbnN0IG1hdGNoID0gc2Nhbm5lci5tYXRjaChJTkZJTklUWV9SRUdFWFApO1xuICBpZiAoIW1hdGNoKSByZXR1cm4gZmFpbHVyZSgpO1xuICBjb25zdCBzdHJpbmcgPSBtYXRjaFswXTtcbiAgc2Nhbm5lci5uZXh0KHN0cmluZy5sZW5ndGgpO1xuICBjb25zdCB2YWx1ZSA9IElORklOSVRZX01BUC5nZXQoc3RyaW5nKTtcbiAgcmV0dXJuIHN1Y2Nlc3ModmFsdWUpO1xufVxuY29uc3QgTkFOX1JFR0VYUCA9IC9bKy1dP25hblxcYi95O1xuZXhwb3J0IGZ1bmN0aW9uIG5hbihzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGNvbnN0IG1hdGNoID0gc2Nhbm5lci5tYXRjaChOQU5fUkVHRVhQKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgY29uc3Qgc3RyaW5nID0gbWF0Y2hbMF07XG4gIHNjYW5uZXIubmV4dChzdHJpbmcubGVuZ3RoKTtcbiAgY29uc3QgdmFsdWUgPSBOYU47XG4gIHJldHVybiBzdWNjZXNzKHZhbHVlKTtcbn1cbmV4cG9ydCBjb25zdCBkb3R0ZWRLZXkgPSBqb2luMShvcihbXG4gIGJhcmVLZXksXG4gIGJhc2ljU3RyaW5nLFxuICBsaXRlcmFsU3RyaW5nXG5dKSwgXCIuXCIpO1xuY29uc3QgQklOQVJZX1JFR0VYUCA9IC8wYlswMV0rKD86X1swMV0rKSpcXGIveTtcbmV4cG9ydCBmdW5jdGlvbiBiaW5hcnkoc2Nhbm5lcikge1xuICBzY2FubmVyLnNraXBXaGl0ZXNwYWNlcygpO1xuICBjb25zdCBtYXRjaCA9IHNjYW5uZXIubWF0Y2goQklOQVJZX1JFR0VYUCk/LlswXTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KG1hdGNoLmxlbmd0aCk7XG4gIGNvbnN0IHZhbHVlID0gbWF0Y2guc2xpY2UoMikucmVwbGFjZUFsbChcIl9cIiwgXCJcIik7XG4gIGNvbnN0IG51bWJlciA9IHBhcnNlSW50KHZhbHVlLCAyKTtcbiAgcmV0dXJuIGlzTmFOKG51bWJlcikgPyBmYWlsdXJlKCkgOiBzdWNjZXNzKG51bWJlcik7XG59XG5jb25zdCBPQ1RBTF9SRUdFWFAgPSAvMG9bMC03XSsoPzpfWzAtN10rKSpcXGIveTtcbmV4cG9ydCBmdW5jdGlvbiBvY3RhbChzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGNvbnN0IG1hdGNoID0gc2Nhbm5lci5tYXRjaChPQ1RBTF9SRUdFWFApPy5bMF07XG4gIGlmICghbWF0Y2gpIHJldHVybiBmYWlsdXJlKCk7XG4gIHNjYW5uZXIubmV4dChtYXRjaC5sZW5ndGgpO1xuICBjb25zdCB2YWx1ZSA9IG1hdGNoLnNsaWNlKDIpLnJlcGxhY2VBbGwoXCJfXCIsIFwiXCIpO1xuICBjb25zdCBudW1iZXIgPSBwYXJzZUludCh2YWx1ZSwgOCk7XG4gIHJldHVybiBpc05hTihudW1iZXIpID8gZmFpbHVyZSgpIDogc3VjY2VzcyhudW1iZXIpO1xufVxuY29uc3QgSEVYX1JFR0VYUCA9IC8weFswLTlhLWZdKyg/Ol9bMC05YS1mXSspKlxcYi95aTtcbmV4cG9ydCBmdW5jdGlvbiBoZXgoc2Nhbm5lcikge1xuICBzY2FubmVyLnNraXBXaGl0ZXNwYWNlcygpO1xuICBjb25zdCBtYXRjaCA9IHNjYW5uZXIubWF0Y2goSEVYX1JFR0VYUCk/LlswXTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KG1hdGNoLmxlbmd0aCk7XG4gIGNvbnN0IHZhbHVlID0gbWF0Y2guc2xpY2UoMikucmVwbGFjZUFsbChcIl9cIiwgXCJcIik7XG4gIGNvbnN0IG51bWJlciA9IHBhcnNlSW50KHZhbHVlLCAxNik7XG4gIHJldHVybiBpc05hTihudW1iZXIpID8gZmFpbHVyZSgpIDogc3VjY2VzcyhudW1iZXIpO1xufVxuY29uc3QgSU5URUdFUl9SRUdFWFAgPSAvWystXT8oPzowfFsxLTldWzAtOV0qKD86X1swLTldKykqKVxcYi95O1xuZXhwb3J0IGZ1bmN0aW9uIGludGVnZXIoc2Nhbm5lcikge1xuICBzY2FubmVyLnNraXBXaGl0ZXNwYWNlcygpO1xuICBjb25zdCBtYXRjaCA9IHNjYW5uZXIubWF0Y2goSU5URUdFUl9SRUdFWFApPy5bMF07XG4gIGlmICghbWF0Y2gpIHJldHVybiBmYWlsdXJlKCk7XG4gIHNjYW5uZXIubmV4dChtYXRjaC5sZW5ndGgpO1xuICBjb25zdCB2YWx1ZSA9IG1hdGNoLnJlcGxhY2VBbGwoXCJfXCIsIFwiXCIpO1xuICBjb25zdCBpbnQgPSBwYXJzZUludCh2YWx1ZSwgMTApO1xuICByZXR1cm4gc3VjY2VzcyhpbnQpO1xufVxuY29uc3QgRkxPQVRfUkVHRVhQID0gL1srLV0/KD86MHxbMS05XVswLTldKig/Ol9bMC05XSspKikoPzpcXC5bMC05XSsoPzpfWzAtOV0rKSopPyg/OmVbKy1dP1swLTldKyg/Ol9bMC05XSspKik/XFxiL3lpO1xuZXhwb3J0IGZ1bmN0aW9uIGZsb2F0KHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgY29uc3QgbWF0Y2ggPSBzY2FubmVyLm1hdGNoKEZMT0FUX1JFR0VYUCk/LlswXTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KG1hdGNoLmxlbmd0aCk7XG4gIGNvbnN0IHZhbHVlID0gbWF0Y2gucmVwbGFjZUFsbChcIl9cIiwgXCJcIik7XG4gIGNvbnN0IGZsb2F0ID0gcGFyc2VGbG9hdCh2YWx1ZSk7XG4gIGlmIChpc05hTihmbG9hdCkpIHJldHVybiBmYWlsdXJlKCk7XG4gIHJldHVybiBzdWNjZXNzKGZsb2F0KTtcbn1cbmNvbnN0IERBVEVfVElNRV9SRUdFWFAgPSAvKD88eWVhcj5cXGR7NH0pLSg/PG1vbnRoPlxcZHsyfSktKD88ZGF5PlxcZHsyfSkoPzpbIDAtOVRaLjorLV0rKT9cXGIveTtcbmV4cG9ydCBmdW5jdGlvbiBkYXRlVGltZShzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGNvbnN0IG1hdGNoID0gc2Nhbm5lci5tYXRjaChEQVRFX1RJTUVfUkVHRVhQKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgY29uc3Qgc3RyaW5nID0gbWF0Y2hbMF07XG4gIHNjYW5uZXIubmV4dChzdHJpbmcubGVuZ3RoKTtcbiAgY29uc3QgZ3JvdXBzID0gbWF0Y2guZ3JvdXBzO1xuICAvLyBzcGVjaWFsIGNhc2UgaWYgbW9udGggaXMgRmVicnVhcnlcbiAgaWYgKGdyb3Vwcy5tb250aCA9PSBcIjAyXCIpIHtcbiAgICBjb25zdCBkYXlzID0gcGFyc2VJbnQoZ3JvdXBzLmRheSk7XG4gICAgaWYgKGRheXMgPiAyOSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIGRhdGUgc3RyaW5nIFwiJHttYXRjaH1cImApO1xuICAgIH1cbiAgICBjb25zdCB5ZWFyID0gcGFyc2VJbnQoZ3JvdXBzLnllYXIpO1xuICAgIGlmIChkYXlzID4gMjggJiYgIWlzTGVhcCh5ZWFyKSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIGRhdGUgc3RyaW5nIFwiJHttYXRjaH1cImApO1xuICAgIH1cbiAgfVxuICBjb25zdCBkYXRlID0gbmV3IERhdGUoc3RyaW5nLnRyaW0oKSk7XG4gIC8vIGludmFsaWQgZGF0ZVxuICBpZiAoaXNOYU4oZGF0ZS5nZXRUaW1lKCkpKSB7XG4gICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIGRhdGUgc3RyaW5nIFwiJHttYXRjaH1cImApO1xuICB9XG4gIHJldHVybiBzdWNjZXNzKGRhdGUpO1xufVxuY29uc3QgTE9DQUxfVElNRV9SRUdFWFAgPSAvKFxcZHsyfSk6KFxcZHsyfSk6KFxcZHsyfSkoPzpcXC5bMC05XSspP1xcYi95O1xuZXhwb3J0IGZ1bmN0aW9uIGxvY2FsVGltZShzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGNvbnN0IG1hdGNoID0gc2Nhbm5lci5tYXRjaChMT0NBTF9USU1FX1JFR0VYUCk/LlswXTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KG1hdGNoLmxlbmd0aCk7XG4gIHJldHVybiBzdWNjZXNzKG1hdGNoKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBhcnJheVZhbHVlKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgaWYgKHNjYW5uZXIuY2hhcigpICE9PSBcIltcIikgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KCk7XG4gIGNvbnN0IGFycmF5ID0gW107XG4gIHdoaWxlKCFzY2FubmVyLmVvZigpKXtcbiAgICBzY2FubmVyLm5leHRVbnRpbENoYXIoKTtcbiAgICBjb25zdCByZXN1bHQgPSB2YWx1ZShzY2FubmVyKTtcbiAgICBpZiAoIXJlc3VsdC5vaykgYnJlYWs7XG4gICAgYXJyYXkucHVzaChyZXN1bHQuYm9keSk7XG4gICAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgICAvLyBtYXkgaGF2ZSBhIG5leHQgaXRlbSwgYnV0IHRyYWlsaW5nIGNvbW1hIGlzIGFsbG93ZWQgYXQgYXJyYXlcbiAgICBpZiAoc2Nhbm5lci5jaGFyKCkgIT09IFwiLFwiKSBicmVhaztcbiAgICBzY2FubmVyLm5leHQoKTtcbiAgfVxuICBzY2FubmVyLm5leHRVbnRpbENoYXIoKTtcbiAgaWYgKHNjYW5uZXIuY2hhcigpICE9PSBcIl1cIikgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiQXJyYXkgaXMgbm90IGNsb3NlZFwiKTtcbiAgc2Nhbm5lci5uZXh0KCk7XG4gIHJldHVybiBzdWNjZXNzKGFycmF5KTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBpbmxpbmVUYWJsZShzY2FubmVyKSB7XG4gIHNjYW5uZXIubmV4dFVudGlsQ2hhcigpO1xuICBpZiAoc2Nhbm5lci5jaGFyKDEpID09PSBcIn1cIikge1xuICAgIHNjYW5uZXIubmV4dCgyKTtcbiAgICByZXR1cm4gc3VjY2Vzcyh7XG4gICAgICBfX3Byb3RvX186IG51bGxcbiAgICB9KTtcbiAgfVxuICBjb25zdCBwYWlycyA9IHN1cnJvdW5kKFwie1wiLCBqb2luKHBhaXIsIFwiLFwiKSwgXCJ9XCIpKHNjYW5uZXIpO1xuICBpZiAoIXBhaXJzLm9rKSByZXR1cm4gZmFpbHVyZSgpO1xuICBsZXQgdGFibGUgPSB7XG4gICAgX19wcm90b19fOiBudWxsXG4gIH07XG4gIGZvciAoY29uc3QgcGFpciBvZiBwYWlycy5ib2R5KXtcbiAgICB0YWJsZSA9IGRlZXBNZXJnZSh0YWJsZSwgcGFpcik7XG4gIH1cbiAgcmV0dXJuIHN1Y2Nlc3ModGFibGUpO1xufVxuZXhwb3J0IGNvbnN0IHZhbHVlID0gb3IoW1xuICBtdWx0aWxpbmVCYXNpY1N0cmluZyxcbiAgbXVsdGlsaW5lTGl0ZXJhbFN0cmluZyxcbiAgYmFzaWNTdHJpbmcsXG4gIGxpdGVyYWxTdHJpbmcsXG4gIGJvb2xlYW4sXG4gIGluZmluaXR5LFxuICBuYW4sXG4gIGRhdGVUaW1lLFxuICBsb2NhbFRpbWUsXG4gIGJpbmFyeSxcbiAgb2N0YWwsXG4gIGhleCxcbiAgZmxvYXQsXG4gIGludGVnZXIsXG4gIGFycmF5VmFsdWUsXG4gIGlubGluZVRhYmxlXG5dKTtcbmV4cG9ydCBjb25zdCBwYWlyID0ga3YoZG90dGVkS2V5LCBcIj1cIiwgdmFsdWUpO1xuZXhwb3J0IGZ1bmN0aW9uIGJsb2NrKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5uZXh0VW50aWxDaGFyKCk7XG4gIGNvbnN0IHJlc3VsdCA9IG1lcmdlKHJlcGVhdChwYWlyKSkoc2Nhbm5lcik7XG4gIGlmIChyZXN1bHQub2spIHJldHVybiBzdWNjZXNzKHtcbiAgICB0eXBlOiBcIkJsb2NrXCIsXG4gICAgdmFsdWU6IHJlc3VsdC5ib2R5XG4gIH0pO1xuICByZXR1cm4gZmFpbHVyZSgpO1xufVxuZXhwb3J0IGNvbnN0IHRhYmxlSGVhZGVyID0gc3Vycm91bmQoXCJbXCIsIGRvdHRlZEtleSwgXCJdXCIpO1xuZXhwb3J0IGZ1bmN0aW9uIHRhYmxlKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5uZXh0VW50aWxDaGFyKCk7XG4gIGNvbnN0IGhlYWRlciA9IHRhYmxlSGVhZGVyKHNjYW5uZXIpO1xuICBpZiAoIWhlYWRlci5vaykgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0VW50aWxDaGFyKCk7XG4gIGNvbnN0IGIgPSBibG9jayhzY2FubmVyKTtcbiAgcmV0dXJuIHN1Y2Nlc3Moe1xuICAgIHR5cGU6IFwiVGFibGVcIixcbiAgICBrZXlzOiBoZWFkZXIuYm9keSxcbiAgICB2YWx1ZTogYi5vayA/IGIuYm9keS52YWx1ZSA6IHtcbiAgICAgIF9fcHJvdG9fXzogbnVsbFxuICAgIH1cbiAgfSk7XG59XG5leHBvcnQgY29uc3QgdGFibGVBcnJheUhlYWRlciA9IHN1cnJvdW5kKFwiW1tcIiwgZG90dGVkS2V5LCBcIl1dXCIpO1xuZXhwb3J0IGZ1bmN0aW9uIHRhYmxlQXJyYXkoc2Nhbm5lcikge1xuICBzY2FubmVyLm5leHRVbnRpbENoYXIoKTtcbiAgY29uc3QgaGVhZGVyID0gdGFibGVBcnJheUhlYWRlcihzY2FubmVyKTtcbiAgaWYgKCFoZWFkZXIub2spIHJldHVybiBmYWlsdXJlKCk7XG4gIHNjYW5uZXIubmV4dFVudGlsQ2hhcigpO1xuICBjb25zdCBiID0gYmxvY2soc2Nhbm5lcik7XG4gIHJldHVybiBzdWNjZXNzKHtcbiAgICB0eXBlOiBcIlRhYmxlQXJyYXlcIixcbiAgICBrZXlzOiBoZWFkZXIuYm9keSxcbiAgICB2YWx1ZTogYi5vayA/IGIuYm9keS52YWx1ZSA6IHtcbiAgICAgIF9fcHJvdG9fXzogbnVsbFxuICAgIH1cbiAgfSk7XG59XG5leHBvcnQgZnVuY3Rpb24gdG9tbChzY2FubmVyKSB7XG4gIGNvbnN0IGJsb2NrcyA9IHJlcGVhdChvcihbXG4gICAgYmxvY2ssXG4gICAgdGFibGVBcnJheSxcbiAgICB0YWJsZVxuICBdKSkoc2Nhbm5lcik7XG4gIGlmICghYmxvY2tzLm9rKSByZXR1cm4gc3VjY2Vzcyh7XG4gICAgX19wcm90b19fOiBudWxsXG4gIH0pO1xuICBjb25zdCBib2R5ID0gYmxvY2tzLmJvZHkucmVkdWNlKGRlZXBBc3NpZ24sIHtcbiAgICBfX3Byb3RvX186IG51bGxcbiAgfSk7XG4gIHJldHVybiBzdWNjZXNzKGJvZHkpO1xufVxuZnVuY3Rpb24gY3JlYXRlUGFyc2VFcnJvck1lc3NhZ2Uoc2Nhbm5lciwgbWVzc2FnZSkge1xuICBjb25zdCBzdHJpbmcgPSBzY2FubmVyLnNvdXJjZS5zbGljZSgwLCBzY2FubmVyLnBvc2l0aW9uKTtcbiAgY29uc3QgbGluZXMgPSBzdHJpbmcuc3BsaXQoXCJcXG5cIik7XG4gIGNvbnN0IHJvdyA9IGxpbmVzLmxlbmd0aDtcbiAgY29uc3QgY29sdW1uID0gbGluZXMuYXQoLTEpPy5sZW5ndGggPz8gMDtcbiAgcmV0dXJuIGBQYXJzZSBlcnJvciBvbiBsaW5lICR7cm93fSwgY29sdW1uICR7Y29sdW1ufTogJHttZXNzYWdlfWA7XG59XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VyRmFjdG9yeShwYXJzZXIpIHtcbiAgcmV0dXJuICh0b21sU3RyaW5nKT0+e1xuICAgIGNvbnN0IHNjYW5uZXIgPSBuZXcgU2Nhbm5lcih0b21sU3RyaW5nKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gcGFyc2VyKHNjYW5uZXIpO1xuICAgICAgaWYgKHJlc3VsdC5vayAmJiBzY2FubmVyLmVvZigpKSByZXR1cm4gcmVzdWx0LmJvZHk7XG4gICAgICBjb25zdCBtZXNzYWdlID0gYFVuZXhwZWN0ZWQgY2hhcmFjdGVyOiBcIiR7c2Nhbm5lci5jaGFyKCl9XCJgO1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGNyZWF0ZVBhcnNlRXJyb3JNZXNzYWdlKHNjYW5uZXIsIG1lc3NhZ2UpKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGNyZWF0ZVBhcnNlRXJyb3JNZXNzYWdlKHNjYW5uZXIsIGVycm9yLm1lc3NhZ2UpKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBcIkludmFsaWQgZXJyb3IgdHlwZSBjYXVnaHRcIjtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihjcmVhdGVQYXJzZUVycm9yTWVzc2FnZShzY2FubmVyLCBtZXNzYWdlKSk7XG4gICAgfVxuICB9O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9X3BhcnNlci5qcy5tYXAiLCIvLyBDb3B5cmlnaHQgMjAxOC0yMDI1IHRoZSBEZW5vIGF1dGhvcnMuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuaW1wb3J0IHsgcGFyc2VyRmFjdG9yeSwgdG9tbCB9IGZyb20gXCIuL19wYXJzZXIuanNcIjtcbi8qKlxuICogUGFyc2VzIGEge0BsaW5rIGh0dHBzOi8vdG9tbC5pbyB8IFRPTUx9IHN0cmluZyBpbnRvIGFuIG9iamVjdC5cbiAqXG4gKiBAZXhhbXBsZSBVc2FnZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IHBhcnNlIH0gZnJvbSBcIkBzdGQvdG9tbC9wYXJzZVwiO1xuICogaW1wb3J0IHsgYXNzZXJ0RXF1YWxzIH0gZnJvbSBcIkBzdGQvYXNzZXJ0XCI7XG4gKlxuICogY29uc3QgdG9tbFN0cmluZyA9IGB0aXRsZSA9IFwiVE9NTCBFeGFtcGxlXCJcbiAqIFtvd25lcl1cbiAqIG5hbWUgPSBcIkFsaWNlXCJcbiAqIGJpbyA9IFwiQWxpY2UgaXMgYSBwcm9ncmFtbWVyLlwiYDtcbiAqXG4gKiBjb25zdCBvYmogPSBwYXJzZSh0b21sU3RyaW5nKTtcbiAqIGFzc2VydEVxdWFscyhvYmosIHsgdGl0bGU6IFwiVE9NTCBFeGFtcGxlXCIsIG93bmVyOiB7IG5hbWU6IFwiQWxpY2VcIiwgYmlvOiBcIkFsaWNlIGlzIGEgcHJvZ3JhbW1lci5cIiB9IH0pO1xuICogYGBgXG4gKiBAcGFyYW0gdG9tbFN0cmluZyBUT01MIHN0cmluZyB0byBiZSBwYXJzZWQuXG4gKiBAcmV0dXJucyBUaGUgcGFyc2VkIEpTIG9iamVjdC5cbiAqLyBleHBvcnQgZnVuY3Rpb24gcGFyc2UodG9tbFN0cmluZykge1xuICByZXR1cm4gcGFyc2VyRmFjdG9yeSh0b21sKSh0b21sU3RyaW5nKTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXBhcnNlLmpzLm1hcCIsIi8vIFRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgYnkgY29kZWdlbi9pbmRleC50c1xuLy8gRG8gbm90IGVkaXQgdGhpcyBmaWxlIG1hbnVhbGx5XG5pbXBvcnQgeyBDb21tYW5kLCBPcHRpb24gfSBmcm9tICdjbGlwYW5pb24nXG5pbXBvcnQgKiBhcyB0eXBhbmlvbiBmcm9tICd0eXBhbmlvbidcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VOZXdDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gIHN0YXRpYyBwYXRocyA9IFtbJ25ldyddXVxuXG4gIHN0YXRpYyB1c2FnZSA9IENvbW1hbmQuVXNhZ2Uoe1xuICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRlIGEgbmV3IHByb2plY3Qgd2l0aCBwcmUtY29uZmlndXJlZCBib2lsZXJwbGF0ZScsXG4gIH0pXG5cbiAgJCRwYXRoID0gT3B0aW9uLlN0cmluZyh7IHJlcXVpcmVkOiBmYWxzZSB9KVxuXG4gICQkbmFtZT86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tbmFtZSwtbicsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdUaGUgbmFtZSBvZiB0aGUgcHJvamVjdCwgZGVmYXVsdCB0byB0aGUgbmFtZSBvZiB0aGUgZGlyZWN0b3J5IGlmIG5vdCBwcm92aWRlZCcsXG4gIH0pXG5cbiAgbWluTm9kZUFwaVZlcnNpb24gPSBPcHRpb24uU3RyaW5nKCctLW1pbi1ub2RlLWFwaSwtdicsICc0Jywge1xuICAgIHZhbGlkYXRvcjogdHlwYW5pb24uaXNOdW1iZXIoKSxcbiAgICBkZXNjcmlwdGlvbjogJ1RoZSBtaW5pbXVtIE5vZGUtQVBJIHZlcnNpb24gdG8gc3VwcG9ydCcsXG4gIH0pXG5cbiAgcGFja2FnZU1hbmFnZXIgPSBPcHRpb24uU3RyaW5nKCctLXBhY2thZ2UtbWFuYWdlcicsICd5YXJuJywge1xuICAgIGRlc2NyaXB0aW9uOiAnVGhlIHBhY2thZ2UgbWFuYWdlciB0byB1c2UuIE9ubHkgc3VwcG9ydCB5YXJuIDQueCBmb3Igbm93LicsXG4gIH0pXG5cbiAgbGljZW5zZSA9IE9wdGlvbi5TdHJpbmcoJy0tbGljZW5zZSwtbCcsICdNSVQnLCB7XG4gICAgZGVzY3JpcHRpb246ICdMaWNlbnNlIGZvciBvcGVuLXNvdXJjZWQgcHJvamVjdCcsXG4gIH0pXG5cbiAgdGFyZ2V0cyA9IE9wdGlvbi5BcnJheSgnLS10YXJnZXRzLC10JywgW10sIHtcbiAgICBkZXNjcmlwdGlvbjogJ0FsbCB0YXJnZXRzIHRoZSBjcmF0ZSB3aWxsIGJlIGNvbXBpbGVkIGZvci4nLFxuICB9KVxuXG4gIGVuYWJsZURlZmF1bHRUYXJnZXRzID0gT3B0aW9uLkJvb2xlYW4oJy0tZW5hYmxlLWRlZmF1bHQtdGFyZ2V0cycsIHRydWUsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1doZXRoZXIgZW5hYmxlIGRlZmF1bHQgdGFyZ2V0cycsXG4gIH0pXG5cbiAgZW5hYmxlQWxsVGFyZ2V0cyA9IE9wdGlvbi5Cb29sZWFuKCctLWVuYWJsZS1hbGwtdGFyZ2V0cycsIGZhbHNlLCB7XG4gICAgZGVzY3JpcHRpb246ICdXaGV0aGVyIGVuYWJsZSBhbGwgdGFyZ2V0cycsXG4gIH0pXG5cbiAgZW5hYmxlVHlwZURlZiA9IE9wdGlvbi5Cb29sZWFuKCctLWVuYWJsZS10eXBlLWRlZicsIHRydWUsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdXaGV0aGVyIGVuYWJsZSB0aGUgYHR5cGUtZGVmYCBmZWF0dXJlIGZvciB0eXBlc2NyaXB0IGRlZmluaXRpb25zIGF1dG8tZ2VuZXJhdGlvbicsXG4gIH0pXG5cbiAgZW5hYmxlR2l0aHViQWN0aW9ucyA9IE9wdGlvbi5Cb29sZWFuKCctLWVuYWJsZS1naXRodWItYWN0aW9ucycsIHRydWUsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1doZXRoZXIgZ2VuZXJhdGUgcHJlY29uZmlndXJlZCBHaXRIdWIgQWN0aW9ucyB3b3JrZmxvdycsXG4gIH0pXG5cbiAgdGVzdEZyYW1ld29yayA9IE9wdGlvbi5TdHJpbmcoJy0tdGVzdC1mcmFtZXdvcmsnLCAnYXZhJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1RoZSBKYXZhU2NyaXB0IHRlc3QgZnJhbWV3b3JrIHRvIHVzZSwgb25seSBzdXBwb3J0IGBhdmFgIGZvciBub3cnLFxuICB9KVxuXG4gIGRyeVJ1biA9IE9wdGlvbi5Cb29sZWFuKCctLWRyeS1ydW4nLCBmYWxzZSwge1xuICAgIGRlc2NyaXB0aW9uOiAnV2hldGhlciB0byBydW4gdGhlIGNvbW1hbmQgaW4gZHJ5LXJ1biBtb2RlJyxcbiAgfSlcblxuICBnZXRPcHRpb25zKCkge1xuICAgIHJldHVybiB7XG4gICAgICBwYXRoOiB0aGlzLiQkcGF0aCxcbiAgICAgIG5hbWU6IHRoaXMuJCRuYW1lLFxuICAgICAgbWluTm9kZUFwaVZlcnNpb246IHRoaXMubWluTm9kZUFwaVZlcnNpb24sXG4gICAgICBwYWNrYWdlTWFuYWdlcjogdGhpcy5wYWNrYWdlTWFuYWdlcixcbiAgICAgIGxpY2Vuc2U6IHRoaXMubGljZW5zZSxcbiAgICAgIHRhcmdldHM6IHRoaXMudGFyZ2V0cyxcbiAgICAgIGVuYWJsZURlZmF1bHRUYXJnZXRzOiB0aGlzLmVuYWJsZURlZmF1bHRUYXJnZXRzLFxuICAgICAgZW5hYmxlQWxsVGFyZ2V0czogdGhpcy5lbmFibGVBbGxUYXJnZXRzLFxuICAgICAgZW5hYmxlVHlwZURlZjogdGhpcy5lbmFibGVUeXBlRGVmLFxuICAgICAgZW5hYmxlR2l0aHViQWN0aW9uczogdGhpcy5lbmFibGVHaXRodWJBY3Rpb25zLFxuICAgICAgdGVzdEZyYW1ld29yazogdGhpcy50ZXN0RnJhbWV3b3JrLFxuICAgICAgZHJ5UnVuOiB0aGlzLmRyeVJ1bixcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgcHJvamVjdCB3aXRoIHByZS1jb25maWd1cmVkIGJvaWxlcnBsYXRlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTmV3T3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgcGF0aCB3aGVyZSB0aGUgTkFQSS1SUyBwcm9qZWN0IHdpbGwgYmUgY3JlYXRlZC5cbiAgICovXG4gIHBhdGg/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFRoZSBuYW1lIG9mIHRoZSBwcm9qZWN0LCBkZWZhdWx0IHRvIHRoZSBuYW1lIG9mIHRoZSBkaXJlY3RvcnkgaWYgbm90IHByb3ZpZGVkXG4gICAqL1xuICBuYW1lPzogc3RyaW5nXG4gIC8qKlxuICAgKiBUaGUgbWluaW11bSBOb2RlLUFQSSB2ZXJzaW9uIHRvIHN1cHBvcnRcbiAgICpcbiAgICogQGRlZmF1bHQgNFxuICAgKi9cbiAgbWluTm9kZUFwaVZlcnNpb24/OiBudW1iZXJcbiAgLyoqXG4gICAqIFRoZSBwYWNrYWdlIG1hbmFnZXIgdG8gdXNlLiBPbmx5IHN1cHBvcnQgeWFybiA0LnggZm9yIG5vdy5cbiAgICpcbiAgICogQGRlZmF1bHQgJ3lhcm4nXG4gICAqL1xuICBwYWNrYWdlTWFuYWdlcj86IHN0cmluZ1xuICAvKipcbiAgICogTGljZW5zZSBmb3Igb3Blbi1zb3VyY2VkIHByb2plY3RcbiAgICpcbiAgICogQGRlZmF1bHQgJ01JVCdcbiAgICovXG4gIGxpY2Vuc2U/OiBzdHJpbmdcbiAgLyoqXG4gICAqIEFsbCB0YXJnZXRzIHRoZSBjcmF0ZSB3aWxsIGJlIGNvbXBpbGVkIGZvci5cbiAgICpcbiAgICogQGRlZmF1bHQgW11cbiAgICovXG4gIHRhcmdldHM/OiBzdHJpbmdbXVxuICAvKipcbiAgICogV2hldGhlciBlbmFibGUgZGVmYXVsdCB0YXJnZXRzXG4gICAqXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIGVuYWJsZURlZmF1bHRUYXJnZXRzPzogYm9vbGVhblxuICAvKipcbiAgICogV2hldGhlciBlbmFibGUgYWxsIHRhcmdldHNcbiAgICpcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIGVuYWJsZUFsbFRhcmdldHM/OiBib29sZWFuXG4gIC8qKlxuICAgKiBXaGV0aGVyIGVuYWJsZSB0aGUgYHR5cGUtZGVmYCBmZWF0dXJlIGZvciB0eXBlc2NyaXB0IGRlZmluaXRpb25zIGF1dG8tZ2VuZXJhdGlvblxuICAgKlxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICBlbmFibGVUeXBlRGVmPzogYm9vbGVhblxuICAvKipcbiAgICogV2hldGhlciBnZW5lcmF0ZSBwcmVjb25maWd1cmVkIEdpdEh1YiBBY3Rpb25zIHdvcmtmbG93XG4gICAqXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIGVuYWJsZUdpdGh1YkFjdGlvbnM/OiBib29sZWFuXG4gIC8qKlxuICAgKiBUaGUgSmF2YVNjcmlwdCB0ZXN0IGZyYW1ld29yayB0byB1c2UsIG9ubHkgc3VwcG9ydCBgYXZhYCBmb3Igbm93XG4gICAqXG4gICAqIEBkZWZhdWx0ICdhdmEnXG4gICAqL1xuICB0ZXN0RnJhbWV3b3JrPzogc3RyaW5nXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHJ1biB0aGUgY29tbWFuZCBpbiBkcnktcnVuIG1vZGVcbiAgICpcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIGRyeVJ1bj86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5RGVmYXVsdE5ld09wdGlvbnMob3B0aW9uczogTmV3T3B0aW9ucykge1xuICByZXR1cm4ge1xuICAgIG1pbk5vZGVBcGlWZXJzaW9uOiA0LFxuICAgIHBhY2thZ2VNYW5hZ2VyOiAneWFybicsXG4gICAgbGljZW5zZTogJ01JVCcsXG4gICAgdGFyZ2V0czogW10sXG4gICAgZW5hYmxlRGVmYXVsdFRhcmdldHM6IHRydWUsXG4gICAgZW5hYmxlQWxsVGFyZ2V0czogZmFsc2UsXG4gICAgZW5hYmxlVHlwZURlZjogdHJ1ZSxcbiAgICBlbmFibGVHaXRodWJBY3Rpb25zOiB0cnVlLFxuICAgIHRlc3RGcmFtZXdvcms6ICdhdmEnLFxuICAgIGRyeVJ1bjogZmFsc2UsXG4gICAgLi4ub3B0aW9ucyxcbiAgfVxufVxuIiwiaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gXCJub2RlOm1vZHVsZVwiO1xuaW1wb3J0IHsgaXNBYnNvbHV0ZSwgam9pbiwgcmVzb2x2ZSB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tIFwibm9kZTp1cmxcIjtcbi8qKlxuKiBSZXNvbHZlIGFuIGFic29sdXRlIHBhdGggZnJvbSB7QGxpbmsgcm9vdH0sIGJ1dCBvbmx5XG4qIGlmIHtAbGluayBpbnB1dH0gaXNuJ3QgYWxyZWFkeSBhYnNvbHV0ZS5cbipcbiogQHBhcmFtIGlucHV0IFRoZSBwYXRoIHRvIHJlc29sdmUuXG4qIEBwYXJhbSByb290IFRoZSBiYXNlIHBhdGg7IGRlZmF1bHQgPSBwcm9jZXNzLmN3ZCgpXG4qIEByZXR1cm5zIFRoZSByZXNvbHZlZCBhYnNvbHV0ZSBwYXRoLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBhYnNvbHV0ZShpbnB1dCwgcm9vdCkge1xuXHRyZXR1cm4gaXNBYnNvbHV0ZShpbnB1dCkgPyBpbnB1dCA6IHJlc29sdmUocm9vdCB8fCBcIi5cIiwgaW5wdXQpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGZyb20ocm9vdCwgaWRlbnQsIHNpbGVudCkge1xuXHR0cnkge1xuXHRcdC8vIE5PVEU6IGRpcnMgbmVlZCBhIHRyYWlsaW5nIFwiL1wiIE9SIGZpbGVuYW1lLiBXaXRoIFwiL1wiIHJvdXRlLFxuXHRcdC8vIE5vZGUgYWRkcyBcIm5vb3AuanNcIiBhcyBtYWluIGZpbGUsIHNvIGp1c3QgZG8gXCJub29wLmpzXCIgYW55d2F5LlxuXHRcdGxldCByID0gcm9vdCBpbnN0YW5jZW9mIFVSTCB8fCByb290LnN0YXJ0c1dpdGgoXCJmaWxlOi8vXCIpID8gam9pbihmaWxlVVJMVG9QYXRoKHJvb3QpLCBcIm5vb3AuanNcIikgOiBqb2luKGFic29sdXRlKHJvb3QpLCBcIm5vb3AuanNcIik7XG5cdFx0cmV0dXJuIGNyZWF0ZVJlcXVpcmUocikucmVzb2x2ZShpZGVudCk7XG5cdH0gY2F0Y2ggKGVycikge1xuXHRcdGlmICghc2lsZW50KSB0aHJvdyBlcnI7XG5cdH1cbn1cbmV4cG9ydCBmdW5jdGlvbiBjd2QoaWRlbnQsIHNpbGVudCkge1xuXHRyZXR1cm4gZnJvbShyZXNvbHZlKCksIGlkZW50LCBzaWxlbnQpO1xufVxuIiwiaW1wb3J0IHsgZGlybmFtZSB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IGFic29sdXRlIH0gZnJvbSBcImVtcGF0aGljL3Jlc29sdmVcIjtcbi8qKlxuKiBHZXQgYWxsIHBhcmVudCBkaXJlY3RvcmllcyBvZiB7QGxpbmsgYmFzZX0uXG4qIFN0b3BzIGFmdGVyIHtAbGluayBPcHRpb25zWydsYXN0J119IGlzIHByb2Nlc3NlZC5cbipcbiogQHJldHVybnMgQW4gYXJyYXkgb2YgYWJzb2x1dGUgcGF0aHMgb2YgYWxsIHBhcmVudCBkaXJlY3Rvcmllcy5cbiovXG5leHBvcnQgZnVuY3Rpb24gdXAoYmFzZSwgb3B0aW9ucykge1xuXHRsZXQgeyBsYXN0LCBjd2QgfSA9IG9wdGlvbnMgfHwge307XG5cdGxldCB0bXAgPSBhYnNvbHV0ZShiYXNlLCBjd2QpO1xuXHRsZXQgcm9vdCA9IGFic29sdXRlKGxhc3QgfHwgXCIvXCIsIGN3ZCk7XG5cdGxldCBwcmV2LCBhcnIgPSBbXTtcblx0d2hpbGUgKHByZXYgIT09IHJvb3QpIHtcblx0XHRhcnIucHVzaCh0bXApO1xuXHRcdHRtcCA9IGRpcm5hbWUocHJldiA9IHRtcCk7XG5cdFx0aWYgKHRtcCA9PT0gcHJldikgYnJlYWs7XG5cdH1cblx0cmV0dXJuIGFycjtcbn1cbiIsImltcG9ydCB7IGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBleGlzdHNTeW5jLCBzdGF0U3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgKiBhcyB3YWxrIGZyb20gXCJlbXBhdGhpYy93YWxrXCI7XG4vKipcbiogRmluZCBhbiBpdGVtIGJ5IG5hbWUsIHdhbGtpbmcgcGFyZW50IGRpcmVjdG9yaWVzIHVudGlsIGZvdW5kLlxuKlxuKiBAcGFyYW0gbmFtZSBUaGUgaXRlbSBuYW1lIHRvIGZpbmQuXG4qIEByZXR1cm5zIFRoZSBhYnNvbHV0ZSBwYXRoIHRvIHRoZSBpdGVtLCBpZiBmb3VuZC5cbiovXG5leHBvcnQgZnVuY3Rpb24gdXAobmFtZSwgb3B0aW9ucykge1xuXHRsZXQgZGlyLCB0bXA7XG5cdGxldCBzdGFydCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jd2QgfHwgXCJcIjtcblx0Zm9yIChkaXIgb2Ygd2Fsay51cChzdGFydCwgb3B0aW9ucykpIHtcblx0XHR0bXAgPSBqb2luKGRpciwgbmFtZSk7XG5cdFx0aWYgKGV4aXN0c1N5bmModG1wKSkgcmV0dXJuIHRtcDtcblx0fVxufVxuLyoqXG4qIEdldCB0aGUgZmlyc3QgcGF0aCB0aGF0IG1hdGNoZXMgYW55IG9mIHRoZSBuYW1lcyBwcm92aWRlZC5cbipcbiogPiBbTk9URV1cbiogPiBUaGUgb3JkZXIgb2Yge0BsaW5rIG5hbWVzfSBpcyByZXNwZWN0ZWQuXG4qXG4qIEBwYXJhbSBuYW1lcyBUaGUgaXRlbSBuYW1lcyB0byBmaW5kLlxuKiBAcmV0dXJucyBUaGUgYWJzb2x1dGUgcGF0aCBvZiB0aGUgZmlyc3QgaXRlbSBmb3VuZCwgaWYgYW55LlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBhbnkobmFtZXMsIG9wdGlvbnMpIHtcblx0bGV0IGRpciwgc3RhcnQgPSBvcHRpb25zICYmIG9wdGlvbnMuY3dkIHx8IFwiXCI7XG5cdGxldCBqID0gMCwgbGVuID0gbmFtZXMubGVuZ3RoLCB0bXA7XG5cdGZvciAoZGlyIG9mIHdhbGsudXAoc3RhcnQsIG9wdGlvbnMpKSB7XG5cdFx0Zm9yIChqID0gMDsgaiA8IGxlbjsgaisrKSB7XG5cdFx0XHR0bXAgPSBqb2luKGRpciwgbmFtZXNbal0pO1xuXHRcdFx0aWYgKGV4aXN0c1N5bmModG1wKSkgcmV0dXJuIHRtcDtcblx0XHR9XG5cdH1cbn1cbi8qKlxuKiBGaW5kIGEgZmlsZSBieSBuYW1lLCB3YWxraW5nIHBhcmVudCBkaXJlY3RvcmllcyB1bnRpbCBmb3VuZC5cbipcbiogPiBbTk9URV1cbiogPiBUaGlzIGZ1bmN0aW9uIG9ubHkgcmV0dXJucyBhIHZhbHVlIGZvciBmaWxlIG1hdGNoZXMuXG4qID4gQSBkaXJlY3RvcnkgbWF0Y2ggd2l0aCB0aGUgc2FtZSBuYW1lIHdpbGwgYmUgaWdub3JlZC5cbipcbiogQHBhcmFtIG5hbWUgVGhlIGZpbGUgbmFtZSB0byBmaW5kLlxuKiBAcmV0dXJucyBUaGUgYWJzb2x1dGUgcGF0aCB0byB0aGUgZmlsZSwgaWYgZm91bmQuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbGUobmFtZSwgb3B0aW9ucykge1xuXHRsZXQgZGlyLCB0bXA7XG5cdGxldCBzdGFydCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jd2QgfHwgXCJcIjtcblx0Zm9yIChkaXIgb2Ygd2Fsay51cChzdGFydCwgb3B0aW9ucykpIHtcblx0XHR0cnkge1xuXHRcdFx0dG1wID0gam9pbihkaXIsIG5hbWUpO1xuXHRcdFx0aWYgKHN0YXRTeW5jKHRtcCkuaXNGaWxlKCkpIHJldHVybiB0bXA7XG5cdFx0fSBjYXRjaCB7fVxuXHR9XG59XG4vKipcbiogRmluZCBhIGRpcmVjdG9yeSBieSBuYW1lLCB3YWxraW5nIHBhcmVudCBkaXJlY3RvcmllcyB1bnRpbCBmb3VuZC5cbipcbiogPiBbTk9URV1cbiogPiBUaGlzIGZ1bmN0aW9uIG9ubHkgcmV0dXJucyBhIHZhbHVlIGZvciBkaXJlY3RvcnkgbWF0Y2hlcy5cbiogPiBBIGZpbGUgbWF0Y2ggd2l0aCB0aGUgc2FtZSBuYW1lIHdpbGwgYmUgaWdub3JlZC5cbipcbiogQHBhcmFtIG5hbWUgVGhlIGRpcmVjdG9yeSBuYW1lIHRvIGZpbmQuXG4qIEByZXR1cm5zIFRoZSBhYnNvbHV0ZSBwYXRoIHRvIHRoZSBmaWxlLCBpZiBmb3VuZC5cbiovXG5leHBvcnQgZnVuY3Rpb24gZGlyKG5hbWUsIG9wdGlvbnMpIHtcblx0bGV0IGRpciwgdG1wO1xuXHRsZXQgc3RhcnQgPSBvcHRpb25zICYmIG9wdGlvbnMuY3dkIHx8IFwiXCI7XG5cdGZvciAoZGlyIG9mIHdhbGsudXAoc3RhcnQsIG9wdGlvbnMpKSB7XG5cdFx0dHJ5IHtcblx0XHRcdHRtcCA9IGpvaW4oZGlyLCBuYW1lKTtcblx0XHRcdGlmIChzdGF0U3luYyh0bXApLmlzRGlyZWN0b3J5KCkpIHJldHVybiB0bXA7XG5cdFx0fSBjYXRjaCB7fVxuXHR9XG59XG4iLCIvLyBUaGlzIGZpbGUgaXMgZ2VuZXJhdGVkIGJ5IGNvZGVnZW4vaW5kZXgudHNcbi8vIERvIG5vdCBlZGl0IHRoaXMgZmlsZSBtYW51YWxseVxuaW1wb3J0IHsgQ29tbWFuZCwgT3B0aW9uIH0gZnJvbSAnY2xpcGFuaW9uJ1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZVJlbmFtZUNvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcbiAgc3RhdGljIHBhdGhzID0gW1sncmVuYW1lJ11dXG5cbiAgc3RhdGljIHVzYWdlID0gQ29tbWFuZC5Vc2FnZSh7XG4gICAgZGVzY3JpcHRpb246ICdSZW5hbWUgdGhlIE5BUEktUlMgcHJvamVjdCcsXG4gIH0pXG5cbiAgY3dkID0gT3B0aW9uLlN0cmluZygnLS1jd2QnLCBwcm9jZXNzLmN3ZCgpLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoJyxcbiAgfSlcblxuICBjb25maWdQYXRoPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1jb25maWctcGF0aCwtYycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGUnLFxuICB9KVxuXG4gIHBhY2thZ2VKc29uUGF0aCA9IE9wdGlvbi5TdHJpbmcoJy0tcGFja2FnZS1qc29uLXBhdGgnLCAncGFja2FnZS5qc29uJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgcGFja2FnZS5qc29uYCcsXG4gIH0pXG5cbiAgbnBtRGlyID0gT3B0aW9uLlN0cmluZygnLS1ucG0tZGlyJywgJ25wbScsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gdGhlIGZvbGRlciB3aGVyZSB0aGUgbnBtIHBhY2thZ2VzIHB1dCcsXG4gIH0pXG5cbiAgJCRuYW1lPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1uYW1lLC1uJywge1xuICAgIGRlc2NyaXB0aW9uOiAnVGhlIG5ldyBuYW1lIG9mIHRoZSBwcm9qZWN0JyxcbiAgfSlcblxuICBiaW5hcnlOYW1lPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1iaW5hcnktbmFtZSwtYicsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1RoZSBuZXcgYmluYXJ5IG5hbWUgKi5ub2RlIGZpbGVzJyxcbiAgfSlcblxuICBwYWNrYWdlTmFtZT86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tcGFja2FnZS1uYW1lJywge1xuICAgIGRlc2NyaXB0aW9uOiAnVGhlIG5ldyBwYWNrYWdlIG5hbWUgb2YgdGhlIHByb2plY3QnLFxuICB9KVxuXG4gIG1hbmlmZXN0UGF0aCA9IE9wdGlvbi5TdHJpbmcoJy0tbWFuaWZlc3QtcGF0aCcsICdDYXJnby50b21sJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgQ2FyZ28udG9tbGAnLFxuICB9KVxuXG4gIHJlcG9zaXRvcnk/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLXJlcG9zaXRvcnknLCB7XG4gICAgZGVzY3JpcHRpb246ICdUaGUgbmV3IHJlcG9zaXRvcnkgb2YgdGhlIHByb2plY3QnLFxuICB9KVxuXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1kZXNjcmlwdGlvbicsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1RoZSBuZXcgZGVzY3JpcHRpb24gb2YgdGhlIHByb2plY3QnLFxuICB9KVxuXG4gIGdldE9wdGlvbnMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGN3ZDogdGhpcy5jd2QsXG4gICAgICBjb25maWdQYXRoOiB0aGlzLmNvbmZpZ1BhdGgsXG4gICAgICBwYWNrYWdlSnNvblBhdGg6IHRoaXMucGFja2FnZUpzb25QYXRoLFxuICAgICAgbnBtRGlyOiB0aGlzLm5wbURpcixcbiAgICAgIG5hbWU6IHRoaXMuJCRuYW1lLFxuICAgICAgYmluYXJ5TmFtZTogdGhpcy5iaW5hcnlOYW1lLFxuICAgICAgcGFja2FnZU5hbWU6IHRoaXMucGFja2FnZU5hbWUsXG4gICAgICBtYW5pZmVzdFBhdGg6IHRoaXMubWFuaWZlc3RQYXRoLFxuICAgICAgcmVwb3NpdG9yeTogdGhpcy5yZXBvc2l0b3J5LFxuICAgICAgZGVzY3JpcHRpb246IHRoaXMuZGVzY3JpcHRpb24sXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogUmVuYW1lIHRoZSBOQVBJLVJTIHByb2plY3RcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBSZW5hbWVPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aFxuICAgKlxuICAgKiBAZGVmYXVsdCBwcm9jZXNzLmN3ZCgpXG4gICAqL1xuICBjd2Q/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICovXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gYHBhY2thZ2UuanNvbmBcbiAgICpcbiAgICogQGRlZmF1bHQgJ3BhY2thZ2UuanNvbidcbiAgICovXG4gIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0XG4gICAqXG4gICAqIEBkZWZhdWx0ICducG0nXG4gICAqL1xuICBucG1EaXI/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFRoZSBuZXcgbmFtZSBvZiB0aGUgcHJvamVjdFxuICAgKi9cbiAgbmFtZT86IHN0cmluZ1xuICAvKipcbiAgICogVGhlIG5ldyBiaW5hcnkgbmFtZSAqLm5vZGUgZmlsZXNcbiAgICovXG4gIGJpbmFyeU5hbWU/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFRoZSBuZXcgcGFja2FnZSBuYW1lIG9mIHRoZSBwcm9qZWN0XG4gICAqL1xuICBwYWNrYWdlTmFtZT86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgQ2FyZ28udG9tbGBcbiAgICpcbiAgICogQGRlZmF1bHQgJ0NhcmdvLnRvbWwnXG4gICAqL1xuICBtYW5pZmVzdFBhdGg/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFRoZSBuZXcgcmVwb3NpdG9yeSBvZiB0aGUgcHJvamVjdFxuICAgKi9cbiAgcmVwb3NpdG9yeT86IHN0cmluZ1xuICAvKipcbiAgICogVGhlIG5ldyBkZXNjcmlwdGlvbiBvZiB0aGUgcHJvamVjdFxuICAgKi9cbiAgZGVzY3JpcHRpb24/OiBzdHJpbmdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5RGVmYXVsdFJlbmFtZU9wdGlvbnMob3B0aW9uczogUmVuYW1lT3B0aW9ucykge1xuICByZXR1cm4ge1xuICAgIGN3ZDogcHJvY2Vzcy5jd2QoKSxcbiAgICBwYWNrYWdlSnNvblBhdGg6ICdwYWNrYWdlLmpzb24nLFxuICAgIG5wbURpcjogJ25wbScsXG4gICAgbWFuaWZlc3RQYXRoOiAnQ2FyZ28udG9tbCcsXG4gICAgLi4ub3B0aW9ucyxcbiAgfVxufVxuIiwiaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gJ25vZGU6ZnMnXG5pbXBvcnQgeyByZW5hbWUgfSBmcm9tICdub2RlOmZzL3Byb21pc2VzJ1xuaW1wb3J0IHsgcmVzb2x2ZSwgam9pbiB9IGZyb20gJ25vZGU6cGF0aCdcblxuaW1wb3J0IHsgcGFyc2UgYXMgcGFyc2VUb21sLCBzdHJpbmdpZnkgYXMgc3RyaW5naWZ5VG9tbCB9IGZyb20gJ0BzdGQvdG9tbCdcbmltcG9ydCB7IGxvYWQgYXMgeWFtbFBhcnNlLCBkdW1wIGFzIHlhbWxTdHJpbmdpZnkgfSBmcm9tICdqcy15YW1sJ1xuaW1wb3J0IHsgaXNOaWwsIG1lcmdlLCBvbWl0QnksIHBpY2sgfSBmcm9tICdlcy10b29sa2l0J1xuaW1wb3J0ICogYXMgZmluZCBmcm9tICdlbXBhdGhpYy9maW5kJ1xuXG5pbXBvcnQgeyBhcHBseURlZmF1bHRSZW5hbWVPcHRpb25zLCB0eXBlIFJlbmFtZU9wdGlvbnMgfSBmcm9tICcuLi9kZWYvcmVuYW1lLmpzJ1xuaW1wb3J0IHsgcmVhZENvbmZpZywgcmVhZEZpbGVBc3luYywgd3JpdGVGaWxlQXN5bmMgfSBmcm9tICcuLi91dGlscy9pbmRleC5qcydcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlbmFtZVByb2plY3QodXNlck9wdGlvbnM6IFJlbmFtZU9wdGlvbnMpIHtcbiAgY29uc3Qgb3B0aW9ucyA9IGFwcGx5RGVmYXVsdFJlbmFtZU9wdGlvbnModXNlck9wdGlvbnMpXG4gIGNvbnN0IG5hcGlDb25maWcgPSBhd2FpdCByZWFkQ29uZmlnKG9wdGlvbnMpXG4gIGNvbnN0IG9sZE5hbWUgPSBuYXBpQ29uZmlnLmJpbmFyeU5hbWVcblxuICBjb25zdCBwYWNrYWdlSnNvblBhdGggPSByZXNvbHZlKG9wdGlvbnMuY3dkLCBvcHRpb25zLnBhY2thZ2VKc29uUGF0aClcbiAgY29uc3QgY2FyZ29Ub21sUGF0aCA9IHJlc29sdmUob3B0aW9ucy5jd2QsIG9wdGlvbnMubWFuaWZlc3RQYXRoKVxuXG4gIGNvbnN0IHBhY2thZ2VKc29uQ29udGVudCA9IGF3YWl0IHJlYWRGaWxlQXN5bmMocGFja2FnZUpzb25QYXRoLCAndXRmOCcpXG4gIGNvbnN0IHBhY2thZ2VKc29uRGF0YSA9IEpTT04ucGFyc2UocGFja2FnZUpzb25Db250ZW50KVxuXG4gIG1lcmdlKFxuICAgIG1lcmdlKFxuICAgICAgcGFja2FnZUpzb25EYXRhLFxuICAgICAgb21pdEJ5KFxuICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIG1pc3NpbmcgZmllbGRzOiBhdXRob3IgYW5kIGxpY2Vuc2VcbiAgICAgICAgcGljayhvcHRpb25zLCBbJ25hbWUnLCAnZGVzY3JpcHRpb24nLCAnYXV0aG9yJywgJ2xpY2Vuc2UnXSksXG4gICAgICAgIGlzTmlsLFxuICAgICAgKSxcbiAgICApLFxuICAgIHtcbiAgICAgIG5hcGk6IG9taXRCeShcbiAgICAgICAge1xuICAgICAgICAgIGJpbmFyeU5hbWU6IG9wdGlvbnMuYmluYXJ5TmFtZSxcbiAgICAgICAgICBwYWNrYWdlTmFtZTogb3B0aW9ucy5wYWNrYWdlTmFtZSxcbiAgICAgICAgfSxcbiAgICAgICAgaXNOaWwsXG4gICAgICApLFxuICAgIH0sXG4gIClcblxuICBpZiAob3B0aW9ucy5yZXBvc2l0b3J5KSB7XG4gICAgaWYgKFxuICAgICAgcGFja2FnZUpzb25EYXRhLnJlcG9zaXRvcnkgJiZcbiAgICAgIHR5cGVvZiBwYWNrYWdlSnNvbkRhdGEucmVwb3NpdG9yeSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICFBcnJheS5pc0FycmF5KHBhY2thZ2VKc29uRGF0YS5yZXBvc2l0b3J5KVxuICAgICkge1xuICAgICAgcGFja2FnZUpzb25EYXRhLnJlcG9zaXRvcnkudXJsID0gb3B0aW9ucy5yZXBvc2l0b3J5XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhY2thZ2VKc29uRGF0YS5yZXBvc2l0b3J5ID0gb3B0aW9ucy5yZXBvc2l0b3J5XG4gICAgfVxuICB9XG5cbiAgaWYgKG9wdGlvbnMuY29uZmlnUGF0aCkge1xuICAgIGNvbnN0IGNvbmZpZ1BhdGggPSByZXNvbHZlKG9wdGlvbnMuY3dkLCBvcHRpb25zLmNvbmZpZ1BhdGgpXG4gICAgY29uc3QgY29uZmlnQ29udGVudCA9IGF3YWl0IHJlYWRGaWxlQXN5bmMoY29uZmlnUGF0aCwgJ3V0ZjgnKVxuICAgIGNvbnN0IGNvbmZpZ0RhdGEgPSBKU09OLnBhcnNlKGNvbmZpZ0NvbnRlbnQpXG4gICAgbWVyZ2UoXG4gICAgICBjb25maWdEYXRhLFxuICAgICAgb21pdEJ5KFxuICAgICAgICB7XG4gICAgICAgICAgYmluYXJ5TmFtZTogb3B0aW9ucy5iaW5hcnlOYW1lLFxuICAgICAgICAgIHBhY2thZ2VOYW1lOiBvcHRpb25zLnBhY2thZ2VOYW1lLFxuICAgICAgICB9LFxuICAgICAgICBpc05pbCxcbiAgICAgICksXG4gICAgKVxuICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKGNvbmZpZ1BhdGgsIEpTT04uc3RyaW5naWZ5KGNvbmZpZ0RhdGEsIG51bGwsIDIpKVxuICB9XG5cbiAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoXG4gICAgcGFja2FnZUpzb25QYXRoLFxuICAgIEpTT04uc3RyaW5naWZ5KHBhY2thZ2VKc29uRGF0YSwgbnVsbCwgMiksXG4gIClcblxuICBjb25zdCB0b21sQ29udGVudCA9IGF3YWl0IHJlYWRGaWxlQXN5bmMoY2FyZ29Ub21sUGF0aCwgJ3V0ZjgnKVxuICBjb25zdCBjYXJnb1RvbWwgPSBwYXJzZVRvbWwodG9tbENvbnRlbnQpIGFzIGFueVxuXG4gIC8vIFVwZGF0ZSB0aGUgcGFja2FnZSBuYW1lXG4gIGlmIChjYXJnb1RvbWwucGFja2FnZSAmJiBvcHRpb25zLmJpbmFyeU5hbWUpIHtcbiAgICAvLyBTYW5pdGl6ZSB0aGUgYmluYXJ5IG5hbWUgZm9yIFJ1c3QgcGFja2FnZSBuYW1pbmcgY29udmVudGlvbnNcbiAgICBjb25zdCBzYW5pdGl6ZWROYW1lID0gb3B0aW9ucy5iaW5hcnlOYW1lXG4gICAgICAucmVwbGFjZSgnQCcsICcnKVxuICAgICAgLnJlcGxhY2UoJy8nLCAnXycpXG4gICAgICAucmVwbGFjZSgvLS9nLCAnXycpXG4gICAgICAudG9Mb3dlckNhc2UoKVxuICAgIGNhcmdvVG9tbC5wYWNrYWdlLm5hbWUgPSBzYW5pdGl6ZWROYW1lXG4gIH1cblxuICAvLyBTdHJpbmdpZnkgdGhlIHVwZGF0ZWQgVE9NTFxuICBjb25zdCB1cGRhdGVkVG9tbENvbnRlbnQgPSBzdHJpbmdpZnlUb21sKGNhcmdvVG9tbClcblxuICBhd2FpdCB3cml0ZUZpbGVBc3luYyhjYXJnb1RvbWxQYXRoLCB1cGRhdGVkVG9tbENvbnRlbnQpXG4gIGlmIChvcHRpb25zLmJpbmFyeU5hbWUgJiYgb2xkTmFtZSAhPT0gb3B0aW9ucy5iaW5hcnlOYW1lKSB7XG4gICAgY29uc3QgZ2l0aHViQWN0aW9uc1BhdGggPSBmaW5kLmRpcignLmdpdGh1YicsIHtcbiAgICAgIGN3ZDogb3B0aW9ucy5jd2QsXG4gICAgfSlcbiAgICBpZiAoZ2l0aHViQWN0aW9uc1BhdGgpIHtcbiAgICAgIGNvbnN0IGdpdGh1YkFjdGlvbnNDSVltbFBhdGggPSBqb2luKFxuICAgICAgICBnaXRodWJBY3Rpb25zUGF0aCxcbiAgICAgICAgJ3dvcmtmbG93cycsXG4gICAgICAgICdDSS55bWwnLFxuICAgICAgKVxuICAgICAgaWYgKGV4aXN0c1N5bmMoZ2l0aHViQWN0aW9uc0NJWW1sUGF0aCkpIHtcbiAgICAgICAgY29uc3QgZ2l0aHViQWN0aW9uc0NvbnRlbnQgPSBhd2FpdCByZWFkRmlsZUFzeW5jKFxuICAgICAgICAgIGdpdGh1YkFjdGlvbnNDSVltbFBhdGgsXG4gICAgICAgICAgJ3V0ZjgnLFxuICAgICAgICApXG4gICAgICAgIGNvbnN0IGdpdGh1YkFjdGlvbnNEYXRhID0geWFtbFBhcnNlKGdpdGh1YkFjdGlvbnNDb250ZW50KSBhcyBhbnlcbiAgICAgICAgaWYgKGdpdGh1YkFjdGlvbnNEYXRhLmVudj8uQVBQX05BTUUpIHtcbiAgICAgICAgICBnaXRodWJBY3Rpb25zRGF0YS5lbnYuQVBQX05BTUUgPSBvcHRpb25zLmJpbmFyeU5hbWVcbiAgICAgICAgICBhd2FpdCB3cml0ZUZpbGVBc3luYyhcbiAgICAgICAgICAgIGdpdGh1YkFjdGlvbnNDSVltbFBhdGgsXG4gICAgICAgICAgICB5YW1sU3RyaW5naWZ5KGdpdGh1YkFjdGlvbnNEYXRhLCB7XG4gICAgICAgICAgICAgIGxpbmVXaWR0aDogLTEsXG4gICAgICAgICAgICAgIG5vUmVmczogdHJ1ZSxcbiAgICAgICAgICAgICAgc29ydEtleXM6IGZhbHNlLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IG9sZFdhc2lCcm93c2VyQmluZGluZ1BhdGggPSBqb2luKFxuICAgICAgb3B0aW9ucy5jd2QsXG4gICAgICBgJHtvbGROYW1lfS53YXNpLWJyb3dzZXIuanNgLFxuICAgIClcbiAgICBpZiAoZXhpc3RzU3luYyhvbGRXYXNpQnJvd3NlckJpbmRpbmdQYXRoKSkge1xuICAgICAgYXdhaXQgcmVuYW1lKFxuICAgICAgICBvbGRXYXNpQnJvd3NlckJpbmRpbmdQYXRoLFxuICAgICAgICBqb2luKG9wdGlvbnMuY3dkLCBgJHtvcHRpb25zLmJpbmFyeU5hbWV9Lndhc2ktYnJvd3Nlci5qc2ApLFxuICAgICAgKVxuICAgIH1cbiAgICBjb25zdCBvbGRXYXNpQmluZGluZ1BhdGggPSBqb2luKG9wdGlvbnMuY3dkLCBgJHtvbGROYW1lfS53YXNpLmNqc2ApXG4gICAgaWYgKGV4aXN0c1N5bmMob2xkV2FzaUJpbmRpbmdQYXRoKSkge1xuICAgICAgYXdhaXQgcmVuYW1lKFxuICAgICAgICBvbGRXYXNpQmluZGluZ1BhdGgsXG4gICAgICAgIGpvaW4ob3B0aW9ucy5jd2QsIGAke29wdGlvbnMuYmluYXJ5TmFtZX0ud2FzaS5janNgKSxcbiAgICAgIClcbiAgICB9XG4gICAgY29uc3QgZ2l0QXR0cmlidXRlc1BhdGggPSBqb2luKG9wdGlvbnMuY3dkLCAnLmdpdGF0dHJpYnV0ZXMnKVxuICAgIGlmIChleGlzdHNTeW5jKGdpdEF0dHJpYnV0ZXNQYXRoKSkge1xuICAgICAgY29uc3QgZ2l0QXR0cmlidXRlc0NvbnRlbnQgPSBhd2FpdCByZWFkRmlsZUFzeW5jKFxuICAgICAgICBnaXRBdHRyaWJ1dGVzUGF0aCxcbiAgICAgICAgJ3V0ZjgnLFxuICAgICAgKVxuICAgICAgY29uc3QgZ2l0QXR0cmlidXRlc0RhdGEgPSBnaXRBdHRyaWJ1dGVzQ29udGVudFxuICAgICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAgIC5tYXAoKGxpbmUpID0+IHtcbiAgICAgICAgICByZXR1cm4gbGluZVxuICAgICAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgICAgIGAke29sZE5hbWV9Lndhc2ktYnJvd3Nlci5qc2AsXG4gICAgICAgICAgICAgIGAke29wdGlvbnMuYmluYXJ5TmFtZX0ud2FzaS1icm93c2VyLmpzYCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5yZXBsYWNlKGAke29sZE5hbWV9Lndhc2kuY2pzYCwgYCR7b3B0aW9ucy5iaW5hcnlOYW1lfS53YXNpLmNqc2ApXG4gICAgICAgIH0pXG4gICAgICAgIC5qb2luKCdcXG4nKVxuICAgICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoZ2l0QXR0cmlidXRlc1BhdGgsIGdpdEF0dHJpYnV0ZXNEYXRhKVxuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgZXhlYywgZXhlY1N5bmMgfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBleGlzdHNTeW5jIH0gZnJvbSAnbm9kZTpmcydcbmltcG9ydCB7IGhvbWVkaXIgfSBmcm9tICdub2RlOm9zJ1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xuaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdub2RlOmZzJ1xuXG5pbXBvcnQgeyBwYXJzZSBhcyBwYXJzZVRvbWwsIHN0cmluZ2lmeSBhcyBzdHJpbmdpZnlUb21sIH0gZnJvbSAnQHN0ZC90b21sJ1xuaW1wb3J0IHsgbG9hZCBhcyB5YW1sTG9hZCwgZHVtcCBhcyB5YW1sRHVtcCB9IGZyb20gJ2pzLXlhbWwnXG5cbmltcG9ydCB7XG4gIGFwcGx5RGVmYXVsdE5ld09wdGlvbnMsXG4gIHR5cGUgTmV3T3B0aW9ucyBhcyBSYXdOZXdPcHRpb25zLFxufSBmcm9tICcuLi9kZWYvbmV3LmpzJ1xuaW1wb3J0IHtcbiAgQVZBSUxBQkxFX1RBUkdFVFMsXG4gIGRlYnVnRmFjdG9yeSxcbiAgREVGQVVMVF9UQVJHRVRTLFxuICBta2RpckFzeW5jLFxuICBwYXJzZVRyaXBsZSxcbiAgcmVhZGRpckFzeW5jLFxuICBzdGF0QXN5bmMsXG4gIHR5cGUgU3VwcG9ydGVkUGFja2FnZU1hbmFnZXIsXG59IGZyb20gJy4uL3V0aWxzL2luZGV4LmpzJ1xuaW1wb3J0IHtcbiAgbmFwaUVuZ2luZVJlcXVpcmVtZW50LFxuICBTVVBQT1JURURfTkFQSV9WRVJTSU9OUyxcbn0gZnJvbSAnLi4vdXRpbHMvdmVyc2lvbi5qcydcbmltcG9ydCB7IHJlbmFtZVByb2plY3QgfSBmcm9tICcuL3JlbmFtZS5qcydcblxuLy8gVGVtcGxhdGUgaW1wb3J0cyByZW1vdmVkIGFzIHdlJ3JlIG5vdyB1c2luZyBleHRlcm5hbCB0ZW1wbGF0ZXNcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ25ldycpXG5cbnR5cGUgTmV3T3B0aW9ucyA9IFJlcXVpcmVkPFJhd05ld09wdGlvbnM+XG5cbmNvbnN0IFRFTVBMQVRFX1JFUE9TID0ge1xuICB5YXJuOiAnaHR0cHM6Ly9naXRodWIuY29tL25hcGktcnMvcGFja2FnZS10ZW1wbGF0ZScsXG4gIHBucG06ICdodHRwczovL2dpdGh1Yi5jb20vbmFwaS1ycy9wYWNrYWdlLXRlbXBsYXRlLXBucG0nLFxufSBhcyBjb25zdFxuXG5jb25zdCBXQVNJX1RBUkdFVCA9ICd3YXNtMzItd2FzaXAxLXRocmVhZHMnXG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrR2l0Q29tbWFuZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KChyZXNvbHZlKSA9PiB7XG4gICAgY29uc3QgY3AgPSBleGVjKCdnaXQgLS12ZXJzaW9uJylcbiAgICBjcC5vbignZXJyb3InLCAoKSA9PiB7XG4gICAgICByZXNvbHZlKGZhbHNlKVxuICAgIH0pXG4gICAgY3Aub24oJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgcmVzb2x2ZShjb2RlID09PSAwKVxuICAgIH0pXG4gIH0pXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZUNhY2hlRGlyKFxuICBwYWNrYWdlTWFuYWdlcjogU3VwcG9ydGVkUGFja2FnZU1hbmFnZXIsXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICBjb25zdCBjYWNoZURpciA9IHBhdGguam9pbihob21lZGlyKCksICcubmFwaS1ycycsICd0ZW1wbGF0ZScsIHBhY2thZ2VNYW5hZ2VyKVxuICBhd2FpdCBta2RpckFzeW5jKGNhY2hlRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KVxuICByZXR1cm4gY2FjaGVEaXJcbn1cblxuYXN5bmMgZnVuY3Rpb24gZG93bmxvYWRUZW1wbGF0ZShcbiAgcGFja2FnZU1hbmFnZXI6IFN1cHBvcnRlZFBhY2thZ2VNYW5hZ2VyLFxuICBjYWNoZURpcjogc3RyaW5nLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHJlcG9VcmwgPSBURU1QTEFURV9SRVBPU1twYWNrYWdlTWFuYWdlcl1cbiAgY29uc3QgdGVtcGxhdGVQYXRoID0gcGF0aC5qb2luKGNhY2hlRGlyLCAncmVwbycpXG5cbiAgaWYgKGV4aXN0c1N5bmModGVtcGxhdGVQYXRoKSkge1xuICAgIGRlYnVnKGBUZW1wbGF0ZSBjYWNoZSBmb3VuZCBhdCAke3RlbXBsYXRlUGF0aH0sIHVwZGF0aW5nLi4uYClcbiAgICB0cnkge1xuICAgICAgLy8gRmV0Y2ggbGF0ZXN0IGNoYW5nZXMgYW5kIHJlc2V0IHRvIHJlbW90ZVxuICAgICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCBjcCA9IGV4ZWMoJ2dpdCBmZXRjaCBvcmlnaW4nLCB7IGN3ZDogdGVtcGxhdGVQYXRoIH0pXG4gICAgICAgIGNwLm9uKCdlcnJvcicsIHJlamVjdClcbiAgICAgICAgY3Aub24oJ2V4aXQnLCAoY29kZSkgPT4ge1xuICAgICAgICAgIGlmIChjb2RlID09PSAwKSB7XG4gICAgICAgICAgICByZXNvbHZlKClcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KFxuICAgICAgICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYEZhaWxlZCB0byBmZXRjaCBsYXRlc3QgY2hhbmdlcywgZ2l0IHByb2Nlc3MgZXhpdGVkIHdpdGggY29kZSAke2NvZGV9YCxcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9KVxuICAgICAgZXhlY1N5bmMoJ2dpdCByZXNldCAtLWhhcmQgb3JpZ2luL21haW4nLCB7XG4gICAgICAgIGN3ZDogdGVtcGxhdGVQYXRoLFxuICAgICAgICBzdGRpbzogJ2lnbm9yZScsXG4gICAgICB9KVxuICAgICAgZGVidWcoJ1RlbXBsYXRlIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5JylcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgZGVidWcoYEZhaWxlZCB0byB1cGRhdGUgdGVtcGxhdGU6ICR7ZXJyb3J9YClcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSB0ZW1wbGF0ZSBmcm9tICR7cmVwb1VybH06ICR7ZXJyb3J9YClcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZGVidWcoYENsb25pbmcgdGVtcGxhdGUgZnJvbSAke3JlcG9Vcmx9Li4uYClcbiAgICB0cnkge1xuICAgICAgZXhlY1N5bmMoYGdpdCBjbG9uZSAke3JlcG9Vcmx9IHJlcG9gLCB7IGN3ZDogY2FjaGVEaXIsIHN0ZGlvOiAnaW5oZXJpdCcgfSlcbiAgICAgIGRlYnVnKCdUZW1wbGF0ZSBjbG9uZWQgc3VjY2Vzc2Z1bGx5JylcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gY2xvbmUgdGVtcGxhdGUgZnJvbSAke3JlcG9Vcmx9OiAke2Vycm9yfWApXG4gICAgfVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvcHlEaXJlY3RvcnkoXG4gIHNyYzogc3RyaW5nLFxuICBkZXN0OiBzdHJpbmcsXG4gIGluY2x1ZGVXYXNpQmluZGluZ3M6IGJvb2xlYW4sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgYXdhaXQgbWtkaXJBc3luYyhkZXN0LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KVxuICBjb25zdCBlbnRyaWVzID0gYXdhaXQgZnMucmVhZGRpcihzcmMsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuXG4gIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgIGNvbnN0IHNyY1BhdGggPSBwYXRoLmpvaW4oc3JjLCBlbnRyeS5uYW1lKVxuICAgIGNvbnN0IGRlc3RQYXRoID0gcGF0aC5qb2luKGRlc3QsIGVudHJ5Lm5hbWUpXG5cbiAgICAvLyBTa2lwIC5naXQgZGlyZWN0b3J5XG4gICAgaWYgKGVudHJ5Lm5hbWUgPT09ICcuZ2l0Jykge1xuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgYXdhaXQgY29weURpcmVjdG9yeShzcmNQYXRoLCBkZXN0UGF0aCwgaW5jbHVkZVdhc2lCaW5kaW5ncylcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKFxuICAgICAgICAhaW5jbHVkZVdhc2lCaW5kaW5ncyAmJlxuICAgICAgICAoZW50cnkubmFtZS5lbmRzV2l0aCgnLndhc2ktYnJvd3Nlci5qcycpIHx8XG4gICAgICAgICAgZW50cnkubmFtZS5lbmRzV2l0aCgnLndhc2kuY2pzJykgfHxcbiAgICAgICAgICBlbnRyeS5uYW1lLmVuZHNXaXRoKCd3YXNpLXdvcmtlci1icm93c2VyLm1qcycpIHx8XG4gICAgICAgICAgZW50cnkubmFtZS5lbmRzV2l0aCgnd2FzaS13b3JrZXIubWpzJykgfHxcbiAgICAgICAgICBlbnRyeS5uYW1lID09PSAnYnJvd3Nlci5qcycpXG4gICAgICApIHtcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cbiAgICAgIGF3YWl0IGZzLmNvcHlGaWxlKHNyY1BhdGgsIGRlc3RQYXRoKVxuICAgIH1cbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBmaWx0ZXJUYXJnZXRzSW5QYWNrYWdlSnNvbihcbiAgZmlsZVBhdGg6IHN0cmluZyxcbiAgZW5hYmxlZFRhcmdldHM6IHN0cmluZ1tdLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShmaWxlUGF0aCwgJ3V0Zi04JylcbiAgY29uc3QgcGFja2FnZUpzb24gPSBKU09OLnBhcnNlKGNvbnRlbnQpXG4gIGNvbnN0IGluY2x1ZGVXYXNpQmluZGluZ3MgPSBlbmFibGVkVGFyZ2V0cy5pbmNsdWRlcyhXQVNJX1RBUkdFVClcblxuICAvLyBGaWx0ZXIgbmFwaS50YXJnZXRzXG4gIGlmIChwYWNrYWdlSnNvbi5uYXBpPy50YXJnZXRzKSB7XG4gICAgcGFja2FnZUpzb24ubmFwaS50YXJnZXRzID0gcGFja2FnZUpzb24ubmFwaS50YXJnZXRzLmZpbHRlcihcbiAgICAgICh0YXJnZXQ6IHN0cmluZykgPT4gZW5hYmxlZFRhcmdldHMuaW5jbHVkZXModGFyZ2V0KSxcbiAgICApXG4gIH1cblxuICBpZiAoIWluY2x1ZGVXYXNpQmluZGluZ3MpIHtcbiAgICBpZiAoXG4gICAgICBwYWNrYWdlSnNvbi5icm93c2VyID09PSAnYnJvd3Nlci5qcycgfHxcbiAgICAgIHBhY2thZ2VKc29uLmJyb3dzZXIgPT09ICcuL2Jyb3dzZXIuanMnXG4gICAgKSB7XG4gICAgICBkZWxldGUgcGFja2FnZUpzb24uYnJvd3NlclxuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KHBhY2thZ2VKc29uLmZpbGVzKSkge1xuICAgICAgcGFja2FnZUpzb24uZmlsZXMgPSBwYWNrYWdlSnNvbi5maWxlcy5maWx0ZXIoXG4gICAgICAgIChmaWxlOiB1bmtub3duKSA9PiBmaWxlICE9PSAnYnJvd3Nlci5qcycgJiYgZmlsZSAhPT0gJy4vYnJvd3Nlci5qcycsXG4gICAgICApXG4gICAgfVxuICB9XG5cbiAgYXdhaXQgZnMud3JpdGVGaWxlKGZpbGVQYXRoLCBKU09OLnN0cmluZ2lmeShwYWNrYWdlSnNvbiwgbnVsbCwgMikgKyAnXFxuJylcbn1cblxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlQ2FyZ29Ub21sVHlwZURlZihcbiAgZmlsZVBhdGg6IHN0cmluZyxcbiAgZW5hYmxlVHlwZURlZjogYm9vbGVhbixcbik6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoZW5hYmxlVHlwZURlZikge1xuICAgIHJldHVyblxuICB9XG5cbiAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGVQYXRoLCAndXRmLTgnKVxuICBjb25zdCBjYXJnb1RvbWwgPSBwYXJzZVRvbWwoY29udGVudCkgYXMgUmVjb3JkPHN0cmluZywgYW55PlxuICBjb25zdCBkZXBlbmRlbmNpZXMgPSBjYXJnb1RvbWwuZGVwZW5kZW5jaWVzXG5cbiAgaWYgKCFkZXBlbmRlbmNpZXMgfHwgIWRlcGVuZGVuY2llc1snbmFwaS1kZXJpdmUnXSkge1xuICAgIHJldHVyblxuICB9XG5cbiAgY29uc3QgbmFwaURlcml2ZURlcGVuZGVuY3kgPSBkZXBlbmRlbmNpZXNbJ25hcGktZGVyaXZlJ11cbiAgY29uc3QgZGVwZW5kZW5jeUNvbmZpZyA9XG4gICAgdHlwZW9mIG5hcGlEZXJpdmVEZXBlbmRlbmN5ID09PSAnc3RyaW5nJ1xuICAgICAgPyB7IHZlcnNpb246IG5hcGlEZXJpdmVEZXBlbmRlbmN5IH1cbiAgICAgIDogeyAuLi5uYXBpRGVyaXZlRGVwZW5kZW5jeSB9XG5cbiAgY29uc3QgZXhpc3RpbmdGZWF0dXJlczogc3RyaW5nW10gPSBBcnJheS5pc0FycmF5KGRlcGVuZGVuY3lDb25maWcuZmVhdHVyZXMpXG4gICAgPyBkZXBlbmRlbmN5Q29uZmlnLmZlYXR1cmVzLmZpbHRlcihcbiAgICAgICAgKGZlYXR1cmU6IHVua25vd24pOiBmZWF0dXJlIGlzIHN0cmluZyA9PiB0eXBlb2YgZmVhdHVyZSA9PT0gJ3N0cmluZycsXG4gICAgICApXG4gICAgOiBbXVxuXG4gIGRlcGVuZGVuY3lDb25maWdbJ2RlZmF1bHQtZmVhdHVyZXMnXSA9IGZhbHNlXG4gIGRlcGVuZGVuY3lDb25maWcuZmVhdHVyZXMgPSBbXG4gICAgJ3N0cmljdCcsXG4gICAgLi4uZXhpc3RpbmdGZWF0dXJlcy5maWx0ZXIoKGZlYXR1cmUpID0+IGZlYXR1cmUgIT09ICdzdHJpY3QnKSxcbiAgXS5maWx0ZXIoKGZlYXR1cmUpID0+IGZlYXR1cmUgIT09ICd0eXBlLWRlZicpXG5cbiAgZGVwZW5kZW5jaWVzWyduYXBpLWRlcml2ZSddID0gZGVwZW5kZW5jeUNvbmZpZ1xuXG4gIGF3YWl0IGZzLndyaXRlRmlsZShmaWxlUGF0aCwgc3RyaW5naWZ5VG9tbChjYXJnb1RvbWwpKVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlQ2FyZ29Ub21sTm9kZUFwaVZlcnNpb24oXG4gIGZpbGVQYXRoOiBzdHJpbmcsXG4gIG1pbk5vZGVBcGlWZXJzaW9uOiBudW1iZXIsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGVQYXRoLCAndXRmLTgnKVxuICBjb25zdCBjYXJnb1RvbWwgPSBwYXJzZVRvbWwoY29udGVudCkgYXMgUmVjb3JkPHN0cmluZywgYW55PlxuICBjb25zdCBkZXBlbmRlbmNpZXMgPSBjYXJnb1RvbWwuZGVwZW5kZW5jaWVzXG5cbiAgaWYgKCFkZXBlbmRlbmNpZXMgfHwgIWRlcGVuZGVuY2llcy5uYXBpKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBjb25zdCBuYXBpRGVwZW5kZW5jeSA9IGRlcGVuZGVuY2llcy5uYXBpXG4gIGNvbnN0IGRlcGVuZGVuY3lDb25maWcgPVxuICAgIHR5cGVvZiBuYXBpRGVwZW5kZW5jeSA9PT0gJ3N0cmluZydcbiAgICAgID8geyB2ZXJzaW9uOiBuYXBpRGVwZW5kZW5jeSB9XG4gICAgICA6IHsgLi4ubmFwaURlcGVuZGVuY3kgfVxuICBjb25zdCB1c2VkRGVmYXVsdEZlYXR1cmVzID0gZGVwZW5kZW5jeUNvbmZpZ1snZGVmYXVsdC1mZWF0dXJlcyddICE9PSBmYWxzZVxuICBjb25zdCBleGlzdGluZ0ZlYXR1cmVzOiBzdHJpbmdbXSA9IEFycmF5LmlzQXJyYXkoZGVwZW5kZW5jeUNvbmZpZy5mZWF0dXJlcylcbiAgICA/IGRlcGVuZGVuY3lDb25maWcuZmVhdHVyZXMuZmlsdGVyKFxuICAgICAgICAoZmVhdHVyZTogdW5rbm93bik6IGZlYXR1cmUgaXMgc3RyaW5nID0+IHR5cGVvZiBmZWF0dXJlID09PSAnc3RyaW5nJyxcbiAgICAgIClcbiAgICA6IFtdXG5cbiAgZGVwZW5kZW5jeUNvbmZpZy5mZWF0dXJlcyA9IFtcbiAgICBgbmFwaSR7bWluTm9kZUFwaVZlcnNpb259YCxcbiAgICAuLi5leGlzdGluZ0ZlYXR1cmVzLmZpbHRlcigoZmVhdHVyZSkgPT4gIS9ebmFwaVxcZCskLy50ZXN0KGZlYXR1cmUpKSxcbiAgXVxuXG4gIC8vIG5hcGkncyBkZWZhdWx0IGZlYXR1cmVzIGluY2x1ZGUgbmFwaTQuIERpc2FibGUgdGhlbSBmb3IgbG93ZXIgcmVxdWVzdGVkXG4gIC8vIGxldmVscywgd2hpbGUgcmV0YWluaW5nIHRoZSBkZWZhdWx0IGR5bmFtaWMgTm9kZS1BUEkgc3ltYm9sIGxvYWRpbmcgbW9kZS5cbiAgaWYgKG1pbk5vZGVBcGlWZXJzaW9uIDwgNCkge1xuICAgIGRlcGVuZGVuY3lDb25maWdbJ2RlZmF1bHQtZmVhdHVyZXMnXSA9IGZhbHNlXG4gICAgaWYgKFxuICAgICAgdXNlZERlZmF1bHRGZWF0dXJlcyAmJlxuICAgICAgIWRlcGVuZGVuY3lDb25maWcuZmVhdHVyZXMuaW5jbHVkZXMoJ2R5bi1zeW1ib2xzJylcbiAgICApIHtcbiAgICAgIGRlcGVuZGVuY3lDb25maWcuZmVhdHVyZXMucHVzaCgnZHluLXN5bWJvbHMnKVxuICAgIH1cbiAgfVxuXG4gIGRlcGVuZGVuY2llcy5uYXBpID0gZGVwZW5kZW5jeUNvbmZpZ1xuXG4gIGF3YWl0IGZzLndyaXRlRmlsZShmaWxlUGF0aCwgc3RyaW5naWZ5VG9tbChjYXJnb1RvbWwpKVxufVxuXG5hc3luYyBmdW5jdGlvbiBmaWx0ZXJUYXJnZXRzSW5HaXRodWJBY3Rpb25zKFxuICBmaWxlUGF0aDogc3RyaW5nLFxuICBlbmFibGVkVGFyZ2V0czogc3RyaW5nW10sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGVQYXRoLCAndXRmLTgnKVxuICBjb25zdCB5YW1sID0geWFtbExvYWQoY29udGVudCkgYXMgYW55XG5cbiAgY29uc3QgbGludXhUYXJnZXRzID0gbmV3IFNldChbXG4gICAgJ3g4Nl82NC11bmtub3duLWxpbnV4LWdudScsXG4gICAgJ3g4Nl82NC11bmtub3duLWxpbnV4LW11c2wnLFxuICAgICdhYXJjaDY0LXVua25vd24tbGludXgtZ251JyxcbiAgICAnYWFyY2g2NC11bmtub3duLWxpbnV4LW11c2wnLFxuICAgICdhcm12Ny11bmtub3duLWxpbnV4LWdudWVhYmloZicsXG4gICAgJ2FybXY3LXVua25vd24tbGludXgtbXVzbGVhYmloZicsXG4gICAgJ2xvb25nYXJjaDY0LXVua25vd24tbGludXgtZ251JyxcbiAgICAncmlzY3Y2NGdjLXVua25vd24tbGludXgtZ251JyxcbiAgICAncG93ZXJwYzY0bGUtdW5rbm93bi1saW51eC1nbnUnLFxuICAgICdzMzkweC11bmtub3duLWxpbnV4LWdudScsXG4gICAgJ2FhcmNoNjQtbGludXgtYW5kcm9pZCcsXG4gICAgJ2FybXY3LWxpbnV4LWFuZHJvaWRlYWJpJyxcbiAgXSlcblxuICAvLyBDaGVjayBpZiBhbnkgTGludXggdGFyZ2V0cyBhcmUgZW5hYmxlZFxuICBjb25zdCBoYXNMaW51eFRhcmdldHMgPSBlbmFibGVkVGFyZ2V0cy5zb21lKCh0YXJnZXQpID0+XG4gICAgbGludXhUYXJnZXRzLmhhcyh0YXJnZXQpLFxuICApXG4gIGNvbnN0IGhhc01hY09TT3JXaW5kb3dzVGFyZ2V0cyA9IGVuYWJsZWRUYXJnZXRzLnNvbWUoKHRhcmdldCkgPT4ge1xuICAgIGNvbnN0IHBsYXRmb3JtID0gcGFyc2VUcmlwbGUodGFyZ2V0KS5wbGF0Zm9ybVxuICAgIHJldHVybiBwbGF0Zm9ybSA9PT0gJ2RhcndpbicgfHwgcGxhdGZvcm0gPT09ICd3aW4zMidcbiAgfSlcblxuICAvLyBGaWx0ZXIgdGhlIG1hdHJpeCBjb25maWd1cmF0aW9ucyBpbiB0aGUgYnVpbGQgam9iXG4gIGlmICh5YW1sPy5qb2JzPy5idWlsZD8uc3RyYXRlZ3k/Lm1hdHJpeD8uc2V0dGluZ3MpIHtcbiAgICB5YW1sLmpvYnMuYnVpbGQuc3RyYXRlZ3kubWF0cml4LnNldHRpbmdzID1cbiAgICAgIHlhbWwuam9icy5idWlsZC5zdHJhdGVneS5tYXRyaXguc2V0dGluZ3MuZmlsdGVyKChzZXR0aW5nOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKHNldHRpbmcudGFyZ2V0KSB7XG4gICAgICAgICAgcmV0dXJuIGVuYWJsZWRUYXJnZXRzLmluY2x1ZGVzKHNldHRpbmcudGFyZ2V0KVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9KVxuICB9XG5cbiAgY29uc3Qgam9ic1RvUmVtb3ZlOiBzdHJpbmdbXSA9IFtdXG5cbiAgaWYgKCFoYXNNYWNPU09yV2luZG93c1RhcmdldHMpIHtcbiAgICBqb2JzVG9SZW1vdmUucHVzaCgndGVzdC1tYWNPUy13aW5kb3dzLWJpbmRpbmcnKVxuICB9IGVsc2Uge1xuICAgIC8vIEZpbHRlciB0aGUgbWF0cml4IGNvbmZpZ3VyYXRpb25zIGluIHRoZSB0ZXN0LW1hY09TLXdpbmRvd3MtYmluZGluZyBqb2JcbiAgICBpZiAoXG4gICAgICB5YW1sPy5qb2JzPy5bJ3Rlc3QtbWFjT1Mtd2luZG93cy1iaW5kaW5nJ10/LnN0cmF0ZWd5Py5tYXRyaXg/LnNldHRpbmdzXG4gICAgKSB7XG4gICAgICB5YW1sLmpvYnNbJ3Rlc3QtbWFjT1Mtd2luZG93cy1iaW5kaW5nJ10uc3RyYXRlZ3kubWF0cml4LnNldHRpbmdzID1cbiAgICAgICAgeWFtbC5qb2JzWyd0ZXN0LW1hY09TLXdpbmRvd3MtYmluZGluZyddLnN0cmF0ZWd5Lm1hdHJpeC5zZXR0aW5ncy5maWx0ZXIoXG4gICAgICAgICAgKHNldHRpbmc6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNldHRpbmcudGFyZ2V0KSB7XG4gICAgICAgICAgICAgIHJldHVybiBlbmFibGVkVGFyZ2V0cy5pbmNsdWRlcyhzZXR0aW5nLnRhcmdldClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgICAgfSxcbiAgICAgICAgKVxuICAgIH1cbiAgfVxuXG4gIC8vIElmIG5vIExpbnV4IHRhcmdldHMgYXJlIGVuYWJsZWQsIHJlbW92ZSBMaW51eC1zcGVjaWZpYyBqb2JzXG4gIGlmICghaGFzTGludXhUYXJnZXRzKSB7XG4gICAgLy8gUmVtb3ZlIHRlc3QtbGludXgtYmluZGluZyBqb2JcbiAgICBpZiAoeWFtbD8uam9icz8uWyd0ZXN0LWxpbnV4LWJpbmRpbmcnXSkge1xuICAgICAgam9ic1RvUmVtb3ZlLnB1c2goJ3Rlc3QtbGludXgtYmluZGluZycpXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIEZpbHRlciB0aGUgbWF0cml4IGNvbmZpZ3VyYXRpb25zIGluIHRoZSB0ZXN0LWxpbnV4LXg2NC1nbnUtYmluZGluZyBqb2JcbiAgICBpZiAoeWFtbD8uam9icz8uWyd0ZXN0LWxpbnV4LWJpbmRpbmcnXT8uc3RyYXRlZ3k/Lm1hdHJpeD8udGFyZ2V0KSB7XG4gICAgICB5YW1sLmpvYnNbJ3Rlc3QtbGludXgtYmluZGluZyddLnN0cmF0ZWd5Lm1hdHJpeC50YXJnZXQgPSB5YW1sLmpvYnNbXG4gICAgICAgICd0ZXN0LWxpbnV4LWJpbmRpbmcnXG4gICAgICBdLnN0cmF0ZWd5Lm1hdHJpeC50YXJnZXQuZmlsdGVyKCh0YXJnZXQ6IHN0cmluZykgPT4ge1xuICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgcmV0dXJuIGVuYWJsZWRUYXJnZXRzLmluY2x1ZGVzKHRhcmdldClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfSlcbiAgICB9XG4gIH1cblxuICBpZiAoIWVuYWJsZWRUYXJnZXRzLmluY2x1ZGVzKFdBU0lfVEFSR0VUKSkge1xuICAgIGpvYnNUb1JlbW92ZS5wdXNoKCd0ZXN0LXdhc2knKVxuICB9XG5cbiAgaWYgKCFlbmFibGVkVGFyZ2V0cy5pbmNsdWRlcygneDg2XzY0LXVua25vd24tZnJlZWJzZCcpKSB7XG4gICAgam9ic1RvUmVtb3ZlLnB1c2goJ2J1aWxkLWZyZWVic2QnKVxuICB9XG5cbiAgLy8gRmlsdGVyIG90aGVyIHRlc3Qgam9icyBiYXNlZCBvbiB0YXJnZXRcbiAgZm9yIChjb25zdCBbam9iTmFtZSwgam9iQ29uZmlnXSBvZiBPYmplY3QuZW50cmllcyh5YW1sLmpvYnMgfHwge30pKSB7XG4gICAgaWYgKFxuICAgICAgam9iTmFtZS5zdGFydHNXaXRoKCd0ZXN0LScpICYmXG4gICAgICBqb2JOYW1lICE9PSAndGVzdC1tYWNPUy13aW5kb3dzLWJpbmRpbmcnICYmXG4gICAgICBqb2JOYW1lICE9PSAndGVzdC1saW51eC14NjQtZ251LWJpbmRpbmcnXG4gICAgKSB7XG4gICAgICAvLyBFeHRyYWN0IHRhcmdldCBmcm9tIGpvYiBuYW1lIG9yIGNvbmZpZ1xuICAgICAgY29uc3Qgam9iID0gam9iQ29uZmlnIGFzIGFueVxuICAgICAgaWYgKGpvYi5zdHJhdGVneT8ubWF0cml4Py5zZXR0aW5ncz8uWzBdPy50YXJnZXQpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gam9iLnN0cmF0ZWd5Lm1hdHJpeC5zZXR0aW5nc1swXS50YXJnZXRcbiAgICAgICAgaWYgKCFlbmFibGVkVGFyZ2V0cy5pbmNsdWRlcyh0YXJnZXQpKSB7XG4gICAgICAgICAgam9ic1RvUmVtb3ZlLnB1c2goam9iTmFtZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFJlbW92ZSBqb2JzIGZvciBkaXNhYmxlZCB0YXJnZXRzXG4gIGZvciAoY29uc3Qgam9iTmFtZSBvZiBqb2JzVG9SZW1vdmUpIHtcbiAgICBkZWxldGUgeWFtbC5qb2JzW2pvYk5hbWVdXG4gIH1cblxuICBpZiAoQXJyYXkuaXNBcnJheSh5YW1sLmpvYnM/LnB1Ymxpc2g/Lm5lZWRzKSkge1xuICAgIHlhbWwuam9icy5wdWJsaXNoLm5lZWRzID0geWFtbC5qb2JzLnB1Ymxpc2gubmVlZHMuZmlsdGVyKFxuICAgICAgKG5lZWQ6IHN0cmluZykgPT4gIWpvYnNUb1JlbW92ZS5pbmNsdWRlcyhuZWVkKSxcbiAgICApXG4gIH1cblxuICAvLyBXcml0ZSBiYWNrIHRoZSBmaWx0ZXJlZCBZQU1MXG4gIGNvbnN0IHVwZGF0ZWRZYW1sID0geWFtbER1bXAoeWFtbCwge1xuICAgIGxpbmVXaWR0aDogLTEsXG4gICAgbm9SZWZzOiB0cnVlLFxuICAgIHNvcnRLZXlzOiBmYWxzZSxcbiAgfSlcbiAgYXdhaXQgZnMud3JpdGVGaWxlKGZpbGVQYXRoLCB1cGRhdGVkWWFtbClcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc09wdGlvbnMob3B0aW9uczogUmF3TmV3T3B0aW9ucykge1xuICBkZWJ1ZygnUHJvY2Vzc2luZyBvcHRpb25zLi4uJylcbiAgY29uc3QgbWluTm9kZUFwaVZlcnNpb24gPSBvcHRpb25zLm1pbk5vZGVBcGlWZXJzaW9uID8/IDRcbiAgaWYgKFxuICAgICFOdW1iZXIuaXNJbnRlZ2VyKG1pbk5vZGVBcGlWZXJzaW9uKSB8fFxuICAgICFTVVBQT1JURURfTkFQSV9WRVJTSU9OUy5zb21lKCh2ZXJzaW9uKSA9PiB2ZXJzaW9uID09PSBtaW5Ob2RlQXBpVmVyc2lvbilcbiAgKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXG4gICAgICBgVW5zdXBwb3J0ZWQgTm9kZS1BUEkgdmVyc2lvbiAke21pbk5vZGVBcGlWZXJzaW9ufS4gRXhwZWN0ZWQgb25lIG9mOiAke1NVUFBPUlRFRF9OQVBJX1ZFUlNJT05TLmpvaW4oJywgJyl9YCxcbiAgICApXG4gIH1cbiAgb3B0aW9ucy5taW5Ob2RlQXBpVmVyc2lvbiA9IG1pbk5vZGVBcGlWZXJzaW9uXG5cbiAgaWYgKCFvcHRpb25zLnBhdGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBwcm92aWRlIHRoZSBwYXRoIGFzIHRoZSBhcmd1bWVudCcpXG4gIH1cbiAgb3B0aW9ucy5wYXRoID0gcGF0aC5yZXNvbHZlKHByb2Nlc3MuY3dkKCksIG9wdGlvbnMucGF0aClcbiAgZGVidWcoYFJlc29sdmVkIHRhcmdldCBwYXRoIHRvOiAke29wdGlvbnMucGF0aH1gKVxuXG4gIGlmICghb3B0aW9ucy5uYW1lKSB7XG4gICAgb3B0aW9ucy5uYW1lID0gcGF0aC5wYXJzZShvcHRpb25zLnBhdGgpLmJhc2VcbiAgICBkZWJ1ZyhgTm8gcHJvamVjdCBuYW1lIHByb3ZpZGVkLCBmaXggaXQgdG8gZGlyIG5hbWU6ICR7b3B0aW9ucy5uYW1lfWApXG4gIH1cblxuICBpZiAoIW9wdGlvbnMudGFyZ2V0cz8ubGVuZ3RoKSB7XG4gICAgaWYgKG9wdGlvbnMuZW5hYmxlQWxsVGFyZ2V0cykge1xuICAgICAgb3B0aW9ucy50YXJnZXRzID0gQVZBSUxBQkxFX1RBUkdFVFMuY29uY2F0KClcbiAgICAgIGRlYnVnKCdFbmFibGUgYWxsIHRhcmdldHMnKVxuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5lbmFibGVEZWZhdWx0VGFyZ2V0cykge1xuICAgICAgb3B0aW9ucy50YXJnZXRzID0gREVGQVVMVF9UQVJHRVRTLmNvbmNhdCgpXG4gICAgICBkZWJ1ZygnRW5hYmxlIGRlZmF1bHQgdGFyZ2V0cycpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQXQgbGVhc3Qgb25lIHRhcmdldCBtdXN0IGJlIGVuYWJsZWQnKVxuICAgIH1cbiAgfVxuICBpZiAoXG4gICAgb3B0aW9ucy50YXJnZXRzLnNvbWUoKHRhcmdldCkgPT4gdGFyZ2V0ID09PSAnd2FzbTMyLXdhc2ktcHJldmlldzEtdGhyZWFkcycpXG4gICkge1xuICAgIGNvbnN0IG91dCA9IGV4ZWNTeW5jKGBydXN0dXAgdGFyZ2V0IGxpc3RgLCB7XG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgIH0pXG4gICAgaWYgKG91dC5pbmNsdWRlcyhXQVNJX1RBUkdFVCkpIHtcbiAgICAgIG9wdGlvbnMudGFyZ2V0cyA9IG9wdGlvbnMudGFyZ2V0cy5tYXAoKHRhcmdldCkgPT5cbiAgICAgICAgdGFyZ2V0ID09PSAnd2FzbTMyLXdhc2ktcHJldmlldzEtdGhyZWFkcycgPyBXQVNJX1RBUkdFVCA6IHRhcmdldCxcbiAgICAgIClcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXBwbHlEZWZhdWx0TmV3T3B0aW9ucyhvcHRpb25zKSBhcyBOZXdPcHRpb25zXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBuZXdQcm9qZWN0KHVzZXJPcHRpb25zOiBSYXdOZXdPcHRpb25zKSB7XG4gIGRlYnVnKCdXaWxsIGNyZWF0ZSBuYXBpLXJzIHByb2plY3Qgd2l0aCBnaXZlbiBvcHRpb25zOicpXG4gIGRlYnVnKHVzZXJPcHRpb25zKVxuXG4gIGNvbnN0IG9wdGlvbnMgPSBwcm9jZXNzT3B0aW9ucyh1c2VyT3B0aW9ucylcblxuICBkZWJ1ZygnVGFyZ2V0cyB0byBiZSBlbmFibGVkOicpXG4gIGRlYnVnKG9wdGlvbnMudGFyZ2V0cylcblxuICAvLyBDaGVjayBpZiBnaXQgaXMgYXZhaWxhYmxlXG4gIGlmICghKGF3YWl0IGNoZWNrR2l0Q29tbWFuZCgpKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdHaXQgaXMgbm90IGluc3RhbGxlZCBvciBub3QgYXZhaWxhYmxlIGluIFBBVEguIFBsZWFzZSBpbnN0YWxsIEdpdCB0byBjb250aW51ZS4nLFxuICAgIClcbiAgfVxuXG4gIGNvbnN0IHBhY2thZ2VNYW5hZ2VyID0gb3B0aW9ucy5wYWNrYWdlTWFuYWdlciBhcyBTdXBwb3J0ZWRQYWNrYWdlTWFuYWdlclxuXG4gIC8vIEVuc3VyZSB0YXJnZXQgZGlyZWN0b3J5IGV4aXN0cyBhbmQgaXMgZW1wdHlcbiAgYXdhaXQgZW5zdXJlUGF0aChvcHRpb25zLnBhdGgsIG9wdGlvbnMuZHJ5UnVuKVxuXG4gIGlmICghb3B0aW9ucy5kcnlSdW4pIHtcbiAgICB0cnkge1xuICAgICAgLy8gRG93bmxvYWQgb3IgdXBkYXRlIHRlbXBsYXRlXG4gICAgICBjb25zdCBjYWNoZURpciA9IGF3YWl0IGVuc3VyZUNhY2hlRGlyKHBhY2thZ2VNYW5hZ2VyKVxuICAgICAgYXdhaXQgZG93bmxvYWRUZW1wbGF0ZShwYWNrYWdlTWFuYWdlciwgY2FjaGVEaXIpXG5cbiAgICAgIC8vIENvcHkgdGVtcGxhdGUgZmlsZXMgdG8gdGFyZ2V0IGRpcmVjdG9yeVxuICAgICAgY29uc3QgdGVtcGxhdGVQYXRoID0gcGF0aC5qb2luKGNhY2hlRGlyLCAncmVwbycpXG4gICAgICBhd2FpdCBjb3B5RGlyZWN0b3J5KFxuICAgICAgICB0ZW1wbGF0ZVBhdGgsXG4gICAgICAgIG9wdGlvbnMucGF0aCxcbiAgICAgICAgb3B0aW9ucy50YXJnZXRzLmluY2x1ZGVzKFdBU0lfVEFSR0VUKSxcbiAgICAgIClcblxuICAgICAgLy8gUmVuYW1lIHByb2plY3QgdXNpbmcgdGhlIHJlbmFtZSBBUElcbiAgICAgIGF3YWl0IHJlbmFtZVByb2plY3Qoe1xuICAgICAgICBjd2Q6IG9wdGlvbnMucGF0aCxcbiAgICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgICBiaW5hcnlOYW1lOiBnZXRCaW5hcnlOYW1lKG9wdGlvbnMubmFtZSksXG4gICAgICB9KVxuXG4gICAgICBjb25zdCBjYXJnb1RvbWxQYXRoID0gcGF0aC5qb2luKG9wdGlvbnMucGF0aCwgJ0NhcmdvLnRvbWwnKVxuICAgICAgaWYgKGV4aXN0c1N5bmMoY2FyZ29Ub21sUGF0aCkpIHtcbiAgICAgICAgYXdhaXQgdXBkYXRlQ2FyZ29Ub21sVHlwZURlZihjYXJnb1RvbWxQYXRoLCBvcHRpb25zLmVuYWJsZVR5cGVEZWYpXG4gICAgICAgIGF3YWl0IHVwZGF0ZUNhcmdvVG9tbE5vZGVBcGlWZXJzaW9uKFxuICAgICAgICAgIGNhcmdvVG9tbFBhdGgsXG4gICAgICAgICAgb3B0aW9ucy5taW5Ob2RlQXBpVmVyc2lvbixcbiAgICAgICAgKVxuICAgICAgfVxuXG4gICAgICAvLyBGaWx0ZXIgdGFyZ2V0cyBpbiBwYWNrYWdlLmpzb25cbiAgICAgIGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IHBhdGguam9pbihvcHRpb25zLnBhdGgsICdwYWNrYWdlLmpzb24nKVxuICAgICAgaWYgKGV4aXN0c1N5bmMocGFja2FnZUpzb25QYXRoKSkge1xuICAgICAgICBhd2FpdCBmaWx0ZXJUYXJnZXRzSW5QYWNrYWdlSnNvbihwYWNrYWdlSnNvblBhdGgsIG9wdGlvbnMudGFyZ2V0cylcbiAgICAgIH1cblxuICAgICAgLy8gRmlsdGVyIHRhcmdldHMgaW4gR2l0SHViIEFjdGlvbnMgQ0lcbiAgICAgIGNvbnN0IGNpUGF0aCA9IHBhdGguam9pbihvcHRpb25zLnBhdGgsICcuZ2l0aHViJywgJ3dvcmtmbG93cycsICdDSS55bWwnKVxuICAgICAgaWYgKGV4aXN0c1N5bmMoY2lQYXRoKSAmJiBvcHRpb25zLmVuYWJsZUdpdGh1YkFjdGlvbnMpIHtcbiAgICAgICAgYXdhaXQgZmlsdGVyVGFyZ2V0c0luR2l0aHViQWN0aW9ucyhjaVBhdGgsIG9wdGlvbnMudGFyZ2V0cylcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICFvcHRpb25zLmVuYWJsZUdpdGh1YkFjdGlvbnMgJiZcbiAgICAgICAgZXhpc3RzU3luYyhwYXRoLmpvaW4ob3B0aW9ucy5wYXRoLCAnLmdpdGh1YicpKVxuICAgICAgKSB7XG4gICAgICAgIC8vIFJlbW92ZSAuZ2l0aHViIGRpcmVjdG9yeSBpZiBHaXRIdWIgQWN0aW9ucyBpcyBub3QgZW5hYmxlZFxuICAgICAgICBhd2FpdCBmcy5ybShwYXRoLmpvaW4ob3B0aW9ucy5wYXRoLCAnLmdpdGh1YicpLCB7XG4gICAgICAgICAgcmVjdXJzaXZlOiB0cnVlLFxuICAgICAgICAgIGZvcmNlOiB0cnVlLFxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgcGFja2FnZS5qc29uIHdpdGggYWRkaXRpb25hbCBjb25maWd1cmF0aW9uc1xuICAgICAgY29uc3QgcGtnSnNvbkNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShwYWNrYWdlSnNvblBhdGgsICd1dGYtOCcpXG4gICAgICBjb25zdCBwa2dKc29uID0gSlNPTi5wYXJzZShwa2dKc29uQ29udGVudClcblxuICAgICAgLy8gVXBkYXRlIGVuZ2luZSByZXF1aXJlbWVudFxuICAgICAgaWYgKCFwa2dKc29uLmVuZ2luZXMpIHtcbiAgICAgICAgcGtnSnNvbi5lbmdpbmVzID0ge31cbiAgICAgIH1cbiAgICAgIHBrZ0pzb24uZW5naW5lcy5ub2RlID0gbmFwaUVuZ2luZVJlcXVpcmVtZW50KG9wdGlvbnMubWluTm9kZUFwaVZlcnNpb24pXG5cbiAgICAgIC8vIFVwZGF0ZSBsaWNlbnNlIGlmIGRpZmZlcmVudCBmcm9tIHRlbXBsYXRlXG4gICAgICBpZiAob3B0aW9ucy5saWNlbnNlICYmIHBrZ0pzb24ubGljZW5zZSAhPT0gb3B0aW9ucy5saWNlbnNlKSB7XG4gICAgICAgIHBrZ0pzb24ubGljZW5zZSA9IG9wdGlvbnMubGljZW5zZVxuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgdGVzdCBmcmFtZXdvcmsgaWYgbmVlZGVkXG4gICAgICBpZiAob3B0aW9ucy50ZXN0RnJhbWV3b3JrICE9PSAnYXZhJykge1xuICAgICAgICAvLyBUaGlzIHdvdWxkIHJlcXVpcmUgbW9yZSBjb21wbGV4IGxvZ2ljIHRvIHVwZGF0ZSB0ZXN0IHNjcmlwdHMgYW5kIGRlcGVuZGVuY2llc1xuICAgICAgICBkZWJ1ZyhcbiAgICAgICAgICBgVGVzdCBmcmFtZXdvcmsgJHtvcHRpb25zLnRlc3RGcmFtZXdvcmt9IHJlcXVlc3RlZCBidXQgbm90IHlldCBpbXBsZW1lbnRlZGAsXG4gICAgICAgIClcbiAgICAgIH1cblxuICAgICAgYXdhaXQgZnMud3JpdGVGaWxlKFxuICAgICAgICBwYWNrYWdlSnNvblBhdGgsXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHBrZ0pzb24sIG51bGwsIDIpICsgJ1xcbicsXG4gICAgICApXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSBwcm9qZWN0OiAke2Vycm9yfWApXG4gICAgfVxuICB9XG5cbiAgZGVidWcoYFByb2plY3QgY3JlYXRlZCBhdDogJHtvcHRpb25zLnBhdGh9YClcbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlUGF0aChwYXRoOiBzdHJpbmcsIGRyeVJ1biA9IGZhbHNlKSB7XG4gIGNvbnN0IHN0YXQgPSBhd2FpdCBzdGF0QXN5bmMocGF0aCwge30pLmNhdGNoKCgpID0+IHVuZGVmaW5lZClcblxuICAvLyBmaWxlIGRlc2NyaXB0b3IgZXhpc3RzXG4gIGlmIChzdGF0KSB7XG4gICAgaWYgKHN0YXQuaXNGaWxlKCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYFBhdGggJHtwYXRofSBmb3IgY3JlYXRpbmcgbmV3IG5hcGktcnMgcHJvamVjdCBhbHJlYWR5IGV4aXN0cyBhbmQgaXQncyBub3QgYSBkaXJlY3RvcnkuYCxcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKHN0YXQuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgY29uc3QgZmlsZXMgPSBhd2FpdCByZWFkZGlyQXN5bmMocGF0aClcbiAgICAgIGlmIChmaWxlcy5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBQYXRoICR7cGF0aH0gZm9yIGNyZWF0aW5nIG5ldyBuYXBpLXJzIHByb2plY3QgYWxyZWFkeSBleGlzdHMgYW5kIGl0J3Mgbm90IGVtcHR5LmAsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoIWRyeVJ1bikge1xuICAgIHRyeSB7XG4gICAgICBkZWJ1ZyhgVHJ5IHRvIGNyZWF0ZSB0YXJnZXQgZGlyZWN0b3J5OiAke3BhdGh9YClcbiAgICAgIGlmICghZHJ5UnVuKSB7XG4gICAgICAgIGF3YWl0IG1rZGlyQXN5bmMocGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSlcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBjcmVhdGUgdGFyZ2V0IGRpcmVjdG9yeTogJHtwYXRofWAsIHtcbiAgICAgICAgY2F1c2U6IGUsXG4gICAgICB9KVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRCaW5hcnlOYW1lKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBuYW1lLnNwbGl0KCcvJykucG9wKCkhXG59XG5cbmV4cG9ydCB0eXBlIHsgTmV3T3B0aW9ucyB9XG4iLCIvLyBUaGlzIGZpbGUgaXMgZ2VuZXJhdGVkIGJ5IGNvZGVnZW4vaW5kZXgudHNcbi8vIERvIG5vdCBlZGl0IHRoaXMgZmlsZSBtYW51YWxseVxuaW1wb3J0IHsgQ29tbWFuZCwgT3B0aW9uIH0gZnJvbSAnY2xpcGFuaW9uJ1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZVByZVB1Ymxpc2hDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gIHN0YXRpYyBwYXRocyA9IFtbJ3ByZS1wdWJsaXNoJ10sIFsncHJlcHVibGlzaCddXVxuXG4gIHN0YXRpYyB1c2FnZSA9IENvbW1hbmQuVXNhZ2Uoe1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1VwZGF0ZSBwYWNrYWdlLmpzb24gYW5kIGNvcHkgYWRkb25zIGludG8gcGVyIHBsYXRmb3JtIHBhY2thZ2VzJyxcbiAgfSlcblxuICBjd2QgPSBPcHRpb24uU3RyaW5nKCctLWN3ZCcsIHByb2Nlc3MuY3dkKCksIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGgnLFxuICB9KVxuXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWNvbmZpZy1wYXRoLC1jJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZScsXG4gIH0pXG5cbiAgcGFja2FnZUpzb25QYXRoID0gT3B0aW9uLlN0cmluZygnLS1wYWNrYWdlLWpzb24tcGF0aCcsICdwYWNrYWdlLmpzb24nLCB7XG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGBwYWNrYWdlLmpzb25gJyxcbiAgfSlcblxuICBucG1EaXIgPSBPcHRpb24uU3RyaW5nKCctLW5wbS1kaXIsLXAnLCAnbnBtJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0JyxcbiAgfSlcblxuICB0YWdTdHlsZSA9IE9wdGlvbi5TdHJpbmcoJy0tdGFnLXN0eWxlLC0tdGFnc3R5bGUsLXQnLCAnbGVybmEnLCB7XG4gICAgZGVzY3JpcHRpb246ICdnaXQgdGFnIHN0eWxlLCBgbnBtYCBvciBgbGVybmFgJyxcbiAgfSlcblxuICBnaFJlbGVhc2UgPSBPcHRpb24uQm9vbGVhbignLS1naC1yZWxlYXNlJywgdHJ1ZSwge1xuICAgIGRlc2NyaXB0aW9uOiAnV2hldGhlciBjcmVhdGUgR2l0SHViIHJlbGVhc2UnLFxuICB9KVxuXG4gIGdoUmVsZWFzZU5hbWU/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWdoLXJlbGVhc2UtbmFtZScsIHtcbiAgICBkZXNjcmlwdGlvbjogJ0dpdEh1YiByZWxlYXNlIG5hbWUnLFxuICB9KVxuXG4gIGdoUmVsZWFzZUlkPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1naC1yZWxlYXNlLWlkJywge1xuICAgIGRlc2NyaXB0aW9uOiAnRXhpc3RpbmcgR2l0SHViIHJlbGVhc2UgaWQnLFxuICB9KVxuXG4gIHNraXBPcHRpb25hbFB1Ymxpc2ggPSBPcHRpb24uQm9vbGVhbignLS1za2lwLW9wdGlvbmFsLXB1Ymxpc2gnLCBmYWxzZSwge1xuICAgIGRlc2NyaXB0aW9uOiAnV2hldGhlciBza2lwIG9wdGlvbmFsRGVwZW5kZW5jaWVzIHBhY2thZ2VzIHB1Ymxpc2gnLFxuICB9KVxuXG4gIGRyeVJ1biA9IE9wdGlvbi5Cb29sZWFuKCctLWRyeS1ydW4nLCBmYWxzZSwge1xuICAgIGRlc2NyaXB0aW9uOiAnRHJ5IHJ1biB3aXRob3V0IHRvdWNoaW5nIGZpbGUgc3lzdGVtJyxcbiAgfSlcblxuICBnZXRPcHRpb25zKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjd2Q6IHRoaXMuY3dkLFxuICAgICAgY29uZmlnUGF0aDogdGhpcy5jb25maWdQYXRoLFxuICAgICAgcGFja2FnZUpzb25QYXRoOiB0aGlzLnBhY2thZ2VKc29uUGF0aCxcbiAgICAgIG5wbURpcjogdGhpcy5ucG1EaXIsXG4gICAgICB0YWdTdHlsZTogdGhpcy50YWdTdHlsZSxcbiAgICAgIGdoUmVsZWFzZTogdGhpcy5naFJlbGVhc2UsXG4gICAgICBnaFJlbGVhc2VOYW1lOiB0aGlzLmdoUmVsZWFzZU5hbWUsXG4gICAgICBnaFJlbGVhc2VJZDogdGhpcy5naFJlbGVhc2VJZCxcbiAgICAgIHNraXBPcHRpb25hbFB1Ymxpc2g6IHRoaXMuc2tpcE9wdGlvbmFsUHVibGlzaCxcbiAgICAgIGRyeVJ1bjogdGhpcy5kcnlSdW4sXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogVXBkYXRlIHBhY2thZ2UuanNvbiBhbmQgY29weSBhZGRvbnMgaW50byBwZXIgcGxhdGZvcm0gcGFja2FnZXNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcmVQdWJsaXNoT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGhcbiAgICpcbiAgICogQGRlZmF1bHQgcHJvY2Vzcy5jd2QoKVxuICAgKi9cbiAgY3dkPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAqL1xuICBjb25maWdQYXRoPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIGBwYWNrYWdlLmpzb25gXG4gICAqXG4gICAqIEBkZWZhdWx0ICdwYWNrYWdlLmpzb24nXG4gICAqL1xuICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gdGhlIGZvbGRlciB3aGVyZSB0aGUgbnBtIHBhY2thZ2VzIHB1dFxuICAgKlxuICAgKiBAZGVmYXVsdCAnbnBtJ1xuICAgKi9cbiAgbnBtRGlyPzogc3RyaW5nXG4gIC8qKlxuICAgKiBnaXQgdGFnIHN0eWxlLCBgbnBtYCBvciBgbGVybmFgXG4gICAqXG4gICAqIEBkZWZhdWx0ICdsZXJuYSdcbiAgICovXG4gIHRhZ1N0eWxlPzogJ25wbScgfCAnbGVybmEnXG4gIC8qKlxuICAgKiBXaGV0aGVyIGNyZWF0ZSBHaXRIdWIgcmVsZWFzZVxuICAgKlxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICBnaFJlbGVhc2U/OiBib29sZWFuXG4gIC8qKlxuICAgKiBHaXRIdWIgcmVsZWFzZSBuYW1lXG4gICAqL1xuICBnaFJlbGVhc2VOYW1lPzogc3RyaW5nXG4gIC8qKlxuICAgKiBFeGlzdGluZyBHaXRIdWIgcmVsZWFzZSBpZFxuICAgKi9cbiAgZ2hSZWxlYXNlSWQ/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFdoZXRoZXIgc2tpcCBvcHRpb25hbERlcGVuZGVuY2llcyBwYWNrYWdlcyBwdWJsaXNoXG4gICAqXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICBza2lwT3B0aW9uYWxQdWJsaXNoPzogYm9vbGVhblxuICAvKipcbiAgICogRHJ5IHJ1biB3aXRob3V0IHRvdWNoaW5nIGZpbGUgc3lzdGVtXG4gICAqXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICBkcnlSdW4/OiBib29sZWFuXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseURlZmF1bHRQcmVQdWJsaXNoT3B0aW9ucyhvcHRpb25zOiBQcmVQdWJsaXNoT3B0aW9ucykge1xuICByZXR1cm4ge1xuICAgIGN3ZDogcHJvY2Vzcy5jd2QoKSxcbiAgICBwYWNrYWdlSnNvblBhdGg6ICdwYWNrYWdlLmpzb24nLFxuICAgIG5wbURpcjogJ25wbScsXG4gICAgdGFnU3R5bGU6ICdsZXJuYScsXG4gICAgZ2hSZWxlYXNlOiB0cnVlLFxuICAgIHNraXBPcHRpb25hbFB1Ymxpc2g6IGZhbHNlLFxuICAgIGRyeVJ1bjogZmFsc2UsXG4gICAgLi4ub3B0aW9ucyxcbiAgfVxufVxuIiwiLy8gVGhpcyBmaWxlIGlzIGdlbmVyYXRlZCBieSBjb2RlZ2VuL2luZGV4LnRzXG4vLyBEbyBub3QgZWRpdCB0aGlzIGZpbGUgbWFudWFsbHlcbmltcG9ydCB7IENvbW1hbmQsIE9wdGlvbiB9IGZyb20gJ2NsaXBhbmlvbidcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VWZXJzaW9uQ29tbWFuZCBleHRlbmRzIENvbW1hbmQge1xuICBzdGF0aWMgcGF0aHMgPSBbWyd2ZXJzaW9uJ11dXG5cbiAgc3RhdGljIHVzYWdlID0gQ29tbWFuZC5Vc2FnZSh7XG4gICAgZGVzY3JpcHRpb246ICdVcGRhdGUgdmVyc2lvbiBpbiBjcmVhdGVkIG5wbSBwYWNrYWdlcycsXG4gIH0pXG5cbiAgY3dkID0gT3B0aW9uLlN0cmluZygnLS1jd2QnLCBwcm9jZXNzLmN3ZCgpLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoJyxcbiAgfSlcblxuICBjb25maWdQYXRoPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1jb25maWctcGF0aCwtYycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGUnLFxuICB9KVxuXG4gIHBhY2thZ2VKc29uUGF0aCA9IE9wdGlvbi5TdHJpbmcoJy0tcGFja2FnZS1qc29uLXBhdGgnLCAncGFja2FnZS5qc29uJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgcGFja2FnZS5qc29uYCcsXG4gIH0pXG5cbiAgbnBtRGlyID0gT3B0aW9uLlN0cmluZygnLS1ucG0tZGlyJywgJ25wbScsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gdGhlIGZvbGRlciB3aGVyZSB0aGUgbnBtIHBhY2thZ2VzIHB1dCcsXG4gIH0pXG5cbiAgZ2V0T3B0aW9ucygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY3dkOiB0aGlzLmN3ZCxcbiAgICAgIGNvbmZpZ1BhdGg6IHRoaXMuY29uZmlnUGF0aCxcbiAgICAgIHBhY2thZ2VKc29uUGF0aDogdGhpcy5wYWNrYWdlSnNvblBhdGgsXG4gICAgICBucG1EaXI6IHRoaXMubnBtRGlyLFxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFVwZGF0ZSB2ZXJzaW9uIGluIGNyZWF0ZWQgbnBtIHBhY2thZ2VzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVmVyc2lvbk9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoXG4gICAqXG4gICAqIEBkZWZhdWx0IHByb2Nlc3MuY3dkKClcbiAgICovXG4gIGN3ZD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgKi9cbiAgY29uZmlnUGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgcGFja2FnZS5qc29uYFxuICAgKlxuICAgKiBAZGVmYXVsdCAncGFja2FnZS5qc29uJ1xuICAgKi9cbiAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgdGhlIG5wbSBwYWNrYWdlcyBwdXRcbiAgICpcbiAgICogQGRlZmF1bHQgJ25wbSdcbiAgICovXG4gIG5wbURpcj86IHN0cmluZ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlEZWZhdWx0VmVyc2lvbk9wdGlvbnMob3B0aW9uczogVmVyc2lvbk9wdGlvbnMpIHtcbiAgcmV0dXJuIHtcbiAgICBjd2Q6IHByb2Nlc3MuY3dkKCksXG4gICAgcGFja2FnZUpzb25QYXRoOiAncGFja2FnZS5qc29uJyxcbiAgICBucG1EaXI6ICducG0nLFxuICAgIC4uLm9wdGlvbnMsXG4gIH1cbn1cbiIsImltcG9ydCB7IGpvaW4sIHJlc29sdmUgfSBmcm9tICdub2RlOnBhdGgnXG5cbmltcG9ydCB7XG4gIGFwcGx5RGVmYXVsdFZlcnNpb25PcHRpb25zLFxuICB0eXBlIFZlcnNpb25PcHRpb25zLFxufSBmcm9tICcuLi9kZWYvdmVyc2lvbi5qcydcbmltcG9ydCB7XG4gIHJlYWROYXBpQ29uZmlnLFxuICBkZWJ1Z0ZhY3RvcnksXG4gIHVwZGF0ZVBhY2thZ2VKc29uLFxufSBmcm9tICcuLi91dGlscy9pbmRleC5qcydcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ3ZlcnNpb24nKVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmVyc2lvbih1c2VyT3B0aW9uczogVmVyc2lvbk9wdGlvbnMpIHtcbiAgY29uc3Qgb3B0aW9ucyA9IGFwcGx5RGVmYXVsdFZlcnNpb25PcHRpb25zKHVzZXJPcHRpb25zKVxuICBjb25zdCBwYWNrYWdlSnNvblBhdGggPSByZXNvbHZlKG9wdGlvbnMuY3dkLCBvcHRpb25zLnBhY2thZ2VKc29uUGF0aClcblxuICBjb25zdCBjb25maWcgPSBhd2FpdCByZWFkTmFwaUNvbmZpZyhcbiAgICBwYWNrYWdlSnNvblBhdGgsXG4gICAgb3B0aW9ucy5jb25maWdQYXRoID8gcmVzb2x2ZShvcHRpb25zLmN3ZCwgb3B0aW9ucy5jb25maWdQYXRoKSA6IHVuZGVmaW5lZCxcbiAgKVxuXG4gIGZvciAoY29uc3QgdGFyZ2V0IG9mIGNvbmZpZy50YXJnZXRzKSB7XG4gICAgY29uc3QgcGtnRGlyID0gcmVzb2x2ZShvcHRpb25zLmN3ZCwgb3B0aW9ucy5ucG1EaXIsIHRhcmdldC5wbGF0Zm9ybUFyY2hBQkkpXG5cbiAgICBkZWJ1ZyhgVXBkYXRlIHZlcnNpb24gdG8gJWkgaW4gWyVpXWAsIGNvbmZpZy5wYWNrYWdlSnNvbi52ZXJzaW9uLCBwa2dEaXIpXG4gICAgYXdhaXQgdXBkYXRlUGFja2FnZUpzb24oam9pbihwa2dEaXIsICdwYWNrYWdlLmpzb24nKSwge1xuICAgICAgdmVyc2lvbjogY29uZmlnLnBhY2thZ2VKc29uLnZlcnNpb24sXG4gICAgfSlcbiAgfVxufVxuIiwiaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnXG5pbXBvcnQgeyBleGlzdHNTeW5jLCBzdGF0U3luYyB9IGZyb20gJ25vZGU6ZnMnXG5pbXBvcnQgeyBqb2luLCByZXNvbHZlIH0gZnJvbSAnbm9kZTpwYXRoJ1xuXG5pbXBvcnQgeyBPY3Rva2l0IH0gZnJvbSAnQG9jdG9raXQvcmVzdCdcblxuaW1wb3J0IHtcbiAgYXBwbHlEZWZhdWx0UHJlUHVibGlzaE9wdGlvbnMsXG4gIHR5cGUgUHJlUHVibGlzaE9wdGlvbnMsXG59IGZyb20gJy4uL2RlZi9wcmUtcHVibGlzaC5qcydcbmltcG9ydCB7XG4gIHJlYWRGaWxlQXN5bmMsXG4gIHJlYWROYXBpQ29uZmlnLFxuICBkZWJ1Z0ZhY3RvcnksXG4gIHVwZGF0ZVBhY2thZ2VKc29uLFxufSBmcm9tICcuLi91dGlscy9pbmRleC5qcydcblxuaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gJy4vdmVyc2lvbi5qcydcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ3ByZS1wdWJsaXNoJylcblxuaW50ZXJmYWNlIFBhY2thZ2VJbmZvIHtcbiAgbmFtZTogc3RyaW5nXG4gIHZlcnNpb246IHN0cmluZ1xuICB0YWc6IHN0cmluZ1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHJlUHVibGlzaCh1c2VyT3B0aW9uczogUHJlUHVibGlzaE9wdGlvbnMpIHtcbiAgZGVidWcoJ1JlY2VpdmUgcHJlLXB1Ymxpc2ggb3B0aW9uczonKVxuICBkZWJ1ZygnICAlTycsIHVzZXJPcHRpb25zKVxuXG4gIGNvbnN0IG9wdGlvbnMgPSBhcHBseURlZmF1bHRQcmVQdWJsaXNoT3B0aW9ucyh1c2VyT3B0aW9ucylcblxuICBjb25zdCBwYWNrYWdlSnNvblBhdGggPSByZXNvbHZlKG9wdGlvbnMuY3dkLCBvcHRpb25zLnBhY2thZ2VKc29uUGF0aClcblxuICBjb25zdCB7IHBhY2thZ2VKc29uLCB0YXJnZXRzLCBwYWNrYWdlTmFtZSwgYmluYXJ5TmFtZSwgbnBtQ2xpZW50IH0gPVxuICAgIGF3YWl0IHJlYWROYXBpQ29uZmlnKFxuICAgICAgcGFja2FnZUpzb25QYXRoLFxuICAgICAgb3B0aW9ucy5jb25maWdQYXRoID8gcmVzb2x2ZShvcHRpb25zLmN3ZCwgb3B0aW9ucy5jb25maWdQYXRoKSA6IHVuZGVmaW5lZCxcbiAgICApXG5cbiAgYXN5bmMgZnVuY3Rpb24gY3JlYXRlR2hSZWxlYXNlKHBhY2thZ2VOYW1lOiBzdHJpbmcsIHZlcnNpb246IHN0cmluZykge1xuICAgIGlmICghb3B0aW9ucy5naFJlbGVhc2UpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG93bmVyOiBudWxsLFxuICAgICAgICByZXBvOiBudWxsLFxuICAgICAgICBwa2dJbmZvOiB7IG5hbWU6IG51bGwsIHZlcnNpb246IG51bGwsIHRhZzogbnVsbCB9LFxuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCB7IHJlcG8sIG93bmVyLCBwa2dJbmZvLCBvY3Rva2l0IH0gPSBnZXRSZXBvSW5mbyhwYWNrYWdlTmFtZSwgdmVyc2lvbilcblxuICAgIGlmICghcmVwbyB8fCAhb3duZXIpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG93bmVyOiBudWxsLFxuICAgICAgICByZXBvOiBudWxsLFxuICAgICAgICBwa2dJbmZvOiB7IG5hbWU6IG51bGwsIHZlcnNpb246IG51bGwsIHRhZzogbnVsbCB9LFxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghb3B0aW9ucy5kcnlSdW4pIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IG9jdG9raXQucmVwb3MuY3JlYXRlUmVsZWFzZSh7XG4gICAgICAgICAgb3duZXIsXG4gICAgICAgICAgcmVwbyxcbiAgICAgICAgICB0YWdfbmFtZTogcGtnSW5mby50YWcsXG4gICAgICAgICAgbmFtZTogb3B0aW9ucy5naFJlbGVhc2VOYW1lLFxuICAgICAgICAgIHByZXJlbGVhc2U6XG4gICAgICAgICAgICB2ZXJzaW9uLmluY2x1ZGVzKCdhbHBoYScpIHx8XG4gICAgICAgICAgICB2ZXJzaW9uLmluY2x1ZGVzKCdiZXRhJykgfHxcbiAgICAgICAgICAgIHZlcnNpb24uaW5jbHVkZXMoJ3JjJyksXG4gICAgICAgIH0pXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGRlYnVnKFxuICAgICAgICAgIGBQYXJhbXM6ICR7SlNPTi5zdHJpbmdpZnkoXG4gICAgICAgICAgICB7IG93bmVyLCByZXBvLCB0YWdfbmFtZTogcGtnSW5mby50YWcgfSxcbiAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAyLFxuICAgICAgICAgICl9YCxcbiAgICAgICAgKVxuICAgICAgICBjb25zb2xlLmVycm9yKGUpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IG93bmVyLCByZXBvLCBwa2dJbmZvLCBvY3Rva2l0IH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFJlcG9JbmZvKHBhY2thZ2VOYW1lOiBzdHJpbmcsIHZlcnNpb246IHN0cmluZykge1xuICAgIGNvbnN0IGhlYWRDb21taXQgPSBleGVjU3luYygnZ2l0IGxvZyAtMSAtLXByZXR0eT0lQicsIHtcbiAgICAgIGN3ZDogb3B0aW9ucy5jd2QsXG4gICAgICBlbmNvZGluZzogJ3V0Zi04JyxcbiAgICB9KS50cmltKClcblxuICAgIGNvbnN0IHsgR0lUSFVCX1JFUE9TSVRPUlkgfSA9IHByb2Nlc3MuZW52XG4gICAgaWYgKCFHSVRIVUJfUkVQT1NJVE9SWSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3duZXI6IG51bGwsXG4gICAgICAgIHJlcG86IG51bGwsXG4gICAgICAgIHBrZ0luZm86IHsgbmFtZTogbnVsbCwgdmVyc2lvbjogbnVsbCwgdGFnOiBudWxsIH0sXG4gICAgICB9XG4gICAgfVxuICAgIGRlYnVnKGBHaXRodWIgcmVwb3NpdG9yeTogJHtHSVRIVUJfUkVQT1NJVE9SWX1gKVxuICAgIGNvbnN0IFtvd25lciwgcmVwb10gPSBHSVRIVUJfUkVQT1NJVE9SWS5zcGxpdCgnLycpXG4gICAgY29uc3Qgb2N0b2tpdCA9IG5ldyBPY3Rva2l0KHtcbiAgICAgIGF1dGg6IHByb2Nlc3MuZW52LkdJVEhVQl9UT0tFTixcbiAgICB9KVxuICAgIGxldCBwa2dJbmZvOiBQYWNrYWdlSW5mbyB8IHVuZGVmaW5lZFxuICAgIGlmIChvcHRpb25zLnRhZ1N0eWxlID09PSAnbGVybmEnKSB7XG4gICAgICBjb25zdCBwYWNrYWdlc1RvUHVibGlzaCA9IGhlYWRDb21taXRcbiAgICAgICAgLnNwbGl0KCdcXG4nKVxuICAgICAgICAubWFwKChsaW5lKSA9PiBsaW5lLnRyaW0oKSlcbiAgICAgICAgLmZpbHRlcigobGluZSwgaW5kZXgpID0+IGxpbmUubGVuZ3RoICYmIGluZGV4KVxuICAgICAgICAubWFwKChsaW5lKSA9PiBsaW5lLnN1YnN0cmluZygyKSlcbiAgICAgICAgLm1hcChwYXJzZVRhZylcblxuICAgICAgcGtnSW5mbyA9IHBhY2thZ2VzVG9QdWJsaXNoLmZpbmQoXG4gICAgICAgIChwa2dJbmZvKSA9PiBwa2dJbmZvLm5hbWUgPT09IHBhY2thZ2VOYW1lLFxuICAgICAgKVxuXG4gICAgICBpZiAoIXBrZ0luZm8pIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgTm8gcmVsZWFzZSBjb21taXQgZm91bmQgd2l0aCAke3BhY2thZ2VOYW1lfSwgb3JpZ2luYWwgY29tbWl0IGluZm86ICR7aGVhZENvbW1pdH1gLFxuICAgICAgICApXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHBrZ0luZm8gPSB7XG4gICAgICAgIHRhZzogYHYke3ZlcnNpb259YCxcbiAgICAgICAgdmVyc2lvbixcbiAgICAgICAgbmFtZTogcGFja2FnZU5hbWUsXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IG93bmVyLCByZXBvLCBwa2dJbmZvLCBvY3Rva2l0IH1cbiAgfVxuXG4gIGlmICghb3B0aW9ucy5kcnlSdW4pIHtcbiAgICBhd2FpdCB2ZXJzaW9uKHVzZXJPcHRpb25zKVxuICAgIGF3YWl0IHVwZGF0ZVBhY2thZ2VKc29uKHBhY2thZ2VKc29uUGF0aCwge1xuICAgICAgb3B0aW9uYWxEZXBlbmRlbmNpZXM6IHRhcmdldHMucmVkdWNlKFxuICAgICAgICAoZGVwcywgdGFyZ2V0KSA9PiB7XG4gICAgICAgICAgZGVwc1tgJHtwYWNrYWdlTmFtZX0tJHt0YXJnZXQucGxhdGZvcm1BcmNoQUJJfWBdID0gcGFja2FnZUpzb24udmVyc2lvblxuXG4gICAgICAgICAgcmV0dXJuIGRlcHNcbiAgICAgICAgfSxcbiAgICAgICAge30gYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgICAgICksXG4gICAgfSlcbiAgfVxuXG4gIGNvbnN0IHsgb3duZXIsIHJlcG8sIHBrZ0luZm8sIG9jdG9raXQgfSA9IG9wdGlvbnMuZ2hSZWxlYXNlSWRcbiAgICA/IGdldFJlcG9JbmZvKHBhY2thZ2VOYW1lLCBwYWNrYWdlSnNvbi52ZXJzaW9uKVxuICAgIDogYXdhaXQgY3JlYXRlR2hSZWxlYXNlKHBhY2thZ2VOYW1lLCBwYWNrYWdlSnNvbi52ZXJzaW9uKVxuXG4gIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICBjb25zdCBwa2dEaXIgPSByZXNvbHZlKFxuICAgICAgb3B0aW9ucy5jd2QsXG4gICAgICBvcHRpb25zLm5wbURpcixcbiAgICAgIGAke3RhcmdldC5wbGF0Zm9ybUFyY2hBQkl9YCxcbiAgICApXG4gICAgY29uc3QgZXh0ID1cbiAgICAgIHRhcmdldC5wbGF0Zm9ybSA9PT0gJ3dhc2knIHx8IHRhcmdldC5wbGF0Zm9ybSA9PT0gJ3dhc20nID8gJ3dhc20nIDogJ25vZGUnXG4gICAgY29uc3QgZmlsZW5hbWUgPSBgJHtiaW5hcnlOYW1lfS4ke3RhcmdldC5wbGF0Zm9ybUFyY2hBQkl9LiR7ZXh0fWBcbiAgICBjb25zdCBkc3RQYXRoID0gam9pbihwa2dEaXIsIGZpbGVuYW1lKVxuXG4gICAgaWYgKCFvcHRpb25zLmRyeVJ1bikge1xuICAgICAgaWYgKCFleGlzdHNTeW5jKGRzdFBhdGgpKSB7XG4gICAgICAgIGRlYnVnLndhcm4oYCVzIGRvZXNuJ3QgZXhpc3RgLCBkc3RQYXRoKVxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICBpZiAoIW9wdGlvbnMuc2tpcE9wdGlvbmFsUHVibGlzaCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKGAke25wbUNsaWVudH0gcHVibGlzaGAsIHtcbiAgICAgICAgICAgIGN3ZDogcGtnRGlyLFxuICAgICAgICAgICAgZW52OiBwcm9jZXNzLmVudixcbiAgICAgICAgICAgIHN0ZGlvOiAncGlwZScsXG4gICAgICAgICAgfSlcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShvdXRwdXQpXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBlIGluc3RhbmNlb2YgRXJyb3IgJiZcbiAgICAgICAgICAgIGUubWVzc2FnZS5pbmNsdWRlcyhcbiAgICAgICAgICAgICAgJ1lvdSBjYW5ub3QgcHVibGlzaCBvdmVyIHRoZSBwcmV2aW91c2x5IHB1Ymxpc2hlZCB2ZXJzaW9ucycsXG4gICAgICAgICAgICApXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjb25zb2xlLmluZm8oZS5tZXNzYWdlKVxuICAgICAgICAgICAgZGVidWcud2FybihgJHtwa2dEaXJ9IGhhcyBiZWVuIHB1Ymxpc2hlZCwgc2tpcHBpbmdgKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmdoUmVsZWFzZSAmJiByZXBvICYmIG93bmVyKSB7XG4gICAgICAgIGRlYnVnLmluZm8oYENyZWF0aW5nIEdpdEh1YiByZWxlYXNlICR7cGtnSW5mby50YWd9YClcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCByZWxlYXNlSWQgPSBvcHRpb25zLmdoUmVsZWFzZUlkXG4gICAgICAgICAgICA/IE51bWJlcihvcHRpb25zLmdoUmVsZWFzZUlkKVxuICAgICAgICAgICAgOiAoXG4gICAgICAgICAgICAgICAgYXdhaXQgb2N0b2tpdCEucmVwb3MuZ2V0UmVsZWFzZUJ5VGFnKHtcbiAgICAgICAgICAgICAgICAgIHJlcG86IHJlcG8sXG4gICAgICAgICAgICAgICAgICBvd25lcjogb3duZXIsXG4gICAgICAgICAgICAgICAgICB0YWc6IHBrZ0luZm8udGFnLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICkuZGF0YS5pZFxuICAgICAgICAgIGNvbnN0IGRzdEZpbGVTdGF0cyA9IHN0YXRTeW5jKGRzdFBhdGgpXG4gICAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gYXdhaXQgb2N0b2tpdCEucmVwb3MudXBsb2FkUmVsZWFzZUFzc2V0KHtcbiAgICAgICAgICAgIG93bmVyOiBvd25lcixcbiAgICAgICAgICAgIHJlcG86IHJlcG8sXG4gICAgICAgICAgICBuYW1lOiBmaWxlbmFtZSxcbiAgICAgICAgICAgIHJlbGVhc2VfaWQ6IHJlbGVhc2VJZCxcbiAgICAgICAgICAgIG1lZGlhVHlwZTogeyBmb3JtYXQ6ICdyYXcnIH0sXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICdjb250ZW50LWxlbmd0aCc6IGRzdEZpbGVTdGF0cy5zaXplLFxuICAgICAgICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvciBvY3Rva2l0IHR5cGVzIGFyZSB3cm9uZ1xuICAgICAgICAgICAgZGF0YTogYXdhaXQgcmVhZEZpbGVBc3luYyhkc3RQYXRoKSxcbiAgICAgICAgICB9KVxuICAgICAgICAgIGRlYnVnLmluZm8oYEdpdEh1YiByZWxlYXNlIGNyZWF0ZWRgKVxuICAgICAgICAgIGRlYnVnLmluZm8oYERvd25sb2FkIFVSTDogJXNgLCBhc3NldEluZm8uZGF0YS5icm93c2VyX2Rvd25sb2FkX3VybClcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGRlYnVnLmVycm9yKFxuICAgICAgICAgICAgYFBhcmFtOiAke0pTT04uc3RyaW5naWZ5KFxuICAgICAgICAgICAgICB7IG93bmVyLCByZXBvLCB0YWc6IHBrZ0luZm8udGFnLCBmaWxlbmFtZTogZHN0UGF0aCB9LFxuICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAyLFxuICAgICAgICAgICAgKX1gLFxuICAgICAgICAgIClcbiAgICAgICAgICBkZWJ1Zy5lcnJvcihlKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHBhcnNlVGFnKHRhZzogc3RyaW5nKSB7XG4gIGNvbnN0IHNlZ21lbnRzID0gdGFnLnNwbGl0KCdAJylcbiAgY29uc3QgdmVyc2lvbiA9IHNlZ21lbnRzLnBvcCgpIVxuICBjb25zdCBuYW1lID0gc2VnbWVudHMuam9pbignQCcpXG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lLFxuICAgIHZlcnNpb24sXG4gICAgdGFnLFxuICB9XG59XG4iLCIvLyBUaGlzIGZpbGUgaXMgZ2VuZXJhdGVkIGJ5IGNvZGVnZW4vaW5kZXgudHNcbi8vIERvIG5vdCBlZGl0IHRoaXMgZmlsZSBtYW51YWxseVxuaW1wb3J0IHsgQ29tbWFuZCwgT3B0aW9uIH0gZnJvbSAnY2xpcGFuaW9uJ1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZVVuaXZlcnNhbGl6ZUNvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcbiAgc3RhdGljIHBhdGhzID0gW1sndW5pdmVyc2FsaXplJ11dXG5cbiAgc3RhdGljIHVzYWdlID0gQ29tbWFuZC5Vc2FnZSh7XG4gICAgZGVzY3JpcHRpb246ICdDb21iaWxlIGJ1aWx0IGJpbmFyaWVzIGludG8gb25lIHVuaXZlcnNhbCBiaW5hcnknLFxuICB9KVxuXG4gIGN3ZCA9IE9wdGlvbi5TdHJpbmcoJy0tY3dkJywgcHJvY2Vzcy5jd2QoKSwge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1RoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aCcsXG4gIH0pXG5cbiAgY29uZmlnUGF0aD86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tY29uZmlnLXBhdGgsLWMnLCB7XG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlJyxcbiAgfSlcblxuICBwYWNrYWdlSnNvblBhdGggPSBPcHRpb24uU3RyaW5nKCctLXBhY2thZ2UtanNvbi1wYXRoJywgJ3BhY2thZ2UuanNvbicsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gYHBhY2thZ2UuanNvbmAnLFxuICB9KVxuXG4gIG91dHB1dERpciA9IE9wdGlvbi5TdHJpbmcoJy0tb3V0cHV0LWRpciwtbycsICcuLycsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgYWxsIGJ1aWx0IGAubm9kZWAgZmlsZXMgcHV0LCBzYW1lIGFzIGAtLW91dHB1dC1kaXJgIG9mIGJ1aWxkIGNvbW1hbmQnLFxuICB9KVxuXG4gIGdldE9wdGlvbnMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGN3ZDogdGhpcy5jd2QsXG4gICAgICBjb25maWdQYXRoOiB0aGlzLmNvbmZpZ1BhdGgsXG4gICAgICBwYWNrYWdlSnNvblBhdGg6IHRoaXMucGFja2FnZUpzb25QYXRoLFxuICAgICAgb3V0cHV0RGlyOiB0aGlzLm91dHB1dERpcixcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDb21iaWxlIGJ1aWx0IGJpbmFyaWVzIGludG8gb25lIHVuaXZlcnNhbCBiaW5hcnlcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBVbml2ZXJzYWxpemVPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aFxuICAgKlxuICAgKiBAZGVmYXVsdCBwcm9jZXNzLmN3ZCgpXG4gICAqL1xuICBjd2Q/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICovXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gYHBhY2thZ2UuanNvbmBcbiAgICpcbiAgICogQGRlZmF1bHQgJ3BhY2thZ2UuanNvbidcbiAgICovXG4gIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIGFsbCBidWlsdCBgLm5vZGVgIGZpbGVzIHB1dCwgc2FtZSBhcyBgLS1vdXRwdXQtZGlyYCBvZiBidWlsZCBjb21tYW5kXG4gICAqXG4gICAqIEBkZWZhdWx0ICcuLydcbiAgICovXG4gIG91dHB1dERpcj86IHN0cmluZ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlEZWZhdWx0VW5pdmVyc2FsaXplT3B0aW9ucyhvcHRpb25zOiBVbml2ZXJzYWxpemVPcHRpb25zKSB7XG4gIHJldHVybiB7XG4gICAgY3dkOiBwcm9jZXNzLmN3ZCgpLFxuICAgIHBhY2thZ2VKc29uUGF0aDogJ3BhY2thZ2UuanNvbicsXG4gICAgb3V0cHV0RGlyOiAnLi8nLFxuICAgIC4uLm9wdGlvbnMsXG4gIH1cbn1cbiIsImltcG9ydCB7IHNwYXduU3luYyB9IGZyb20gJ25vZGU6Y2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdub2RlOnBhdGgnXG5cbmltcG9ydCB7XG4gIGFwcGx5RGVmYXVsdFVuaXZlcnNhbGl6ZU9wdGlvbnMsXG4gIHR5cGUgVW5pdmVyc2FsaXplT3B0aW9ucyxcbn0gZnJvbSAnLi4vZGVmL3VuaXZlcnNhbGl6ZS5qcydcbmltcG9ydCB7IHJlYWROYXBpQ29uZmlnIH0gZnJvbSAnLi4vdXRpbHMvY29uZmlnLmpzJ1xuaW1wb3J0IHsgZGVidWdGYWN0b3J5IH0gZnJvbSAnLi4vdXRpbHMvbG9nLmpzJ1xuaW1wb3J0IHsgZmlsZUV4aXN0cyB9IGZyb20gJy4uL3V0aWxzL21pc2MuanMnXG5pbXBvcnQgeyBVbmlBcmNoc0J5UGxhdGZvcm0gfSBmcm9tICcuLi91dGlscy90YXJnZXQuanMnXG5cbmNvbnN0IGRlYnVnID0gZGVidWdGYWN0b3J5KCd1bml2ZXJzYWxpemUnKVxuXG5mdW5jdGlvbiBjcmVhdGVEYXJ3aW5Vbml2ZXJzYWxCaW5hcnkoaW5wdXRzOiBzdHJpbmdbXSwgb3V0cHV0OiBzdHJpbmcpIHtcbiAgY29uc3QgcmVzdWx0ID0gc3Bhd25TeW5jKCdsaXBvJywgWyctY3JlYXRlJywgJy1vdXRwdXQnLCBvdXRwdXQsIC4uLmlucHV0c10sIHtcbiAgICBzdGRpbzogJ2luaGVyaXQnLFxuICB9KVxuXG4gIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICB0aHJvdyByZXN1bHQuZXJyb3JcbiAgfVxuXG4gIGlmIChyZXN1bHQuc2lnbmFsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEZhaWxlZCB0byBjcmVhdGUgdW5pdmVyc2FsIGJpbmFyeSAnJHtvdXRwdXR9JzogbGlwbyB0ZXJtaW5hdGVkIHdpdGggc2lnbmFsICR7cmVzdWx0LnNpZ25hbH0uYCxcbiAgICApXG4gIH1cblxuICBpZiAocmVzdWx0LnN0YXR1cyAhPT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBGYWlsZWQgdG8gY3JlYXRlIHVuaXZlcnNhbCBiaW5hcnkgJyR7b3V0cHV0fSc6IGxpcG8gZXhpdGVkIHdpdGggc3RhdHVzICR7cmVzdWx0LnN0YXR1c30uYCxcbiAgICApXG4gIH1cbn1cblxuY29uc3QgdW5pdmVyc2FsaXplcnM6IFBhcnRpYWw8XG4gIFJlY29yZDxOb2RlSlMuUGxhdGZvcm0sIChpbnB1dHM6IHN0cmluZ1tdLCBvdXRwdXQ6IHN0cmluZykgPT4gdm9pZD5cbj4gPSB7XG4gIGRhcndpbjogY3JlYXRlRGFyd2luVW5pdmVyc2FsQmluYXJ5LFxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdW5pdmVyc2FsaXplQmluYXJpZXModXNlck9wdGlvbnM6IFVuaXZlcnNhbGl6ZU9wdGlvbnMpIHtcbiAgY29uc3Qgb3B0aW9ucyA9IGFwcGx5RGVmYXVsdFVuaXZlcnNhbGl6ZU9wdGlvbnModXNlck9wdGlvbnMpXG5cbiAgY29uc3QgcGFja2FnZUpzb25QYXRoID0gcmVzb2x2ZShvcHRpb25zLmN3ZCwgb3B0aW9ucy5wYWNrYWdlSnNvblBhdGgpXG5cbiAgY29uc3QgY29uZmlnID0gYXdhaXQgcmVhZE5hcGlDb25maWcoXG4gICAgcGFja2FnZUpzb25QYXRoLFxuICAgIG9wdGlvbnMuY29uZmlnUGF0aCA/IHJlc29sdmUob3B0aW9ucy5jd2QsIG9wdGlvbnMuY29uZmlnUGF0aCkgOiB1bmRlZmluZWQsXG4gIClcblxuICBjb25zdCB0YXJnZXQgPSBjb25maWcudGFyZ2V0cy5maW5kKFxuICAgICh0KSA9PiB0LnBsYXRmb3JtID09PSBwcm9jZXNzLnBsYXRmb3JtICYmIHQuYXJjaCA9PT0gJ3VuaXZlcnNhbCcsXG4gIClcblxuICBpZiAoIXRhcmdldCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGAndW5pdmVyc2FsJyBhcmNoIGZvciBwbGF0Zm9ybSAnJHtwcm9jZXNzLnBsYXRmb3JtfScgbm90IGZvdW5kIGluIGNvbmZpZyFgLFxuICAgIClcbiAgfVxuXG4gIGNvbnN0IHNyY0ZpbGVzID0gVW5pQXJjaHNCeVBsYXRmb3JtW3Byb2Nlc3MucGxhdGZvcm1dPy5tYXAoKGFyY2gpID0+XG4gICAgcmVzb2x2ZShcbiAgICAgIG9wdGlvbnMuY3dkLFxuICAgICAgb3B0aW9ucy5vdXRwdXREaXIsXG4gICAgICBgJHtjb25maWcuYmluYXJ5TmFtZX0uJHtwcm9jZXNzLnBsYXRmb3JtfS0ke2FyY2h9Lm5vZGVgLFxuICAgICksXG4gIClcblxuICBpZiAoIXNyY0ZpbGVzIHx8ICF1bml2ZXJzYWxpemVyc1twcm9jZXNzLnBsYXRmb3JtXSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGAndW5pdmVyc2FsJyBhcmNoIGZvciBwbGF0Zm9ybSAnJHtwcm9jZXNzLnBsYXRmb3JtfScgbm90IHN1cHBvcnRlZC5gLFxuICAgIClcbiAgfVxuXG4gIGRlYnVnKGBMb29raW5nIHVwIHNvdXJjZSBiaW5hcmllcyB0byBjb21iaW5lOiBgKVxuICBkZWJ1ZygnICAlTycsIHNyY0ZpbGVzKVxuXG4gIGNvbnN0IHNyY0ZpbGVMb29rdXAgPSBhd2FpdCBQcm9taXNlLmFsbChzcmNGaWxlcy5tYXAoKGYpID0+IGZpbGVFeGlzdHMoZikpKVxuXG4gIGNvbnN0IG5vdEZvdW5kRmlsZXMgPSBzcmNGaWxlcy5maWx0ZXIoKF8sIGkpID0+ICFzcmNGaWxlTG9va3VwW2ldKVxuXG4gIGlmIChub3RGb3VuZEZpbGVzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBTb21lIGJpbmFyeSBmaWxlcyB3ZXJlIG5vdCBmb3VuZDogJHtKU09OLnN0cmluZ2lmeShub3RGb3VuZEZpbGVzKX1gLFxuICAgIClcbiAgfVxuXG4gIGNvbnN0IG91dHB1dCA9IHJlc29sdmUoXG4gICAgb3B0aW9ucy5jd2QsXG4gICAgb3B0aW9ucy5vdXRwdXREaXIsXG4gICAgYCR7Y29uZmlnLmJpbmFyeU5hbWV9LiR7cHJvY2Vzcy5wbGF0Zm9ybX0tdW5pdmVyc2FsLm5vZGVgLFxuICApXG5cbiAgdW5pdmVyc2FsaXplcnNbcHJvY2Vzcy5wbGF0Zm9ybV0/LihzcmNGaWxlcywgb3V0cHV0KVxuXG4gIGlmICghKGF3YWl0IGZpbGVFeGlzdHMob3V0cHV0KSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVuaXZlcnNhbCBiaW5hcnkgd2FzIG5vdCBjcmVhdGVkOiAke291dHB1dH1gKVxuICB9XG5cbiAgZGVidWcoYFByb2R1Y2VkIHVuaXZlcnNhbCBiaW5hcnk6ICR7b3V0cHV0fWApXG59XG4iLCJpbXBvcnQgeyBDb21tYW5kIH0gZnJvbSAnY2xpcGFuaW9uJ1xuXG5pbXBvcnQgeyBjb2xsZWN0QXJ0aWZhY3RzIH0gZnJvbSAnLi4vYXBpL2FydGlmYWN0cy5qcydcbmltcG9ydCB7IEJhc2VBcnRpZmFjdHNDb21tYW5kIH0gZnJvbSAnLi4vZGVmL2FydGlmYWN0cy5qcydcblxuZXhwb3J0IGNsYXNzIEFydGlmYWN0c0NvbW1hbmQgZXh0ZW5kcyBCYXNlQXJ0aWZhY3RzQ29tbWFuZCB7XG4gIHN0YXRpYyB1c2FnZSA9IENvbW1hbmQuVXNhZ2Uoe1xuICAgIGRlc2NyaXB0aW9uOiAnQ29weSBhcnRpZmFjdHMgZnJvbSBHaXRodWIgQWN0aW9ucyBpbnRvIHNwZWNpZmllZCBkaXInLFxuICAgIGV4YW1wbGVzOiBbXG4gICAgICBbXG4gICAgICAgICckMCBhcnRpZmFjdHMgLS1vdXRwdXQtZGlyIC4vYXJ0aWZhY3RzIC0tZGlzdCAuL25wbScsXG4gICAgICAgIGBDb3B5IFtiaW5hcnlOYW1lXS5bcGxhdGZvcm1dLm5vZGUgdW5kZXIgY3VycmVudCBkaXIoLikgaW50byBwYWNrYWdlcyB1bmRlciBucG0gZGlyLlxuZS5nOiBpbmRleC5saW51eC14NjQtZ251Lm5vZGUgLS0+IC4vbnBtL2xpbnV4LXg2NC1nbnUvaW5kZXgubGludXgteDY0LWdudS5ub2RlYCxcbiAgICAgIF0sXG4gICAgXSxcbiAgfSlcblxuICBzdGF0aWMgcGF0aHMgPSBbWydhcnRpZmFjdHMnXV1cblxuICBhc3luYyBleGVjdXRlKCkge1xuICAgIGF3YWl0IGNvbGxlY3RBcnRpZmFjdHModGhpcy5nZXRPcHRpb25zKCkpXG4gIH1cbn1cbiIsIi8vIFRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgYnkgY29kZWdlbi9pbmRleC50c1xuLy8gRG8gbm90IGVkaXQgdGhpcyBmaWxlIG1hbnVhbGx5XG5pbXBvcnQgeyBDb21tYW5kLCBPcHRpb24gfSBmcm9tICdjbGlwYW5pb24nXG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlQnVpbGRDb21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gIHN0YXRpYyBwYXRocyA9IFtbJ2J1aWxkJ11dXG5cbiAgc3RhdGljIHVzYWdlID0gQ29tbWFuZC5Vc2FnZSh7XG4gICAgZGVzY3JpcHRpb246ICdCdWlsZCB0aGUgTkFQSS1SUyBwcm9qZWN0JyxcbiAgfSlcblxuICB0YXJnZXQ/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLXRhcmdldCwtdCcsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdCdWlsZCBmb3IgdGhlIHRhcmdldCB0cmlwbGUsIGJ5cGFzc2VkIHRvIGBjYXJnbyBidWlsZCAtLXRhcmdldGAnLFxuICB9KVxuXG4gIGN3ZD86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tY3dkJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1RoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aCcsXG4gIH0pXG5cbiAgbWFuaWZlc3RQYXRoPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1tYW5pZmVzdC1wYXRoJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgQ2FyZ28udG9tbGAnLFxuICB9KVxuXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWNvbmZpZy1wYXRoLC1jJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZScsXG4gIH0pXG5cbiAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1wYWNrYWdlLWpzb24tcGF0aCcsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gYHBhY2thZ2UuanNvbmAnLFxuICB9KVxuXG4gIHRhcmdldERpcj86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tdGFyZ2V0LWRpcicsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdEaXJlY3RvcnkgZm9yIGFsbCBjcmF0ZSBnZW5lcmF0ZWQgYXJ0aWZhY3RzLCBzZWUgYGNhcmdvIGJ1aWxkIC0tdGFyZ2V0LWRpcmAnLFxuICB9KVxuXG4gIG91dHB1dERpcj86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tb3V0cHV0LWRpciwtbycsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdQYXRoIHRvIHdoZXJlIGFsbCB0aGUgYnVpbHQgZmlsZXMgd291bGQgYmUgcHV0LiBEZWZhdWx0IHRvIHRoZSBjcmF0ZSBmb2xkZXInLFxuICB9KVxuXG4gIHBsYXRmb3JtPzogYm9vbGVhbiA9IE9wdGlvbi5Cb29sZWFuKCctLXBsYXRmb3JtJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ0FkZCBwbGF0Zm9ybSB0cmlwbGUgdG8gdGhlIGdlbmVyYXRlZCBub2RlanMgYmluZGluZyBmaWxlLCBlZzogYFtuYW1lXS5saW51eC14NjQtZ251Lm5vZGVgJyxcbiAgfSlcblxuICBqc1BhY2thZ2VOYW1lPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1qcy1wYWNrYWdlLW5hbWUnLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnUGFja2FnZSBuYW1lIGluIGdlbmVyYXRlZCBqcyBiaW5kaW5nIGZpbGUuIE9ubHkgd29ya3Mgd2l0aCBgLS1wbGF0Zm9ybWAgZmxhZycsXG4gIH0pXG5cbiAgY29uc3RFbnVtPzogYm9vbGVhbiA9IE9wdGlvbi5Cb29sZWFuKCctLWNvbnN0LWVudW0nLCB7XG4gICAgZGVzY3JpcHRpb246ICdXaGV0aGVyIGdlbmVyYXRlIGNvbnN0IGVudW0gZm9yIHR5cGVzY3JpcHQgYmluZGluZ3MnLFxuICB9KVxuXG4gIHJ1bnRpbWVTdHJpbmdFbnVtPzogYm9vbGVhbiA9IE9wdGlvbi5Cb29sZWFuKCctLXJ1bnRpbWUtc3RyaW5nLWVudW0nLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnRW1pdCBgI1tuYXBpKHN0cmluZ19lbnVtKV1gIGVudW1zIGFzIHJ1bnRpbWUgZW51bXMgKGBleHBvcnQgZGVjbGFyZSBlbnVtYCkgdW5kZXIgYC0tbm8tY29uc3QtZW51bWAuIERlZmF1bHQ6IHR5cGUtb25seSB1bmlvbi4nLFxuICB9KVxuXG4gIGpzQmluZGluZz86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tanMnLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnUGF0aCBhbmQgZmlsZW5hbWUgb2YgZ2VuZXJhdGVkIEpTIGJpbmRpbmcgZmlsZS4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnLiBSZWxhdGl2ZSB0byBgLS1vdXRwdXQtZGlyYC4nLFxuICB9KVxuXG4gIG5vSnNCaW5kaW5nPzogYm9vbGVhbiA9IE9wdGlvbi5Cb29sZWFuKCctLW5vLWpzJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1doZXRoZXIgdG8gZGlzYWJsZSB0aGUgZ2VuZXJhdGlvbiBKUyBiaW5kaW5nIGZpbGUuIE9ubHkgd29ya3Mgd2l0aCBgLS1wbGF0Zm9ybWAgZmxhZy4nLFxuICB9KVxuXG4gIGR0cz86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tZHRzJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1BhdGggYW5kIGZpbGVuYW1lIG9mIGdlbmVyYXRlZCB0eXBlIGRlZiBmaWxlLiBSZWxhdGl2ZSB0byBgLS1vdXRwdXQtZGlyYCcsXG4gIH0pXG5cbiAgZHRzSGVhZGVyPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1kdHMtaGVhZGVyJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ0N1c3RvbSBmaWxlIGhlYWRlciBmb3IgZ2VuZXJhdGVkIHR5cGUgZGVmIGZpbGUuIE9ubHkgd29ya3Mgd2hlbiBgdHlwZWRlZmAgZmVhdHVyZSBlbmFibGVkLicsXG4gIH0pXG5cbiAgbm9EdHNIZWFkZXI/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tbm8tZHRzLWhlYWRlcicsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdXaGV0aGVyIHRvIGRpc2FibGUgdGhlIGRlZmF1bHQgZmlsZSBoZWFkZXIgZm9yIGdlbmVyYXRlZCB0eXBlIGRlZiBmaWxlLiBPbmx5IHdvcmtzIHdoZW4gYHR5cGVkZWZgIGZlYXR1cmUgZW5hYmxlZC4nLFxuICB9KVxuXG4gIGR0c0NhY2hlID0gT3B0aW9uLkJvb2xlYW4oJy0tZHRzLWNhY2hlJywgdHJ1ZSwge1xuICAgIGRlc2NyaXB0aW9uOiAnV2hldGhlciB0byBlbmFibGUgdGhlIGR0cyBjYWNoZSwgZGVmYXVsdCB0byB0cnVlJyxcbiAgfSlcblxuICBlc20/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tZXNtJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1doZXRoZXIgdG8gZW1pdCBhbiBFU00gSlMgYmluZGluZyBmaWxlIGluc3RlYWQgb2YgQ0pTIGZvcm1hdC4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnLicsXG4gIH0pXG5cbiAgc3RyaXA/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tc3RyaXAsLXMnLCB7XG4gICAgZGVzY3JpcHRpb246ICdXaGV0aGVyIHN0cmlwIHRoZSBsaWJyYXJ5IHRvIGFjaGlldmUgdGhlIG1pbmltdW0gZmlsZSBzaXplJyxcbiAgfSlcblxuICByZWxlYXNlPzogYm9vbGVhbiA9IE9wdGlvbi5Cb29sZWFuKCctLXJlbGVhc2UsLXInLCB7XG4gICAgZGVzY3JpcHRpb246ICdCdWlsZCBpbiByZWxlYXNlIG1vZGUnLFxuICB9KVxuXG4gIHZlcmJvc2U/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tdmVyYm9zZSwtdicsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1ZlcmJvc2VseSBsb2cgYnVpbGQgY29tbWFuZCB0cmFjZScsXG4gIH0pXG5cbiAgYmluPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1iaW4nLCB7XG4gICAgZGVzY3JpcHRpb246ICdCdWlsZCBvbmx5IHRoZSBzcGVjaWZpZWQgYmluYXJ5JyxcbiAgfSlcblxuICBwYWNrYWdlPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1wYWNrYWdlLC1wJywge1xuICAgIGRlc2NyaXB0aW9uOiAnQnVpbGQgdGhlIHNwZWNpZmllZCBsaWJyYXJ5IG9yIHRoZSBvbmUgYXQgY3dkJyxcbiAgfSlcblxuICBwcm9maWxlPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1wcm9maWxlJywge1xuICAgIGRlc2NyaXB0aW9uOiAnQnVpbGQgYXJ0aWZhY3RzIHdpdGggdGhlIHNwZWNpZmllZCBwcm9maWxlJyxcbiAgfSlcblxuICBjcm9zc0NvbXBpbGU/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tY3Jvc3MtY29tcGlsZSwteCcsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdbZXhwZXJpbWVudGFsXSBjcm9zcyBjb21waWxlIGJ5IHJlcGxhY2luZyB0aGUgY2FyZ28gc3ViY29tbWFuZDogV2luZG93cyBNU1ZDIHRhcmdldHMgZnJvbSBhIG5vbi1XaW5kb3dzIGhvc3QgYnVpbGQgd2l0aCBgY2FyZ28teHdpbmAgKGB3aW5kb3dzLWdudWAgdGFyZ2V0cyBhcmUgcmVqZWN0ZWQsIGBjYXJnby14d2luYCBjYW5ub3QgaGFuZGxlIHRoZW0pLCBub24tV2luZG93cyB0YXJnZXRzIGJ1aWxkIHdpdGggYGNhcmdvLXppZ2J1aWxkYCAocmVxdWlyZXMgYHppZ2Agb24gUEFUSCkuIFRoZSBzZWxlY3RlZCBzdWJjb21tYW5kIGlzIGF1dG8taW5zdGFsbGVkIG9uIGZpcnN0IHVzZS4gQ2Fubm90IGJlIGNvbWJpbmVkIHdpdGggYC0tdXNlLWNyb3NzYCwgYC0tdXNlLW5hcGktY3Jvc3NgIG9yIGAtLXdhdGNoYCcsXG4gIH0pXG5cbiAgdXNlQ3Jvc3M/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tdXNlLWNyb3NzJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1tleHBlcmltZW50YWxdIG5vdCByZWNvbW1lbmRlZCwgcHJlZmVyIGAtLWNyb3NzLWNvbXBpbGVgIG9yIGAtLXVzZS1uYXBpLWNyb3NzYDogYnVpbGQgaW4gYSBEb2NrZXIgb3IgUG9kbWFuIGNvbnRhaW5lciB3aXRoIFtjcm9zc10oaHR0cHM6Ly9naXRodWIuY29tL2Nyb3NzLXJzL2Nyb3NzKSwgd2hpY2ggbXVzdCBiZSBpbnN0YWxsZWQgbWFudWFsbHkgYW5kIG5lZWRzIGEgcnVubmluZyBjb250YWluZXIgZW5naW5lLiBDYW5ub3QgYmUgY29tYmluZWQgd2l0aCBgLS1jcm9zcy1jb21waWxlYCwgYC0tdXNlLW5hcGktY3Jvc3NgIG9yIGAtLXdhdGNoYCcsXG4gIH0pXG5cbiAgdXNlTmFwaUNyb3NzPzogYm9vbGVhbiA9IE9wdGlvbi5Cb29sZWFuKCctLXVzZS1uYXBpLWNyb3NzJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1tleHBlcmltZW50YWxdIGRvd25sb2FkIGEgcHJlYnVpbHQgZ2NjIGNyb3NzIHRvb2xjaGFpbiBmcm9tIGBAbmFwaS1ycy9jcm9zcy10b29sY2hhaW5gIChnbGliYyAyLjE3KSBhbmQgc2V0IGxpbmtlciBhbmQgQyBjb21waWxlciBlbnZpcm9ubWVudCB2YXJpYWJsZXMuIExpbnV4IGdsaWJjIHRhcmdldHMgb25seSAoeDY0LCBhcm02NCwgYXJtdjcsIHBwYzY0bGUsIHMzOTB4KSBvbiBhIExpbnV4IHg2NCBvciBhcm02NCBob3N0LCBhbnkgb3RoZXIgdGFyZ2V0IG9yIGhvc3QgZXJyb3JzLiBDYW5ub3QgYmUgY29tYmluZWQgd2l0aCBgLS1jcm9zcy1jb21waWxlYCBvciBgLS11c2UtY3Jvc3NgJyxcbiAgfSlcblxuICB3YXRjaD86IGJvb2xlYW4gPSBPcHRpb24uQm9vbGVhbignLS13YXRjaCwtdycsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICd3YXRjaCB0aGUgY3JhdGUgY2hhbmdlcyBhbmQgYnVpbGQgY29udGludW91c2x5IHdpdGggYGNhcmdvLXdhdGNoYCBjcmF0ZXMnLFxuICB9KVxuXG4gIGZlYXR1cmVzPzogc3RyaW5nW10gPSBPcHRpb24uQXJyYXkoJy0tZmVhdHVyZXMsLUYnLCB7XG4gICAgZGVzY3JpcHRpb246ICdTcGFjZS1zZXBhcmF0ZWQgbGlzdCBvZiBmZWF0dXJlcyB0byBhY3RpdmF0ZScsXG4gIH0pXG5cbiAgYWxsRmVhdHVyZXM/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tYWxsLWZlYXR1cmVzJywge1xuICAgIGRlc2NyaXB0aW9uOiAnQWN0aXZhdGUgYWxsIGF2YWlsYWJsZSBmZWF0dXJlcycsXG4gIH0pXG5cbiAgbm9EZWZhdWx0RmVhdHVyZXM/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tbm8tZGVmYXVsdC1mZWF0dXJlcycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ0RvIG5vdCBhY3RpdmF0ZSB0aGUgYGRlZmF1bHRgIGZlYXR1cmUnLFxuICB9KVxuXG4gIGdldE9wdGlvbnMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRhcmdldDogdGhpcy50YXJnZXQsXG4gICAgICBjd2Q6IHRoaXMuY3dkLFxuICAgICAgbWFuaWZlc3RQYXRoOiB0aGlzLm1hbmlmZXN0UGF0aCxcbiAgICAgIGNvbmZpZ1BhdGg6IHRoaXMuY29uZmlnUGF0aCxcbiAgICAgIHBhY2thZ2VKc29uUGF0aDogdGhpcy5wYWNrYWdlSnNvblBhdGgsXG4gICAgICB0YXJnZXREaXI6IHRoaXMudGFyZ2V0RGlyLFxuICAgICAgb3V0cHV0RGlyOiB0aGlzLm91dHB1dERpcixcbiAgICAgIHBsYXRmb3JtOiB0aGlzLnBsYXRmb3JtLFxuICAgICAganNQYWNrYWdlTmFtZTogdGhpcy5qc1BhY2thZ2VOYW1lLFxuICAgICAgY29uc3RFbnVtOiB0aGlzLmNvbnN0RW51bSxcbiAgICAgIHJ1bnRpbWVTdHJpbmdFbnVtOiB0aGlzLnJ1bnRpbWVTdHJpbmdFbnVtLFxuICAgICAganNCaW5kaW5nOiB0aGlzLmpzQmluZGluZyxcbiAgICAgIG5vSnNCaW5kaW5nOiB0aGlzLm5vSnNCaW5kaW5nLFxuICAgICAgZHRzOiB0aGlzLmR0cyxcbiAgICAgIGR0c0hlYWRlcjogdGhpcy5kdHNIZWFkZXIsXG4gICAgICBub0R0c0hlYWRlcjogdGhpcy5ub0R0c0hlYWRlcixcbiAgICAgIGR0c0NhY2hlOiB0aGlzLmR0c0NhY2hlLFxuICAgICAgZXNtOiB0aGlzLmVzbSxcbiAgICAgIHN0cmlwOiB0aGlzLnN0cmlwLFxuICAgICAgcmVsZWFzZTogdGhpcy5yZWxlYXNlLFxuICAgICAgdmVyYm9zZTogdGhpcy52ZXJib3NlLFxuICAgICAgYmluOiB0aGlzLmJpbixcbiAgICAgIHBhY2thZ2U6IHRoaXMucGFja2FnZSxcbiAgICAgIHByb2ZpbGU6IHRoaXMucHJvZmlsZSxcbiAgICAgIGNyb3NzQ29tcGlsZTogdGhpcy5jcm9zc0NvbXBpbGUsXG4gICAgICB1c2VDcm9zczogdGhpcy51c2VDcm9zcyxcbiAgICAgIHVzZU5hcGlDcm9zczogdGhpcy51c2VOYXBpQ3Jvc3MsXG4gICAgICB3YXRjaDogdGhpcy53YXRjaCxcbiAgICAgIGZlYXR1cmVzOiB0aGlzLmZlYXR1cmVzLFxuICAgICAgYWxsRmVhdHVyZXM6IHRoaXMuYWxsRmVhdHVyZXMsXG4gICAgICBub0RlZmF1bHRGZWF0dXJlczogdGhpcy5ub0RlZmF1bHRGZWF0dXJlcyxcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBCdWlsZCB0aGUgTkFQSS1SUyBwcm9qZWN0XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRPcHRpb25zIHtcbiAgLyoqXG4gICAqIEJ1aWxkIGZvciB0aGUgdGFyZ2V0IHRyaXBsZSwgYnlwYXNzZWQgdG8gYGNhcmdvIGJ1aWxkIC0tdGFyZ2V0YFxuICAgKi9cbiAgdGFyZ2V0Pzogc3RyaW5nXG4gIC8qKlxuICAgKiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGhcbiAgICovXG4gIGN3ZD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgQ2FyZ28udG9tbGBcbiAgICovXG4gIG1hbmlmZXN0UGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgKi9cbiAgY29uZmlnUGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgcGFja2FnZS5qc29uYFxuICAgKi9cbiAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nXG4gIC8qKlxuICAgKiBEaXJlY3RvcnkgZm9yIGFsbCBjcmF0ZSBnZW5lcmF0ZWQgYXJ0aWZhY3RzLCBzZWUgYGNhcmdvIGJ1aWxkIC0tdGFyZ2V0LWRpcmBcbiAgICovXG4gIHRhcmdldERpcj86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byB3aGVyZSBhbGwgdGhlIGJ1aWx0IGZpbGVzIHdvdWxkIGJlIHB1dC4gRGVmYXVsdCB0byB0aGUgY3JhdGUgZm9sZGVyXG4gICAqL1xuICBvdXRwdXREaXI/OiBzdHJpbmdcbiAgLyoqXG4gICAqIEFkZCBwbGF0Zm9ybSB0cmlwbGUgdG8gdGhlIGdlbmVyYXRlZCBub2RlanMgYmluZGluZyBmaWxlLCBlZzogYFtuYW1lXS5saW51eC14NjQtZ251Lm5vZGVgXG4gICAqL1xuICBwbGF0Zm9ybT86IGJvb2xlYW5cbiAgLyoqXG4gICAqIFBhY2thZ2UgbmFtZSBpbiBnZW5lcmF0ZWQganMgYmluZGluZyBmaWxlLiBPbmx5IHdvcmtzIHdpdGggYC0tcGxhdGZvcm1gIGZsYWdcbiAgICovXG4gIGpzUGFja2FnZU5hbWU/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFdoZXRoZXIgZ2VuZXJhdGUgY29uc3QgZW51bSBmb3IgdHlwZXNjcmlwdCBiaW5kaW5nc1xuICAgKi9cbiAgY29uc3RFbnVtPzogYm9vbGVhblxuICAvKipcbiAgICogRW1pdCBgI1tuYXBpKHN0cmluZ19lbnVtKV1gIGVudW1zIGFzIHJ1bnRpbWUgZW51bXMgKGBleHBvcnQgZGVjbGFyZSBlbnVtYCkgdW5kZXIgYC0tbm8tY29uc3QtZW51bWAuIERlZmF1bHQ6IHR5cGUtb25seSB1bmlvbi5cbiAgICovXG4gIHJ1bnRpbWVTdHJpbmdFbnVtPzogYm9vbGVhblxuICAvKipcbiAgICogUGF0aCBhbmQgZmlsZW5hbWUgb2YgZ2VuZXJhdGVkIEpTIGJpbmRpbmcgZmlsZS4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnLiBSZWxhdGl2ZSB0byBgLS1vdXRwdXQtZGlyYC5cbiAgICovXG4gIGpzQmluZGluZz86IHN0cmluZ1xuICAvKipcbiAgICogV2hldGhlciB0byBkaXNhYmxlIHRoZSBnZW5lcmF0aW9uIEpTIGJpbmRpbmcgZmlsZS4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnLlxuICAgKi9cbiAgbm9Kc0JpbmRpbmc/OiBib29sZWFuXG4gIC8qKlxuICAgKiBQYXRoIGFuZCBmaWxlbmFtZSBvZiBnZW5lcmF0ZWQgdHlwZSBkZWYgZmlsZS4gUmVsYXRpdmUgdG8gYC0tb3V0cHV0LWRpcmBcbiAgICovXG4gIGR0cz86IHN0cmluZ1xuICAvKipcbiAgICogQ3VzdG9tIGZpbGUgaGVhZGVyIGZvciBnZW5lcmF0ZWQgdHlwZSBkZWYgZmlsZS4gT25seSB3b3JrcyB3aGVuIGB0eXBlZGVmYCBmZWF0dXJlIGVuYWJsZWQuXG4gICAqL1xuICBkdHNIZWFkZXI/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gZGlzYWJsZSB0aGUgZGVmYXVsdCBmaWxlIGhlYWRlciBmb3IgZ2VuZXJhdGVkIHR5cGUgZGVmIGZpbGUuIE9ubHkgd29ya3Mgd2hlbiBgdHlwZWRlZmAgZmVhdHVyZSBlbmFibGVkLlxuICAgKi9cbiAgbm9EdHNIZWFkZXI/OiBib29sZWFuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGVuYWJsZSB0aGUgZHRzIGNhY2hlLCBkZWZhdWx0IHRvIHRydWVcbiAgICpcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgZHRzQ2FjaGU/OiBib29sZWFuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGVtaXQgYW4gRVNNIEpTIGJpbmRpbmcgZmlsZSBpbnN0ZWFkIG9mIENKUyBmb3JtYXQuIE9ubHkgd29ya3Mgd2l0aCBgLS1wbGF0Zm9ybWAgZmxhZy5cbiAgICovXG4gIGVzbT86IGJvb2xlYW5cbiAgLyoqXG4gICAqIFdoZXRoZXIgc3RyaXAgdGhlIGxpYnJhcnkgdG8gYWNoaWV2ZSB0aGUgbWluaW11bSBmaWxlIHNpemVcbiAgICovXG4gIHN0cmlwPzogYm9vbGVhblxuICAvKipcbiAgICogQnVpbGQgaW4gcmVsZWFzZSBtb2RlXG4gICAqL1xuICByZWxlYXNlPzogYm9vbGVhblxuICAvKipcbiAgICogVmVyYm9zZWx5IGxvZyBidWlsZCBjb21tYW5kIHRyYWNlXG4gICAqL1xuICB2ZXJib3NlPzogYm9vbGVhblxuICAvKipcbiAgICogQnVpbGQgb25seSB0aGUgc3BlY2lmaWVkIGJpbmFyeVxuICAgKi9cbiAgYmluPzogc3RyaW5nXG4gIC8qKlxuICAgKiBCdWlsZCB0aGUgc3BlY2lmaWVkIGxpYnJhcnkgb3IgdGhlIG9uZSBhdCBjd2RcbiAgICovXG4gIHBhY2thZ2U/OiBzdHJpbmdcbiAgLyoqXG4gICAqIEJ1aWxkIGFydGlmYWN0cyB3aXRoIHRoZSBzcGVjaWZpZWQgcHJvZmlsZVxuICAgKi9cbiAgcHJvZmlsZT86IHN0cmluZ1xuICAvKipcbiAgICogW2V4cGVyaW1lbnRhbF0gY3Jvc3MgY29tcGlsZSBieSByZXBsYWNpbmcgdGhlIGNhcmdvIHN1YmNvbW1hbmQ6IFdpbmRvd3MgTVNWQyB0YXJnZXRzIGZyb20gYSBub24tV2luZG93cyBob3N0IGJ1aWxkIHdpdGggYGNhcmdvLXh3aW5gIChgd2luZG93cy1nbnVgIHRhcmdldHMgYXJlIHJlamVjdGVkLCBgY2FyZ28teHdpbmAgY2Fubm90IGhhbmRsZSB0aGVtKSwgbm9uLVdpbmRvd3MgdGFyZ2V0cyBidWlsZCB3aXRoIGBjYXJnby16aWdidWlsZGAgKHJlcXVpcmVzIGB6aWdgIG9uIFBBVEgpLiBUaGUgc2VsZWN0ZWQgc3ViY29tbWFuZCBpcyBhdXRvLWluc3RhbGxlZCBvbiBmaXJzdCB1c2UuIENhbm5vdCBiZSBjb21iaW5lZCB3aXRoIGAtLXVzZS1jcm9zc2AsIGAtLXVzZS1uYXBpLWNyb3NzYCBvciBgLS13YXRjaGBcbiAgICovXG4gIGNyb3NzQ29tcGlsZT86IGJvb2xlYW5cbiAgLyoqXG4gICAqIFtleHBlcmltZW50YWxdIG5vdCByZWNvbW1lbmRlZCwgcHJlZmVyIGAtLWNyb3NzLWNvbXBpbGVgIG9yIGAtLXVzZS1uYXBpLWNyb3NzYDogYnVpbGQgaW4gYSBEb2NrZXIgb3IgUG9kbWFuIGNvbnRhaW5lciB3aXRoIFtjcm9zc10oaHR0cHM6Ly9naXRodWIuY29tL2Nyb3NzLXJzL2Nyb3NzKSwgd2hpY2ggbXVzdCBiZSBpbnN0YWxsZWQgbWFudWFsbHkgYW5kIG5lZWRzIGEgcnVubmluZyBjb250YWluZXIgZW5naW5lLiBDYW5ub3QgYmUgY29tYmluZWQgd2l0aCBgLS1jcm9zcy1jb21waWxlYCwgYC0tdXNlLW5hcGktY3Jvc3NgIG9yIGAtLXdhdGNoYFxuICAgKi9cbiAgdXNlQ3Jvc3M/OiBib29sZWFuXG4gIC8qKlxuICAgKiBbZXhwZXJpbWVudGFsXSBkb3dubG9hZCBhIHByZWJ1aWx0IGdjYyBjcm9zcyB0b29sY2hhaW4gZnJvbSBgQG5hcGktcnMvY3Jvc3MtdG9vbGNoYWluYCAoZ2xpYmMgMi4xNykgYW5kIHNldCBsaW5rZXIgYW5kIEMgY29tcGlsZXIgZW52aXJvbm1lbnQgdmFyaWFibGVzLiBMaW51eCBnbGliYyB0YXJnZXRzIG9ubHkgKHg2NCwgYXJtNjQsIGFybXY3LCBwcGM2NGxlLCBzMzkweCkgb24gYSBMaW51eCB4NjQgb3IgYXJtNjQgaG9zdCwgYW55IG90aGVyIHRhcmdldCBvciBob3N0IGVycm9ycy4gQ2Fubm90IGJlIGNvbWJpbmVkIHdpdGggYC0tY3Jvc3MtY29tcGlsZWAgb3IgYC0tdXNlLWNyb3NzYFxuICAgKi9cbiAgdXNlTmFwaUNyb3NzPzogYm9vbGVhblxuICAvKipcbiAgICogd2F0Y2ggdGhlIGNyYXRlIGNoYW5nZXMgYW5kIGJ1aWxkIGNvbnRpbnVvdXNseSB3aXRoIGBjYXJnby13YXRjaGAgY3JhdGVzXG4gICAqL1xuICB3YXRjaD86IGJvb2xlYW5cbiAgLyoqXG4gICAqIFNwYWNlLXNlcGFyYXRlZCBsaXN0IG9mIGZlYXR1cmVzIHRvIGFjdGl2YXRlXG4gICAqL1xuICBmZWF0dXJlcz86IHN0cmluZ1tdXG4gIC8qKlxuICAgKiBBY3RpdmF0ZSBhbGwgYXZhaWxhYmxlIGZlYXR1cmVzXG4gICAqL1xuICBhbGxGZWF0dXJlcz86IGJvb2xlYW5cbiAgLyoqXG4gICAqIERvIG5vdCBhY3RpdmF0ZSB0aGUgYGRlZmF1bHRgIGZlYXR1cmVcbiAgICovXG4gIG5vRGVmYXVsdEZlYXR1cmVzPzogYm9vbGVhblxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlEZWZhdWx0QnVpbGRPcHRpb25zKG9wdGlvbnM6IEJ1aWxkT3B0aW9ucykge1xuICByZXR1cm4ge1xuICAgIGR0c0NhY2hlOiB0cnVlLFxuICAgIC4uLm9wdGlvbnMsXG4gIH1cbn1cbiIsImltcG9ydCB7IGV4ZWNTeW5jIH0gZnJvbSAnbm9kZTpjaGlsZF9wcm9jZXNzJ1xuXG5pbXBvcnQgeyBPcHRpb24gfSBmcm9tICdjbGlwYW5pb24nXG5cbmltcG9ydCB7IGJ1aWxkUHJvamVjdCB9IGZyb20gJy4uL2FwaS9idWlsZC5qcydcbmltcG9ydCB7IEJhc2VCdWlsZENvbW1hbmQgfSBmcm9tICcuLi9kZWYvYnVpbGQuanMnXG5pbXBvcnQgeyBkZWJ1Z0ZhY3RvcnkgfSBmcm9tICcuLi91dGlscy9pbmRleC5qcydcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ2J1aWxkJylcblxuZXhwb3J0IGNsYXNzIEJ1aWxkQ29tbWFuZCBleHRlbmRzIEJhc2VCdWlsZENvbW1hbmQge1xuICBwaXBlID0gT3B0aW9uLlN0cmluZygnLS1waXBlJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1BpcGUgYWxsIG91dHB1dHMgZmlsZSB0byBnaXZlbiBjb21tYW5kLiBlLmcuIGBuYXBpIGJ1aWxkIC0tcGlwZSBcIm5weCBwcmV0dGllciAtLXdyaXRlXCJgJyxcbiAgfSlcblxuICBjYXJnb09wdGlvbnMgPSBPcHRpb24uUmVzdCgpXG5cbiAgYXN5bmMgZXhlY3V0ZSgpIHtcbiAgICBjb25zdCB7IHRhc2sgfSA9IGF3YWl0IGJ1aWxkUHJvamVjdCh7XG4gICAgICAuLi50aGlzLmdldE9wdGlvbnMoKSxcbiAgICAgIGNhcmdvT3B0aW9uczogdGhpcy5jYXJnb09wdGlvbnMsXG4gICAgfSlcblxuICAgIGNvbnN0IG91dHB1dHMgPSBhd2FpdCB0YXNrXG5cbiAgICBpZiAodGhpcy5waXBlKSB7XG4gICAgICBmb3IgKGNvbnN0IG91dHB1dCBvZiBvdXRwdXRzKSB7XG4gICAgICAgIGRlYnVnKCdQaXBpbmcgb3V0cHV0IGZpbGUgdG8gY29tbWFuZDogJXMnLCB0aGlzLnBpcGUpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgZXhlY1N5bmMoYCR7dGhpcy5waXBlfSAke291dHB1dC5wYXRofWAsIHtcbiAgICAgICAgICAgIHN0ZGlvOiAnaW5oZXJpdCcsXG4gICAgICAgICAgICBjd2Q6IHRoaXMuY3dkLFxuICAgICAgICAgIH0pXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBkZWJ1Zy5lcnJvcihgRmFpbGVkIHRvIHBpcGUgb3V0cHV0IGZpbGUgJHtvdXRwdXQucGF0aH0gdG8gY29tbWFuZGApXG4gICAgICAgICAgZGVidWcuZXJyb3IoZSlcbiAgICAgICAgICB0aHJvdyBlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IENvbW1hbmQgfSBmcm9tICdjbGlwYW5pb24nXG5cbmltcG9ydCB7IENMSV9WRVJTSU9OIH0gZnJvbSAnLi4vdXRpbHMvbWlzYy5qcydcblxuLyoqXG4gKiBBIGNvbW1hbmQgdGhhdCBwcmludHMgdGhlIHZlcnNpb24gb2YgdGhlIENMSS5cbiAqXG4gKiBQYXRoczogYC12YCwgYC0tdmVyc2lvbmBcbiAqL1xuZXhwb3J0IGNsYXNzIENsaVZlcnNpb25Db21tYW5kIGV4dGVuZHMgQ29tbWFuZDxhbnk+IHtcbiAgc3RhdGljIHBhdGhzID0gW1tgLXZgXSwgW2AtLXZlcnNpb25gXV1cbiAgYXN5bmMgZXhlY3V0ZSgpIHtcbiAgICBhd2FpdCB0aGlzLmNvbnRleHQuc3Rkb3V0LndyaXRlKGAke0NMSV9WRVJTSU9OfVxcbmApXG4gIH1cbn1cbiIsImltcG9ydCB7IGNyZWF0ZU5wbURpcnMgfSBmcm9tICcuLi9hcGkvY3JlYXRlLW5wbS1kaXJzLmpzJ1xuaW1wb3J0IHsgQmFzZUNyZWF0ZU5wbURpcnNDb21tYW5kIH0gZnJvbSAnLi4vZGVmL2NyZWF0ZS1ucG0tZGlycy5qcydcblxuZXhwb3J0IGNsYXNzIENyZWF0ZU5wbURpcnNDb21tYW5kIGV4dGVuZHMgQmFzZUNyZWF0ZU5wbURpcnNDb21tYW5kIHtcbiAgYXN5bmMgZXhlY3V0ZSgpIHtcbiAgICBhd2FpdCBjcmVhdGVOcG1EaXJzKHRoaXMuZ2V0T3B0aW9ucygpKVxuICB9XG59XG4iLCJpbXBvcnQgeyBDb21tYW5kIH0gZnJvbSAnY2xpcGFuaW9uJ1xuXG4vKipcbiAqIEEgY29tbWFuZCB0aGF0IHByaW50cyB0aGUgdXNhZ2Ugb2YgYWxsIGNvbW1hbmRzLlxuICpcbiAqIFBhdGhzOiBgLWhgLCBgLS1oZWxwYFxuICovXG5leHBvcnQgY2xhc3MgSGVscENvbW1hbmQgZXh0ZW5kcyBDb21tYW5kPGFueT4ge1xuICBzdGF0aWMgcGF0aHMgPSBbW2AtaGBdLCBbYC0taGVscGBdXVxuICBhc3luYyBleGVjdXRlKCkge1xuICAgIGF3YWl0IHRoaXMuY29udGV4dC5zdGRvdXQud3JpdGUodGhpcy5jbGkudXNhZ2UoKSlcbiAgfVxufVxuIiwiaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJ1xuXG5pbXBvcnQgeyBpbnB1dCwgc2VsZWN0LCBjaGVja2JveCwgY29uZmlybSB9IGZyb20gJ0BpbnF1aXJlci9wcm9tcHRzJ1xuaW1wb3J0IHsgT3B0aW9uIH0gZnJvbSAnY2xpcGFuaW9uJ1xuXG5pbXBvcnQgeyBuZXdQcm9qZWN0IH0gZnJvbSAnLi4vYXBpL25ldy5qcydcbmltcG9ydCB7IEJhc2VOZXdDb21tYW5kIH0gZnJvbSAnLi4vZGVmL25ldy5qcydcbmltcG9ydCB7XG4gIEFWQUlMQUJMRV9UQVJHRVRTLFxuICBkZWJ1Z0ZhY3RvcnksXG4gIERFRkFVTFRfVEFSR0VUUyxcbiAgdHlwZSBUYXJnZXRUcmlwbGUsXG59IGZyb20gJy4uL3V0aWxzL2luZGV4LmpzJ1xuaW1wb3J0IHtcbiAgbmFwaUVuZ2luZVJlcXVpcmVtZW50LFxuICBTVVBQT1JURURfTkFQSV9WRVJTSU9OUyxcbn0gZnJvbSAnLi4vdXRpbHMvdmVyc2lvbi5qcydcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ25ldycpXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXROYXBpVmVyc2lvbkNob2ljZXMoKSB7XG4gIHJldHVybiBTVVBQT1JURURfTkFQSV9WRVJTSU9OUy5tYXAoKHZlcnNpb24pID0+ICh7XG4gICAgbmFtZTogYG5hcGkke3ZlcnNpb259ICgke25hcGlFbmdpbmVSZXF1aXJlbWVudCh2ZXJzaW9uKX0pYCxcbiAgICB2YWx1ZTogdmVyc2lvbixcbiAgfSkpXG59XG5cbmV4cG9ydCBjbGFzcyBOZXdDb21tYW5kIGV4dGVuZHMgQmFzZU5ld0NvbW1hbmQge1xuICBpbnRlcmFjdGl2ZSA9IE9wdGlvbi5Cb29sZWFuKCctLWludGVyYWN0aXZlLC1pJywgdHJ1ZSwge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ0FzayBwcm9qZWN0IGJhc2ljIGluZm9ybWF0aW9uIGludGVyYWN0aXZlbHkgd2l0aG91dCBqdXN0IHVzaW5nIHRoZSBkZWZhdWx0LicsXG4gIH0pXG5cbiAgYXN5bmMgZXhlY3V0ZSgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMuZmV0Y2hPcHRpb25zKClcbiAgICAgIGF3YWl0IG5ld1Byb2plY3Qob3B0aW9ucylcbiAgICAgIHJldHVybiAwXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZGVidWcoJ0ZhaWxlZCB0byBjcmVhdGUgbmV3IHByb2plY3QnKVxuICAgICAgZGVidWcuZXJyb3IoZSlcbiAgICAgIHJldHVybiAxXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBmZXRjaE9wdGlvbnMoKSB7XG4gICAgY29uc3QgY21kT3B0aW9ucyA9IHN1cGVyLmdldE9wdGlvbnMoKVxuXG4gICAgaWYgKHRoaXMuaW50ZXJhY3RpdmUpIHtcbiAgICAgIGNvbnN0IHRhcmdldFBhdGg6IHN0cmluZyA9IGNtZE9wdGlvbnMucGF0aFxuICAgICAgICA/IGNtZE9wdGlvbnMucGF0aFxuICAgICAgICA6IGF3YWl0IGlucXVpcmVyUHJvamVjdFBhdGgoKVxuICAgICAgY21kT3B0aW9ucy5wYXRoID0gdGFyZ2V0UGF0aFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4uY21kT3B0aW9ucyxcbiAgICAgICAgbmFtZTogYXdhaXQgdGhpcy5mZXRjaE5hbWUocGF0aC5wYXJzZSh0YXJnZXRQYXRoKS5iYXNlKSxcbiAgICAgICAgbWluTm9kZUFwaVZlcnNpb246IGF3YWl0IHRoaXMuZmV0Y2hOYXBpVmVyc2lvbigpLFxuICAgICAgICB0YXJnZXRzOiBhd2FpdCB0aGlzLmZldGNoVGFyZ2V0cygpLFxuICAgICAgICBsaWNlbnNlOiBhd2FpdCB0aGlzLmZldGNoTGljZW5zZSgpLFxuICAgICAgICBlbmFibGVUeXBlRGVmOiBhd2FpdCB0aGlzLmZldGNoVHlwZURlZigpLFxuICAgICAgICBlbmFibGVHaXRodWJBY3Rpb25zOiBhd2FpdCB0aGlzLmZldGNoR2l0aHViQWN0aW9ucygpLFxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBjbWRPcHRpb25zXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGZldGNoTmFtZShkZWZhdWx0TmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy4kJG5hbWUgPz9cbiAgICAgIGlucHV0KHtcbiAgICAgICAgbWVzc2FnZTogJ1BhY2thZ2UgbmFtZSAodGhlIG5hbWUgZmllbGQgaW4geW91ciBwYWNrYWdlLmpzb24gZmlsZSknLFxuICAgICAgICBkZWZhdWx0OiBkZWZhdWx0TmFtZSxcbiAgICAgIH0pXG4gICAgKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBmZXRjaExpY2Vuc2UoKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gaW5wdXQoe1xuICAgICAgbWVzc2FnZTogJ0xpY2Vuc2UgZm9yIG9wZW4tc291cmNlZCBwcm9qZWN0JyxcbiAgICAgIGRlZmF1bHQ6IHRoaXMubGljZW5zZSxcbiAgICB9KVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBmZXRjaE5hcGlWZXJzaW9uKCk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgcmV0dXJuIHNlbGVjdCh7XG4gICAgICBtZXNzYWdlOiAnTWluaW11bSBub2RlLWFwaSB2ZXJzaW9uICh3aXRoIG5vZGUgdmVyc2lvbiByZXF1aXJlbWVudCknLFxuICAgICAgbG9vcDogZmFsc2UsXG4gICAgICBwYWdlU2l6ZTogMTAsXG4gICAgICBjaG9pY2VzOiBnZXROYXBpVmVyc2lvbkNob2ljZXMoKSxcbiAgICAgIC8vIGNob2ljZSBpbmRleFxuICAgICAgZGVmYXVsdDogdGhpcy5taW5Ob2RlQXBpVmVyc2lvbiAtIDEsXG4gICAgfSlcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZmV0Y2hUYXJnZXRzKCk6IFByb21pc2U8VGFyZ2V0VHJpcGxlW10+IHtcbiAgICBpZiAodGhpcy5lbmFibGVBbGxUYXJnZXRzKSB7XG4gICAgICByZXR1cm4gQVZBSUxBQkxFX1RBUkdFVFMuY29uY2F0KClcbiAgICB9XG5cbiAgICBjb25zdCB0YXJnZXRzID0gYXdhaXQgY2hlY2tib3goe1xuICAgICAgbG9vcDogZmFsc2UsXG4gICAgICBtZXNzYWdlOiAnQ2hvb3NlIHRhcmdldChzKSB5b3VyIGNyYXRlIHdpbGwgYmUgY29tcGlsZWQgdG8nLFxuICAgICAgY2hvaWNlczogQVZBSUxBQkxFX1RBUkdFVFMubWFwKCh0YXJnZXQpID0+ICh7XG4gICAgICAgIG5hbWU6IHRhcmdldCxcbiAgICAgICAgdmFsdWU6IHRhcmdldCxcbiAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxuICAgICAgICBjaGVja2VkOiBERUZBVUxUX1RBUkdFVFMuaW5jbHVkZXModGFyZ2V0KSxcbiAgICAgIH0pKSxcbiAgICB9KVxuXG4gICAgcmV0dXJuIHRhcmdldHNcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZmV0Y2hUeXBlRGVmKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IGVuYWJsZVR5cGVEZWYgPSBhd2FpdCBjb25maXJtKHtcbiAgICAgIG1lc3NhZ2U6ICdFbmFibGUgdHlwZSBkZWZpbml0aW9uIGF1dG8tZ2VuZXJhdGlvbicsXG4gICAgICBkZWZhdWx0OiB0aGlzLmVuYWJsZVR5cGVEZWYsXG4gICAgfSlcblxuICAgIHJldHVybiBlbmFibGVUeXBlRGVmXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGZldGNoR2l0aHViQWN0aW9ucygpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCBlbmFibGVHaXRodWJBY3Rpb25zID0gYXdhaXQgY29uZmlybSh7XG4gICAgICBtZXNzYWdlOiAnRW5hYmxlIEdpdGh1YiBBY3Rpb25zIENJJyxcbiAgICAgIGRlZmF1bHQ6IHRoaXMuZW5hYmxlR2l0aHViQWN0aW9ucyxcbiAgICB9KVxuXG4gICAgcmV0dXJuIGVuYWJsZUdpdGh1YkFjdGlvbnNcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBpbnF1aXJlclByb2plY3RQYXRoKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gIHJldHVybiBpbnB1dCh7XG4gICAgbWVzc2FnZTogJ1RhcmdldCBwYXRoIHRvIGNyZWF0ZSB0aGUgcHJvamVjdCwgcmVsYXRpdmUgdG8gY3dkLicsXG4gIH0pLnRoZW4oKHBhdGgpID0+IHtcbiAgICBpZiAoIXBhdGgpIHtcbiAgICAgIHJldHVybiBpbnF1aXJlclByb2plY3RQYXRoKClcbiAgICB9XG4gICAgcmV0dXJuIHBhdGhcbiAgfSlcbn1cbiIsImltcG9ydCB7IHByZVB1Ymxpc2ggfSBmcm9tICcuLi9hcGkvcHJlLXB1Ymxpc2guanMnXG5pbXBvcnQgeyBCYXNlUHJlUHVibGlzaENvbW1hbmQgfSBmcm9tICcuLi9kZWYvcHJlLXB1Ymxpc2guanMnXG5cbmV4cG9ydCBjbGFzcyBQcmVQdWJsaXNoQ29tbWFuZCBleHRlbmRzIEJhc2VQcmVQdWJsaXNoQ29tbWFuZCB7XG4gIGFzeW5jIGV4ZWN1dGUoKSB7XG4gICAgLy8gQHRzLWV4cGVjdC1lcnJvciBjb25zdCAnbnBtJyB8ICdsZXJuYScgdG8gc3RyaW5nXG4gICAgYXdhaXQgcHJlUHVibGlzaCh0aGlzLmdldE9wdGlvbnMoKSlcbiAgfVxufVxuIiwiaW1wb3J0IHsgaW5wdXQgfSBmcm9tICdAaW5xdWlyZXIvcHJvbXB0cydcblxuaW1wb3J0IHsgcmVuYW1lUHJvamVjdCB9IGZyb20gJy4uL2FwaS9yZW5hbWUuanMnXG5pbXBvcnQgeyBCYXNlUmVuYW1lQ29tbWFuZCB9IGZyb20gJy4uL2RlZi9yZW5hbWUuanMnXG5cbmV4cG9ydCBjbGFzcyBSZW5hbWVDb21tYW5kIGV4dGVuZHMgQmFzZVJlbmFtZUNvbW1hbmQge1xuICBhc3luYyBleGVjdXRlKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLmdldE9wdGlvbnMoKVxuICAgIGlmICghb3B0aW9ucy5uYW1lKSB7XG4gICAgICBjb25zdCBuYW1lID0gYXdhaXQgaW5wdXQoe1xuICAgICAgICBtZXNzYWdlOiBgRW50ZXIgdGhlIG5ldyBwYWNrYWdlIG5hbWUgaW4gdGhlIHBhY2thZ2UuanNvbmAsXG4gICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgfSlcbiAgICAgIG9wdGlvbnMubmFtZSA9IG5hbWVcbiAgICB9XG4gICAgaWYgKCFvcHRpb25zLmJpbmFyeU5hbWUpIHtcbiAgICAgIGNvbnN0IGJpbmFyeU5hbWUgPSBhd2FpdCBpbnB1dCh7XG4gICAgICAgIG1lc3NhZ2U6IGBFbnRlciB0aGUgbmV3IGJpbmFyeSBuYW1lYCxcbiAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICB9KVxuICAgICAgb3B0aW9ucy5iaW5hcnlOYW1lID0gYmluYXJ5TmFtZVxuICAgIH1cbiAgICBhd2FpdCByZW5hbWVQcm9qZWN0KG9wdGlvbnMpXG4gIH1cbn1cbiIsImltcG9ydCB7IHVuaXZlcnNhbGl6ZUJpbmFyaWVzIH0gZnJvbSAnLi4vYXBpL3VuaXZlcnNhbGl6ZS5qcydcbmltcG9ydCB7IEJhc2VVbml2ZXJzYWxpemVDb21tYW5kIH0gZnJvbSAnLi4vZGVmL3VuaXZlcnNhbGl6ZS5qcydcblxuZXhwb3J0IGNsYXNzIFVuaXZlcnNhbGl6ZUNvbW1hbmQgZXh0ZW5kcyBCYXNlVW5pdmVyc2FsaXplQ29tbWFuZCB7XG4gIGFzeW5jIGV4ZWN1dGUoKSB7XG4gICAgYXdhaXQgdW5pdmVyc2FsaXplQmluYXJpZXModGhpcy5nZXRPcHRpb25zKCkpXG4gIH1cbn1cbiIsImltcG9ydCB7IHZlcnNpb24gfSBmcm9tICcuLi9hcGkvdmVyc2lvbi5qcydcbmltcG9ydCB7IEJhc2VWZXJzaW9uQ29tbWFuZCB9IGZyb20gJy4uL2RlZi92ZXJzaW9uLmpzJ1xuXG5leHBvcnQgY2xhc3MgVmVyc2lvbkNvbW1hbmQgZXh0ZW5kcyBCYXNlVmVyc2lvbkNvbW1hbmQge1xuICBhc3luYyBleGVjdXRlKCkge1xuICAgIGF3YWl0IHZlcnNpb24odGhpcy5nZXRPcHRpb25zKCkpXG4gIH1cbn1cbiIsImltcG9ydCB7IENsaSB9IGZyb20gJ2NsaXBhbmlvbidcblxuaW1wb3J0IHsgY29sbGVjdEFydGlmYWN0cyB9IGZyb20gJy4vYXBpL2FydGlmYWN0cy5qcydcbmltcG9ydCB7IGJ1aWxkUHJvamVjdCB9IGZyb20gJy4vYXBpL2J1aWxkLmpzJ1xuaW1wb3J0IHsgY3JlYXRlTnBtRGlycyB9IGZyb20gJy4vYXBpL2NyZWF0ZS1ucG0tZGlycy5qcydcbmltcG9ydCB7IG5ld1Byb2plY3QgfSBmcm9tICcuL2FwaS9uZXcuanMnXG5pbXBvcnQgeyBwcmVQdWJsaXNoIH0gZnJvbSAnLi9hcGkvcHJlLXB1Ymxpc2guanMnXG5pbXBvcnQgeyByZW5hbWVQcm9qZWN0IH0gZnJvbSAnLi9hcGkvcmVuYW1lLmpzJ1xuaW1wb3J0IHsgdW5pdmVyc2FsaXplQmluYXJpZXMgfSBmcm9tICcuL2FwaS91bml2ZXJzYWxpemUuanMnXG5pbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSAnLi9hcGkvdmVyc2lvbi5qcydcbmltcG9ydCB7IEFydGlmYWN0c0NvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL2FydGlmYWN0cy5qcydcbmltcG9ydCB7IEJ1aWxkQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvYnVpbGQuanMnXG5pbXBvcnQgeyBDbGlWZXJzaW9uQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvY2xpLXZlcnNpb24uanMnXG5pbXBvcnQgeyBDcmVhdGVOcG1EaXJzQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvY3JlYXRlLW5wbS1kaXJzLmpzJ1xuaW1wb3J0IHsgSGVscENvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL2hlbHAuanMnXG5pbXBvcnQgeyBOZXdDb21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy9uZXcuanMnXG5pbXBvcnQgeyBQcmVQdWJsaXNoQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvcHJlLXB1Ymxpc2guanMnXG5pbXBvcnQgeyBSZW5hbWVDb21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy9yZW5hbWUuanMnXG5pbXBvcnQgeyBVbml2ZXJzYWxpemVDb21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy91bml2ZXJzYWxpemUuanMnXG5pbXBvcnQgeyBWZXJzaW9uQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvdmVyc2lvbi5qcydcbmltcG9ydCB7IENMSV9WRVJTSU9OIH0gZnJvbSAnLi91dGlscy9taXNjLmpzJ1xuXG5leHBvcnQgY29uc3QgY2xpID0gbmV3IENsaSh7XG4gIGJpbmFyeU5hbWU6ICduYXBpJyxcbiAgYmluYXJ5VmVyc2lvbjogQ0xJX1ZFUlNJT04sXG59KVxuXG5jbGkucmVnaXN0ZXIoTmV3Q29tbWFuZClcbmNsaS5yZWdpc3RlcihCdWlsZENvbW1hbmQpXG5jbGkucmVnaXN0ZXIoQ3JlYXRlTnBtRGlyc0NvbW1hbmQpXG5jbGkucmVnaXN0ZXIoQXJ0aWZhY3RzQ29tbWFuZClcbmNsaS5yZWdpc3RlcihVbml2ZXJzYWxpemVDb21tYW5kKVxuY2xpLnJlZ2lzdGVyKFJlbmFtZUNvbW1hbmQpXG5jbGkucmVnaXN0ZXIoUHJlUHVibGlzaENvbW1hbmQpXG5jbGkucmVnaXN0ZXIoVmVyc2lvbkNvbW1hbmQpXG5jbGkucmVnaXN0ZXIoSGVscENvbW1hbmQpXG5jbGkucmVnaXN0ZXIoQ2xpVmVyc2lvbkNvbW1hbmQpXG5cbi8qKlxuICpcbiAqIEB1c2FnZVxuICpcbiAqIGBgYHRzXG4gKiBjb25zdCBjbGkgPSBuZXcgTmFwaUNsaSgpXG4gKlxuICogY2xpLmJ1aWxkKHtcbiAqICAgY3dkOiAnL3BhdGgvdG8veW91ci9wcm9qZWN0JyxcbiAqIH0pXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIE5hcGlDbGkge1xuICBhcnRpZmFjdHMgPSBjb2xsZWN0QXJ0aWZhY3RzXG4gIG5ldyA9IG5ld1Byb2plY3RcbiAgYnVpbGQgPSBidWlsZFByb2plY3RcbiAgY3JlYXRlTnBtRGlycyA9IGNyZWF0ZU5wbURpcnNcbiAgcHJlUHVibGlzaCA9IHByZVB1Ymxpc2hcbiAgcmVuYW1lID0gcmVuYW1lUHJvamVjdFxuICB1bml2ZXJzYWxpemUgPSB1bml2ZXJzYWxpemVCaW5hcmllc1xuICB2ZXJzaW9uID0gdmVyc2lvblxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQnVpbGRDb21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogQnVpbGRDb21tYW5kIHtcbiAgcmV0dXJuIGNsaS5wcm9jZXNzKFsnYnVpbGQnLCAuLi5hcmdzXSkgYXMgQnVpbGRDb21tYW5kXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBcnRpZmFjdHNDb21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogQXJ0aWZhY3RzQ29tbWFuZCB7XG4gIHJldHVybiBjbGkucHJvY2VzcyhbJ2FydGlmYWN0cycsIC4uLmFyZ3NdKSBhcyBBcnRpZmFjdHNDb21tYW5kXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDcmVhdGVOcG1EaXJzQ29tbWFuZChcbiAgYXJnczogc3RyaW5nW10sXG4pOiBDcmVhdGVOcG1EaXJzQ29tbWFuZCB7XG4gIHJldHVybiBjbGkucHJvY2VzcyhbJ2NyZWF0ZS1ucG0tZGlycycsIC4uLmFyZ3NdKSBhcyBDcmVhdGVOcG1EaXJzQ29tbWFuZFxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUHJlUHVibGlzaENvbW1hbmQoYXJnczogc3RyaW5nW10pOiBQcmVQdWJsaXNoQ29tbWFuZCB7XG4gIHJldHVybiBjbGkucHJvY2VzcyhbJ3ByZS1wdWJsaXNoJywgLi4uYXJnc10pIGFzIFByZVB1Ymxpc2hDb21tYW5kXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVSZW5hbWVDb21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogUmVuYW1lQ29tbWFuZCB7XG4gIHJldHVybiBjbGkucHJvY2VzcyhbJ3JlbmFtZScsIC4uLmFyZ3NdKSBhcyBSZW5hbWVDb21tYW5kXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVVbml2ZXJzYWxpemVDb21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogVW5pdmVyc2FsaXplQ29tbWFuZCB7XG4gIHJldHVybiBjbGkucHJvY2VzcyhbJ3VuaXZlcnNhbGl6ZScsIC4uLmFyZ3NdKSBhcyBVbml2ZXJzYWxpemVDb21tYW5kXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVWZXJzaW9uQ29tbWFuZChhcmdzOiBzdHJpbmdbXSk6IFZlcnNpb25Db21tYW5kIHtcbiAgcmV0dXJuIGNsaS5wcm9jZXNzKFsndmVyc2lvbicsIC4uLmFyZ3NdKSBhcyBWZXJzaW9uQ29tbWFuZFxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTmV3Q29tbWFuZChhcmdzOiBzdHJpbmdbXSk6IE5ld0NvbW1hbmQge1xuICByZXR1cm4gY2xpLnByb2Nlc3MoWyduZXcnLCAuLi5hcmdzXSkgYXMgTmV3Q29tbWFuZFxufVxuXG5leHBvcnQgeyBwYXJzZVRyaXBsZSB9IGZyb20gJy4vdXRpbHMvdGFyZ2V0LmpzJ1xuZXhwb3J0IHtcbiAgdHlwZSBHZW5lcmF0ZVR5cGVEZWZPcHRpb25zLFxuICB0eXBlIFdyaXRlSnNCaW5kaW5nT3B0aW9ucyxcbiAgd3JpdGVKc0JpbmRpbmcsXG4gIGdlbmVyYXRlVHlwZURlZixcbn0gZnJvbSAnLi9hcGkvYnVpbGQuanMnXG5leHBvcnQgeyByZWFkTmFwaUNvbmZpZyB9IGZyb20gJy4vdXRpbHMvY29uZmlnLmpzJ1xuIl0sInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlsxOCwxOSwyMCwyMSwyMywyNCwyNV0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUlBLElBQXNCLHVCQUF0QixjQUFtREEsVUFBQUEsUUFBUTtDQUN6RCxPQUFPLFFBQVEsQ0FBQyxDQUFDLFdBQVcsQ0FBQztDQUU3QixPQUFPLFFBQVFBLFVBQUFBLFFBQVEsTUFBTSxFQUMzQixhQUNFLDRFQUNKLENBQUM7Q0FFRCxNQUFNQyxVQUFBQSxPQUFPLE9BQU8sU0FBUyxRQUFRLElBQUksR0FBRyxFQUMxQyxhQUNFLHFIQUNKLENBQUM7Q0FFRCxhQUFzQkEsVUFBQUEsT0FBTyxPQUFPLG9CQUFvQixFQUN0RCxhQUFhLGtDQUNmLENBQUM7Q0FFRCxrQkFBa0JBLFVBQUFBLE9BQU8sT0FBTyx1QkFBdUIsZ0JBQWdCLEVBQ3JFLGFBQWEseUJBQ2YsQ0FBQztDQUVELFlBQVlBLFVBQUFBLE9BQU8sT0FBTyxzQkFBc0IsZUFBZSxFQUM3RCxhQUNFLGdHQUNKLENBQUM7Q0FFRCxTQUFTQSxVQUFBQSxPQUFPLE9BQU8sYUFBYSxPQUFPLEVBQ3pDLGFBQWEsZ0RBQ2YsQ0FBQztDQUVELGlCQUEwQkEsVUFBQUEsT0FBTyxPQUFPLHNCQUFzQixFQUM1RCxhQUNF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