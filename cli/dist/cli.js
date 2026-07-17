#!/usr/bin/env node
import { createRequire } from "node:module";
import { Cli, Command, Option } from "clipanion";
import path, { basename, dirname, isAbsolute, join, parse, resolve } from "node:path";
import * as colors from "colorette";
import { underline, yellow } from "colorette";
import { createDebug } from "obug";
import { access, copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { exec, execSync, spawn, spawnSync } from "node:child_process";
import fs, { existsSync, mkdirSync, promises, rmSync, statSync } from "node:fs";
import { isNil, merge, omit, omitBy, pick, sortBy } from "es-toolkit";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { Comparator, Range, minVersion, subset } from "semver";
import { dump, load } from "js-yaml";
import * as typanion from "typanion";
import { Octokit } from "@octokit/rest";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
//#region src/def/artifacts.ts
var BaseArtifactsCommand = class extends Command {
	static paths = [["artifacts"]];
	static usage = Command.Usage({ description: "Copy artifacts from Github Actions into npm packages and ready to publish" });
	cwd = Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	outputDir = Option.String("--output-dir,-o,-d", "./artifacts", { description: "Path to the folder where all built `.node` files put, same as `--output-dir` of build command" });
	npmDir = Option.String("--npm-dir", "npm", { description: "Path to the folder where the npm packages put" });
	buildOutputDir = Option.String("--build-output-dir", { description: "Path to the build output dir, only needed when targets contains `wasm32-wasi-*`" });
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
	const debug = createDebug(`napi:${namespace}`, { formatters: { i(v) {
		return colors.green(v);
	} } });
	debug.info = (...args) => console.error(colors.black(colors.bgGreen(" INFO ")), ...args);
	debug.warn = (...args) => console.error(colors.black(colors.bgYellow(" WARNING ")), ...args);
	debug.error = (...args) => console.error(colors.white(colors.bgRed(" ERROR ")), ...args.map((arg) => arg instanceof Error ? arg.stack ?? arg.message : arg));
	return debug;
};
const debug$10 = debugFactory("utils");
//#endregion
//#region package.json
var version$1 = "3.7.3";
//#endregion
//#region src/utils/misc.ts
const readFileAsync = readFile;
const writeFileAsync = writeFile;
const unlinkAsync = unlink;
const copyFileAsync = copyFile;
const mkdirAsync = mkdir;
const statAsync = stat;
const readdirAsync = readdir;
function fileExists(path) {
	return access(path).then(() => true, () => false);
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
	const host = execSync(`rustc -vV`, { env: process.env }).toString("utf8").split("\n").find((line) => line.startsWith("host: "));
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
	if (!fs.existsSync(manifestPath)) throw new Error(`No crate found in manifest: ${manifestPath}`);
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
	const childProcess = spawn("cargo", [
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
		const pkgJsonPath = underline(path);
		const configPathUnderline = underline(configPath);
		console.warn(yellow(`Both napi field in ${pkgJsonPath} and [NAPI-RS config](${configPathUnderline}) file are found, the NAPI-RS config file will be used.`));
	}
	if (separatedConfig) Object.assign(userNapiConfig, separatedConfig);
	const napiConfig = merge({
		binaryName: "index",
		packageName: pkgJson.name,
		targets: [],
		packageJson: pkgJson,
		npmClient: "npm"
	}, omit(userNapiConfig, ["targets"]));
	let targets = userNapiConfig.targets ?? [];
	if (userNapiConfig === null || userNapiConfig === void 0 ? void 0 : userNapiConfig.name) {
		console.warn(yellow(`[DEPRECATED] napi.name is deprecated, use napi.binaryName instead.`));
		napiConfig.binaryName = userNapiConfig.name;
	}
	if (!targets.length) {
		var _userNapiConfig$tripl, _userNapiConfig$tripl2;
		let deprecatedWarned = false;
		const warning = yellow(`[DEPRECATED] napi.triples is deprecated, use napi.targets instead.`);
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
		execSync(`cargo install ${name}`, { stdio: "inherit" });
	} catch (e) {
		throw new Error(`Failed to install cargo binary: ${name}`, { cause: e });
	}
}
function detectCargoBinary(bin) {
	debug$10("Detecting cargo binary: %s", bin);
	try {
		execSync(`cargo help ${bin}`, { stdio: "ignore" });
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
		dts: sortBy(Array.from(groupedDefs), [([namespace]) => namespace]).map(([namespace, defs]) => {
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
	const resolvePath = (...paths) => resolve(options.cwd, ...paths);
	return await readNapiConfig(resolvePath(options.packageJsonPath ?? "package.json"), options.configPath ? resolvePath(options.configPath) : void 0);
}
//#endregion
//#region src/api/artifacts.ts
const debug$8 = debugFactory("artifacts");
async function collectArtifacts(userOptions) {
	const options = applyDefaultArtifactsOptions(userOptions);
	const resolvePath = (...paths) => resolve(options.cwd, ...paths);
	const packageJsonPath = resolvePath(options.packageJsonPath);
	const { targets, binaryName, packageName } = await readNapiConfig(packageJsonPath, options.configPath ? resolvePath(options.configPath) : void 0);
	const distDirs = targets.map((platform) => join(options.cwd, options.npmDir, platform.platformArchABI));
	const universalSourceBins = new Set(targets.filter((platform) => platform.arch === "universal").flatMap((p) => {
		var _UniArchsByPlatform$p;
		return (_UniArchsByPlatform$p = UniArchsByPlatform[p.platform]) === null || _UniArchsByPlatform$p === void 0 ? void 0 : _UniArchsByPlatform$p.map((a) => `${p.platform}-${a}`);
	}).filter(Boolean));
	await collectNodeBinaries(join(options.cwd, options.outputDir)).then((output) => Promise.all(output.map(async (filePath) => {
		debug$8.info(`Read [${colors.yellowBright(filePath)}]`);
		const sourceContent = await readFileAsync(filePath);
		const parsedName = parse(filePath);
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
		const distFilePath = join(dir, parsedName.base);
		debug$8.info(`Write file content to [${colors.yellowBright(distFilePath)}]`);
		await writeFileAsync(distFilePath, sourceContent);
		const distFilePathLocal = join(parse(packageJsonPath).dir, parsedName.base);
		debug$8.info(`Write file content to [${colors.yellowBright(distFilePathLocal)}]`);
		await writeFileAsync(distFilePathLocal, sourceContent);
	})));
	const wasiTarget = targets.find((t) => t.platform === "wasi");
	if (wasiTarget) {
		const buildOutputDir = options.buildOutputDir ? resolve(options.cwd, options.buildOutputDir) : options.cwd;
		const wasiDir = join(options.cwd, options.npmDir, wasiTarget.platformArchABI);
		const cjsFile = join(buildOutputDir, `${binaryName}.wasi.cjs`);
		const workerFile = join(buildOutputDir, `wasi-worker.mjs`);
		const browserEntry = join(buildOutputDir, `${binaryName}.wasi-browser.js`);
		const browserWorkerFile = join(buildOutputDir, `wasi-worker-browser.mjs`);
		debug$8.info(`Move wasi binding file [${colors.yellowBright(cjsFile)}] to [${colors.yellowBright(wasiDir)}]`);
		await writeFileAsync(join(wasiDir, `${binaryName}.wasi.cjs`), await readFileAsync(cjsFile));
		debug$8.info(`Move wasi worker file [${colors.yellowBright(workerFile)}] to [${colors.yellowBright(wasiDir)}]`);
		await writeFileAsync(join(wasiDir, `wasi-worker.mjs`), await readFileAsync(workerFile));
		debug$8.info(`Move wasi browser entry file [${colors.yellowBright(browserEntry)}] to [${colors.yellowBright(wasiDir)}]`);
		await writeFileAsync(join(wasiDir, `${binaryName}.wasi-browser.js`), (await readFileAsync(browserEntry, "utf8")).replace(`new URL('./wasi-worker-browser.mjs', import.meta.url)`, `new URL('${packageName}-wasm32-wasi/wasi-worker-browser.mjs', import.meta.url)`));
		debug$8.info(`Move wasi browser worker file [${colors.yellowBright(browserWorkerFile)}] to [${colors.yellowBright(wasiDir)}]`);
		await writeFileAsync(join(wasiDir, `wasi-worker-browser.mjs`), await readFileAsync(browserWorkerFile));
	}
}
async function collectNodeBinaries(root) {
	const files = await readdirAsync(root, { withFileTypes: true });
	const nodeBinaries = files.filter((file) => file.isFile() && (file.name.endsWith(".node") || file.name.endsWith(".wasm"))).map((file) => join(root, file.name));
	const dirs = files.filter((file) => file.isDirectory());
	for (const dir of dirs) if (dir.name !== "node_modules") nodeBinaries.push(...await collectNodeBinaries(join(root, dir.name)));
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
const require$1 = createRequire(import.meta.url);
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
	const resolvePath = (...paths) => resolve(options.cwd, ...paths);
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
	const toolchains = require$1("@napi-rs/cross-toolchain");
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
	setEnvIfNotExists(`CARGO_TARGET_${upperCaseTarget}_LINKER`, join(toolchainPath, "bin", `${crossTargetName}-gcc`));
	setEnvIfNotExists("TARGET_SYSROOT", join(toolchainPath, crossTargetName, "sysroot"));
	setEnvIfNotExists("TARGET_AR", join(toolchainPath, "bin", `${crossTargetName}-ar`));
	setEnvIfNotExists("TARGET_RANLIB", join(toolchainPath, "bin", `${crossTargetName}-ranlib`));
	setEnvIfNotExists("TARGET_READELF", join(toolchainPath, "bin", `${crossTargetName}-readelf`));
	setEnvIfNotExists("TARGET_C_INCLUDE_PATH", join(toolchainPath, crossTargetName, "sysroot", "usr", "include/"));
	setEnvIfNotExists("TARGET_CC", join(toolchainPath, "bin", `${crossTargetName}-gcc`));
	setEnvIfNotExists("TARGET_CXX", join(toolchainPath, "bin", `${crossTargetName}-g++`));
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
			return ((_statSync = statSync(path, { throwIfNoEntry: false })) === null || _statSync === void 0 ? void 0 : _statSync.isFile()) ?? false;
		} catch {
			return false;
		}
	};
	const isClangCompiler = (value) => {
		if (!value) return false;
		const trimmed = value.trim();
		if (isExistingFile(trimmed)) return clangExecutableName.test(basename(trimmed));
		const [first, second] = trimmed.split(/\s+/);
		const compiler = first && ccWrappers.has(basename(first)) ? second : first;
		return compiler !== void 0 && clangExecutableName.test(basename(compiler));
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
		this.crateDir = parse(crate.manifest_path).dir;
		this.outputDir = resolve(this.options.cwd, options.outputDir ?? this.crateDir);
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
			const { version, download } = require$1("@napi-rs/cross-toolchain");
			const toolchainPath = join(homedir(), ".napi-rs", "cross-toolchain", version, this.target.triple);
			mkdirSync(toolchainPath, { recursive: true });
			if (existsSync(join(toolchainPath, "package.json"))) debug$7(`Toolchain ${toolchainPath} exists, skip extracting`);
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
				const buildProcess = spawn(cargoOverride ?? (this.options.useCross ? "cross" : "cargo"), this.args, {
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
			if (!existsSync(join(typeDefTmpFolder, crate.name))) this.envs[`NAPI_FORCE_BUILD_${crate.name.replace(/-/g, "_").toUpperCase()}`] = Date.now().toString();
		});
	}
	setAndroidEnv() {
		if (process.platform === "android" || this.options.useCross) return;
		const { ANDROID_NDK_LATEST_HOME } = process.env;
		if (!ANDROID_NDK_LATEST_HOME) throw new Error(`${colors.red("ANDROID_NDK_LATEST_HOME")} environment variable is required when building an Android target from a non-Android host`);
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
		const emnapi = join(require$1.resolve("emnapi"), "..", "lib", "wasm32-wasip1-threads");
		this.envs.EMNAPI_LINK_DIR = emnapi;
		const emnapiVersion = require$1("emnapi/package.json").version;
		const projectRequire = createRequire(join(this.options.cwd, "package.json"));
		const emnapiCoreVersion = projectRequire("@emnapi/core").version;
		const emnapiRuntimeVersion = projectRequire("@emnapi/runtime").version;
		if (emnapiVersion !== emnapiCoreVersion || emnapiVersion !== emnapiRuntimeVersion) throw new Error(`emnapi version mismatch: emnapi@${emnapiVersion}, @emnapi/core@${emnapiCoreVersion}, @emnapi/runtime@${emnapiRuntimeVersion}. Please ensure all emnapi packages are the same version.`);
		const { WASI_SDK_PATH } = process.env;
		if (WASI_SDK_PATH && existsSync(WASI_SDK_PATH)) {
			this.envs.CARGO_TARGET_WASM32_WASI_PREVIEW1_THREADS_LINKER = join(WASI_SDK_PATH, "bin", "wasm-ld");
			this.envs.CARGO_TARGET_WASM32_WASIP1_LINKER = join(WASI_SDK_PATH, "bin", "wasm-ld");
			this.envs.CARGO_TARGET_WASM32_WASIP1_THREADS_LINKER = join(WASI_SDK_PATH, "bin", "wasm-ld");
			this.envs.CARGO_TARGET_WASM32_WASIP2_LINKER = join(WASI_SDK_PATH, "bin", "wasm-ld");
			this.setEnvIfNotExists("TARGET_CC", join(WASI_SDK_PATH, "bin", "clang"));
			this.setEnvIfNotExists("TARGET_CXX", join(WASI_SDK_PATH, "bin", "clang++"));
			this.setEnvIfNotExists("TARGET_AR", join(WASI_SDK_PATH, "bin", "ar"));
			this.setEnvIfNotExists("TARGET_RANLIB", join(WASI_SDK_PATH, "bin", "ranlib"));
			this.setEnvIfNotExists("TARGET_CFLAGS", `--target=wasm32-wasip1-threads --sysroot=${WASI_SDK_PATH}/share/wasi-sysroot -pthread -mllvm -wasm-enable-sjlj`);
			this.setEnvIfNotExists("TARGET_CXXFLAGS", `--target=wasm32-wasip1-threads --sysroot=${WASI_SDK_PATH}/share/wasi-sysroot -pthread -mllvm -wasm-enable-sjlj`);
			this.setEnvIfNotExists(`TARGET_LDFLAGS`, `-fuse-ld=${WASI_SDK_PATH}/bin/wasm-ld --target=wasm32-wasip1-threads`);
		}
	}
	setOpenHarmonyEnv() {
		const { OHOS_SDK_PATH, OHOS_SDK_NATIVE } = process.env;
		const ndkPath = OHOS_SDK_PATH ? `${OHOS_SDK_PATH}/native` : OHOS_SDK_NATIVE;
		if (!ndkPath && process.platform !== "openharmony") {
			debug$7.warn(`${colors.red("OHOS_SDK_PATH")} or ${colors.red("OHOS_SDK_NATIVE")} environment variable is missing`);
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
		let folder = join(this.targetDir, "napi-rs", `${this.crate.name}-${createHash("sha256").update(this.crate.manifest_path).update(CLI_VERSION).digest("hex").substring(0, 8)}`);
		if (!this.options.dtsCache) {
			rmSync(folder, {
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
		const src = join(this.targetDir, this.target.triple, profile, srcName);
		debug$7(`Copy artifact from: [${src}]`);
		const dest = join(this.outputDir, destName);
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
			return wasmBinaryName ? join(this.outputDir, wasmBinaryName) : null;
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
		const dest = join(this.outputDir, this.options.dts ?? "index.d.ts");
		try {
			debug$7("Writing type def to:");
			debug$7("  %i", dest);
			await writeFileAsync(dest, dts, "utf-8");
		} catch (e) {
			debug$7.error("Failed to write type def file");
			debug$7.error(e);
		}
		if (exports.length > 0) {
			const dest = join(this.outputDir, this.options.dts ?? "index.d.ts");
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
			const { name, dir } = parse(distFileName);
			const bindingPath = join(dir, `${this.config.binaryName}.wasi.cjs`);
			const browserBindingPath = join(dir, `${this.config.binaryName}.wasi-browser.js`);
			const workerPath = join(dir, "wasi-worker.mjs");
			const browserWorkerPath = join(dir, "wasi-worker-browser.mjs");
			const browserEntryPath = join(dir, "browser.js");
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
		const dest = join(options.outputDir, name);
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
			header = await readFileAsync(join(options.cwd, dtsHeaderFile), "utf-8");
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
	const processedTypeDefs = await Promise.all(typeDefFiles.map((file) => processTypeDef(join(options.typeDefDir, file.name), constEnum, runtimeStringEnum)));
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
var BaseCreateNpmDirsCommand = class extends Command {
	static paths = [["create-npm-dirs"]];
	static usage = Command.Usage({ description: "Create npm package dirs for different platforms" });
	cwd = Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	npmDir = Option.String("--npm-dir", "npm", { description: "Path to the folder where the npm packages put" });
	dryRun = Option.Boolean("--dry-run", false, { description: "Dry run without touching file system" });
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
const require = createRequire(import.meta.url);
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
	const packageJsonPath = resolve(options.cwd, options.packageJsonPath);
	const npmPath = resolve(options.cwd, options.npmDir);
	debug$6(`Read content from [${options.configPath ?? packageJsonPath}]`);
	const { targets, binaryName, packageName, packageJson } = await readNapiConfig(packageJsonPath, options.configPath ? resolve(options.cwd, options.configPath) : void 0);
	const wasmRuntimeVersion = targets.some((target) => target.arch === "wasm32") ? await getLatestWasmRuntimeVersion() : void 0;
	for (const target of targets) {
		const targetDir = join(npmPath, `${target.platformArchABI}`);
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
			const emnapiVersion = require("emnapi/package.json").version;
			scopedPackageJson.dependencies = {
				"@napi-rs/wasm-runtime": `^${wasmRuntimeVersion}`,
				"@emnapi/core": emnapiVersion,
				"@emnapi/runtime": emnapiVersion
			};
		}
		if (target.abi === "gnu") scopedPackageJson.libc = ["glibc"];
		else if (target.abi === "musl") scopedPackageJson.libc = ["musl"];
		await writeFileAsync$1(join(targetDir, "package.json"), JSON.stringify(scopedPackageJson, null, 2) + "\n");
		await writeFileAsync$1(join(targetDir, "README.md"), readme(packageName, target));
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
		if (subset(nodeRange, minimumWasiNodeVersion)) return nodeRange;
		if (subset(minimumWasiNodeVersion, nodeRange)) return minimumWasiNodeVersion;
		const minimumComparator = new Comparator(minimumWasiNodeVersion);
		const restrictedRangeSets = new Range(nodeRange).set.map((comparators) => normalizeComparatorSet([...comparators, minimumComparator])).filter((candidate) => candidate !== void 0 && minVersion(candidate) !== null);
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
*/ function join$1(parser, separator) {
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
	const pairs = surround("{", join$1(pair, ","), "}")(scanner);
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
*/ function parse$1(tomlString) {
	return parserFactory(toml)(tomlString);
}
//#endregion
//#region src/def/new.ts
var BaseNewCommand = class extends Command {
	static paths = [["new"]];
	static usage = Command.Usage({ description: "Create a new project with pre-configured boilerplate" });
	$$path = Option.String({ required: false });
	$$name = Option.String("--name,-n", { description: "The name of the project, default to the name of the directory if not provided" });
	minNodeApiVersion = Option.String("--min-node-api,-v", "4", {
		validator: typanion.isNumber(),
		description: "The minimum Node-API version to support"
	});
	packageManager = Option.String("--package-manager", "yarn", { description: "The package manager to use. Only support yarn 4.x for now." });
	license = Option.String("--license,-l", "MIT", { description: "License for open-sourced project" });
	targets = Option.Array("--targets,-t", [], { description: "All targets the crate will be compiled for." });
	enableDefaultTargets = Option.Boolean("--enable-default-targets", true, { description: "Whether enable default targets" });
	enableAllTargets = Option.Boolean("--enable-all-targets", false, { description: "Whether enable all targets" });
	enableTypeDef = Option.Boolean("--enable-type-def", true, { description: "Whether enable the `type-def` feature for typescript definitions auto-generation" });
	enableGithubActions = Option.Boolean("--enable-github-actions", true, { description: "Whether generate preconfigured GitHub Actions workflow" });
	testFramework = Option.String("--test-framework", "ava", { description: "The JavaScript test framework to use, only support `ava` for now" });
	dryRun = Option.Boolean("--dry-run", false, { description: "Whether to run the command in dry-run mode" });
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
	return isAbsolute(input) ? input : resolve(root || ".", input);
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
		tmp = dirname(prev = tmp);
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
		tmp = join(dir, name);
		if (statSync(tmp).isDirectory()) return tmp;
	} catch {}
}
//#endregion
//#region src/def/rename.ts
var BaseRenameCommand = class extends Command {
	static paths = [["rename"]];
	static usage = Command.Usage({ description: "Rename the NAPI-RS project" });
	cwd = Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	npmDir = Option.String("--npm-dir", "npm", { description: "Path to the folder where the npm packages put" });
	$$name = Option.String("--name,-n", { description: "The new name of the project" });
	binaryName = Option.String("--binary-name,-b", { description: "The new binary name *.node files" });
	packageName = Option.String("--package-name", { description: "The new package name of the project" });
	manifestPath = Option.String("--manifest-path", "Cargo.toml", { description: "Path to `Cargo.toml`" });
	repository = Option.String("--repository", { description: "The new repository of the project" });
	description = Option.String("--description", { description: "The new description of the project" });
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
	const packageJsonPath = resolve(options.cwd, options.packageJsonPath);
	const cargoTomlPath = resolve(options.cwd, options.manifestPath);
	const packageJsonContent = await readFileAsync(packageJsonPath, "utf8");
	const packageJsonData = JSON.parse(packageJsonContent);
	merge(merge(packageJsonData, omitBy(pick(options, [
		"name",
		"description",
		"author",
		"license"
	]), isNil)), { napi: omitBy({
		binaryName: options.binaryName,
		packageName: options.packageName
	}, isNil) });
	if (options.repository) if (packageJsonData.repository && typeof packageJsonData.repository === "object" && !Array.isArray(packageJsonData.repository)) packageJsonData.repository.url = options.repository;
	else packageJsonData.repository = options.repository;
	if (options.configPath) {
		const configPath = resolve(options.cwd, options.configPath);
		const configContent = await readFileAsync(configPath, "utf8");
		const configData = JSON.parse(configContent);
		merge(configData, omitBy({
			binaryName: options.binaryName,
			packageName: options.packageName
		}, isNil));
		await writeFileAsync(configPath, JSON.stringify(configData, null, 2));
	}
	await writeFileAsync(packageJsonPath, JSON.stringify(packageJsonData, null, 2));
	const cargoToml = parse$1(await readFileAsync(cargoTomlPath, "utf8"));
	if (cargoToml.package && options.binaryName) {
		const sanitizedName = options.binaryName.replace("@", "").replace("/", "_").replace(/-/g, "_").toLowerCase();
		cargoToml.package.name = sanitizedName;
	}
	await writeFileAsync(cargoTomlPath, stringify(cargoToml));
	if (options.binaryName && oldName !== options.binaryName) {
		const githubActionsPath = dir(".github", { cwd: options.cwd });
		if (githubActionsPath) {
			const githubActionsCIYmlPath = join(githubActionsPath, "workflows", "CI.yml");
			if (existsSync(githubActionsCIYmlPath)) {
				var _githubActionsData$en;
				const githubActionsData = load(await readFileAsync(githubActionsCIYmlPath, "utf8"));
				if ((_githubActionsData$en = githubActionsData.env) === null || _githubActionsData$en === void 0 ? void 0 : _githubActionsData$en.APP_NAME) {
					githubActionsData.env.APP_NAME = options.binaryName;
					await writeFileAsync(githubActionsCIYmlPath, dump(githubActionsData, {
						lineWidth: -1,
						noRefs: true,
						sortKeys: false
					}));
				}
			}
		}
		const oldWasiBrowserBindingPath = join(options.cwd, `${oldName}.wasi-browser.js`);
		if (existsSync(oldWasiBrowserBindingPath)) await rename(oldWasiBrowserBindingPath, join(options.cwd, `${options.binaryName}.wasi-browser.js`));
		const oldWasiBindingPath = join(options.cwd, `${oldName}.wasi.cjs`);
		if (existsSync(oldWasiBindingPath)) await rename(oldWasiBindingPath, join(options.cwd, `${options.binaryName}.wasi.cjs`));
		const gitAttributesPath = join(options.cwd, ".gitattributes");
		if (existsSync(gitAttributesPath)) await writeFileAsync(gitAttributesPath, (await readFileAsync(gitAttributesPath, "utf8")).split("\n").map((line) => {
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
		const cp = exec("git --version");
		cp.on("error", () => {
			resolve(false);
		});
		cp.on("exit", (code) => {
			resolve(code === 0);
		});
	});
}
async function ensureCacheDir(packageManager) {
	const cacheDir = path.join(homedir(), ".napi-rs", "template", packageManager);
	await mkdirAsync(cacheDir, { recursive: true });
	return cacheDir;
}
async function downloadTemplate(packageManager, cacheDir) {
	const repoUrl = TEMPLATE_REPOS[packageManager];
	const templatePath = path.join(cacheDir, "repo");
	if (existsSync(templatePath)) {
		debug$5(`Template cache found at ${templatePath}, updating...`);
		try {
			await new Promise((resolve, reject) => {
				const cp = exec("git fetch origin", { cwd: templatePath });
				cp.on("error", reject);
				cp.on("exit", (code) => {
					if (code === 0) resolve();
					else reject(/* @__PURE__ */ new Error(`Failed to fetch latest changes, git process exited with code ${code}`));
				});
			});
			execSync("git reset --hard origin/main", {
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
			execSync(`git clone ${repoUrl} repo`, {
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
	const entries = await promises.readdir(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.name === ".git") continue;
		if (entry.isDirectory()) await copyDirectory(srcPath, destPath, includeWasiBindings);
		else {
			if (!includeWasiBindings && (entry.name.endsWith(".wasi-browser.js") || entry.name.endsWith(".wasi.cjs") || entry.name.endsWith("wasi-worker-browser.mjs") || entry.name.endsWith("wasi-worker.mjs") || entry.name === "browser.js")) continue;
			await promises.copyFile(srcPath, destPath);
		}
	}
}
async function filterTargetsInPackageJson(filePath, enabledTargets) {
	var _packageJson$napi;
	const content = await promises.readFile(filePath, "utf-8");
	const packageJson = JSON.parse(content);
	const includeWasiBindings = enabledTargets.includes(WASI_TARGET);
	if ((_packageJson$napi = packageJson.napi) === null || _packageJson$napi === void 0 ? void 0 : _packageJson$napi.targets) packageJson.napi.targets = packageJson.napi.targets.filter((target) => enabledTargets.includes(target));
	if (!includeWasiBindings) {
		if (packageJson.browser === "browser.js" || packageJson.browser === "./browser.js") delete packageJson.browser;
		if (Array.isArray(packageJson.files)) packageJson.files = packageJson.files.filter((file) => file !== "browser.js" && file !== "./browser.js");
	}
	await promises.writeFile(filePath, JSON.stringify(packageJson, null, 2) + "\n");
}
async function updateCargoTomlTypeDef(filePath, enableTypeDef) {
	if (enableTypeDef) return;
	const cargoToml = parse$1(await promises.readFile(filePath, "utf-8"));
	const dependencies = cargoToml.dependencies;
	if (!dependencies || !dependencies["napi-derive"]) return;
	const napiDeriveDependency = dependencies["napi-derive"];
	const dependencyConfig = typeof napiDeriveDependency === "string" ? { version: napiDeriveDependency } : { ...napiDeriveDependency };
	const existingFeatures = Array.isArray(dependencyConfig.features) ? dependencyConfig.features.filter((feature) => typeof feature === "string") : [];
	dependencyConfig["default-features"] = false;
	dependencyConfig.features = ["strict", ...existingFeatures.filter((feature) => feature !== "strict")].filter((feature) => feature !== "type-def");
	dependencies["napi-derive"] = dependencyConfig;
	await promises.writeFile(filePath, stringify(cargoToml));
}
async function updateCargoTomlNodeApiVersion(filePath, minNodeApiVersion) {
	const cargoToml = parse$1(await promises.readFile(filePath, "utf-8"));
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
	await promises.writeFile(filePath, stringify(cargoToml));
}
async function filterTargetsInGithubActions(filePath, enabledTargets) {
	var _yaml$jobs, _yaml$jobs5;
	const yaml = load(await promises.readFile(filePath, "utf-8"));
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
	const updatedYaml = dump(yaml, {
		lineWidth: -1,
		noRefs: true,
		sortKeys: false
	});
	await promises.writeFile(filePath, updatedYaml);
}
function processOptions(options) {
	var _options$targets;
	debug$5("Processing options...");
	const minNodeApiVersion = options.minNodeApiVersion ?? 4;
	if (!Number.isInteger(minNodeApiVersion) || !SUPPORTED_NAPI_VERSIONS.some((version) => version === minNodeApiVersion)) throw new RangeError(`Unsupported Node-API version ${minNodeApiVersion}. Expected one of: ${SUPPORTED_NAPI_VERSIONS.join(", ")}`);
	options.minNodeApiVersion = minNodeApiVersion;
	if (!options.path) throw new Error("Please provide the path as the argument");
	options.path = path.resolve(process.cwd(), options.path);
	debug$5(`Resolved target path to: ${options.path}`);
	if (!options.name) {
		options.name = path.parse(options.path).base;
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
		if (execSync(`rustup target list`, { encoding: "utf8" }).includes(WASI_TARGET)) options.targets = options.targets.map((target) => target === "wasm32-wasi-preview1-threads" ? WASI_TARGET : target);
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
		await copyDirectory(path.join(cacheDir, "repo"), options.path, options.targets.includes(WASI_TARGET));
		await renameProject({
			cwd: options.path,
			name: options.name,
			binaryName: getBinaryName(options.name)
		});
		const cargoTomlPath = path.join(options.path, "Cargo.toml");
		if (existsSync(cargoTomlPath)) {
			await updateCargoTomlTypeDef(cargoTomlPath, options.enableTypeDef);
			await updateCargoTomlNodeApiVersion(cargoTomlPath, options.minNodeApiVersion);
		}
		const packageJsonPath = path.join(options.path, "package.json");
		if (existsSync(packageJsonPath)) await filterTargetsInPackageJson(packageJsonPath, options.targets);
		const ciPath = path.join(options.path, ".github", "workflows", "CI.yml");
		if (existsSync(ciPath) && options.enableGithubActions) await filterTargetsInGithubActions(ciPath, options.targets);
		else if (!options.enableGithubActions && existsSync(path.join(options.path, ".github"))) await promises.rm(path.join(options.path, ".github"), {
			recursive: true,
			force: true
		});
		const pkgJsonContent = await promises.readFile(packageJsonPath, "utf-8");
		const pkgJson = JSON.parse(pkgJsonContent);
		if (!pkgJson.engines) pkgJson.engines = {};
		pkgJson.engines.node = napiEngineRequirement(options.minNodeApiVersion);
		if (options.license && pkgJson.license !== options.license) pkgJson.license = options.license;
		if (options.testFramework !== "ava") debug$5(`Test framework ${options.testFramework} requested but not yet implemented`);
		await promises.writeFile(packageJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");
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
var BasePrePublishCommand = class extends Command {
	static paths = [["pre-publish"], ["prepublish"]];
	static usage = Command.Usage({ description: "Update package.json and copy addons into per platform packages" });
	cwd = Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	npmDir = Option.String("--npm-dir,-p", "npm", { description: "Path to the folder where the npm packages put" });
	tagStyle = Option.String("--tag-style,--tagstyle,-t", "lerna", { description: "git tag style, `npm` or `lerna`" });
	ghRelease = Option.Boolean("--gh-release", true, { description: "Whether create GitHub release" });
	ghReleaseName = Option.String("--gh-release-name", { description: "GitHub release name" });
	ghReleaseId = Option.String("--gh-release-id", { description: "Existing GitHub release id" });
	skipOptionalPublish = Option.Boolean("--skip-optional-publish", false, { description: "Whether skip optionalDependencies packages publish" });
	dryRun = Option.Boolean("--dry-run", false, { description: "Dry run without touching file system" });
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
var BaseVersionCommand = class extends Command {
	static paths = [["version"]];
	static usage = Command.Usage({ description: "Update version in created npm packages" });
	cwd = Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	npmDir = Option.String("--npm-dir", "npm", { description: "Path to the folder where the npm packages put" });
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
	const config = await readNapiConfig(resolve(options.cwd, options.packageJsonPath), options.configPath ? resolve(options.cwd, options.configPath) : void 0);
	for (const target of config.targets) {
		const pkgDir = resolve(options.cwd, options.npmDir, target.platformArchABI);
		debug$4(`Update version to %i in [%i]`, config.packageJson.version, pkgDir);
		await updatePackageJson(join(pkgDir, "package.json"), { version: config.packageJson.version });
	}
}
//#endregion
//#region src/api/pre-publish.ts
const debug$3 = debugFactory("pre-publish");
async function prePublish(userOptions) {
	debug$3("Receive pre-publish options:");
	debug$3("  %O", userOptions);
	const options = applyDefaultPrePublishOptions(userOptions);
	const packageJsonPath = resolve(options.cwd, options.packageJsonPath);
	const { packageJson, targets, packageName, binaryName, npmClient } = await readNapiConfig(packageJsonPath, options.configPath ? resolve(options.cwd, options.configPath) : void 0);
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
		const headCommit = execSync("git log -1 --pretty=%B", {
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
		const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
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
		const pkgDir = resolve(options.cwd, options.npmDir, `${target.platformArchABI}`);
		const ext = target.platform === "wasi" || target.platform === "wasm" ? "wasm" : "node";
		const filename = `${binaryName}.${target.platformArchABI}.${ext}`;
		const dstPath = join(pkgDir, filename);
		if (!options.dryRun) {
			if (!existsSync(dstPath)) {
				debug$3.warn(`%s doesn't exist`, dstPath);
				continue;
			}
			if (!options.skipOptionalPublish) try {
				const output = execSync(`${npmClient} publish`, {
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
					const dstFileStats = statSync(dstPath);
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
var BaseUniversalizeCommand = class extends Command {
	static paths = [["universalize"]];
	static usage = Command.Usage({ description: "Combile built binaries into one universal binary" });
	cwd = Option.String("--cwd", process.cwd(), { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	configPath = Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = Option.String("--package-json-path", "package.json", { description: "Path to `package.json`" });
	outputDir = Option.String("--output-dir,-o", "./", { description: "Path to the folder where all built `.node` files put, same as `--output-dir` of build command" });
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
	const result = spawnSync("lipo", [
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
	const config = await readNapiConfig(resolve(options.cwd, options.packageJsonPath), options.configPath ? resolve(options.cwd, options.configPath) : void 0);
	if (!config.targets.find((t) => t.platform === process.platform && t.arch === "universal")) throw new Error(`'universal' arch for platform '${process.platform}' not found in config!`);
	const srcFiles = (_UniArchsByPlatform$p = UniArchsByPlatform[process.platform]) === null || _UniArchsByPlatform$p === void 0 ? void 0 : _UniArchsByPlatform$p.map((arch) => resolve(options.cwd, options.outputDir, `${config.binaryName}.${process.platform}-${arch}.node`));
	if (!srcFiles || !universalizers[process.platform]) throw new Error(`'universal' arch for platform '${process.platform}' not supported.`);
	debug$2(`Looking up source binaries to combine: `);
	debug$2("  %O", srcFiles);
	const srcFileLookup = await Promise.all(srcFiles.map((f) => fileExists(f)));
	const notFoundFiles = srcFiles.filter((_, i) => !srcFileLookup[i]);
	if (notFoundFiles.length) throw new Error(`Some binary files were not found: ${JSON.stringify(notFoundFiles)}`);
	const output = resolve(options.cwd, options.outputDir, `${config.binaryName}.${process.platform}-universal.node`);
	(_universalizers$proce = universalizers[process.platform]) === null || _universalizers$proce === void 0 || _universalizers$proce.call(universalizers, srcFiles, output);
	if (!await fileExists(output)) throw new Error(`Universal binary was not created: ${output}`);
	debug$2(`Produced universal binary: ${output}`);
}
//#endregion
//#region src/commands/artifacts.ts
var ArtifactsCommand = class extends BaseArtifactsCommand {
	static usage = Command.Usage({
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
var BaseBuildCommand = class extends Command {
	static paths = [["build"]];
	static usage = Command.Usage({ description: "Build the NAPI-RS project" });
	target = Option.String("--target,-t", { description: "Build for the target triple, bypassed to `cargo build --target`" });
	cwd = Option.String("--cwd", { description: "The working directory of where napi command will be executed in, all other paths options are relative to this path" });
	manifestPath = Option.String("--manifest-path", { description: "Path to `Cargo.toml`" });
	configPath = Option.String("--config-path,-c", { description: "Path to `napi` config json file" });
	packageJsonPath = Option.String("--package-json-path", { description: "Path to `package.json`" });
	targetDir = Option.String("--target-dir", { description: "Directory for all crate generated artifacts, see `cargo build --target-dir`" });
	outputDir = Option.String("--output-dir,-o", { description: "Path to where all the built files would be put. Default to the crate folder" });
	platform = Option.Boolean("--platform", { description: "Add platform triple to the generated nodejs binding file, eg: `[name].linux-x64-gnu.node`" });
	jsPackageName = Option.String("--js-package-name", { description: "Package name in generated js binding file. Only works with `--platform` flag" });
	constEnum = Option.Boolean("--const-enum", { description: "Whether generate const enum for typescript bindings" });
	runtimeStringEnum = Option.Boolean("--runtime-string-enum", { description: "Emit `#[napi(string_enum)]` enums as runtime enums (`export declare enum`) under `--no-const-enum`. Default: type-only union." });
	jsBinding = Option.String("--js", { description: "Path and filename of generated JS binding file. Only works with `--platform` flag. Relative to `--output-dir`." });
	noJsBinding = Option.Boolean("--no-js", { description: "Whether to disable the generation JS binding file. Only works with `--platform` flag." });
	dts = Option.String("--dts", { description: "Path and filename of generated type def file. Relative to `--output-dir`" });
	dtsHeader = Option.String("--dts-header", { description: "Custom file header for generated type def file. Only works when `typedef` feature enabled." });
	noDtsHeader = Option.Boolean("--no-dts-header", { description: "Whether to disable the default file header for generated type def file. Only works when `typedef` feature enabled." });
	dtsCache = Option.Boolean("--dts-cache", true, { description: "Whether to enable the dts cache, default to true" });
	esm = Option.Boolean("--esm", { description: "Whether to emit an ESM JS binding file instead of CJS format. Only works with `--platform` flag." });
	strip = Option.Boolean("--strip,-s", { description: "Whether strip the library to achieve the minimum file size" });
	release = Option.Boolean("--release,-r", { description: "Build in release mode" });
	verbose = Option.Boolean("--verbose,-v", { description: "Verbosely log build command trace" });
	bin = Option.String("--bin", { description: "Build only the specified binary" });
	package = Option.String("--package,-p", { description: "Build the specified library or the one at cwd" });
	profile = Option.String("--profile", { description: "Build artifacts with the specified profile" });
	crossCompile = Option.Boolean("--cross-compile,-x", { description: "[experimental] cross compile by replacing the cargo subcommand: Windows MSVC targets from a non-Windows host build with `cargo-xwin` (`windows-gnu` targets are rejected, `cargo-xwin` cannot handle them), non-Windows targets build with `cargo-zigbuild` (requires `zig` on PATH). The selected subcommand is auto-installed on first use. Cannot be combined with `--use-cross`, `--use-napi-cross` or `--watch`" });
	useCross = Option.Boolean("--use-cross", { description: "[experimental] not recommended, prefer `--cross-compile` or `--use-napi-cross`: build in a Docker or Podman container with [cross](https://github.com/cross-rs/cross), which must be installed manually and needs a running container engine. Cannot be combined with `--cross-compile`, `--use-napi-cross` or `--watch`" });
	useNapiCross = Option.Boolean("--use-napi-cross", { description: "[experimental] download a prebuilt gcc cross toolchain from `@napi-rs/cross-toolchain` (glibc 2.17) and set linker and C compiler environment variables. Linux glibc targets only (x64, arm64, armv7, ppc64le, s390x) on a Linux x64 or arm64 host, any other target or host errors. Cannot be combined with `--cross-compile` or `--use-cross`" });
	watch = Option.Boolean("--watch,-w", { description: "watch the crate changes and build continuously with `cargo-watch` crates" });
	features = Option.Array("--features,-F", { description: "Space-separated list of features to activate" });
	allFeatures = Option.Boolean("--all-features", { description: "Activate all available features" });
	noDefaultFeatures = Option.Boolean("--no-default-features", { description: "Do not activate the `default` feature" });
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
	pipe = Option.String("--pipe", { description: "Pipe all outputs file to given command. e.g. `napi build --pipe \"npx prettier --write\"`" });
	cargoOptions = Option.Rest();
	async execute() {
		const { task } = await buildProject({
			...this.getOptions(),
			cargoOptions: this.cargoOptions
		});
		const outputs = await task;
		if (this.pipe) for (const output of outputs) {
			debug$1("Piping output file to command: %s", this.pipe);
			try {
				execSync(`${this.pipe} ${output.path}`, {
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
var CliVersionCommand = class extends Command {
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
var HelpCommand = class extends Command {
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
	interactive = Option.Boolean("--interactive,-i", true, { description: "Ask project basic information interactively without just using the default." });
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
				name: await this.fetchName(path.parse(targetPath).base),
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
		return this.$$name ?? input({
			message: "Package name (the name field in your package.json file)",
			default: defaultName
		});
	}
	async fetchLicense() {
		return input({
			message: "License for open-sourced project",
			default: this.license
		});
	}
	async fetchNapiVersion() {
		return select({
			message: "Minimum node-api version (with node version requirement)",
			loop: false,
			pageSize: 10,
			choices: getNapiVersionChoices(),
			default: this.minNodeApiVersion - 1
		});
	}
	async fetchTargets() {
		if (this.enableAllTargets) return AVAILABLE_TARGETS.concat();
		return await checkbox({
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
		return await confirm({
			message: "Enable type definition auto-generation",
			default: this.enableTypeDef
		});
	}
	async fetchGithubActions() {
		return await confirm({
			message: "Enable Github Actions CI",
			default: this.enableGithubActions
		});
	}
};
async function inquirerProjectPath() {
	return input({ message: "Target path to create the project, relative to cwd." }).then((path) => {
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
		if (!options.name) options.name = await input({
			message: `Enter the new package name in the package.json`,
			required: true
		});
		if (!options.binaryName) options.binaryName = await input({
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
const cli = new Cli({
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
//#endregion
//#region src/cli.ts
cli.runExit(process.argv.slice(2));
//#endregion
export {};

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwibmFtZXMiOlsiZGVidWciLCJwaWNrIiwicGtnSnNvbi52ZXJzaW9uIiwiZGVidWciLCJkZWJ1ZyIsImRlYnVnIiwicmVxdWlyZSIsImRlYnVnIiwibWtkaXJBc3luYyIsInJhd01rZGlyQXN5bmMiLCJ3cml0ZUZpbGVBc3luYyIsInJhd1dyaXRlRmlsZUFzeW5jIiwicGljayIsIiNwcmludE9iamVjdCIsIiNmb3JtYXQiLCIjaXNTaW1wbHlTZXJpYWxpemFibGUiLCIjZGF0ZURlY2xhcmF0aW9uIiwiI3N0ckRlY2xhcmF0aW9uIiwiI251bWJlckRlY2xhcmF0aW9uIiwiI2Jvb2xEZWNsYXJhdGlvbiIsIiNnZXRUeXBlT2ZBcnJheSIsIiNhcnJheURlY2xhcmF0aW9uIiwiI2hlYWRlckdyb3VwIiwiI3ByaW50QXNJbmxpbmVWYWx1ZSIsIiNkZWNsYXJhdGlvbiIsIiNoZWFkZXIiLCIjYXJyYXlUeXBlQ2FjaGUiLCIjZG9HZXRUeXBlT2ZBcnJheSIsIiNpc1ByaW1pdGl2ZSIsIiNwcmludERhdGUiLCIjc291cmNlIiwiI3Bvc2l0aW9uIiwiI3doaXRlc3BhY2UiLCJqb2luIiwibWVyZ2UiLCJwYXJzZSIsIndhbGsudXAiLCJwYXJzZVRvbWwiLCJzdHJpbmdpZnlUb21sIiwiZmluZC5kaXIiLCJ5YW1sUGFyc2UiLCJ5YW1sU3RyaW5naWZ5IiwiZGVidWciLCJmcyIsInBhcnNlVG9tbCIsInN0cmluZ2lmeVRvbWwiLCJ5YW1sTG9hZCIsInlhbWxEdW1wIiwiZGVidWciLCJkZWJ1ZyIsImRlYnVnIiwiZGVidWciXSwic291cmNlcyI6WyIuLi9zcmMvZGVmL2FydGlmYWN0cy50cyIsIi4uL3NyYy91dGlscy9sb2cudHMiLCIuLi9wYWNrYWdlLmpzb24iLCIuLi9zcmMvdXRpbHMvbWlzYy50cyIsIi4uL3NyYy91dGlscy90YXJnZXQudHMiLCIuLi9zcmMvdXRpbHMvdmVyc2lvbi50cyIsIi4uL3NyYy91dGlscy9tZXRhZGF0YS50cyIsIi4uL3NyYy91dGlscy9jb25maWcudHMiLCIuLi9zcmMvdXRpbHMvY2FyZ28udHMiLCIuLi9zcmMvdXRpbHMvdHlwZWdlbi50cyIsIi4uL3NyYy91dGlscy9yZWFkLWNvbmZpZy50cyIsIi4uL3NyYy9hcGkvYXJ0aWZhY3RzLnRzIiwiLi4vc3JjL2FwaS90ZW1wbGF0ZXMvanMtYmluZGluZy50cyIsIi4uL3NyYy9hcGkvdGVtcGxhdGVzL2xvYWQtd2FzaS10ZW1wbGF0ZS50cyIsIi4uL3NyYy9hcGkvdGVtcGxhdGVzL3dhc2ktd29ya2VyLXRlbXBsYXRlLnRzIiwiLi4vc3JjL2FwaS9idWlsZC50cyIsIi4uL3NyYy9kZWYvY3JlYXRlLW5wbS1kaXJzLnRzIiwiLi4vc3JjL2FwaS9jcmVhdGUtbnBtLWRpcnMudHMiLCIuLi8uLi9ub2RlX21vZHVsZXMvQHN0ZC90b21sL3N0cmluZ2lmeS5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9AanNyL3N0ZF9fY29sbGVjdGlvbnMvZGVlcF9tZXJnZS5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ac3RkL3RvbWwvX3BhcnNlci5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ac3RkL3RvbWwvcGFyc2UuanMiLCIuLi9zcmMvZGVmL25ldy50cyIsIi4uLy4uL25vZGVfbW9kdWxlcy9lbXBhdGhpYy9yZXNvbHZlLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9lbXBhdGhpYy93YWxrLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9lbXBhdGhpYy9maW5kLm1qcyIsIi4uL3NyYy9kZWYvcmVuYW1lLnRzIiwiLi4vc3JjL2FwaS9yZW5hbWUudHMiLCIuLi9zcmMvYXBpL25ldy50cyIsIi4uL3NyYy9kZWYvcHJlLXB1Ymxpc2gudHMiLCIuLi9zcmMvZGVmL3ZlcnNpb24udHMiLCIuLi9zcmMvYXBpL3ZlcnNpb24udHMiLCIuLi9zcmMvYXBpL3ByZS1wdWJsaXNoLnRzIiwiLi4vc3JjL2RlZi91bml2ZXJzYWxpemUudHMiLCIuLi9zcmMvYXBpL3VuaXZlcnNhbGl6ZS50cyIsIi4uL3NyYy9jb21tYW5kcy9hcnRpZmFjdHMudHMiLCIuLi9zcmMvZGVmL2J1aWxkLnRzIiwiLi4vc3JjL2NvbW1hbmRzL2J1aWxkLnRzIiwiLi4vc3JjL2NvbW1hbmRzL2NsaS12ZXJzaW9uLnRzIiwiLi4vc3JjL2NvbW1hbmRzL2NyZWF0ZS1ucG0tZGlycy50cyIsIi4uL3NyYy9jb21tYW5kcy9oZWxwLnRzIiwiLi4vc3JjL2NvbW1hbmRzL25ldy50cyIsIi4uL3NyYy9jb21tYW5kcy9wcmUtcHVibGlzaC50cyIsIi4uL3NyYy9jb21tYW5kcy9yZW5hbWUudHMiLCIuLi9zcmMvY29tbWFuZHMvdW5pdmVyc2FsaXplLnRzIiwiLi4vc3JjL2NvbW1hbmRzL3ZlcnNpb24udHMiLCIuLi9zcmMvaW5kZXgudHMiLCIuLi9zcmMvY2xpLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIFRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgYnkgY29kZWdlbi9pbmRleC50c1xuLy8gRG8gbm90IGVkaXQgdGhpcyBmaWxlIG1hbnVhbGx5XG5pbXBvcnQgeyBDb21tYW5kLCBPcHRpb24gfSBmcm9tICdjbGlwYW5pb24nXG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlQXJ0aWZhY3RzQ29tbWFuZCBleHRlbmRzIENvbW1hbmQge1xuICBzdGF0aWMgcGF0aHMgPSBbWydhcnRpZmFjdHMnXV1cblxuICBzdGF0aWMgdXNhZ2UgPSBDb21tYW5kLlVzYWdlKHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdDb3B5IGFydGlmYWN0cyBmcm9tIEdpdGh1YiBBY3Rpb25zIGludG8gbnBtIHBhY2thZ2VzIGFuZCByZWFkeSB0byBwdWJsaXNoJyxcbiAgfSlcblxuICBjd2QgPSBPcHRpb24uU3RyaW5nKCctLWN3ZCcsIHByb2Nlc3MuY3dkKCksIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGgnLFxuICB9KVxuXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWNvbmZpZy1wYXRoLC1jJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZScsXG4gIH0pXG5cbiAgcGFja2FnZUpzb25QYXRoID0gT3B0aW9uLlN0cmluZygnLS1wYWNrYWdlLWpzb24tcGF0aCcsICdwYWNrYWdlLmpzb24nLCB7XG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGBwYWNrYWdlLmpzb25gJyxcbiAgfSlcblxuICBvdXRwdXREaXIgPSBPcHRpb24uU3RyaW5nKCctLW91dHB1dC1kaXIsLW8sLWQnLCAnLi9hcnRpZmFjdHMnLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIGFsbCBidWlsdCBgLm5vZGVgIGZpbGVzIHB1dCwgc2FtZSBhcyBgLS1vdXRwdXQtZGlyYCBvZiBidWlsZCBjb21tYW5kJyxcbiAgfSlcblxuICBucG1EaXIgPSBPcHRpb24uU3RyaW5nKCctLW5wbS1kaXInLCAnbnBtJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0JyxcbiAgfSlcblxuICBidWlsZE91dHB1dERpcj86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tYnVpbGQtb3V0cHV0LWRpcicsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdQYXRoIHRvIHRoZSBidWlsZCBvdXRwdXQgZGlyLCBvbmx5IG5lZWRlZCB3aGVuIHRhcmdldHMgY29udGFpbnMgYHdhc20zMi13YXNpLSpgJyxcbiAgfSlcblxuICBnZXRPcHRpb25zKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjd2Q6IHRoaXMuY3dkLFxuICAgICAgY29uZmlnUGF0aDogdGhpcy5jb25maWdQYXRoLFxuICAgICAgcGFja2FnZUpzb25QYXRoOiB0aGlzLnBhY2thZ2VKc29uUGF0aCxcbiAgICAgIG91dHB1dERpcjogdGhpcy5vdXRwdXREaXIsXG4gICAgICBucG1EaXI6IHRoaXMubnBtRGlyLFxuICAgICAgYnVpbGRPdXRwdXREaXI6IHRoaXMuYnVpbGRPdXRwdXREaXIsXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ29weSBhcnRpZmFjdHMgZnJvbSBHaXRodWIgQWN0aW9ucyBpbnRvIG5wbSBwYWNrYWdlcyBhbmQgcmVhZHkgdG8gcHVibGlzaFxuICovXG5leHBvcnQgaW50ZXJmYWNlIEFydGlmYWN0c09wdGlvbnMge1xuICAvKipcbiAgICogVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoXG4gICAqXG4gICAqIEBkZWZhdWx0IHByb2Nlc3MuY3dkKClcbiAgICovXG4gIGN3ZD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgKi9cbiAgY29uZmlnUGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgcGFja2FnZS5qc29uYFxuICAgKlxuICAgKiBAZGVmYXVsdCAncGFja2FnZS5qc29uJ1xuICAgKi9cbiAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgYWxsIGJ1aWx0IGAubm9kZWAgZmlsZXMgcHV0LCBzYW1lIGFzIGAtLW91dHB1dC1kaXJgIG9mIGJ1aWxkIGNvbW1hbmRcbiAgICpcbiAgICogQGRlZmF1bHQgJy4vYXJ0aWZhY3RzJ1xuICAgKi9cbiAgb3V0cHV0RGlyPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgdGhlIG5wbSBwYWNrYWdlcyBwdXRcbiAgICpcbiAgICogQGRlZmF1bHQgJ25wbSdcbiAgICovXG4gIG5wbURpcj86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byB0aGUgYnVpbGQgb3V0cHV0IGRpciwgb25seSBuZWVkZWQgd2hlbiB0YXJnZXRzIGNvbnRhaW5zIGB3YXNtMzItd2FzaS0qYFxuICAgKi9cbiAgYnVpbGRPdXRwdXREaXI/OiBzdHJpbmdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5RGVmYXVsdEFydGlmYWN0c09wdGlvbnMob3B0aW9uczogQXJ0aWZhY3RzT3B0aW9ucykge1xuICByZXR1cm4ge1xuICAgIGN3ZDogcHJvY2Vzcy5jd2QoKSxcbiAgICBwYWNrYWdlSnNvblBhdGg6ICdwYWNrYWdlLmpzb24nLFxuICAgIG91dHB1dERpcjogJy4vYXJ0aWZhY3RzJyxcbiAgICBucG1EaXI6ICducG0nLFxuICAgIC4uLm9wdGlvbnMsXG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIGNvbG9ycyBmcm9tICdjb2xvcmV0dGUnXG5pbXBvcnQgeyBjcmVhdGVEZWJ1ZyB9IGZyb20gJ29idWcnXG5cbmRlY2xhcmUgbW9kdWxlICdvYnVnJyB7XG4gIGludGVyZmFjZSBEZWJ1Z2dlciB7XG4gICAgaW5mbzogdHlwZW9mIGNvbnNvbGUuZXJyb3JcbiAgICB3YXJuOiB0eXBlb2YgY29uc29sZS5lcnJvclxuICAgIGVycm9yOiB0eXBlb2YgY29uc29sZS5lcnJvclxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBkZWJ1Z0ZhY3RvcnkgPSAobmFtZXNwYWNlOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgZGVidWcgPSBjcmVhdGVEZWJ1ZyhgbmFwaToke25hbWVzcGFjZX1gLCB7XG4gICAgZm9ybWF0dGVyczoge1xuICAgICAgLy8gZGVidWcoJyVpJywgJ1RoaXMgaXMgYW4gaW5mbycpXG4gICAgICBpKHYpIHtcbiAgICAgICAgcmV0dXJuIGNvbG9ycy5ncmVlbih2KVxuICAgICAgfSxcbiAgICB9LFxuICB9KVxuXG4gIGRlYnVnLmluZm8gPSAoLi4uYXJnczogYW55W10pID0+XG4gICAgY29uc29sZS5lcnJvcihjb2xvcnMuYmxhY2soY29sb3JzLmJnR3JlZW4oJyBJTkZPICcpKSwgLi4uYXJncylcbiAgZGVidWcud2FybiA9ICguLi5hcmdzOiBhbnlbXSkgPT5cbiAgICBjb25zb2xlLmVycm9yKGNvbG9ycy5ibGFjayhjb2xvcnMuYmdZZWxsb3coJyBXQVJOSU5HICcpKSwgLi4uYXJncylcbiAgZGVidWcuZXJyb3IgPSAoLi4uYXJnczogYW55W10pID0+XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGNvbG9ycy53aGl0ZShjb2xvcnMuYmdSZWQoJyBFUlJPUiAnKSksXG4gICAgICAuLi5hcmdzLm1hcCgoYXJnKSA9PlxuICAgICAgICBhcmcgaW5zdGFuY2VvZiBFcnJvciA/IChhcmcuc3RhY2sgPz8gYXJnLm1lc3NhZ2UpIDogYXJnLFxuICAgICAgKSxcbiAgICApXG5cbiAgcmV0dXJuIGRlYnVnXG59XG5leHBvcnQgY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ3V0aWxzJylcbiIsIiIsImltcG9ydCB7XG4gIHJlYWRGaWxlLFxuICB3cml0ZUZpbGUsXG4gIHVubGluayxcbiAgY29weUZpbGUsXG4gIG1rZGlyLFxuICBzdGF0LFxuICByZWFkZGlyLFxuICBhY2Nlc3MsXG59IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnXG5cbmltcG9ydCBwa2dKc29uIGZyb20gJy4uLy4uL3BhY2thZ2UuanNvbicgd2l0aCB7IHR5cGU6ICdqc29uJyB9XG5pbXBvcnQgeyBkZWJ1ZyB9IGZyb20gJy4vbG9nLmpzJ1xuXG5leHBvcnQgY29uc3QgcmVhZEZpbGVBc3luYyA9IHJlYWRGaWxlXG5leHBvcnQgY29uc3Qgd3JpdGVGaWxlQXN5bmMgPSB3cml0ZUZpbGVcbmV4cG9ydCBjb25zdCB1bmxpbmtBc3luYyA9IHVubGlua1xuZXhwb3J0IGNvbnN0IGNvcHlGaWxlQXN5bmMgPSBjb3B5RmlsZVxuZXhwb3J0IGNvbnN0IG1rZGlyQXN5bmMgPSBta2RpclxuZXhwb3J0IGNvbnN0IHN0YXRBc3luYyA9IHN0YXRcbmV4cG9ydCBjb25zdCByZWFkZGlyQXN5bmMgPSByZWFkZGlyXG5cbmV4cG9ydCBmdW5jdGlvbiBmaWxlRXhpc3RzKHBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICByZXR1cm4gYWNjZXNzKHBhdGgpLnRoZW4oXG4gICAgKCkgPT4gdHJ1ZSxcbiAgICAoKSA9PiBmYWxzZSxcbiAgKVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGlyRXhpc3RzQXN5bmMocGF0aDogc3RyaW5nKSB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBzdGF0QXN5bmMocGF0aClcbiAgICByZXR1cm4gc3RhdHMuaXNEaXJlY3RvcnkoKVxuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGljazxPLCBLIGV4dGVuZHMga2V5b2YgTz4obzogTywgLi4ua2V5czogS1tdKTogUGljazxPLCBLPiB7XG4gIHJldHVybiBrZXlzLnJlZHVjZSgoYWNjLCBrZXkpID0+IHtcbiAgICBhY2Nba2V5XSA9IG9ba2V5XVxuICAgIHJldHVybiBhY2NcbiAgfSwge30gYXMgTylcbn1cblxuZnVuY3Rpb24gaXNQbGFpbk9iamVjdCh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICByZXR1cm4gdmFsdWUgIT09IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSlcbn1cblxuZnVuY3Rpb24gbWVyZ2VQYWNrYWdlSnNvbihcbiAgb2xkOiBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuICBwYXJ0aWFsOiBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuKTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gIGNvbnN0IG1lcmdlZCA9IHsgLi4ub2xkIH1cblxuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhwYXJ0aWFsKSkge1xuICAgIGlmIChpc1BsYWluT2JqZWN0KG1lcmdlZFtrZXldKSAmJiBpc1BsYWluT2JqZWN0KHZhbHVlKSkge1xuICAgICAgbWVyZ2VkW2tleV0gPSBtZXJnZVBhY2thZ2VKc29uKG1lcmdlZFtrZXldLCB2YWx1ZSlcbiAgICB9IGVsc2Uge1xuICAgICAgbWVyZ2VkW2tleV0gPSB2YWx1ZVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtZXJnZWRcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVBhY2thZ2VKc29uKFxuICBwYXRoOiBzdHJpbmcsXG4gIHBhcnRpYWw6IFJlY29yZDxzdHJpbmcsIGFueT4sXG4pIHtcbiAgY29uc3QgZXhpc3RzID0gYXdhaXQgZmlsZUV4aXN0cyhwYXRoKVxuICBpZiAoIWV4aXN0cykge1xuICAgIGRlYnVnKGBGaWxlIG5vdCBleGlzdHMgJHtwYXRofWApXG4gICAgcmV0dXJuXG4gIH1cbiAgY29uc3Qgb2xkID0gSlNPTi5wYXJzZShhd2FpdCByZWFkRmlsZUFzeW5jKHBhdGgsICd1dGY4JykpXG4gIGF3YWl0IHdyaXRlRmlsZUFzeW5jKFxuICAgIHBhdGgsXG4gICAgSlNPTi5zdHJpbmdpZnkobWVyZ2VQYWNrYWdlSnNvbihvbGQsIHBhcnRpYWwpLCBudWxsLCAyKSxcbiAgKVxufVxuXG5leHBvcnQgY29uc3QgQ0xJX1ZFUlNJT04gPSBwa2dKc29uLnZlcnNpb25cbiIsImltcG9ydCB7IGV4ZWNTeW5jIH0gZnJvbSAnbm9kZTpjaGlsZF9wcm9jZXNzJ1xuXG5leHBvcnQgdHlwZSBQbGF0Zm9ybSA9IE5vZGVKUy5QbGF0Zm9ybSB8ICd3YXNtJyB8ICd3YXNpJyB8ICdvcGVuaGFybW9ueSdcblxuZXhwb3J0IGNvbnN0IFVOSVZFUlNBTF9UQVJHRVRTID0ge1xuICAndW5pdmVyc2FsLWFwcGxlLWRhcndpbic6IFsnYWFyY2g2NC1hcHBsZS1kYXJ3aW4nLCAneDg2XzY0LWFwcGxlLWRhcndpbiddLFxufSBhcyBjb25zdFxuXG5jb25zdCBTVUJfU1lTVEVNUyA9IG5ldyBTZXQoWydhbmRyb2lkJywgJ29ob3MnXSlcblxuZXhwb3J0IGNvbnN0IEFWQUlMQUJMRV9UQVJHRVRTID0gW1xuICAnYWFyY2g2NC1hcHBsZS1kYXJ3aW4nLFxuICAnYWFyY2g2NC1saW51eC1hbmRyb2lkJyxcbiAgJ2FhcmNoNjQtdW5rbm93bi1saW51eC1nbnUnLFxuICAnYWFyY2g2NC11bmtub3duLWxpbnV4LW11c2wnLFxuICAnYWFyY2g2NC11bmtub3duLWxpbnV4LW9ob3MnLFxuICAnYWFyY2g2NC1wYy13aW5kb3dzLW1zdmMnLFxuICAneDg2XzY0LWFwcGxlLWRhcndpbicsXG4gICd4ODZfNjQtcGMtd2luZG93cy1tc3ZjJyxcbiAgJ3g4Nl82NC1wYy13aW5kb3dzLWdudScsXG4gICd4ODZfNjQtdW5rbm93bi1saW51eC1nbnUnLFxuICAneDg2XzY0LXVua25vd24tbGludXgtbXVzbCcsXG4gICd4ODZfNjQtdW5rbm93bi1saW51eC1vaG9zJyxcbiAgJ3g4Nl82NC11bmtub3duLWZyZWVic2QnLFxuICAnaTY4Ni1wYy13aW5kb3dzLW1zdmMnLFxuICAnYXJtdjctdW5rbm93bi1saW51eC1nbnVlYWJpaGYnLFxuICAnYXJtdjctdW5rbm93bi1saW51eC1tdXNsZWFiaWhmJyxcbiAgJ2FybXY3LWxpbnV4LWFuZHJvaWRlYWJpJyxcbiAgJ3VuaXZlcnNhbC1hcHBsZS1kYXJ3aW4nLFxuICAnbG9vbmdhcmNoNjQtdW5rbm93bi1saW51eC1nbnUnLFxuICAncmlzY3Y2NGdjLXVua25vd24tbGludXgtZ251JyxcbiAgJ3Bvd2VycGM2NGxlLXVua25vd24tbGludXgtZ251JyxcbiAgJ3MzOTB4LXVua25vd24tbGludXgtZ251JyxcbiAgJ3dhc20zMi13YXNpLXByZXZpZXcxLXRocmVhZHMnLFxuICAnd2FzbTMyLXdhc2lwMS10aHJlYWRzJyxcbl0gYXMgY29uc3RcblxuZXhwb3J0IHR5cGUgVGFyZ2V0VHJpcGxlID0gKHR5cGVvZiBBVkFJTEFCTEVfVEFSR0VUUylbbnVtYmVyXVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9UQVJHRVRTID0gW1xuICAneDg2XzY0LWFwcGxlLWRhcndpbicsXG4gICdhYXJjaDY0LWFwcGxlLWRhcndpbicsXG4gICd4ODZfNjQtcGMtd2luZG93cy1tc3ZjJyxcbiAgJ3g4Nl82NC11bmtub3duLWxpbnV4LWdudScsXG5dIGFzIGNvbnN0XG5cbmV4cG9ydCBjb25zdCBUQVJHRVRfTElOS0VSOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAnYWFyY2g2NC11bmtub3duLWxpbnV4LW11c2wnOiAnYWFyY2g2NC1saW51eC1tdXNsLWdjYycsXG4gIC8vIFRPRE86IFN3aXRjaCB0byBsb29uZ2FyY2g2NC1saW51eC1nbnUtZ2NjIHdoZW4gYXZhaWxhYmxlXG4gICdsb29uZ2FyY2g2NC11bmtub3duLWxpbnV4LWdudSc6ICdsb29uZ2FyY2g2NC1saW51eC1nbnUtZ2NjLTEzJyxcbiAgJ3Jpc2N2NjRnYy11bmtub3duLWxpbnV4LWdudSc6ICdyaXNjdjY0LWxpbnV4LWdudS1nY2MnLFxuICAncG93ZXJwYzY0bGUtdW5rbm93bi1saW51eC1nbnUnOiAncG93ZXJwYzY0bGUtbGludXgtZ251LWdjYycsXG4gICdzMzkweC11bmtub3duLWxpbnV4LWdudSc6ICdzMzkweC1saW51eC1nbnUtZ2NjJyxcbn1cblxuLy8gaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9wcm9jZXNzLmh0bWwjcHJvY2Vzc19wcm9jZXNzX2FyY2hcbnR5cGUgTm9kZUpTQXJjaCA9XG4gIHwgJ2FybSdcbiAgfCAnYXJtNjQnXG4gIHwgJ2lhMzInXG4gIHwgJ2xvb25nNjQnXG4gIHwgJ21pcHMnXG4gIHwgJ21pcHNlbCdcbiAgfCAncHBjJ1xuICB8ICdwcGM2NCdcbiAgfCAncmlzY3Y2NCdcbiAgfCAnczM5MCdcbiAgfCAnczM5MHgnXG4gIHwgJ3gzMidcbiAgfCAneDY0J1xuICB8ICd1bml2ZXJzYWwnXG4gIHwgJ3dhc20zMidcblxuY29uc3QgQ3B1VG9Ob2RlQXJjaDogUmVjb3JkPHN0cmluZywgTm9kZUpTQXJjaD4gPSB7XG4gIHg4Nl82NDogJ3g2NCcsXG4gIGFhcmNoNjQ6ICdhcm02NCcsXG4gIGk2ODY6ICdpYTMyJyxcbiAgYXJtdjc6ICdhcm0nLFxuICBsb29uZ2FyY2g2NDogJ2xvb25nNjQnLFxuICByaXNjdjY0Z2M6ICdyaXNjdjY0JyxcbiAgcG93ZXJwYzY0bGU6ICdwcGM2NCcsXG59XG5cbmV4cG9ydCBjb25zdCBOb2RlQXJjaFRvQ3B1OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICB4NjQ6ICd4ODZfNjQnLFxuICBhcm02NDogJ2FhcmNoNjQnLFxuICBpYTMyOiAnaTY4NicsXG4gIGFybTogJ2FybXY3JyxcbiAgbG9vbmc2NDogJ2xvb25nYXJjaDY0JyxcbiAgcmlzY3Y2NDogJ3Jpc2N2NjRnYycsXG4gIHBwYzY0OiAncG93ZXJwYzY0bGUnLFxufVxuXG5jb25zdCBTeXNUb05vZGVQbGF0Zm9ybTogUmVjb3JkPHN0cmluZywgUGxhdGZvcm0+ID0ge1xuICBsaW51eDogJ2xpbnV4JyxcbiAgZnJlZWJzZDogJ2ZyZWVic2QnLFxuICBkYXJ3aW46ICdkYXJ3aW4nLFxuICB3aW5kb3dzOiAnd2luMzInLFxuICBvaG9zOiAnb3Blbmhhcm1vbnknLFxufVxuXG5leHBvcnQgY29uc3QgVW5pQXJjaHNCeVBsYXRmb3JtOiBQYXJ0aWFsPFJlY29yZDxQbGF0Zm9ybSwgTm9kZUpTQXJjaFtdPj4gPSB7XG4gIGRhcndpbjogWyd4NjQnLCAnYXJtNjQnXSxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYXJnZXQge1xuICB0cmlwbGU6IHN0cmluZ1xuICBwbGF0Zm9ybUFyY2hBQkk6IHN0cmluZ1xuICBwbGF0Zm9ybTogUGxhdGZvcm1cbiAgYXJjaDogTm9kZUpTQXJjaFxuICBhYmk6IHN0cmluZyB8IG51bGxcbn1cblxuLyoqXG4gKiBBIHRyaXBsZSBpcyBhIHNwZWNpZmljIGZvcm1hdCBmb3Igc3BlY2lmeWluZyBhIHRhcmdldCBhcmNoaXRlY3R1cmUuXG4gKiBUcmlwbGVzIG1heSBiZSByZWZlcnJlZCB0byBhcyBhIHRhcmdldCB0cmlwbGUgd2hpY2ggaXMgdGhlIGFyY2hpdGVjdHVyZSBmb3IgdGhlIGFydGlmYWN0IHByb2R1Y2VkLCBhbmQgdGhlIGhvc3QgdHJpcGxlIHdoaWNoIGlzIHRoZSBhcmNoaXRlY3R1cmUgdGhhdCB0aGUgY29tcGlsZXIgaXMgcnVubmluZyBvbi5cbiAqIFRoZSBnZW5lcmFsIGZvcm1hdCBvZiB0aGUgdHJpcGxlIGlzIGA8YXJjaD48c3ViPi08dmVuZG9yPi08c3lzPi08YWJpPmAgd2hlcmU6XG4gKiAgIC0gYGFyY2hgID0gVGhlIGJhc2UgQ1BVIGFyY2hpdGVjdHVyZSwgZm9yIGV4YW1wbGUgYHg4Nl82NGAsIGBpNjg2YCwgYGFybWAsIGB0aHVtYmAsIGBtaXBzYCwgZXRjLlxuICogICAtIGBzdWJgID0gVGhlIENQVSBzdWItYXJjaGl0ZWN0dXJlLCBmb3IgZXhhbXBsZSBgYXJtYCBoYXMgYHY3YCwgYHY3c2AsIGB2NXRlYCwgZXRjLlxuICogICAtIGB2ZW5kb3JgID0gVGhlIHZlbmRvciwgZm9yIGV4YW1wbGUgYHVua25vd25gLCBgYXBwbGVgLCBgcGNgLCBgbnZpZGlhYCwgZXRjLlxuICogICAtIGBzeXNgID0gVGhlIHN5c3RlbSBuYW1lLCBmb3IgZXhhbXBsZSBgbGludXhgLCBgd2luZG93c2AsIGBkYXJ3aW5gLCBldGMuIG5vbmUgaXMgdHlwaWNhbGx5IHVzZWQgZm9yIGJhcmUtbWV0YWwgd2l0aG91dCBhbiBPUy5cbiAqICAgLSBgYWJpYCA9IFRoZSBBQkksIGZvciBleGFtcGxlIGBnbnVgLCBgYW5kcm9pZGAsIGBlYWJpYCwgZXRjLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUcmlwbGUocmF3VHJpcGxlOiBzdHJpbmcpOiBUYXJnZXQge1xuICBpZiAoXG4gICAgcmF3VHJpcGxlID09PSAnd2FzbTMyLXdhc2knIHx8XG4gICAgcmF3VHJpcGxlID09PSAnd2FzbTMyLXdhc2ktcHJldmlldzEtdGhyZWFkcycgfHxcbiAgICByYXdUcmlwbGUuc3RhcnRzV2l0aCgnd2FzbTMyLXdhc2lwJylcbiAgKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRyaXBsZTogcmF3VHJpcGxlLFxuICAgICAgcGxhdGZvcm1BcmNoQUJJOiAnd2FzbTMyLXdhc2knLFxuICAgICAgcGxhdGZvcm06ICd3YXNpJyxcbiAgICAgIGFyY2g6ICd3YXNtMzInLFxuICAgICAgYWJpOiAnd2FzaScsXG4gICAgfVxuICB9XG4gIGNvbnN0IHRyaXBsZSA9IHJhd1RyaXBsZS5lbmRzV2l0aCgnZWFiaScpXG4gICAgPyBgJHtyYXdUcmlwbGUuc2xpY2UoMCwgLTQpfS1lYWJpYFxuICAgIDogcmF3VHJpcGxlXG4gIGNvbnN0IHRyaXBsZXMgPSB0cmlwbGUuc3BsaXQoJy0nKVxuICBsZXQgY3B1OiBzdHJpbmdcbiAgbGV0IHN5czogc3RyaW5nXG4gIGxldCBhYmk6IHN0cmluZyB8IG51bGwgPSBudWxsXG4gIGlmICh0cmlwbGVzLmxlbmd0aCA9PT0gMikge1xuICAgIC8vIGFhcmNoNjQtZnVjaHNpYVxuICAgIC8vIF4gY3B1ICAgXiBzeXNcbiAgICA7W2NwdSwgc3lzXSA9IHRyaXBsZXNcbiAgfSBlbHNlIHtcbiAgICAvLyBhYXJjaDY0LXVua25vd24tbGludXgtbXVzbFxuICAgIC8vIF4gY3B1ICAgXnZlbmRvciBeIHN5cyBeIGFiaVxuICAgIC8vIGFhcmNoNjQtYXBwbGUtZGFyd2luXG4gICAgLy8gXiBjcHUgICAgICAgICBeIHN5cyAgKGFiaSBpcyBOb25lKVxuICAgIDtbY3B1LCAsIHN5cywgYWJpID0gbnVsbF0gPSB0cmlwbGVzXG4gIH1cblxuICBpZiAoYWJpICYmIFNVQl9TWVNURU1TLmhhcyhhYmkpKSB7XG4gICAgc3lzID0gYWJpXG4gICAgYWJpID0gbnVsbFxuICB9XG4gIGNvbnN0IHBsYXRmb3JtID0gU3lzVG9Ob2RlUGxhdGZvcm1bc3lzXSA/PyAoc3lzIGFzIFBsYXRmb3JtKVxuICBjb25zdCBhcmNoID0gQ3B1VG9Ob2RlQXJjaFtjcHVdID8/IChjcHUgYXMgTm9kZUpTQXJjaClcblxuICByZXR1cm4ge1xuICAgIHRyaXBsZTogcmF3VHJpcGxlLFxuICAgIHBsYXRmb3JtQXJjaEFCSTogYWJpID8gYCR7cGxhdGZvcm19LSR7YXJjaH0tJHthYml9YCA6IGAke3BsYXRmb3JtfS0ke2FyY2h9YCxcbiAgICBwbGF0Zm9ybSxcbiAgICBhcmNoLFxuICAgIGFiaSxcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3lzdGVtRGVmYXVsdFRhcmdldCgpOiBUYXJnZXQge1xuICBjb25zdCBob3N0ID0gZXhlY1N5bmMoYHJ1c3RjIC12VmAsIHtcbiAgICBlbnY6IHByb2Nlc3MuZW52LFxuICB9KVxuICAgIC50b1N0cmluZygndXRmOCcpXG4gICAgLnNwbGl0KCdcXG4nKVxuICAgIC5maW5kKChsaW5lKSA9PiBsaW5lLnN0YXJ0c1dpdGgoJ2hvc3Q6ICcpKVxuICBjb25zdCB0cmlwbGUgPSBob3N0Py5zbGljZSgnaG9zdDogJy5sZW5ndGgpXG4gIGlmICghdHJpcGxlKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgQ2FuIG5vdCBwYXJzZSB0YXJnZXQgdHJpcGxlIGZyb20gaG9zdGApXG4gIH1cbiAgcmV0dXJuIHBhcnNlVHJpcGxlKHRyaXBsZSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFRhcmdldExpbmtlcih0YXJnZXQ6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBUQVJHRVRfTElOS0VSW3RhcmdldF1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRhcmdldFRvRW52VmFyKHRhcmdldDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRhcmdldC5yZXBsYWNlKC8tL2csICdfJykudG9VcHBlckNhc2UoKVxufVxuIiwiZXhwb3J0IGVudW0gTmFwaVZlcnNpb24ge1xuICBOYXBpMSA9IDEsXG4gIE5hcGkyLFxuICBOYXBpMyxcbiAgTmFwaTQsXG4gIE5hcGk1LFxuICBOYXBpNixcbiAgTmFwaTcsXG4gIE5hcGk4LFxuICBOYXBpOSxcbiAgTmFwaTEwLFxufVxuXG4vLy8gYmVjYXVzZSBub2RlIHN1cHBvcnQgbmV3IG5hcGkgdmVyc2lvbiBpbiBzb21lIG1pbm9yIHZlcnNpb24gdXBkYXRlcywgc28gd2UgbWlnaHQgbWVldCBzdWNoIHNpdHVhdGlvbjpcbi8vLyBgbm9kZSB2MTAuMjAuMGAgc3VwcG9ydHMgYG5hcGk1YCBhbmQgYG5hcGk2YCwgYnV0IGBub2RlIHYxMi4wLjBgIG9ubHkgc3VwcG9ydCBgbmFwaTRgLFxuLy8vIGJ5IHdoaWNoLCB3ZSBjYW4gbm90IHRlbGwgZGlyZWN0bHkgbmFwaSB2ZXJzaW9uIHN1cHBvcnRsZXNzIGZyb20gbm9kZSB2ZXJzaW9uIGRpcmVjdGx5LlxuY29uc3QgTkFQSV9WRVJTSU9OX01BVFJJWCA9IG5ldyBNYXA8TmFwaVZlcnNpb24sIHN0cmluZz4oW1xuICBbTmFwaVZlcnNpb24uTmFwaTEsICc4LjYuMCB8IDkuMC4wIHwgMTAuMC4wJ10sXG4gIFtOYXBpVmVyc2lvbi5OYXBpMiwgJzguMTAuMCB8IDkuMy4wIHwgMTAuMC4wJ10sXG4gIFtOYXBpVmVyc2lvbi5OYXBpMywgJzYuMTQuMiB8IDguMTEuMiB8IDkuMTEuMCB8IDEwLjAuMCddLFxuICBbTmFwaVZlcnNpb24uTmFwaTQsICcxMC4xNi4wIHwgMTEuOC4wIHwgMTIuMC4wJ10sXG4gIFtOYXBpVmVyc2lvbi5OYXBpNSwgJzEwLjE3LjAgfCAxMi4xMS4wIHwgMTMuMC4wJ10sXG4gIFtOYXBpVmVyc2lvbi5OYXBpNiwgJzEwLjIwLjAgfCAxMi4xNy4wIHwgMTQuMC4wJ10sXG4gIFtOYXBpVmVyc2lvbi5OYXBpNywgJzEwLjIzLjAgfCAxMi4xOS4wIHwgMTQuMTIuMCB8IDE1LjAuMCddLFxuICBbTmFwaVZlcnNpb24uTmFwaTgsICcxMi4yMi4wIHwgMTQuMTcuMCB8IDE1LjEyLjAgfCAxNi4wLjAnXSxcbiAgW05hcGlWZXJzaW9uLk5hcGk5LCAnMTguMTcuMCB8IDIwLjMuMCB8IDIxLjEuMCddLFxuICBbTmFwaVZlcnNpb24uTmFwaTEwLCAnMjIuMTQuMCB8IDIzLjYuMCddLFxuXSlcblxuZXhwb3J0IGNvbnN0IFNVUFBPUlRFRF9OQVBJX1ZFUlNJT05TID0gT2JqZWN0LnZhbHVlcyhOYXBpVmVyc2lvbikuZmlsdGVyKFxuICAodik6IHYgaXMgTmFwaVZlcnNpb24gPT4gdHlwZW9mIHYgPT09ICdudW1iZXInLFxuKVxuXG5pbnRlcmZhY2UgTm9kZVZlcnNpb24ge1xuICBtYWpvcjogbnVtYmVyXG4gIG1pbm9yOiBudW1iZXJcbiAgcGF0Y2g6IG51bWJlclxufVxuXG5mdW5jdGlvbiBwYXJzZU5vZGVWZXJzaW9uKHY6IHN0cmluZyk6IE5vZGVWZXJzaW9uIHtcbiAgY29uc3QgbWF0Y2hlcyA9IHYubWF0Y2goL3Y/KFswLTldKylcXC4oWzAtOV0rKVxcLihbMC05XSspL2kpXG5cbiAgaWYgKCFtYXRjaGVzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG5vZGUgdmVyc2lvbiBudW1iZXI6ICcgKyB2KVxuICB9XG5cbiAgY29uc3QgWywgbWFqb3IsIG1pbm9yLCBwYXRjaF0gPSBtYXRjaGVzXG5cbiAgcmV0dXJuIHtcbiAgICBtYWpvcjogcGFyc2VJbnQobWFqb3IpLFxuICAgIG1pbm9yOiBwYXJzZUludChtaW5vciksXG4gICAgcGF0Y2g6IHBhcnNlSW50KHBhdGNoKSxcbiAgfVxufVxuXG5mdW5jdGlvbiByZXF1aXJlZE5vZGVWZXJzaW9ucyhuYXBpVmVyc2lvbjogTmFwaVZlcnNpb24pOiBOb2RlVmVyc2lvbltdIHtcbiAgY29uc3QgcmVxdWlyZW1lbnQgPSBOQVBJX1ZFUlNJT05fTUFUUklYLmdldChuYXBpVmVyc2lvbilcblxuICBpZiAoIXJlcXVpcmVtZW50KSB7XG4gICAgcmV0dXJuIFtwYXJzZU5vZGVWZXJzaW9uKCcxMC4wLjAnKV1cbiAgfVxuXG4gIHJldHVybiByZXF1aXJlbWVudC5zcGxpdCgnfCcpLm1hcChwYXJzZU5vZGVWZXJzaW9uKVxufVxuXG5mdW5jdGlvbiB0b0VuZ2luZVJlcXVpcmVtZW50KHZlcnNpb25zOiBOb2RlVmVyc2lvbltdKTogc3RyaW5nIHtcbiAgY29uc3QgcmVxdWlyZW1lbnRzOiBzdHJpbmdbXSA9IFtdXG4gIHZlcnNpb25zLmZvckVhY2goKHYsIGkpID0+IHtcbiAgICBsZXQgcmVxID0gJydcbiAgICBpZiAoaSAhPT0gMCkge1xuICAgICAgY29uc3QgbGFzdFZlcnNpb24gPSB2ZXJzaW9uc1tpIC0gMV1cbiAgICAgIHJlcSArPSBgPCAke2xhc3RWZXJzaW9uLm1ham9yICsgMX1gXG4gICAgfVxuXG4gICAgcmVxICs9IGAke2kgPT09IDAgPyAnJyA6ICcgfHwgJ30+PSAke3YubWFqb3J9LiR7di5taW5vcn0uJHt2LnBhdGNofWBcbiAgICByZXF1aXJlbWVudHMucHVzaChyZXEpXG4gIH0pXG5cbiAgcmV0dXJuIHJlcXVpcmVtZW50cy5qb2luKCcgJylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5hcGlFbmdpbmVSZXF1aXJlbWVudChuYXBpVmVyc2lvbjogTmFwaVZlcnNpb24pOiBzdHJpbmcge1xuICByZXR1cm4gdG9FbmdpbmVSZXF1aXJlbWVudChyZXF1aXJlZE5vZGVWZXJzaW9ucyhuYXBpVmVyc2lvbikpXG59XG4iLCJpbXBvcnQgeyBzcGF3biB9IGZyb20gJ25vZGU6Y2hpbGRfcHJvY2VzcydcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJ1xuXG5pbXBvcnQgeyBkZWJ1Z0ZhY3RvcnkgfSBmcm9tICcuL2xvZy5qcydcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ21ldGFkYXRhJylcblxuZXhwb3J0IHR5cGUgQ3JhdGVUYXJnZXRLaW5kID1cbiAgfCAnYmluJ1xuICB8ICdleGFtcGxlJ1xuICB8ICd0ZXN0J1xuICB8ICdiZW5jaCdcbiAgfCAnbGliJ1xuICB8ICdybGliJ1xuICB8ICdjZHlsaWInXG4gIHwgJ2N1c3RvbS1idWlsZCdcblxuZXhwb3J0IGludGVyZmFjZSBDcmF0ZVRhcmdldCB7XG4gIG5hbWU6IHN0cmluZ1xuICBraW5kOiBDcmF0ZVRhcmdldEtpbmRbXVxuICBjcmF0ZV90eXBlczogQ3JhdGVUYXJnZXRLaW5kW11cbn1cblxuZXhwb3J0IGludGVyZmFjZSBDcmF0ZSB7XG4gIGlkOiBzdHJpbmdcbiAgbmFtZTogc3RyaW5nXG4gIHNyY19wYXRoOiBzdHJpbmdcbiAgdmVyc2lvbjogc3RyaW5nXG4gIGVkaXRpb246IHN0cmluZ1xuICB0YXJnZXRzOiBDcmF0ZVRhcmdldFtdXG4gIGZlYXR1cmVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT5cbiAgbWFuaWZlc3RfcGF0aDogc3RyaW5nXG4gIGRlcGVuZGVuY2llczogQXJyYXk8e1xuICAgIG5hbWU6IHN0cmluZ1xuICAgIHNvdXJjZTogc3RyaW5nXG4gICAgcmVxOiBzdHJpbmdcbiAgICBraW5kOiBzdHJpbmcgfCBudWxsXG4gICAgcmVuYW1lOiBzdHJpbmcgfCBudWxsXG4gICAgb3B0aW9uYWw6IGJvb2xlYW5cbiAgICB1c2VzX2RlZmF1bHRfZmVhdHVyZXM6IGJvb2xlYW5cbiAgICBmZWF0dXJlczogc3RyaW5nW11cbiAgICB0YXJnZXQ6IHN0cmluZyB8IG51bGxcbiAgICByZWdpc3RyeTogc3RyaW5nIHwgbnVsbFxuICB9PlxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENyYXRlUmVzb2x2ZU5vZGUge1xuICBpZDogc3RyaW5nXG4gIGRlcHM6IEFycmF5PHtcbiAgICBuYW1lOiBzdHJpbmdcbiAgICBwa2c6IHN0cmluZ1xuICB9PlxuICBmZWF0dXJlczogc3RyaW5nW11cbn1cblxuZXhwb3J0IGludGVyZmFjZSBDYXJnb1dvcmtzcGFjZU1ldGFkYXRhIHtcbiAgdmVyc2lvbjogbnVtYmVyXG4gIHBhY2thZ2VzOiBDcmF0ZVtdXG4gIHdvcmtzcGFjZV9tZW1iZXJzOiBzdHJpbmdbXVxuICB0YXJnZXRfZGlyZWN0b3J5OiBzdHJpbmdcbiAgd29ya3NwYWNlX3Jvb3Q6IHN0cmluZ1xuICByZXNvbHZlPzoge1xuICAgIG5vZGVzOiBDcmF0ZVJlc29sdmVOb2RlW11cbiAgICByb290OiBzdHJpbmcgfCBudWxsXG4gIH0gfCBudWxsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FyZ29GZWF0dXJlT3B0aW9ucyB7XG4gIGZlYXR1cmVzPzogc3RyaW5nW11cbiAgYWxsRmVhdHVyZXM/OiBib29sZWFuXG4gIG5vRGVmYXVsdEZlYXR1cmVzPzogYm9vbGVhblxufVxuXG4vLyBDcmF0ZXMgdGhhdCB3aWxsIGFjdHVhbGx5IGNvbXBpbGUgYG5hcGktZGVyaXZlYCBpbiB0aGlzIGJ1aWxkLCBhbmQgYXJlIHRoZXJlZm9yZVxuLy8gZXhwZWN0ZWQgdG8gZW1pdCBhIHR5cGUtZGVmIGludGVybWVkaWF0ZSBmaWxlLiBQcmVmZXIgdGhlIHJlc29sdmVkIGRlcGVuZGVuY3kgZ3JhcGg6XG4vLyBhIGNyYXRlIHdob3NlIGBuYXBpLWRlcml2ZWAgZGVwZW5kZW5jeSBpcyBvcHRpb25hbCBhbmQgc3RheXMgZGlzYWJsZWQgbmV2ZXIgZW1pdHMgYVxuLy8gdHlwZS1kZWYgZmlsZSwgc28gZm9yY2UtYnVpbGRpbmcgaXQgd291bGQgaW52YWxpZGF0ZSBjYXJnbydzIGZpbmdlcnByaW50IG9uIGV2ZXJ5XG4vLyBidWlsZCB3aXRob3V0IGV2ZXIgc2F0aXNmeWluZyB0aGUgdHlwZS1kZWYgY2hlY2suIEZhbGwgYmFjayB0byBkZWNsYXJlZCBkZXBlbmRlbmNpZXNcbi8vIHdoZW4gdGhlIHJlc29sdmUgZ3JhcGggaXMgdW5hdmFpbGFibGUuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TmFwaURlcml2ZURlcGVuZGVudENyYXRlcyhcbiAgbWV0YWRhdGE6IENhcmdvV29ya3NwYWNlTWV0YWRhdGEsXG4pOiBDcmF0ZVtdIHtcbiAgY29uc3QgcmVzb2x2ZU5vZGVzID0gbWV0YWRhdGEucmVzb2x2ZT8ubm9kZXNcbiAgaWYgKCFyZXNvbHZlTm9kZXMpIHtcbiAgICByZXR1cm4gbWV0YWRhdGEucGFja2FnZXMuZmlsdGVyKChjcmF0ZSkgPT5cbiAgICAgIGNyYXRlLmRlcGVuZGVuY2llcy5zb21lKChkKSA9PiBkLm5hbWUgPT09ICduYXBpLWRlcml2ZScpLFxuICAgIClcbiAgfVxuICBjb25zdCBuYXBpRGVyaXZlUGFja2FnZUlkcyA9IG5ldyBTZXQoXG4gICAgbWV0YWRhdGEucGFja2FnZXMuZmlsdGVyKChwKSA9PiBwLm5hbWUgPT09ICduYXBpLWRlcml2ZScpLm1hcCgocCkgPT4gcC5pZCksXG4gIClcbiAgY29uc3QgZGVwZW5kZW50UGFja2FnZUlkcyA9IG5ldyBTZXQoXG4gICAgcmVzb2x2ZU5vZGVzXG4gICAgICAuZmlsdGVyKChub2RlKSA9PlxuICAgICAgICBub2RlLmRlcHMuc29tZSgoZGVwKSA9PiBuYXBpRGVyaXZlUGFja2FnZUlkcy5oYXMoZGVwLnBrZykpLFxuICAgICAgKVxuICAgICAgLm1hcCgobm9kZSkgPT4gbm9kZS5pZCksXG4gIClcbiAgcmV0dXJuIG1ldGFkYXRhLnBhY2thZ2VzLmZpbHRlcigoY3JhdGUpID0+IGRlcGVuZGVudFBhY2thZ2VJZHMuaGFzKGNyYXRlLmlkKSlcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHBhcnNlTWV0YWRhdGEoXG4gIG1hbmlmZXN0UGF0aDogc3RyaW5nLFxuICBmZWF0dXJlT3B0aW9ucz86IENhcmdvRmVhdHVyZU9wdGlvbnMsXG4pIHtcbiAgaWYgKCFmcy5leGlzdHNTeW5jKG1hbmlmZXN0UGF0aCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIGNyYXRlIGZvdW5kIGluIG1hbmlmZXN0OiAke21hbmlmZXN0UGF0aH1gKVxuICB9XG5cbiAgY29uc3QgZmVhdHVyZUFyZ3M6IHN0cmluZ1tdID0gW11cbiAgaWYgKGZlYXR1cmVPcHRpb25zPy5hbGxGZWF0dXJlcykge1xuICAgIGZlYXR1cmVBcmdzLnB1c2goJy0tYWxsLWZlYXR1cmVzJylcbiAgfVxuICBpZiAoZmVhdHVyZU9wdGlvbnM/Lm5vRGVmYXVsdEZlYXR1cmVzKSB7XG4gICAgZmVhdHVyZUFyZ3MucHVzaCgnLS1uby1kZWZhdWx0LWZlYXR1cmVzJylcbiAgfVxuICBpZiAoZmVhdHVyZU9wdGlvbnM/LmZlYXR1cmVzPy5sZW5ndGgpIHtcbiAgICBmZWF0dXJlQXJncy5wdXNoKCctLWZlYXR1cmVzJywgZmVhdHVyZU9wdGlvbnMuZmVhdHVyZXMuam9pbignLCcpKVxuICB9XG5cbiAgLy8gUmVzb2x2aW5nIHdpdGggdGhlIGJ1aWxkJ3MgZmVhdHVyZSBmbGFncyBrZWVwcyBgbWV0YWRhdGEucmVzb2x2ZWAgaW4gc3luYyB3aXRoIHdoYXRcbiAgLy8gYGNhcmdvIGJ1aWxkYCB3aWxsIGFjdHVhbGx5IGNvbXBpbGUuIEZlYXR1cmUgZmxhZ3MgYXJlIHJlamVjdGVkIGluIHNvbWUgc2V0dXBzXG4gIC8vIChlLmcuIGEgdmlydHVhbCB3b3Jrc3BhY2Ugcm9vdCBtYW5pZmVzdCksIHNvIGZhbGwgYmFjayB0byBhIHBsYWluIGludm9jYXRpb24uXG4gIGlmIChmZWF0dXJlQXJncy5sZW5ndGgpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IGV4ZWNDYXJnb01ldGFkYXRhKG1hbmlmZXN0UGF0aCwgZmVhdHVyZUFyZ3MpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZGVidWcud2FybihcbiAgICAgICAgYGNhcmdvIG1ldGFkYXRhIGZhaWxlZCB3aXRoIGZlYXR1cmUgZmxhZ3MsIHJldHJ5aW5nIHdpdGhvdXQgdGhlbTogJHtlfWAsXG4gICAgICApXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGV4ZWNDYXJnb01ldGFkYXRhKG1hbmlmZXN0UGF0aCwgW10pXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGV4ZWNDYXJnb01ldGFkYXRhKG1hbmlmZXN0UGF0aDogc3RyaW5nLCBleHRyYUFyZ3M6IHN0cmluZ1tdKSB7XG4gIGNvbnN0IGNoaWxkUHJvY2VzcyA9IHNwYXduKFxuICAgICdjYXJnbycsXG4gICAgW1xuICAgICAgJ21ldGFkYXRhJyxcbiAgICAgICctLW1hbmlmZXN0LXBhdGgnLFxuICAgICAgbWFuaWZlc3RQYXRoLFxuICAgICAgJy0tZm9ybWF0LXZlcnNpb24nLFxuICAgICAgJzEnLFxuICAgICAgLi4uZXh0cmFBcmdzLFxuICAgIF0sXG4gICAge1xuICAgICAgc3RkaW86ICdwaXBlJyxcbiAgICB9LFxuICApXG5cbiAgbGV0IHN0ZG91dCA9ICcnXG4gIGxldCBzdGRlcnIgPSAnJ1xuICBsZXQgc3RhdHVzID0gMFxuICBsZXQgZXJyb3I6IEVycm9yIHwgbnVsbCA9IG51bGxcblxuICBjaGlsZFByb2Nlc3Muc3Rkb3V0Lm9uKCdkYXRhJywgKGRhdGEpID0+IHtcbiAgICBzdGRvdXQgKz0gZGF0YVxuICB9KVxuXG4gIGNoaWxkUHJvY2Vzcy5zdGRlcnIub24oJ2RhdGEnLCAoZGF0YSkgPT4ge1xuICAgIHN0ZGVyciArPSBkYXRhXG4gIH0pXG5cbiAgY2hpbGRQcm9jZXNzLm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICBlcnJvciA9IGVyclxuICB9KVxuXG4gIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgY2hpbGRQcm9jZXNzLm9uKCdjbG9zZScsIChjb2RlKSA9PiB7XG4gICAgICBzdGF0dXMgPSBjb2RlID8/IDBcbiAgICAgIHJlc29sdmUoKVxuICAgIH0pXG4gIH0pXG5cbiAgaWYgKGVycm9yKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjYXJnbyBtZXRhZGF0YSBmYWlsZWQgdG8gcnVuJywgeyBjYXVzZTogZXJyb3IgfSlcbiAgfVxuICBpZiAoc3RhdHVzICE9PSAwKSB7XG4gICAgY29uc3Qgc2ltcGxlTWVzc2FnZSA9IGBjYXJnbyBtZXRhZGF0YSBleGl0ZWQgd2l0aCBjb2RlICR7c3RhdHVzfWBcbiAgICB0aHJvdyBuZXcgRXJyb3IoYCR7c2ltcGxlTWVzc2FnZX0gYW5kIGVycm9yIG1lc3NhZ2U6XFxuXFxuJHtzdGRlcnJ9YCwge1xuICAgICAgY2F1c2U6IG5ldyBFcnJvcihzaW1wbGVNZXNzYWdlKSxcbiAgICB9KVxuICB9XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShzdGRvdXQpIGFzIENhcmdvV29ya3NwYWNlTWV0YWRhdGFcbiAgfSBjYXRjaCAoZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHBhcnNlIGNhcmdvIG1ldGFkYXRhIEpTT04nLCB7IGNhdXNlOiBlIH0pXG4gIH1cbn1cbiIsImltcG9ydCB7IHVuZGVybGluZSwgeWVsbG93IH0gZnJvbSAnY29sb3JldHRlJ1xuaW1wb3J0IHsgbWVyZ2UsIG9taXQgfSBmcm9tICdlcy10b29sa2l0J1xuXG5pbXBvcnQgeyBmaWxlRXhpc3RzLCByZWFkRmlsZUFzeW5jIH0gZnJvbSAnLi9taXNjLmpzJ1xuaW1wb3J0IHsgREVGQVVMVF9UQVJHRVRTLCBwYXJzZVRyaXBsZSwgdHlwZSBUYXJnZXQgfSBmcm9tICcuL3RhcmdldC5qcydcblxuZXhwb3J0IHR5cGUgVmFsdWVPZkNvbnN0QXJyYXk8VD4gPSBUW0V4Y2x1ZGU8a2V5b2YgVCwga2V5b2YgQXJyYXk8YW55Pj5dXG5cbmV4cG9ydCBjb25zdCBTdXBwb3J0ZWRQYWNrYWdlTWFuYWdlcnMgPSBbJ3lhcm4nLCAncG5wbSddIGFzIGNvbnN0XG5leHBvcnQgY29uc3QgU3VwcG9ydGVkVGVzdEZyYW1ld29ya3MgPSBbJ2F2YSddIGFzIGNvbnN0XG5cbmV4cG9ydCB0eXBlIFN1cHBvcnRlZFBhY2thZ2VNYW5hZ2VyID0gVmFsdWVPZkNvbnN0QXJyYXk8XG4gIHR5cGVvZiBTdXBwb3J0ZWRQYWNrYWdlTWFuYWdlcnNcbj5cbmV4cG9ydCB0eXBlIFN1cHBvcnRlZFRlc3RGcmFtZXdvcmsgPSBWYWx1ZU9mQ29uc3RBcnJheTxcbiAgdHlwZW9mIFN1cHBvcnRlZFRlc3RGcmFtZXdvcmtzXG4+XG5cbmV4cG9ydCBpbnRlcmZhY2UgVXNlck5hcGlDb25maWcge1xuICAvKipcbiAgICogTmFtZSBvZiB0aGUgYmluYXJ5IHRvIGJlIGdlbmVyYXRlZCwgZGVmYXVsdCB0byBgaW5kZXhgXG4gICAqL1xuICBiaW5hcnlOYW1lPzogc3RyaW5nXG4gIC8qKlxuICAgKiBOYW1lIG9mIHRoZSBucG0gcGFja2FnZSwgZGVmYXVsdCB0byB0aGUgbmFtZSBvZiByb290IHBhY2thZ2UuanNvbiBuYW1lXG4gICAqXG4gICAqIEFsd2F5cyBnaXZlbiBgQHNjb3BlL3BrZ2AgYW5kIGFyY2ggc3VmZml4IHdpbGwgYmUgYXBwZW5kZWQgbGlrZSBgQHNjb3BlL3BrZy1saW51eC1nbnUteDY0YFxuICAgKi9cbiAgcGFja2FnZU5hbWU/OiBzdHJpbmdcbiAgLyoqXG4gICAqIEFsbCB0YXJnZXRzIHRoZSBjcmF0ZSB3aWxsIGJlIGNvbXBpbGVkIGZvclxuICAgKi9cbiAgdGFyZ2V0cz86IHN0cmluZ1tdXG5cbiAgLyoqXG4gICAqIFRoZSBucG0gY2xpZW50IHByb2plY3QgdXNlcy5cbiAgICovXG4gIG5wbUNsaWVudD86IHN0cmluZ1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIGdlbmVyYXRlIGNvbnN0IGVudW0gZm9yIHR5cGVzY3JpcHQgYmluZGluZ3NcbiAgICovXG4gIGNvbnN0RW51bT86IGJvb2xlYW5cblxuICAvKipcbiAgICogRW1pdCBgI1tuYXBpKHN0cmluZ19lbnVtKV1gIGVudW1zIGFzIHJ1bnRpbWUgZW51bXMgKGBleHBvcnQgZGVjbGFyZSBlbnVtYCkgdW5kZXIgYC0tbm8tY29uc3QtZW51bWAuIERlZmF1bHQ6IHR5cGUtb25seSB1bmlvbi5cbiAgICovXG4gIHJ1bnRpbWVTdHJpbmdFbnVtPzogYm9vbGVhblxuXG4gIC8qKlxuICAgKiBkdHMgaGVhZGVyIHByZXBlbmQgdG8gdGhlIGdlbmVyYXRlZCBkdHMgZmlsZVxuICAgKi9cbiAgZHRzSGVhZGVyPzogc3RyaW5nXG5cbiAgLyoqXG4gICAqIGR0cyBoZWFkZXIgZmlsZSBwYXRoIHRvIGJlIHByZXBlbmRlZCB0byB0aGUgZ2VuZXJhdGVkIGR0cyBmaWxlXG4gICAqIGlmIGJvdGggZHRzSGVhZGVyIGFuZCBkdHNIZWFkZXJGaWxlIGFyZSBwcm92aWRlZCwgZHRzSGVhZGVyRmlsZSB3aWxsIGJlIHVzZWRcbiAgICovXG4gIGR0c0hlYWRlckZpbGU/OiBzdHJpbmdcblxuICAvKipcbiAgICogd2FzbSBjb21waWxhdGlvbiBvcHRpb25zXG4gICAqL1xuICB3YXNtPzoge1xuICAgIC8qKlxuICAgICAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViQXNzZW1ibHkvSmF2YVNjcmlwdF9pbnRlcmZhY2UvTWVtb3J5XG4gICAgICogQGRlZmF1bHQgNDAwMCBwYWdlcyAoMjU2TWlCKVxuICAgICAqL1xuICAgIGluaXRpYWxNZW1vcnk/OiBudW1iZXJcbiAgICAvKipcbiAgICAgKiBAZGVmYXVsdCA2NTUzNiBwYWdlcyAoNEdpQilcbiAgICAgKi9cbiAgICBtYXhpbXVtTWVtb3J5PzogbnVtYmVyXG5cbiAgICAvKipcbiAgICAgKiBCcm93c2VyIHdhc20gYmluZGluZyBjb25maWd1cmF0aW9uXG4gICAgICovXG4gICAgYnJvd3Nlcjoge1xuICAgICAgLyoqXG4gICAgICAgKiBXaGV0aGVyIHRvIHVzZSBmcyBtb2R1bGUgaW4gYnJvd3NlclxuICAgICAgICovXG4gICAgICBmcz86IGJvb2xlYW5cbiAgICAgIC8qKlxuICAgICAgICogV2hldGhlciB0byBpbml0aWFsaXplIHdhc20gYXN5bmNocm9ub3VzbHlcbiAgICAgICAqL1xuICAgICAgYXN5bmNJbml0PzogYm9vbGVhblxuICAgICAgLyoqXG4gICAgICAgKiBXaGV0aGVyIHRvIGluamVjdCBgYnVmZmVyYCB0byBlbW5hcGkgY29udGV4dFxuICAgICAgICovXG4gICAgICBidWZmZXI/OiBib29sZWFuXG4gICAgICAvKipcbiAgICAgICAqIFdoZXRoZXIgdG8gZW1pdCBjdXN0b20gZXZlbnRzIGZvciBlcnJvcnMgaW4gd29ya2VyXG4gICAgICAgKi9cbiAgICAgIGVycm9yRXZlbnQ/OiBib29sZWFuXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIGJpbmFyeU5hbWUgaW5zdGVhZFxuICAgKi9cbiAgbmFtZT86IHN0cmluZ1xuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgdXNlIHBhY2thZ2VOYW1lIGluc3RlYWRcbiAgICovXG4gIHBhY2thZ2U/OiB7XG4gICAgbmFtZT86IHN0cmluZ1xuICB9XG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZCB1c2UgdGFyZ2V0cyBpbnN0ZWFkXG4gICAqL1xuICB0cmlwbGVzPzoge1xuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgZW5hYmxlIGRlZmF1bHQgdGFyZ2V0c1xuICAgICAqL1xuICAgIGRlZmF1bHRzOiBib29sZWFuXG4gICAgLyoqXG4gICAgICogQWRkaXRpb25hbCB0YXJnZXRzIHRvIGJlIGNvbXBpbGVkIGZvclxuICAgICAqL1xuICAgIGFkZGl0aW9uYWw/OiBzdHJpbmdbXVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tbW9uUGFja2FnZUpzb25GaWVsZHMge1xuICBuYW1lOiBzdHJpbmdcbiAgdmVyc2lvbjogc3RyaW5nXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nXG4gIGtleXdvcmRzPzogc3RyaW5nW11cbiAgYXV0aG9yPzogc3RyaW5nXG4gIGF1dGhvcnM/OiBzdHJpbmdbXVxuICBsaWNlbnNlPzogc3RyaW5nXG4gIGNwdT86IHN0cmluZ1tdXG4gIG9zPzogc3RyaW5nW11cbiAgbGliYz86IHN0cmluZ1tdXG4gIGZpbGVzPzogc3RyaW5nW11cbiAgcmVwb3NpdG9yeT86IGFueVxuICBob21lcGFnZT86IGFueVxuICBlbmdpbmVzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPlxuICBwdWJsaXNoQ29uZmlnPzogYW55XG4gIGJ1Z3M/OiBhbnlcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVzZS1iZWZvcmUtZGVmaW5lXG4gIG5hcGk/OiBVc2VyTmFwaUNvbmZpZ1xuICB0eXBlPzogJ21vZHVsZScgfCAnY29tbW9uanMnXG4gIHNjcmlwdHM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG5cbiAgLy8gbW9kdWxlc1xuICBtYWluPzogc3RyaW5nXG4gIG1vZHVsZT86IHN0cmluZ1xuICB0eXBlcz86IHN0cmluZ1xuICBicm93c2VyPzogc3RyaW5nXG4gIGV4cG9ydHM/OiBhbnlcblxuICBkZXBlbmRlbmNpZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG4gIGRldkRlcGVuZGVuY2llcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz5cblxuICBhdmE/OiB7XG4gICAgdGltZW91dD86IHN0cmluZ1xuICB9XG59XG5cbmV4cG9ydCB0eXBlIE5hcGlDb25maWcgPSBSZXF1aXJlZDxcbiAgUGljazxVc2VyTmFwaUNvbmZpZywgJ2JpbmFyeU5hbWUnIHwgJ3BhY2thZ2VOYW1lJyB8ICducG1DbGllbnQnPlxuPiAmXG4gIFBpY2s8XG4gICAgVXNlck5hcGlDb25maWcsXG4gICAgJ3dhc20nIHwgJ2R0c0hlYWRlcicgfCAnZHRzSGVhZGVyRmlsZScgfCAnY29uc3RFbnVtJyB8ICdydW50aW1lU3RyaW5nRW51bSdcbiAgPiAmIHtcbiAgICB0YXJnZXRzOiBUYXJnZXRbXVxuICAgIHBhY2thZ2VKc29uOiBDb21tb25QYWNrYWdlSnNvbkZpZWxkc1xuICB9XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFkTmFwaUNvbmZpZyhcbiAgcGF0aDogc3RyaW5nLFxuICBjb25maWdQYXRoPzogc3RyaW5nLFxuKTogUHJvbWlzZTxOYXBpQ29uZmlnPiB7XG4gIGlmIChjb25maWdQYXRoICYmICEoYXdhaXQgZmlsZUV4aXN0cyhjb25maWdQYXRoKSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYE5BUEktUlMgY29uZmlnIG5vdCBmb3VuZCBhdCAke2NvbmZpZ1BhdGh9YClcbiAgfVxuICBpZiAoIShhd2FpdCBmaWxlRXhpc3RzKHBhdGgpKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgcGFja2FnZS5qc29uIG5vdCBmb3VuZCBhdCAke3BhdGh9YClcbiAgfVxuICAvLyBNYXkgc3VwcG9ydCBtdWx0aXBsZSBjb25maWcgc291cmNlcyBsYXRlciBvbi5cbiAgY29uc3QgY29udGVudCA9IGF3YWl0IHJlYWRGaWxlQXN5bmMocGF0aCwgJ3V0ZjgnKVxuICBsZXQgcGtnSnNvblxuICB0cnkge1xuICAgIHBrZ0pzb24gPSBKU09OLnBhcnNlKGNvbnRlbnQpIGFzIENvbW1vblBhY2thZ2VKc29uRmllbGRzXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBwYXJzZSBwYWNrYWdlLmpzb24gYXQgJHtwYXRofWAsIHtcbiAgICAgIGNhdXNlOiBlLFxuICAgIH0pXG4gIH1cblxuICBsZXQgc2VwYXJhdGVkQ29uZmlnOiBVc2VyTmFwaUNvbmZpZyB8IHVuZGVmaW5lZFxuICBpZiAoY29uZmlnUGF0aCkge1xuICAgIGNvbnN0IGNvbmZpZ0NvbnRlbnQgPSBhd2FpdCByZWFkRmlsZUFzeW5jKGNvbmZpZ1BhdGgsICd1dGY4JylcbiAgICB0cnkge1xuICAgICAgc2VwYXJhdGVkQ29uZmlnID0gSlNPTi5wYXJzZShjb25maWdDb250ZW50KSBhcyBVc2VyTmFwaUNvbmZpZ1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIE5BUEktUlMgY29uZmlnIGF0ICR7Y29uZmlnUGF0aH1gLCB7XG4gICAgICAgIGNhdXNlOiBlLFxuICAgICAgfSlcbiAgICB9XG4gIH1cblxuICBjb25zdCB1c2VyTmFwaUNvbmZpZyA9IHBrZ0pzb24ubmFwaSA/PyB7fVxuICBpZiAocGtnSnNvbi5uYXBpICYmIHNlcGFyYXRlZENvbmZpZykge1xuICAgIGNvbnN0IHBrZ0pzb25QYXRoID0gdW5kZXJsaW5lKHBhdGgpXG4gICAgY29uc3QgY29uZmlnUGF0aFVuZGVybGluZSA9IHVuZGVybGluZShjb25maWdQYXRoISlcbiAgICBjb25zb2xlLndhcm4oXG4gICAgICB5ZWxsb3coXG4gICAgICAgIGBCb3RoIG5hcGkgZmllbGQgaW4gJHtwa2dKc29uUGF0aH0gYW5kIFtOQVBJLVJTIGNvbmZpZ10oJHtjb25maWdQYXRoVW5kZXJsaW5lfSkgZmlsZSBhcmUgZm91bmQsIHRoZSBOQVBJLVJTIGNvbmZpZyBmaWxlIHdpbGwgYmUgdXNlZC5gLFxuICAgICAgKSxcbiAgICApXG4gIH1cbiAgaWYgKHNlcGFyYXRlZENvbmZpZykge1xuICAgIE9iamVjdC5hc3NpZ24odXNlck5hcGlDb25maWcsIHNlcGFyYXRlZENvbmZpZylcbiAgfVxuICBjb25zdCBuYXBpQ29uZmlnOiBOYXBpQ29uZmlnID0gbWVyZ2UoXG4gICAge1xuICAgICAgYmluYXJ5TmFtZTogJ2luZGV4JyxcbiAgICAgIHBhY2thZ2VOYW1lOiBwa2dKc29uLm5hbWUsXG4gICAgICB0YXJnZXRzOiBbXSxcbiAgICAgIHBhY2thZ2VKc29uOiBwa2dKc29uLFxuICAgICAgbnBtQ2xpZW50OiAnbnBtJyxcbiAgICB9LFxuICAgIG9taXQodXNlck5hcGlDb25maWcsIFsndGFyZ2V0cyddKSxcbiAgKVxuXG4gIGxldCB0YXJnZXRzOiBzdHJpbmdbXSA9IHVzZXJOYXBpQ29uZmlnLnRhcmdldHMgPz8gW11cblxuICAvLyBjb21wYXRpYmxlIHdpdGggb2xkIGNvbmZpZ1xuICBpZiAodXNlck5hcGlDb25maWc/Lm5hbWUpIHtcbiAgICBjb25zb2xlLndhcm4oXG4gICAgICB5ZWxsb3coXG4gICAgICAgIGBbREVQUkVDQVRFRF0gbmFwaS5uYW1lIGlzIGRlcHJlY2F0ZWQsIHVzZSBuYXBpLmJpbmFyeU5hbWUgaW5zdGVhZC5gLFxuICAgICAgKSxcbiAgICApXG4gICAgbmFwaUNvbmZpZy5iaW5hcnlOYW1lID0gdXNlck5hcGlDb25maWcubmFtZVxuICB9XG5cbiAgaWYgKCF0YXJnZXRzLmxlbmd0aCkge1xuICAgIGxldCBkZXByZWNhdGVkV2FybmVkID0gZmFsc2VcbiAgICBjb25zdCB3YXJuaW5nID0geWVsbG93KFxuICAgICAgYFtERVBSRUNBVEVEXSBuYXBpLnRyaXBsZXMgaXMgZGVwcmVjYXRlZCwgdXNlIG5hcGkudGFyZ2V0cyBpbnN0ZWFkLmAsXG4gICAgKVxuICAgIGlmICh1c2VyTmFwaUNvbmZpZy50cmlwbGVzPy5kZWZhdWx0cykge1xuICAgICAgZGVwcmVjYXRlZFdhcm5lZCA9IHRydWVcbiAgICAgIGNvbnNvbGUud2Fybih3YXJuaW5nKVxuICAgICAgdGFyZ2V0cyA9IHRhcmdldHMuY29uY2F0KERFRkFVTFRfVEFSR0VUUylcbiAgICB9XG5cbiAgICBpZiAodXNlck5hcGlDb25maWcudHJpcGxlcz8uYWRkaXRpb25hbD8ubGVuZ3RoKSB7XG4gICAgICB0YXJnZXRzID0gdGFyZ2V0cy5jb25jYXQodXNlck5hcGlDb25maWcudHJpcGxlcy5hZGRpdGlvbmFsKVxuICAgICAgaWYgKCFkZXByZWNhdGVkV2FybmVkKSB7XG4gICAgICAgIGNvbnNvbGUud2Fybih3YXJuaW5nKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIGZpbmQgZHVwbGljYXRlIHRhcmdldHNcbiAgY29uc3QgdW5pcXVlVGFyZ2V0cyA9IG5ldyBTZXQodGFyZ2V0cylcbiAgaWYgKHVuaXF1ZVRhcmdldHMuc2l6ZSAhPT0gdGFyZ2V0cy5sZW5ndGgpIHtcbiAgICBjb25zdCBkdXBsaWNhdGVUYXJnZXQgPSB0YXJnZXRzLmZpbmQoXG4gICAgICAodGFyZ2V0LCBpbmRleCkgPT4gdGFyZ2V0cy5pbmRleE9mKHRhcmdldCkgIT09IGluZGV4LFxuICAgIClcbiAgICB0aHJvdyBuZXcgRXJyb3IoYER1cGxpY2F0ZSB0YXJnZXRzIGFyZSBub3QgYWxsb3dlZDogJHtkdXBsaWNhdGVUYXJnZXR9YClcbiAgfVxuXG4gIG5hcGlDb25maWcudGFyZ2V0cyA9IHRhcmdldHMubWFwKHBhcnNlVHJpcGxlKVxuXG4gIHJldHVybiBuYXBpQ29uZmlnXG59XG4iLCJpbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ25vZGU6Y2hpbGRfcHJvY2VzcydcblxuaW1wb3J0IHsgZGVidWcgfSBmcm9tICcuL2xvZy5qcydcblxuZXhwb3J0IGZ1bmN0aW9uIHRyeUluc3RhbGxDYXJnb0JpbmFyeShuYW1lOiBzdHJpbmcsIGJpbjogc3RyaW5nKSB7XG4gIGlmIChkZXRlY3RDYXJnb0JpbmFyeShiaW4pKSB7XG4gICAgZGVidWcoJ0NhcmdvIGJpbmFyeSBhbHJlYWR5IGluc3RhbGxlZDogJXMnLCBuYW1lKVxuICAgIHJldHVyblxuICB9XG5cbiAgdHJ5IHtcbiAgICBkZWJ1ZygnSW5zdGFsbGluZyBjYXJnbyBiaW5hcnk6ICVzJywgbmFtZSlcbiAgICBleGVjU3luYyhgY2FyZ28gaW5zdGFsbCAke25hbWV9YCwge1xuICAgICAgc3RkaW86ICdpbmhlcml0JyxcbiAgICB9KVxuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gaW5zdGFsbCBjYXJnbyBiaW5hcnk6ICR7bmFtZX1gLCB7XG4gICAgICBjYXVzZTogZSxcbiAgICB9KVxuICB9XG59XG5cbmZ1bmN0aW9uIGRldGVjdENhcmdvQmluYXJ5KGJpbjogc3RyaW5nKSB7XG4gIGRlYnVnKCdEZXRlY3RpbmcgY2FyZ28gYmluYXJ5OiAlcycsIGJpbilcbiAgdHJ5IHtcbiAgICBleGVjU3luYyhgY2FyZ28gaGVscCAke2Jpbn1gLCB7XG4gICAgICBzdGRpbzogJ2lnbm9yZScsXG4gICAgfSlcbiAgICBkZWJ1ZygnQ2FyZ28gYmluYXJ5IGRldGVjdGVkOiAlcycsIGJpbilcbiAgICByZXR1cm4gdHJ1ZVxuICB9IGNhdGNoIHtcbiAgICBkZWJ1ZygnQ2FyZ28gYmluYXJ5IG5vdCBkZXRlY3RlZDogJXMnLCBiaW4pXG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cbiIsImltcG9ydCB7IHNvcnRCeSB9IGZyb20gJ2VzLXRvb2xraXQnXG5cbmltcG9ydCB7IHJlYWRGaWxlQXN5bmMgfSBmcm9tICcuL21pc2MuanMnXG5cbmNvbnN0IFRPUF9MRVZFTF9OQU1FU1BBQ0UgPSAnX19UT1BfTEVWRUxfTU9EVUxFX18nXG5leHBvcnQgY29uc3QgREVGQVVMVF9UWVBFX0RFRl9IRUFERVIgPSBgLyogYXV0by1nZW5lcmF0ZWQgYnkgTkFQSS1SUyAqL1xuLyogZXNsaW50LWRpc2FibGUgKi9cbmBcblxuZW51bSBUeXBlRGVmS2luZCB7XG4gIENvbnN0ID0gJ2NvbnN0JyxcbiAgRW51bSA9ICdlbnVtJyxcbiAgU3RyaW5nRW51bSA9ICdzdHJpbmdfZW51bScsXG4gIEludGVyZmFjZSA9ICdpbnRlcmZhY2UnLFxuICBUeXBlID0gJ3R5cGUnLFxuICBGbiA9ICdmbicsXG4gIFN0cnVjdCA9ICdzdHJ1Y3QnLFxuICBFeHRlbmRzID0gJ2V4dGVuZHMnLFxuICBJbXBsID0gJ2ltcGwnLFxufVxuXG5pbnRlcmZhY2UgVHlwZURlZkxpbmUge1xuICBraW5kOiBUeXBlRGVmS2luZFxuICBuYW1lOiBzdHJpbmdcbiAgb3JpZ2luYWxfbmFtZT86IHN0cmluZ1xuICBkZWY6IHN0cmluZ1xuICBleHRlbmRzPzogc3RyaW5nXG4gIGpzX2RvYz86IHN0cmluZ1xuICBqc19tb2Q/OiBzdHJpbmdcbn1cblxuLyoqXG4gKiBSZW5kZXIgYSBzaW5nbGUgaW50ZXJtZWRpYXRlIHR5cGUtZGVmIGxpbmUgYXMgdGhlIFR5cGVTY3JpcHQgc291cmNlIGl0XG4gKiBzaG91bGQgcHJvZHVjZSBpbiBgaW5kZXguZC50c2AuXG4gKlxuICogQHBhcmFtIGxpbmUgLSBUaGUgaW50ZXJtZWRpYXRlIHR5cGUtZGVmIGVudHJ5IHRvIHJlbmRlci5cbiAqIEBwYXJhbSBjb25zdEVudW0gLSBXaGVuIHRydWUsIGVtaXQgbnVtZXJpYyBhbmQgc3RyaW5nIGAjW25hcGldYCBlbnVtcyBhc1xuICogICBgY29uc3QgZW51bWAuIFdoZW4gZmFsc2UgKGAtLW5vLWNvbnN0LWVudW1gKSwgbnVtZXJpYyBlbnVtcyBiZWNvbWVcbiAqICAgcmVndWxhciBydW50aW1lIGVudW1zIGFuZCBzdHJpbmcgZW51bXMgZmFsbCBiYWNrIHRvIGEgdHlwZS1vbmx5IHVuaW9uXG4gKiAgIHVubGVzcyBgcnVudGltZVN0cmluZ0VudW1gIGlzIGFsc28gdHJ1ZS5cbiAqIEBwYXJhbSBydW50aW1lU3RyaW5nRW51bSAtIFdoZW4gdHJ1ZSB1bmRlciBgLS1uby1jb25zdC1lbnVtYCwgZW1pdFxuICogICBgI1tuYXBpKHN0cmluZ19lbnVtKV1gIGFzIGEgcnVudGltZSBlbnVtIChgZXhwb3J0IGRlY2xhcmUgZW51bWApXG4gKiAgIGluc3RlYWQgb2YgYSB0eXBlLW9ubHkgdW5pb24uIE5vLW9wIHdoZW4gYGNvbnN0RW51bWAgaXMgdHJ1ZS5cbiAqIEBwYXJhbSBpZGVudCAtIEluZGVudGF0aW9uIGxldmVsIGFwcGxpZWQgdG8gdGhlIHJlbmRlcmVkIG91dHB1dC5cbiAqIEBwYXJhbSBhbWJpZW50IC0gV2hlbiB0cnVlLCBlbWl0IGRlY2xhcmF0aW9ucyBpbiB0aGUgYW1iaWVudCBmb3JtIHVzZWRcbiAqICAgaW5zaWRlIGBkZWNsYXJlIG5hbWVzcGFjZWAgYmxvY2tzIChlLmcuIGRyb3AgdGhlIGBkZWNsYXJlYCBrZXl3b3JkKS5cbiAqL1xuZnVuY3Rpb24gcHJldHR5UHJpbnQoXG4gIGxpbmU6IFR5cGVEZWZMaW5lLFxuICBjb25zdEVudW06IGJvb2xlYW4sXG4gIHJ1bnRpbWVTdHJpbmdFbnVtOiBib29sZWFuLFxuICBpZGVudDogbnVtYmVyLFxuICBhbWJpZW50ID0gZmFsc2UsXG4pOiBzdHJpbmcge1xuICBsZXQgcyA9IGxpbmUuanNfZG9jID8/ICcnXG4gIHN3aXRjaCAobGluZS5raW5kKSB7XG4gICAgY2FzZSBUeXBlRGVmS2luZC5JbnRlcmZhY2U6XG4gICAgICBzICs9IGBleHBvcnQgaW50ZXJmYWNlICR7bGluZS5uYW1lfSB7XFxuJHtsaW5lLmRlZn1cXG59YFxuICAgICAgYnJlYWtcblxuICAgIGNhc2UgVHlwZURlZktpbmQuVHlwZTpcbiAgICAgIHMgKz0gYGV4cG9ydCB0eXBlICR7bGluZS5uYW1lfSA9IFxcbiR7bGluZS5kZWZ9YFxuICAgICAgYnJlYWtcblxuICAgIGNhc2UgVHlwZURlZktpbmQuRW51bToge1xuICAgICAgY29uc3QgZW51bU5hbWUgPSBjb25zdEVudW0gPyAnY29uc3QgZW51bScgOiAnZW51bSdcbiAgICAgIHMgKz0gYCR7ZXhwb3J0RGVjbGFyZShhbWJpZW50KX0gJHtlbnVtTmFtZX0gJHtsaW5lLm5hbWV9IHtcXG4ke2xpbmUuZGVmfVxcbn1gXG4gICAgICBicmVha1xuICAgIH1cblxuICAgIGNhc2UgVHlwZURlZktpbmQuU3RyaW5nRW51bToge1xuICAgICAgaWYgKGNvbnN0RW51bSkge1xuICAgICAgICBzICs9IGAke2V4cG9ydERlY2xhcmUoYW1iaWVudCl9IGNvbnN0IGVudW0gJHtsaW5lLm5hbWV9IHtcXG4ke2xpbmUuZGVmfVxcbn1gXG4gICAgICB9IGVsc2UgaWYgKHJ1bnRpbWVTdHJpbmdFbnVtKSB7XG4gICAgICAgIHMgKz0gYCR7ZXhwb3J0RGVjbGFyZShhbWJpZW50KX0gZW51bSAke2xpbmUubmFtZX0ge1xcbiR7bGluZS5kZWZ9XFxufWBcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMgKz0gYGV4cG9ydCB0eXBlICR7bGluZS5uYW1lfSA9ICR7bGluZS5kZWYucmVwbGFjZUFsbCgvLio9L2csICcnKS5yZXBsYWNlQWxsKCcsJywgJ3wnKX07YFxuICAgICAgfVxuICAgICAgYnJlYWtcbiAgICB9XG5cbiAgICBjYXNlIFR5cGVEZWZLaW5kLlN0cnVjdDpcbiAgICAgIGNvbnN0IGV4dGVuZHNEZWYgPSBsaW5lLmV4dGVuZHMgPyBgIGV4dGVuZHMgJHtsaW5lLmV4dGVuZHN9YCA6ICcnXG4gICAgICBpZiAobGluZS5leHRlbmRzKSB7XG4gICAgICAgIC8vIEV4dHJhY3QgZ2VuZXJpYyBwYXJhbXMgZnJvbSBleHRlbmRzIHR5cGUgbGlrZSBJdGVyYXRvcjxULCBUUmVzdWx0LCBUTmV4dD5cbiAgICAgICAgY29uc3QgZ2VuZXJpY01hdGNoID0gbGluZS5leHRlbmRzLm1hdGNoKC9JdGVyYXRvcjwoLispPiQvKVxuICAgICAgICBpZiAoZ2VuZXJpY01hdGNoKSB7XG4gICAgICAgICAgY29uc3QgW1QsIFRSZXN1bHQsIFROZXh0XSA9IGdlbmVyaWNNYXRjaFsxXVxuICAgICAgICAgICAgLnNwbGl0KCcsJylcbiAgICAgICAgICAgIC5tYXAoKHApID0+IHAudHJpbSgpKVxuICAgICAgICAgIGxpbmUuZGVmID1cbiAgICAgICAgICAgIGxpbmUuZGVmICtcbiAgICAgICAgICAgIGBcXG5uZXh0KHZhbHVlPzogJHtUTmV4dH0pOiBJdGVyYXRvclJlc3VsdDwke1R9LCAke1RSZXN1bHR9PmBcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcyArPSBgJHtleHBvcnREZWNsYXJlKGFtYmllbnQpfSBjbGFzcyAke2xpbmUubmFtZX0ke2V4dGVuZHNEZWZ9IHtcXG4ke2xpbmUuZGVmfVxcbn1gXG4gICAgICBpZiAobGluZS5vcmlnaW5hbF9uYW1lICYmIGxpbmUub3JpZ2luYWxfbmFtZSAhPT0gbGluZS5uYW1lKSB7XG4gICAgICAgIHMgKz0gYFxcbmV4cG9ydCB0eXBlICR7bGluZS5vcmlnaW5hbF9uYW1lfSA9ICR7bGluZS5uYW1lfWBcbiAgICAgIH1cbiAgICAgIGJyZWFrXG5cbiAgICBjYXNlIFR5cGVEZWZLaW5kLkZuOlxuICAgICAgcyArPSBgJHtleHBvcnREZWNsYXJlKGFtYmllbnQpfSAke2xpbmUuZGVmfWBcbiAgICAgIGJyZWFrXG5cbiAgICBkZWZhdWx0OlxuICAgICAgcyArPSBsaW5lLmRlZlxuICB9XG5cbiAgcmV0dXJuIGNvcnJlY3RTdHJpbmdJZGVudChzLCBpZGVudClcbn1cblxuZnVuY3Rpb24gZXhwb3J0RGVjbGFyZShhbWJpZW50OiBib29sZWFuKTogc3RyaW5nIHtcbiAgaWYgKGFtYmllbnQpIHtcbiAgICByZXR1cm4gJ2V4cG9ydCdcbiAgfVxuXG4gIHJldHVybiAnZXhwb3J0IGRlY2xhcmUnXG59XG5cbi8qKlxuICogUmVhZCB0aGUgbmFwaS1kZXJpdmUtZW1pdHRlZCBpbnRlcm1lZGlhdGUgdHlwZS1kZWYgZmlsZSBhbmQgcmVuZGVyIGl0c1xuICogZW50cmllcyBpbnRvIHRoZSBgaW5kZXguZC50c2Agc291cmNlIHN0cmluZyBwbHVzIHRoZSBsaXN0IG9mIG5hbWVzIHRvXG4gKiByZS1leHBvcnQgZnJvbSBgaW5kZXguanNgLlxuICpcbiAqIEBwYXJhbSBpbnRlcm1lZGlhdGVUeXBlRmlsZSAtIFBhdGggdG8gdGhlIEpTT05MIHR5cGUtZGVmIGZpbGUgcHJvZHVjZWRcbiAqICAgYnkgbmFwaS1kZXJpdmUgKG9uZSBlbnRyeSBwZXIgYCNbbmFwaV1gIGl0ZW0pLlxuICogQHBhcmFtIGNvbnN0RW51bSAtIFNlZSB7QGxpbmsgcHJldHR5UHJpbnR9LlxuICogQHBhcmFtIHJ1bnRpbWVTdHJpbmdFbnVtIC0gU2VlIHtAbGluayBwcmV0dHlQcmludH0uIERlZmF1bHRzIHRvIGBmYWxzZWAuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcm9jZXNzVHlwZURlZihcbiAgaW50ZXJtZWRpYXRlVHlwZUZpbGU6IHN0cmluZyxcbiAgY29uc3RFbnVtOiBib29sZWFuLFxuICBydW50aW1lU3RyaW5nRW51bTogYm9vbGVhbiA9IGZhbHNlLFxuKSB7XG4gIGNvbnN0IGV4cG9ydHM6IHN0cmluZ1tdID0gW11cbiAgY29uc3QgZGVmcyA9IGF3YWl0IHJlYWRJbnRlcm1lZGlhdGVUeXBlRmlsZShpbnRlcm1lZGlhdGVUeXBlRmlsZSlcbiAgY29uc3QgZ3JvdXBlZERlZnMgPSBwcmVwcm9jZXNzVHlwZURlZihkZWZzKVxuXG4gIGNvbnN0IGR0cyA9XG4gICAgc29ydEJ5KEFycmF5LmZyb20oZ3JvdXBlZERlZnMpLCBbKFtuYW1lc3BhY2VdKSA9PiBuYW1lc3BhY2VdKVxuICAgICAgLm1hcCgoW25hbWVzcGFjZSwgZGVmc10pID0+IHtcbiAgICAgICAgaWYgKG5hbWVzcGFjZSA9PT0gVE9QX0xFVkVMX05BTUVTUEFDRSkge1xuICAgICAgICAgIHJldHVybiBkZWZzXG4gICAgICAgICAgICAubWFwKChkZWYpID0+IHtcbiAgICAgICAgICAgICAgc3dpdGNoIChkZWYua2luZCkge1xuICAgICAgICAgICAgICAgIGNhc2UgVHlwZURlZktpbmQuQ29uc3Q6XG4gICAgICAgICAgICAgICAgY2FzZSBUeXBlRGVmS2luZC5FbnVtOlxuICAgICAgICAgICAgICAgIGNhc2UgVHlwZURlZktpbmQuU3RyaW5nRW51bTpcbiAgICAgICAgICAgICAgICBjYXNlIFR5cGVEZWZLaW5kLkZuOlxuICAgICAgICAgICAgICAgIGNhc2UgVHlwZURlZktpbmQuU3RydWN0OiB7XG4gICAgICAgICAgICAgICAgICBleHBvcnRzLnB1c2goZGVmLm5hbWUpXG4gICAgICAgICAgICAgICAgICBpZiAoZGVmLm9yaWdpbmFsX25hbWUgJiYgZGVmLm9yaWdpbmFsX25hbWUgIT09IGRlZi5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4cG9ydHMucHVzaChkZWYub3JpZ2luYWxfbmFtZSlcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBwcmV0dHlQcmludChkZWYsIGNvbnN0RW51bSwgcnVudGltZVN0cmluZ0VudW0sIDApXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmpvaW4oJ1xcblxcbicpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZXhwb3J0cy5wdXNoKG5hbWVzcGFjZSlcbiAgICAgICAgICBsZXQgZGVjbGFyYXRpb24gPSAnJ1xuICAgICAgICAgIGRlY2xhcmF0aW9uICs9IGBleHBvcnQgZGVjbGFyZSBuYW1lc3BhY2UgJHtuYW1lc3BhY2V9IHtcXG5gXG4gICAgICAgICAgZm9yIChjb25zdCBkZWYgb2YgZGVmcykge1xuICAgICAgICAgICAgZGVjbGFyYXRpb24gKz1cbiAgICAgICAgICAgICAgcHJldHR5UHJpbnQoZGVmLCBjb25zdEVudW0sIHJ1bnRpbWVTdHJpbmdFbnVtLCAyLCB0cnVlKSArICdcXG4nXG4gICAgICAgICAgfVxuICAgICAgICAgIGRlY2xhcmF0aW9uICs9ICd9J1xuICAgICAgICAgIHJldHVybiBkZWNsYXJhdGlvblxuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLmpvaW4oJ1xcblxcbicpICsgJ1xcbidcblxuICByZXR1cm4ge1xuICAgIGR0cyxcbiAgICBleHBvcnRzLFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlYWRJbnRlcm1lZGlhdGVUeXBlRmlsZShmaWxlOiBzdHJpbmcpIHtcbiAgY29uc3QgY29udGVudCA9IGF3YWl0IHJlYWRGaWxlQXN5bmMoZmlsZSwgJ3V0ZjgnKVxuXG4gIGNvbnN0IGRlZnMgPSBjb250ZW50XG4gICAgLnNwbGl0KCdcXG4nKVxuICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAubWFwKChsaW5lKSA9PiB7XG4gICAgICBsaW5lID0gbGluZS50cmltKClcbiAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UobGluZSkgYXMgVHlwZURlZkxpbmVcbiAgICAgIC8vIENvbnZlcnQgZXNjYXBlZCBuZXdsaW5lcyBiYWNrIHRvIGFjdHVhbCBuZXdsaW5lcyBpbiBqc19kb2MgZmllbGRzXG4gICAgICBpZiAocGFyc2VkLmpzX2RvYykge1xuICAgICAgICBwYXJzZWQuanNfZG9jID0gcGFyc2VkLmpzX2RvYy5yZXBsYWNlKC9cXFxcbi9nLCAnXFxuJylcbiAgICAgIH1cbiAgICAgIC8vIENvbnZlcnQgZXNjYXBlZCBuZXdsaW5lcyB0byBhY3R1YWwgbmV3bGluZXMgaW4gZGVmIGZpZWxkcyBmb3Igc3RydWN0L2NsYXNzL2ludGVyZmFjZS90eXBlIHR5cGVzXG4gICAgICAvLyB3aGVyZSBcXG4gcmVwcmVzZW50cyBtZXRob2QvZmllbGQgc2VwYXJhdG9ycyB0aGF0IHNob3VsZCBiZSBhY3R1YWwgbmV3bGluZXNcbiAgICAgIGlmIChwYXJzZWQuZGVmKSB7XG4gICAgICAgIHBhcnNlZC5kZWYgPSBwYXJzZWQuZGVmLnJlcGxhY2UoL1xcXFxuL2csICdcXG4nKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcnNlZFxuICAgIH0pXG5cbiAgLy8gbW92ZSBhbGwgYHN0cnVjdGAgZGVmIHRvIHRoZSB2ZXJ5IHRvcFxuICAvLyBhbmQgb3JkZXIgdGhlIHJlc3QgYWxwaGFiZXRpY2FsbHkuXG4gIHJldHVybiBkZWZzLnNvcnQoKGEsIGIpID0+IHtcbiAgICBpZiAoYS5raW5kID09PSBUeXBlRGVmS2luZC5TdHJ1Y3QpIHtcbiAgICAgIGlmIChiLmtpbmQgPT09IFR5cGVEZWZLaW5kLlN0cnVjdCkge1xuICAgICAgICByZXR1cm4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKVxuICAgICAgfVxuICAgICAgcmV0dXJuIC0xXG4gICAgfSBlbHNlIGlmIChiLmtpbmQgPT09IFR5cGVEZWZLaW5kLlN0cnVjdCkge1xuICAgICAgcmV0dXJuIDFcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSlcbiAgICB9XG4gIH0pXG59XG5cbmZ1bmN0aW9uIHByZXByb2Nlc3NUeXBlRGVmKGRlZnM6IFR5cGVEZWZMaW5lW10pOiBNYXA8c3RyaW5nLCBUeXBlRGVmTGluZVtdPiB7XG4gIGNvbnN0IG5hbWVzcGFjZUdyb3VwZWQgPSBuZXcgTWFwPHN0cmluZywgVHlwZURlZkxpbmVbXT4oKVxuICBjb25zdCBjbGFzc0RlZnMgPSBuZXcgTWFwPHN0cmluZywgVHlwZURlZkxpbmU+KClcblxuICBmb3IgKGNvbnN0IGRlZiBvZiBkZWZzKSB7XG4gICAgY29uc3QgbmFtZXNwYWNlID0gZGVmLmpzX21vZCA/PyBUT1BfTEVWRUxfTkFNRVNQQUNFXG4gICAgaWYgKCFuYW1lc3BhY2VHcm91cGVkLmhhcyhuYW1lc3BhY2UpKSB7XG4gICAgICBuYW1lc3BhY2VHcm91cGVkLnNldChuYW1lc3BhY2UsIFtdKVxuICAgIH1cblxuICAgIGNvbnN0IGdyb3VwID0gbmFtZXNwYWNlR3JvdXBlZC5nZXQobmFtZXNwYWNlKSFcblxuICAgIGlmIChkZWYua2luZCA9PT0gVHlwZURlZktpbmQuU3RydWN0KSB7XG4gICAgICBncm91cC5wdXNoKGRlZilcbiAgICAgIGNsYXNzRGVmcy5zZXQoZGVmLm5hbWUsIGRlZilcbiAgICB9IGVsc2UgaWYgKGRlZi5raW5kID09PSBUeXBlRGVmS2luZC5FeHRlbmRzKSB7XG4gICAgICBjb25zdCBjbGFzc0RlZiA9IGNsYXNzRGVmcy5nZXQoZGVmLm5hbWUpXG4gICAgICBpZiAoY2xhc3NEZWYpIHtcbiAgICAgICAgY2xhc3NEZWYuZXh0ZW5kcyA9IGRlZi5kZWZcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGRlZi5raW5kID09PSBUeXBlRGVmS2luZC5JbXBsKSB7XG4gICAgICAvLyBtZXJnZSBgaW1wbGAgaW50byBjbGFzcyBkZWZpbml0aW9uXG4gICAgICBjb25zdCBjbGFzc0RlZiA9IGNsYXNzRGVmcy5nZXQoZGVmLm5hbWUpXG4gICAgICBpZiAoY2xhc3NEZWYpIHtcbiAgICAgICAgaWYgKGNsYXNzRGVmLmRlZikge1xuICAgICAgICAgIGNsYXNzRGVmLmRlZiArPSAnXFxuJ1xuICAgICAgICB9XG5cbiAgICAgICAgY2xhc3NEZWYuZGVmICs9IGRlZi5kZWZcbiAgICAgICAgLy8gQ29udmVydCBhbnkgcmVtYWluaW5nIFxcbiBzZXF1ZW5jZXMgaW4gdGhlIG1lcmdlZCBkZWYgdG8gYWN0dWFsIG5ld2xpbmVzXG4gICAgICAgIGlmIChjbGFzc0RlZi5kZWYpIHtcbiAgICAgICAgICBjbGFzc0RlZi5kZWYgPSBjbGFzc0RlZi5kZWYucmVwbGFjZSgvXFxcXG4vZywgJ1xcbicpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZ3JvdXAucHVzaChkZWYpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5hbWVzcGFjZUdyb3VwZWRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvcnJlY3RTdHJpbmdJZGVudChzcmM6IHN0cmluZywgaWRlbnQ6IG51bWJlcik6IHN0cmluZyB7XG4gIGxldCBicmFja2V0RGVwdGggPSAwXG4gIGNvbnN0IHJlc3VsdCA9IHNyY1xuICAgIC5zcGxpdCgnXFxuJylcbiAgICAubWFwKChsaW5lKSA9PiB7XG4gICAgICBsaW5lID0gbGluZS50cmltKClcbiAgICAgIGlmIChsaW5lID09PSAnJykge1xuICAgICAgICByZXR1cm4gJydcbiAgICAgIH1cblxuICAgICAgY29uc3QgaXNJbk11bHRpbGluZUNvbW1lbnQgPSBsaW5lLnN0YXJ0c1dpdGgoJyonKVxuICAgICAgY29uc3QgaXNDbG9zaW5nQnJhY2tldCA9IGxpbmUuZW5kc1dpdGgoJ30nKVxuICAgICAgY29uc3QgaXNPcGVuaW5nQnJhY2tldCA9IGxpbmUuZW5kc1dpdGgoJ3snKVxuICAgICAgY29uc3QgaXNUeXBlRGVjbGFyYXRpb24gPSBsaW5lLmVuZHNXaXRoKCc9JylcbiAgICAgIGNvbnN0IGlzVHlwZVZhcmlhbnQgPSBsaW5lLnN0YXJ0c1dpdGgoJ3wnKVxuXG4gICAgICBsZXQgcmlnaHRJbmRlbnQgPSBpZGVudFxuICAgICAgaWYgKChpc09wZW5pbmdCcmFja2V0IHx8IGlzVHlwZURlY2xhcmF0aW9uKSAmJiAhaXNJbk11bHRpbGluZUNvbW1lbnQpIHtcbiAgICAgICAgYnJhY2tldERlcHRoICs9IDFcbiAgICAgICAgcmlnaHRJbmRlbnQgKz0gKGJyYWNrZXREZXB0aCAtIDEpICogMlxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGlzQ2xvc2luZ0JyYWNrZXQgJiZcbiAgICAgICAgICBicmFja2V0RGVwdGggPiAwICYmXG4gICAgICAgICAgIWlzSW5NdWx0aWxpbmVDb21tZW50ICYmXG4gICAgICAgICAgIWlzVHlwZVZhcmlhbnRcbiAgICAgICAgKSB7XG4gICAgICAgICAgYnJhY2tldERlcHRoIC09IDFcbiAgICAgICAgfVxuICAgICAgICByaWdodEluZGVudCArPSBicmFja2V0RGVwdGggKiAyXG4gICAgICB9XG5cbiAgICAgIGlmIChpc0luTXVsdGlsaW5lQ29tbWVudCkge1xuICAgICAgICByaWdodEluZGVudCArPSAxXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHMgPSBgJHsnICcucmVwZWF0KHJpZ2h0SW5kZW50KX0ke2xpbmV9YFxuXG4gICAgICByZXR1cm4gc1xuICAgIH0pXG4gICAgLmpvaW4oJ1xcbicpXG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuIiwiaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCdcblxuaW1wb3J0IHsgcmVhZE5hcGlDb25maWcgfSBmcm9tICcuL2NvbmZpZy5qcydcblxuaW50ZXJmYWNlIE1pbmltYWxOYXBpT3B0aW9ucyB7XG4gIGN3ZDogc3RyaW5nXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmdcbiAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFkQ29uZmlnKG9wdGlvbnM6IE1pbmltYWxOYXBpT3B0aW9ucykge1xuICBjb25zdCByZXNvbHZlUGF0aCA9ICguLi5wYXRoczogc3RyaW5nW10pID0+IHJlc29sdmUob3B0aW9ucy5jd2QsIC4uLnBhdGhzKVxuICBjb25zdCBjb25maWcgPSBhd2FpdCByZWFkTmFwaUNvbmZpZyhcbiAgICByZXNvbHZlUGF0aChvcHRpb25zLnBhY2thZ2VKc29uUGF0aCA/PyAncGFja2FnZS5qc29uJyksXG4gICAgb3B0aW9ucy5jb25maWdQYXRoID8gcmVzb2x2ZVBhdGgob3B0aW9ucy5jb25maWdQYXRoKSA6IHVuZGVmaW5lZCxcbiAgKVxuICByZXR1cm4gY29uZmlnXG59XG4iLCJpbXBvcnQgeyBqb2luLCByZXNvbHZlLCBwYXJzZSB9IGZyb20gJ25vZGU6cGF0aCdcblxuaW1wb3J0ICogYXMgY29sb3JzIGZyb20gJ2NvbG9yZXR0ZSdcblxuaW1wb3J0IHtcbiAgYXBwbHlEZWZhdWx0QXJ0aWZhY3RzT3B0aW9ucyxcbiAgdHlwZSBBcnRpZmFjdHNPcHRpb25zLFxufSBmcm9tICcuLi9kZWYvYXJ0aWZhY3RzLmpzJ1xuaW1wb3J0IHtcbiAgcmVhZE5hcGlDb25maWcsXG4gIGRlYnVnRmFjdG9yeSxcbiAgcmVhZEZpbGVBc3luYyxcbiAgd3JpdGVGaWxlQXN5bmMsXG4gIFVuaUFyY2hzQnlQbGF0Zm9ybSxcbiAgcmVhZGRpckFzeW5jLFxufSBmcm9tICcuLi91dGlscy9pbmRleC5qcydcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ2FydGlmYWN0cycpXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb2xsZWN0QXJ0aWZhY3RzKHVzZXJPcHRpb25zOiBBcnRpZmFjdHNPcHRpb25zKSB7XG4gIGNvbnN0IG9wdGlvbnMgPSBhcHBseURlZmF1bHRBcnRpZmFjdHNPcHRpb25zKHVzZXJPcHRpb25zKVxuXG4gIGNvbnN0IHJlc29sdmVQYXRoID0gKC4uLnBhdGhzOiBzdHJpbmdbXSkgPT4gcmVzb2x2ZShvcHRpb25zLmN3ZCwgLi4ucGF0aHMpXG4gIGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IHJlc29sdmVQYXRoKG9wdGlvbnMucGFja2FnZUpzb25QYXRoKVxuICBjb25zdCB7IHRhcmdldHMsIGJpbmFyeU5hbWUsIHBhY2thZ2VOYW1lIH0gPSBhd2FpdCByZWFkTmFwaUNvbmZpZyhcbiAgICBwYWNrYWdlSnNvblBhdGgsXG4gICAgb3B0aW9ucy5jb25maWdQYXRoID8gcmVzb2x2ZVBhdGgob3B0aW9ucy5jb25maWdQYXRoKSA6IHVuZGVmaW5lZCxcbiAgKVxuXG4gIGNvbnN0IGRpc3REaXJzID0gdGFyZ2V0cy5tYXAoKHBsYXRmb3JtKSA9PlxuICAgIGpvaW4ob3B0aW9ucy5jd2QsIG9wdGlvbnMubnBtRGlyLCBwbGF0Zm9ybS5wbGF0Zm9ybUFyY2hBQkkpLFxuICApXG5cbiAgY29uc3QgdW5pdmVyc2FsU291cmNlQmlucyA9IG5ldyBTZXQoXG4gICAgdGFyZ2V0c1xuICAgICAgLmZpbHRlcigocGxhdGZvcm0pID0+IHBsYXRmb3JtLmFyY2ggPT09ICd1bml2ZXJzYWwnKVxuICAgICAgLmZsYXRNYXAoKHApID0+XG4gICAgICAgIFVuaUFyY2hzQnlQbGF0Zm9ybVtwLnBsYXRmb3JtXT8ubWFwKChhKSA9PiBgJHtwLnBsYXRmb3JtfS0ke2F9YCksXG4gICAgICApXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pIGFzIHN0cmluZ1tdLFxuICApXG5cbiAgYXdhaXQgY29sbGVjdE5vZGVCaW5hcmllcyhqb2luKG9wdGlvbnMuY3dkLCBvcHRpb25zLm91dHB1dERpcikpLnRoZW4oXG4gICAgKG91dHB1dCkgPT5cbiAgICAgIFByb21pc2UuYWxsKFxuICAgICAgICBvdXRwdXQubWFwKGFzeW5jIChmaWxlUGF0aCkgPT4ge1xuICAgICAgICAgIGRlYnVnLmluZm8oYFJlYWQgWyR7Y29sb3JzLnllbGxvd0JyaWdodChmaWxlUGF0aCl9XWApXG4gICAgICAgICAgY29uc3Qgc291cmNlQ29udGVudCA9IGF3YWl0IHJlYWRGaWxlQXN5bmMoZmlsZVBhdGgpXG4gICAgICAgICAgY29uc3QgcGFyc2VkTmFtZSA9IHBhcnNlKGZpbGVQYXRoKVxuICAgICAgICAgIGNvbnN0IHRlcm1zID0gcGFyc2VkTmFtZS5uYW1lLnNwbGl0KCcuJylcbiAgICAgICAgICBjb25zdCBwbGF0Zm9ybUFyY2hBQkkgPSB0ZXJtcy5wb3AoKSFcbiAgICAgICAgICBjb25zdCBfYmluYXJ5TmFtZSA9IHRlcm1zLmpvaW4oJy4nKVxuXG4gICAgICAgICAgaWYgKF9iaW5hcnlOYW1lICE9PSBiaW5hcnlOYW1lKSB7XG4gICAgICAgICAgICBkZWJ1Zy53YXJuKFxuICAgICAgICAgICAgICBgWyR7X2JpbmFyeU5hbWV9XSBpcyBub3QgbWF0Y2hlZCB3aXRoIFske2JpbmFyeU5hbWV9XSwgc2tpcGAsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgZGlyID0gZGlzdERpcnMuZmluZCgoZGlyKSA9PiBkaXIuaW5jbHVkZXMocGxhdGZvcm1BcmNoQUJJKSlcbiAgICAgICAgICBpZiAoIWRpciAmJiB1bml2ZXJzYWxTb3VyY2VCaW5zLmhhcyhwbGF0Zm9ybUFyY2hBQkkpKSB7XG4gICAgICAgICAgICBkZWJ1Zy53YXJuKFxuICAgICAgICAgICAgICBgWyR7cGxhdGZvcm1BcmNoQUJJfV0gaGFzIG5vIGRpc3QgZGlyIGJ1dCBpdCBpcyBzb3VyY2UgYmluIGZvciB1bml2ZXJzYWwgYXJjaCwgc2tpcGAsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCFkaXIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gZGlzdCBkaXIgZm91bmQgZm9yICR7ZmlsZVBhdGh9YClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBkaXN0RmlsZVBhdGggPSBqb2luKGRpciwgcGFyc2VkTmFtZS5iYXNlKVxuICAgICAgICAgIGRlYnVnLmluZm8oXG4gICAgICAgICAgICBgV3JpdGUgZmlsZSBjb250ZW50IHRvIFske2NvbG9ycy55ZWxsb3dCcmlnaHQoZGlzdEZpbGVQYXRoKX1dYCxcbiAgICAgICAgICApXG4gICAgICAgICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoZGlzdEZpbGVQYXRoLCBzb3VyY2VDb250ZW50KVxuICAgICAgICAgIGNvbnN0IGRpc3RGaWxlUGF0aExvY2FsID0gam9pbihcbiAgICAgICAgICAgIHBhcnNlKHBhY2thZ2VKc29uUGF0aCkuZGlyLFxuICAgICAgICAgICAgcGFyc2VkTmFtZS5iYXNlLFxuICAgICAgICAgIClcbiAgICAgICAgICBkZWJ1Zy5pbmZvKFxuICAgICAgICAgICAgYFdyaXRlIGZpbGUgY29udGVudCB0byBbJHtjb2xvcnMueWVsbG93QnJpZ2h0KGRpc3RGaWxlUGF0aExvY2FsKX1dYCxcbiAgICAgICAgICApXG4gICAgICAgICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoZGlzdEZpbGVQYXRoTG9jYWwsIHNvdXJjZUNvbnRlbnQpXG4gICAgICAgIH0pLFxuICAgICAgKSxcbiAgKVxuXG4gIGNvbnN0IHdhc2lUYXJnZXQgPSB0YXJnZXRzLmZpbmQoKHQpID0+IHQucGxhdGZvcm0gPT09ICd3YXNpJylcbiAgaWYgKHdhc2lUYXJnZXQpIHtcbiAgICBjb25zdCBidWlsZE91dHB1dERpciA9IG9wdGlvbnMuYnVpbGRPdXRwdXREaXJcbiAgICAgID8gcmVzb2x2ZShvcHRpb25zLmN3ZCwgb3B0aW9ucy5idWlsZE91dHB1dERpcilcbiAgICAgIDogb3B0aW9ucy5jd2RcbiAgICBjb25zdCB3YXNpRGlyID0gam9pbihcbiAgICAgIG9wdGlvbnMuY3dkLFxuICAgICAgb3B0aW9ucy5ucG1EaXIsXG4gICAgICB3YXNpVGFyZ2V0LnBsYXRmb3JtQXJjaEFCSSxcbiAgICApXG4gICAgY29uc3QgY2pzRmlsZSA9IGpvaW4oYnVpbGRPdXRwdXREaXIsIGAke2JpbmFyeU5hbWV9Lndhc2kuY2pzYClcbiAgICBjb25zdCB3b3JrZXJGaWxlID0gam9pbihidWlsZE91dHB1dERpciwgYHdhc2ktd29ya2VyLm1qc2ApXG4gICAgY29uc3QgYnJvd3NlckVudHJ5ID0gam9pbihidWlsZE91dHB1dERpciwgYCR7YmluYXJ5TmFtZX0ud2FzaS1icm93c2VyLmpzYClcbiAgICBjb25zdCBicm93c2VyV29ya2VyRmlsZSA9IGpvaW4oYnVpbGRPdXRwdXREaXIsIGB3YXNpLXdvcmtlci1icm93c2VyLm1qc2ApXG4gICAgZGVidWcuaW5mbyhcbiAgICAgIGBNb3ZlIHdhc2kgYmluZGluZyBmaWxlIFske2NvbG9ycy55ZWxsb3dCcmlnaHQoXG4gICAgICAgIGNqc0ZpbGUsXG4gICAgICApfV0gdG8gWyR7Y29sb3JzLnllbGxvd0JyaWdodCh3YXNpRGlyKX1dYCxcbiAgICApXG4gICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoXG4gICAgICBqb2luKHdhc2lEaXIsIGAke2JpbmFyeU5hbWV9Lndhc2kuY2pzYCksXG4gICAgICBhd2FpdCByZWFkRmlsZUFzeW5jKGNqc0ZpbGUpLFxuICAgIClcbiAgICBkZWJ1Zy5pbmZvKFxuICAgICAgYE1vdmUgd2FzaSB3b3JrZXIgZmlsZSBbJHtjb2xvcnMueWVsbG93QnJpZ2h0KFxuICAgICAgICB3b3JrZXJGaWxlLFxuICAgICAgKX1dIHRvIFske2NvbG9ycy55ZWxsb3dCcmlnaHQod2FzaURpcil9XWAsXG4gICAgKVxuICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKFxuICAgICAgam9pbih3YXNpRGlyLCBgd2FzaS13b3JrZXIubWpzYCksXG4gICAgICBhd2FpdCByZWFkRmlsZUFzeW5jKHdvcmtlckZpbGUpLFxuICAgIClcbiAgICBkZWJ1Zy5pbmZvKFxuICAgICAgYE1vdmUgd2FzaSBicm93c2VyIGVudHJ5IGZpbGUgWyR7Y29sb3JzLnllbGxvd0JyaWdodChcbiAgICAgICAgYnJvd3NlckVudHJ5LFxuICAgICAgKX1dIHRvIFske2NvbG9ycy55ZWxsb3dCcmlnaHQod2FzaURpcil9XWAsXG4gICAgKVxuICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKFxuICAgICAgam9pbih3YXNpRGlyLCBgJHtiaW5hcnlOYW1lfS53YXNpLWJyb3dzZXIuanNgKSxcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS92aXRlanMvdml0ZS9pc3N1ZXMvODQyN1xuICAgICAgKGF3YWl0IHJlYWRGaWxlQXN5bmMoYnJvd3NlckVudHJ5LCAndXRmOCcpKS5yZXBsYWNlKFxuICAgICAgICBgbmV3IFVSTCgnLi93YXNpLXdvcmtlci1icm93c2VyLm1qcycsIGltcG9ydC5tZXRhLnVybClgLFxuICAgICAgICBgbmV3IFVSTCgnJHtwYWNrYWdlTmFtZX0td2FzbTMyLXdhc2kvd2FzaS13b3JrZXItYnJvd3Nlci5tanMnLCBpbXBvcnQubWV0YS51cmwpYCxcbiAgICAgICksXG4gICAgKVxuICAgIGRlYnVnLmluZm8oXG4gICAgICBgTW92ZSB3YXNpIGJyb3dzZXIgd29ya2VyIGZpbGUgWyR7Y29sb3JzLnllbGxvd0JyaWdodChcbiAgICAgICAgYnJvd3NlcldvcmtlckZpbGUsXG4gICAgICApfV0gdG8gWyR7Y29sb3JzLnllbGxvd0JyaWdodCh3YXNpRGlyKX1dYCxcbiAgICApXG4gICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoXG4gICAgICBqb2luKHdhc2lEaXIsIGB3YXNpLXdvcmtlci1icm93c2VyLm1qc2ApLFxuICAgICAgYXdhaXQgcmVhZEZpbGVBc3luYyhicm93c2VyV29ya2VyRmlsZSksXG4gICAgKVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNvbGxlY3ROb2RlQmluYXJpZXMocm9vdDogc3RyaW5nKSB7XG4gIGNvbnN0IGZpbGVzID0gYXdhaXQgcmVhZGRpckFzeW5jKHJvb3QsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICBjb25zdCBub2RlQmluYXJpZXMgPSBmaWxlc1xuICAgIC5maWx0ZXIoXG4gICAgICAoZmlsZSkgPT5cbiAgICAgICAgZmlsZS5pc0ZpbGUoKSAmJlxuICAgICAgICAoZmlsZS5uYW1lLmVuZHNXaXRoKCcubm9kZScpIHx8IGZpbGUubmFtZS5lbmRzV2l0aCgnLndhc20nKSksXG4gICAgKVxuICAgIC5tYXAoKGZpbGUpID0+IGpvaW4ocm9vdCwgZmlsZS5uYW1lKSlcblxuICBjb25zdCBkaXJzID0gZmlsZXMuZmlsdGVyKChmaWxlKSA9PiBmaWxlLmlzRGlyZWN0b3J5KCkpXG4gIGZvciAoY29uc3QgZGlyIG9mIGRpcnMpIHtcbiAgICBpZiAoZGlyLm5hbWUgIT09ICdub2RlX21vZHVsZXMnKSB7XG4gICAgICBub2RlQmluYXJpZXMucHVzaCguLi4oYXdhaXQgY29sbGVjdE5vZGVCaW5hcmllcyhqb2luKHJvb3QsIGRpci5uYW1lKSkpKVxuICAgIH1cbiAgfVxuICByZXR1cm4gbm9kZUJpbmFyaWVzXG59XG4iLCJleHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2pzQmluZGluZyhcbiAgbG9jYWxOYW1lOiBzdHJpbmcsXG4gIHBrZ05hbWU6IHN0cmluZyxcbiAgaWRlbnRzOiBzdHJpbmdbXSxcbiAgcGFja2FnZVZlcnNpb24/OiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICByZXR1cm4gYCR7YmluZGluZ0hlYWRlcn1cbiR7Y3JlYXRlQ29tbW9uQmluZGluZyhsb2NhbE5hbWUsIHBrZ05hbWUsIHBhY2thZ2VWZXJzaW9uKX1cbm1vZHVsZS5leHBvcnRzID0gbmF0aXZlQmluZGluZ1xuJHtpZGVudHNcbiAgLm1hcCgoaWRlbnQpID0+IGBtb2R1bGUuZXhwb3J0cy4ke2lkZW50fSA9IG5hdGl2ZUJpbmRpbmcuJHtpZGVudH1gKVxuICAuam9pbignXFxuJyl9XG5gXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFc21CaW5kaW5nKFxuICBsb2NhbE5hbWU6IHN0cmluZyxcbiAgcGtnTmFtZTogc3RyaW5nLFxuICBpZGVudHM6IHN0cmluZ1tdLFxuICBwYWNrYWdlVmVyc2lvbj86IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIHJldHVybiBgJHtiaW5kaW5nSGVhZGVyfVxuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gJ21vZHVsZSdcbmNvbnN0IHJlcXVpcmUgPSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybClcbmNvbnN0IF9fZGlybmFtZSA9IG5ldyBVUkwoJy4nLCBpbXBvcnQubWV0YS51cmwpLnBhdGhuYW1lXG5cbiR7Y3JlYXRlQ29tbW9uQmluZGluZyhsb2NhbE5hbWUsIHBrZ05hbWUsIHBhY2thZ2VWZXJzaW9uKX1cbmNvbnN0IHsgJHtpZGVudHMuam9pbignLCAnKX0gfSA9IG5hdGl2ZUJpbmRpbmdcbiR7aWRlbnRzLm1hcCgoaWRlbnQpID0+IGBleHBvcnQgeyAke2lkZW50fSB9YCkuam9pbignXFxuJyl9XG5gXG59XG5cbmNvbnN0IGJpbmRpbmdIZWFkZXIgPSBgLy8gcHJldHRpZXItaWdub3JlXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuLy8gQHRzLW5vY2hlY2tcbi8qIGF1dG8tZ2VuZXJhdGVkIGJ5IE5BUEktUlMgKi9cbmBcblxuZnVuY3Rpb24gY3JlYXRlQ29tbW9uQmluZGluZyhcbiAgbG9jYWxOYW1lOiBzdHJpbmcsXG4gIHBrZ05hbWU6IHN0cmluZyxcbiAgcGFja2FnZVZlcnNpb24/OiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICBmdW5jdGlvbiByZXF1aXJlVHVwbGUodHVwbGU6IHN0cmluZywgaWRlbnRTaXplID0gOCkge1xuICAgIGNvbnN0IGlkZW50TG93ID0gJyAnLnJlcGVhdChpZGVudFNpemUgLSAyKVxuICAgIGNvbnN0IGlkZW50ID0gJyAnLnJlcGVhdChpZGVudFNpemUpXG4gICAgY29uc3QgdmVyc2lvbkNoZWNrID0gcGFja2FnZVZlcnNpb25cbiAgICAgID8gYFxuJHtpZGVudExvd310cnkge1xuJHtpZGVudH1jb25zdCBiaW5kaW5nID0gcmVxdWlyZSgnJHtwa2dOYW1lfS0ke3R1cGxlfScpXG4ke2lkZW50fWNvbnN0IGJpbmRpbmdQYWNrYWdlVmVyc2lvbiA9IHJlcXVpcmUoJyR7cGtnTmFtZX0tJHt0dXBsZX0vcGFja2FnZS5qc29uJykudmVyc2lvblxuJHtpZGVudH1pZiAoYmluZGluZ1BhY2thZ2VWZXJzaW9uICE9PSAnJHtwYWNrYWdlVmVyc2lvbn0nICYmIHByb2Nlc3MuZW52Lk5BUElfUlNfRU5GT1JDRV9WRVJTSU9OX0NIRUNLICYmIHByb2Nlc3MuZW52Lk5BUElfUlNfRU5GT1JDRV9WRVJTSU9OX0NIRUNLICE9PSAnMCcpIHtcbiR7aWRlbnR9ICB0aHJvdyBuZXcgRXJyb3IoXFxgTmF0aXZlIGJpbmRpbmcgcGFja2FnZSB2ZXJzaW9uIG1pc21hdGNoLCBleHBlY3RlZCAke3BhY2thZ2VWZXJzaW9ufSBidXQgZ290IFxcJHtiaW5kaW5nUGFja2FnZVZlcnNpb259LiBZb3UgY2FuIHJlaW5zdGFsbCBkZXBlbmRlbmNpZXMgdG8gZml4IHRoaXMgaXNzdWUuXFxgKVxuJHtpZGVudH19XG4ke2lkZW50fXJldHVybiBiaW5kaW5nXG4ke2lkZW50TG93fX0gY2F0Y2ggKGUpIHtcbiR7aWRlbnR9bG9hZEVycm9ycy5wdXNoKGUpXG4ke2lkZW50TG93fX1gXG4gICAgICA6IGBcbiR7aWRlbnRMb3d9dHJ5IHtcbiR7aWRlbnR9cmV0dXJuIHJlcXVpcmUoJyR7cGtnTmFtZX0tJHt0dXBsZX0nKVxuJHtpZGVudExvd319IGNhdGNoIChlKSB7XG4ke2lkZW50fWxvYWRFcnJvcnMucHVzaChlKVxuJHtpZGVudExvd319YFxuICAgIHJldHVybiBgdHJ5IHtcbiR7aWRlbnR9cmV0dXJuIHJlcXVpcmUoJy4vJHtsb2NhbE5hbWV9LiR7dHVwbGV9Lm5vZGUnKVxuJHtpZGVudExvd319IGNhdGNoIChlKSB7XG4ke2lkZW50fWxvYWRFcnJvcnMucHVzaChlKVxuJHtpZGVudExvd319JHt2ZXJzaW9uQ2hlY2t9YFxuICB9XG5cbiAgcmV0dXJuIGBjb25zdCB7IHJlYWRGaWxlU3luYyB9ID0gcmVxdWlyZSgnZnMnKVxubGV0IG5hdGl2ZUJpbmRpbmcgPSBudWxsXG5jb25zdCBsb2FkRXJyb3JzID0gW11cblxuY29uc3QgaXNNdXNsID0gKCkgPT4ge1xuICBsZXQgbXVzbCA9IGZhbHNlXG4gIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnbGludXgnKSB7XG4gICAgbXVzbCA9IGlzTXVzbEZyb21GaWxlc3lzdGVtKClcbiAgICBpZiAobXVzbCA9PT0gbnVsbCkge1xuICAgICAgbXVzbCA9IGlzTXVzbEZyb21SZXBvcnQoKVxuICAgIH1cbiAgICBpZiAobXVzbCA9PT0gbnVsbCkge1xuICAgICAgbXVzbCA9IGlzTXVzbEZyb21DaGlsZFByb2Nlc3MoKVxuICAgIH1cbiAgfVxuICByZXR1cm4gbXVzbFxufVxuXG5jb25zdCBpc0ZpbGVNdXNsID0gKGYpID0+IGYuaW5jbHVkZXMoJ2xpYmMubXVzbC0nKSB8fCBmLmluY2x1ZGVzKCdsZC1tdXNsLScpXG5cbmNvbnN0IGlzTXVzbEZyb21GaWxlc3lzdGVtID0gKCkgPT4ge1xuICB0cnkge1xuICAgIHJldHVybiByZWFkRmlsZVN5bmMoJy91c3IvYmluL2xkZCcsICd1dGYtOCcpLmluY2x1ZGVzKCdtdXNsJylcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxufVxuXG5jb25zdCBpc011c2xGcm9tUmVwb3J0ID0gKCkgPT4ge1xuICBsZXQgcmVwb3J0ID0gbnVsbFxuICBpZiAocHJvY2Vzcy5yZXBvcnQgJiYgdHlwZW9mIHByb2Nlc3MucmVwb3J0LmdldFJlcG9ydCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHByb2Nlc3MucmVwb3J0LmV4Y2x1ZGVOZXR3b3JrID0gdHJ1ZVxuICAgIHJlcG9ydCA9IHByb2Nlc3MucmVwb3J0LmdldFJlcG9ydCgpXG4gIH1cbiAgaWYgKCFyZXBvcnQpIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG4gIGlmIChyZXBvcnQuaGVhZGVyICYmIHJlcG9ydC5oZWFkZXIuZ2xpYmNWZXJzaW9uUnVudGltZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIGlmIChBcnJheS5pc0FycmF5KHJlcG9ydC5zaGFyZWRPYmplY3RzKSkge1xuICAgIGlmIChyZXBvcnQuc2hhcmVkT2JqZWN0cy5zb21lKGlzRmlsZU11c2wpKSB7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2Vcbn1cblxuY29uc3QgaXNNdXNsRnJvbUNoaWxkUHJvY2VzcyA9ICgpID0+IHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpLmV4ZWNTeW5jKCdsZGQgLS12ZXJzaW9uJywgeyBlbmNvZGluZzogJ3V0ZjgnIH0pLmluY2x1ZGVzKCdtdXNsJylcbiAgfSBjYXRjaCAoZSkge1xuICAgIC8vIElmIHdlIHJlYWNoIHRoaXMgY2FzZSwgd2UgZG9uJ3Qga25vdyBpZiB0aGUgc3lzdGVtIGlzIG11c2wgb3Igbm90LCBzbyBpcyBiZXR0ZXIgdG8ganVzdCBmYWxsYmFjayB0byBmYWxzZVxuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlcXVpcmVOYXRpdmUoKSB7XG4gIGlmIChwcm9jZXNzLmVudi5OQVBJX1JTX05BVElWRV9MSUJSQVJZX1BBVEgpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHJlcXVpcmUocHJvY2Vzcy5lbnYuTkFQSV9SU19OQVRJVkVfTElCUkFSWV9QQVRIKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGxvYWRFcnJvcnMucHVzaChlcnIpXG4gICAgfVxuICB9IGVsc2UgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdhbmRyb2lkJykge1xuICAgIGlmIChwcm9jZXNzLmFyY2ggPT09ICdhcm02NCcpIHtcbiAgICAgICR7cmVxdWlyZVR1cGxlKCdhbmRyb2lkLWFybTY0Jyl9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICdhcm0nKSB7XG4gICAgICAke3JlcXVpcmVUdXBsZSgnYW5kcm9pZC1hcm0tZWFiaScpfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2FkRXJyb3JzLnB1c2gobmV3IEVycm9yKFxcYFVuc3VwcG9ydGVkIGFyY2hpdGVjdHVyZSBvbiBBbmRyb2lkIFxcJHtwcm9jZXNzLmFyY2h9XFxgKSlcbiAgICB9XG4gIH0gZWxzZSBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuICAgIGlmIChwcm9jZXNzLmFyY2ggPT09ICd4NjQnKSB7XG4gICAgICBpZiAoKHByb2Nlc3MuY29uZmlnICYmIHByb2Nlc3MuY29uZmlnLnZhcmlhYmxlcyAmJiBwcm9jZXNzLmNvbmZpZy52YXJpYWJsZXMuc2hsaWJfc3VmZml4ID09PSAnZGxsLmEnKSB8fCAocHJvY2Vzcy5jb25maWcgJiYgcHJvY2Vzcy5jb25maWcudmFyaWFibGVzICYmIHByb2Nlc3MuY29uZmlnLnZhcmlhYmxlcy5ub2RlX3RhcmdldF90eXBlID09PSAnc2hhcmVkX2xpYnJhcnknKSkge1xuICAgICAgICAke3JlcXVpcmVUdXBsZSgnd2luMzIteDY0LWdudScpfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgJHtyZXF1aXJlVHVwbGUoJ3dpbjMyLXg2NC1tc3ZjJyl9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICdpYTMyJykge1xuICAgICAgJHtyZXF1aXJlVHVwbGUoJ3dpbjMyLWlhMzItbXN2YycpfVxuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5hcmNoID09PSAnYXJtNjQnKSB7XG4gICAgICAke3JlcXVpcmVUdXBsZSgnd2luMzItYXJtNjQtbXN2YycpfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2FkRXJyb3JzLnB1c2gobmV3IEVycm9yKFxcYFVuc3VwcG9ydGVkIGFyY2hpdGVjdHVyZSBvbiBXaW5kb3dzOiBcXCR7cHJvY2Vzcy5hcmNofVxcYCkpXG4gICAgfVxuICB9IGVsc2UgaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdkYXJ3aW4nKSB7XG4gICAgJHtyZXF1aXJlVHVwbGUoJ2Rhcndpbi11bml2ZXJzYWwnLCA2KX1cbiAgICBpZiAocHJvY2Vzcy5hcmNoID09PSAneDY0Jykge1xuICAgICAgJHtyZXF1aXJlVHVwbGUoJ2Rhcndpbi14NjQnKX1cbiAgICB9IGVsc2UgaWYgKHByb2Nlc3MuYXJjaCA9PT0gJ2FybTY0Jykge1xuICAgICAgJHtyZXF1aXJlVHVwbGUoJ2Rhcndpbi1hcm02NCcpfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2FkRXJyb3JzLnB1c2gobmV3IEVycm9yKFxcYFVuc3VwcG9ydGVkIGFyY2hpdGVjdHVyZSBvbiBtYWNPUzogXFwke3Byb2Nlc3MuYXJjaH1cXGApKVxuICAgIH1cbiAgfSBlbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZnJlZWJzZCcpIHtcbiAgICBpZiAocHJvY2Vzcy5hcmNoID09PSAneDY0Jykge1xuICAgICAgJHtyZXF1aXJlVHVwbGUoJ2ZyZWVic2QteDY0Jyl9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICdhcm02NCcpIHtcbiAgICAgICR7cmVxdWlyZVR1cGxlKCdmcmVlYnNkLWFybTY0Jyl9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvYWRFcnJvcnMucHVzaChuZXcgRXJyb3IoXFxgVW5zdXBwb3J0ZWQgYXJjaGl0ZWN0dXJlIG9uIEZyZWVCU0Q6IFxcJHtwcm9jZXNzLmFyY2h9XFxgKSlcbiAgICB9XG4gIH0gZWxzZSBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2xpbnV4Jykge1xuICAgIGlmIChwcm9jZXNzLmFyY2ggPT09ICd4NjQnKSB7XG4gICAgICBpZiAoaXNNdXNsKCkpIHtcbiAgICAgICAgJHtyZXF1aXJlVHVwbGUoJ2xpbnV4LXg2NC1tdXNsJywgMTApfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgJHtyZXF1aXJlVHVwbGUoJ2xpbnV4LXg2NC1nbnUnLCAxMCl9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICdhcm02NCcpIHtcbiAgICAgIGlmIChpc011c2woKSkge1xuICAgICAgICAke3JlcXVpcmVUdXBsZSgnbGludXgtYXJtNjQtbXVzbCcsIDEwKX1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICR7cmVxdWlyZVR1cGxlKCdsaW51eC1hcm02NC1nbnUnLCAxMCl9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICdhcm0nKSB7XG4gICAgICBpZiAoaXNNdXNsKCkpIHtcbiAgICAgICAgJHtyZXF1aXJlVHVwbGUoJ2xpbnV4LWFybS1tdXNsZWFiaWhmJywgMTApfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgJHtyZXF1aXJlVHVwbGUoJ2xpbnV4LWFybS1nbnVlYWJpaGYnLCAxMCl9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICdsb29uZzY0Jykge1xuICAgICAgaWYgKGlzTXVzbCgpKSB7XG4gICAgICAgICR7cmVxdWlyZVR1cGxlKCdsaW51eC1sb29uZzY0LW11c2wnLCAxMCl9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAke3JlcXVpcmVUdXBsZSgnbGludXgtbG9vbmc2NC1nbnUnLCAxMCl9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICdyaXNjdjY0Jykge1xuICAgICAgaWYgKGlzTXVzbCgpKSB7XG4gICAgICAgICR7cmVxdWlyZVR1cGxlKCdsaW51eC1yaXNjdjY0LW11c2wnLCAxMCl9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAke3JlcXVpcmVUdXBsZSgnbGludXgtcmlzY3Y2NC1nbnUnLCAxMCl9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICdwcGM2NCcpIHtcbiAgICAgICR7cmVxdWlyZVR1cGxlKCdsaW51eC1wcGM2NC1nbnUnKX1cbiAgICB9IGVsc2UgaWYgKHByb2Nlc3MuYXJjaCA9PT0gJ3MzOTB4Jykge1xuICAgICAgJHtyZXF1aXJlVHVwbGUoJ2xpbnV4LXMzOTB4LWdudScpfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2FkRXJyb3JzLnB1c2gobmV3IEVycm9yKFxcYFVuc3VwcG9ydGVkIGFyY2hpdGVjdHVyZSBvbiBMaW51eDogXFwke3Byb2Nlc3MuYXJjaH1cXGApKVxuICAgIH1cbiAgfSBlbHNlIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnb3Blbmhhcm1vbnknKSB7XG4gICAgaWYgKHByb2Nlc3MuYXJjaCA9PT0gJ2FybTY0Jykge1xuICAgICAgJHtyZXF1aXJlVHVwbGUoJ29wZW5oYXJtb255LWFybTY0Jyl9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICd4NjQnKSB7XG4gICAgICAke3JlcXVpcmVUdXBsZSgnb3Blbmhhcm1vbnkteDY0Jyl9XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmFyY2ggPT09ICdhcm0nKSB7XG4gICAgICAke3JlcXVpcmVUdXBsZSgnb3Blbmhhcm1vbnktYXJtJyl9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvYWRFcnJvcnMucHVzaChuZXcgRXJyb3IoXFxgVW5zdXBwb3J0ZWQgYXJjaGl0ZWN0dXJlIG9uIE9wZW5IYXJtb255OiBcXCR7cHJvY2Vzcy5hcmNofVxcYCkpXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGxvYWRFcnJvcnMucHVzaChuZXcgRXJyb3IoXFxgVW5zdXBwb3J0ZWQgT1M6IFxcJHtwcm9jZXNzLnBsYXRmb3JtfSwgYXJjaGl0ZWN0dXJlOiBcXCR7cHJvY2Vzcy5hcmNofVxcYCkpXG4gIH1cbn1cblxubmF0aXZlQmluZGluZyA9IHJlcXVpcmVOYXRpdmUoKVxuXG4vLyBOQVBJX1JTX0ZPUkNFX1dBU0kgaXMgYSB0cmktc3RhdGUgZmxhZzpcbi8vICAgdW5zZXQgLyBhbnkgb3RoZXIgdmFsdWUg4oaSIG5hdGl2ZSBiaW5kaW5nIHByZWZlcnJlZCwgV0FTSSBpcyBvbmx5IGEgZmFsbGJhY2tcbi8vICAgJ3RydWUnICAgICAgICAgICAgICAgICAgIOKGkiBmb3JjZSBXQVNJIGZhbGxiYWNrIGV2ZW4gaWYgbmF0aXZlIGxvYWRlZFxuLy8gICAnZXJyb3InICAgICAgICAgICAgICAgICAg4oaSIGZvcmNlIFdBU0kgYW5kIHRocm93IGlmIG5vIFdBU0kgYmluZGluZyBpcyBmb3VuZFxuLy8gVHJlYXRpbmcgYW55IG5vbi1lbXB0eSBzdHJpbmcgYXMgdHJ1dGh5ICh0aGUgaGlzdG9yaWNhbCBiZWhhdmlvcikgbWVhbnRcbi8vIE5BUElfUlNfRk9SQ0VfV0FTST1mYWxzZSwgTkFQSV9SU19GT1JDRV9XQVNJPTAsIGV0Yy4gaW5hZHZlcnRlbnRseSB0cmlnZ2VyZWRcbi8vIHRoZSBXQVNJIHBhdGgsIGNhdXNpbmcgRU5PRU5UIGZvciBwYWNrYWdlcyBzaGlwcGVkIHdpdGhvdXQgYSAud2FzaS5janMgZmlsZS5cbmNvbnN0IGZvcmNlV2FzaSA9XG4gIHByb2Nlc3MuZW52Lk5BUElfUlNfRk9SQ0VfV0FTSSA9PT0gJ3RydWUnIHx8IHByb2Nlc3MuZW52Lk5BUElfUlNfRk9SQ0VfV0FTSSA9PT0gJ2Vycm9yJ1xuXG5pZiAoIW5hdGl2ZUJpbmRpbmcgfHwgZm9yY2VXYXNpKSB7XG4gIGxldCB3YXNpQmluZGluZyA9IG51bGxcbiAgbGV0IHdhc2lCaW5kaW5nRXJyb3IgPSBudWxsXG4gIHRyeSB7XG4gICAgd2FzaUJpbmRpbmcgPSByZXF1aXJlKCcuLyR7bG9jYWxOYW1lfS53YXNpLmNqcycpXG4gICAgbmF0aXZlQmluZGluZyA9IHdhc2lCaW5kaW5nXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChmb3JjZVdhc2kpIHtcbiAgICAgIHdhc2lCaW5kaW5nRXJyb3IgPSBlcnJcbiAgICB9XG4gIH1cbiAgaWYgKCFuYXRpdmVCaW5kaW5nIHx8IGZvcmNlV2FzaSkge1xuICAgIHRyeSB7XG4gICAgICB3YXNpQmluZGluZyA9IHJlcXVpcmUoJyR7cGtnTmFtZX0td2FzbTMyLXdhc2knKVxuICAgICAgbmF0aXZlQmluZGluZyA9IHdhc2lCaW5kaW5nXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZm9yY2VXYXNpKSB7XG4gICAgICAgIGlmICghd2FzaUJpbmRpbmdFcnJvcikge1xuICAgICAgICAgIHdhc2lCaW5kaW5nRXJyb3IgPSBlcnJcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3YXNpQmluZGluZ0Vycm9yLmNhdXNlID0gZXJyXG4gICAgICAgIH1cbiAgICAgICAgbG9hZEVycm9ycy5wdXNoKGVycilcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKHByb2Nlc3MuZW52Lk5BUElfUlNfRk9SQ0VfV0FTSSA9PT0gJ2Vycm9yJyAmJiAhd2FzaUJpbmRpbmcpIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcignV0FTSSBiaW5kaW5nIG5vdCBmb3VuZCBhbmQgTkFQSV9SU19GT1JDRV9XQVNJIGlzIHNldCB0byBlcnJvcicpXG4gICAgZXJyb3IuY2F1c2UgPSB3YXNpQmluZGluZ0Vycm9yXG4gICAgdGhyb3cgZXJyb3JcbiAgfVxufVxuXG5pZiAoIW5hdGl2ZUJpbmRpbmcpIHtcbiAgaWYgKGxvYWRFcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgXFxgQ2Fubm90IGZpbmQgbmF0aXZlIGJpbmRpbmcuIFxcYCArXG4gICAgICAgIFxcYG5wbSBoYXMgYSBidWcgcmVsYXRlZCB0byBvcHRpb25hbCBkZXBlbmRlbmNpZXMgKGh0dHBzOi8vZ2l0aHViLmNvbS9ucG0vY2xpL2lzc3Vlcy80ODI4KS4gXFxgICtcbiAgICAgICAgJ1BsZWFzZSB0cnkgXFxgbnBtIGlcXGAgYWdhaW4gYWZ0ZXIgcmVtb3ZpbmcgYm90aCBwYWNrYWdlLWxvY2suanNvbiBhbmQgbm9kZV9tb2R1bGVzIGRpcmVjdG9yeS4nLFxuICAgIClcbiAgICAvLyBhc3NpZ24gaW5zdGVhZCBvZiB0aGUgXFxgbmV3IEVycm9yKG1lc3NhZ2UsIHsgY2F1c2UgfSlcXGAgb3B0aW9ucyBmb3JtLFxuICAgIC8vIHdoaWNoIE5vZGUgPCAxNi45IHNpbGVudGx5IGlnbm9yZXNcbiAgICBlcnJvci5jYXVzZSA9IGxvYWRFcnJvcnMucmVkdWNlKChlcnIsIGN1cikgPT4ge1xuICAgICAgY3VyLmNhdXNlID0gZXJyXG4gICAgICByZXR1cm4gY3VyXG4gICAgfSlcbiAgICB0aHJvdyBlcnJvclxuICB9XG4gIHRocm93IG5ldyBFcnJvcihcXGBGYWlsZWQgdG8gbG9hZCBuYXRpdmUgYmluZGluZ1xcYClcbn1cbmBcbn1cbiIsImV4cG9ydCBjb25zdCBjcmVhdGVXYXNpQnJvd3NlckJpbmRpbmcgPSAoXG4gIHdhc2lGaWxlbmFtZTogc3RyaW5nLFxuICBpbml0aWFsTWVtb3J5ID0gNDAwMCxcbiAgbWF4aW11bU1lbW9yeSA9IDY1NTM2LFxuICBmcyA9IGZhbHNlLFxuICBhc3luY0luaXQgPSBmYWxzZSxcbiAgYnVmZmVyID0gZmFsc2UsXG4gIGVycm9yRXZlbnQgPSBmYWxzZSxcbikgPT4ge1xuICBjb25zdCBmc0ltcG9ydCA9IGZzXG4gICAgPyBidWZmZXJcbiAgICAgID8gYGltcG9ydCB7IG1lbWZzLCBCdWZmZXIgfSBmcm9tICdAbmFwaS1ycy93YXNtLXJ1bnRpbWUvZnMnYFxuICAgICAgOiBgaW1wb3J0IHsgbWVtZnMgfSBmcm9tICdAbmFwaS1ycy93YXNtLXJ1bnRpbWUvZnMnYFxuICAgIDogJydcbiAgY29uc3QgYnVmZmVySW1wb3J0ID0gYnVmZmVyICYmICFmcyA/IGBpbXBvcnQgeyBCdWZmZXIgfSBmcm9tICdidWZmZXInYCA6ICcnXG4gIGNvbnN0IHdhc2lDcmVhdGlvbiA9IGZzXG4gICAgPyBgXG5leHBvcnQgY29uc3QgeyBmczogX19mcywgdm9sOiBfX3ZvbHVtZSB9ID0gbWVtZnMoKVxuXG5jb25zdCBfX3dhc2kgPSBuZXcgX19XQVNJKHtcbiAgdmVyc2lvbjogJ3ByZXZpZXcxJyxcbiAgZnM6IF9fZnMsXG4gIHByZW9wZW5zOiB7XG4gICAgJy8nOiAnLycsXG4gIH0sXG59KWBcbiAgICA6IGBcbmNvbnN0IF9fd2FzaSA9IG5ldyBfX1dBU0koe1xuICB2ZXJzaW9uOiAncHJldmlldzEnLFxufSlgXG5cbiAgY29uc3Qgd29ya2VyRnNIYW5kbGVyID0gZnNcbiAgICA/IGAgICAgd29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBfX3dhc21DcmVhdGVPbk1lc3NhZ2VGb3JGc1Byb3h5KF9fZnMpKVxcbmBcbiAgICA6ICcnXG5cbiAgY29uc3Qgd29ya2VyRXJyb3JIYW5kbGVyID0gZXJyb3JFdmVudFxuICAgID8gYCAgICB3b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIChldmVudCkgPT4ge1xuICAgICAgaWYgKGV2ZW50LmRhdGEgJiYgdHlwZW9mIGV2ZW50LmRhdGEgPT09ICdvYmplY3QnICYmIGV2ZW50LmRhdGEudHlwZSA9PT0gJ2Vycm9yJykge1xuICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ25hcGktcnMtd29ya2VyLWVycm9yJywgeyBkZXRhaWw6IGV2ZW50LmRhdGEgfSkpXG4gICAgICB9XG4gICAgfSlcbmBcbiAgICA6ICcnXG5cbiAgY29uc3QgZW1uYXBpSW5qZWN0QnVmZmVyID0gYnVmZmVyXG4gICAgPyAnX19lbW5hcGlDb250ZXh0LmZlYXR1cmUuQnVmZmVyID0gQnVmZmVyJ1xuICAgIDogJydcbiAgY29uc3QgZW1uYXBpSW5zdGFudGlhdGVJbXBvcnQgPSBhc3luY0luaXRcbiAgICA/IGBpbnN0YW50aWF0ZU5hcGlNb2R1bGUgYXMgX19lbW5hcGlJbnN0YW50aWF0ZU5hcGlNb2R1bGVgXG4gICAgOiBgaW5zdGFudGlhdGVOYXBpTW9kdWxlU3luYyBhcyBfX2VtbmFwaUluc3RhbnRpYXRlTmFwaU1vZHVsZVN5bmNgXG4gIGNvbnN0IGVtbmFwaUluc3RhbnRpYXRlQ2FsbCA9IGFzeW5jSW5pdFxuICAgID8gYGF3YWl0IF9fZW1uYXBpSW5zdGFudGlhdGVOYXBpTW9kdWxlYFxuICAgIDogYF9fZW1uYXBpSW5zdGFudGlhdGVOYXBpTW9kdWxlU3luY2BcblxuICByZXR1cm4gYGltcG9ydCB7XG4gIGNyZWF0ZU9uTWVzc2FnZSBhcyBfX3dhc21DcmVhdGVPbk1lc3NhZ2VGb3JGc1Byb3h5LFxuICBnZXREZWZhdWx0Q29udGV4dCBhcyBfX2VtbmFwaUdldERlZmF1bHRDb250ZXh0LFxuICAke2VtbmFwaUluc3RhbnRpYXRlSW1wb3J0fSxcbiAgV0FTSSBhcyBfX1dBU0ksXG59IGZyb20gJ0BuYXBpLXJzL3dhc20tcnVudGltZSdcbiR7ZnNJbXBvcnR9XG4ke2J1ZmZlckltcG9ydH1cbiR7d2FzaUNyZWF0aW9ufVxuXG5jb25zdCBfX3dhc21VcmwgPSBuZXcgVVJMKCcuLyR7d2FzaUZpbGVuYW1lfS53YXNtJywgaW1wb3J0Lm1ldGEudXJsKS5ocmVmXG5jb25zdCBfX2VtbmFwaUNvbnRleHQgPSBfX2VtbmFwaUdldERlZmF1bHRDb250ZXh0KClcbiR7ZW1uYXBpSW5qZWN0QnVmZmVyfVxuXG5jb25zdCBfX3NoYXJlZE1lbW9yeSA9IG5ldyBXZWJBc3NlbWJseS5NZW1vcnkoe1xuICBpbml0aWFsOiAke2luaXRpYWxNZW1vcnl9LFxuICBtYXhpbXVtOiAke21heGltdW1NZW1vcnl9LFxuICBzaGFyZWQ6IHRydWUsXG59KVxuXG5jb25zdCBfX3dhc21GaWxlID0gYXdhaXQgZmV0Y2goX193YXNtVXJsKS50aGVuKChyZXMpID0+IHJlcy5hcnJheUJ1ZmZlcigpKVxuXG5jb25zdCB7XG4gIGluc3RhbmNlOiBfX25hcGlJbnN0YW5jZSxcbiAgbW9kdWxlOiBfX3dhc2lNb2R1bGUsXG4gIG5hcGlNb2R1bGU6IF9fbmFwaU1vZHVsZSxcbn0gPSAke2VtbmFwaUluc3RhbnRpYXRlQ2FsbH0oX193YXNtRmlsZSwge1xuICBjb250ZXh0OiBfX2VtbmFwaUNvbnRleHQsXG4gIGFzeW5jV29ya1Bvb2xTaXplOiA0LFxuICB3YXNpOiBfX3dhc2ksXG4gIG9uQ3JlYXRlV29ya2VyKCkge1xuICAgIGNvbnN0IHdvcmtlciA9IG5ldyBXb3JrZXIobmV3IFVSTCgnLi93YXNpLXdvcmtlci1icm93c2VyLm1qcycsIGltcG9ydC5tZXRhLnVybCksIHtcbiAgICAgIHR5cGU6ICdtb2R1bGUnLFxuICAgIH0pXG4ke3dvcmtlckZzSGFuZGxlcn1cbiR7d29ya2VyRXJyb3JIYW5kbGVyfVxuICAgIHJldHVybiB3b3JrZXJcbiAgfSxcbiAgb3ZlcndyaXRlSW1wb3J0cyhpbXBvcnRPYmplY3QpIHtcbiAgICBpbXBvcnRPYmplY3QuZW52ID0ge1xuICAgICAgLi4uaW1wb3J0T2JqZWN0LmVudixcbiAgICAgIC4uLmltcG9ydE9iamVjdC5uYXBpLFxuICAgICAgLi4uaW1wb3J0T2JqZWN0LmVtbmFwaSxcbiAgICAgIG1lbW9yeTogX19zaGFyZWRNZW1vcnksXG4gICAgfVxuICAgIHJldHVybiBpbXBvcnRPYmplY3RcbiAgfSxcbiAgYmVmb3JlSW5pdCh7IGluc3RhbmNlIH0pIHtcbiAgICBmb3IgKGNvbnN0IG5hbWUgb2YgT2JqZWN0LmtleXMoaW5zdGFuY2UuZXhwb3J0cykpIHtcbiAgICAgIGlmIChuYW1lLnN0YXJ0c1dpdGgoJ19fbmFwaV9yZWdpc3Rlcl9fJykpIHtcbiAgICAgICAgaW5zdGFuY2UuZXhwb3J0c1tuYW1lXSgpXG4gICAgICB9XG4gICAgfVxuICB9LFxufSlcbmBcbn1cblxuZXhwb3J0IGNvbnN0IGNyZWF0ZVdhc2lCaW5kaW5nID0gKFxuICB3YXNtRmlsZU5hbWU6IHN0cmluZyxcbiAgcGFja2FnZU5hbWU6IHN0cmluZyxcbiAgaW5pdGlhbE1lbW9yeSA9IDQwMDAsXG4gIG1heGltdW1NZW1vcnkgPSA2NTUzNixcbikgPT4gYC8qIGVzbGludC1kaXNhYmxlICovXG4vKiBwcmV0dGllci1pZ25vcmUgKi9cblxuLyogYXV0by1nZW5lcmF0ZWQgYnkgTkFQSS1SUyAqL1xuXG5jb25zdCBfX25vZGVGcyA9IHJlcXVpcmUoJ25vZGU6ZnMnKVxuY29uc3QgX19ub2RlUGF0aCA9IHJlcXVpcmUoJ25vZGU6cGF0aCcpXG5jb25zdCB7IFdBU0k6IF9fbm9kZVdBU0kgfSA9IHJlcXVpcmUoJ25vZGU6d2FzaScpXG5jb25zdCB7IFdvcmtlciB9ID0gcmVxdWlyZSgnbm9kZTp3b3JrZXJfdGhyZWFkcycpXG5cbmNvbnN0IHtcbiAgY3JlYXRlT25NZXNzYWdlOiBfX3dhc21DcmVhdGVPbk1lc3NhZ2VGb3JGc1Byb3h5LFxuICBnZXREZWZhdWx0Q29udGV4dDogX19lbW5hcGlHZXREZWZhdWx0Q29udGV4dCxcbiAgaW5zdGFudGlhdGVOYXBpTW9kdWxlU3luYzogX19lbW5hcGlJbnN0YW50aWF0ZU5hcGlNb2R1bGVTeW5jLFxufSA9IHJlcXVpcmUoJ0BuYXBpLXJzL3dhc20tcnVudGltZScpXG5cbmNvbnN0IF9fcm9vdERpciA9IF9fbm9kZVBhdGgucGFyc2UocHJvY2Vzcy5jd2QoKSkucm9vdFxuXG5jb25zdCBfX3dhc2kgPSBuZXcgX19ub2RlV0FTSSh7XG4gIHZlcnNpb246ICdwcmV2aWV3MScsXG4gIGVudjogcHJvY2Vzcy5lbnYsXG4gIHByZW9wZW5zOiB7XG4gICAgW19fcm9vdERpcl06IF9fcm9vdERpcixcbiAgfVxufSlcblxuY29uc3QgX19lbW5hcGlDb250ZXh0ID0gX19lbW5hcGlHZXREZWZhdWx0Q29udGV4dCgpXG5cbmNvbnN0IF9fc2hhcmVkTWVtb3J5ID0gbmV3IFdlYkFzc2VtYmx5Lk1lbW9yeSh7XG4gIGluaXRpYWw6ICR7aW5pdGlhbE1lbW9yeX0sXG4gIG1heGltdW06ICR7bWF4aW11bU1lbW9yeX0sXG4gIHNoYXJlZDogdHJ1ZSxcbn0pXG5cbmxldCBfX3dhc21GaWxlUGF0aCA9IF9fbm9kZVBhdGguam9pbihfX2Rpcm5hbWUsICcke3dhc21GaWxlTmFtZX0ud2FzbScpXG5jb25zdCBfX3dhc21EZWJ1Z0ZpbGVQYXRoID0gX19ub2RlUGF0aC5qb2luKF9fZGlybmFtZSwgJyR7d2FzbUZpbGVOYW1lfS5kZWJ1Zy53YXNtJylcblxuaWYgKF9fbm9kZUZzLmV4aXN0c1N5bmMoX193YXNtRGVidWdGaWxlUGF0aCkpIHtcbiAgX193YXNtRmlsZVBhdGggPSBfX3dhc21EZWJ1Z0ZpbGVQYXRoXG59IGVsc2UgaWYgKCFfX25vZGVGcy5leGlzdHNTeW5jKF9fd2FzbUZpbGVQYXRoKSkge1xuICB0cnkge1xuICAgIF9fd2FzbUZpbGVQYXRoID0gcmVxdWlyZS5yZXNvbHZlKCcke3BhY2thZ2VOYW1lfS13YXNtMzItd2FzaS8ke3dhc21GaWxlTmFtZX0ud2FzbScpXG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZpbmQgJHt3YXNtRmlsZU5hbWV9Lndhc20gZmlsZSwgYW5kICR7cGFja2FnZU5hbWV9LXdhc20zMi13YXNpIHBhY2thZ2UgaXMgbm90IGluc3RhbGxlZC4nKVxuICB9XG59XG5cbmNvbnN0IHsgaW5zdGFuY2U6IF9fbmFwaUluc3RhbmNlLCBtb2R1bGU6IF9fd2FzaU1vZHVsZSwgbmFwaU1vZHVsZTogX19uYXBpTW9kdWxlIH0gPSBfX2VtbmFwaUluc3RhbnRpYXRlTmFwaU1vZHVsZVN5bmMoX19ub2RlRnMucmVhZEZpbGVTeW5jKF9fd2FzbUZpbGVQYXRoKSwge1xuICBjb250ZXh0OiBfX2VtbmFwaUNvbnRleHQsXG4gIGFzeW5jV29ya1Bvb2xTaXplOiAoZnVuY3Rpb24oKSB7XG4gICAgY29uc3QgdGhyZWFkc1NpemVGcm9tRW52ID0gTnVtYmVyKHByb2Nlc3MuZW52Lk5BUElfUlNfQVNZTkNfV09SS19QT09MX1NJWkUgPz8gcHJvY2Vzcy5lbnYuVVZfVEhSRUFEUE9PTF9TSVpFKVxuICAgIC8vIE5hTiA+IDAgaXMgZmFsc2VcbiAgICBpZiAodGhyZWFkc1NpemVGcm9tRW52ID4gMCkge1xuICAgICAgcmV0dXJuIHRocmVhZHNTaXplRnJvbUVudlxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gNFxuICAgIH1cbiAgfSkoKSxcbiAgcmV1c2VXb3JrZXI6IHRydWUsXG4gIHdhc2k6IF9fd2FzaSxcbiAgb25DcmVhdGVXb3JrZXIoKSB7XG4gICAgY29uc3Qgd29ya2VyID0gbmV3IFdvcmtlcihfX25vZGVQYXRoLmpvaW4oX19kaXJuYW1lLCAnd2FzaS13b3JrZXIubWpzJyksIHtcbiAgICAgIGVudjogcHJvY2Vzcy5lbnYsXG4gICAgfSlcbiAgICB3b3JrZXIub25tZXNzYWdlID0gKHsgZGF0YSB9KSA9PiB7XG4gICAgICBfX3dhc21DcmVhdGVPbk1lc3NhZ2VGb3JGc1Byb3h5KF9fbm9kZUZzKShkYXRhKVxuICAgIH1cblxuICAgIC8vIFRoZSBtYWluIHRocmVhZCBvZiBOb2RlLmpzIHdhaXRzIGZvciBhbGwgdGhlIGFjdGl2ZSBoYW5kbGVzIGJlZm9yZSBleGl0aW5nLlxuICAgIC8vIEJ1dCBSdXN0IHRocmVhZHMgYXJlIG5ldmVyIHdhaXRlZCB3aXRob3V0IFxcYHRocmVhZDo6am9pblxcYC5cbiAgICAvLyBTbyBoZXJlIHdlIGhhY2sgdGhlIGNvZGUgb2YgTm9kZS5qcyB0byBwcmV2ZW50IHRoZSB3b3JrZXJzIGZyb20gYmVpbmcgcmVmZXJlbmNlZCAoYWN0aXZlKS5cbiAgICAvLyBBY2NvcmRpbmcgdG8gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvMTllMGQ0NzI3MjhjNzlkNDE4Yjc0YmRkZmY1ODhiZWE3MGE0MDNkMC9saWIvaW50ZXJuYWwvd29ya2VyLmpzI0w0MTUsXG4gICAgLy8gYSB3b3JrZXIgaXMgY29uc2lzdCBvZiB0d28gaGFuZGxlczoga1B1YmxpY1BvcnQgYW5kIGtIYW5kbGUuXG4gICAge1xuICAgICAgY29uc3Qga1B1YmxpY1BvcnQgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHdvcmtlcikuZmluZChzID0+XG4gICAgICAgIHMudG9TdHJpbmcoKS5pbmNsdWRlcyhcImtQdWJsaWNQb3J0XCIpXG4gICAgICApO1xuICAgICAgaWYgKGtQdWJsaWNQb3J0KSB7XG4gICAgICAgIHdvcmtlcltrUHVibGljUG9ydF0ucmVmID0gKCkgPT4ge307XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGtIYW5kbGUgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHdvcmtlcikuZmluZChzID0+XG4gICAgICAgIHMudG9TdHJpbmcoKS5pbmNsdWRlcyhcImtIYW5kbGVcIilcbiAgICAgICk7XG4gICAgICBpZiAoa0hhbmRsZSkge1xuICAgICAgICB3b3JrZXJba0hhbmRsZV0ucmVmID0gKCkgPT4ge307XG4gICAgICB9XG5cbiAgICAgIHdvcmtlci51bnJlZigpO1xuICAgIH1cbiAgICByZXR1cm4gd29ya2VyXG4gIH0sXG4gIG92ZXJ3cml0ZUltcG9ydHMoaW1wb3J0T2JqZWN0KSB7XG4gICAgaW1wb3J0T2JqZWN0LmVudiA9IHtcbiAgICAgIC4uLmltcG9ydE9iamVjdC5lbnYsXG4gICAgICAuLi5pbXBvcnRPYmplY3QubmFwaSxcbiAgICAgIC4uLmltcG9ydE9iamVjdC5lbW5hcGksXG4gICAgICBtZW1vcnk6IF9fc2hhcmVkTWVtb3J5LFxuICAgIH1cbiAgICByZXR1cm4gaW1wb3J0T2JqZWN0XG4gIH0sXG4gIGJlZm9yZUluaXQoeyBpbnN0YW5jZSB9KSB7XG4gICAgZm9yIChjb25zdCBuYW1lIG9mIE9iamVjdC5rZXlzKGluc3RhbmNlLmV4cG9ydHMpKSB7XG4gICAgICBpZiAobmFtZS5zdGFydHNXaXRoKCdfX25hcGlfcmVnaXN0ZXJfXycpKSB7XG4gICAgICAgIGluc3RhbmNlLmV4cG9ydHNbbmFtZV0oKVxuICAgICAgfVxuICAgIH1cbiAgfSxcbn0pXG5gXG4iLCJleHBvcnQgY29uc3QgV0FTSV9XT1JLRVJfVEVNUExBVEUgPSBgaW1wb3J0IGZzIGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSBcIm5vZGU6bW9kdWxlXCI7XG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IFdBU0kgfSBmcm9tIFwibm9kZTp3YXNpXCI7XG5pbXBvcnQgeyBwYXJlbnRQb3J0LCBXb3JrZXIgfSBmcm9tIFwibm9kZTp3b3JrZXJfdGhyZWFkc1wiO1xuXG5jb25zdCByZXF1aXJlID0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO1xuXG5jb25zdCB7IGluc3RhbnRpYXRlTmFwaU1vZHVsZVN5bmMsIE1lc3NhZ2VIYW5kbGVyLCBnZXREZWZhdWx0Q29udGV4dCB9ID0gcmVxdWlyZShcIkBuYXBpLXJzL3dhc20tcnVudGltZVwiKTtcblxuaWYgKHBhcmVudFBvcnQpIHtcbiAgcGFyZW50UG9ydC5vbihcIm1lc3NhZ2VcIiwgKGRhdGEpID0+IHtcbiAgICBnbG9iYWxUaGlzLm9ubWVzc2FnZSh7IGRhdGEgfSk7XG4gIH0pO1xufVxuXG5PYmplY3QuYXNzaWduKGdsb2JhbFRoaXMsIHtcbiAgc2VsZjogZ2xvYmFsVGhpcyxcbiAgcmVxdWlyZSxcbiAgV29ya2VyLFxuICBpbXBvcnRTY3JpcHRzOiBmdW5jdGlvbiAoZikge1xuICAgIDsoMCwgZXZhbCkoZnMucmVhZEZpbGVTeW5jKGYsIFwidXRmOFwiKSArIFwiLy8jIHNvdXJjZVVSTD1cIiArIGYpO1xuICB9LFxuICBwb3N0TWVzc2FnZTogZnVuY3Rpb24gKG1zZykge1xuICAgIGlmIChwYXJlbnRQb3J0KSB7XG4gICAgICBwYXJlbnRQb3J0LnBvc3RNZXNzYWdlKG1zZyk7XG4gICAgfVxuICB9LFxufSk7XG5cbmNvbnN0IGVtbmFwaUNvbnRleHQgPSBnZXREZWZhdWx0Q29udGV4dCgpO1xuXG5jb25zdCBfX3Jvb3REaXIgPSBwYXJzZShwcm9jZXNzLmN3ZCgpKS5yb290O1xuXG5jb25zdCBoYW5kbGVyID0gbmV3IE1lc3NhZ2VIYW5kbGVyKHtcbiAgb25Mb2FkKHsgd2FzbU1vZHVsZSwgd2FzbU1lbW9yeSB9KSB7XG4gICAgY29uc3Qgd2FzaSA9IG5ldyBXQVNJKHtcbiAgICAgIHZlcnNpb246ICdwcmV2aWV3MScsXG4gICAgICBlbnY6IHByb2Nlc3MuZW52LFxuICAgICAgcHJlb3BlbnM6IHtcbiAgICAgICAgW19fcm9vdERpcl06IF9fcm9vdERpcixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICByZXR1cm4gaW5zdGFudGlhdGVOYXBpTW9kdWxlU3luYyh3YXNtTW9kdWxlLCB7XG4gICAgICBjaGlsZFRocmVhZDogdHJ1ZSxcbiAgICAgIHdhc2ksXG4gICAgICBjb250ZXh0OiBlbW5hcGlDb250ZXh0LFxuICAgICAgb3ZlcndyaXRlSW1wb3J0cyhpbXBvcnRPYmplY3QpIHtcbiAgICAgICAgaW1wb3J0T2JqZWN0LmVudiA9IHtcbiAgICAgICAgICAuLi5pbXBvcnRPYmplY3QuZW52LFxuICAgICAgICAgIC4uLmltcG9ydE9iamVjdC5uYXBpLFxuICAgICAgICAgIC4uLmltcG9ydE9iamVjdC5lbW5hcGksXG4gICAgICAgICAgbWVtb3J5OiB3YXNtTWVtb3J5XG4gICAgICAgIH07XG4gICAgICB9LFxuICAgIH0pO1xuICB9LFxufSk7XG5cbmdsb2JhbFRoaXMub25tZXNzYWdlID0gZnVuY3Rpb24gKGUpIHtcbiAgaGFuZGxlci5oYW5kbGUoZSk7XG59O1xuYFxuXG5leHBvcnQgY29uc3QgY3JlYXRlV2FzaUJyb3dzZXJXb3JrZXJCaW5kaW5nID0gKFxuICBmczogYm9vbGVhbixcbiAgZXJyb3JFdmVudDogYm9vbGVhbixcbikgPT4ge1xuICBjb25zdCBmc0ltcG9ydCA9IGZzXG4gICAgPyBgaW1wb3J0IHsgaW5zdGFudGlhdGVOYXBpTW9kdWxlU3luYywgTWVzc2FnZUhhbmRsZXIsIFdBU0ksIGNyZWF0ZUZzUHJveHkgfSBmcm9tICdAbmFwaS1ycy93YXNtLXJ1bnRpbWUnXG5pbXBvcnQgeyBtZW1mc0V4cG9ydGVkIGFzIF9fbWVtZnNFeHBvcnRlZCB9IGZyb20gJ0BuYXBpLXJzL3dhc20tcnVudGltZS9mcydcblxuY29uc3QgZnMgPSBjcmVhdGVGc1Byb3h5KF9fbWVtZnNFeHBvcnRlZClgXG4gICAgOiBgaW1wb3J0IHsgaW5zdGFudGlhdGVOYXBpTW9kdWxlU3luYywgTWVzc2FnZUhhbmRsZXIsIFdBU0kgfSBmcm9tICdAbmFwaS1ycy93YXNtLXJ1bnRpbWUnYFxuICBjb25zdCBlcnJvck91dHB1dHNBcHBlbmQgPSBlcnJvckV2ZW50XG4gICAgPyBgXFxuICAgICAgICBlcnJvck91dHB1dHMucHVzaChbLi4uYXJndW1lbnRzXSlgXG4gICAgOiAnJ1xuICBjb25zdCB3YXNpQ3JlYXRpb24gPSBmc1xuICAgID8gYGNvbnN0IHdhc2kgPSBuZXcgV0FTSSh7XG4gICAgICBmcyxcbiAgICAgIHByZW9wZW5zOiB7XG4gICAgICAgICcvJzogJy8nLFxuICAgICAgfSxcbiAgICAgIHByaW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICAgIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cylcbiAgICAgIH0sXG4gICAgICBwcmludEVycjogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICAgIGNvbnNvbGUuZXJyb3IuYXBwbHkoY29uc29sZSwgYXJndW1lbnRzKVxuICAgICAgICAke2Vycm9yT3V0cHV0c0FwcGVuZH1cbiAgICAgIH0sXG4gICAgfSlgXG4gICAgOiBgY29uc3Qgd2FzaSA9IG5ldyBXQVNJKHtcbiAgICAgIHByaW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICAgIGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cylcbiAgICAgIH0sXG4gICAgICBwcmludEVycjogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zb2xlXG4gICAgICAgIGNvbnNvbGUuZXJyb3IuYXBwbHkoY29uc29sZSwgYXJndW1lbnRzKVxuICAgICAgICAke2Vycm9yT3V0cHV0c0FwcGVuZH1cbiAgICAgIH0sXG4gICAgfSlgXG4gIGNvbnN0IGVycm9ySGFuZGxlciA9IGVycm9yRXZlbnRcbiAgICA/IGBvbkVycm9yKGVycm9yKSB7XG4gICAgcG9zdE1lc3NhZ2UoeyB0eXBlOiAnZXJyb3InLCBlcnJvciwgZXJyb3JPdXRwdXRzIH0pXG4gICAgZXJyb3JPdXRwdXRzLmxlbmd0aCA9IDBcbiAgfWBcbiAgICA6ICcnXG4gIGNvbnN0IGVycm9yT3V0cHV0c0RlY2wgPSBlcnJvckV2ZW50ID8gYFxcbmNvbnN0IGVycm9yT3V0cHV0cyA9IFtdXFxuYCA6ICcnXG4gIHJldHVybiBgJHtmc0ltcG9ydH1cbiR7ZXJyb3JPdXRwdXRzRGVjbH1cbmNvbnN0IGhhbmRsZXIgPSBuZXcgTWVzc2FnZUhhbmRsZXIoe1xuICBvbkxvYWQoeyB3YXNtTW9kdWxlLCB3YXNtTWVtb3J5IH0pIHtcbiAgICAke3dhc2lDcmVhdGlvbn1cbiAgICByZXR1cm4gaW5zdGFudGlhdGVOYXBpTW9kdWxlU3luYyh3YXNtTW9kdWxlLCB7XG4gICAgICBjaGlsZFRocmVhZDogdHJ1ZSxcbiAgICAgIHdhc2ksXG4gICAgICBvdmVyd3JpdGVJbXBvcnRzKGltcG9ydE9iamVjdCkge1xuICAgICAgICBpbXBvcnRPYmplY3QuZW52ID0ge1xuICAgICAgICAgIC4uLmltcG9ydE9iamVjdC5lbnYsXG4gICAgICAgICAgLi4uaW1wb3J0T2JqZWN0Lm5hcGksXG4gICAgICAgICAgLi4uaW1wb3J0T2JqZWN0LmVtbmFwaSxcbiAgICAgICAgICBtZW1vcnk6IHdhc21NZW1vcnksXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSlcbiAgfSxcbiAgJHtlcnJvckhhbmRsZXJ9XG59KVxuXG5nbG9iYWxUaGlzLm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChlKSB7XG4gIGhhbmRsZXIuaGFuZGxlKGUpXG59XG5gXG59XG4iLCJpbXBvcnQgeyBzcGF3biB9IGZyb20gJ25vZGU6Y2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdub2RlOmNyeXB0bydcbmltcG9ydCB7IGV4aXN0c1N5bmMsIG1rZGlyU3luYywgcm1TeW5jLCBzdGF0U3luYyB9IGZyb20gJ25vZGU6ZnMnXG5pbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSAnbm9kZTptb2R1bGUnXG5pbXBvcnQgeyBob21lZGlyIH0gZnJvbSAnbm9kZTpvcydcbmltcG9ydCB7IGJhc2VuYW1lLCBwYXJzZSwgam9pbiwgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCdcblxuaW1wb3J0ICogYXMgY29sb3JzIGZyb20gJ2NvbG9yZXR0ZSdcblxuaW1wb3J0IHR5cGUgeyBCdWlsZE9wdGlvbnMgYXMgUmF3QnVpbGRPcHRpb25zIH0gZnJvbSAnLi4vZGVmL2J1aWxkLmpzJ1xuaW1wb3J0IHtcbiAgQ0xJX1ZFUlNJT04sXG4gIGNvcHlGaWxlQXN5bmMsXG4gIHR5cGUgQ3JhdGUsXG4gIGRlYnVnRmFjdG9yeSxcbiAgREVGQVVMVF9UWVBFX0RFRl9IRUFERVIsXG4gIGZpbGVFeGlzdHMsXG4gIGdldFN5c3RlbURlZmF1bHRUYXJnZXQsXG4gIGdldE5hcGlEZXJpdmVEZXBlbmRlbnRDcmF0ZXMsXG4gIGdldFRhcmdldExpbmtlcixcbiAgbWtkaXJBc3luYyxcbiAgdHlwZSBOYXBpQ29uZmlnLFxuICBwYXJzZU1ldGFkYXRhLFxuICBwYXJzZVRyaXBsZSxcbiAgcHJvY2Vzc1R5cGVEZWYsXG4gIHJlYWRGaWxlQXN5bmMsXG4gIHJlYWROYXBpQ29uZmlnLFxuICB0eXBlIFRhcmdldCxcbiAgdGFyZ2V0VG9FbnZWYXIsXG4gIHRyeUluc3RhbGxDYXJnb0JpbmFyeSxcbiAgdW5saW5rQXN5bmMsXG4gIHdyaXRlRmlsZUFzeW5jLFxuICBkaXJFeGlzdHNBc3luYyxcbiAgcmVhZGRpckFzeW5jLFxuICB0eXBlIENhcmdvV29ya3NwYWNlTWV0YWRhdGEsXG59IGZyb20gJy4uL3V0aWxzL2luZGV4LmpzJ1xuXG5pbXBvcnQgeyBjcmVhdGVDanNCaW5kaW5nLCBjcmVhdGVFc21CaW5kaW5nIH0gZnJvbSAnLi90ZW1wbGF0ZXMvaW5kZXguanMnXG5pbXBvcnQge1xuICBjcmVhdGVXYXNpQmluZGluZyxcbiAgY3JlYXRlV2FzaUJyb3dzZXJCaW5kaW5nLFxufSBmcm9tICcuL3RlbXBsYXRlcy9sb2FkLXdhc2ktdGVtcGxhdGUuanMnXG5pbXBvcnQge1xuICBjcmVhdGVXYXNpQnJvd3NlcldvcmtlckJpbmRpbmcsXG4gIFdBU0lfV09SS0VSX1RFTVBMQVRFLFxufSBmcm9tICcuL3RlbXBsYXRlcy93YXNpLXdvcmtlci10ZW1wbGF0ZS5qcydcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ2J1aWxkJylcbmNvbnN0IHJlcXVpcmUgPSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybClcblxudHlwZSBPdXRwdXRLaW5kID0gJ2pzJyB8ICdkdHMnIHwgJ25vZGUnIHwgJ2V4ZScgfCAnd2FzbSdcbnR5cGUgT3V0cHV0ID0geyBraW5kOiBPdXRwdXRLaW5kOyBwYXRoOiBzdHJpbmcgfVxuXG50eXBlIEJ1aWxkT3B0aW9ucyA9IFJhd0J1aWxkT3B0aW9ucyAmIHsgY2FyZ29PcHRpb25zPzogc3RyaW5nW10gfVxudHlwZSBQYXJzZWRCdWlsZE9wdGlvbnMgPSBPbWl0PEJ1aWxkT3B0aW9ucywgJ2N3ZCc+ICYgeyBjd2Q6IHN0cmluZyB9XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidWlsZFByb2plY3QocmF3T3B0aW9uczogQnVpbGRPcHRpb25zKSB7XG4gIGRlYnVnKCduYXBpIGJ1aWxkIGNvbW1hbmQgcmVjZWl2ZSBvcHRpb25zOiAlTycsIHJhd09wdGlvbnMpXG5cbiAgY29uc3Qgb3B0aW9uczogUGFyc2VkQnVpbGRPcHRpb25zID0ge1xuICAgIGR0c0NhY2hlOiB0cnVlLFxuICAgIC4uLnJhd09wdGlvbnMsXG4gICAgY3dkOiByYXdPcHRpb25zLmN3ZCA/PyBwcm9jZXNzLmN3ZCgpLFxuICB9XG5cbiAgLy8gUmVqZWN0IGludmFsaWQgY3Jvc3MtY29tcGlsYXRpb24gZmxhZyBjb21iaW5hdGlvbnMgYmVmb3JlIGFueXRoaW5nIHdpdGhcbiAgLy8gYSBzaWRlIGVmZmVjdCBydW5zIChgY2FyZ28gbWV0YWRhdGFgLCBjYXJnbyBiaW5hcnkgYXV0by1pbnN0YWxscyxcbiAgLy8gdG9vbGNoYWluIGRvd25sb2FkcywgLi4uKSwgc28gdGhlIHVzZXIgYWx3YXlzIGdldHMgdGhlIHZhbGlkYXRpb24gZXJyb3JcbiAgLy8gcmF0aGVyIHRoYW4gYW4gdW5yZWxhdGVkIGZhaWx1cmUgZnJvbSB0aG9zZSBzdGVwcy5cbiAgdmFsaWRhdGVDcm9zc0NvbXBpbGVGbGFncyhvcHRpb25zKVxuICBpZiAob3B0aW9ucy51c2VOYXBpQ3Jvc3MpIHtcbiAgICAvLyBDaGVjayB0aGUgaG9zdCBjb25zdHJhaW50IGJlZm9yZSByZXNvbHZpbmcgdGhlIHRhcmdldDogd2l0aG91dCBhblxuICAgIC8vIGV4cGxpY2l0IGAtLXRhcmdldGAgKG9yIGBDQVJHT19CVUlMRF9UQVJHRVRgKSB0aGUgdGFyZ2V0IHJlc29sdXRpb25cbiAgICAvLyBzcGF3bnMgYHJ1c3RjIC12VmAsIGFuZCBvbiBhbiB1bnN1cHBvcnRlZCBob3N0IHdpdGhvdXQgUnVzdCBvbiB0aGVcbiAgICAvLyBgUEFUSGAgdGhhdCBzcGF3biBmYWlsdXJlIHdvdWxkIG1hc2sgdGhlIGFjdHVhbCB2YWxpZGF0aW9uIGVycm9yLlxuICAgIHZhbGlkYXRlTmFwaUNyb3NzSG9zdCgpXG4gICAgdmFsaWRhdGVOYXBpQ3Jvc3NTdXBwb3J0KHJlc29sdmVUYXJnZXQob3B0aW9ucy50YXJnZXQpLnRyaXBsZSlcbiAgfVxuXG4gIGNvbnN0IHJlc29sdmVQYXRoID0gKC4uLnBhdGhzOiBzdHJpbmdbXSkgPT4gcmVzb2x2ZShvcHRpb25zLmN3ZCwgLi4ucGF0aHMpXG5cbiAgY29uc3QgbWFuaWZlc3RQYXRoID0gcmVzb2x2ZVBhdGgob3B0aW9ucy5tYW5pZmVzdFBhdGggPz8gJ0NhcmdvLnRvbWwnKVxuICBjb25zdCBtZXRhZGF0YSA9IGF3YWl0IHBhcnNlTWV0YWRhdGEobWFuaWZlc3RQYXRoLCB7XG4gICAgZmVhdHVyZXM6IG9wdGlvbnMuZmVhdHVyZXMsXG4gICAgYWxsRmVhdHVyZXM6IG9wdGlvbnMuYWxsRmVhdHVyZXMsXG4gICAgbm9EZWZhdWx0RmVhdHVyZXM6IG9wdGlvbnMubm9EZWZhdWx0RmVhdHVyZXMsXG4gIH0pXG5cbiAgY29uc3QgY3JhdGUgPSBtZXRhZGF0YS5wYWNrYWdlcy5maW5kKChwKSA9PiB7XG4gICAgLy8gcGFja2FnZSB3aXRoIGdpdmVuIG5hbWVcbiAgICBpZiAob3B0aW9ucy5wYWNrYWdlKSB7XG4gICAgICByZXR1cm4gcC5uYW1lID09PSBvcHRpb25zLnBhY2thZ2VcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHAubWFuaWZlc3RfcGF0aCA9PT0gbWFuaWZlc3RQYXRoXG4gICAgfVxuICB9KVxuXG4gIGlmICghY3JhdGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnVW5hYmxlIHRvIGZpbmQgY3JhdGUgdG8gYnVpbGQuIEl0IHNlZW1zIHlvdSBhcmUgdHJ5aW5nIHRvIGJ1aWxkIGEgY3JhdGUgaW4gYSB3b3Jrc3BhY2UsIHRyeSB1c2luZyBgLS1wYWNrYWdlYCBvcHRpb24gdG8gc3BlY2lmeSB0aGUgcGFja2FnZSB0byBidWlsZC4nLFxuICAgIClcbiAgfVxuICBjb25zdCBjb25maWcgPSBhd2FpdCByZWFkTmFwaUNvbmZpZyhcbiAgICByZXNvbHZlUGF0aChvcHRpb25zLnBhY2thZ2VKc29uUGF0aCA/PyAncGFja2FnZS5qc29uJyksXG4gICAgb3B0aW9ucy5jb25maWdQYXRoID8gcmVzb2x2ZVBhdGgob3B0aW9ucy5jb25maWdQYXRoKSA6IHVuZGVmaW5lZCxcbiAgKVxuXG4gIGNvbnN0IGJ1aWxkZXIgPSBuZXcgQnVpbGRlcihtZXRhZGF0YSwgY3JhdGUsIGNvbmZpZywgb3B0aW9ucylcblxuICByZXR1cm4gYnVpbGRlci5idWlsZCgpXG59XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgdGFyZ2V0IHRyaXBsZSB0aGUgYnVpbGQgd2lsbCBydW4gYWdhaW5zdCwgZm9sbG93aW5nIHRoZSBzYW1lXG4gKiBwcmVjZWRlbmNlIHRoZSBidWlsZCBpdHNlbGYgdXNlczogdGhlIGV4cGxpY2l0IGAtLXRhcmdldGAgb3B0aW9uLCB0aGVuIHRoZVxuICogYENBUkdPX0JVSUxEX1RBUkdFVGAgZW52aXJvbm1lbnQgdmFyaWFibGUsIHRoZW4gdGhlIGhvc3QgZGVmYXVsdCB0YXJnZXQuXG4gKi9cbmZ1bmN0aW9uIHJlc29sdmVUYXJnZXQodGFyZ2V0T3B0aW9uPzogc3RyaW5nKTogVGFyZ2V0IHtcbiAgcmV0dXJuIHRhcmdldE9wdGlvblxuICAgID8gcGFyc2VUcmlwbGUodGFyZ2V0T3B0aW9uKVxuICAgIDogcHJvY2Vzcy5lbnYuQ0FSR09fQlVJTERfVEFSR0VUXG4gICAgICA/IHBhcnNlVHJpcGxlKHByb2Nlc3MuZW52LkNBUkdPX0JVSUxEX1RBUkdFVClcbiAgICAgIDogZ2V0U3lzdGVtRGVmYXVsdFRhcmdldCgpXG59XG5cbi8qKlxuICogVmFsaWRhdGUgdGhlIGNvbWJpbmF0aW9uIG9mIHRoZSBjcm9zcy1jb21waWxhdGlvbiByZWxhdGVkIGZsYWdzLlxuICpcbiAqIGAtLXVzZS1jcm9zc2AsIGAtLXVzZS1uYXBpLWNyb3NzYCBhbmQgYC0tY3Jvc3MtY29tcGlsZWAgKGAteGApIGFyZSB0aHJlZVxuICogbXV0dWFsbHkgZXhjbHVzaXZlIGNyb3NzLWNvbXBpbGF0aW9uIG1lY2hhbmlzbXM7IGNvbWJpbmluZyBhbnkgdHdvIG9mIHRoZW1cbiAqIGxlYXZlcyBib3RoIGFjdGl2ZSBhdCBvbmNlIGFuZCBwcm9kdWNlcyBicm9rZW4gYnVpbGRzLCBzbyBpdCBpcyByZWplY3RlZFxuICogdXBmcm9udCBiZWZvcmUgYW55IHNpZGUgZWZmZWN0IChsaWtlIGF1dG8taW5zdGFsbGluZyBjYXJnbyBiaW5hcmllcyBvclxuICogZG93bmxvYWRpbmcgdG9vbGNoYWlucykgaGFwcGVucy5cbiAqXG4gKiBgLS1jcm9zcy1jb21waWxlYCB3aXRoIGEgYHdpbmRvd3MtZ251YCB0YXJnZXQgaXMgcmVqZWN0ZWQgYXMgd2VsbDogb24gYVxuICogbm9uLVdpbmRvd3MgaG9zdCBpdCByb3V0ZXMgdGhlIGJ1aWxkIHRvIGBjYXJnbyB4d2luIGJ1aWxkYCwgYnV0XG4gKiBgY2FyZ28teHdpbmAgb25seSBzZXRzIHVwIE1TVkMgdG9vbGNoYWlucyDigJQgZm9yIGB3aW5kb3dzLWdudWAgdGFyZ2V0cyBpdFxuICogc2lsZW50bHkgZG9lcyBub3RoaW5nIGFuZCB0aGUgYnVpbGQgZGllcyBtdWNoIGxhdGVyIHdpdGggYSBjcnlwdGljXG4gKiBgYGVycm9yOiBsaW5rZXIgYHg4Nl82NC13NjQtbWluZ3czMi1nY2NgIG5vdCBmb3VuZGBgIHRoYXQgbmV2ZXIgbWVudGlvbnNcbiAqIGBjYXJnby14d2luYC4gT25seSBhbiBleHBsaWNpdGx5IHJlcXVlc3RlZCB0YXJnZXQgKGAtLXRhcmdldGAgb3JcbiAqIGBDQVJHT19CVUlMRF9UQVJHRVRgKSBpcyBpbnNwZWN0ZWQsIHNvIHRoaXMgdmFsaWRhdGlvbiBuZXZlciBoYXMgdG8gc3Bhd25cbiAqIGBydXN0YyAtdlZgOyBhIG5vbi1XaW5kb3dzIGhvc3QncyBkZWZhdWx0IHRhcmdldCBjYW4gbmV2ZXIgYmVcbiAqIGB3aW5kb3dzLWdudWAgYW55d2F5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVDcm9zc0NvbXBpbGVGbGFncyhcbiAgb3B0aW9uczoge1xuICAgIHVzZUNyb3NzPzogYm9vbGVhblxuICAgIGNyb3NzQ29tcGlsZT86IGJvb2xlYW5cbiAgICB1c2VOYXBpQ3Jvc3M/OiBib29sZWFuXG4gICAgd2F0Y2g/OiBib29sZWFuXG4gICAgdGFyZ2V0Pzogc3RyaW5nXG4gIH0sXG4gIGhvc3RQbGF0Zm9ybTogc3RyaW5nID0gcHJvY2Vzcy5wbGF0Zm9ybSxcbik6IHZvaWQge1xuICBjb25zdCBlbmFibGVkQ3Jvc3NGbGFncyA9IFtcbiAgICBvcHRpb25zLnVzZUNyb3NzID8gJ2AtLXVzZS1jcm9zc2AnIDogbnVsbCxcbiAgICBvcHRpb25zLnVzZU5hcGlDcm9zcyA/ICdgLS11c2UtbmFwaS1jcm9zc2AnIDogbnVsbCxcbiAgICBvcHRpb25zLmNyb3NzQ29tcGlsZSA/ICdgLS1jcm9zcy1jb21waWxlYCAoYC14YCknIDogbnVsbCxcbiAgXS5maWx0ZXIoKGZsYWcpOiBmbGFnIGlzIHN0cmluZyA9PiBmbGFnICE9PSBudWxsKVxuXG4gIGlmIChlbmFibGVkQ3Jvc3NGbGFncy5sZW5ndGggPiAxKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYCR7ZW5hYmxlZENyb3NzRmxhZ3Muam9pbignIGFuZCAnKX0gY2Fubm90IGJlIHVzZWQgdG9nZXRoZXIuIFBsZWFzZSBwaWNrIGV4YWN0bHkgb25lIGNyb3NzLWNvbXBpbGF0aW9uIG1lY2hhbmlzbTogXFxgLS11c2UtY3Jvc3NcXGAsIFxcYC0tdXNlLW5hcGktY3Jvc3NcXGAsIG9yIFxcYC0tY3Jvc3MtY29tcGlsZVxcYCAoXFxgLXhcXGApLmAsXG4gICAgKVxuICB9XG5cbiAgaWYgKG9wdGlvbnMud2F0Y2ggJiYgb3B0aW9ucy51c2VDcm9zcykge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdgLS13YXRjaGAgY2Fubm90IGJlIHVzZWQgd2l0aCBgLS11c2UtY3Jvc3NgLiBgY2FyZ28gd2F0Y2hgIG9ubHkgc3VwcG9ydHMgdGhlIHBsYWluIGBjYXJnbyBidWlsZGAgZmxvdywgcGxlYXNlIGRyb3Agb25lIG9mIHRoZSB0d28gZmxhZ3MuJyxcbiAgICApXG4gIH1cblxuICBpZiAob3B0aW9ucy53YXRjaCAmJiBvcHRpb25zLmNyb3NzQ29tcGlsZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdgLS13YXRjaGAgY2Fubm90IGJlIHVzZWQgd2l0aCBgLS1jcm9zcy1jb21waWxlYCAoYC14YCkuIGBjYXJnbyB3YXRjaGAgb25seSBzdXBwb3J0cyB0aGUgcGxhaW4gYGNhcmdvIGJ1aWxkYCBmbG93LCBwbGVhc2UgZHJvcCBvbmUgb2YgdGhlIHR3byBmbGFncy4nLFxuICAgIClcbiAgfVxuXG4gIC8vIE9uIGEgV2luZG93cyBob3N0IGAtLWNyb3NzLWNvbXBpbGVgIG5ldmVyIHBpY2tzIGBjYXJnby14d2luYCAoaXQgZmFsbHNcbiAgLy8gYmFjayB0byBhIHBsYWluIGBjYXJnbyBidWlsZGApLCBzbyB3aW5kb3dzLWdudSB0YXJnZXRzIGFyZSBvbmx5IGJyb2tlblxuICAvLyBvbiBub24tV2luZG93cyBob3N0cy5cbiAgaWYgKG9wdGlvbnMuY3Jvc3NDb21waWxlICYmIGhvc3RQbGF0Zm9ybSAhPT0gJ3dpbjMyJykge1xuICAgIGNvbnN0IGV4cGxpY2l0VGFyZ2V0ID0gb3B0aW9ucy50YXJnZXQgPz8gcHJvY2Vzcy5lbnYuQ0FSR09fQlVJTERfVEFSR0VUXG4gICAgaWYgKGV4cGxpY2l0VGFyZ2V0KSB7XG4gICAgICBjb25zdCB0YXJnZXQgPSBwYXJzZVRyaXBsZShleHBsaWNpdFRhcmdldClcbiAgICAgIGlmICh0YXJnZXQucGxhdGZvcm0gPT09ICd3aW4zMicgJiYgdGFyZ2V0LmFiaT8uc3RhcnRzV2l0aCgnZ251JykpIHtcbiAgICAgICAgY29uc3QgbXN2Y1RyaXBsZSA9IGV4cGxpY2l0VGFyZ2V0LnJlcGxhY2UoL2dudShsbHZtKT8kLywgJ21zdmMnKVxuICAgICAgICAvLyBgKi13aW5kb3dzLWdudWAgbGlua3Mgd2l0aCBhIG1pbmd3LXc2NCBHQ0MgdG9vbGNoYWluLCB3aGlsZVxuICAgICAgICAvLyBgKi13aW5kb3dzLWdudWxsdm1gIG5lZWRzIGFuIExMVk0gdG9vbGNoYWluIChsbHZtLW1pbmd3KTogYHJ1c3RjYFxuICAgICAgICAvLyBoYXMgbm8gZGVmYXVsdCB3b3JraW5nIGxpbmtlciBmb3IgaXQgd2l0aG91dCBvbmUgb24gdGhlIGBQQVRIYC5cbiAgICAgICAgY29uc3QgdG9vbGNoYWluSGludCA9XG4gICAgICAgICAgdGFyZ2V0LmFiaSA9PT0gJ2dudWxsdm0nXG4gICAgICAgICAgICA/IGBhbiBsbHZtLW1pbmd3IChMTFZNL0NsYW5nKSB0b29sY2hhaW4gb24gdGhlIFxcYFBBVEhcXGAgKFxcYHJ1c3RjXFxgIGhhcyBubyBkZWZhdWx0IHdvcmtpbmcgbGlua2VyIGZvciAke2V4cGxpY2l0VGFyZ2V0fSB3aXRob3V0IG9uZTsgXFxgbmFwaS1idWlsZFxcYCBhZGRpdGlvbmFsbHkgbmVlZHMgXFxgbGlibm9kZS5kbGxcXGAgdmlhIHRoZSBcXGBMSUJOT0RFX1BBVEhcXGAgZW52aXJvbm1lbnQgdmFyaWFibGUpYFxuICAgICAgICAgICAgOiBgYSBtaW5ndy13NjQgdG9vbGNoYWluIChcXGBydXN0Y1xcYCB1c2VzIHRoZSBcXGAke2V4cGxpY2l0VGFyZ2V0LnNwbGl0KCctJylbMF19LXc2NC1taW5ndzMyLWdjY1xcYCBsaW5rZXI7IFxcYG5hcGktYnVpbGRcXGAgYWRkaXRpb25hbGx5IG5lZWRzIFxcYGxpYm5vZGUuZGxsXFxgIHZpYSB0aGUgXFxgTElCTk9ERV9QQVRIXFxgIGVudmlyb25tZW50IHZhcmlhYmxlKWBcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBcXGAtLWNyb3NzLWNvbXBpbGVcXGAgKFxcYC14XFxgKSBkb2VzIG5vdCBzdXBwb3J0IHRoZSB0YXJnZXQgJHtleHBsaWNpdFRhcmdldH06IFxcYGNhcmdvLXh3aW5cXGAgb25seSBoYW5kbGVzIE1TVkMgdGFyZ2V0cyBhbmQgdGhlIGJ1aWxkIHdvdWxkIGZhaWwgYXQgbGluayB0aW1lLiBEcm9wIFxcYC14XFxgIGFuZCBidWlsZCB3aXRoICR7dG9vbGNoYWluSGludH0sIG9yIHRhcmdldCAke21zdmNUcmlwbGV9IGluc3RlYWQuYCxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFZhbGlkYXRlIHRoYXQgdGhlIGN1cnJlbnQgaG9zdCBjYW4gcnVuIHRoZSBgQG5hcGktcnMvY3Jvc3MtdG9vbGNoYWluYFxuICogcHJlLWJ1aWx0IHRvb2xjaGFpbnMgYXQgYWxsOiB0aGV5IG9ubHkgcnVuIG9uIExpbnV4IHg2NCBhbmQgTGludXggYXJtNjRcbiAqIGhvc3RzLiBUaGlzIGNoZWNrIGlzIHNlcGFyYXRlIGZyb20gKGFuZCBtdXN0IHJ1biBiZWZvcmUpIHRoZSBwZXItdGFyZ2V0XG4gKiB2YWxpZGF0aW9uLCBiZWNhdXNlIHJlc29sdmluZyB0aGUgdGFyZ2V0IG1heSBuZWVkIHRvIHNwYXduIGBydXN0Y2AuXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlTmFwaUNyb3NzSG9zdChcbiAgaG9zdFBsYXRmb3JtOiBzdHJpbmcgPSBwcm9jZXNzLnBsYXRmb3JtLFxuICBob3N0QXJjaDogc3RyaW5nID0gcHJvY2Vzcy5hcmNoLFxuKTogYXNzZXJ0cyBob3N0QXJjaCBpcyAneDY0JyB8ICdhcm02NCcge1xuICBpZiAoXG4gICAgaG9zdFBsYXRmb3JtICE9PSAnbGludXgnIHx8XG4gICAgKGhvc3RBcmNoICE9PSAneDY0JyAmJiBob3N0QXJjaCAhPT0gJ2FybTY0JylcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFxcYC0tdXNlLW5hcGktY3Jvc3NcXGAgcmVxdWlyZXMgYSBMaW51eCB4NjQgb3IgTGludXggYXJtNjQgaG9zdCwgYnV0IHRoZSBjdXJyZW50IGhvc3QgaXMgJHtob3N0UGxhdGZvcm19LSR7aG9zdEFyY2h9LiBQbGVhc2UgdXNlIFxcYC0tY3Jvc3MtY29tcGlsZVxcYCAoXFxgLXhcXGApIG9yIFxcYC0tdXNlLWNyb3NzXFxgIHRvIGNyb3NzIGNvbXBpbGUgb24gdGhpcyBob3N0LmAsXG4gICAgKVxuICB9XG59XG5cbi8qKlxuICogVmFsaWRhdGUgdGhhdCBgLS11c2UtbmFwaS1jcm9zc2AgY2FuIGFjdHVhbGx5IGhhbmRsZSB0aGUgcmVxdWVzdGVkIHRhcmdldFxuICogb24gdGhlIGN1cnJlbnQgaG9zdC4gVGhlIHN1cHBvcnRlZCB0YXJnZXQgc2V0IGlzIHJlYWQgZnJvbSB0aGVcbiAqIGBAbmFwaS1ycy9jcm9zcy10b29sY2hhaW5gIHBhY2thZ2UsIGFuZCB0aGUgcHJlLWJ1aWx0IHRvb2xjaGFpbnMgb25seSBydW5cbiAqIG9uIExpbnV4IHg2NCBhbmQgTGludXggYXJtNjQgaG9zdHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZU5hcGlDcm9zc1N1cHBvcnQoXG4gIHRhcmdldFRyaXBsZTogc3RyaW5nLFxuICBob3N0UGxhdGZvcm06IHN0cmluZyA9IHByb2Nlc3MucGxhdGZvcm0sXG4gIGhvc3RBcmNoOiBzdHJpbmcgPSBwcm9jZXNzLmFyY2gsXG4pOiB2b2lkIHtcbiAgdmFsaWRhdGVOYXBpQ3Jvc3NIb3N0KGhvc3RQbGF0Zm9ybSwgaG9zdEFyY2gpXG5cbiAgY29uc3QgdG9vbGNoYWluczogUmVjb3JkPFxuICAgICd4NjQnIHwgJ2FybTY0JyxcbiAgICBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCB1bmRlZmluZWQ+XG4gID4gPSByZXF1aXJlKCdAbmFwaS1ycy9jcm9zcy10b29sY2hhaW4nKVxuICBjb25zdCBzdXBwb3J0ZWRUYXJnZXRzID0gT2JqZWN0LmtleXModG9vbGNoYWluc1tob3N0QXJjaF0pXG5cbiAgaWYgKCFzdXBwb3J0ZWRUYXJnZXRzLmluY2x1ZGVzKHRhcmdldFRyaXBsZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgXFxgLS11c2UtbmFwaS1jcm9zc1xcYCBkb2VzIG5vdCBzdXBwb3J0IHRoZSB0YXJnZXQgJHt0YXJnZXRUcmlwbGV9LiBTdXBwb3J0ZWQgdGFyZ2V0czogJHtzdXBwb3J0ZWRUYXJnZXRzLmpvaW4oJywgJyl9LiBQbGVhc2UgdXNlIFxcYC0tY3Jvc3MtY29tcGlsZVxcYCAoXFxgLXhcXGApIG9yIFxcYC0tdXNlLWNyb3NzXFxgIGZvciB0aGlzIHRhcmdldC5gLFxuICAgIClcbiAgfVxufVxuXG4vKipcbiAqIENvbXB1dGUgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlcyB0aGF0IHJvdXRlIGEgYC0tdXNlLW5hcGktY3Jvc3NgIGJ1aWxkXG4gKiB0aHJvdWdoIHRoZSBgQG5hcGktcnMvY3Jvc3MtdG9vbGNoYWluYCB0b29sY2hhaW4gZXh0cmFjdGVkIGF0XG4gKiBgdG9vbGNoYWluUGF0aGAuXG4gKlxuICogRm9sbG93cyB0aGUgc2FtZSBydWxlIGFzIGBCdWlsZGVyI3NldEVudklmTm90RXhpc3RzYDogYSB2YXJpYWJsZSB0aGUgdXNlclxuICogYWxyZWFkeSBzZXQgaW4gYGVudmAgd2lucyBhbmQgaXMgbm90IHJldHVybmVkLCBhbmQgYSBwcmVzZW50LWJ1dC1lbXB0eVxuICogdmFyaWFibGUgY291bnRzIGFzIHVuc2V0IChmYWxzeSBzZW1hbnRpY3MpLiBUaGUgb25seSBleGNlcHRpb25zIGFyZSB0aGVcbiAqIGNsYW5nLXNwZWNpZmljIGBUQVJHRVRfQ0ZMQUdTYC9gVEFSR0VUX0NYWEZMQUdTYCwgd2hpY2ggcHJlcGVuZCB0aGUgc3lzcm9vdFxuICogZmxhZ3MgdG8gdGhlIHVzZXIncyB2YWx1ZSwgYW5kIGBQQVRIYCwgd2hpY2ggYWx3YXlzIGdldHMgdGhlIHRvb2xjaGFpblxuICogYGJpbmAgZGlyZWN0b3J5IHByZXBlbmRlZC5cbiAqXG4gKiBFeHBvcnRlZCBmb3IgdGVzdHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBuYXBpQ3Jvc3NUb29sY2hhaW5FbnZzKFxuICB0b29sY2hhaW5QYXRoOiBzdHJpbmcsXG4gIHRhcmdldFRyaXBsZTogc3RyaW5nLFxuICBlbnY6IE5vZGVKUy5Qcm9jZXNzRW52ID0gcHJvY2Vzcy5lbnYsXG4pOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHtcbiAgY29uc3QgYWxpYXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgJ3MzOTB4LXVua25vd24tbGludXgtZ251JzogJ3MzOTB4LWlibS1saW51eC1nbnUnLFxuICB9XG5cbiAgY29uc3QgZW52czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9XG4gIGNvbnN0IHNldEVudklmTm90RXhpc3RzID0gKG5hbWU6IHN0cmluZywgdmFsdWU6IHN0cmluZykgPT4ge1xuICAgIGlmICghZW52W25hbWVdKSB7XG4gICAgICBlbnZzW25hbWVdID0gdmFsdWVcbiAgICB9XG4gIH1cblxuICBjb25zdCB1cHBlckNhc2VUYXJnZXQgPSB0YXJnZXRUb0VudlZhcih0YXJnZXRUcmlwbGUpXG4gIGNvbnN0IGNyb3NzVGFyZ2V0TmFtZSA9IGFsaWFzW3RhcmdldFRyaXBsZV0gPz8gdGFyZ2V0VHJpcGxlXG4gIHNldEVudklmTm90RXhpc3RzKFxuICAgIGBDQVJHT19UQVJHRVRfJHt1cHBlckNhc2VUYXJnZXR9X0xJTktFUmAsXG4gICAgam9pbih0b29sY2hhaW5QYXRoLCAnYmluJywgYCR7Y3Jvc3NUYXJnZXROYW1lfS1nY2NgKSxcbiAgKVxuICBzZXRFbnZJZk5vdEV4aXN0cyhcbiAgICAnVEFSR0VUX1NZU1JPT1QnLFxuICAgIGpvaW4odG9vbGNoYWluUGF0aCwgY3Jvc3NUYXJnZXROYW1lLCAnc3lzcm9vdCcpLFxuICApXG4gIHNldEVudklmTm90RXhpc3RzKFxuICAgICdUQVJHRVRfQVInLFxuICAgIGpvaW4odG9vbGNoYWluUGF0aCwgJ2JpbicsIGAke2Nyb3NzVGFyZ2V0TmFtZX0tYXJgKSxcbiAgKVxuICBzZXRFbnZJZk5vdEV4aXN0cyhcbiAgICAnVEFSR0VUX1JBTkxJQicsXG4gICAgam9pbih0b29sY2hhaW5QYXRoLCAnYmluJywgYCR7Y3Jvc3NUYXJnZXROYW1lfS1yYW5saWJgKSxcbiAgKVxuICBzZXRFbnZJZk5vdEV4aXN0cyhcbiAgICAnVEFSR0VUX1JFQURFTEYnLFxuICAgIGpvaW4odG9vbGNoYWluUGF0aCwgJ2JpbicsIGAke2Nyb3NzVGFyZ2V0TmFtZX0tcmVhZGVsZmApLFxuICApXG4gIHNldEVudklmTm90RXhpc3RzKFxuICAgICdUQVJHRVRfQ19JTkNMVURFX1BBVEgnLFxuICAgIGpvaW4odG9vbGNoYWluUGF0aCwgY3Jvc3NUYXJnZXROYW1lLCAnc3lzcm9vdCcsICd1c3InLCAnaW5jbHVkZS8nKSxcbiAgKVxuICBzZXRFbnZJZk5vdEV4aXN0cyhcbiAgICAnVEFSR0VUX0NDJyxcbiAgICBqb2luKHRvb2xjaGFpblBhdGgsICdiaW4nLCBgJHtjcm9zc1RhcmdldE5hbWV9LWdjY2ApLFxuICApXG4gIHNldEVudklmTm90RXhpc3RzKFxuICAgICdUQVJHRVRfQ1hYJyxcbiAgICBqb2luKHRvb2xjaGFpblBhdGgsICdiaW4nLCBgJHtjcm9zc1RhcmdldE5hbWV9LWcrK2ApLFxuICApXG4gIC8vIGBzZXRFbnZJZk5vdEV4aXN0c2Agc2tpcHMgYGVudnNgIHdoZW4gdGhlIHVzZXIgYWxyZWFkeSBzZXQgdGhlIHZhcmlhYmxlXG4gIC8vIGluIHRoZWlyIGVudmlyb25tZW50LCBzbyByZWFkIHRoZSBlZmZlY3RpdmUgdmFsdWUgYmFjayBmcm9tIGBlbnZgIGZpcnN0XG4gIC8vIOKAlCB3aXRoIHRoZSBzYW1lIGZhbHN5IHNlbWFudGljczogYSBwcmVzZW50LWJ1dC1lbXB0eSBgVEFSR0VUX1NZU1JPT1RgXG4gIC8vIGNvdW50cyBhcyB1bnNldCBhbmQgZmFsbHMgYmFjayB0byB0aGUgZG93bmxvYWRlZCBzeXNyb290IChgPz9gIHdvdWxkXG4gIC8vIGtlZXAgdGhlIGVtcHR5IHN0cmluZyBhbmQgcHJvZHVjZSBhIGJyb2tlbiBgLS1zeXNyb290PWApLlxuICBjb25zdCB0YXJnZXRTeXNyb290ID0gZW52LlRBUkdFVF9TWVNST09UIHx8IGVudnMuVEFSR0VUX1NZU1JPT1RcbiAgc2V0RW52SWZOb3RFeGlzdHMoJ0JJTkRHRU5fRVhUUkFfQ0xBTkdfQVJHUycsIGAtLXN5c3Jvb3Q9JHt0YXJnZXRTeXNyb290fWApXG5cbiAgLy8gY2MtcnMgcGFyc2VzIHRoZSBlbnYgdmFsdWUgYmVmb3JlIGV4ZWN1dGluZyBpdCAoYGVudl90b29sYCBpbiBjYydzXG4gIC8vIGxpYi5ycyk6IHdoZW4gdGhlIFdIT0xFIHZhbHVlIGV4aXN0cyBvbiB0aGUgZmlsZXN5c3RlbSAoYGNoZWNrX2V4ZWApXG4gIC8vIGl0IGlzIHRoZSBjb21waWxlciBhcy1pcyDigJQgdGhhdCBpcyBob3cgaXQgc3VwcG9ydHMgc3BhY2VzIGluIHBhdGhzXG4gIC8vIGxpa2UgYC9vcHQvTExWTSAxOC9iaW4vY2xhbmdgIOKAlCBhbmQgb25seSBvdGhlcndpc2UgaXMgdGhlIHZhbHVlIHNwbGl0XG4gIC8vIG9uIHdoaXRlc3BhY2U7IHRoZW4sIHdoZW4gdGhlIGZpcnN0IHRva2VuIGlzIGEga25vd24gd3JhcHBlclxuICAvLyAoYHNjY2FjaGUgY2xhbmdgKSB0aGUgc2Vjb25kIHRva2VuIGlzIHRoZSBjb21waWxlciB0aGF0IGFjdHVhbGx5IHJ1bnMsXG4gIC8vIG90aGVyd2lzZSB0aGUgZmlyc3QgdG9rZW4gaXMgYW5kIHRoZSByZXN0IGFyZSBhcmd1bWVudHNcbiAgLy8gKGBjbGFuZyAtdGFyZ2V0IOKApmApLiBNaXJyb3IgdGhhdCBvcmRlcmluZywgZmlsZXN5c3RlbSBwcm9iZSBpbmNsdWRlZDpcbiAgLy8gYSBwdXJlIHdob2xlLXZhbHVlIGJhc2VuYW1lIGhldXJpc3RpYyB3b3VsZCBtaXNyZWFkIGFyZ3VtZW50IGZvcm1zXG4gIC8vIHRoYXQgbWVyZWx5IEVORCBpbiBgY2xhbmdgLCBsaWtlIGBnY2MgLS1zeXNyb290PS9vcHQvY2xhbmdgLCBhbmRcbiAgLy8gaW5qZWN0IGNsYW5nLW9ubHkgZmxhZ3MgaW50byBhIGdjYyBjb21waWxlLiBNYXRjaCBvbiB0aGUgZXhlY3V0YWJsZVxuICAvLyBuYW1lIHNvIHBhdGgtcXVhbGlmaWVkIChgL3Vzci9iaW4vY2xhbmdgKSwgdHJpcGxlLXByZWZpeGVkXG4gIC8vIChgYWFyY2g2NC1saW51eC1nbnUtY2xhbmdgKSBhbmQgdmVyc2lvbmVkIChgY2xhbmctMThgKSBjb21waWxlcnMgYXJlXG4gIC8vIGFsbCByZWNvZ25pemVkIOKAlCBidXQgbm90IGNsYW5nLWZhbWlseSB0b29scyB0aGF0IGFyZSBub3QgY29tcGlsZXJzXG4gIC8vIChgY2xhbmctZm9ybWF0YCkuXG4gIGNvbnN0IGNjV3JhcHBlcnMgPSBuZXcgU2V0KFtcbiAgICAnY2NhY2hlJyxcbiAgICAnZGlzdGNjJyxcbiAgICAnc2NjYWNoZScsXG4gICAgJ2ljZWNjJyxcbiAgICAnY2FjaGVwb3QnLFxuICAgICdidWlsZGNhY2hlJyxcbiAgICAna2FjaGUnLFxuICBdKVxuICBjb25zdCBjbGFuZ0V4ZWN1dGFibGVOYW1lID0gLyhefC0pY2xhbmcoXFwrXFwrKT8oLVxcZCspPyQvXG4gIC8vIGNjLXJzJ3MgYGNoZWNrX2V4ZWAgb25seSBwcm9iZXMgZm9yIGV4aXN0ZW5jZSAocGx1cyBhbiBgLmV4ZWAgcmV0cnkgb25cbiAgLy8gV2luZG93cywgd2hlcmUgdGhpcyBuYXBpLWNyb3NzIHBhdGggbmV2ZXIgcnVucyk7IHJlcXVpcmluZyBhIHJlZ3VsYXJcbiAgLy8gZmlsZSBhZGRpdGlvbmFsbHkga2VlcHMgZGlyZWN0b3JpZXMgZnJvbSBiZWluZyB0YWtlbiBmb3IgY29tcGlsZXJzLlxuICBjb25zdCBpc0V4aXN0aW5nRmlsZSA9IChwYXRoOiBzdHJpbmcpOiBib29sZWFuID0+IHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHN0YXRTeW5jKHBhdGgsIHsgdGhyb3dJZk5vRW50cnk6IGZhbHNlIH0pPy5pc0ZpbGUoKSA/PyBmYWxzZVxuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9XG4gIGNvbnN0IGlzQ2xhbmdDb21waWxlciA9ICh2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogYm9vbGVhbiA9PiB7XG4gICAgaWYgKCF2YWx1ZSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKClcbiAgICBpZiAoaXNFeGlzdGluZ0ZpbGUodHJpbW1lZCkpIHtcbiAgICAgIHJldHVybiBjbGFuZ0V4ZWN1dGFibGVOYW1lLnRlc3QoYmFzZW5hbWUodHJpbW1lZCkpXG4gICAgfVxuICAgIGNvbnN0IFtmaXJzdCwgc2Vjb25kXSA9IHRyaW1tZWQuc3BsaXQoL1xccysvKVxuICAgIGNvbnN0IGNvbXBpbGVyID0gZmlyc3QgJiYgY2NXcmFwcGVycy5oYXMoYmFzZW5hbWUoZmlyc3QpKSA/IHNlY29uZCA6IGZpcnN0XG4gICAgcmV0dXJuIChcbiAgICAgIGNvbXBpbGVyICE9PSB1bmRlZmluZWQgJiYgY2xhbmdFeGVjdXRhYmxlTmFtZS50ZXN0KGJhc2VuYW1lKGNvbXBpbGVyKSlcbiAgICApXG4gIH1cblxuICAvLyBEZXRlY3QgY2xhbmcgb24gdGhlIEVGRkVDVElWRSB0YXJnZXQgY29tcGlsZXI6IHRoZSB1c2VyJ3MgVEFSR0VUX0NDIGlmXG4gIC8vIHNldCwgb3RoZXJ3aXNlIHRoZSB0b29sY2hhaW4gZ2NjIGV4cG9ydGVkIGFib3ZlIChgZW52cy5UQVJHRVRfQ0NgKS5cbiAgLy8gY2MtcnMgcHJlZmVycyBUQVJHRVRfQ0Mgb3ZlciBDQyBmb3IgY3Jvc3MgYnVpbGRzLCBzbyBhIHBsYWluIGBDQz1jbGFuZ2BcbiAgLy8gbmV2ZXIgcnVucyBoZXJlIGFuZCBtdXN0IG5vdCB0cmlnZ2VyIHRoZSBjbGFuZy1vbmx5IGAtLWdjYy10b29sY2hhaW49YFxuICAvLyBmbGFnIChnY2MgaGFyZC1lcnJvcnMgb24gaXQpLiBUaGUgdHJhaWxpbmcgYGVudi5DQ2AvYGVudi5DWFhgIHRlcm1zIGFyZVxuICAvLyB1bnJlYWNoYWJsZSB0b2RheSAoZXhhY3RseSBvbmUgb2YgdGhlIGZpcnN0IHR3byBpcyBhbHdheXMgdHJ1dGh5KSBidXRcbiAgLy8ga2VlcCB0aGUgY2hlY2sgY29ycmVjdCBpZiB0aGUgdG9vbGNoYWluIGRlZmF1bHQgZXZlciBiZWNvbWVzIGNvbmRpdGlvbmFsLlxuICBpZiAoaXNDbGFuZ0NvbXBpbGVyKGVudi5UQVJHRVRfQ0MgfHwgZW52cy5UQVJHRVRfQ0MgfHwgZW52LkNDKSkge1xuICAgIGNvbnN0IFRBUkdFVF9DRkxBR1MgPSBlbnYuVEFSR0VUX0NGTEFHUyB8fCAnJ1xuICAgIGVudnMuVEFSR0VUX0NGTEFHUyA9IGAtLXN5c3Jvb3Q9JHt0YXJnZXRTeXNyb290fSAtLWdjYy10b29sY2hhaW49JHt0b29sY2hhaW5QYXRofSAke1RBUkdFVF9DRkxBR1N9YFxuICB9XG4gIGlmIChpc0NsYW5nQ29tcGlsZXIoZW52LlRBUkdFVF9DWFggfHwgZW52cy5UQVJHRVRfQ1hYIHx8IGVudi5DWFgpKSB7XG4gICAgY29uc3QgVEFSR0VUX0NYWEZMQUdTID0gZW52LlRBUkdFVF9DWFhGTEFHUyB8fCAnJ1xuICAgIGVudnMuVEFSR0VUX0NYWEZMQUdTID0gYC0tc3lzcm9vdD0ke3RhcmdldFN5c3Jvb3R9IC0tZ2NjLXRvb2xjaGFpbj0ke3Rvb2xjaGFpblBhdGh9ICR7VEFSR0VUX0NYWEZMQUdTfWBcbiAgfVxuICBlbnZzLlBBVEggPSBlbnYuUEFUSFxuICAgID8gYCR7dG9vbGNoYWluUGF0aH0vYmluOiR7ZW52LlBBVEh9YFxuICAgIDogYCR7dG9vbGNoYWluUGF0aH0vYmluYFxuICByZXR1cm4gZW52c1xufVxuXG5jbGFzcyBCdWlsZGVyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBhcmdzOiBzdHJpbmdbXSA9IFtdXG4gIHByaXZhdGUgcmVhZG9ubHkgZW52czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9XG4gIHByaXZhdGUgcmVhZG9ubHkgb3V0cHV0czogT3V0cHV0W10gPSBbXVxuXG4gIHByaXZhdGUgcmVhZG9ubHkgdGFyZ2V0OiBUYXJnZXRcbiAgcHJpdmF0ZSByZWFkb25seSBjcmF0ZURpcjogc3RyaW5nXG4gIHByaXZhdGUgcmVhZG9ubHkgb3V0cHV0RGlyOiBzdHJpbmdcbiAgcHJpdmF0ZSByZWFkb25seSB0YXJnZXREaXI6IHN0cmluZ1xuICBwcml2YXRlIHJlYWRvbmx5IGVuYWJsZVR5cGVEZWY6IGJvb2xlYW4gPSBmYWxzZVxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgbWV0YWRhdGE6IENhcmdvV29ya3NwYWNlTWV0YWRhdGEsXG4gICAgcHJpdmF0ZSByZWFkb25seSBjcmF0ZTogQ3JhdGUsXG4gICAgcHJpdmF0ZSByZWFkb25seSBjb25maWc6IE5hcGlDb25maWcsXG4gICAgcHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBQYXJzZWRCdWlsZE9wdGlvbnMsXG4gICkge1xuICAgIHRoaXMudGFyZ2V0ID0gcmVzb2x2ZVRhcmdldChvcHRpb25zLnRhcmdldClcbiAgICB0aGlzLmNyYXRlRGlyID0gcGFyc2UoY3JhdGUubWFuaWZlc3RfcGF0aCkuZGlyXG4gICAgdGhpcy5vdXRwdXREaXIgPSByZXNvbHZlKFxuICAgICAgdGhpcy5vcHRpb25zLmN3ZCxcbiAgICAgIG9wdGlvbnMub3V0cHV0RGlyID8/IHRoaXMuY3JhdGVEaXIsXG4gICAgKVxuICAgIHRoaXMudGFyZ2V0RGlyID1cbiAgICAgIG9wdGlvbnMudGFyZ2V0RGlyID8/XG4gICAgICBwcm9jZXNzLmVudi5DQVJHT19CVUlMRF9UQVJHRVRfRElSID8/XG4gICAgICBtZXRhZGF0YS50YXJnZXRfZGlyZWN0b3J5XG4gICAgdGhpcy5lbmFibGVUeXBlRGVmID0gdGhpcy5jcmF0ZS5kZXBlbmRlbmNpZXMuc29tZShcbiAgICAgIChkZXApID0+XG4gICAgICAgIGRlcC5uYW1lID09PSAnbmFwaS1kZXJpdmUnICYmXG4gICAgICAgIChkZXAudXNlc19kZWZhdWx0X2ZlYXR1cmVzIHx8IGRlcC5mZWF0dXJlcy5pbmNsdWRlcygndHlwZS1kZWYnKSksXG4gICAgKVxuXG4gICAgaWYgKCF0aGlzLmVuYWJsZVR5cGVEZWYpIHtcbiAgICAgIGNvbnN0IHJlcXVpcmVtZW50V2FybmluZyA9XG4gICAgICAgICdgbmFwaS1kZXJpdmVgIGNyYXRlIGlzIG5vdCB1c2VkIG9yIGB0eXBlLWRlZmAgZmVhdHVyZSBpcyBub3QgZW5hYmxlZCBmb3IgYG5hcGktZGVyaXZlYCBjcmF0ZSdcbiAgICAgIGRlYnVnLndhcm4oXG4gICAgICAgIGAke3JlcXVpcmVtZW50V2FybmluZ30uIFdpbGwgc2tpcCBiaW5kaW5nIGdlbmVyYXRpb24gZm9yIFxcYC5ub2RlXFxgLCBcXGAud2FzaVxcYCBhbmQgXFxgLmQudHNcXGAgZmlsZXMuYCxcbiAgICAgIClcblxuICAgICAgaWYgKFxuICAgICAgICB0aGlzLm9wdGlvbnMuZHRzIHx8XG4gICAgICAgIHRoaXMub3B0aW9ucy5kdHNIZWFkZXIgfHxcbiAgICAgICAgdGhpcy5jb25maWcuZHRzSGVhZGVyIHx8XG4gICAgICAgIHRoaXMuY29uZmlnLmR0c0hlYWRlckZpbGVcbiAgICAgICkge1xuICAgICAgICBkZWJ1Zy53YXJuKFxuICAgICAgICAgIGAke3JlcXVpcmVtZW50V2FybmluZ30uIFxcYGR0c1xcYCByZWxhdGVkIG9wdGlvbnMgYXJlIGVuYWJsZWQgYnV0IHdpbGwgYmUgaWdub3JlZC5gLFxuICAgICAgICApXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0IGNkeUxpYk5hbWUoKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5iaW4pIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5jcmF0ZS50YXJnZXRzLmZpbmQoKHQpID0+IHQuY3JhdGVfdHlwZXMuaW5jbHVkZXMoJ2NkeWxpYicpKVxuICAgICAgPy5uYW1lXG4gIH1cblxuICBnZXQgYmluTmFtZSgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5vcHRpb25zLmJpbiA/P1xuICAgICAgLy8gb25seSBhdmFpbGFibGUgaWYgbm90IGNkeWxpYiBvciBiaW4gbmFtZSBzcGVjaWZpZWRcbiAgICAgICh0aGlzLmNkeUxpYk5hbWVcbiAgICAgICAgPyBudWxsXG4gICAgICAgIDogdGhpcy5jcmF0ZS50YXJnZXRzLmZpbmQoKHQpID0+IHQuY3JhdGVfdHlwZXMuaW5jbHVkZXMoJ2JpbicpKT8ubmFtZSlcbiAgICApXG4gIH1cblxuICBidWlsZCgpIHtcbiAgICAvLyBCYWNrc3RvcCBvbmx5OiBgYnVpbGRQcm9qZWN0KClgIGFscmVhZHkgdmFsaWRhdGVkIHRoZXNlIGJlZm9yZSBydW5uaW5nXG4gICAgLy8gYW55dGhpbmcgd2l0aCBhIHNpZGUgZWZmZWN0IChzZWUgdGhlIHRvcCBvZiBgYnVpbGRQcm9qZWN0YCkuIEtlcHQgaGVyZVxuICAgIC8vIHNvIGEgZGlyZWN0bHkgY29uc3RydWN0ZWQgYEJ1aWxkZXJgIGNhbm5vdCBza2lwIHRoZSB2YWxpZGF0aW9uLlxuICAgIHZhbGlkYXRlQ3Jvc3NDb21waWxlRmxhZ3ModGhpcy5vcHRpb25zKVxuICAgIGlmICh0aGlzLm9wdGlvbnMudXNlTmFwaUNyb3NzKSB7XG4gICAgICB2YWxpZGF0ZU5hcGlDcm9zc1N1cHBvcnQodGhpcy50YXJnZXQudHJpcGxlKVxuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMuYmluKSB7XG4gICAgICBkZWJ1Zy53YXJuKFxuICAgICAgICBgQnVpbGRpbmcgQ2FyZ28gYmluYXJ5IHRhcmdldCAke3RoaXMuYmluTmFtZX07IHRoZSByZXN1bHQgd2lsbCBiZSBhbiBleGVjdXRhYmxlLCBub3QgYSBOb2RlLmpzIGFkZG9uLmAsXG4gICAgICApXG4gICAgfSBlbHNlIGlmICghdGhpcy5jZHlMaWJOYW1lKSB7XG4gICAgICBjb25zdCB3YXJuaW5nID1cbiAgICAgICAgJ01pc3NpbmcgYGNyYXRlLXR5cGUgPSBbXCJjZHlsaWJcIl1gIGluIFtsaWJdIGNvbmZpZy4gVGhlIGJ1aWxkIHJlc3VsdCB3aWxsIG5vdCBiZSBhdmFpbGFibGUgYXMgbm9kZSBhZGRvbi4nXG5cbiAgICAgIGlmICh0aGlzLmJpbk5hbWUpIHtcbiAgICAgICAgZGVidWcud2Fybih3YXJuaW5nKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKHdhcm5pbmcpXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucGlja0JpbmFyeSgpXG4gICAgICAuc2V0UGFja2FnZSgpXG4gICAgICAuc2V0RmVhdHVyZXMoKVxuICAgICAgLnNldFRhcmdldCgpXG4gICAgICAucGlja0Nyb3NzVG9vbGNoYWluKClcbiAgICAgIC5zZXRFbnZzKClcbiAgICAgIC5zZXRCeXBhc3NBcmdzKClcbiAgICAgIC5leGVjKClcbiAgfVxuXG4gIHByaXZhdGUgcGlja0Nyb3NzVG9vbGNoYWluKCkge1xuICAgIGlmICghdGhpcy5vcHRpb25zLnVzZU5hcGlDcm9zcykge1xuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgeyB2ZXJzaW9uLCBkb3dubG9hZCB9ID0gcmVxdWlyZSgnQG5hcGktcnMvY3Jvc3MtdG9vbGNoYWluJylcblxuICAgICAgY29uc3QgdG9vbGNoYWluUGF0aCA9IGpvaW4oXG4gICAgICAgIGhvbWVkaXIoKSxcbiAgICAgICAgJy5uYXBpLXJzJyxcbiAgICAgICAgJ2Nyb3NzLXRvb2xjaGFpbicsXG4gICAgICAgIHZlcnNpb24sXG4gICAgICAgIHRoaXMudGFyZ2V0LnRyaXBsZSxcbiAgICAgIClcbiAgICAgIG1rZGlyU3luYyh0b29sY2hhaW5QYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KVxuICAgICAgaWYgKGV4aXN0c1N5bmMoam9pbih0b29sY2hhaW5QYXRoLCAncGFja2FnZS5qc29uJykpKSB7XG4gICAgICAgIGRlYnVnKGBUb29sY2hhaW4gJHt0b29sY2hhaW5QYXRofSBleGlzdHMsIHNraXAgZXh0cmFjdGluZ2ApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB0YXJBcmNoaXZlID0gZG93bmxvYWQocHJvY2Vzcy5hcmNoLCB0aGlzLnRhcmdldC50cmlwbGUpXG4gICAgICAgIHRhckFyY2hpdmUudW5wYWNrKHRvb2xjaGFpblBhdGgpXG4gICAgICB9XG4gICAgICBPYmplY3QuYXNzaWduKFxuICAgICAgICB0aGlzLmVudnMsXG4gICAgICAgIG5hcGlDcm9zc1Rvb2xjaGFpbkVudnModG9vbGNoYWluUGF0aCwgdGhpcy50YXJnZXQudHJpcGxlKSxcbiAgICAgIClcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBGYWlsZWQgdG8gc2V0IHVwIHRoZSBcXGAtLXVzZS1uYXBpLWNyb3NzXFxgIHRvb2xjaGFpbiBmb3IgJHt0aGlzLnRhcmdldC50cmlwbGV9OiAkeyhlIGFzIEVycm9yKS5tZXNzYWdlfS4gQ2hlY2sgZmlsZXN5c3RlbSBwZXJtaXNzaW9ucyBhbmQgbmV0d29yayBjb25uZWN0aXZpdHkgdG8gdGhlIG5wbSByZWdpc3RyeSwgdGhlbiByZXRyeSwgb3IgdXNlIFxcYC0tY3Jvc3MtY29tcGlsZVxcYCAoXFxgLXhcXGApIC8gXFxgLS11c2UtY3Jvc3NcXGAgaW5zdGVhZC5gLFxuICAgICAgICB7IGNhdXNlOiBlIH0sXG4gICAgICApXG4gICAgfVxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBwcml2YXRlIGV4ZWMoKSB7XG4gICAgZGVidWcoYFN0YXJ0IGJ1aWxkaW5nIGNyYXRlOiAke3RoaXMuY3JhdGUubmFtZX1gKVxuICAgIGRlYnVnKCcgICVpJywgYGNhcmdvICR7dGhpcy5hcmdzLmpvaW4oJyAnKX1gKVxuXG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXG4gICAgY29uc3Qgd2F0Y2ggPSB0aGlzLm9wdGlvbnMud2F0Y2hcbiAgICBjb25zdCBidWlsZFRhc2sgPSBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBjYXJnb092ZXJyaWRlID0gcHJvY2Vzcy5lbnYuQ0FSR09cbiAgICAgIGlmIChcbiAgICAgICAgY2FyZ29PdmVycmlkZSAmJlxuICAgICAgICAodGhpcy5vcHRpb25zLnVzZUNyb3NzIHx8IHRoaXMub3B0aW9ucy5jcm9zc0NvbXBpbGUpXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgZXhwZWN0ZWRCaW5hcnkgPSB0aGlzLm9wdGlvbnMudXNlQ3Jvc3MgPyAnY3Jvc3MnIDogJ2NhcmdvJ1xuICAgICAgICBjb25zdCByZXF1ZXN0ZWRGbGFnID0gdGhpcy5vcHRpb25zLnVzZUNyb3NzXG4gICAgICAgICAgPyAnYC0tdXNlLWNyb3NzYCdcbiAgICAgICAgICA6ICdgLS1jcm9zcy1jb21waWxlYCAoYC14YCknXG4gICAgICAgIGRlYnVnLndhcm4oXG4gICAgICAgICAgYFRoZSBcXGBDQVJHT1xcYCBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBzZXQgdG8gXFxgJHtjYXJnb092ZXJyaWRlfVxcYDsgaXQgd2lsbCBiZSBzcGF3bmVkIGluc3RlYWQgb2YgdGhlIFxcYCR7ZXhwZWN0ZWRCaW5hcnl9XFxgIGJpbmFyeSB0aGF0ICR7cmVxdWVzdGVkRmxhZ30gcmVsaWVzIG9uLiBVbnNldCBcXGBDQVJHT1xcYCBpZiB0aGlzIGlzIG5vdCBpbnRlbmRlZC5gLFxuICAgICAgICApXG4gICAgICB9XG4gICAgICBjb25zdCBjb21tYW5kID1cbiAgICAgICAgY2FyZ29PdmVycmlkZSA/PyAodGhpcy5vcHRpb25zLnVzZUNyb3NzID8gJ2Nyb3NzJyA6ICdjYXJnbycpXG4gICAgICBjb25zdCBidWlsZFByb2Nlc3MgPSBzcGF3bihjb21tYW5kLCB0aGlzLmFyZ3MsIHtcbiAgICAgICAgZW52OiB7IC4uLnByb2Nlc3MuZW52LCAuLi50aGlzLmVudnMgfSxcbiAgICAgICAgc3RkaW86IHdhdGNoID8gWydpbmhlcml0JywgJ2luaGVyaXQnLCAncGlwZSddIDogJ2luaGVyaXQnLFxuICAgICAgICBjd2Q6IHRoaXMub3B0aW9ucy5jd2QsXG4gICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICB9KVxuXG4gICAgICBidWlsZFByb2Nlc3Mub25jZSgnZXhpdCcsIChjb2RlKSA9PiB7XG4gICAgICAgIGlmIChjb2RlID09PSAwKSB7XG4gICAgICAgICAgZGVidWcoJyVpJywgYEJ1aWxkIGNyYXRlICR7dGhpcy5jcmF0ZS5uYW1lfSBzdWNjZXNzZnVsbHkhYClcbiAgICAgICAgICByZXNvbHZlKClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKGBCdWlsZCBmYWlsZWQgd2l0aCBleGl0IGNvZGUgJHtjb2RlfWApKVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBidWlsZFByb2Nlc3Mub25jZSgnZXJyb3InLCAoZSkgPT4ge1xuICAgICAgICByZWplY3QobmV3IEVycm9yKGBCdWlsZCBmYWlsZWQgd2l0aCBlcnJvcjogJHtlLm1lc3NhZ2V9YCwgeyBjYXVzZTogZSB9KSlcbiAgICAgIH0pXG5cbiAgICAgIC8vIHdhdGNoIG1vZGUgb25seSwgdGhleSBhcmUgcGlwZWQgdGhyb3VnaCBzdGRlcnJcbiAgICAgIGJ1aWxkUHJvY2Vzcy5zdGRlcnI/Lm9uKCdkYXRhJywgKGRhdGEpID0+IHtcbiAgICAgICAgY29uc3Qgb3V0cHV0ID0gZGF0YS50b1N0cmluZygpXG4gICAgICAgIGNvbnNvbGUuZXJyb3Iob3V0cHV0KVxuICAgICAgICBpZiAoL0ZpbmlzaGVkXFxzKGBkZXZgfGByZWxlYXNlYCkvLnRlc3Qob3V0cHV0KSkge1xuICAgICAgICAgIHRoaXMucG9zdEJ1aWxkKCkuY2F0Y2goKCkgPT4ge30pXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcblxuICAgIHJldHVybiB7XG4gICAgICB0YXNrOiBidWlsZFRhc2sudGhlbigoKSA9PiB0aGlzLnBvc3RCdWlsZCgpKSxcbiAgICAgIGFib3J0OiAoKSA9PiBjb250cm9sbGVyLmFib3J0KCksXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBwaWNrQmluYXJ5KCkge1xuICAgIGxldCBzZXQgPSBmYWxzZVxuICAgIGlmICh0aGlzLm9wdGlvbnMud2F0Y2gpIHtcbiAgICAgIGlmIChwcm9jZXNzLmVudi5DSSkge1xuICAgICAgICBkZWJ1Zy53YXJuKCdXYXRjaCBtb2RlIGlzIG5vdCBzdXBwb3J0ZWQgaW4gQ0kgZW52aXJvbm1lbnQnKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVidWcoJ1VzZSAlaScsICdjYXJnby13YXRjaCcpXG4gICAgICAgIHRyeUluc3RhbGxDYXJnb0JpbmFyeSgnY2FyZ28td2F0Y2gnLCAnd2F0Y2gnKVxuICAgICAgICAvLyB5YXJuIG5hcGkgd2F0Y2ggLS10YXJnZXQgeDg2XzY0LXVua25vd24tbGludXgtZ251XG4gICAgICAgIC8vID09PT5cbiAgICAgICAgLy8gY2FyZ28gd2F0Y2ggWy4uLl0gLS0gY2FyZ28gYnVpbGQgLS10YXJnZXQgeDg2XzY0LXVua25vd24tbGludXgtZ251XG4gICAgICAgIHRoaXMuYXJncy5wdXNoKFxuICAgICAgICAgICd3YXRjaCcsXG4gICAgICAgICAgJy0td2h5JyxcbiAgICAgICAgICAnLWknLFxuICAgICAgICAgICcqLntqcyx0cyxub2RlfScsXG4gICAgICAgICAgJy13JyxcbiAgICAgICAgICB0aGlzLmNyYXRlRGlyLFxuICAgICAgICAgICctLScsXG4gICAgICAgICAgJ2NhcmdvJyxcbiAgICAgICAgICAnYnVpbGQnLFxuICAgICAgICApXG4gICAgICAgIHNldCA9IHRydWVcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmNyb3NzQ29tcGlsZSkge1xuICAgICAgaWYgKHRoaXMudGFyZ2V0LnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgIGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgZGVidWcud2FybihcbiAgICAgICAgICAgICdZb3UgYXJlIHRyeWluZyB0byBjcm9zcyBjb21waWxlIHRvIHdpbjMyIHBsYXRmb3JtIG9uIHdpbjMyIHBsYXRmb3JtIHdoaWNoIGlzIHVubmVjZXNzYXJ5LicsXG4gICAgICAgICAgKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHVzZSBjYXJnby14d2luIHRvIGNyb3NzIGNvbXBpbGUgdG8gd2luMzIgcGxhdGZvcm1cbiAgICAgICAgICBkZWJ1ZygnVXNlICVpJywgJ2NhcmdvLXh3aW4nKVxuICAgICAgICAgIHRyeUluc3RhbGxDYXJnb0JpbmFyeSgnY2FyZ28teHdpbicsICd4d2luJylcbiAgICAgICAgICB0aGlzLmFyZ3MucHVzaCgneHdpbicsICdidWlsZCcpXG4gICAgICAgICAgaWYgKHRoaXMudGFyZ2V0LmFyY2ggPT09ICdpYTMyJykge1xuICAgICAgICAgICAgdGhpcy5lbnZzLlhXSU5fQVJDSCA9ICd4ODYnXG4gICAgICAgICAgfVxuICAgICAgICAgIHNldCA9IHRydWVcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gdXNlIGNhcmdvLXppZ2J1aWxkIHRvIGNyb3NzIGNvbXBpbGUgdG8gb3RoZXIgcGxhdGZvcm1zXG4gICAgICAgIGRlYnVnKCdVc2UgJWknLCAnY2FyZ28temlnYnVpbGQnKVxuICAgICAgICB0cnlJbnN0YWxsQ2FyZ29CaW5hcnkoJ2NhcmdvLXppZ2J1aWxkJywgJ3ppZ2J1aWxkJylcbiAgICAgICAgdGhpcy5hcmdzLnB1c2goJ3ppZ2J1aWxkJylcbiAgICAgICAgc2V0ID0gdHJ1ZVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghc2V0KSB7XG4gICAgICB0aGlzLmFyZ3MucHVzaCgnYnVpbGQnKVxuICAgIH1cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgcHJpdmF0ZSBzZXRQYWNrYWdlKCkge1xuICAgIGNvbnN0IGFyZ3MgPSBbXVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5wYWNrYWdlKSB7XG4gICAgICBhcmdzLnB1c2goJy0tcGFja2FnZScsIHRoaXMub3B0aW9ucy5wYWNrYWdlKVxuICAgIH1cblxuICAgIGlmICh0aGlzLmJpbk5hbWUpIHtcbiAgICAgIGFyZ3MucHVzaCgnLS1iaW4nLCB0aGlzLmJpbk5hbWUpXG4gICAgfVxuXG4gICAgaWYgKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBkZWJ1ZygnU2V0IHBhY2thZ2UgZmxhZ3M6ICcpXG4gICAgICBkZWJ1ZygnICAlTycsIGFyZ3MpXG4gICAgICB0aGlzLmFyZ3MucHVzaCguLi5hcmdzKVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBwcml2YXRlIHNldFRhcmdldCgpIHtcbiAgICBkZWJ1ZygnU2V0IGNvbXBpbGluZyB0YXJnZXQgdG86ICcpXG4gICAgZGVidWcoJyAgJWknLCB0aGlzLnRhcmdldC50cmlwbGUpXG5cbiAgICB0aGlzLmFyZ3MucHVzaCgnLS10YXJnZXQnLCB0aGlzLnRhcmdldC50cmlwbGUpXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgcHJpdmF0ZSBzZXRFbnZzKCkge1xuICAgIC8vIFRZUEUgREVGXG4gICAgaWYgKHRoaXMuZW5hYmxlVHlwZURlZikge1xuICAgICAgdGhpcy5lbnZzLk5BUElfVFlQRV9ERUZfVE1QX0ZPTERFUiA9XG4gICAgICAgIHRoaXMuZ2VuZXJhdGVJbnRlcm1lZGlhdGVUeXBlRGVmRm9sZGVyKClcbiAgICAgIHRoaXMuc2V0Rm9yY2VCdWlsZEVudnModGhpcy5lbnZzLk5BUElfVFlQRV9ERUZfVE1QX0ZPTERFUilcbiAgICB9XG5cbiAgICAvLyBSVVNURkxBR1NcbiAgICBsZXQgcnVzdGZsYWdzID1cbiAgICAgIHByb2Nlc3MuZW52LlJVU1RGTEFHUyA/PyBwcm9jZXNzLmVudi5DQVJHT19CVUlMRF9SVVNURkxBR1MgPz8gJydcblxuICAgIGlmIChcbiAgICAgIHRoaXMudGFyZ2V0LmFiaT8uaW5jbHVkZXMoJ211c2wnKSAmJlxuICAgICAgIXJ1c3RmbGFncy5pbmNsdWRlcygndGFyZ2V0LWZlYXR1cmU9LWNydC1zdGF0aWMnKVxuICAgICkge1xuICAgICAgcnVzdGZsYWdzICs9ICcgLUMgdGFyZ2V0LWZlYXR1cmU9LWNydC1zdGF0aWMnXG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpcCAmJiAhcnVzdGZsYWdzLmluY2x1ZGVzKCdsaW5rLWFyZz0tcycpKSB7XG4gICAgICBydXN0ZmxhZ3MgKz0gJyAtQyBsaW5rLWFyZz0tcydcbiAgICB9XG5cbiAgICBpZiAocnVzdGZsYWdzLmxlbmd0aCkge1xuICAgICAgdGhpcy5lbnZzLlJVU1RGTEFHUyA9IHJ1c3RmbGFnc1xuICAgIH1cbiAgICAvLyBFTkQgUlVTVEZMQUdTXG5cbiAgICAvLyBMSU5LRVJcbiAgICBjb25zdCBsaW5rZXIgPSB0aGlzLm9wdGlvbnMuY3Jvc3NDb21waWxlXG4gICAgICA/IHZvaWQgMFxuICAgICAgOiBnZXRUYXJnZXRMaW5rZXIodGhpcy50YXJnZXQudHJpcGxlKVxuICAgIC8vIFRPRE86XG4gICAgLy8gICBkaXJlY3RseSBzZXQgQ0FSR09fVEFSR0VUXzx0YXJnZXQ+X0xJTktFUiB3aWxsIGNvdmVyIC5jYXJnby9jb25maWcudG9tbFxuICAgIC8vICAgd2lsbCBkZXRlY3QgYnkgY2FyZ28gY29uZmlnIHdoZW4gaXQgYmVjb21lcyBzdGFibGVcbiAgICAvLyAgIHNlZTogaHR0cHM6Ly9naXRodWIuY29tL3J1c3QtbGFuZy9jYXJnby9pc3N1ZXMvOTMwMVxuICAgIGNvbnN0IGxpbmtlckVudiA9IGBDQVJHT19UQVJHRVRfJHt0YXJnZXRUb0VudlZhcihcbiAgICAgIHRoaXMudGFyZ2V0LnRyaXBsZSxcbiAgICApfV9MSU5LRVJgXG4gICAgaWYgKGxpbmtlciAmJiAhcHJvY2Vzcy5lbnZbbGlua2VyRW52XSAmJiAhdGhpcy5lbnZzW2xpbmtlckVudl0pIHtcbiAgICAgIHRoaXMuZW52c1tsaW5rZXJFbnZdID0gbGlua2VyXG4gICAgfVxuXG4gICAgaWYgKHRoaXMudGFyZ2V0LnBsYXRmb3JtID09PSAnYW5kcm9pZCcpIHtcbiAgICAgIHRoaXMuc2V0QW5kcm9pZEVudigpXG4gICAgfVxuXG4gICAgaWYgKHRoaXMudGFyZ2V0LnBsYXRmb3JtID09PSAnd2FzaScpIHtcbiAgICAgIHRoaXMuc2V0V2FzaUVudigpXG4gICAgfVxuXG4gICAgaWYgKHRoaXMudGFyZ2V0LnBsYXRmb3JtID09PSAnb3Blbmhhcm1vbnknKSB7XG4gICAgICB0aGlzLnNldE9wZW5IYXJtb255RW52KClcbiAgICB9XG5cbiAgICBkZWJ1ZygnU2V0IGVudnM6ICcpXG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5lbnZzKS5mb3JFYWNoKChbaywgdl0pID0+IHtcbiAgICAgIGRlYnVnKCcgICVpJywgYCR7a309JHt2fWApXG4gICAgfSlcblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBwcml2YXRlIHNldEZvcmNlQnVpbGRFbnZzKHR5cGVEZWZUbXBGb2xkZXI6IHN0cmluZykge1xuICAgIC8vIGR5bmFtaWNhbGx5IGNoZWNrIGFsbCBuYXBpLXJzIGRlcHMgYW5kIHNldCBgTkFQSV9GT1JDRV9CVUlMRF97dXBwZXJjYXNlKHNuYWtlX2Nhc2UobmFtZSkpfSA9IHRpbWVzdGFtcGBcbiAgICBnZXROYXBpRGVyaXZlRGVwZW5kZW50Q3JhdGVzKHRoaXMubWV0YWRhdGEpLmZvckVhY2goKGNyYXRlKSA9PiB7XG4gICAgICBpZiAoIWV4aXN0c1N5bmMoam9pbih0eXBlRGVmVG1wRm9sZGVyLCBjcmF0ZS5uYW1lKSkpIHtcbiAgICAgICAgdGhpcy5lbnZzW1xuICAgICAgICAgIGBOQVBJX0ZPUkNFX0JVSUxEXyR7Y3JhdGUubmFtZS5yZXBsYWNlKC8tL2csICdfJykudG9VcHBlckNhc2UoKX1gXG4gICAgICAgIF0gPSBEYXRlLm5vdygpLnRvU3RyaW5nKClcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgcHJpdmF0ZSBzZXRBbmRyb2lkRW52KCkge1xuICAgIC8vIE5hdGl2ZSBBbmRyb2lkIGhvc3RzIGFuZCBgY3Jvc3NgIHByb3ZpZGUgdGhlaXIgb3duIEFuZHJvaWQgdG9vbGNoYWlucy5cbiAgICBpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2FuZHJvaWQnIHx8IHRoaXMub3B0aW9ucy51c2VDcm9zcykge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc3QgeyBBTkRST0lEX05ES19MQVRFU1RfSE9NRSB9ID0gcHJvY2Vzcy5lbnZcbiAgICBpZiAoIUFORFJPSURfTkRLX0xBVEVTVF9IT01FKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGAke2NvbG9ycy5yZWQoXG4gICAgICAgICAgJ0FORFJPSURfTkRLX0xBVEVTVF9IT01FJyxcbiAgICAgICAgKX0gZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgcmVxdWlyZWQgd2hlbiBidWlsZGluZyBhbiBBbmRyb2lkIHRhcmdldCBmcm9tIGEgbm9uLUFuZHJvaWQgaG9zdGAsXG4gICAgICApXG4gICAgfVxuXG4gICAgY29uc3QgdGFyZ2V0QXJjaCA9IHRoaXMudGFyZ2V0LmFyY2ggPT09ICdhcm0nID8gJ2FybXY3YScgOiAnYWFyY2g2NCdcbiAgICBjb25zdCB0YXJnZXRQbGF0Zm9ybSA9XG4gICAgICB0aGlzLnRhcmdldC5hcmNoID09PSAnYXJtJyA/ICdhbmRyb2lkZWFiaTI0JyA6ICdhbmRyb2lkMjQnXG4gICAgY29uc3QgaG9zdFBsYXRmb3JtID1cbiAgICAgIHByb2Nlc3MucGxhdGZvcm0gPT09ICdkYXJ3aW4nXG4gICAgICAgID8gJ2RhcndpbidcbiAgICAgICAgOiBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInXG4gICAgICAgICAgPyAnd2luZG93cydcbiAgICAgICAgICA6ICdsaW51eCdcbiAgICBPYmplY3QuYXNzaWduKHRoaXMuZW52cywge1xuICAgICAgQ0FSR09fVEFSR0VUX0FBUkNINjRfTElOVVhfQU5EUk9JRF9MSU5LRVI6IGAke0FORFJPSURfTkRLX0xBVEVTVF9IT01FfS90b29sY2hhaW5zL2xsdm0vcHJlYnVpbHQvJHtob3N0UGxhdGZvcm19LXg4Nl82NC9iaW4vJHt0YXJnZXRBcmNofS1saW51eC1hbmRyb2lkMjQtY2xhbmdgLFxuICAgICAgQ0FSR09fVEFSR0VUX0FSTVY3X0xJTlVYX0FORFJPSURFQUJJX0xJTktFUjogYCR7QU5EUk9JRF9OREtfTEFURVNUX0hPTUV9L3Rvb2xjaGFpbnMvbGx2bS9wcmVidWlsdC8ke2hvc3RQbGF0Zm9ybX0teDg2XzY0L2Jpbi8ke3RhcmdldEFyY2h9LWxpbnV4LWFuZHJvaWRlYWJpMjQtY2xhbmdgLFxuICAgICAgVEFSR0VUX0NDOiBgJHtBTkRST0lEX05ES19MQVRFU1RfSE9NRX0vdG9vbGNoYWlucy9sbHZtL3ByZWJ1aWx0LyR7aG9zdFBsYXRmb3JtfS14ODZfNjQvYmluLyR7dGFyZ2V0QXJjaH0tbGludXgtJHt0YXJnZXRQbGF0Zm9ybX0tY2xhbmdgLFxuICAgICAgVEFSR0VUX0NYWDogYCR7QU5EUk9JRF9OREtfTEFURVNUX0hPTUV9L3Rvb2xjaGFpbnMvbGx2bS9wcmVidWlsdC8ke2hvc3RQbGF0Zm9ybX0teDg2XzY0L2Jpbi8ke3RhcmdldEFyY2h9LWxpbnV4LSR7dGFyZ2V0UGxhdGZvcm19LWNsYW5nKytgLFxuICAgICAgVEFSR0VUX0FSOiBgJHtBTkRST0lEX05ES19MQVRFU1RfSE9NRX0vdG9vbGNoYWlucy9sbHZtL3ByZWJ1aWx0LyR7aG9zdFBsYXRmb3JtfS14ODZfNjQvYmluL2xsdm0tYXJgLFxuICAgICAgVEFSR0VUX1JBTkxJQjogYCR7QU5EUk9JRF9OREtfTEFURVNUX0hPTUV9L3Rvb2xjaGFpbnMvbGx2bS9wcmVidWlsdC8ke2hvc3RQbGF0Zm9ybX0teDg2XzY0L2Jpbi9sbHZtLXJhbmxpYmAsXG4gICAgICBBTkRST0lEX05ESzogQU5EUk9JRF9OREtfTEFURVNUX0hPTUUsXG4gICAgICBQQVRIOiBgJHtBTkRST0lEX05ES19MQVRFU1RfSE9NRX0vdG9vbGNoYWlucy9sbHZtL3ByZWJ1aWx0LyR7aG9zdFBsYXRmb3JtfS14ODZfNjQvYmluJHtwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInID8gJzsnIDogJzonfSR7cHJvY2Vzcy5lbnYuUEFUSH1gLFxuICAgIH0pXG4gIH1cblxuICBwcml2YXRlIHNldFdhc2lFbnYoKSB7XG4gICAgY29uc3QgZW1uYXBpID0gam9pbihcbiAgICAgIHJlcXVpcmUucmVzb2x2ZSgnZW1uYXBpJyksXG4gICAgICAnLi4nLFxuICAgICAgJ2xpYicsXG4gICAgICAnd2FzbTMyLXdhc2lwMS10aHJlYWRzJyxcbiAgICApXG4gICAgdGhpcy5lbnZzLkVNTkFQSV9MSU5LX0RJUiA9IGVtbmFwaVxuICAgIGNvbnN0IGVtbmFwaVZlcnNpb24gPSByZXF1aXJlKCdlbW5hcGkvcGFja2FnZS5qc29uJykudmVyc2lvblxuICAgIGNvbnN0IHByb2plY3RSZXF1aXJlID0gY3JlYXRlUmVxdWlyZShqb2luKHRoaXMub3B0aW9ucy5jd2QsICdwYWNrYWdlLmpzb24nKSlcbiAgICBjb25zdCBlbW5hcGlDb3JlVmVyc2lvbiA9IHByb2plY3RSZXF1aXJlKCdAZW1uYXBpL2NvcmUnKS52ZXJzaW9uXG4gICAgY29uc3QgZW1uYXBpUnVudGltZVZlcnNpb24gPSBwcm9qZWN0UmVxdWlyZSgnQGVtbmFwaS9ydW50aW1lJykudmVyc2lvblxuXG4gICAgaWYgKFxuICAgICAgZW1uYXBpVmVyc2lvbiAhPT0gZW1uYXBpQ29yZVZlcnNpb24gfHxcbiAgICAgIGVtbmFwaVZlcnNpb24gIT09IGVtbmFwaVJ1bnRpbWVWZXJzaW9uXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBlbW5hcGkgdmVyc2lvbiBtaXNtYXRjaDogZW1uYXBpQCR7ZW1uYXBpVmVyc2lvbn0sIEBlbW5hcGkvY29yZUAke2VtbmFwaUNvcmVWZXJzaW9ufSwgQGVtbmFwaS9ydW50aW1lQCR7ZW1uYXBpUnVudGltZVZlcnNpb259LiBQbGVhc2UgZW5zdXJlIGFsbCBlbW5hcGkgcGFja2FnZXMgYXJlIHRoZSBzYW1lIHZlcnNpb24uYCxcbiAgICAgIClcbiAgICB9XG4gICAgY29uc3QgeyBXQVNJX1NES19QQVRIIH0gPSBwcm9jZXNzLmVudlxuXG4gICAgaWYgKFdBU0lfU0RLX1BBVEggJiYgZXhpc3RzU3luYyhXQVNJX1NES19QQVRIKSkge1xuICAgICAgdGhpcy5lbnZzLkNBUkdPX1RBUkdFVF9XQVNNMzJfV0FTSV9QUkVWSUVXMV9USFJFQURTX0xJTktFUiA9IGpvaW4oXG4gICAgICAgIFdBU0lfU0RLX1BBVEgsXG4gICAgICAgICdiaW4nLFxuICAgICAgICAnd2FzbS1sZCcsXG4gICAgICApXG4gICAgICB0aGlzLmVudnMuQ0FSR09fVEFSR0VUX1dBU00zMl9XQVNJUDFfTElOS0VSID0gam9pbihcbiAgICAgICAgV0FTSV9TREtfUEFUSCxcbiAgICAgICAgJ2JpbicsXG4gICAgICAgICd3YXNtLWxkJyxcbiAgICAgIClcbiAgICAgIHRoaXMuZW52cy5DQVJHT19UQVJHRVRfV0FTTTMyX1dBU0lQMV9USFJFQURTX0xJTktFUiA9IGpvaW4oXG4gICAgICAgIFdBU0lfU0RLX1BBVEgsXG4gICAgICAgICdiaW4nLFxuICAgICAgICAnd2FzbS1sZCcsXG4gICAgICApXG4gICAgICB0aGlzLmVudnMuQ0FSR09fVEFSR0VUX1dBU00zMl9XQVNJUDJfTElOS0VSID0gam9pbihcbiAgICAgICAgV0FTSV9TREtfUEFUSCxcbiAgICAgICAgJ2JpbicsXG4gICAgICAgICd3YXNtLWxkJyxcbiAgICAgIClcbiAgICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoJ1RBUkdFVF9DQycsIGpvaW4oV0FTSV9TREtfUEFUSCwgJ2JpbicsICdjbGFuZycpKVxuICAgICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cyhcbiAgICAgICAgJ1RBUkdFVF9DWFgnLFxuICAgICAgICBqb2luKFdBU0lfU0RLX1BBVEgsICdiaW4nLCAnY2xhbmcrKycpLFxuICAgICAgKVxuICAgICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cygnVEFSR0VUX0FSJywgam9pbihXQVNJX1NES19QQVRILCAnYmluJywgJ2FyJykpXG4gICAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKFxuICAgICAgICAnVEFSR0VUX1JBTkxJQicsXG4gICAgICAgIGpvaW4oV0FTSV9TREtfUEFUSCwgJ2JpbicsICdyYW5saWInKSxcbiAgICAgIClcbiAgICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoXG4gICAgICAgICdUQVJHRVRfQ0ZMQUdTJyxcbiAgICAgICAgYC0tdGFyZ2V0PXdhc20zMi13YXNpcDEtdGhyZWFkcyAtLXN5c3Jvb3Q9JHtXQVNJX1NES19QQVRIfS9zaGFyZS93YXNpLXN5c3Jvb3QgLXB0aHJlYWQgLW1sbHZtIC13YXNtLWVuYWJsZS1zamxqYCxcbiAgICAgIClcbiAgICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoXG4gICAgICAgICdUQVJHRVRfQ1hYRkxBR1MnLFxuICAgICAgICBgLS10YXJnZXQ9d2FzbTMyLXdhc2lwMS10aHJlYWRzIC0tc3lzcm9vdD0ke1dBU0lfU0RLX1BBVEh9L3NoYXJlL3dhc2ktc3lzcm9vdCAtcHRocmVhZCAtbWxsdm0gLXdhc20tZW5hYmxlLXNqbGpgLFxuICAgICAgKVxuICAgICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cyhcbiAgICAgICAgYFRBUkdFVF9MREZMQUdTYCxcbiAgICAgICAgYC1mdXNlLWxkPSR7V0FTSV9TREtfUEFUSH0vYmluL3dhc20tbGQgLS10YXJnZXQ9d2FzbTMyLXdhc2lwMS10aHJlYWRzYCxcbiAgICAgIClcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIHNldE9wZW5IYXJtb255RW52KCkge1xuICAgIGNvbnN0IHsgT0hPU19TREtfUEFUSCwgT0hPU19TREtfTkFUSVZFIH0gPSBwcm9jZXNzLmVudlxuICAgIGNvbnN0IG5ka1BhdGggPSBPSE9TX1NES19QQVRIID8gYCR7T0hPU19TREtfUEFUSH0vbmF0aXZlYCA6IE9IT1NfU0RLX05BVElWRVxuICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICBpZiAoIW5ka1BhdGggJiYgcHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ29wZW5oYXJtb255Jykge1xuICAgICAgZGVidWcud2FybihcbiAgICAgICAgYCR7Y29sb3JzLnJlZCgnT0hPU19TREtfUEFUSCcpfSBvciAke2NvbG9ycy5yZWQoJ09IT1NfU0RLX05BVElWRScpfSBlbnZpcm9ubWVudCB2YXJpYWJsZSBpcyBtaXNzaW5nYCxcbiAgICAgIClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBjb25zdCBsaW5rZXJOYW1lID0gYENBUkdPX1RBUkdFVF8ke3RoaXMudGFyZ2V0LnRyaXBsZS50b1VwcGVyQ2FzZSgpLnJlcGxhY2UoLy0vZywgJ18nKX1fTElOS0VSYFxuICAgIGNvbnN0IHJhblBhdGggPSBgJHtuZGtQYXRofS9sbHZtL2Jpbi9sbHZtLXJhbmxpYmBcbiAgICBjb25zdCBhclBhdGggPSBgJHtuZGtQYXRofS9sbHZtL2Jpbi9sbHZtLWFyYFxuICAgIGNvbnN0IGNjUGF0aCA9IGAke25ka1BhdGh9L2xsdm0vYmluLyR7dGhpcy50YXJnZXQudHJpcGxlfS1jbGFuZ2BcbiAgICBjb25zdCBjeHhQYXRoID0gYCR7bmRrUGF0aH0vbGx2bS9iaW4vJHt0aGlzLnRhcmdldC50cmlwbGV9LWNsYW5nKytgXG4gICAgY29uc3QgYXNQYXRoID0gYCR7bmRrUGF0aH0vbGx2bS9iaW4vbGx2bS1hc2BcbiAgICBjb25zdCBsZFBhdGggPSBgJHtuZGtQYXRofS9sbHZtL2Jpbi9sZC5sbGRgXG4gICAgY29uc3Qgc3RyaXBQYXRoID0gYCR7bmRrUGF0aH0vbGx2bS9iaW4vbGx2bS1zdHJpcGBcbiAgICBjb25zdCBvYmpEdW1wUGF0aCA9IGAke25ka1BhdGh9L2xsdm0vYmluL2xsdm0tb2JqZHVtcGBcbiAgICBjb25zdCBvYmpDb3B5UGF0aCA9IGAke25ka1BhdGh9L2xsdm0vYmluL2xsdm0tb2JqY29weWBcbiAgICBjb25zdCBubVBhdGggPSBgJHtuZGtQYXRofS9sbHZtL2Jpbi9sbHZtLW5tYFxuICAgIGNvbnN0IGJpblBhdGggPSBgJHtuZGtQYXRofS9sbHZtL2JpbmBcbiAgICBjb25zdCBsaWJQYXRoID0gYCR7bmRrUGF0aH0vbGx2bS9saWJgXG5cbiAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKCdMSUJDTEFOR19QQVRIJywgbGliUGF0aClcbiAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKCdERVBfQVRPTUlDJywgJ2NsYW5nX3J0LmJ1aWx0aW5zJylcbiAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKGxpbmtlck5hbWUsIGNjUGF0aClcbiAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKCdUQVJHRVRfQ0MnLCBjY1BhdGgpXG4gICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cygnVEFSR0VUX0NYWCcsIGN4eFBhdGgpXG4gICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cygnVEFSR0VUX0FSJywgYXJQYXRoKVxuICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoJ1RBUkdFVF9SQU5MSUInLCByYW5QYXRoKVxuICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoJ1RBUkdFVF9BUycsIGFzUGF0aClcbiAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKCdUQVJHRVRfTEQnLCBsZFBhdGgpXG4gICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cygnVEFSR0VUX1NUUklQJywgc3RyaXBQYXRoKVxuICAgIHRoaXMuc2V0RW52SWZOb3RFeGlzdHMoJ1RBUkdFVF9PQkpEVU1QJywgb2JqRHVtcFBhdGgpXG4gICAgdGhpcy5zZXRFbnZJZk5vdEV4aXN0cygnVEFSR0VUX09CSkNPUFknLCBvYmpDb3B5UGF0aClcbiAgICB0aGlzLnNldEVudklmTm90RXhpc3RzKCdUQVJHRVRfTk0nLCBubVBhdGgpXG4gICAgdGhpcy5lbnZzLlBBVEggPSBgJHtiaW5QYXRofSR7cHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyA/ICc7JyA6ICc6J30ke3Byb2Nlc3MuZW52LlBBVEh9YFxuICB9XG5cbiAgcHJpdmF0ZSBzZXRGZWF0dXJlcygpIHtcbiAgICBjb25zdCBhcmdzID0gW11cbiAgICBpZiAodGhpcy5vcHRpb25zLmFsbEZlYXR1cmVzICYmIHRoaXMub3B0aW9ucy5ub0RlZmF1bHRGZWF0dXJlcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnQ2Fubm90IHNwZWNpZnkgLS1hbGwtZmVhdHVyZXMgYW5kIC0tbm8tZGVmYXVsdC1mZWF0dXJlcyB0b2dldGhlcicsXG4gICAgICApXG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuYWxsRmVhdHVyZXMpIHtcbiAgICAgIGFyZ3MucHVzaCgnLS1hbGwtZmVhdHVyZXMnKVxuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLm5vRGVmYXVsdEZlYXR1cmVzKSB7XG4gICAgICBhcmdzLnB1c2goJy0tbm8tZGVmYXVsdC1mZWF0dXJlcycpXG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuZmVhdHVyZXMpIHtcbiAgICAgIGFyZ3MucHVzaCgnLS1mZWF0dXJlcycsIC4uLnRoaXMub3B0aW9ucy5mZWF0dXJlcylcbiAgICB9XG5cbiAgICBkZWJ1ZygnU2V0IGZlYXR1cmVzIGZsYWdzOiAnKVxuICAgIGRlYnVnKCcgICVPJywgYXJncylcbiAgICB0aGlzLmFyZ3MucHVzaCguLi5hcmdzKVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIHByaXZhdGUgc2V0QnlwYXNzQXJncygpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnJlbGVhc2UpIHtcbiAgICAgIHRoaXMuYXJncy5wdXNoKCctLXJlbGVhc2UnKVxuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgdGhpcy5hcmdzLnB1c2goJy0tdmVyYm9zZScpXG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy50YXJnZXREaXIpIHtcbiAgICAgIHRoaXMuYXJncy5wdXNoKCctLXRhcmdldC1kaXInLCB0aGlzLm9wdGlvbnMudGFyZ2V0RGlyKVxuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMucHJvZmlsZSkge1xuICAgICAgdGhpcy5hcmdzLnB1c2goJy0tcHJvZmlsZScsIHRoaXMub3B0aW9ucy5wcm9maWxlKVxuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMubWFuaWZlc3RQYXRoKSB7XG4gICAgICB0aGlzLmFyZ3MucHVzaCgnLS1tYW5pZmVzdC1wYXRoJywgdGhpcy5vcHRpb25zLm1hbmlmZXN0UGF0aClcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmNhcmdvT3B0aW9ucz8ubGVuZ3RoKSB7XG4gICAgICB0aGlzLmFyZ3MucHVzaCguLi50aGlzLm9wdGlvbnMuY2FyZ29PcHRpb25zKVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBwcml2YXRlIGdlbmVyYXRlSW50ZXJtZWRpYXRlVHlwZURlZkZvbGRlcigpIHtcbiAgICBsZXQgZm9sZGVyID0gam9pbihcbiAgICAgIHRoaXMudGFyZ2V0RGlyLFxuICAgICAgJ25hcGktcnMnLFxuICAgICAgYCR7dGhpcy5jcmF0ZS5uYW1lfS0ke2NyZWF0ZUhhc2goJ3NoYTI1NicpXG4gICAgICAgIC51cGRhdGUodGhpcy5jcmF0ZS5tYW5pZmVzdF9wYXRoKVxuICAgICAgICAudXBkYXRlKENMSV9WRVJTSU9OKVxuICAgICAgICAuZGlnZXN0KCdoZXgnKVxuICAgICAgICAuc3Vic3RyaW5nKDAsIDgpfWAsXG4gICAgKVxuXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuZHRzQ2FjaGUpIHtcbiAgICAgIHJtU3luYyhmb2xkZXIsIHsgcmVjdXJzaXZlOiB0cnVlLCBmb3JjZTogdHJ1ZSB9KVxuICAgICAgZm9sZGVyICs9IGBfJHtEYXRlLm5vdygpfWBcbiAgICB9XG5cbiAgICBta2RpckFzeW5jKGZvbGRlciwgeyByZWN1cnNpdmU6IHRydWUgfSlcblxuICAgIHJldHVybiBmb2xkZXJcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcG9zdEJ1aWxkKCkge1xuICAgIHRyeSB7XG4gICAgICBkZWJ1ZyhgVHJ5IHRvIGNyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5OmApXG4gICAgICBkZWJ1ZygnICAlaScsIHRoaXMub3V0cHV0RGlyKVxuICAgICAgYXdhaXQgbWtkaXJBc3luYyh0aGlzLm91dHB1dERpciwgeyByZWN1cnNpdmU6IHRydWUgfSlcbiAgICAgIGRlYnVnKGBPdXRwdXQgZGlyZWN0b3J5IGNyZWF0ZWRgKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSBvdXRwdXQgZGlyZWN0b3J5ICR7dGhpcy5vdXRwdXREaXJ9YCwge1xuICAgICAgICBjYXVzZTogZSxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgY29uc3Qgd2FzbUJpbmFyeU5hbWUgPSBhd2FpdCB0aGlzLmNvcHlBcnRpZmFjdCgpXG5cbiAgICAvLyBvbmx5IGZvciBjZHlsaWJcbiAgICBpZiAodGhpcy5jZHlMaWJOYW1lKSB7XG4gICAgICBjb25zdCBpZGVudHMgPSBhd2FpdCB0aGlzLmdlbmVyYXRlVHlwZURlZigpXG4gICAgICBjb25zdCBqc091dHB1dCA9IGF3YWl0IHRoaXMud3JpdGVKc0JpbmRpbmcoaWRlbnRzKVxuICAgICAgY29uc3Qgd2FzbUJpbmRpbmdzT3V0cHV0ID0gYXdhaXQgdGhpcy53cml0ZVdhc2lCaW5kaW5nKFxuICAgICAgICB3YXNtQmluYXJ5TmFtZSxcbiAgICAgICAgaWRlbnRzLFxuICAgICAgKVxuICAgICAgaWYgKGpzT3V0cHV0KSB7XG4gICAgICAgIHRoaXMub3V0cHV0cy5wdXNoKGpzT3V0cHV0KVxuICAgICAgfVxuICAgICAgaWYgKHdhc21CaW5kaW5nc091dHB1dCkge1xuICAgICAgICB0aGlzLm91dHB1dHMucHVzaCguLi53YXNtQmluZGluZ3NPdXRwdXQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMub3V0cHV0c1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBjb3B5QXJ0aWZhY3QoKSB7XG4gICAgY29uc3QgW3NyY05hbWUsIGRlc3ROYW1lLCB3YXNtQmluYXJ5TmFtZV0gPSB0aGlzLmdldEFydGlmYWN0TmFtZXMoKVxuICAgIGlmICghc3JjTmFtZSB8fCAhZGVzdE5hbWUpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGNvbnN0IHByb2ZpbGUgPVxuICAgICAgdGhpcy5vcHRpb25zLnByb2ZpbGUgPz8gKHRoaXMub3B0aW9ucy5yZWxlYXNlID8gJ3JlbGVhc2UnIDogJ2RlYnVnJylcbiAgICBjb25zdCBzcmMgPSBqb2luKHRoaXMudGFyZ2V0RGlyLCB0aGlzLnRhcmdldC50cmlwbGUsIHByb2ZpbGUsIHNyY05hbWUpXG4gICAgZGVidWcoYENvcHkgYXJ0aWZhY3QgZnJvbTogWyR7c3JjfV1gKVxuICAgIGNvbnN0IGRlc3QgPSBqb2luKHRoaXMub3V0cHV0RGlyLCBkZXN0TmFtZSlcbiAgICBjb25zdCBpc1dhc20gPSBkZXN0LmVuZHNXaXRoKCcud2FzbScpXG5cbiAgICB0cnkge1xuICAgICAgaWYgKGF3YWl0IGZpbGVFeGlzdHMoZGVzdCkpIHtcbiAgICAgICAgZGVidWcoJ09sZCBhcnRpZmFjdCBmb3VuZCwgcmVtb3ZlIGl0IGZpcnN0JylcbiAgICAgICAgYXdhaXQgdW5saW5rQXN5bmMoZGVzdClcbiAgICAgIH1cbiAgICAgIGRlYnVnKCdDb3B5IGFydGlmYWN0IHRvOicpXG4gICAgICBkZWJ1ZygnICAlaScsIGRlc3QpXG4gICAgICBpZiAoaXNXYXNtKSB7XG4gICAgICAgIGNvbnN0IHsgTW9kdWxlQ29uZmlnIH0gPSBhd2FpdCBpbXBvcnQoJ0BuYXBpLXJzL3dhc20tdG9vbHMnKVxuICAgICAgICBkZWJ1ZygnR2VuZXJhdGUgZGVidWcgd2FzbSBtb2R1bGUnKVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGRlYnVnV2FzbU1vZHVsZSA9IG5ldyBNb2R1bGVDb25maWcoKVxuICAgICAgICAgICAgLmdlbmVyYXRlRHdhcmYodHJ1ZSlcbiAgICAgICAgICAgIC5nZW5lcmF0ZU5hbWVTZWN0aW9uKHRydWUpXG4gICAgICAgICAgICAuZ2VuZXJhdGVQcm9kdWNlcnNTZWN0aW9uKHRydWUpXG4gICAgICAgICAgICAucHJlc2VydmVDb2RlVHJhbnNmb3JtKHRydWUpXG4gICAgICAgICAgICAuc3RyaWN0VmFsaWRhdGUoZmFsc2UpXG4gICAgICAgICAgICAucGFyc2UoYXdhaXQgcmVhZEZpbGVBc3luYyhzcmMpKVxuICAgICAgICAgIGNvbnN0IGRlYnVnV2FzbUJpbmFyeSA9IGRlYnVnV2FzbU1vZHVsZS5lbWl0V2FzbSh0cnVlKVxuICAgICAgICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKFxuICAgICAgICAgICAgZGVzdC5yZXBsYWNlKC9cXC53YXNtJC8sICcuZGVidWcud2FzbScpLFxuICAgICAgICAgICAgZGVidWdXYXNtQmluYXJ5LFxuICAgICAgICAgIClcbiAgICAgICAgICBkZWJ1ZygnR2VuZXJhdGUgcmVsZWFzZSB3YXNtIG1vZHVsZScpXG4gICAgICAgICAgY29uc3QgcmVsZWFzZVdhc21Nb2R1bGUgPSBuZXcgTW9kdWxlQ29uZmlnKClcbiAgICAgICAgICAgIC5nZW5lcmF0ZUR3YXJmKGZhbHNlKVxuICAgICAgICAgICAgLmdlbmVyYXRlTmFtZVNlY3Rpb24oZmFsc2UpXG4gICAgICAgICAgICAuZ2VuZXJhdGVQcm9kdWNlcnNTZWN0aW9uKGZhbHNlKVxuICAgICAgICAgICAgLnByZXNlcnZlQ29kZVRyYW5zZm9ybShmYWxzZSlcbiAgICAgICAgICAgIC5zdHJpY3RWYWxpZGF0ZShmYWxzZSlcbiAgICAgICAgICAgIC5vbmx5U3RhYmxlRmVhdHVyZXMoZmFsc2UpXG4gICAgICAgICAgICAucGFyc2UoZGVidWdXYXNtQmluYXJ5KVxuICAgICAgICAgIGNvbnN0IHJlbGVhc2VXYXNtQmluYXJ5ID0gcmVsZWFzZVdhc21Nb2R1bGUuZW1pdFdhc20oZmFsc2UpXG4gICAgICAgICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoZGVzdCwgcmVsZWFzZVdhc21CaW5hcnkpXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBkZWJ1Zy53YXJuKFxuICAgICAgICAgICAgYEZhaWxlZCB0byBnZW5lcmF0ZSBkZWJ1ZyB3YXNtIG1vZHVsZTogJHsoZSBhcyBhbnkpLm1lc3NhZ2UgPz8gZX1gLFxuICAgICAgICAgIClcbiAgICAgICAgICBhd2FpdCBjb3B5RmlsZUFzeW5jKHNyYywgZGVzdClcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgY29weUZpbGVBc3luYyhzcmMsIGRlc3QpXG4gICAgICB9XG4gICAgICB0aGlzLm91dHB1dHMucHVzaCh7XG4gICAgICAgIGtpbmQ6IGRlc3QuZW5kc1dpdGgoJy5ub2RlJykgPyAnbm9kZScgOiBpc1dhc20gPyAnd2FzbScgOiAnZXhlJyxcbiAgICAgICAgcGF0aDogZGVzdCxcbiAgICAgIH0pXG4gICAgICByZXR1cm4gd2FzbUJpbmFyeU5hbWUgPyBqb2luKHRoaXMub3V0cHV0RGlyLCB3YXNtQmluYXJ5TmFtZSkgOiBudWxsXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gY29weSBhcnRpZmFjdCcsIHsgY2F1c2U6IGUgfSlcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldEFydGlmYWN0TmFtZXMoKSB7XG4gICAgaWYgKHRoaXMuY2R5TGliTmFtZSkge1xuICAgICAgY29uc3QgY2R5TGliID0gdGhpcy5jZHlMaWJOYW1lLnJlcGxhY2UoLy0vZywgJ18nKVxuICAgICAgY29uc3Qgd2FzaVRhcmdldCA9IHRoaXMuY29uZmlnLnRhcmdldHMuZmluZCgodCkgPT4gdC5wbGF0Zm9ybSA9PT0gJ3dhc2knKVxuXG4gICAgICBjb25zdCBzcmNOYW1lID1cbiAgICAgICAgdGhpcy50YXJnZXQucGxhdGZvcm0gPT09ICdkYXJ3aW4nXG4gICAgICAgICAgPyBgbGliJHtjZHlMaWJ9LmR5bGliYFxuICAgICAgICAgIDogdGhpcy50YXJnZXQucGxhdGZvcm0gPT09ICd3aW4zMidcbiAgICAgICAgICAgID8gYCR7Y2R5TGlifS5kbGxgXG4gICAgICAgICAgICA6IHRoaXMudGFyZ2V0LnBsYXRmb3JtID09PSAnd2FzaScgfHwgdGhpcy50YXJnZXQucGxhdGZvcm0gPT09ICd3YXNtJ1xuICAgICAgICAgICAgICA/IGAke2NkeUxpYn0ud2FzbWBcbiAgICAgICAgICAgICAgOiBgbGliJHtjZHlMaWJ9LnNvYFxuXG4gICAgICBsZXQgZGVzdE5hbWUgPSB0aGlzLmNvbmZpZy5iaW5hcnlOYW1lXG4gICAgICAvLyBhZGQgcGxhdGZvcm0gc3VmZml4IHRvIGJpbmFyeSBuYW1lXG4gICAgICAvLyBpbmRleFsubGludXgteDY0LWdudV0ubm9kZVxuICAgICAgLy8gICAgICAgXl5eXl5eXl5eXl5eXl5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMucGxhdGZvcm0pIHtcbiAgICAgICAgZGVzdE5hbWUgKz0gYC4ke3RoaXMudGFyZ2V0LnBsYXRmb3JtQXJjaEFCSX1gXG4gICAgICB9XG4gICAgICBpZiAoc3JjTmFtZS5lbmRzV2l0aCgnLndhc20nKSkge1xuICAgICAgICBkZXN0TmFtZSArPSAnLndhc20nXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZXN0TmFtZSArPSAnLm5vZGUnXG4gICAgICB9XG5cbiAgICAgIHJldHVybiBbXG4gICAgICAgIHNyY05hbWUsXG4gICAgICAgIGRlc3ROYW1lLFxuICAgICAgICB3YXNpVGFyZ2V0XG4gICAgICAgICAgPyBgJHt0aGlzLmNvbmZpZy5iaW5hcnlOYW1lfS4ke3dhc2lUYXJnZXQucGxhdGZvcm1BcmNoQUJJfS53YXNtYFxuICAgICAgICAgIDogbnVsbCxcbiAgICAgIF1cbiAgICB9IGVsc2UgaWYgKHRoaXMuYmluTmFtZSkge1xuICAgICAgY29uc3Qgc3JjTmFtZSA9XG4gICAgICAgIHRoaXMudGFyZ2V0LnBsYXRmb3JtID09PSAnd2luMzInID8gYCR7dGhpcy5iaW5OYW1lfS5leGVgIDogdGhpcy5iaW5OYW1lXG5cbiAgICAgIHJldHVybiBbc3JjTmFtZSwgc3JjTmFtZV1cbiAgICB9XG5cbiAgICByZXR1cm4gW11cbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZ2VuZXJhdGVUeXBlRGVmKCkge1xuICAgIGNvbnN0IHR5cGVEZWZEaXIgPSB0aGlzLmVudnMuTkFQSV9UWVBFX0RFRl9UTVBfRk9MREVSXG4gICAgaWYgKCF0aGlzLmVuYWJsZVR5cGVEZWYpIHtcbiAgICAgIHJldHVybiBbXVxuICAgIH1cblxuICAgIGNvbnN0IHsgZXhwb3J0cywgZHRzIH0gPSBhd2FpdCBnZW5lcmF0ZVR5cGVEZWYoe1xuICAgICAgdHlwZURlZkRpcixcbiAgICAgIG5vRHRzSGVhZGVyOiB0aGlzLm9wdGlvbnMubm9EdHNIZWFkZXIsXG4gICAgICBkdHNIZWFkZXI6IHRoaXMub3B0aW9ucy5kdHNIZWFkZXIsXG4gICAgICBjb25maWdEdHNIZWFkZXI6IHRoaXMuY29uZmlnLmR0c0hlYWRlcixcbiAgICAgIGNvbmZpZ0R0c0hlYWRlckZpbGU6IHRoaXMuY29uZmlnLmR0c0hlYWRlckZpbGUsXG4gICAgICBjb25zdEVudW06IHRoaXMub3B0aW9ucy5jb25zdEVudW0gPz8gdGhpcy5jb25maWcuY29uc3RFbnVtLFxuICAgICAgcnVudGltZVN0cmluZ0VudW06XG4gICAgICAgIHRoaXMub3B0aW9ucy5ydW50aW1lU3RyaW5nRW51bSA/PyB0aGlzLmNvbmZpZy5ydW50aW1lU3RyaW5nRW51bSxcbiAgICAgIGN3ZDogdGhpcy5vcHRpb25zLmN3ZCxcbiAgICB9KVxuXG4gICAgY29uc3QgZGVzdCA9IGpvaW4odGhpcy5vdXRwdXREaXIsIHRoaXMub3B0aW9ucy5kdHMgPz8gJ2luZGV4LmQudHMnKVxuXG4gICAgdHJ5IHtcbiAgICAgIGRlYnVnKCdXcml0aW5nIHR5cGUgZGVmIHRvOicpXG4gICAgICBkZWJ1ZygnICAlaScsIGRlc3QpXG4gICAgICBhd2FpdCB3cml0ZUZpbGVBc3luYyhkZXN0LCBkdHMsICd1dGYtOCcpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZGVidWcuZXJyb3IoJ0ZhaWxlZCB0byB3cml0ZSB0eXBlIGRlZiBmaWxlJylcbiAgICAgIGRlYnVnLmVycm9yKGUgYXMgRXJyb3IpXG4gICAgfVxuXG4gICAgaWYgKGV4cG9ydHMubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZGVzdCA9IGpvaW4odGhpcy5vdXRwdXREaXIsIHRoaXMub3B0aW9ucy5kdHMgPz8gJ2luZGV4LmQudHMnKVxuICAgICAgdGhpcy5vdXRwdXRzLnB1c2goeyBraW5kOiAnZHRzJywgcGF0aDogZGVzdCB9KVxuICAgIH1cblxuICAgIHJldHVybiBleHBvcnRzXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHdyaXRlSnNCaW5kaW5nKGlkZW50czogc3RyaW5nW10pIHtcbiAgICByZXR1cm4gd3JpdGVKc0JpbmRpbmcoe1xuICAgICAgcGxhdGZvcm06IHRoaXMub3B0aW9ucy5wbGF0Zm9ybSxcbiAgICAgIG5vSnNCaW5kaW5nOiB0aGlzLm9wdGlvbnMubm9Kc0JpbmRpbmcsXG4gICAgICBpZGVudHMsXG4gICAgICBqc0JpbmRpbmc6IHRoaXMub3B0aW9ucy5qc0JpbmRpbmcsXG4gICAgICBlc206IHRoaXMub3B0aW9ucy5lc20sXG4gICAgICBiaW5hcnlOYW1lOiB0aGlzLmNvbmZpZy5iaW5hcnlOYW1lLFxuICAgICAgcGFja2FnZU5hbWU6IHRoaXMub3B0aW9ucy5qc1BhY2thZ2VOYW1lID8/IHRoaXMuY29uZmlnLnBhY2thZ2VOYW1lLFxuICAgICAgdmVyc2lvbjogcHJvY2Vzcy5lbnYubnBtX25ld192ZXJzaW9uID8/IHRoaXMuY29uZmlnLnBhY2thZ2VKc29uLnZlcnNpb24sXG4gICAgICBvdXRwdXREaXI6IHRoaXMub3V0cHV0RGlyLFxuICAgIH0pXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHdyaXRlV2FzaUJpbmRpbmcoXG4gICAgZGlzdEZpbGVOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsLFxuICAgIGlkZW50czogc3RyaW5nW10sXG4gICkge1xuICAgIGlmIChkaXN0RmlsZU5hbWUpIHtcbiAgICAgIGNvbnN0IHsgbmFtZSwgZGlyIH0gPSBwYXJzZShkaXN0RmlsZU5hbWUpXG4gICAgICBjb25zdCBiaW5kaW5nUGF0aCA9IGpvaW4oZGlyLCBgJHt0aGlzLmNvbmZpZy5iaW5hcnlOYW1lfS53YXNpLmNqc2ApXG4gICAgICBjb25zdCBicm93c2VyQmluZGluZ1BhdGggPSBqb2luKFxuICAgICAgICBkaXIsXG4gICAgICAgIGAke3RoaXMuY29uZmlnLmJpbmFyeU5hbWV9Lndhc2ktYnJvd3Nlci5qc2AsXG4gICAgICApXG4gICAgICBjb25zdCB3b3JrZXJQYXRoID0gam9pbihkaXIsICd3YXNpLXdvcmtlci5tanMnKVxuICAgICAgY29uc3QgYnJvd3NlcldvcmtlclBhdGggPSBqb2luKGRpciwgJ3dhc2ktd29ya2VyLWJyb3dzZXIubWpzJylcbiAgICAgIGNvbnN0IGJyb3dzZXJFbnRyeVBhdGggPSBqb2luKGRpciwgJ2Jyb3dzZXIuanMnKVxuICAgICAgY29uc3QgZXhwb3J0c0NvZGUgPVxuICAgICAgICBgbW9kdWxlLmV4cG9ydHMgPSBfX25hcGlNb2R1bGUuZXhwb3J0c1xcbmAgK1xuICAgICAgICBpZGVudHNcbiAgICAgICAgICAubWFwKFxuICAgICAgICAgICAgKGlkZW50KSA9PlxuICAgICAgICAgICAgICBgbW9kdWxlLmV4cG9ydHMuJHtpZGVudH0gPSBfX25hcGlNb2R1bGUuZXhwb3J0cy4ke2lkZW50fWAsXG4gICAgICAgICAgKVxuICAgICAgICAgIC5qb2luKCdcXG4nKVxuICAgICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoXG4gICAgICAgIGJpbmRpbmdQYXRoLFxuICAgICAgICBjcmVhdGVXYXNpQmluZGluZyhcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIHRoaXMuY29uZmlnLnBhY2thZ2VOYW1lLFxuICAgICAgICAgIHRoaXMuY29uZmlnLndhc20/LmluaXRpYWxNZW1vcnksXG4gICAgICAgICAgdGhpcy5jb25maWcud2FzbT8ubWF4aW11bU1lbW9yeSxcbiAgICAgICAgKSArXG4gICAgICAgICAgZXhwb3J0c0NvZGUgK1xuICAgICAgICAgICdcXG4nLFxuICAgICAgICAndXRmOCcsXG4gICAgICApXG4gICAgICBhd2FpdCB3cml0ZUZpbGVBc3luYyhcbiAgICAgICAgYnJvd3NlckJpbmRpbmdQYXRoLFxuICAgICAgICBjcmVhdGVXYXNpQnJvd3NlckJpbmRpbmcoXG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICB0aGlzLmNvbmZpZy53YXNtPy5pbml0aWFsTWVtb3J5LFxuICAgICAgICAgIHRoaXMuY29uZmlnLndhc20/Lm1heGltdW1NZW1vcnksXG4gICAgICAgICAgdGhpcy5jb25maWcud2FzbT8uYnJvd3Nlcj8uZnMsXG4gICAgICAgICAgdGhpcy5jb25maWcud2FzbT8uYnJvd3Nlcj8uYXN5bmNJbml0LFxuICAgICAgICAgIHRoaXMuY29uZmlnLndhc20/LmJyb3dzZXI/LmJ1ZmZlcixcbiAgICAgICAgICB0aGlzLmNvbmZpZy53YXNtPy5icm93c2VyPy5lcnJvckV2ZW50LFxuICAgICAgICApICtcbiAgICAgICAgICBgZXhwb3J0IGRlZmF1bHQgX19uYXBpTW9kdWxlLmV4cG9ydHNcXG5gICtcbiAgICAgICAgICBpZGVudHNcbiAgICAgICAgICAgIC5tYXAoXG4gICAgICAgICAgICAgIChpZGVudCkgPT5cbiAgICAgICAgICAgICAgICBgZXhwb3J0IGNvbnN0ICR7aWRlbnR9ID0gX19uYXBpTW9kdWxlLmV4cG9ydHMuJHtpZGVudH1gLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmpvaW4oJ1xcbicpICtcbiAgICAgICAgICAnXFxuJyxcbiAgICAgICAgJ3V0ZjgnLFxuICAgICAgKVxuICAgICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMod29ya2VyUGF0aCwgV0FTSV9XT1JLRVJfVEVNUExBVEUsICd1dGY4JylcbiAgICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKFxuICAgICAgICBicm93c2VyV29ya2VyUGF0aCxcbiAgICAgICAgY3JlYXRlV2FzaUJyb3dzZXJXb3JrZXJCaW5kaW5nKFxuICAgICAgICAgIHRoaXMuY29uZmlnLndhc20/LmJyb3dzZXI/LmZzID8/IGZhbHNlLFxuICAgICAgICAgIHRoaXMuY29uZmlnLndhc20/LmJyb3dzZXI/LmVycm9yRXZlbnQgPz8gZmFsc2UsXG4gICAgICAgICksXG4gICAgICAgICd1dGY4JyxcbiAgICAgIClcbiAgICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKFxuICAgICAgICBicm93c2VyRW50cnlQYXRoLFxuICAgICAgICBgZXhwb3J0ICogZnJvbSAnJHt0aGlzLmNvbmZpZy5wYWNrYWdlTmFtZX0td2FzbTMyLXdhc2knXFxuYCxcbiAgICAgIClcbiAgICAgIHJldHVybiBbXG4gICAgICAgIHsga2luZDogJ2pzJywgcGF0aDogYmluZGluZ1BhdGggfSxcbiAgICAgICAgeyBraW5kOiAnanMnLCBwYXRoOiBicm93c2VyQmluZGluZ1BhdGggfSxcbiAgICAgICAgeyBraW5kOiAnanMnLCBwYXRoOiB3b3JrZXJQYXRoIH0sXG4gICAgICAgIHsga2luZDogJ2pzJywgcGF0aDogYnJvd3NlcldvcmtlclBhdGggfSxcbiAgICAgICAgeyBraW5kOiAnanMnLCBwYXRoOiBicm93c2VyRW50cnlQYXRoIH0sXG4gICAgICBdIHNhdGlzZmllcyBPdXRwdXRbXVxuICAgIH1cbiAgICByZXR1cm4gW11cbiAgfVxuXG4gIHByaXZhdGUgc2V0RW52SWZOb3RFeGlzdHMoZW52OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpIHtcbiAgICBpZiAoIXByb2Nlc3MuZW52W2Vudl0pIHtcbiAgICAgIHRoaXMuZW52c1tlbnZdID0gdmFsdWVcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBXcml0ZUpzQmluZGluZ09wdGlvbnMge1xuICBwbGF0Zm9ybT86IGJvb2xlYW5cbiAgbm9Kc0JpbmRpbmc/OiBib29sZWFuXG4gIGlkZW50czogc3RyaW5nW11cbiAganNCaW5kaW5nPzogc3RyaW5nXG4gIGVzbT86IGJvb2xlYW5cbiAgYmluYXJ5TmFtZTogc3RyaW5nXG4gIHBhY2thZ2VOYW1lOiBzdHJpbmdcbiAgdmVyc2lvbjogc3RyaW5nXG4gIG91dHB1dERpcjogc3RyaW5nXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3cml0ZUpzQmluZGluZyhcbiAgb3B0aW9uczogV3JpdGVKc0JpbmRpbmdPcHRpb25zLFxuKTogUHJvbWlzZTxPdXRwdXQgfCB1bmRlZmluZWQ+IHtcbiAgaWYgKFxuICAgICFvcHRpb25zLnBsYXRmb3JtIHx8XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9wcmVmZXItbnVsbGlzaC1jb2FsZXNjaW5nXG4gICAgb3B0aW9ucy5ub0pzQmluZGluZyB8fFxuICAgIG9wdGlvbnMuaWRlbnRzLmxlbmd0aCA9PT0gMFxuICApIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIGNvbnN0IG5hbWUgPSBvcHRpb25zLmpzQmluZGluZyA/PyAnaW5kZXguanMnXG5cbiAgY29uc3QgY3JlYXRlQmluZGluZyA9IG9wdGlvbnMuZXNtID8gY3JlYXRlRXNtQmluZGluZyA6IGNyZWF0ZUNqc0JpbmRpbmdcbiAgY29uc3QgYmluZGluZyA9IGNyZWF0ZUJpbmRpbmcoXG4gICAgb3B0aW9ucy5iaW5hcnlOYW1lLFxuICAgIG9wdGlvbnMucGFja2FnZU5hbWUsXG4gICAgb3B0aW9ucy5pZGVudHMsXG4gICAgLy8gaW4gbnBtIHByZXZlcnNpb24gaG9va1xuICAgIG9wdGlvbnMudmVyc2lvbixcbiAgKVxuXG4gIHRyeSB7XG4gICAgY29uc3QgZGVzdCA9IGpvaW4ob3B0aW9ucy5vdXRwdXREaXIsIG5hbWUpXG4gICAgZGVidWcoJ1dyaXRpbmcganMgYmluZGluZyB0bzonKVxuICAgIGRlYnVnKCcgICVpJywgZGVzdClcbiAgICBhd2FpdCB3cml0ZUZpbGVBc3luYyhkZXN0LCBiaW5kaW5nLCAndXRmLTgnKVxuICAgIHJldHVybiB7IGtpbmQ6ICdqcycsIHBhdGg6IGRlc3QgfSBzYXRpc2ZpZXMgT3V0cHV0XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byB3cml0ZSBqcyBiaW5kaW5nIGZpbGUnLCB7IGNhdXNlOiBlIH0pXG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBHZW5lcmF0ZVR5cGVEZWZPcHRpb25zIHtcbiAgdHlwZURlZkRpcjogc3RyaW5nXG4gIG5vRHRzSGVhZGVyPzogYm9vbGVhblxuICBkdHNIZWFkZXI/OiBzdHJpbmdcbiAgZHRzSGVhZGVyRmlsZT86IHN0cmluZ1xuICBjb25maWdEdHNIZWFkZXI/OiBzdHJpbmdcbiAgY29uZmlnRHRzSGVhZGVyRmlsZT86IHN0cmluZ1xuICBjb25zdEVudW0/OiBib29sZWFuXG4gIHJ1bnRpbWVTdHJpbmdFbnVtPzogYm9vbGVhblxuICBjd2Q6IHN0cmluZ1xufVxuXG4vKipcbiAqIFdhbGsgdGhlIG5hcGktZGVyaXZlIGludGVybWVkaWF0ZSB0eXBlLWRlZiBkaXJlY3RvcnksIHJlbmRlciBldmVyeSBlbnRyeVxuICogaW50byBUeXBlU2NyaXB0IHZpYSB7QGxpbmsgcHJvY2Vzc1R5cGVEZWZ9LCBhbmQgcmV0dXJuIHRoZSBjb25jYXRlbmF0ZWRcbiAqIGAuZC50c2Agc291cmNlIHBsdXMgdGhlIGxpc3Qgb2YgaWRlbnRpZmllcnMgdG8gcmUtZXhwb3J0IGZyb21cbiAqIGBpbmRleC5qc2AuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZVR5cGVEZWYoXG4gIG9wdGlvbnM6IEdlbmVyYXRlVHlwZURlZk9wdGlvbnMsXG4pOiBQcm9taXNlPHsgZXhwb3J0czogc3RyaW5nW107IGR0czogc3RyaW5nIH0+IHtcbiAgaWYgKCEoYXdhaXQgZGlyRXhpc3RzQXN5bmMob3B0aW9ucy50eXBlRGVmRGlyKSkpIHtcbiAgICByZXR1cm4geyBleHBvcnRzOiBbXSwgZHRzOiAnJyB9XG4gIH1cblxuICBsZXQgaGVhZGVyID0gJydcbiAgbGV0IGR0cyA9ICcnXG4gIGxldCBleHBvcnRzOiBzdHJpbmdbXSA9IFtdXG5cbiAgaWYgKCFvcHRpb25zLm5vRHRzSGVhZGVyKSB7XG4gICAgY29uc3QgZHRzSGVhZGVyID0gb3B0aW9ucy5kdHNIZWFkZXIgPz8gb3B0aW9ucy5jb25maWdEdHNIZWFkZXJcbiAgICBjb25zdCBkdHNIZWFkZXJGaWxlID0gb3B0aW9ucy5kdHNIZWFkZXJGaWxlID8/IG9wdGlvbnMuY29uZmlnRHRzSGVhZGVyRmlsZVxuICAgIC8vIEFuIGV4cGxpY2l0IEFQSSBoZWFkZXIgZmlsZSB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgdGhlIGNvbmZpZyBmaWxlO1xuICAgIC8vIGVpdGhlciBmaWxlIHRha2VzIHByZWNlZGVuY2Ugb3ZlciBpbmxpbmUgaGVhZGVyIHRleHQuXG4gICAgaWYgKGR0c0hlYWRlckZpbGUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGhlYWRlciA9IGF3YWl0IHJlYWRGaWxlQXN5bmMoam9pbihvcHRpb25zLmN3ZCwgZHRzSGVhZGVyRmlsZSksICd1dGYtOCcpXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGRlYnVnLndhcm4oYEZhaWxlZCB0byByZWFkIGR0cyBoZWFkZXIgZmlsZSAke2R0c0hlYWRlckZpbGV9YCwgZSlcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGR0c0hlYWRlcikge1xuICAgICAgaGVhZGVyID0gZHRzSGVhZGVyXG4gICAgfSBlbHNlIHtcbiAgICAgIGhlYWRlciA9IERFRkFVTFRfVFlQRV9ERUZfSEVBREVSXG4gICAgfVxuICB9XG5cbiAgY29uc3QgZmlsZXMgPSBhd2FpdCByZWFkZGlyQXN5bmMob3B0aW9ucy50eXBlRGVmRGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcblxuICBpZiAoIWZpbGVzLmxlbmd0aCkge1xuICAgIGRlYnVnKCdObyB0eXBlIGRlZiBmaWxlcyBmb3VuZC4gU2tpcCBnZW5lcmF0aW5nIGR0cyBmaWxlLicpXG4gICAgcmV0dXJuIHsgZXhwb3J0czogW10sIGR0czogJycgfVxuICB9XG5cbiAgY29uc3QgdHlwZURlZkZpbGVzID0gZmlsZXNcbiAgICAuZmlsdGVyKChmaWxlKSA9PiBmaWxlLmlzRmlsZSgpKVxuICAgIC5zb3J0KChhLCBiKSA9PiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKVxuXG4gIGNvbnN0IGNvbnN0RW51bSA9IG9wdGlvbnMuY29uc3RFbnVtID8/IHRydWVcbiAgY29uc3QgcnVudGltZVN0cmluZ0VudW0gPSBvcHRpb25zLnJ1bnRpbWVTdHJpbmdFbnVtID8/IGZhbHNlXG4gIGlmIChydW50aW1lU3RyaW5nRW51bSAmJiBjb25zdEVudW0pIHtcbiAgICBkZWJ1Zy53YXJuKFxuICAgICAgJ2AtLXJ1bnRpbWUtc3RyaW5nLWVudW1gIGhhcyBubyBlZmZlY3Qgd2hlbiBgLS1jb25zdC1lbnVtYCBpcyBlbmFibGVkICh0aGUgZGVmYXVsdCkuIFBhc3MgYC0tbm8tY29uc3QtZW51bWAgdG8gYWN0aXZhdGUgcnVudGltZSBzdHJpbmcgZW51bSBlbWlzc2lvbi4nLFxuICAgIClcbiAgfVxuXG4gIGNvbnN0IHByb2Nlc3NlZFR5cGVEZWZzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgdHlwZURlZkZpbGVzLm1hcCgoZmlsZSkgPT5cbiAgICAgIHByb2Nlc3NUeXBlRGVmKFxuICAgICAgICBqb2luKG9wdGlvbnMudHlwZURlZkRpciwgZmlsZS5uYW1lKSxcbiAgICAgICAgY29uc3RFbnVtLFxuICAgICAgICBydW50aW1lU3RyaW5nRW51bSxcbiAgICAgICksXG4gICAgKSxcbiAgKVxuXG4gIGR0cyA9IHByb2Nlc3NlZFR5cGVEZWZzLm1hcCgoeyBkdHMgfSkgPT4gZHRzKS5qb2luKCcnKVxuICBleHBvcnRzID0gcHJvY2Vzc2VkVHlwZURlZnMuZmxhdE1hcCgoeyBleHBvcnRzIH0pID0+IGV4cG9ydHMpXG5cbiAgaWYgKGR0cy5pbmRleE9mKCdFeHRlcm5hbE9iamVjdDwnKSA+IC0xKSB7XG4gICAgaGVhZGVyICs9IGBcbmV4cG9ydCBkZWNsYXJlIGNsYXNzIEV4dGVybmFsT2JqZWN0PFQ+IHtcbiAgcmVhZG9ubHkgJyc6IHtcbiAgICByZWFkb25seSAnJzogdW5pcXVlIHN5bWJvbFxuICAgIFtLOiBzeW1ib2xdOiBUXG4gIH1cbn1cbmBcbiAgfVxuXG4gIGlmIChkdHMuaW5kZXhPZignVHlwZWRBcnJheScpID4gLTEpIHtcbiAgICBoZWFkZXIgKz0gYFxuZXhwb3J0IHR5cGUgVHlwZWRBcnJheSA9IEludDhBcnJheSB8IFVpbnQ4QXJyYXkgfCBVaW50OENsYW1wZWRBcnJheSB8IEludDE2QXJyYXkgfCBVaW50MTZBcnJheSB8IEludDMyQXJyYXkgfCBVaW50MzJBcnJheSB8IEZsb2F0MzJBcnJheSB8IEZsb2F0NjRBcnJheSB8IEJpZ0ludDY0QXJyYXkgfCBCaWdVaW50NjRBcnJheVxuYFxuICB9XG5cbiAgZHRzID0gaGVhZGVyICsgZHRzXG5cbiAgcmV0dXJuIHtcbiAgICBleHBvcnRzLFxuICAgIGR0cyxcbiAgfVxufVxuIiwiLy8gVGhpcyBmaWxlIGlzIGdlbmVyYXRlZCBieSBjb2RlZ2VuL2luZGV4LnRzXG4vLyBEbyBub3QgZWRpdCB0aGlzIGZpbGUgbWFudWFsbHlcbmltcG9ydCB7IENvbW1hbmQsIE9wdGlvbiB9IGZyb20gJ2NsaXBhbmlvbidcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VDcmVhdGVOcG1EaXJzQ29tbWFuZCBleHRlbmRzIENvbW1hbmQge1xuICBzdGF0aWMgcGF0aHMgPSBbWydjcmVhdGUtbnBtLWRpcnMnXV1cblxuICBzdGF0aWMgdXNhZ2UgPSBDb21tYW5kLlVzYWdlKHtcbiAgICBkZXNjcmlwdGlvbjogJ0NyZWF0ZSBucG0gcGFja2FnZSBkaXJzIGZvciBkaWZmZXJlbnQgcGxhdGZvcm1zJyxcbiAgfSlcblxuICBjd2QgPSBPcHRpb24uU3RyaW5nKCctLWN3ZCcsIHByb2Nlc3MuY3dkKCksIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGgnLFxuICB9KVxuXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWNvbmZpZy1wYXRoLC1jJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZScsXG4gIH0pXG5cbiAgcGFja2FnZUpzb25QYXRoID0gT3B0aW9uLlN0cmluZygnLS1wYWNrYWdlLWpzb24tcGF0aCcsICdwYWNrYWdlLmpzb24nLCB7XG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGBwYWNrYWdlLmpzb25gJyxcbiAgfSlcblxuICBucG1EaXIgPSBPcHRpb24uU3RyaW5nKCctLW5wbS1kaXInLCAnbnBtJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0JyxcbiAgfSlcblxuICBkcnlSdW4gPSBPcHRpb24uQm9vbGVhbignLS1kcnktcnVuJywgZmFsc2UsIHtcbiAgICBkZXNjcmlwdGlvbjogJ0RyeSBydW4gd2l0aG91dCB0b3VjaGluZyBmaWxlIHN5c3RlbScsXG4gIH0pXG5cbiAgZ2V0T3B0aW9ucygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY3dkOiB0aGlzLmN3ZCxcbiAgICAgIGNvbmZpZ1BhdGg6IHRoaXMuY29uZmlnUGF0aCxcbiAgICAgIHBhY2thZ2VKc29uUGF0aDogdGhpcy5wYWNrYWdlSnNvblBhdGgsXG4gICAgICBucG1EaXI6IHRoaXMubnBtRGlyLFxuICAgICAgZHJ5UnVuOiB0aGlzLmRyeVJ1bixcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGUgbnBtIHBhY2thZ2UgZGlycyBmb3IgZGlmZmVyZW50IHBsYXRmb3Jtc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIENyZWF0ZU5wbURpcnNPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aFxuICAgKlxuICAgKiBAZGVmYXVsdCBwcm9jZXNzLmN3ZCgpXG4gICAqL1xuICBjd2Q/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICovXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gYHBhY2thZ2UuanNvbmBcbiAgICpcbiAgICogQGRlZmF1bHQgJ3BhY2thZ2UuanNvbidcbiAgICovXG4gIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0XG4gICAqXG4gICAqIEBkZWZhdWx0ICducG0nXG4gICAqL1xuICBucG1EaXI/OiBzdHJpbmdcbiAgLyoqXG4gICAqIERyeSBydW4gd2l0aG91dCB0b3VjaGluZyBmaWxlIHN5c3RlbVxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgZHJ5UnVuPzogYm9vbGVhblxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlEZWZhdWx0Q3JlYXRlTnBtRGlyc09wdGlvbnMoXG4gIG9wdGlvbnM6IENyZWF0ZU5wbURpcnNPcHRpb25zLFxuKSB7XG4gIHJldHVybiB7XG4gICAgY3dkOiBwcm9jZXNzLmN3ZCgpLFxuICAgIHBhY2thZ2VKc29uUGF0aDogJ3BhY2thZ2UuanNvbicsXG4gICAgbnBtRGlyOiAnbnBtJyxcbiAgICBkcnlSdW46IGZhbHNlLFxuICAgIC4uLm9wdGlvbnMsXG4gIH1cbn1cbiIsImltcG9ydCB7IGNyZWF0ZVJlcXVpcmUgfSBmcm9tICdub2RlOm1vZHVsZSdcbmltcG9ydCB7IGpvaW4sIHJlc29sdmUgfSBmcm9tICdub2RlOnBhdGgnXG5cbmltcG9ydCB7IENvbXBhcmF0b3IsIFJhbmdlLCBtaW5WZXJzaW9uLCBzdWJzZXQgfSBmcm9tICdzZW12ZXInXG5cbmNvbnN0IHJlcXVpcmUgPSBjcmVhdGVSZXF1aXJlKGltcG9ydC5tZXRhLnVybClcbmNvbnN0IG1pbmltdW1XYXNpTm9kZVZlcnNpb24gPSAnPj0xNC4wLjAnXG5cbmltcG9ydCB7XG4gIGFwcGx5RGVmYXVsdENyZWF0ZU5wbURpcnNPcHRpb25zLFxuICB0eXBlIENyZWF0ZU5wbURpcnNPcHRpb25zLFxufSBmcm9tICcuLi9kZWYvY3JlYXRlLW5wbS1kaXJzLmpzJ1xuaW1wb3J0IHtcbiAgZGVidWdGYWN0b3J5LFxuICByZWFkTmFwaUNvbmZpZyxcbiAgbWtkaXJBc3luYyBhcyByYXdNa2RpckFzeW5jLFxuICBwaWNrLFxuICB3cml0ZUZpbGVBc3luYyBhcyByYXdXcml0ZUZpbGVBc3luYyxcbiAgdHlwZSBUYXJnZXQsXG4gIHR5cGUgQ29tbW9uUGFja2FnZUpzb25GaWVsZHMsXG59IGZyb20gJy4uL3V0aWxzL2luZGV4LmpzJ1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSgnY3JlYXRlLW5wbS1kaXJzJylcblxuZXhwb3J0IGludGVyZmFjZSBQYWNrYWdlTWV0YSB7XG4gICdkaXN0LXRhZ3MnOiB7IFtpbmRleDogc3RyaW5nXTogc3RyaW5nIH1cbn1cblxuY29uc3QgV0FTTV9SVU5USU1FX1BBQ0tBR0VfTkFNRSA9ICdAbmFwaS1ycy93YXNtLXJ1bnRpbWUnXG5cbmFzeW5jIGZ1bmN0aW9uIGdldExhdGVzdFdhc21SdW50aW1lVmVyc2lvbigpIHtcbiAgY29uc3QgbnBtUmVnaXN0cnlCYXNlID1cbiAgICBwcm9jZXNzLmVudi5ucG1fY29uZmlnX3JlZ2lzdHJ5Py5yZXBsYWNlKC9cXC8/JC8sICcvJykgPz9cbiAgICAnaHR0cHM6Ly9yZWdpc3RyeS5ucG1qcy5vcmcvJ1xuICBjb25zdCBwYWNrYWdlTWV0YWRhdGFVcmwgPSBgJHtucG1SZWdpc3RyeUJhc2V9JHtXQVNNX1JVTlRJTUVfUEFDS0FHRV9OQU1FfWBcbiAgbGV0IHJlc3BvbnNlOiBSZXNwb25zZVxuXG4gIHRyeSB7XG4gICAgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChwYWNrYWdlTWV0YWRhdGFVcmwpXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEZhaWxlZCB0byBmZXRjaCAke3BhY2thZ2VNZXRhZGF0YVVybH0gd2hpbGUgcmVzb2x2aW5nICR7V0FTTV9SVU5USU1FX1BBQ0tBR0VfTkFNRX0uIENoZWNrIHlvdXIgbmV0d29yayBjb25uZWN0aW9uIGFuZCBucG0gcmVnaXN0cnkgYXZhaWxhYmlsaXR5LmAsXG4gICAgICB7IGNhdXNlOiBlcnJvciB9LFxuICAgIClcbiAgfVxuXG4gIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRmFpbGVkIHRvIGZldGNoICR7cGFja2FnZU1ldGFkYXRhVXJsfSB3aGlsZSByZXNvbHZpbmcgJHtXQVNNX1JVTlRJTUVfUEFDS0FHRV9OQU1FfTogbnBtIHJlZ2lzdHJ5IHJlc3BvbmRlZCB3aXRoICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnN0YXR1c1RleHQgfHwgJ1Vua25vd24gU3RhdHVzJ31gLFxuICAgIClcbiAgfVxuXG4gIGxldCBwYWNrYWdlTWV0YTogUGFja2FnZU1ldGFcblxuICB0cnkge1xuICAgIHBhY2thZ2VNZXRhID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgUGFja2FnZU1ldGFcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRmFpbGVkIHRvIHBhcnNlIG5wbSByZWdpc3RyeSBtZXRhZGF0YSBmb3IgJHtXQVNNX1JVTlRJTUVfUEFDS0FHRV9OQU1FfSBmcm9tICR7cGFja2FnZU1ldGFkYXRhVXJsfWAsXG4gICAgICB7IGNhdXNlOiBlcnJvciB9LFxuICAgIClcbiAgfVxuXG4gIGNvbnN0IGxhdGVzdFZlcnNpb24gPSBwYWNrYWdlTWV0YVsnZGlzdC10YWdzJ10/LmxhdGVzdFxuXG4gIGlmICh0eXBlb2YgbGF0ZXN0VmVyc2lvbiAhPT0gJ3N0cmluZycgfHwgbGF0ZXN0VmVyc2lvbi50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYG5wbSByZWdpc3RyeSBtZXRhZGF0YSBmb3IgJHtXQVNNX1JVTlRJTUVfUEFDS0FHRV9OQU1FfSBmcm9tICR7cGFja2FnZU1ldGFkYXRhVXJsfSBkaWQgbm90IGluY2x1ZGUgYSBsYXRlc3QgZGlzdC10YWdgLFxuICAgIClcbiAgfVxuXG4gIHJldHVybiBsYXRlc3RWZXJzaW9uLnRyaW0oKVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlTnBtRGlycyh1c2VyT3B0aW9uczogQ3JlYXRlTnBtRGlyc09wdGlvbnMpIHtcbiAgY29uc3Qgb3B0aW9ucyA9IGFwcGx5RGVmYXVsdENyZWF0ZU5wbURpcnNPcHRpb25zKHVzZXJPcHRpb25zKVxuXG4gIGFzeW5jIGZ1bmN0aW9uIG1rZGlyQXN5bmMoZGlyOiBzdHJpbmcpIHtcbiAgICBkZWJ1ZygnVHJ5IHRvIGNyZWF0ZSBkaXI6ICVpJywgZGlyKVxuICAgIGlmIChvcHRpb25zLmRyeVJ1bikge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgYXdhaXQgcmF3TWtkaXJBc3luYyhkaXIsIHtcbiAgICAgIHJlY3Vyc2l2ZTogdHJ1ZSxcbiAgICB9KVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24gd3JpdGVGaWxlQXN5bmMoZmlsZTogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpIHtcbiAgICBkZWJ1ZygnV3JpdGluZyBmaWxlICVpJywgZmlsZSlcblxuICAgIGlmIChvcHRpb25zLmRyeVJ1bikge1xuICAgICAgZGVidWcoY29udGVudClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGF3YWl0IHJhd1dyaXRlRmlsZUFzeW5jKGZpbGUsIGNvbnRlbnQpXG4gIH1cblxuICBjb25zdCBwYWNrYWdlSnNvblBhdGggPSByZXNvbHZlKG9wdGlvbnMuY3dkLCBvcHRpb25zLnBhY2thZ2VKc29uUGF0aClcbiAgY29uc3QgbnBtUGF0aCA9IHJlc29sdmUob3B0aW9ucy5jd2QsIG9wdGlvbnMubnBtRGlyKVxuXG4gIGRlYnVnKGBSZWFkIGNvbnRlbnQgZnJvbSBbJHtvcHRpb25zLmNvbmZpZ1BhdGggPz8gcGFja2FnZUpzb25QYXRofV1gKVxuXG4gIGNvbnN0IHsgdGFyZ2V0cywgYmluYXJ5TmFtZSwgcGFja2FnZU5hbWUsIHBhY2thZ2VKc29uIH0gPVxuICAgIGF3YWl0IHJlYWROYXBpQ29uZmlnKFxuICAgICAgcGFja2FnZUpzb25QYXRoLFxuICAgICAgb3B0aW9ucy5jb25maWdQYXRoID8gcmVzb2x2ZShvcHRpb25zLmN3ZCwgb3B0aW9ucy5jb25maWdQYXRoKSA6IHVuZGVmaW5lZCxcbiAgICApXG4gIGNvbnN0IHdhc21SdW50aW1lVmVyc2lvbiA9IHRhcmdldHMuc29tZSgodGFyZ2V0KSA9PiB0YXJnZXQuYXJjaCA9PT0gJ3dhc20zMicpXG4gICAgPyBhd2FpdCBnZXRMYXRlc3RXYXNtUnVudGltZVZlcnNpb24oKVxuICAgIDogdW5kZWZpbmVkXG5cbiAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgIGNvbnN0IHRhcmdldERpciA9IGpvaW4obnBtUGF0aCwgYCR7dGFyZ2V0LnBsYXRmb3JtQXJjaEFCSX1gKVxuICAgIGF3YWl0IG1rZGlyQXN5bmModGFyZ2V0RGlyKVxuXG4gICAgY29uc3QgYmluYXJ5RmlsZU5hbWUgPVxuICAgICAgdGFyZ2V0LmFyY2ggPT09ICd3YXNtMzInXG4gICAgICAgID8gYCR7YmluYXJ5TmFtZX0uJHt0YXJnZXQucGxhdGZvcm1BcmNoQUJJfS53YXNtYFxuICAgICAgICA6IGAke2JpbmFyeU5hbWV9LiR7dGFyZ2V0LnBsYXRmb3JtQXJjaEFCSX0ubm9kZWBcbiAgICBjb25zdCBzY29wZWRQYWNrYWdlSnNvbjogQ29tbW9uUGFja2FnZUpzb25GaWVsZHMgPSB7XG4gICAgICBuYW1lOiBgJHtwYWNrYWdlTmFtZX0tJHt0YXJnZXQucGxhdGZvcm1BcmNoQUJJfWAsXG4gICAgICB2ZXJzaW9uOiBwYWNrYWdlSnNvbi52ZXJzaW9uLFxuICAgICAgY3B1OiB0YXJnZXQuYXJjaCAhPT0gJ3VuaXZlcnNhbCcgPyBbdGFyZ2V0LmFyY2hdIDogdW5kZWZpbmVkLFxuICAgICAgbWFpbjogYmluYXJ5RmlsZU5hbWUsXG4gICAgICBmaWxlczogW2JpbmFyeUZpbGVOYW1lXSxcbiAgICAgIC4uLnBpY2soXG4gICAgICAgIHBhY2thZ2VKc29uLFxuICAgICAgICAnZGVzY3JpcHRpb24nLFxuICAgICAgICAna2V5d29yZHMnLFxuICAgICAgICAnYXV0aG9yJyxcbiAgICAgICAgJ2F1dGhvcnMnLFxuICAgICAgICAnaG9tZXBhZ2UnLFxuICAgICAgICAnbGljZW5zZScsXG4gICAgICAgICdlbmdpbmVzJyxcbiAgICAgICAgJ3JlcG9zaXRvcnknLFxuICAgICAgICAnYnVncycsXG4gICAgICApLFxuICAgIH1cbiAgICBpZiAocGFja2FnZUpzb24ucHVibGlzaENvbmZpZykge1xuICAgICAgc2NvcGVkUGFja2FnZUpzb24ucHVibGlzaENvbmZpZyA9IHBpY2soXG4gICAgICAgIHBhY2thZ2VKc29uLnB1Ymxpc2hDb25maWcsXG4gICAgICAgICdyZWdpc3RyeScsXG4gICAgICAgICdhY2Nlc3MnLFxuICAgICAgKVxuICAgIH1cbiAgICBpZiAodGFyZ2V0LmFyY2ggIT09ICd3YXNtMzInKSB7XG4gICAgICBzY29wZWRQYWNrYWdlSnNvbi5vcyA9IFt0YXJnZXQucGxhdGZvcm1dXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gYCR7YmluYXJ5TmFtZX0ud2FzaS5janNgXG4gICAgICBzY29wZWRQYWNrYWdlSnNvbi5tYWluID0gZW50cnlcbiAgICAgIHNjb3BlZFBhY2thZ2VKc29uLmJyb3dzZXIgPSBgJHtiaW5hcnlOYW1lfS53YXNpLWJyb3dzZXIuanNgXG4gICAgICBzY29wZWRQYWNrYWdlSnNvbi5maWxlcz8ucHVzaChcbiAgICAgICAgZW50cnksXG4gICAgICAgIHNjb3BlZFBhY2thZ2VKc29uLmJyb3dzZXIsXG4gICAgICAgIGB3YXNpLXdvcmtlci5tanNgLFxuICAgICAgICBgd2FzaS13b3JrZXItYnJvd3Nlci5tanNgLFxuICAgICAgKVxuICAgICAgc2NvcGVkUGFja2FnZUpzb24uZW5naW5lcyA9IHtcbiAgICAgICAgLi4uc2NvcGVkUGFja2FnZUpzb24uZW5naW5lcyxcbiAgICAgICAgbm9kZTogc2NvcGVkUGFja2FnZUpzb24uZW5naW5lcz8ubm9kZVxuICAgICAgICAgID8gcmVzdHJpY3RXYXNpTm9kZUVuZ2luZShzY29wZWRQYWNrYWdlSnNvbi5lbmdpbmVzLm5vZGUpXG4gICAgICAgICAgOiBtaW5pbXVtV2FzaU5vZGVWZXJzaW9uLFxuICAgICAgfVxuICAgICAgY29uc3QgZW1uYXBpVmVyc2lvbiA9IHJlcXVpcmUoJ2VtbmFwaS9wYWNrYWdlLmpzb24nKS52ZXJzaW9uXG4gICAgICBzY29wZWRQYWNrYWdlSnNvbi5kZXBlbmRlbmNpZXMgPSB7XG4gICAgICAgICdAbmFwaS1ycy93YXNtLXJ1bnRpbWUnOiBgXiR7d2FzbVJ1bnRpbWVWZXJzaW9ufWAsXG4gICAgICAgICdAZW1uYXBpL2NvcmUnOiBlbW5hcGlWZXJzaW9uLFxuICAgICAgICAnQGVtbmFwaS9ydW50aW1lJzogZW1uYXBpVmVyc2lvbixcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGFyZ2V0LmFiaSA9PT0gJ2dudScpIHtcbiAgICAgIHNjb3BlZFBhY2thZ2VKc29uLmxpYmMgPSBbJ2dsaWJjJ11cbiAgICB9IGVsc2UgaWYgKHRhcmdldC5hYmkgPT09ICdtdXNsJykge1xuICAgICAgc2NvcGVkUGFja2FnZUpzb24ubGliYyA9IFsnbXVzbCddXG4gICAgfVxuXG4gICAgY29uc3QgdGFyZ2V0UGFja2FnZUpzb24gPSBqb2luKHRhcmdldERpciwgJ3BhY2thZ2UuanNvbicpXG4gICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoXG4gICAgICB0YXJnZXRQYWNrYWdlSnNvbixcbiAgICAgIEpTT04uc3RyaW5naWZ5KHNjb3BlZFBhY2thZ2VKc29uLCBudWxsLCAyKSArICdcXG4nLFxuICAgIClcbiAgICBjb25zdCB0YXJnZXRSZWFkbWUgPSBqb2luKHRhcmdldERpciwgJ1JFQURNRS5tZCcpXG4gICAgYXdhaXQgd3JpdGVGaWxlQXN5bmModGFyZ2V0UmVhZG1lLCByZWFkbWUocGFja2FnZU5hbWUsIHRhcmdldCkpXG5cbiAgICBkZWJ1Zy5pbmZvKGAke3BhY2thZ2VOYW1lfSAtJHt0YXJnZXQucGxhdGZvcm1BcmNoQUJJfSBjcmVhdGVkYClcbiAgfVxufVxuXG5mdW5jdGlvbiByZWFkbWUocGFja2FnZU5hbWU6IHN0cmluZywgdGFyZ2V0OiBUYXJnZXQpIHtcbiAgcmV0dXJuIGAjIFxcYCR7cGFja2FnZU5hbWV9LSR7dGFyZ2V0LnBsYXRmb3JtQXJjaEFCSX1cXGBcblxuVGhpcyBpcyB0aGUgKioke3RhcmdldC50cmlwbGV9KiogYmluYXJ5IGZvciBcXGAke3BhY2thZ2VOYW1lfVxcYFxuYFxufVxuXG5mdW5jdGlvbiByZXN0cmljdFdhc2lOb2RlRW5naW5lKG5vZGVSYW5nZTogc3RyaW5nKSB7XG4gIHRyeSB7XG4gICAgaWYgKHN1YnNldChub2RlUmFuZ2UsIG1pbmltdW1XYXNpTm9kZVZlcnNpb24pKSB7XG4gICAgICByZXR1cm4gbm9kZVJhbmdlXG4gICAgfVxuXG4gICAgaWYgKHN1YnNldChtaW5pbXVtV2FzaU5vZGVWZXJzaW9uLCBub2RlUmFuZ2UpKSB7XG4gICAgICByZXR1cm4gbWluaW11bVdhc2lOb2RlVmVyc2lvblxuICAgIH1cblxuICAgIGNvbnN0IG1pbmltdW1Db21wYXJhdG9yID0gbmV3IENvbXBhcmF0b3IobWluaW11bVdhc2lOb2RlVmVyc2lvbilcbiAgICBjb25zdCByZXN0cmljdGVkUmFuZ2VTZXRzID0gbmV3IFJhbmdlKG5vZGVSYW5nZSkuc2V0XG4gICAgICAubWFwKChjb21wYXJhdG9ycykgPT5cbiAgICAgICAgbm9ybWFsaXplQ29tcGFyYXRvclNldChbLi4uY29tcGFyYXRvcnMsIG1pbmltdW1Db21wYXJhdG9yXSksXG4gICAgICApXG4gICAgICAuZmlsdGVyKFxuICAgICAgICAoY2FuZGlkYXRlKTogY2FuZGlkYXRlIGlzIHN0cmluZyA9PlxuICAgICAgICAgIGNhbmRpZGF0ZSAhPT0gdW5kZWZpbmVkICYmIG1pblZlcnNpb24oY2FuZGlkYXRlKSAhPT0gbnVsbCxcbiAgICAgIClcblxuICAgIGlmIChyZXN0cmljdGVkUmFuZ2VTZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiByZXN0cmljdGVkUmFuZ2VTZXRzLmpvaW4oJyB8fCAnKVxuICAgIH1cbiAgfSBjYXRjaCB7XG4gICAgLy8gaWdub3JlXG4gIH1cblxuICByZXR1cm4gbWluaW11bVdhc2lOb2RlVmVyc2lvblxufVxuXG5mdW5jdGlvbiBub3JtYWxpemVDb21wYXJhdG9yU2V0KGNvbXBhcmF0b3JzOiBDb21wYXJhdG9yW10pIHtcbiAgY29uc3QgZXhhY3RNYXRjaCA9IGNvbXBhcmF0b3JzLmZpbmQoKHsgb3BlcmF0b3IgfSkgPT4gb3BlcmF0b3IgPT09ICcnKVxuICBpZiAoZXhhY3RNYXRjaCkge1xuICAgIHJldHVybiBjb21wYXJhdG9ycy5ldmVyeSgoY29tcGFyYXRvcikgPT4gY29tcGFyYXRvci50ZXN0KGV4YWN0TWF0Y2guc2VtdmVyKSlcbiAgICAgID8gZXhhY3RNYXRjaC52YWx1ZVxuICAgICAgOiB1bmRlZmluZWRcbiAgfVxuXG4gIGxldCBsb3dlckJvdW5kOiBDb21wYXJhdG9yIHwgdW5kZWZpbmVkXG4gIGxldCB1cHBlckJvdW5kOiBDb21wYXJhdG9yIHwgdW5kZWZpbmVkXG5cbiAgZm9yIChjb25zdCBjb21wYXJhdG9yIG9mIGNvbXBhcmF0b3JzKSB7XG4gICAgaWYgKGNvbXBhcmF0b3Iub3BlcmF0b3IgPT09ICc+JyB8fCBjb21wYXJhdG9yLm9wZXJhdG9yID09PSAnPj0nKSB7XG4gICAgICBpZiAoXG4gICAgICAgICFsb3dlckJvdW5kIHx8XG4gICAgICAgIGNvbXBhcmF0b3Iuc2VtdmVyLmNvbXBhcmUobG93ZXJCb3VuZC5zZW12ZXIpID4gMCB8fFxuICAgICAgICAoY29tcGFyYXRvci5zZW12ZXIuY29tcGFyZShsb3dlckJvdW5kLnNlbXZlcikgPT09IDAgJiZcbiAgICAgICAgICBjb21wYXJhdG9yLm9wZXJhdG9yID09PSAnPicpXG4gICAgICApIHtcbiAgICAgICAgbG93ZXJCb3VuZCA9IGNvbXBhcmF0b3JcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNvbXBhcmF0b3Iub3BlcmF0b3IgPT09ICc8JyB8fCBjb21wYXJhdG9yLm9wZXJhdG9yID09PSAnPD0nKSB7XG4gICAgICBpZiAoXG4gICAgICAgICF1cHBlckJvdW5kIHx8XG4gICAgICAgIGNvbXBhcmF0b3Iuc2VtdmVyLmNvbXBhcmUodXBwZXJCb3VuZC5zZW12ZXIpIDwgMCB8fFxuICAgICAgICAoY29tcGFyYXRvci5zZW12ZXIuY29tcGFyZSh1cHBlckJvdW5kLnNlbXZlcikgPT09IDAgJiZcbiAgICAgICAgICBjb21wYXJhdG9yLm9wZXJhdG9yID09PSAnPCcpXG4gICAgICApIHtcbiAgICAgICAgdXBwZXJCb3VuZCA9IGNvbXBhcmF0b3JcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gW2xvd2VyQm91bmQ/LnZhbHVlLCB1cHBlckJvdW5kPy52YWx1ZV0uZmlsdGVyKEJvb2xlYW4pLmpvaW4oJyAnKVxufVxuIiwiLy8gQ29weXJpZ2h0IDIwMTgtMjAyNSB0aGUgRGVubyBhdXRob3JzLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cbi8vIEJhcmUga2V5cyBtYXkgb25seSBjb250YWluIEFTQ0lJIGxldHRlcnMsXG4vLyBBU0NJSSBkaWdpdHMsIHVuZGVyc2NvcmVzLCBhbmQgZGFzaGVzIChBLVphLXowLTlfLSkuXG5mdW5jdGlvbiBqb2luS2V5cyhrZXlzKSB7XG4gIC8vIERvdHRlZCBrZXlzIGFyZSBhIHNlcXVlbmNlIG9mIGJhcmUgb3IgcXVvdGVkIGtleXMgam9pbmVkIHdpdGggYSBkb3QuXG4gIC8vIFRoaXMgYWxsb3dzIGZvciBncm91cGluZyBzaW1pbGFyIHByb3BlcnRpZXMgdG9nZXRoZXI6XG4gIHJldHVybiBrZXlzLm1hcCgoc3RyKT0+e1xuICAgIHJldHVybiBzdHIubGVuZ3RoID09PSAwIHx8IHN0ci5tYXRjaCgvW15BLVphLXowLTlfLV0vKSA/IEpTT04uc3RyaW5naWZ5KHN0cikgOiBzdHI7XG4gIH0pLmpvaW4oXCIuXCIpO1xufVxuY2xhc3MgRHVtcGVyIHtcbiAgbWF4UGFkID0gMDtcbiAgc3JjT2JqZWN0O1xuICBvdXRwdXQgPSBbXTtcbiAgI2FycmF5VHlwZUNhY2hlID0gbmV3IE1hcCgpO1xuICBjb25zdHJ1Y3RvcihzcmNPYmpjKXtcbiAgICB0aGlzLnNyY09iamVjdCA9IHNyY09iamM7XG4gIH1cbiAgZHVtcChmbXRPcHRpb25zID0ge30pIHtcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHRoaXMub3V0cHV0ID0gdGhpcy4jcHJpbnRPYmplY3QodGhpcy5zcmNPYmplY3QpO1xuICAgIHRoaXMub3V0cHV0ID0gdGhpcy4jZm9ybWF0KGZtdE9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLm91dHB1dDtcbiAgfVxuICAjcHJpbnRPYmplY3Qob2JqLCBrZXlzID0gW10pIHtcbiAgICBjb25zdCBvdXQgPSBbXTtcbiAgICBjb25zdCBwcm9wcyA9IE9iamVjdC5rZXlzKG9iaik7XG4gICAgY29uc3QgaW5saW5lUHJvcHMgPSBbXTtcbiAgICBjb25zdCBtdWx0aWxpbmVQcm9wcyA9IFtdO1xuICAgIGZvciAoY29uc3QgcHJvcCBvZiBwcm9wcyl7XG4gICAgICBpZiAodGhpcy4jaXNTaW1wbHlTZXJpYWxpemFibGUob2JqW3Byb3BdKSkge1xuICAgICAgICBpbmxpbmVQcm9wcy5wdXNoKHByb3ApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbXVsdGlsaW5lUHJvcHMucHVzaChwcm9wKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3Qgc29ydGVkUHJvcHMgPSBpbmxpbmVQcm9wcy5jb25jYXQobXVsdGlsaW5lUHJvcHMpO1xuICAgIGZvciAoY29uc3QgcHJvcCBvZiBzb3J0ZWRQcm9wcyl7XG4gICAgICBjb25zdCB2YWx1ZSA9IG9ialtwcm9wXTtcbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgb3V0LnB1c2godGhpcy4jZGF0ZURlY2xhcmF0aW9uKFtcbiAgICAgICAgICBwcm9wXG4gICAgICAgIF0sIHZhbHVlKSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIiB8fCB2YWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICBvdXQucHVzaCh0aGlzLiNzdHJEZWNsYXJhdGlvbihbXG4gICAgICAgICAgcHJvcFxuICAgICAgICBdLCB2YWx1ZS50b1N0cmluZygpKSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICBvdXQucHVzaCh0aGlzLiNudW1iZXJEZWNsYXJhdGlvbihbXG4gICAgICAgICAgcHJvcFxuICAgICAgICBdLCB2YWx1ZSkpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIG91dC5wdXNoKHRoaXMuI2Jvb2xEZWNsYXJhdGlvbihbXG4gICAgICAgICAgcHJvcFxuICAgICAgICBdLCB2YWx1ZSkpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIGNvbnN0IGFycmF5VHlwZSA9IHRoaXMuI2dldFR5cGVPZkFycmF5KHZhbHVlKTtcbiAgICAgICAgaWYgKGFycmF5VHlwZSA9PT0gXCJPTkxZX1BSSU1JVElWRVwiKSB7XG4gICAgICAgICAgb3V0LnB1c2godGhpcy4jYXJyYXlEZWNsYXJhdGlvbihbXG4gICAgICAgICAgICBwcm9wXG4gICAgICAgICAgXSwgdmFsdWUpKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcnJheVR5cGUgPT09IFwiT05MWV9PQkpFQ1RfRVhDTFVESU5HX0FSUkFZXCIpIHtcbiAgICAgICAgICAvLyBhcnJheSBvZiBvYmplY3RzXG4gICAgICAgICAgZm9yKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIG91dC5wdXNoKFwiXCIpO1xuICAgICAgICAgICAgb3V0LnB1c2godGhpcy4jaGVhZGVyR3JvdXAoW1xuICAgICAgICAgICAgICAuLi5rZXlzLFxuICAgICAgICAgICAgICBwcm9wXG4gICAgICAgICAgICBdKSk7XG4gICAgICAgICAgICBvdXQucHVzaCguLi50aGlzLiNwcmludE9iamVjdCh2YWx1ZVtpXSwgW1xuICAgICAgICAgICAgICAuLi5rZXlzLFxuICAgICAgICAgICAgICBwcm9wXG4gICAgICAgICAgICBdKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHRoaXMgaXMgYSBjb21wbGV4IGFycmF5LCB1c2UgdGhlIGlubGluZSBmb3JtYXQuXG4gICAgICAgICAgY29uc3Qgc3RyID0gdmFsdWUubWFwKCh4KT0+dGhpcy4jcHJpbnRBc0lubGluZVZhbHVlKHgpKS5qb2luKFwiLFwiKTtcbiAgICAgICAgICBvdXQucHVzaChgJHt0aGlzLiNkZWNsYXJhdGlvbihbXG4gICAgICAgICAgICBwcm9wXG4gICAgICAgICAgXSl9WyR7c3RyfV1gKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgb3V0LnB1c2goXCJcIik7XG4gICAgICAgIG91dC5wdXNoKHRoaXMuI2hlYWRlcihbXG4gICAgICAgICAgLi4ua2V5cyxcbiAgICAgICAgICBwcm9wXG4gICAgICAgIF0pKTtcbiAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgY29uc3QgdG9QYXJzZSA9IHZhbHVlO1xuICAgICAgICAgIG91dC5wdXNoKC4uLnRoaXMuI3ByaW50T2JqZWN0KHRvUGFyc2UsIFtcbiAgICAgICAgICAgIC4uLmtleXMsXG4gICAgICAgICAgICBwcm9wXG4gICAgICAgICAgXSkpO1xuICAgICAgICB9XG4gICAgICAvLyBvdXQucHVzaCguLi50aGlzLl9wYXJzZSh2YWx1ZSwgYCR7cGF0aH0ke3Byb3B9LmApKTtcbiAgICAgIH1cbiAgICB9XG4gICAgb3V0LnB1c2goXCJcIik7XG4gICAgcmV0dXJuIG91dDtcbiAgfVxuICAjaXNQcmltaXRpdmUodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBEYXRlIHx8IHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwIHx8IFtcbiAgICAgIFwic3RyaW5nXCIsXG4gICAgICBcIm51bWJlclwiLFxuICAgICAgXCJib29sZWFuXCJcbiAgICBdLmluY2x1ZGVzKHR5cGVvZiB2YWx1ZSk7XG4gIH1cbiAgI2dldFR5cGVPZkFycmF5KGFycikge1xuICAgIGlmICh0aGlzLiNhcnJheVR5cGVDYWNoZS5oYXMoYXJyKSkge1xuICAgICAgcmV0dXJuIHRoaXMuI2FycmF5VHlwZUNhY2hlLmdldChhcnIpO1xuICAgIH1cbiAgICBjb25zdCB0eXBlID0gdGhpcy4jZG9HZXRUeXBlT2ZBcnJheShhcnIpO1xuICAgIHRoaXMuI2FycmF5VHlwZUNhY2hlLnNldChhcnIsIHR5cGUpO1xuICAgIHJldHVybiB0eXBlO1xuICB9XG4gICNkb0dldFR5cGVPZkFycmF5KGFycikge1xuICAgIGlmICghYXJyLmxlbmd0aCkge1xuICAgICAgLy8gYW55IHR5cGUgc2hvdWxkIGJlIGZpbmVcbiAgICAgIHJldHVybiBcIk9OTFlfUFJJTUlUSVZFXCI7XG4gICAgfVxuICAgIGNvbnN0IG9ubHlQcmltaXRpdmUgPSB0aGlzLiNpc1ByaW1pdGl2ZShhcnJbMF0pO1xuICAgIGlmIChhcnJbMF0gaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgcmV0dXJuIFwiTUlYRURcIjtcbiAgICB9XG4gICAgZm9yKGxldCBpID0gMTsgaSA8IGFyci5sZW5ndGg7IGkrKyl7XG4gICAgICBpZiAob25seVByaW1pdGl2ZSAhPT0gdGhpcy4jaXNQcmltaXRpdmUoYXJyW2ldKSB8fCBhcnJbaV0gaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICByZXR1cm4gXCJNSVhFRFwiO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb25seVByaW1pdGl2ZSA/IFwiT05MWV9QUklNSVRJVkVcIiA6IFwiT05MWV9PQkpFQ1RfRVhDTFVESU5HX0FSUkFZXCI7XG4gIH1cbiAgI3ByaW50QXNJbmxpbmVWYWx1ZSh2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgIHJldHVybiBgXCIke3RoaXMuI3ByaW50RGF0ZSh2YWx1ZSl9XCJgO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiIHx8IHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUudG9TdHJpbmcoKSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgIHJldHVybiB2YWx1ZS50b1N0cmluZygpO1xuICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgY29uc3Qgc3RyID0gdmFsdWUubWFwKCh4KT0+dGhpcy4jcHJpbnRBc0lubGluZVZhbHVlKHgpKS5qb2luKFwiLFwiKTtcbiAgICAgIHJldHVybiBgWyR7c3RyfV1gO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG4gICAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNob3VsZCBuZXZlciByZWFjaFwiKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHN0ciA9IE9iamVjdC5rZXlzKHZhbHVlKS5tYXAoKGtleSk9PntcbiAgICAgICAgcmV0dXJuIGAke2pvaW5LZXlzKFtcbiAgICAgICAgICBrZXlcbiAgICAgICAgXSl9ID0gJHsvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgICAgICB0aGlzLiNwcmludEFzSW5saW5lVmFsdWUodmFsdWVba2V5XSl9YDtcbiAgICAgIH0pLmpvaW4oXCIsXCIpO1xuICAgICAgcmV0dXJuIGB7JHtzdHJ9fWA7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihcIlNob3VsZCBuZXZlciByZWFjaFwiKTtcbiAgfVxuICAjaXNTaW1wbHlTZXJpYWxpemFibGUodmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSBcInN0cmluZ1wiIHx8IHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIiB8fCB0eXBlb2YgdmFsdWUgPT09IFwiYm9vbGVhblwiIHx8IHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwIHx8IHZhbHVlIGluc3RhbmNlb2YgRGF0ZSB8fCB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5ICYmIHRoaXMuI2dldFR5cGVPZkFycmF5KHZhbHVlKSAhPT0gXCJPTkxZX09CSkVDVF9FWENMVURJTkdfQVJSQVlcIjtcbiAgfVxuICAjaGVhZGVyKGtleXMpIHtcbiAgICByZXR1cm4gYFske2pvaW5LZXlzKGtleXMpfV1gO1xuICB9XG4gICNoZWFkZXJHcm91cChrZXlzKSB7XG4gICAgcmV0dXJuIGBbWyR7am9pbktleXMoa2V5cyl9XV1gO1xuICB9XG4gICNkZWNsYXJhdGlvbihrZXlzKSB7XG4gICAgY29uc3QgdGl0bGUgPSBqb2luS2V5cyhrZXlzKTtcbiAgICBpZiAodGl0bGUubGVuZ3RoID4gdGhpcy5tYXhQYWQpIHtcbiAgICAgIHRoaXMubWF4UGFkID0gdGl0bGUubGVuZ3RoO1xuICAgIH1cbiAgICByZXR1cm4gYCR7dGl0bGV9ID0gYDtcbiAgfVxuICAjYXJyYXlEZWNsYXJhdGlvbihrZXlzLCB2YWx1ZSkge1xuICAgIHJldHVybiBgJHt0aGlzLiNkZWNsYXJhdGlvbihrZXlzKX0ke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gO1xuICB9XG4gICNzdHJEZWNsYXJhdGlvbihrZXlzLCB2YWx1ZSkge1xuICAgIHJldHVybiBgJHt0aGlzLiNkZWNsYXJhdGlvbihrZXlzKX0ke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gO1xuICB9XG4gICNudW1iZXJEZWNsYXJhdGlvbihrZXlzLCB2YWx1ZSkge1xuICAgIGlmIChOdW1iZXIuaXNOYU4odmFsdWUpKSB7XG4gICAgICByZXR1cm4gYCR7dGhpcy4jZGVjbGFyYXRpb24oa2V5cyl9bmFuYDtcbiAgICB9XG4gICAgc3dpdGNoKHZhbHVlKXtcbiAgICAgIGNhc2UgSW5maW5pdHk6XG4gICAgICAgIHJldHVybiBgJHt0aGlzLiNkZWNsYXJhdGlvbihrZXlzKX1pbmZgO1xuICAgICAgY2FzZSAtSW5maW5pdHk6XG4gICAgICAgIHJldHVybiBgJHt0aGlzLiNkZWNsYXJhdGlvbihrZXlzKX0taW5mYDtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBgJHt0aGlzLiNkZWNsYXJhdGlvbihrZXlzKX0ke3ZhbHVlfWA7XG4gICAgfVxuICB9XG4gICNib29sRGVjbGFyYXRpb24oa2V5cywgdmFsdWUpIHtcbiAgICByZXR1cm4gYCR7dGhpcy4jZGVjbGFyYXRpb24oa2V5cyl9JHt2YWx1ZX1gO1xuICB9XG4gICNwcmludERhdGUodmFsdWUpIHtcbiAgICBmdW5jdGlvbiBkdFBhZCh2LCBsUGFkID0gMikge1xuICAgICAgcmV0dXJuIHYucGFkU3RhcnQobFBhZCwgXCIwXCIpO1xuICAgIH1cbiAgICBjb25zdCBtID0gZHRQYWQoKHZhbHVlLmdldFVUQ01vbnRoKCkgKyAxKS50b1N0cmluZygpKTtcbiAgICBjb25zdCBkID0gZHRQYWQodmFsdWUuZ2V0VVRDRGF0ZSgpLnRvU3RyaW5nKCkpO1xuICAgIGNvbnN0IGggPSBkdFBhZCh2YWx1ZS5nZXRVVENIb3VycygpLnRvU3RyaW5nKCkpO1xuICAgIGNvbnN0IG1pbiA9IGR0UGFkKHZhbHVlLmdldFVUQ01pbnV0ZXMoKS50b1N0cmluZygpKTtcbiAgICBjb25zdCBzID0gZHRQYWQodmFsdWUuZ2V0VVRDU2Vjb25kcygpLnRvU3RyaW5nKCkpO1xuICAgIGNvbnN0IG1zID0gZHRQYWQodmFsdWUuZ2V0VVRDTWlsbGlzZWNvbmRzKCkudG9TdHJpbmcoKSwgMyk7XG4gICAgLy8gZm9ybWF0dGVkIGRhdGVcbiAgICBjb25zdCBmRGF0YSA9IGAke3ZhbHVlLmdldFVUQ0Z1bGxZZWFyKCl9LSR7bX0tJHtkfVQke2h9OiR7bWlufToke3N9LiR7bXN9YDtcbiAgICByZXR1cm4gZkRhdGE7XG4gIH1cbiAgI2RhdGVEZWNsYXJhdGlvbihrZXlzLCB2YWx1ZSkge1xuICAgIHJldHVybiBgJHt0aGlzLiNkZWNsYXJhdGlvbihrZXlzKX0ke3RoaXMuI3ByaW50RGF0ZSh2YWx1ZSl9YDtcbiAgfVxuICAjZm9ybWF0KG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHsga2V5QWxpZ25tZW50ID0gZmFsc2UgfSA9IG9wdGlvbnM7XG4gICAgY29uc3QgckRlY2xhcmF0aW9uID0gL14oXFxcIi4qXFxcInxbXj1dKilcXHM9LztcbiAgICBjb25zdCBvdXQgPSBbXTtcbiAgICBmb3IobGV0IGkgPSAwOyBpIDwgdGhpcy5vdXRwdXQubGVuZ3RoOyBpKyspe1xuICAgICAgY29uc3QgbCA9IHRoaXMub3V0cHV0W2ldO1xuICAgICAgLy8gd2Uga2VlcCBlbXB0eSBlbnRyeSBmb3IgYXJyYXkgb2Ygb2JqZWN0c1xuICAgICAgaWYgKGxbMF0gPT09IFwiW1wiICYmIGxbMV0gIT09IFwiW1wiKSB7XG4gICAgICAgIC8vIG5vbi1lbXB0eSBvYmplY3Qgd2l0aCBvbmx5IHN1Ym9iamVjdHMgYXMgcHJvcGVydGllc1xuICAgICAgICBpZiAodGhpcy5vdXRwdXRbaSArIDFdID09PSBcIlwiICYmIHRoaXMub3V0cHV0W2kgKyAyXT8uc2xpY2UoMCwgbC5sZW5ndGgpID09PSBsLnNsaWNlKDAsIC0xKSArIFwiLlwiKSB7XG4gICAgICAgICAgaSArPSAxO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIG91dC5wdXNoKGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGtleUFsaWdubWVudCkge1xuICAgICAgICAgIGNvbnN0IG0gPSByRGVjbGFyYXRpb24uZXhlYyhsKTtcbiAgICAgICAgICBpZiAobSAmJiBtWzFdKSB7XG4gICAgICAgICAgICBvdXQucHVzaChsLnJlcGxhY2UobVsxXSwgbVsxXS5wYWRFbmQodGhpcy5tYXhQYWQpKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG91dC5wdXNoKGwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvdXQucHVzaChsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBDbGVhbmluZyBtdWx0aXBsZSBzcGFjZXNcbiAgICBjb25zdCBjbGVhbmVkT3V0cHV0ID0gW107XG4gICAgZm9yKGxldCBpID0gMDsgaSA8IG91dC5sZW5ndGg7IGkrKyl7XG4gICAgICBjb25zdCBsID0gb3V0W2ldO1xuICAgICAgaWYgKCEobCA9PT0gXCJcIiAmJiBvdXRbaSArIDFdID09PSBcIlwiKSkge1xuICAgICAgICBjbGVhbmVkT3V0cHV0LnB1c2gobCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjbGVhbmVkT3V0cHV0O1xuICB9XG59XG4vKipcbiAqIENvbnZlcnRzIGFuIG9iamVjdCB0byBhIHtAbGluayBodHRwczovL3RvbWwuaW8gfCBUT01MfSBzdHJpbmcuXG4gKlxuICogQGV4YW1wbGUgVXNhZ2VcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBzdHJpbmdpZnkgfSBmcm9tIFwiQHN0ZC90b21sL3N0cmluZ2lmeVwiO1xuICogaW1wb3J0IHsgYXNzZXJ0RXF1YWxzIH0gZnJvbSBcIkBzdGQvYXNzZXJ0XCI7XG4gKlxuICogY29uc3Qgb2JqID0ge1xuICogICB0aXRsZTogXCJUT01MIEV4YW1wbGVcIixcbiAqICAgb3duZXI6IHtcbiAqICAgICBuYW1lOiBcIkJvYlwiLFxuICogICAgIGJpbzogXCJCb2IgaXMgYSBjb29sIGd1eVwiLFxuICogIH1cbiAqIH07XG4gKiBjb25zdCB0b21sU3RyaW5nID0gc3RyaW5naWZ5KG9iaik7XG4gKiBhc3NlcnRFcXVhbHModG9tbFN0cmluZywgYHRpdGxlID0gXCJUT01MIEV4YW1wbGVcIlxcblxcbltvd25lcl1cXG5uYW1lID0gXCJCb2JcIlxcbmJpbyA9IFwiQm9iIGlzIGEgY29vbCBndXlcIlxcbmApO1xuICogYGBgXG4gKiBAcGFyYW0gb2JqIFNvdXJjZSBvYmplY3RcbiAqIEBwYXJhbSBvcHRpb25zIE9wdGlvbnMgZm9yIHN0cmluZ2lmeWluZy5cbiAqIEByZXR1cm5zIFRPTUwgc3RyaW5nXG4gKi8gZXhwb3J0IGZ1bmN0aW9uIHN0cmluZ2lmeShvYmosIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBEdW1wZXIob2JqKS5kdW1wKG9wdGlvbnMpLmpvaW4oXCJcXG5cIik7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zdHJpbmdpZnkuanMubWFwIiwiLy8gQ29weXJpZ2h0IDIwMTgtMjAyNiB0aGUgRGVubyBhdXRob3JzLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cbi8qKiBEZWZhdWx0IG1lcmdpbmcgb3B0aW9ucyAtIGNhY2hlZCB0byBhdm9pZCBvYmplY3QgYWxsb2NhdGlvbiBvbiBlYWNoIGNhbGwgKi8gY29uc3QgREVGQVVMVF9PUFRJT05TID0ge1xuICBhcnJheXM6IFwibWVyZ2VcIixcbiAgc2V0czogXCJtZXJnZVwiLFxuICBtYXBzOiBcIm1lcmdlXCJcbn07XG5leHBvcnQgZnVuY3Rpb24gZGVlcE1lcmdlKHJlY29yZCwgb3RoZXIsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIGRlZXBNZXJnZUludGVybmFsKHJlY29yZCwgb3RoZXIsIG5ldyBTZXQoKSwgb3B0aW9ucyA/PyBERUZBVUxUX09QVElPTlMpO1xufVxuZnVuY3Rpb24gZGVlcE1lcmdlSW50ZXJuYWwocmVjb3JkLCBvdGhlciwgc2Vlbiwgb3B0aW9ucykge1xuICBjb25zdCByZXN1bHQgPSB7fTtcbiAgY29uc3Qga2V5cyA9IG5ldyBTZXQoW1xuICAgIC4uLmdldEtleXMocmVjb3JkKSxcbiAgICAuLi5nZXRLZXlzKG90aGVyKVxuICBdKTtcbiAgLy8gSXRlcmF0ZSB0aHJvdWdoIGVhY2gga2V5IG9mIG90aGVyIG9iamVjdCBhbmQgdXNlIGNvcnJlY3QgbWVyZ2luZyBzdHJhdGVneVxuICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKXtcbiAgICAvLyBTa2lwIHRvIHByZXZlbnQgT2JqZWN0LnByb3RvdHlwZS5fX3Byb3RvX18gYWNjZXNzb3IgcHJvcGVydHkgY2FsbHMgb24gbm9uLURlbm8gcGxhdGZvcm1zXG4gICAgaWYgKGtleSA9PT0gXCJfX3Byb3RvX19cIikge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IGEgPSByZWNvcmRba2V5XTtcbiAgICBpZiAoIU9iamVjdC5oYXNPd24ob3RoZXIsIGtleSkpIHtcbiAgICAgIHJlc3VsdFtrZXldID0gYTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCBiID0gb3RoZXJba2V5XTtcbiAgICBpZiAoaXNOb25OdWxsT2JqZWN0KGEpICYmIGlzTm9uTnVsbE9iamVjdChiKSAmJiAhc2Vlbi5oYXMoYSkgJiYgIXNlZW4uaGFzKGIpKSB7XG4gICAgICBzZWVuLmFkZChhKTtcbiAgICAgIHNlZW4uYWRkKGIpO1xuICAgICAgcmVzdWx0W2tleV0gPSBtZXJnZU9iamVjdHMoYSwgYiwgc2Vlbiwgb3B0aW9ucyk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgLy8gT3ZlcnJpZGUgdmFsdWVcbiAgICByZXN1bHRba2V5XSA9IGI7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbmZ1bmN0aW9uIG1lcmdlT2JqZWN0cyhsZWZ0LCByaWdodCwgc2Vlbiwgb3B0aW9ucykge1xuICAvLyBSZWN1cnNpdmVseSBtZXJnZSBtZXJnZWFibGUgb2JqZWN0c1xuICBpZiAoaXNNZXJnZWFibGUobGVmdCkgJiYgaXNNZXJnZWFibGUocmlnaHQpKSB7XG4gICAgcmV0dXJuIGRlZXBNZXJnZUludGVybmFsKGxlZnQsIHJpZ2h0LCBzZWVuLCBvcHRpb25zKTtcbiAgfVxuICBpZiAoaXNJdGVyYWJsZShsZWZ0KSAmJiBpc0l0ZXJhYmxlKHJpZ2h0KSkge1xuICAgIC8vIEhhbmRsZSBhcnJheXNcbiAgICBpZiAoQXJyYXkuaXNBcnJheShsZWZ0KSAmJiBBcnJheS5pc0FycmF5KHJpZ2h0KSkge1xuICAgICAgaWYgKG9wdGlvbnMuYXJyYXlzID09PSBcIm1lcmdlXCIpIHtcbiAgICAgICAgcmV0dXJuIGxlZnQuY29uY2F0KHJpZ2h0KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByaWdodDtcbiAgICB9XG4gICAgLy8gSGFuZGxlIG1hcHNcbiAgICBpZiAobGVmdCBpbnN0YW5jZW9mIE1hcCAmJiByaWdodCBpbnN0YW5jZW9mIE1hcCkge1xuICAgICAgaWYgKG9wdGlvbnMubWFwcyA9PT0gXCJtZXJnZVwiKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBNYXAobGVmdCk7XG4gICAgICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIHJpZ2h0KXtcbiAgICAgICAgICByZXN1bHQuc2V0KGssIHYpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmlnaHQ7XG4gICAgfVxuICAgIC8vIEhhbmRsZSBzZXRzXG4gICAgaWYgKGxlZnQgaW5zdGFuY2VvZiBTZXQgJiYgcmlnaHQgaW5zdGFuY2VvZiBTZXQpIHtcbiAgICAgIGlmIChvcHRpb25zLnNldHMgPT09IFwibWVyZ2VcIikge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBuZXcgU2V0KGxlZnQpO1xuICAgICAgICBmb3IgKGNvbnN0IHYgb2YgcmlnaHQpe1xuICAgICAgICAgIHJlc3VsdC5hZGQodik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIHJldHVybiByaWdodDtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJpZ2h0O1xufVxuLyoqXG4gKiBUZXN0IHdoZXRoZXIgYSB2YWx1ZSBpcyBtZXJnZWFibGUgb3Igbm90XG4gKiBCdWlsdGlucyB0aGF0IGxvb2sgbGlrZSBvYmplY3RzLCBudWxsIGFuZCB1c2VyIGRlZmluZWQgY2xhc3Nlc1xuICogYXJlIG5vdCBjb25zaWRlcmVkIG1lcmdlYWJsZSAoaXQgbWVhbnMgdGhhdCByZWZlcmVuY2Ugd2lsbCBiZSBjb3BpZWQpXG4gKi8gZnVuY3Rpb24gaXNNZXJnZWFibGUodmFsdWUpIHtcbiAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSkgPT09IE9iamVjdC5wcm90b3R5cGU7XG59XG5mdW5jdGlvbiBpc0l0ZXJhYmxlKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWVbU3ltYm9sLml0ZXJhdG9yXSA9PT0gXCJmdW5jdGlvblwiO1xufVxuZnVuY3Rpb24gaXNOb25OdWxsT2JqZWN0KHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCI7XG59XG5mdW5jdGlvbiBnZXRLZXlzKHJlY29yZCkge1xuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocmVjb3JkKTtcbiAgY29uc3Qgc3ltYm9scyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocmVjb3JkKTtcbiAgLy8gRmFzdCBwYXRoOiBtb3N0IG9iamVjdHMgaGF2ZSBubyBzeW1ib2wga2V5c1xuICBpZiAoc3ltYm9scy5sZW5ndGggPT09IDApIHJldHVybiBrZXlzO1xuICBmb3IgKGNvbnN0IHN5bSBvZiBzeW1ib2xzKXtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHJlY29yZCwgc3ltKSkge1xuICAgICAga2V5cy5wdXNoKHN5bSk7XG4gICAgfVxuICB9XG4gIHJldHVybiBrZXlzO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGVlcF9tZXJnZS5qcy5tYXAiLCIvLyBDb3B5cmlnaHQgMjAxOC0yMDI1IHRoZSBEZW5vIGF1dGhvcnMuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuaW1wb3J0IHsgZGVlcE1lcmdlIH0gZnJvbSBcIkBqc3Ivc3RkX19jb2xsZWN0aW9ucy9kZWVwLW1lcmdlXCI7XG4vKipcbiAqIENvcHkgb2YgYGltcG9ydCB7IGlzTGVhcCB9IGZyb20gXCJAc3RkL2RhdGV0aW1lXCI7YCBiZWNhdXNlIGl0IGNhbm5vdCBiZSBpbXBvdGVkIGFzIGxvbmcgYXMgaXQgaXMgdW5zdGFibGUuXG4gKi8gZnVuY3Rpb24gaXNMZWFwKHllYXJOdW1iZXIpIHtcbiAgcmV0dXJuIHllYXJOdW1iZXIgJSA0ID09PSAwICYmIHllYXJOdW1iZXIgJSAxMDAgIT09IDAgfHwgeWVhck51bWJlciAlIDQwMCA9PT0gMDtcbn1cbmV4cG9ydCBjbGFzcyBTY2FubmVyIHtcbiAgI3doaXRlc3BhY2UgPSAvWyBcXHRdLztcbiAgI3Bvc2l0aW9uID0gMDtcbiAgI3NvdXJjZTtcbiAgY29uc3RydWN0b3Ioc291cmNlKXtcbiAgICB0aGlzLiNzb3VyY2UgPSBzb3VyY2U7XG4gIH1cbiAgZ2V0IHBvc2l0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLiNwb3NpdGlvbjtcbiAgfVxuICBnZXQgc291cmNlKCkge1xuICAgIHJldHVybiB0aGlzLiNzb3VyY2U7XG4gIH1cbiAgLyoqXG4gICAqIEdldCBjdXJyZW50IGNoYXJhY3RlclxuICAgKiBAcGFyYW0gaW5kZXggLSByZWxhdGl2ZSBpbmRleCBmcm9tIGN1cnJlbnQgcG9zaXRpb25cbiAgICovIGNoYXIoaW5kZXggPSAwKSB7XG4gICAgcmV0dXJuIHRoaXMuI3NvdXJjZVt0aGlzLiNwb3NpdGlvbiArIGluZGV4XSA/PyBcIlwiO1xuICB9XG4gIC8qKlxuICAgKiBHZXQgc2xpY2VkIHN0cmluZ1xuICAgKiBAcGFyYW0gc3RhcnQgLSBzdGFydCBwb3NpdGlvbiByZWxhdGl2ZSBmcm9tIGN1cnJlbnQgcG9zaXRpb25cbiAgICogQHBhcmFtIGVuZCAtIGVuZCBwb3NpdGlvbiByZWxhdGl2ZSBmcm9tIGN1cnJlbnQgcG9zaXRpb25cbiAgICovIHNsaWNlKHN0YXJ0LCBlbmQpIHtcbiAgICByZXR1cm4gdGhpcy4jc291cmNlLnNsaWNlKHRoaXMuI3Bvc2l0aW9uICsgc3RhcnQsIHRoaXMuI3Bvc2l0aW9uICsgZW5kKTtcbiAgfVxuICAvKipcbiAgICogTW92ZSBwb3NpdGlvbiB0byBuZXh0XG4gICAqLyBuZXh0KGNvdW50ID0gMSkge1xuICAgIHRoaXMuI3Bvc2l0aW9uICs9IGNvdW50O1xuICB9XG4gIHNraXBXaGl0ZXNwYWNlcygpIHtcbiAgICB3aGlsZSh0aGlzLiN3aGl0ZXNwYWNlLnRlc3QodGhpcy5jaGFyKCkpICYmICF0aGlzLmVvZigpKXtcbiAgICAgIHRoaXMubmV4dCgpO1xuICAgIH1cbiAgICAvLyBJbnZhbGlkIGlmIGN1cnJlbnQgY2hhciBpcyBvdGhlciBraW5kcyBvZiB3aGl0ZXNwYWNlXG4gICAgaWYgKCF0aGlzLmlzQ3VycmVudENoYXJFT0woKSAmJiAvXFxzLy50ZXN0KHRoaXMuY2hhcigpKSkge1xuICAgICAgY29uc3QgZXNjYXBlZCA9IFwiXFxcXHVcIiArIHRoaXMuY2hhcigpLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpO1xuICAgICAgY29uc3QgcG9zaXRpb24gPSB0aGlzLiNwb3NpdGlvbjtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgQ2Fubm90IHBhcnNlIHRoZSBUT01MOiBJdCBjb250YWlucyBpbnZhbGlkIHdoaXRlc3BhY2UgYXQgcG9zaXRpb24gJyR7cG9zaXRpb259JzogXFxgJHtlc2NhcGVkfVxcYGApO1xuICAgIH1cbiAgfVxuICBuZXh0VW50aWxDaGFyKG9wdGlvbnMgPSB7XG4gICAgc2tpcENvbW1lbnRzOiB0cnVlXG4gIH0pIHtcbiAgICB3aGlsZSghdGhpcy5lb2YoKSl7XG4gICAgICBjb25zdCBjaGFyID0gdGhpcy5jaGFyKCk7XG4gICAgICBpZiAodGhpcy4jd2hpdGVzcGFjZS50ZXN0KGNoYXIpIHx8IHRoaXMuaXNDdXJyZW50Q2hhckVPTCgpKSB7XG4gICAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgfSBlbHNlIGlmIChvcHRpb25zLnNraXBDb21tZW50cyAmJiB0aGlzLmNoYXIoKSA9PT0gXCIjXCIpIHtcbiAgICAgICAgLy8gZW50ZXJpbmcgY29tbWVudFxuICAgICAgICB3aGlsZSghdGhpcy5pc0N1cnJlbnRDaGFyRU9MKCkgJiYgIXRoaXMuZW9mKCkpe1xuICAgICAgICAgIHRoaXMubmV4dCgpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIFBvc2l0aW9uIHJlYWNoZWQgRU9GIG9yIG5vdFxuICAgKi8gZW9mKCkge1xuICAgIHJldHVybiB0aGlzLiNwb3NpdGlvbiA+PSB0aGlzLiNzb3VyY2UubGVuZ3RoO1xuICB9XG4gIGlzQ3VycmVudENoYXJFT0woKSB7XG4gICAgcmV0dXJuIHRoaXMuY2hhcigpID09PSBcIlxcblwiIHx8IHRoaXMuc3RhcnRzV2l0aChcIlxcclxcblwiKTtcbiAgfVxuICBzdGFydHNXaXRoKHNlYXJjaFN0cmluZykge1xuICAgIHJldHVybiB0aGlzLiNzb3VyY2Uuc3RhcnRzV2l0aChzZWFyY2hTdHJpbmcsIHRoaXMuI3Bvc2l0aW9uKTtcbiAgfVxuICBtYXRjaChyZWdFeHApIHtcbiAgICBpZiAoIXJlZ0V4cC5zdGlja3kpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUmVnRXhwICR7cmVnRXhwfSBkb2VzIG5vdCBoYXZlIGEgc3RpY2t5ICd5JyBmbGFnYCk7XG4gICAgfVxuICAgIHJlZ0V4cC5sYXN0SW5kZXggPSB0aGlzLiNwb3NpdGlvbjtcbiAgICByZXR1cm4gdGhpcy4jc291cmNlLm1hdGNoKHJlZ0V4cCk7XG4gIH1cbn1cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBVdGlsaXRpZXNcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5mdW5jdGlvbiBzdWNjZXNzKGJvZHkpIHtcbiAgcmV0dXJuIHtcbiAgICBvazogdHJ1ZSxcbiAgICBib2R5XG4gIH07XG59XG5mdW5jdGlvbiBmYWlsdXJlKCkge1xuICByZXR1cm4ge1xuICAgIG9rOiBmYWxzZVxuICB9O1xufVxuLyoqXG4gKiBDcmVhdGVzIGEgbmVzdGVkIG9iamVjdCBmcm9tIHRoZSBrZXlzIGFuZCB2YWx1ZXMuXG4gKlxuICogZS5nLiBgdW5mbGF0KFtcImFcIiwgXCJiXCIsIFwiY1wiXSwgMSlgIHJldHVybnMgYHsgYTogeyBiOiB7IGM6IDEgfSB9IH1gXG4gKi8gZXhwb3J0IGZ1bmN0aW9uIHVuZmxhdChrZXlzLCB2YWx1ZXMgPSB7XG4gIF9fcHJvdG9fXzogbnVsbFxufSkge1xuICByZXR1cm4ga2V5cy5yZWR1Y2VSaWdodCgoYWNjLCBrZXkpPT4oe1xuICAgICAgW2tleV06IGFjY1xuICAgIH0pLCB2YWx1ZXMpO1xufVxuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiB2YWx1ZSAhPT0gbnVsbDtcbn1cbmZ1bmN0aW9uIGdldFRhcmdldFZhbHVlKHRhcmdldCwga2V5cykge1xuICBjb25zdCBrZXkgPSBrZXlzWzBdO1xuICBpZiAoIWtleSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBwYXJzZSB0aGUgVE9NTDoga2V5IGxlbmd0aCBpcyBub3QgYSBwb3NpdGl2ZSBudW1iZXJcIik7XG4gIH1cbiAgcmV0dXJuIHRhcmdldFtrZXldO1xufVxuZnVuY3Rpb24gZGVlcEFzc2lnblRhYmxlKHRhcmdldCwgdGFibGUpIHtcbiAgY29uc3QgeyBrZXlzLCB0eXBlLCB2YWx1ZSB9ID0gdGFibGU7XG4gIGNvbnN0IGN1cnJlbnRWYWx1ZSA9IGdldFRhcmdldFZhbHVlKHRhcmdldCwga2V5cyk7XG4gIGlmIChjdXJyZW50VmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHRhcmdldCwgdW5mbGF0KGtleXMsIHZhbHVlKSk7XG4gIH1cbiAgaWYgKEFycmF5LmlzQXJyYXkoY3VycmVudFZhbHVlKSkge1xuICAgIGNvbnN0IGxhc3QgPSBjdXJyZW50VmFsdWUuYXQoLTEpO1xuICAgIGRlZXBBc3NpZ24obGFzdCwge1xuICAgICAgdHlwZSxcbiAgICAgIGtleXM6IGtleXMuc2xpY2UoMSksXG4gICAgICB2YWx1ZVxuICAgIH0pO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cbiAgaWYgKGlzT2JqZWN0KGN1cnJlbnRWYWx1ZSkpIHtcbiAgICBkZWVwQXNzaWduKGN1cnJlbnRWYWx1ZSwge1xuICAgICAgdHlwZSxcbiAgICAgIGtleXM6IGtleXMuc2xpY2UoMSksXG4gICAgICB2YWx1ZVxuICAgIH0pO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBhc3NpZ25cIik7XG59XG5mdW5jdGlvbiBkZWVwQXNzaWduVGFibGVBcnJheSh0YXJnZXQsIHRhYmxlKSB7XG4gIGNvbnN0IHsgdHlwZSwga2V5cywgdmFsdWUgfSA9IHRhYmxlO1xuICBjb25zdCBjdXJyZW50VmFsdWUgPSBnZXRUYXJnZXRWYWx1ZSh0YXJnZXQsIGtleXMpO1xuICBpZiAoY3VycmVudFZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih0YXJnZXQsIHVuZmxhdChrZXlzLCBbXG4gICAgICB2YWx1ZVxuICAgIF0pKTtcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheShjdXJyZW50VmFsdWUpKSB7XG4gICAgaWYgKHRhYmxlLmtleXMubGVuZ3RoID09PSAxKSB7XG4gICAgICBjdXJyZW50VmFsdWUucHVzaCh2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGxhc3QgPSBjdXJyZW50VmFsdWUuYXQoLTEpO1xuICAgICAgZGVlcEFzc2lnbihsYXN0LCB7XG4gICAgICAgIHR5cGU6IHRhYmxlLnR5cGUsXG4gICAgICAgIGtleXM6IHRhYmxlLmtleXMuc2xpY2UoMSksXG4gICAgICAgIHZhbHVlOiB0YWJsZS52YWx1ZVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cbiAgaWYgKGlzT2JqZWN0KGN1cnJlbnRWYWx1ZSkpIHtcbiAgICBkZWVwQXNzaWduKGN1cnJlbnRWYWx1ZSwge1xuICAgICAgdHlwZSxcbiAgICAgIGtleXM6IGtleXMuc2xpY2UoMSksXG4gICAgICB2YWx1ZVxuICAgIH0pO1xuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBhc3NpZ25cIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZGVlcEFzc2lnbih0YXJnZXQsIGJvZHkpIHtcbiAgc3dpdGNoKGJvZHkudHlwZSl7XG4gICAgY2FzZSBcIkJsb2NrXCI6XG4gICAgICByZXR1cm4gZGVlcE1lcmdlKHRhcmdldCwgYm9keS52YWx1ZSk7XG4gICAgY2FzZSBcIlRhYmxlXCI6XG4gICAgICByZXR1cm4gZGVlcEFzc2lnblRhYmxlKHRhcmdldCwgYm9keSk7XG4gICAgY2FzZSBcIlRhYmxlQXJyYXlcIjpcbiAgICAgIHJldHVybiBkZWVwQXNzaWduVGFibGVBcnJheSh0YXJnZXQsIGJvZHkpO1xuICB9XG59XG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFBhcnNlciBjb21iaW5hdG9ycyBhbmQgZ2VuZXJhdG9yc1xuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZnVuY3Rpb24gb3IocGFyc2Vycykge1xuICByZXR1cm4gKHNjYW5uZXIpPT57XG4gICAgZm9yIChjb25zdCBwYXJzZSBvZiBwYXJzZXJzKXtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHBhcnNlKHNjYW5uZXIpO1xuICAgICAgaWYgKHJlc3VsdC5vaykgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgcmV0dXJuIGZhaWx1cmUoKTtcbiAgfTtcbn1cbi8qKiBKb2luIHRoZSBwYXJzZSByZXN1bHRzIG9mIHRoZSBnaXZlbiBwYXJzZXIgaW50byBhbiBhcnJheS5cbiAqXG4gKiBJZiB0aGUgcGFyc2VyIGZhaWxzIGF0IHRoZSBmaXJzdCBhdHRlbXB0LCBpdCB3aWxsIHJldHVybiBhbiBlbXB0eSBhcnJheS5cbiAqLyBmdW5jdGlvbiBqb2luKHBhcnNlciwgc2VwYXJhdG9yKSB7XG4gIGNvbnN0IFNlcGFyYXRvciA9IGNoYXJhY3RlcihzZXBhcmF0b3IpO1xuICByZXR1cm4gKHNjYW5uZXIpPT57XG4gICAgY29uc3Qgb3V0ID0gW107XG4gICAgY29uc3QgZmlyc3QgPSBwYXJzZXIoc2Nhbm5lcik7XG4gICAgaWYgKCFmaXJzdC5vaykgcmV0dXJuIHN1Y2Nlc3Mob3V0KTtcbiAgICBvdXQucHVzaChmaXJzdC5ib2R5KTtcbiAgICB3aGlsZSghc2Nhbm5lci5lb2YoKSl7XG4gICAgICBpZiAoIVNlcGFyYXRvcihzY2FubmVyKS5vaykgYnJlYWs7XG4gICAgICBjb25zdCByZXN1bHQgPSBwYXJzZXIoc2Nhbm5lcik7XG4gICAgICBpZiAoIXJlc3VsdC5vaykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgdG9rZW4gYWZ0ZXIgXCIke3NlcGFyYXRvcn1cImApO1xuICAgICAgfVxuICAgICAgb3V0LnB1c2gocmVzdWx0LmJvZHkpO1xuICAgIH1cbiAgICByZXR1cm4gc3VjY2VzcyhvdXQpO1xuICB9O1xufVxuLyoqIEpvaW4gdGhlIHBhcnNlIHJlc3VsdHMgb2YgdGhlIGdpdmVuIHBhcnNlciBpbnRvIGFuIGFycmF5LlxuICpcbiAqIFRoaXMgcmVxdWlyZXMgdGhlIHBhcnNlciB0byBzdWNjZWVkIGF0IGxlYXN0IG9uY2UuXG4gKi8gZnVuY3Rpb24gam9pbjEocGFyc2VyLCBzZXBhcmF0b3IpIHtcbiAgY29uc3QgU2VwYXJhdG9yID0gY2hhcmFjdGVyKHNlcGFyYXRvcik7XG4gIHJldHVybiAoc2Nhbm5lcik9PntcbiAgICBjb25zdCBmaXJzdCA9IHBhcnNlcihzY2FubmVyKTtcbiAgICBpZiAoIWZpcnN0Lm9rKSByZXR1cm4gZmFpbHVyZSgpO1xuICAgIGNvbnN0IG91dCA9IFtcbiAgICAgIGZpcnN0LmJvZHlcbiAgICBdO1xuICAgIHdoaWxlKCFzY2FubmVyLmVvZigpKXtcbiAgICAgIGlmICghU2VwYXJhdG9yKHNjYW5uZXIpLm9rKSBicmVhaztcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHBhcnNlcihzY2FubmVyKTtcbiAgICAgIGlmICghcmVzdWx0Lm9rKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCB0b2tlbiBhZnRlciBcIiR7c2VwYXJhdG9yfVwiYCk7XG4gICAgICB9XG4gICAgICBvdXQucHVzaChyZXN1bHQuYm9keSk7XG4gICAgfVxuICAgIHJldHVybiBzdWNjZXNzKG91dCk7XG4gIH07XG59XG5mdW5jdGlvbiBrdihrZXlQYXJzZXIsIHNlcGFyYXRvciwgdmFsdWVQYXJzZXIpIHtcbiAgY29uc3QgU2VwYXJhdG9yID0gY2hhcmFjdGVyKHNlcGFyYXRvcik7XG4gIHJldHVybiAoc2Nhbm5lcik9PntcbiAgICBjb25zdCBwb3NpdGlvbiA9IHNjYW5uZXIucG9zaXRpb247XG4gICAgY29uc3Qga2V5ID0ga2V5UGFyc2VyKHNjYW5uZXIpO1xuICAgIGlmICgha2V5Lm9rKSByZXR1cm4gZmFpbHVyZSgpO1xuICAgIGNvbnN0IHNlcCA9IFNlcGFyYXRvcihzY2FubmVyKTtcbiAgICBpZiAoIXNlcC5vaykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBrZXkvdmFsdWUgcGFpciBkb2Vzbid0IGhhdmUgXCIke3NlcGFyYXRvcn1cImApO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IHZhbHVlUGFyc2VyKHNjYW5uZXIpO1xuICAgIGlmICghdmFsdWUub2spIHtcbiAgICAgIGNvbnN0IGxpbmVFbmRJbmRleCA9IHNjYW5uZXIuc291cmNlLmluZGV4T2YoXCJcXG5cIiwgc2Nhbm5lci5wb3NpdGlvbik7XG4gICAgICBjb25zdCBlbmRQb3NpdGlvbiA9IGxpbmVFbmRJbmRleCA+IDAgPyBsaW5lRW5kSW5kZXggOiBzY2FubmVyLnNvdXJjZS5sZW5ndGg7XG4gICAgICBjb25zdCBsaW5lID0gc2Nhbm5lci5zb3VyY2Uuc2xpY2UocG9zaXRpb24sIGVuZFBvc2l0aW9uKTtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgQ2Fubm90IHBhcnNlIHZhbHVlIG9uIGxpbmUgJyR7bGluZX0nYCk7XG4gICAgfVxuICAgIHJldHVybiBzdWNjZXNzKHVuZmxhdChrZXkuYm9keSwgdmFsdWUuYm9keSkpO1xuICB9O1xufVxuZnVuY3Rpb24gbWVyZ2UocGFyc2VyKSB7XG4gIHJldHVybiAoc2Nhbm5lcik9PntcbiAgICBjb25zdCByZXN1bHQgPSBwYXJzZXIoc2Nhbm5lcik7XG4gICAgaWYgKCFyZXN1bHQub2spIHJldHVybiBmYWlsdXJlKCk7XG4gICAgbGV0IGJvZHkgPSB7XG4gICAgICBfX3Byb3RvX186IG51bGxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgcmVjb3JkIG9mIHJlc3VsdC5ib2R5KXtcbiAgICAgIGlmICh0eXBlb2YgcmVjb3JkID09PSBcIm9iamVjdFwiICYmIHJlY29yZCAhPT0gbnVsbCkge1xuICAgICAgICBib2R5ID0gZGVlcE1lcmdlKGJvZHksIHJlY29yZCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdWNjZXNzKGJvZHkpO1xuICB9O1xufVxuZnVuY3Rpb24gcmVwZWF0KHBhcnNlcikge1xuICByZXR1cm4gKHNjYW5uZXIpPT57XG4gICAgY29uc3QgYm9keSA9IFtdO1xuICAgIHdoaWxlKCFzY2FubmVyLmVvZigpKXtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHBhcnNlcihzY2FubmVyKTtcbiAgICAgIGlmICghcmVzdWx0Lm9rKSBicmVhaztcbiAgICAgIGJvZHkucHVzaChyZXN1bHQuYm9keSk7XG4gICAgICBzY2FubmVyLm5leHRVbnRpbENoYXIoKTtcbiAgICB9XG4gICAgaWYgKGJvZHkubGVuZ3RoID09PSAwKSByZXR1cm4gZmFpbHVyZSgpO1xuICAgIHJldHVybiBzdWNjZXNzKGJvZHkpO1xuICB9O1xufVxuZnVuY3Rpb24gc3Vycm91bmQobGVmdCwgcGFyc2VyLCByaWdodCkge1xuICBjb25zdCBMZWZ0ID0gY2hhcmFjdGVyKGxlZnQpO1xuICBjb25zdCBSaWdodCA9IGNoYXJhY3RlcihyaWdodCk7XG4gIHJldHVybiAoc2Nhbm5lcik9PntcbiAgICBpZiAoIUxlZnQoc2Nhbm5lcikub2spIHtcbiAgICAgIHJldHVybiBmYWlsdXJlKCk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IHBhcnNlcihzY2FubmVyKTtcbiAgICBpZiAoIXJlc3VsdC5vaykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuIGFmdGVyIFwiJHtsZWZ0fVwiYCk7XG4gICAgfVxuICAgIGlmICghUmlnaHQoc2Nhbm5lcikub2spIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgTm90IGNsb3NlZCBieSBcIiR7cmlnaHR9XCIgYWZ0ZXIgc3RhcnRlZCB3aXRoIFwiJHtsZWZ0fVwiYCk7XG4gICAgfVxuICAgIHJldHVybiBzdWNjZXNzKHJlc3VsdC5ib2R5KTtcbiAgfTtcbn1cbmZ1bmN0aW9uIGNoYXJhY3RlcihzdHIpIHtcbiAgcmV0dXJuIChzY2FubmVyKT0+e1xuICAgIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gICAgaWYgKCFzY2FubmVyLnN0YXJ0c1dpdGgoc3RyKSkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgICBzY2FubmVyLm5leHQoc3RyLmxlbmd0aCk7XG4gICAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgICByZXR1cm4gc3VjY2Vzcyh1bmRlZmluZWQpO1xuICB9O1xufVxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFBhcnNlciBjb21wb25lbnRzXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuY29uc3QgQkFSRV9LRVlfUkVHRVhQID0gL1tBLVphLXowLTlfLV0rL3k7XG5leHBvcnQgZnVuY3Rpb24gYmFyZUtleShzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGNvbnN0IGtleSA9IHNjYW5uZXIubWF0Y2goQkFSRV9LRVlfUkVHRVhQKT8uWzBdO1xuICBpZiAoIWtleSkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KGtleS5sZW5ndGgpO1xuICByZXR1cm4gc3VjY2VzcyhrZXkpO1xufVxuZnVuY3Rpb24gZXNjYXBlU2VxdWVuY2Uoc2Nhbm5lcikge1xuICBpZiAoc2Nhbm5lci5jaGFyKCkgIT09IFwiXFxcXFwiKSByZXR1cm4gZmFpbHVyZSgpO1xuICBzY2FubmVyLm5leHQoKTtcbiAgLy8gU2VlIGh0dHBzOi8vdG9tbC5pby9lbi92MS4wLjAtcmMuMyNzdHJpbmdcbiAgc3dpdGNoKHNjYW5uZXIuY2hhcigpKXtcbiAgICBjYXNlIFwiYlwiOlxuICAgICAgc2Nhbm5lci5uZXh0KCk7XG4gICAgICByZXR1cm4gc3VjY2VzcyhcIlxcYlwiKTtcbiAgICBjYXNlIFwidFwiOlxuICAgICAgc2Nhbm5lci5uZXh0KCk7XG4gICAgICByZXR1cm4gc3VjY2VzcyhcIlxcdFwiKTtcbiAgICBjYXNlIFwiblwiOlxuICAgICAgc2Nhbm5lci5uZXh0KCk7XG4gICAgICByZXR1cm4gc3VjY2VzcyhcIlxcblwiKTtcbiAgICBjYXNlIFwiZlwiOlxuICAgICAgc2Nhbm5lci5uZXh0KCk7XG4gICAgICByZXR1cm4gc3VjY2VzcyhcIlxcZlwiKTtcbiAgICBjYXNlIFwiclwiOlxuICAgICAgc2Nhbm5lci5uZXh0KCk7XG4gICAgICByZXR1cm4gc3VjY2VzcyhcIlxcclwiKTtcbiAgICBjYXNlIFwidVwiOlxuICAgIGNhc2UgXCJVXCI6XG4gICAgICB7XG4gICAgICAgIC8vIFVuaWNvZGUgY2hhcmFjdGVyXG4gICAgICAgIGNvbnN0IGNvZGVQb2ludExlbiA9IHNjYW5uZXIuY2hhcigpID09PSBcInVcIiA/IDQgOiA2O1xuICAgICAgICBjb25zdCBjb2RlUG9pbnQgPSBwYXJzZUludChcIjB4XCIgKyBzY2FubmVyLnNsaWNlKDEsIDEgKyBjb2RlUG9pbnRMZW4pLCAxNik7XG4gICAgICAgIGNvbnN0IHN0ciA9IFN0cmluZy5mcm9tQ29kZVBvaW50KGNvZGVQb2ludCk7XG4gICAgICAgIHNjYW5uZXIubmV4dChjb2RlUG9pbnRMZW4gKyAxKTtcbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3Moc3RyKTtcbiAgICAgIH1cbiAgICBjYXNlICdcIic6XG4gICAgICBzY2FubmVyLm5leHQoKTtcbiAgICAgIHJldHVybiBzdWNjZXNzKCdcIicpO1xuICAgIGNhc2UgXCJcXFxcXCI6XG4gICAgICBzY2FubmVyLm5leHQoKTtcbiAgICAgIHJldHVybiBzdWNjZXNzKFwiXFxcXFwiKTtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIGVzY2FwZSBzZXF1ZW5jZTogXFxcXCR7c2Nhbm5lci5jaGFyKCl9YCk7XG4gIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiBiYXNpY1N0cmluZyhzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGlmIChzY2FubmVyLmNoYXIoKSAhPT0gJ1wiJykgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KCk7XG4gIGNvbnN0IGFjYyA9IFtdO1xuICB3aGlsZShzY2FubmVyLmNoYXIoKSAhPT0gJ1wiJyAmJiAhc2Nhbm5lci5lb2YoKSl7XG4gICAgaWYgKHNjYW5uZXIuY2hhcigpID09PSBcIlxcblwiKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJTaW5nbGUtbGluZSBzdHJpbmcgY2Fubm90IGNvbnRhaW4gRU9MXCIpO1xuICAgIH1cbiAgICBjb25zdCBlc2NhcGVkQ2hhciA9IGVzY2FwZVNlcXVlbmNlKHNjYW5uZXIpO1xuICAgIGlmIChlc2NhcGVkQ2hhci5vaykge1xuICAgICAgYWNjLnB1c2goZXNjYXBlZENoYXIuYm9keSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFjYy5wdXNoKHNjYW5uZXIuY2hhcigpKTtcbiAgICAgIHNjYW5uZXIubmV4dCgpO1xuICAgIH1cbiAgfVxuICBpZiAoc2Nhbm5lci5lb2YoKSkge1xuICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgU2luZ2xlLWxpbmUgc3RyaW5nIGlzIG5vdCBjbG9zZWQ6XFxuJHthY2Muam9pbihcIlwiKX1gKTtcbiAgfVxuICBzY2FubmVyLm5leHQoKTsgLy8gc2tpcCBsYXN0ICdcIlwiXG4gIHJldHVybiBzdWNjZXNzKGFjYy5qb2luKFwiXCIpKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBsaXRlcmFsU3RyaW5nKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgaWYgKHNjYW5uZXIuY2hhcigpICE9PSBcIidcIikgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KCk7XG4gIGNvbnN0IGFjYyA9IFtdO1xuICB3aGlsZShzY2FubmVyLmNoYXIoKSAhPT0gXCInXCIgJiYgIXNjYW5uZXIuZW9mKCkpe1xuICAgIGlmIChzY2FubmVyLmNoYXIoKSA9PT0gXCJcXG5cIikge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiU2luZ2xlLWxpbmUgc3RyaW5nIGNhbm5vdCBjb250YWluIEVPTFwiKTtcbiAgICB9XG4gICAgYWNjLnB1c2goc2Nhbm5lci5jaGFyKCkpO1xuICAgIHNjYW5uZXIubmV4dCgpO1xuICB9XG4gIGlmIChzY2FubmVyLmVvZigpKSB7XG4gICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBTaW5nbGUtbGluZSBzdHJpbmcgaXMgbm90IGNsb3NlZDpcXG4ke2FjYy5qb2luKFwiXCIpfWApO1xuICB9XG4gIHNjYW5uZXIubmV4dCgpOyAvLyBza2lwIGxhc3QgXCInXCJcbiAgcmV0dXJuIHN1Y2Nlc3MoYWNjLmpvaW4oXCJcIikpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG11bHRpbGluZUJhc2ljU3RyaW5nKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgaWYgKCFzY2FubmVyLnN0YXJ0c1dpdGgoJ1wiXCJcIicpKSByZXR1cm4gZmFpbHVyZSgpO1xuICBzY2FubmVyLm5leHQoMyk7XG4gIGlmIChzY2FubmVyLmNoYXIoKSA9PT0gXCJcXG5cIikge1xuICAgIC8vIFRoZSBmaXJzdCBuZXdsaW5lIChMRikgaXMgdHJpbW1lZFxuICAgIHNjYW5uZXIubmV4dCgpO1xuICB9IGVsc2UgaWYgKHNjYW5uZXIuc3RhcnRzV2l0aChcIlxcclxcblwiKSkge1xuICAgIC8vIFRoZSBmaXJzdCBuZXdsaW5lIChDUkxGKSBpcyB0cmltbWVkXG4gICAgc2Nhbm5lci5uZXh0KDIpO1xuICB9XG4gIGNvbnN0IGFjYyA9IFtdO1xuICB3aGlsZSghc2Nhbm5lci5zdGFydHNXaXRoKCdcIlwiXCInKSAmJiAhc2Nhbm5lci5lb2YoKSl7XG4gICAgLy8gbGluZSBlbmRpbmcgYmFja3NsYXNoXG4gICAgaWYgKHNjYW5uZXIuc3RhcnRzV2l0aChcIlxcXFxcXG5cIikpIHtcbiAgICAgIHNjYW5uZXIubmV4dCgpO1xuICAgICAgc2Nhbm5lci5uZXh0VW50aWxDaGFyKHtcbiAgICAgICAgc2tpcENvbW1lbnRzOiBmYWxzZVxuICAgICAgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2UgaWYgKHNjYW5uZXIuc3RhcnRzV2l0aChcIlxcXFxcXHJcXG5cIikpIHtcbiAgICAgIHNjYW5uZXIubmV4dCgpO1xuICAgICAgc2Nhbm5lci5uZXh0VW50aWxDaGFyKHtcbiAgICAgICAgc2tpcENvbW1lbnRzOiBmYWxzZVxuICAgICAgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgZXNjYXBlZENoYXIgPSBlc2NhcGVTZXF1ZW5jZShzY2FubmVyKTtcbiAgICBpZiAoZXNjYXBlZENoYXIub2spIHtcbiAgICAgIGFjYy5wdXNoKGVzY2FwZWRDaGFyLmJvZHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhY2MucHVzaChzY2FubmVyLmNoYXIoKSk7XG4gICAgICBzY2FubmVyLm5leHQoKTtcbiAgICB9XG4gIH1cbiAgaWYgKHNjYW5uZXIuZW9mKCkpIHtcbiAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYE11bHRpLWxpbmUgc3RyaW5nIGlzIG5vdCBjbG9zZWQ6XFxuJHthY2Muam9pbihcIlwiKX1gKTtcbiAgfVxuICAvLyBpZiBlbmRzIHdpdGggNCBgXCJgLCBwdXNoIHRoZSBmaXN0IGBcImAgdG8gc3RyaW5nXG4gIGlmIChzY2FubmVyLmNoYXIoMykgPT09ICdcIicpIHtcbiAgICBhY2MucHVzaCgnXCInKTtcbiAgICBzY2FubmVyLm5leHQoKTtcbiAgfVxuICBzY2FubmVyLm5leHQoMyk7IC8vIHNraXAgbGFzdCAnXCJcIlwiXCJcbiAgcmV0dXJuIHN1Y2Nlc3MoYWNjLmpvaW4oXCJcIikpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG11bHRpbGluZUxpdGVyYWxTdHJpbmcoc2Nhbm5lcikge1xuICBzY2FubmVyLnNraXBXaGl0ZXNwYWNlcygpO1xuICBpZiAoIXNjYW5uZXIuc3RhcnRzV2l0aChcIicnJ1wiKSkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KDMpO1xuICBpZiAoc2Nhbm5lci5jaGFyKCkgPT09IFwiXFxuXCIpIHtcbiAgICAvLyBUaGUgZmlyc3QgbmV3bGluZSAoTEYpIGlzIHRyaW1tZWRcbiAgICBzY2FubmVyLm5leHQoKTtcbiAgfSBlbHNlIGlmIChzY2FubmVyLnN0YXJ0c1dpdGgoXCJcXHJcXG5cIikpIHtcbiAgICAvLyBUaGUgZmlyc3QgbmV3bGluZSAoQ1JMRikgaXMgdHJpbW1lZFxuICAgIHNjYW5uZXIubmV4dCgyKTtcbiAgfVxuICBjb25zdCBhY2MgPSBbXTtcbiAgd2hpbGUoIXNjYW5uZXIuc3RhcnRzV2l0aChcIicnJ1wiKSAmJiAhc2Nhbm5lci5lb2YoKSl7XG4gICAgYWNjLnB1c2goc2Nhbm5lci5jaGFyKCkpO1xuICAgIHNjYW5uZXIubmV4dCgpO1xuICB9XG4gIGlmIChzY2FubmVyLmVvZigpKSB7XG4gICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBNdWx0aS1saW5lIHN0cmluZyBpcyBub3QgY2xvc2VkOlxcbiR7YWNjLmpvaW4oXCJcIil9YCk7XG4gIH1cbiAgLy8gaWYgZW5kcyB3aXRoIDQgYCdgLCBwdXNoIHRoZSBmaXN0IGAnYCB0byBzdHJpbmdcbiAgaWYgKHNjYW5uZXIuY2hhcigzKSA9PT0gXCInXCIpIHtcbiAgICBhY2MucHVzaChcIidcIik7XG4gICAgc2Nhbm5lci5uZXh0KCk7XG4gIH1cbiAgc2Nhbm5lci5uZXh0KDMpOyAvLyBza2lwIGxhc3QgXCInJydcIlxuICByZXR1cm4gc3VjY2VzcyhhY2Muam9pbihcIlwiKSk7XG59XG5jb25zdCBCT09MRUFOX1JFR0VYUCA9IC8oPzp0cnVlfGZhbHNlKVxcYi95O1xuZXhwb3J0IGZ1bmN0aW9uIGJvb2xlYW4oc2Nhbm5lcikge1xuICBzY2FubmVyLnNraXBXaGl0ZXNwYWNlcygpO1xuICBjb25zdCBtYXRjaCA9IHNjYW5uZXIubWF0Y2goQk9PTEVBTl9SRUdFWFApO1xuICBpZiAoIW1hdGNoKSByZXR1cm4gZmFpbHVyZSgpO1xuICBjb25zdCBzdHJpbmcgPSBtYXRjaFswXTtcbiAgc2Nhbm5lci5uZXh0KHN0cmluZy5sZW5ndGgpO1xuICBjb25zdCB2YWx1ZSA9IHN0cmluZyA9PT0gXCJ0cnVlXCI7XG4gIHJldHVybiBzdWNjZXNzKHZhbHVlKTtcbn1cbmNvbnN0IElORklOSVRZX01BUCA9IG5ldyBNYXAoW1xuICBbXG4gICAgXCJpbmZcIixcbiAgICBJbmZpbml0eVxuICBdLFxuICBbXG4gICAgXCIraW5mXCIsXG4gICAgSW5maW5pdHlcbiAgXSxcbiAgW1xuICAgIFwiLWluZlwiLFxuICAgIC1JbmZpbml0eVxuICBdXG5dKTtcbmNvbnN0IElORklOSVRZX1JFR0VYUCA9IC9bKy1dP2luZlxcYi95O1xuZXhwb3J0IGZ1bmN0aW9uIGluZmluaXR5KHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgY29uc3QgbWF0Y2ggPSBzY2FubmVyLm1hdGNoKElORklOSVRZX1JFR0VYUCk7XG4gIGlmICghbWF0Y2gpIHJldHVybiBmYWlsdXJlKCk7XG4gIGNvbnN0IHN0cmluZyA9IG1hdGNoWzBdO1xuICBzY2FubmVyLm5leHQoc3RyaW5nLmxlbmd0aCk7XG4gIGNvbnN0IHZhbHVlID0gSU5GSU5JVFlfTUFQLmdldChzdHJpbmcpO1xuICByZXR1cm4gc3VjY2Vzcyh2YWx1ZSk7XG59XG5jb25zdCBOQU5fUkVHRVhQID0gL1srLV0/bmFuXFxiL3k7XG5leHBvcnQgZnVuY3Rpb24gbmFuKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgY29uc3QgbWF0Y2ggPSBzY2FubmVyLm1hdGNoKE5BTl9SRUdFWFApO1xuICBpZiAoIW1hdGNoKSByZXR1cm4gZmFpbHVyZSgpO1xuICBjb25zdCBzdHJpbmcgPSBtYXRjaFswXTtcbiAgc2Nhbm5lci5uZXh0KHN0cmluZy5sZW5ndGgpO1xuICBjb25zdCB2YWx1ZSA9IE5hTjtcbiAgcmV0dXJuIHN1Y2Nlc3ModmFsdWUpO1xufVxuZXhwb3J0IGNvbnN0IGRvdHRlZEtleSA9IGpvaW4xKG9yKFtcbiAgYmFyZUtleSxcbiAgYmFzaWNTdHJpbmcsXG4gIGxpdGVyYWxTdHJpbmdcbl0pLCBcIi5cIik7XG5jb25zdCBCSU5BUllfUkVHRVhQID0gLzBiWzAxXSsoPzpfWzAxXSspKlxcYi95O1xuZXhwb3J0IGZ1bmN0aW9uIGJpbmFyeShzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGNvbnN0IG1hdGNoID0gc2Nhbm5lci5tYXRjaChCSU5BUllfUkVHRVhQKT8uWzBdO1xuICBpZiAoIW1hdGNoKSByZXR1cm4gZmFpbHVyZSgpO1xuICBzY2FubmVyLm5leHQobWF0Y2gubGVuZ3RoKTtcbiAgY29uc3QgdmFsdWUgPSBtYXRjaC5zbGljZSgyKS5yZXBsYWNlQWxsKFwiX1wiLCBcIlwiKTtcbiAgY29uc3QgbnVtYmVyID0gcGFyc2VJbnQodmFsdWUsIDIpO1xuICByZXR1cm4gaXNOYU4obnVtYmVyKSA/IGZhaWx1cmUoKSA6IHN1Y2Nlc3MobnVtYmVyKTtcbn1cbmNvbnN0IE9DVEFMX1JFR0VYUCA9IC8wb1swLTddKyg/Ol9bMC03XSspKlxcYi95O1xuZXhwb3J0IGZ1bmN0aW9uIG9jdGFsKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgY29uc3QgbWF0Y2ggPSBzY2FubmVyLm1hdGNoKE9DVEFMX1JFR0VYUCk/LlswXTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KG1hdGNoLmxlbmd0aCk7XG4gIGNvbnN0IHZhbHVlID0gbWF0Y2guc2xpY2UoMikucmVwbGFjZUFsbChcIl9cIiwgXCJcIik7XG4gIGNvbnN0IG51bWJlciA9IHBhcnNlSW50KHZhbHVlLCA4KTtcbiAgcmV0dXJuIGlzTmFOKG51bWJlcikgPyBmYWlsdXJlKCkgOiBzdWNjZXNzKG51bWJlcik7XG59XG5jb25zdCBIRVhfUkVHRVhQID0gLzB4WzAtOWEtZl0rKD86X1swLTlhLWZdKykqXFxiL3lpO1xuZXhwb3J0IGZ1bmN0aW9uIGhleChzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGNvbnN0IG1hdGNoID0gc2Nhbm5lci5tYXRjaChIRVhfUkVHRVhQKT8uWzBdO1xuICBpZiAoIW1hdGNoKSByZXR1cm4gZmFpbHVyZSgpO1xuICBzY2FubmVyLm5leHQobWF0Y2gubGVuZ3RoKTtcbiAgY29uc3QgdmFsdWUgPSBtYXRjaC5zbGljZSgyKS5yZXBsYWNlQWxsKFwiX1wiLCBcIlwiKTtcbiAgY29uc3QgbnVtYmVyID0gcGFyc2VJbnQodmFsdWUsIDE2KTtcbiAgcmV0dXJuIGlzTmFOKG51bWJlcikgPyBmYWlsdXJlKCkgOiBzdWNjZXNzKG51bWJlcik7XG59XG5jb25zdCBJTlRFR0VSX1JFR0VYUCA9IC9bKy1dPyg/OjB8WzEtOV1bMC05XSooPzpfWzAtOV0rKSopXFxiL3k7XG5leHBvcnQgZnVuY3Rpb24gaW50ZWdlcihzY2FubmVyKSB7XG4gIHNjYW5uZXIuc2tpcFdoaXRlc3BhY2VzKCk7XG4gIGNvbnN0IG1hdGNoID0gc2Nhbm5lci5tYXRjaChJTlRFR0VSX1JFR0VYUCk/LlswXTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0KG1hdGNoLmxlbmd0aCk7XG4gIGNvbnN0IHZhbHVlID0gbWF0Y2gucmVwbGFjZUFsbChcIl9cIiwgXCJcIik7XG4gIGNvbnN0IGludCA9IHBhcnNlSW50KHZhbHVlLCAxMCk7XG4gIHJldHVybiBzdWNjZXNzKGludCk7XG59XG5jb25zdCBGTE9BVF9SRUdFWFAgPSAvWystXT8oPzowfFsxLTldWzAtOV0qKD86X1swLTldKykqKSg/OlxcLlswLTldKyg/Ol9bMC05XSspKik/KD86ZVsrLV0/WzAtOV0rKD86X1swLTldKykqKT9cXGIveWk7XG5leHBvcnQgZnVuY3Rpb24gZmxvYXQoc2Nhbm5lcikge1xuICBzY2FubmVyLnNraXBXaGl0ZXNwYWNlcygpO1xuICBjb25zdCBtYXRjaCA9IHNjYW5uZXIubWF0Y2goRkxPQVRfUkVHRVhQKT8uWzBdO1xuICBpZiAoIW1hdGNoKSByZXR1cm4gZmFpbHVyZSgpO1xuICBzY2FubmVyLm5leHQobWF0Y2gubGVuZ3RoKTtcbiAgY29uc3QgdmFsdWUgPSBtYXRjaC5yZXBsYWNlQWxsKFwiX1wiLCBcIlwiKTtcbiAgY29uc3QgZmxvYXQgPSBwYXJzZUZsb2F0KHZhbHVlKTtcbiAgaWYgKGlzTmFOKGZsb2F0KSkgcmV0dXJuIGZhaWx1cmUoKTtcbiAgcmV0dXJuIHN1Y2Nlc3MoZmxvYXQpO1xufVxuY29uc3QgREFURV9USU1FX1JFR0VYUCA9IC8oPzx5ZWFyPlxcZHs0fSktKD88bW9udGg+XFxkezJ9KS0oPzxkYXk+XFxkezJ9KSg/OlsgMC05VFouOistXSspP1xcYi95O1xuZXhwb3J0IGZ1bmN0aW9uIGRhdGVUaW1lKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgY29uc3QgbWF0Y2ggPSBzY2FubmVyLm1hdGNoKERBVEVfVElNRV9SRUdFWFApO1xuICBpZiAoIW1hdGNoKSByZXR1cm4gZmFpbHVyZSgpO1xuICBjb25zdCBzdHJpbmcgPSBtYXRjaFswXTtcbiAgc2Nhbm5lci5uZXh0KHN0cmluZy5sZW5ndGgpO1xuICBjb25zdCBncm91cHMgPSBtYXRjaC5ncm91cHM7XG4gIC8vIHNwZWNpYWwgY2FzZSBpZiBtb250aCBpcyBGZWJydWFyeVxuICBpZiAoZ3JvdXBzLm1vbnRoID09IFwiMDJcIikge1xuICAgIGNvbnN0IGRheXMgPSBwYXJzZUludChncm91cHMuZGF5KTtcbiAgICBpZiAoZGF5cyA+IDI5KSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgZGF0ZSBzdHJpbmcgXCIke21hdGNofVwiYCk7XG4gICAgfVxuICAgIGNvbnN0IHllYXIgPSBwYXJzZUludChncm91cHMueWVhcik7XG4gICAgaWYgKGRheXMgPiAyOCAmJiAhaXNMZWFwKHllYXIpKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgZGF0ZSBzdHJpbmcgXCIke21hdGNofVwiYCk7XG4gICAgfVxuICB9XG4gIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShzdHJpbmcudHJpbSgpKTtcbiAgLy8gaW52YWxpZCBkYXRlXG4gIGlmIChpc05hTihkYXRlLmdldFRpbWUoKSkpIHtcbiAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgZGF0ZSBzdHJpbmcgXCIke21hdGNofVwiYCk7XG4gIH1cbiAgcmV0dXJuIHN1Y2Nlc3MoZGF0ZSk7XG59XG5jb25zdCBMT0NBTF9USU1FX1JFR0VYUCA9IC8oXFxkezJ9KTooXFxkezJ9KTooXFxkezJ9KSg/OlxcLlswLTldKyk/XFxiL3k7XG5leHBvcnQgZnVuY3Rpb24gbG9jYWxUaW1lKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5za2lwV2hpdGVzcGFjZXMoKTtcbiAgY29uc3QgbWF0Y2ggPSBzY2FubmVyLm1hdGNoKExPQ0FMX1RJTUVfUkVHRVhQKT8uWzBdO1xuICBpZiAoIW1hdGNoKSByZXR1cm4gZmFpbHVyZSgpO1xuICBzY2FubmVyLm5leHQobWF0Y2gubGVuZ3RoKTtcbiAgcmV0dXJuIHN1Y2Nlc3MobWF0Y2gpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGFycmF5VmFsdWUoc2Nhbm5lcikge1xuICBzY2FubmVyLnNraXBXaGl0ZXNwYWNlcygpO1xuICBpZiAoc2Nhbm5lci5jaGFyKCkgIT09IFwiW1wiKSByZXR1cm4gZmFpbHVyZSgpO1xuICBzY2FubmVyLm5leHQoKTtcbiAgY29uc3QgYXJyYXkgPSBbXTtcbiAgd2hpbGUoIXNjYW5uZXIuZW9mKCkpe1xuICAgIHNjYW5uZXIubmV4dFVudGlsQ2hhcigpO1xuICAgIGNvbnN0IHJlc3VsdCA9IHZhbHVlKHNjYW5uZXIpO1xuICAgIGlmICghcmVzdWx0Lm9rKSBicmVhaztcbiAgICBhcnJheS5wdXNoKHJlc3VsdC5ib2R5KTtcbiAgICBzY2FubmVyLnNraXBXaGl0ZXNwYWNlcygpO1xuICAgIC8vIG1heSBoYXZlIGEgbmV4dCBpdGVtLCBidXQgdHJhaWxpbmcgY29tbWEgaXMgYWxsb3dlZCBhdCBhcnJheVxuICAgIGlmIChzY2FubmVyLmNoYXIoKSAhPT0gXCIsXCIpIGJyZWFrO1xuICAgIHNjYW5uZXIubmV4dCgpO1xuICB9XG4gIHNjYW5uZXIubmV4dFVudGlsQ2hhcigpO1xuICBpZiAoc2Nhbm5lci5jaGFyKCkgIT09IFwiXVwiKSB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJBcnJheSBpcyBub3QgY2xvc2VkXCIpO1xuICBzY2FubmVyLm5leHQoKTtcbiAgcmV0dXJuIHN1Y2Nlc3MoYXJyYXkpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGlubGluZVRhYmxlKHNjYW5uZXIpIHtcbiAgc2Nhbm5lci5uZXh0VW50aWxDaGFyKCk7XG4gIGlmIChzY2FubmVyLmNoYXIoMSkgPT09IFwifVwiKSB7XG4gICAgc2Nhbm5lci5uZXh0KDIpO1xuICAgIHJldHVybiBzdWNjZXNzKHtcbiAgICAgIF9fcHJvdG9fXzogbnVsbFxuICAgIH0pO1xuICB9XG4gIGNvbnN0IHBhaXJzID0gc3Vycm91bmQoXCJ7XCIsIGpvaW4ocGFpciwgXCIsXCIpLCBcIn1cIikoc2Nhbm5lcik7XG4gIGlmICghcGFpcnMub2spIHJldHVybiBmYWlsdXJlKCk7XG4gIGxldCB0YWJsZSA9IHtcbiAgICBfX3Byb3RvX186IG51bGxcbiAgfTtcbiAgZm9yIChjb25zdCBwYWlyIG9mIHBhaXJzLmJvZHkpe1xuICAgIHRhYmxlID0gZGVlcE1lcmdlKHRhYmxlLCBwYWlyKTtcbiAgfVxuICByZXR1cm4gc3VjY2Vzcyh0YWJsZSk7XG59XG5leHBvcnQgY29uc3QgdmFsdWUgPSBvcihbXG4gIG11bHRpbGluZUJhc2ljU3RyaW5nLFxuICBtdWx0aWxpbmVMaXRlcmFsU3RyaW5nLFxuICBiYXNpY1N0cmluZyxcbiAgbGl0ZXJhbFN0cmluZyxcbiAgYm9vbGVhbixcbiAgaW5maW5pdHksXG4gIG5hbixcbiAgZGF0ZVRpbWUsXG4gIGxvY2FsVGltZSxcbiAgYmluYXJ5LFxuICBvY3RhbCxcbiAgaGV4LFxuICBmbG9hdCxcbiAgaW50ZWdlcixcbiAgYXJyYXlWYWx1ZSxcbiAgaW5saW5lVGFibGVcbl0pO1xuZXhwb3J0IGNvbnN0IHBhaXIgPSBrdihkb3R0ZWRLZXksIFwiPVwiLCB2YWx1ZSk7XG5leHBvcnQgZnVuY3Rpb24gYmxvY2soc2Nhbm5lcikge1xuICBzY2FubmVyLm5leHRVbnRpbENoYXIoKTtcbiAgY29uc3QgcmVzdWx0ID0gbWVyZ2UocmVwZWF0KHBhaXIpKShzY2FubmVyKTtcbiAgaWYgKHJlc3VsdC5vaykgcmV0dXJuIHN1Y2Nlc3Moe1xuICAgIHR5cGU6IFwiQmxvY2tcIixcbiAgICB2YWx1ZTogcmVzdWx0LmJvZHlcbiAgfSk7XG4gIHJldHVybiBmYWlsdXJlKCk7XG59XG5leHBvcnQgY29uc3QgdGFibGVIZWFkZXIgPSBzdXJyb3VuZChcIltcIiwgZG90dGVkS2V5LCBcIl1cIik7XG5leHBvcnQgZnVuY3Rpb24gdGFibGUoc2Nhbm5lcikge1xuICBzY2FubmVyLm5leHRVbnRpbENoYXIoKTtcbiAgY29uc3QgaGVhZGVyID0gdGFibGVIZWFkZXIoc2Nhbm5lcik7XG4gIGlmICghaGVhZGVyLm9rKSByZXR1cm4gZmFpbHVyZSgpO1xuICBzY2FubmVyLm5leHRVbnRpbENoYXIoKTtcbiAgY29uc3QgYiA9IGJsb2NrKHNjYW5uZXIpO1xuICByZXR1cm4gc3VjY2Vzcyh7XG4gICAgdHlwZTogXCJUYWJsZVwiLFxuICAgIGtleXM6IGhlYWRlci5ib2R5LFxuICAgIHZhbHVlOiBiLm9rID8gYi5ib2R5LnZhbHVlIDoge1xuICAgICAgX19wcm90b19fOiBudWxsXG4gICAgfVxuICB9KTtcbn1cbmV4cG9ydCBjb25zdCB0YWJsZUFycmF5SGVhZGVyID0gc3Vycm91bmQoXCJbW1wiLCBkb3R0ZWRLZXksIFwiXV1cIik7XG5leHBvcnQgZnVuY3Rpb24gdGFibGVBcnJheShzY2FubmVyKSB7XG4gIHNjYW5uZXIubmV4dFVudGlsQ2hhcigpO1xuICBjb25zdCBoZWFkZXIgPSB0YWJsZUFycmF5SGVhZGVyKHNjYW5uZXIpO1xuICBpZiAoIWhlYWRlci5vaykgcmV0dXJuIGZhaWx1cmUoKTtcbiAgc2Nhbm5lci5uZXh0VW50aWxDaGFyKCk7XG4gIGNvbnN0IGIgPSBibG9jayhzY2FubmVyKTtcbiAgcmV0dXJuIHN1Y2Nlc3Moe1xuICAgIHR5cGU6IFwiVGFibGVBcnJheVwiLFxuICAgIGtleXM6IGhlYWRlci5ib2R5LFxuICAgIHZhbHVlOiBiLm9rID8gYi5ib2R5LnZhbHVlIDoge1xuICAgICAgX19wcm90b19fOiBudWxsXG4gICAgfVxuICB9KTtcbn1cbmV4cG9ydCBmdW5jdGlvbiB0b21sKHNjYW5uZXIpIHtcbiAgY29uc3QgYmxvY2tzID0gcmVwZWF0KG9yKFtcbiAgICBibG9jayxcbiAgICB0YWJsZUFycmF5LFxuICAgIHRhYmxlXG4gIF0pKShzY2FubmVyKTtcbiAgaWYgKCFibG9ja3Mub2spIHJldHVybiBzdWNjZXNzKHtcbiAgICBfX3Byb3RvX186IG51bGxcbiAgfSk7XG4gIGNvbnN0IGJvZHkgPSBibG9ja3MuYm9keS5yZWR1Y2UoZGVlcEFzc2lnbiwge1xuICAgIF9fcHJvdG9fXzogbnVsbFxuICB9KTtcbiAgcmV0dXJuIHN1Y2Nlc3MoYm9keSk7XG59XG5mdW5jdGlvbiBjcmVhdGVQYXJzZUVycm9yTWVzc2FnZShzY2FubmVyLCBtZXNzYWdlKSB7XG4gIGNvbnN0IHN0cmluZyA9IHNjYW5uZXIuc291cmNlLnNsaWNlKDAsIHNjYW5uZXIucG9zaXRpb24pO1xuICBjb25zdCBsaW5lcyA9IHN0cmluZy5zcGxpdChcIlxcblwiKTtcbiAgY29uc3Qgcm93ID0gbGluZXMubGVuZ3RoO1xuICBjb25zdCBjb2x1bW4gPSBsaW5lcy5hdCgtMSk/Lmxlbmd0aCA/PyAwO1xuICByZXR1cm4gYFBhcnNlIGVycm9yIG9uIGxpbmUgJHtyb3d9LCBjb2x1bW4gJHtjb2x1bW59OiAke21lc3NhZ2V9YDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZXJGYWN0b3J5KHBhcnNlcikge1xuICByZXR1cm4gKHRvbWxTdHJpbmcpPT57XG4gICAgY29uc3Qgc2Nhbm5lciA9IG5ldyBTY2FubmVyKHRvbWxTdHJpbmcpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBwYXJzZXIoc2Nhbm5lcik7XG4gICAgICBpZiAocmVzdWx0Lm9rICYmIHNjYW5uZXIuZW9mKCkpIHJldHVybiByZXN1bHQuYm9keTtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgVW5leHBlY3RlZCBjaGFyYWN0ZXI6IFwiJHtzY2FubmVyLmNoYXIoKX1cImA7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoY3JlYXRlUGFyc2VFcnJvck1lc3NhZ2Uoc2Nhbm5lciwgbWVzc2FnZSkpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoY3JlYXRlUGFyc2VFcnJvck1lc3NhZ2Uoc2Nhbm5lciwgZXJyb3IubWVzc2FnZSkpO1xuICAgICAgfVxuICAgICAgY29uc3QgbWVzc2FnZSA9IFwiSW52YWxpZCBlcnJvciB0eXBlIGNhdWdodFwiO1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGNyZWF0ZVBhcnNlRXJyb3JNZXNzYWdlKHNjYW5uZXIsIG1lc3NhZ2UpKTtcbiAgICB9XG4gIH07XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1fcGFyc2VyLmpzLm1hcCIsIi8vIENvcHlyaWdodCAyMDE4LTIwMjUgdGhlIERlbm8gYXV0aG9ycy4gTUlUIGxpY2Vuc2UuXG4vLyBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG5pbXBvcnQgeyBwYXJzZXJGYWN0b3J5LCB0b21sIH0gZnJvbSBcIi4vX3BhcnNlci5qc1wiO1xuLyoqXG4gKiBQYXJzZXMgYSB7QGxpbmsgaHR0cHM6Ly90b21sLmlvIHwgVE9NTH0gc3RyaW5nIGludG8gYW4gb2JqZWN0LlxuICpcbiAqIEBleGFtcGxlIFVzYWdlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgcGFyc2UgfSBmcm9tIFwiQHN0ZC90b21sL3BhcnNlXCI7XG4gKiBpbXBvcnQgeyBhc3NlcnRFcXVhbHMgfSBmcm9tIFwiQHN0ZC9hc3NlcnRcIjtcbiAqXG4gKiBjb25zdCB0b21sU3RyaW5nID0gYHRpdGxlID0gXCJUT01MIEV4YW1wbGVcIlxuICogW293bmVyXVxuICogbmFtZSA9IFwiQWxpY2VcIlxuICogYmlvID0gXCJBbGljZSBpcyBhIHByb2dyYW1tZXIuXCJgO1xuICpcbiAqIGNvbnN0IG9iaiA9IHBhcnNlKHRvbWxTdHJpbmcpO1xuICogYXNzZXJ0RXF1YWxzKG9iaiwgeyB0aXRsZTogXCJUT01MIEV4YW1wbGVcIiwgb3duZXI6IHsgbmFtZTogXCJBbGljZVwiLCBiaW86IFwiQWxpY2UgaXMgYSBwcm9ncmFtbWVyLlwiIH0gfSk7XG4gKiBgYGBcbiAqIEBwYXJhbSB0b21sU3RyaW5nIFRPTUwgc3RyaW5nIHRvIGJlIHBhcnNlZC5cbiAqIEByZXR1cm5zIFRoZSBwYXJzZWQgSlMgb2JqZWN0LlxuICovIGV4cG9ydCBmdW5jdGlvbiBwYXJzZSh0b21sU3RyaW5nKSB7XG4gIHJldHVybiBwYXJzZXJGYWN0b3J5KHRvbWwpKHRvbWxTdHJpbmcpO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cGFyc2UuanMubWFwIiwiLy8gVGhpcyBmaWxlIGlzIGdlbmVyYXRlZCBieSBjb2RlZ2VuL2luZGV4LnRzXG4vLyBEbyBub3QgZWRpdCB0aGlzIGZpbGUgbWFudWFsbHlcbmltcG9ydCB7IENvbW1hbmQsIE9wdGlvbiB9IGZyb20gJ2NsaXBhbmlvbidcbmltcG9ydCAqIGFzIHR5cGFuaW9uIGZyb20gJ3R5cGFuaW9uJ1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZU5ld0NvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcbiAgc3RhdGljIHBhdGhzID0gW1snbmV3J11dXG5cbiAgc3RhdGljIHVzYWdlID0gQ29tbWFuZC5Vc2FnZSh7XG4gICAgZGVzY3JpcHRpb246ICdDcmVhdGUgYSBuZXcgcHJvamVjdCB3aXRoIHByZS1jb25maWd1cmVkIGJvaWxlcnBsYXRlJyxcbiAgfSlcblxuICAkJHBhdGggPSBPcHRpb24uU3RyaW5nKHsgcmVxdWlyZWQ6IGZhbHNlIH0pXG5cbiAgJCRuYW1lPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1uYW1lLC1uJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1RoZSBuYW1lIG9mIHRoZSBwcm9qZWN0LCBkZWZhdWx0IHRvIHRoZSBuYW1lIG9mIHRoZSBkaXJlY3RvcnkgaWYgbm90IHByb3ZpZGVkJyxcbiAgfSlcblxuICBtaW5Ob2RlQXBpVmVyc2lvbiA9IE9wdGlvbi5TdHJpbmcoJy0tbWluLW5vZGUtYXBpLC12JywgJzQnLCB7XG4gICAgdmFsaWRhdG9yOiB0eXBhbmlvbi5pc051bWJlcigpLFxuICAgIGRlc2NyaXB0aW9uOiAnVGhlIG1pbmltdW0gTm9kZS1BUEkgdmVyc2lvbiB0byBzdXBwb3J0JyxcbiAgfSlcblxuICBwYWNrYWdlTWFuYWdlciA9IE9wdGlvbi5TdHJpbmcoJy0tcGFja2FnZS1tYW5hZ2VyJywgJ3lhcm4nLCB7XG4gICAgZGVzY3JpcHRpb246ICdUaGUgcGFja2FnZSBtYW5hZ2VyIHRvIHVzZS4gT25seSBzdXBwb3J0IHlhcm4gNC54IGZvciBub3cuJyxcbiAgfSlcblxuICBsaWNlbnNlID0gT3B0aW9uLlN0cmluZygnLS1saWNlbnNlLC1sJywgJ01JVCcsIHtcbiAgICBkZXNjcmlwdGlvbjogJ0xpY2Vuc2UgZm9yIG9wZW4tc291cmNlZCBwcm9qZWN0JyxcbiAgfSlcblxuICB0YXJnZXRzID0gT3B0aW9uLkFycmF5KCctLXRhcmdldHMsLXQnLCBbXSwge1xuICAgIGRlc2NyaXB0aW9uOiAnQWxsIHRhcmdldHMgdGhlIGNyYXRlIHdpbGwgYmUgY29tcGlsZWQgZm9yLicsXG4gIH0pXG5cbiAgZW5hYmxlRGVmYXVsdFRhcmdldHMgPSBPcHRpb24uQm9vbGVhbignLS1lbmFibGUtZGVmYXVsdC10YXJnZXRzJywgdHJ1ZSwge1xuICAgIGRlc2NyaXB0aW9uOiAnV2hldGhlciBlbmFibGUgZGVmYXVsdCB0YXJnZXRzJyxcbiAgfSlcblxuICBlbmFibGVBbGxUYXJnZXRzID0gT3B0aW9uLkJvb2xlYW4oJy0tZW5hYmxlLWFsbC10YXJnZXRzJywgZmFsc2UsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1doZXRoZXIgZW5hYmxlIGFsbCB0YXJnZXRzJyxcbiAgfSlcblxuICBlbmFibGVUeXBlRGVmID0gT3B0aW9uLkJvb2xlYW4oJy0tZW5hYmxlLXR5cGUtZGVmJywgdHJ1ZSwge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1doZXRoZXIgZW5hYmxlIHRoZSBgdHlwZS1kZWZgIGZlYXR1cmUgZm9yIHR5cGVzY3JpcHQgZGVmaW5pdGlvbnMgYXV0by1nZW5lcmF0aW9uJyxcbiAgfSlcblxuICBlbmFibGVHaXRodWJBY3Rpb25zID0gT3B0aW9uLkJvb2xlYW4oJy0tZW5hYmxlLWdpdGh1Yi1hY3Rpb25zJywgdHJ1ZSwge1xuICAgIGRlc2NyaXB0aW9uOiAnV2hldGhlciBnZW5lcmF0ZSBwcmVjb25maWd1cmVkIEdpdEh1YiBBY3Rpb25zIHdvcmtmbG93JyxcbiAgfSlcblxuICB0ZXN0RnJhbWV3b3JrID0gT3B0aW9uLlN0cmluZygnLS10ZXN0LWZyYW1ld29yaycsICdhdmEnLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnVGhlIEphdmFTY3JpcHQgdGVzdCBmcmFtZXdvcmsgdG8gdXNlLCBvbmx5IHN1cHBvcnQgYGF2YWAgZm9yIG5vdycsXG4gIH0pXG5cbiAgZHJ5UnVuID0gT3B0aW9uLkJvb2xlYW4oJy0tZHJ5LXJ1bicsIGZhbHNlLCB7XG4gICAgZGVzY3JpcHRpb246ICdXaGV0aGVyIHRvIHJ1biB0aGUgY29tbWFuZCBpbiBkcnktcnVuIG1vZGUnLFxuICB9KVxuXG4gIGdldE9wdGlvbnMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBhdGg6IHRoaXMuJCRwYXRoLFxuICAgICAgbmFtZTogdGhpcy4kJG5hbWUsXG4gICAgICBtaW5Ob2RlQXBpVmVyc2lvbjogdGhpcy5taW5Ob2RlQXBpVmVyc2lvbixcbiAgICAgIHBhY2thZ2VNYW5hZ2VyOiB0aGlzLnBhY2thZ2VNYW5hZ2VyLFxuICAgICAgbGljZW5zZTogdGhpcy5saWNlbnNlLFxuICAgICAgdGFyZ2V0czogdGhpcy50YXJnZXRzLFxuICAgICAgZW5hYmxlRGVmYXVsdFRhcmdldHM6IHRoaXMuZW5hYmxlRGVmYXVsdFRhcmdldHMsXG4gICAgICBlbmFibGVBbGxUYXJnZXRzOiB0aGlzLmVuYWJsZUFsbFRhcmdldHMsXG4gICAgICBlbmFibGVUeXBlRGVmOiB0aGlzLmVuYWJsZVR5cGVEZWYsXG4gICAgICBlbmFibGVHaXRodWJBY3Rpb25zOiB0aGlzLmVuYWJsZUdpdGh1YkFjdGlvbnMsXG4gICAgICB0ZXN0RnJhbWV3b3JrOiB0aGlzLnRlc3RGcmFtZXdvcmssXG4gICAgICBkcnlSdW46IHRoaXMuZHJ5UnVuLFxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBwcm9qZWN0IHdpdGggcHJlLWNvbmZpZ3VyZWQgYm9pbGVycGxhdGVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBOZXdPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSBwYXRoIHdoZXJlIHRoZSBOQVBJLVJTIHByb2plY3Qgd2lsbCBiZSBjcmVhdGVkLlxuICAgKi9cbiAgcGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogVGhlIG5hbWUgb2YgdGhlIHByb2plY3QsIGRlZmF1bHQgdG8gdGhlIG5hbWUgb2YgdGhlIGRpcmVjdG9yeSBpZiBub3QgcHJvdmlkZWRcbiAgICovXG4gIG5hbWU/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFRoZSBtaW5pbXVtIE5vZGUtQVBJIHZlcnNpb24gdG8gc3VwcG9ydFxuICAgKlxuICAgKiBAZGVmYXVsdCA0XG4gICAqL1xuICBtaW5Ob2RlQXBpVmVyc2lvbj86IG51bWJlclxuICAvKipcbiAgICogVGhlIHBhY2thZ2UgbWFuYWdlciB0byB1c2UuIE9ubHkgc3VwcG9ydCB5YXJuIDQueCBmb3Igbm93LlxuICAgKlxuICAgKiBAZGVmYXVsdCAneWFybidcbiAgICovXG4gIHBhY2thZ2VNYW5hZ2VyPzogc3RyaW5nXG4gIC8qKlxuICAgKiBMaWNlbnNlIGZvciBvcGVuLXNvdXJjZWQgcHJvamVjdFxuICAgKlxuICAgKiBAZGVmYXVsdCAnTUlUJ1xuICAgKi9cbiAgbGljZW5zZT86IHN0cmluZ1xuICAvKipcbiAgICogQWxsIHRhcmdldHMgdGhlIGNyYXRlIHdpbGwgYmUgY29tcGlsZWQgZm9yLlxuICAgKlxuICAgKiBAZGVmYXVsdCBbXVxuICAgKi9cbiAgdGFyZ2V0cz86IHN0cmluZ1tdXG4gIC8qKlxuICAgKiBXaGV0aGVyIGVuYWJsZSBkZWZhdWx0IHRhcmdldHNcbiAgICpcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgZW5hYmxlRGVmYXVsdFRhcmdldHM/OiBib29sZWFuXG4gIC8qKlxuICAgKiBXaGV0aGVyIGVuYWJsZSBhbGwgdGFyZ2V0c1xuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgZW5hYmxlQWxsVGFyZ2V0cz86IGJvb2xlYW5cbiAgLyoqXG4gICAqIFdoZXRoZXIgZW5hYmxlIHRoZSBgdHlwZS1kZWZgIGZlYXR1cmUgZm9yIHR5cGVzY3JpcHQgZGVmaW5pdGlvbnMgYXV0by1nZW5lcmF0aW9uXG4gICAqXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIGVuYWJsZVR5cGVEZWY/OiBib29sZWFuXG4gIC8qKlxuICAgKiBXaGV0aGVyIGdlbmVyYXRlIHByZWNvbmZpZ3VyZWQgR2l0SHViIEFjdGlvbnMgd29ya2Zsb3dcbiAgICpcbiAgICogQGRlZmF1bHQgdHJ1ZVxuICAgKi9cbiAgZW5hYmxlR2l0aHViQWN0aW9ucz86IGJvb2xlYW5cbiAgLyoqXG4gICAqIFRoZSBKYXZhU2NyaXB0IHRlc3QgZnJhbWV3b3JrIHRvIHVzZSwgb25seSBzdXBwb3J0IGBhdmFgIGZvciBub3dcbiAgICpcbiAgICogQGRlZmF1bHQgJ2F2YSdcbiAgICovXG4gIHRlc3RGcmFtZXdvcms/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gcnVuIHRoZSBjb21tYW5kIGluIGRyeS1ydW4gbW9kZVxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgZHJ5UnVuPzogYm9vbGVhblxufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlEZWZhdWx0TmV3T3B0aW9ucyhvcHRpb25zOiBOZXdPcHRpb25zKSB7XG4gIHJldHVybiB7XG4gICAgbWluTm9kZUFwaVZlcnNpb246IDQsXG4gICAgcGFja2FnZU1hbmFnZXI6ICd5YXJuJyxcbiAgICBsaWNlbnNlOiAnTUlUJyxcbiAgICB0YXJnZXRzOiBbXSxcbiAgICBlbmFibGVEZWZhdWx0VGFyZ2V0czogdHJ1ZSxcbiAgICBlbmFibGVBbGxUYXJnZXRzOiBmYWxzZSxcbiAgICBlbmFibGVUeXBlRGVmOiB0cnVlLFxuICAgIGVuYWJsZUdpdGh1YkFjdGlvbnM6IHRydWUsXG4gICAgdGVzdEZyYW1ld29yazogJ2F2YScsXG4gICAgZHJ5UnVuOiBmYWxzZSxcbiAgICAuLi5vcHRpb25zLFxuICB9XG59XG4iLCJpbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSBcIm5vZGU6bW9kdWxlXCI7XG5pbXBvcnQgeyBpc0Fic29sdXRlLCBqb2luLCByZXNvbHZlIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gXCJub2RlOnVybFwiO1xuLyoqXG4qIFJlc29sdmUgYW4gYWJzb2x1dGUgcGF0aCBmcm9tIHtAbGluayByb290fSwgYnV0IG9ubHlcbiogaWYge0BsaW5rIGlucHV0fSBpc24ndCBhbHJlYWR5IGFic29sdXRlLlxuKlxuKiBAcGFyYW0gaW5wdXQgVGhlIHBhdGggdG8gcmVzb2x2ZS5cbiogQHBhcmFtIHJvb3QgVGhlIGJhc2UgcGF0aDsgZGVmYXVsdCA9IHByb2Nlc3MuY3dkKClcbiogQHJldHVybnMgVGhlIHJlc29sdmVkIGFic29sdXRlIHBhdGguXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIGFic29sdXRlKGlucHV0LCByb290KSB7XG5cdHJldHVybiBpc0Fic29sdXRlKGlucHV0KSA/IGlucHV0IDogcmVzb2x2ZShyb290IHx8IFwiLlwiLCBpbnB1dCk7XG59XG5leHBvcnQgZnVuY3Rpb24gZnJvbShyb290LCBpZGVudCwgc2lsZW50KSB7XG5cdHRyeSB7XG5cdFx0Ly8gTk9URTogZGlycyBuZWVkIGEgdHJhaWxpbmcgXCIvXCIgT1IgZmlsZW5hbWUuIFdpdGggXCIvXCIgcm91dGUsXG5cdFx0Ly8gTm9kZSBhZGRzIFwibm9vcC5qc1wiIGFzIG1haW4gZmlsZSwgc28ganVzdCBkbyBcIm5vb3AuanNcIiBhbnl3YXkuXG5cdFx0bGV0IHIgPSByb290IGluc3RhbmNlb2YgVVJMIHx8IHJvb3Quc3RhcnRzV2l0aChcImZpbGU6Ly9cIikgPyBqb2luKGZpbGVVUkxUb1BhdGgocm9vdCksIFwibm9vcC5qc1wiKSA6IGpvaW4oYWJzb2x1dGUocm9vdCksIFwibm9vcC5qc1wiKTtcblx0XHRyZXR1cm4gY3JlYXRlUmVxdWlyZShyKS5yZXNvbHZlKGlkZW50KTtcblx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0aWYgKCFzaWxlbnQpIHRocm93IGVycjtcblx0fVxufVxuZXhwb3J0IGZ1bmN0aW9uIGN3ZChpZGVudCwgc2lsZW50KSB7XG5cdHJldHVybiBmcm9tKHJlc29sdmUoKSwgaWRlbnQsIHNpbGVudCk7XG59XG4iLCJpbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHsgYWJzb2x1dGUgfSBmcm9tIFwiZW1wYXRoaWMvcmVzb2x2ZVwiO1xuLyoqXG4qIEdldCBhbGwgcGFyZW50IGRpcmVjdG9yaWVzIG9mIHtAbGluayBiYXNlfS5cbiogU3RvcHMgYWZ0ZXIge0BsaW5rIE9wdGlvbnNbJ2xhc3QnXX0gaXMgcHJvY2Vzc2VkLlxuKlxuKiBAcmV0dXJucyBBbiBhcnJheSBvZiBhYnNvbHV0ZSBwYXRocyBvZiBhbGwgcGFyZW50IGRpcmVjdG9yaWVzLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiB1cChiYXNlLCBvcHRpb25zKSB7XG5cdGxldCB7IGxhc3QsIGN3ZCB9ID0gb3B0aW9ucyB8fCB7fTtcblx0bGV0IHRtcCA9IGFic29sdXRlKGJhc2UsIGN3ZCk7XG5cdGxldCByb290ID0gYWJzb2x1dGUobGFzdCB8fCBcIi9cIiwgY3dkKTtcblx0bGV0IHByZXYsIGFyciA9IFtdO1xuXHR3aGlsZSAocHJldiAhPT0gcm9vdCkge1xuXHRcdGFyci5wdXNoKHRtcCk7XG5cdFx0dG1wID0gZGlybmFtZShwcmV2ID0gdG1wKTtcblx0XHRpZiAodG1wID09PSBwcmV2KSBicmVhaztcblx0fVxuXHRyZXR1cm4gYXJyO1xufVxuIiwiaW1wb3J0IHsgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcbmltcG9ydCB7IGV4aXN0c1N5bmMsIHN0YXRTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCAqIGFzIHdhbGsgZnJvbSBcImVtcGF0aGljL3dhbGtcIjtcbi8qKlxuKiBGaW5kIGFuIGl0ZW0gYnkgbmFtZSwgd2Fsa2luZyBwYXJlbnQgZGlyZWN0b3JpZXMgdW50aWwgZm91bmQuXG4qXG4qIEBwYXJhbSBuYW1lIFRoZSBpdGVtIG5hbWUgdG8gZmluZC5cbiogQHJldHVybnMgVGhlIGFic29sdXRlIHBhdGggdG8gdGhlIGl0ZW0sIGlmIGZvdW5kLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiB1cChuYW1lLCBvcHRpb25zKSB7XG5cdGxldCBkaXIsIHRtcDtcblx0bGV0IHN0YXJ0ID0gb3B0aW9ucyAmJiBvcHRpb25zLmN3ZCB8fCBcIlwiO1xuXHRmb3IgKGRpciBvZiB3YWxrLnVwKHN0YXJ0LCBvcHRpb25zKSkge1xuXHRcdHRtcCA9IGpvaW4oZGlyLCBuYW1lKTtcblx0XHRpZiAoZXhpc3RzU3luYyh0bXApKSByZXR1cm4gdG1wO1xuXHR9XG59XG4vKipcbiogR2V0IHRoZSBmaXJzdCBwYXRoIHRoYXQgbWF0Y2hlcyBhbnkgb2YgdGhlIG5hbWVzIHByb3ZpZGVkLlxuKlxuKiA+IFtOT1RFXVxuKiA+IFRoZSBvcmRlciBvZiB7QGxpbmsgbmFtZXN9IGlzIHJlc3BlY3RlZC5cbipcbiogQHBhcmFtIG5hbWVzIFRoZSBpdGVtIG5hbWVzIHRvIGZpbmQuXG4qIEByZXR1cm5zIFRoZSBhYnNvbHV0ZSBwYXRoIG9mIHRoZSBmaXJzdCBpdGVtIGZvdW5kLCBpZiBhbnkuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIGFueShuYW1lcywgb3B0aW9ucykge1xuXHRsZXQgZGlyLCBzdGFydCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jd2QgfHwgXCJcIjtcblx0bGV0IGogPSAwLCBsZW4gPSBuYW1lcy5sZW5ndGgsIHRtcDtcblx0Zm9yIChkaXIgb2Ygd2Fsay51cChzdGFydCwgb3B0aW9ucykpIHtcblx0XHRmb3IgKGogPSAwOyBqIDwgbGVuOyBqKyspIHtcblx0XHRcdHRtcCA9IGpvaW4oZGlyLCBuYW1lc1tqXSk7XG5cdFx0XHRpZiAoZXhpc3RzU3luYyh0bXApKSByZXR1cm4gdG1wO1xuXHRcdH1cblx0fVxufVxuLyoqXG4qIEZpbmQgYSBmaWxlIGJ5IG5hbWUsIHdhbGtpbmcgcGFyZW50IGRpcmVjdG9yaWVzIHVudGlsIGZvdW5kLlxuKlxuKiA+IFtOT1RFXVxuKiA+IFRoaXMgZnVuY3Rpb24gb25seSByZXR1cm5zIGEgdmFsdWUgZm9yIGZpbGUgbWF0Y2hlcy5cbiogPiBBIGRpcmVjdG9yeSBtYXRjaCB3aXRoIHRoZSBzYW1lIG5hbWUgd2lsbCBiZSBpZ25vcmVkLlxuKlxuKiBAcGFyYW0gbmFtZSBUaGUgZmlsZSBuYW1lIHRvIGZpbmQuXG4qIEByZXR1cm5zIFRoZSBhYnNvbHV0ZSBwYXRoIHRvIHRoZSBmaWxlLCBpZiBmb3VuZC5cbiovXG5leHBvcnQgZnVuY3Rpb24gZmlsZShuYW1lLCBvcHRpb25zKSB7XG5cdGxldCBkaXIsIHRtcDtcblx0bGV0IHN0YXJ0ID0gb3B0aW9ucyAmJiBvcHRpb25zLmN3ZCB8fCBcIlwiO1xuXHRmb3IgKGRpciBvZiB3YWxrLnVwKHN0YXJ0LCBvcHRpb25zKSkge1xuXHRcdHRyeSB7XG5cdFx0XHR0bXAgPSBqb2luKGRpciwgbmFtZSk7XG5cdFx0XHRpZiAoc3RhdFN5bmModG1wKS5pc0ZpbGUoKSkgcmV0dXJuIHRtcDtcblx0XHR9IGNhdGNoIHt9XG5cdH1cbn1cbi8qKlxuKiBGaW5kIGEgZGlyZWN0b3J5IGJ5IG5hbWUsIHdhbGtpbmcgcGFyZW50IGRpcmVjdG9yaWVzIHVudGlsIGZvdW5kLlxuKlxuKiA+IFtOT1RFXVxuKiA+IFRoaXMgZnVuY3Rpb24gb25seSByZXR1cm5zIGEgdmFsdWUgZm9yIGRpcmVjdG9yeSBtYXRjaGVzLlxuKiA+IEEgZmlsZSBtYXRjaCB3aXRoIHRoZSBzYW1lIG5hbWUgd2lsbCBiZSBpZ25vcmVkLlxuKlxuKiBAcGFyYW0gbmFtZSBUaGUgZGlyZWN0b3J5IG5hbWUgdG8gZmluZC5cbiogQHJldHVybnMgVGhlIGFic29sdXRlIHBhdGggdG8gdGhlIGZpbGUsIGlmIGZvdW5kLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBkaXIobmFtZSwgb3B0aW9ucykge1xuXHRsZXQgZGlyLCB0bXA7XG5cdGxldCBzdGFydCA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jd2QgfHwgXCJcIjtcblx0Zm9yIChkaXIgb2Ygd2Fsay51cChzdGFydCwgb3B0aW9ucykpIHtcblx0XHR0cnkge1xuXHRcdFx0dG1wID0gam9pbihkaXIsIG5hbWUpO1xuXHRcdFx0aWYgKHN0YXRTeW5jKHRtcCkuaXNEaXJlY3RvcnkoKSkgcmV0dXJuIHRtcDtcblx0XHR9IGNhdGNoIHt9XG5cdH1cbn1cbiIsIi8vIFRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgYnkgY29kZWdlbi9pbmRleC50c1xuLy8gRG8gbm90IGVkaXQgdGhpcyBmaWxlIG1hbnVhbGx5XG5pbXBvcnQgeyBDb21tYW5kLCBPcHRpb24gfSBmcm9tICdjbGlwYW5pb24nXG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlUmVuYW1lQ29tbWFuZCBleHRlbmRzIENvbW1hbmQge1xuICBzdGF0aWMgcGF0aHMgPSBbWydyZW5hbWUnXV1cblxuICBzdGF0aWMgdXNhZ2UgPSBDb21tYW5kLlVzYWdlKHtcbiAgICBkZXNjcmlwdGlvbjogJ1JlbmFtZSB0aGUgTkFQSS1SUyBwcm9qZWN0JyxcbiAgfSlcblxuICBjd2QgPSBPcHRpb24uU3RyaW5nKCctLWN3ZCcsIHByb2Nlc3MuY3dkKCksIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGgnLFxuICB9KVxuXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWNvbmZpZy1wYXRoLC1jJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZScsXG4gIH0pXG5cbiAgcGFja2FnZUpzb25QYXRoID0gT3B0aW9uLlN0cmluZygnLS1wYWNrYWdlLWpzb24tcGF0aCcsICdwYWNrYWdlLmpzb24nLCB7XG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGBwYWNrYWdlLmpzb25gJyxcbiAgfSlcblxuICBucG1EaXIgPSBPcHRpb24uU3RyaW5nKCctLW5wbS1kaXInLCAnbnBtJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0JyxcbiAgfSlcblxuICAkJG5hbWU/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLW5hbWUsLW4nLCB7XG4gICAgZGVzY3JpcHRpb246ICdUaGUgbmV3IG5hbWUgb2YgdGhlIHByb2plY3QnLFxuICB9KVxuXG4gIGJpbmFyeU5hbWU/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWJpbmFyeS1uYW1lLC1iJywge1xuICAgIGRlc2NyaXB0aW9uOiAnVGhlIG5ldyBiaW5hcnkgbmFtZSAqLm5vZGUgZmlsZXMnLFxuICB9KVxuXG4gIHBhY2thZ2VOYW1lPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1wYWNrYWdlLW5hbWUnLCB7XG4gICAgZGVzY3JpcHRpb246ICdUaGUgbmV3IHBhY2thZ2UgbmFtZSBvZiB0aGUgcHJvamVjdCcsXG4gIH0pXG5cbiAgbWFuaWZlc3RQYXRoID0gT3B0aW9uLlN0cmluZygnLS1tYW5pZmVzdC1wYXRoJywgJ0NhcmdvLnRvbWwnLCB7XG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGBDYXJnby50b21sYCcsXG4gIH0pXG5cbiAgcmVwb3NpdG9yeT86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tcmVwb3NpdG9yeScsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1RoZSBuZXcgcmVwb3NpdG9yeSBvZiB0aGUgcHJvamVjdCcsXG4gIH0pXG5cbiAgZGVzY3JpcHRpb24/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWRlc2NyaXB0aW9uJywge1xuICAgIGRlc2NyaXB0aW9uOiAnVGhlIG5ldyBkZXNjcmlwdGlvbiBvZiB0aGUgcHJvamVjdCcsXG4gIH0pXG5cbiAgZ2V0T3B0aW9ucygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY3dkOiB0aGlzLmN3ZCxcbiAgICAgIGNvbmZpZ1BhdGg6IHRoaXMuY29uZmlnUGF0aCxcbiAgICAgIHBhY2thZ2VKc29uUGF0aDogdGhpcy5wYWNrYWdlSnNvblBhdGgsXG4gICAgICBucG1EaXI6IHRoaXMubnBtRGlyLFxuICAgICAgbmFtZTogdGhpcy4kJG5hbWUsXG4gICAgICBiaW5hcnlOYW1lOiB0aGlzLmJpbmFyeU5hbWUsXG4gICAgICBwYWNrYWdlTmFtZTogdGhpcy5wYWNrYWdlTmFtZSxcbiAgICAgIG1hbmlmZXN0UGF0aDogdGhpcy5tYW5pZmVzdFBhdGgsXG4gICAgICByZXBvc2l0b3J5OiB0aGlzLnJlcG9zaXRvcnksXG4gICAgICBkZXNjcmlwdGlvbjogdGhpcy5kZXNjcmlwdGlvbixcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBSZW5hbWUgdGhlIE5BUEktUlMgcHJvamVjdFxuICovXG5leHBvcnQgaW50ZXJmYWNlIFJlbmFtZU9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoXG4gICAqXG4gICAqIEBkZWZhdWx0IHByb2Nlc3MuY3dkKClcbiAgICovXG4gIGN3ZD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgKi9cbiAgY29uZmlnUGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgcGFja2FnZS5qc29uYFxuICAgKlxuICAgKiBAZGVmYXVsdCAncGFja2FnZS5qc29uJ1xuICAgKi9cbiAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgdGhlIG5wbSBwYWNrYWdlcyBwdXRcbiAgICpcbiAgICogQGRlZmF1bHQgJ25wbSdcbiAgICovXG4gIG5wbURpcj86IHN0cmluZ1xuICAvKipcbiAgICogVGhlIG5ldyBuYW1lIG9mIHRoZSBwcm9qZWN0XG4gICAqL1xuICBuYW1lPzogc3RyaW5nXG4gIC8qKlxuICAgKiBUaGUgbmV3IGJpbmFyeSBuYW1lICoubm9kZSBmaWxlc1xuICAgKi9cbiAgYmluYXJ5TmFtZT86IHN0cmluZ1xuICAvKipcbiAgICogVGhlIG5ldyBwYWNrYWdlIG5hbWUgb2YgdGhlIHByb2plY3RcbiAgICovXG4gIHBhY2thZ2VOYW1lPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIGBDYXJnby50b21sYFxuICAgKlxuICAgKiBAZGVmYXVsdCAnQ2FyZ28udG9tbCdcbiAgICovXG4gIG1hbmlmZXN0UGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogVGhlIG5ldyByZXBvc2l0b3J5IG9mIHRoZSBwcm9qZWN0XG4gICAqL1xuICByZXBvc2l0b3J5Pzogc3RyaW5nXG4gIC8qKlxuICAgKiBUaGUgbmV3IGRlc2NyaXB0aW9uIG9mIHRoZSBwcm9qZWN0XG4gICAqL1xuICBkZXNjcmlwdGlvbj86IHN0cmluZ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlEZWZhdWx0UmVuYW1lT3B0aW9ucyhvcHRpb25zOiBSZW5hbWVPcHRpb25zKSB7XG4gIHJldHVybiB7XG4gICAgY3dkOiBwcm9jZXNzLmN3ZCgpLFxuICAgIHBhY2thZ2VKc29uUGF0aDogJ3BhY2thZ2UuanNvbicsXG4gICAgbnBtRGlyOiAnbnBtJyxcbiAgICBtYW5pZmVzdFBhdGg6ICdDYXJnby50b21sJyxcbiAgICAuLi5vcHRpb25zLFxuICB9XG59XG4iLCJpbXBvcnQgeyBleGlzdHNTeW5jIH0gZnJvbSAnbm9kZTpmcydcbmltcG9ydCB7IHJlbmFtZSB9IGZyb20gJ25vZGU6ZnMvcHJvbWlzZXMnXG5pbXBvcnQgeyByZXNvbHZlLCBqb2luIH0gZnJvbSAnbm9kZTpwYXRoJ1xuXG5pbXBvcnQgeyBwYXJzZSBhcyBwYXJzZVRvbWwsIHN0cmluZ2lmeSBhcyBzdHJpbmdpZnlUb21sIH0gZnJvbSAnQHN0ZC90b21sJ1xuaW1wb3J0IHsgbG9hZCBhcyB5YW1sUGFyc2UsIGR1bXAgYXMgeWFtbFN0cmluZ2lmeSB9IGZyb20gJ2pzLXlhbWwnXG5pbXBvcnQgeyBpc05pbCwgbWVyZ2UsIG9taXRCeSwgcGljayB9IGZyb20gJ2VzLXRvb2xraXQnXG5pbXBvcnQgKiBhcyBmaW5kIGZyb20gJ2VtcGF0aGljL2ZpbmQnXG5cbmltcG9ydCB7IGFwcGx5RGVmYXVsdFJlbmFtZU9wdGlvbnMsIHR5cGUgUmVuYW1lT3B0aW9ucyB9IGZyb20gJy4uL2RlZi9yZW5hbWUuanMnXG5pbXBvcnQgeyByZWFkQ29uZmlnLCByZWFkRmlsZUFzeW5jLCB3cml0ZUZpbGVBc3luYyB9IGZyb20gJy4uL3V0aWxzL2luZGV4LmpzJ1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVuYW1lUHJvamVjdCh1c2VyT3B0aW9uczogUmVuYW1lT3B0aW9ucykge1xuICBjb25zdCBvcHRpb25zID0gYXBwbHlEZWZhdWx0UmVuYW1lT3B0aW9ucyh1c2VyT3B0aW9ucylcbiAgY29uc3QgbmFwaUNvbmZpZyA9IGF3YWl0IHJlYWRDb25maWcob3B0aW9ucylcbiAgY29uc3Qgb2xkTmFtZSA9IG5hcGlDb25maWcuYmluYXJ5TmFtZVxuXG4gIGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IHJlc29sdmUob3B0aW9ucy5jd2QsIG9wdGlvbnMucGFja2FnZUpzb25QYXRoKVxuICBjb25zdCBjYXJnb1RvbWxQYXRoID0gcmVzb2x2ZShvcHRpb25zLmN3ZCwgb3B0aW9ucy5tYW5pZmVzdFBhdGgpXG5cbiAgY29uc3QgcGFja2FnZUpzb25Db250ZW50ID0gYXdhaXQgcmVhZEZpbGVBc3luYyhwYWNrYWdlSnNvblBhdGgsICd1dGY4JylcbiAgY29uc3QgcGFja2FnZUpzb25EYXRhID0gSlNPTi5wYXJzZShwYWNrYWdlSnNvbkNvbnRlbnQpXG5cbiAgbWVyZ2UoXG4gICAgbWVyZ2UoXG4gICAgICBwYWNrYWdlSnNvbkRhdGEsXG4gICAgICBvbWl0QnkoXG4gICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgbWlzc2luZyBmaWVsZHM6IGF1dGhvciBhbmQgbGljZW5zZVxuICAgICAgICBwaWNrKG9wdGlvbnMsIFsnbmFtZScsICdkZXNjcmlwdGlvbicsICdhdXRob3InLCAnbGljZW5zZSddKSxcbiAgICAgICAgaXNOaWwsXG4gICAgICApLFxuICAgICksXG4gICAge1xuICAgICAgbmFwaTogb21pdEJ5KFxuICAgICAgICB7XG4gICAgICAgICAgYmluYXJ5TmFtZTogb3B0aW9ucy5iaW5hcnlOYW1lLFxuICAgICAgICAgIHBhY2thZ2VOYW1lOiBvcHRpb25zLnBhY2thZ2VOYW1lLFxuICAgICAgICB9LFxuICAgICAgICBpc05pbCxcbiAgICAgICksXG4gICAgfSxcbiAgKVxuXG4gIGlmIChvcHRpb25zLnJlcG9zaXRvcnkpIHtcbiAgICBpZiAoXG4gICAgICBwYWNrYWdlSnNvbkRhdGEucmVwb3NpdG9yeSAmJlxuICAgICAgdHlwZW9mIHBhY2thZ2VKc29uRGF0YS5yZXBvc2l0b3J5ID09PSAnb2JqZWN0JyAmJlxuICAgICAgIUFycmF5LmlzQXJyYXkocGFja2FnZUpzb25EYXRhLnJlcG9zaXRvcnkpXG4gICAgKSB7XG4gICAgICBwYWNrYWdlSnNvbkRhdGEucmVwb3NpdG9yeS51cmwgPSBvcHRpb25zLnJlcG9zaXRvcnlcbiAgICB9IGVsc2Uge1xuICAgICAgcGFja2FnZUpzb25EYXRhLnJlcG9zaXRvcnkgPSBvcHRpb25zLnJlcG9zaXRvcnlcbiAgICB9XG4gIH1cblxuICBpZiAob3B0aW9ucy5jb25maWdQYXRoKSB7XG4gICAgY29uc3QgY29uZmlnUGF0aCA9IHJlc29sdmUob3B0aW9ucy5jd2QsIG9wdGlvbnMuY29uZmlnUGF0aClcbiAgICBjb25zdCBjb25maWdDb250ZW50ID0gYXdhaXQgcmVhZEZpbGVBc3luYyhjb25maWdQYXRoLCAndXRmOCcpXG4gICAgY29uc3QgY29uZmlnRGF0YSA9IEpTT04ucGFyc2UoY29uZmlnQ29udGVudClcbiAgICBtZXJnZShcbiAgICAgIGNvbmZpZ0RhdGEsXG4gICAgICBvbWl0QnkoXG4gICAgICAgIHtcbiAgICAgICAgICBiaW5hcnlOYW1lOiBvcHRpb25zLmJpbmFyeU5hbWUsXG4gICAgICAgICAgcGFja2FnZU5hbWU6IG9wdGlvbnMucGFja2FnZU5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIGlzTmlsLFxuICAgICAgKSxcbiAgICApXG4gICAgYXdhaXQgd3JpdGVGaWxlQXN5bmMoY29uZmlnUGF0aCwgSlNPTi5zdHJpbmdpZnkoY29uZmlnRGF0YSwgbnVsbCwgMikpXG4gIH1cblxuICBhd2FpdCB3cml0ZUZpbGVBc3luYyhcbiAgICBwYWNrYWdlSnNvblBhdGgsXG4gICAgSlNPTi5zdHJpbmdpZnkocGFja2FnZUpzb25EYXRhLCBudWxsLCAyKSxcbiAgKVxuXG4gIGNvbnN0IHRvbWxDb250ZW50ID0gYXdhaXQgcmVhZEZpbGVBc3luYyhjYXJnb1RvbWxQYXRoLCAndXRmOCcpXG4gIGNvbnN0IGNhcmdvVG9tbCA9IHBhcnNlVG9tbCh0b21sQ29udGVudCkgYXMgYW55XG5cbiAgLy8gVXBkYXRlIHRoZSBwYWNrYWdlIG5hbWVcbiAgaWYgKGNhcmdvVG9tbC5wYWNrYWdlICYmIG9wdGlvbnMuYmluYXJ5TmFtZSkge1xuICAgIC8vIFNhbml0aXplIHRoZSBiaW5hcnkgbmFtZSBmb3IgUnVzdCBwYWNrYWdlIG5hbWluZyBjb252ZW50aW9uc1xuICAgIGNvbnN0IHNhbml0aXplZE5hbWUgPSBvcHRpb25zLmJpbmFyeU5hbWVcbiAgICAgIC5yZXBsYWNlKCdAJywgJycpXG4gICAgICAucmVwbGFjZSgnLycsICdfJylcbiAgICAgIC5yZXBsYWNlKC8tL2csICdfJylcbiAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgY2FyZ29Ub21sLnBhY2thZ2UubmFtZSA9IHNhbml0aXplZE5hbWVcbiAgfVxuXG4gIC8vIFN0cmluZ2lmeSB0aGUgdXBkYXRlZCBUT01MXG4gIGNvbnN0IHVwZGF0ZWRUb21sQ29udGVudCA9IHN0cmluZ2lmeVRvbWwoY2FyZ29Ub21sKVxuXG4gIGF3YWl0IHdyaXRlRmlsZUFzeW5jKGNhcmdvVG9tbFBhdGgsIHVwZGF0ZWRUb21sQ29udGVudClcbiAgaWYgKG9wdGlvbnMuYmluYXJ5TmFtZSAmJiBvbGROYW1lICE9PSBvcHRpb25zLmJpbmFyeU5hbWUpIHtcbiAgICBjb25zdCBnaXRodWJBY3Rpb25zUGF0aCA9IGZpbmQuZGlyKCcuZ2l0aHViJywge1xuICAgICAgY3dkOiBvcHRpb25zLmN3ZCxcbiAgICB9KVxuICAgIGlmIChnaXRodWJBY3Rpb25zUGF0aCkge1xuICAgICAgY29uc3QgZ2l0aHViQWN0aW9uc0NJWW1sUGF0aCA9IGpvaW4oXG4gICAgICAgIGdpdGh1YkFjdGlvbnNQYXRoLFxuICAgICAgICAnd29ya2Zsb3dzJyxcbiAgICAgICAgJ0NJLnltbCcsXG4gICAgICApXG4gICAgICBpZiAoZXhpc3RzU3luYyhnaXRodWJBY3Rpb25zQ0lZbWxQYXRoKSkge1xuICAgICAgICBjb25zdCBnaXRodWJBY3Rpb25zQ29udGVudCA9IGF3YWl0IHJlYWRGaWxlQXN5bmMoXG4gICAgICAgICAgZ2l0aHViQWN0aW9uc0NJWW1sUGF0aCxcbiAgICAgICAgICAndXRmOCcsXG4gICAgICAgIClcbiAgICAgICAgY29uc3QgZ2l0aHViQWN0aW9uc0RhdGEgPSB5YW1sUGFyc2UoZ2l0aHViQWN0aW9uc0NvbnRlbnQpIGFzIGFueVxuICAgICAgICBpZiAoZ2l0aHViQWN0aW9uc0RhdGEuZW52Py5BUFBfTkFNRSkge1xuICAgICAgICAgIGdpdGh1YkFjdGlvbnNEYXRhLmVudi5BUFBfTkFNRSA9IG9wdGlvbnMuYmluYXJ5TmFtZVxuICAgICAgICAgIGF3YWl0IHdyaXRlRmlsZUFzeW5jKFxuICAgICAgICAgICAgZ2l0aHViQWN0aW9uc0NJWW1sUGF0aCxcbiAgICAgICAgICAgIHlhbWxTdHJpbmdpZnkoZ2l0aHViQWN0aW9uc0RhdGEsIHtcbiAgICAgICAgICAgICAgbGluZVdpZHRoOiAtMSxcbiAgICAgICAgICAgICAgbm9SZWZzOiB0cnVlLFxuICAgICAgICAgICAgICBzb3J0S2V5czogZmFsc2UsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3Qgb2xkV2FzaUJyb3dzZXJCaW5kaW5nUGF0aCA9IGpvaW4oXG4gICAgICBvcHRpb25zLmN3ZCxcbiAgICAgIGAke29sZE5hbWV9Lndhc2ktYnJvd3Nlci5qc2AsXG4gICAgKVxuICAgIGlmIChleGlzdHNTeW5jKG9sZFdhc2lCcm93c2VyQmluZGluZ1BhdGgpKSB7XG4gICAgICBhd2FpdCByZW5hbWUoXG4gICAgICAgIG9sZFdhc2lCcm93c2VyQmluZGluZ1BhdGgsXG4gICAgICAgIGpvaW4ob3B0aW9ucy5jd2QsIGAke29wdGlvbnMuYmluYXJ5TmFtZX0ud2FzaS1icm93c2VyLmpzYCksXG4gICAgICApXG4gICAgfVxuICAgIGNvbnN0IG9sZFdhc2lCaW5kaW5nUGF0aCA9IGpvaW4ob3B0aW9ucy5jd2QsIGAke29sZE5hbWV9Lndhc2kuY2pzYClcbiAgICBpZiAoZXhpc3RzU3luYyhvbGRXYXNpQmluZGluZ1BhdGgpKSB7XG4gICAgICBhd2FpdCByZW5hbWUoXG4gICAgICAgIG9sZFdhc2lCaW5kaW5nUGF0aCxcbiAgICAgICAgam9pbihvcHRpb25zLmN3ZCwgYCR7b3B0aW9ucy5iaW5hcnlOYW1lfS53YXNpLmNqc2ApLFxuICAgICAgKVxuICAgIH1cbiAgICBjb25zdCBnaXRBdHRyaWJ1dGVzUGF0aCA9IGpvaW4ob3B0aW9ucy5jd2QsICcuZ2l0YXR0cmlidXRlcycpXG4gICAgaWYgKGV4aXN0c1N5bmMoZ2l0QXR0cmlidXRlc1BhdGgpKSB7XG4gICAgICBjb25zdCBnaXRBdHRyaWJ1dGVzQ29udGVudCA9IGF3YWl0IHJlYWRGaWxlQXN5bmMoXG4gICAgICAgIGdpdEF0dHJpYnV0ZXNQYXRoLFxuICAgICAgICAndXRmOCcsXG4gICAgICApXG4gICAgICBjb25zdCBnaXRBdHRyaWJ1dGVzRGF0YSA9IGdpdEF0dHJpYnV0ZXNDb250ZW50XG4gICAgICAgIC5zcGxpdCgnXFxuJylcbiAgICAgICAgLm1hcCgobGluZSkgPT4ge1xuICAgICAgICAgIHJldHVybiBsaW5lXG4gICAgICAgICAgICAucmVwbGFjZShcbiAgICAgICAgICAgICAgYCR7b2xkTmFtZX0ud2FzaS1icm93c2VyLmpzYCxcbiAgICAgICAgICAgICAgYCR7b3B0aW9ucy5iaW5hcnlOYW1lfS53YXNpLWJyb3dzZXIuanNgLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLnJlcGxhY2UoYCR7b2xkTmFtZX0ud2FzaS5janNgLCBgJHtvcHRpb25zLmJpbmFyeU5hbWV9Lndhc2kuY2pzYClcbiAgICAgICAgfSlcbiAgICAgICAgLmpvaW4oJ1xcbicpXG4gICAgICBhd2FpdCB3cml0ZUZpbGVBc3luYyhnaXRBdHRyaWJ1dGVzUGF0aCwgZ2l0QXR0cmlidXRlc0RhdGEpXG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBleGVjLCBleGVjU3luYyB9IGZyb20gJ25vZGU6Y2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdub2RlOmZzJ1xuaW1wb3J0IHsgaG9tZWRpciB9IGZyb20gJ25vZGU6b3MnXG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgeyBwcm9taXNlcyBhcyBmcyB9IGZyb20gJ25vZGU6ZnMnXG5cbmltcG9ydCB7IHBhcnNlIGFzIHBhcnNlVG9tbCwgc3RyaW5naWZ5IGFzIHN0cmluZ2lmeVRvbWwgfSBmcm9tICdAc3RkL3RvbWwnXG5pbXBvcnQgeyBsb2FkIGFzIHlhbWxMb2FkLCBkdW1wIGFzIHlhbWxEdW1wIH0gZnJvbSAnanMteWFtbCdcblxuaW1wb3J0IHtcbiAgYXBwbHlEZWZhdWx0TmV3T3B0aW9ucyxcbiAgdHlwZSBOZXdPcHRpb25zIGFzIFJhd05ld09wdGlvbnMsXG59IGZyb20gJy4uL2RlZi9uZXcuanMnXG5pbXBvcnQge1xuICBBVkFJTEFCTEVfVEFSR0VUUyxcbiAgZGVidWdGYWN0b3J5LFxuICBERUZBVUxUX1RBUkdFVFMsXG4gIG1rZGlyQXN5bmMsXG4gIHBhcnNlVHJpcGxlLFxuICByZWFkZGlyQXN5bmMsXG4gIHN0YXRBc3luYyxcbiAgdHlwZSBTdXBwb3J0ZWRQYWNrYWdlTWFuYWdlcixcbn0gZnJvbSAnLi4vdXRpbHMvaW5kZXguanMnXG5pbXBvcnQge1xuICBuYXBpRW5naW5lUmVxdWlyZW1lbnQsXG4gIFNVUFBPUlRFRF9OQVBJX1ZFUlNJT05TLFxufSBmcm9tICcuLi91dGlscy92ZXJzaW9uLmpzJ1xuaW1wb3J0IHsgcmVuYW1lUHJvamVjdCB9IGZyb20gJy4vcmVuYW1lLmpzJ1xuXG4vLyBUZW1wbGF0ZSBpbXBvcnRzIHJlbW92ZWQgYXMgd2UncmUgbm93IHVzaW5nIGV4dGVybmFsIHRlbXBsYXRlc1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSgnbmV3JylcblxudHlwZSBOZXdPcHRpb25zID0gUmVxdWlyZWQ8UmF3TmV3T3B0aW9ucz5cblxuY29uc3QgVEVNUExBVEVfUkVQT1MgPSB7XG4gIHlhcm46ICdodHRwczovL2dpdGh1Yi5jb20vbmFwaS1ycy9wYWNrYWdlLXRlbXBsYXRlJyxcbiAgcG5wbTogJ2h0dHBzOi8vZ2l0aHViLmNvbS9uYXBpLXJzL3BhY2thZ2UtdGVtcGxhdGUtcG5wbScsXG59IGFzIGNvbnN0XG5cbmNvbnN0IFdBU0lfVEFSR0VUID0gJ3dhc20zMi13YXNpcDEtdGhyZWFkcydcblxuYXN5bmMgZnVuY3Rpb24gY2hlY2tHaXRDb21tYW5kKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICByZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4oKHJlc29sdmUpID0+IHtcbiAgICBjb25zdCBjcCA9IGV4ZWMoJ2dpdCAtLXZlcnNpb24nKVxuICAgIGNwLm9uKCdlcnJvcicsICgpID0+IHtcbiAgICAgIHJlc29sdmUoZmFsc2UpXG4gICAgfSlcbiAgICBjcC5vbignZXhpdCcsIChjb2RlKSA9PiB7XG4gICAgICByZXNvbHZlKGNvZGUgPT09IDApXG4gICAgfSlcbiAgfSlcbn1cblxuYXN5bmMgZnVuY3Rpb24gZW5zdXJlQ2FjaGVEaXIoXG4gIHBhY2thZ2VNYW5hZ2VyOiBTdXBwb3J0ZWRQYWNrYWdlTWFuYWdlcixcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IGNhY2hlRGlyID0gcGF0aC5qb2luKGhvbWVkaXIoKSwgJy5uYXBpLXJzJywgJ3RlbXBsYXRlJywgcGFja2FnZU1hbmFnZXIpXG4gIGF3YWl0IG1rZGlyQXN5bmMoY2FjaGVEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pXG4gIHJldHVybiBjYWNoZURpclxufVxuXG5hc3luYyBmdW5jdGlvbiBkb3dubG9hZFRlbXBsYXRlKFxuICBwYWNrYWdlTWFuYWdlcjogU3VwcG9ydGVkUGFja2FnZU1hbmFnZXIsXG4gIGNhY2hlRGlyOiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgcmVwb1VybCA9IFRFTVBMQVRFX1JFUE9TW3BhY2thZ2VNYW5hZ2VyXVxuICBjb25zdCB0ZW1wbGF0ZVBhdGggPSBwYXRoLmpvaW4oY2FjaGVEaXIsICdyZXBvJylcblxuICBpZiAoZXhpc3RzU3luYyh0ZW1wbGF0ZVBhdGgpKSB7XG4gICAgZGVidWcoYFRlbXBsYXRlIGNhY2hlIGZvdW5kIGF0ICR7dGVtcGxhdGVQYXRofSwgdXBkYXRpbmcuLi5gKVxuICAgIHRyeSB7XG4gICAgICAvLyBGZXRjaCBsYXRlc3QgY2hhbmdlcyBhbmQgcmVzZXQgdG8gcmVtb3RlXG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IGNwID0gZXhlYygnZ2l0IGZldGNoIG9yaWdpbicsIHsgY3dkOiB0ZW1wbGF0ZVBhdGggfSlcbiAgICAgICAgY3Aub24oJ2Vycm9yJywgcmVqZWN0KVxuICAgICAgICBjcC5vbignZXhpdCcsIChjb2RlKSA9PiB7XG4gICAgICAgICAgaWYgKGNvZGUgPT09IDApIHtcbiAgICAgICAgICAgIHJlc29sdmUoKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QoXG4gICAgICAgICAgICAgIG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgRmFpbGVkIHRvIGZldGNoIGxhdGVzdCBjaGFuZ2VzLCBnaXQgcHJvY2VzcyBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH0pXG4gICAgICBleGVjU3luYygnZ2l0IHJlc2V0IC0taGFyZCBvcmlnaW4vbWFpbicsIHtcbiAgICAgICAgY3dkOiB0ZW1wbGF0ZVBhdGgsXG4gICAgICAgIHN0ZGlvOiAnaWdub3JlJyxcbiAgICAgIH0pXG4gICAgICBkZWJ1ZygnVGVtcGxhdGUgdXBkYXRlZCBzdWNjZXNzZnVsbHknKVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBkZWJ1ZyhgRmFpbGVkIHRvIHVwZGF0ZSB0ZW1wbGF0ZTogJHtlcnJvcn1gKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIHRlbXBsYXRlIGZyb20gJHtyZXBvVXJsfTogJHtlcnJvcn1gKVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBkZWJ1ZyhgQ2xvbmluZyB0ZW1wbGF0ZSBmcm9tICR7cmVwb1VybH0uLi5gKVxuICAgIHRyeSB7XG4gICAgICBleGVjU3luYyhgZ2l0IGNsb25lICR7cmVwb1VybH0gcmVwb2AsIHsgY3dkOiBjYWNoZURpciwgc3RkaW86ICdpbmhlcml0JyB9KVxuICAgICAgZGVidWcoJ1RlbXBsYXRlIGNsb25lZCBzdWNjZXNzZnVsbHknKVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBjbG9uZSB0ZW1wbGF0ZSBmcm9tICR7cmVwb1VybH06ICR7ZXJyb3J9YClcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY29weURpcmVjdG9yeShcbiAgc3JjOiBzdHJpbmcsXG4gIGRlc3Q6IHN0cmluZyxcbiAgaW5jbHVkZVdhc2lCaW5kaW5nczogYm9vbGVhbixcbik6IFByb21pc2U8dm9pZD4ge1xuICBhd2FpdCBta2RpckFzeW5jKGRlc3QsIHsgcmVjdXJzaXZlOiB0cnVlIH0pXG4gIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmcy5yZWFkZGlyKHNyYywgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG5cbiAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgY29uc3Qgc3JjUGF0aCA9IHBhdGguam9pbihzcmMsIGVudHJ5Lm5hbWUpXG4gICAgY29uc3QgZGVzdFBhdGggPSBwYXRoLmpvaW4oZGVzdCwgZW50cnkubmFtZSlcblxuICAgIC8vIFNraXAgLmdpdCBkaXJlY3RvcnlcbiAgICBpZiAoZW50cnkubmFtZSA9PT0gJy5naXQnKSB7XG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICBhd2FpdCBjb3B5RGlyZWN0b3J5KHNyY1BhdGgsIGRlc3RQYXRoLCBpbmNsdWRlV2FzaUJpbmRpbmdzKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoXG4gICAgICAgICFpbmNsdWRlV2FzaUJpbmRpbmdzICYmXG4gICAgICAgIChlbnRyeS5uYW1lLmVuZHNXaXRoKCcud2FzaS1icm93c2VyLmpzJykgfHxcbiAgICAgICAgICBlbnRyeS5uYW1lLmVuZHNXaXRoKCcud2FzaS5janMnKSB8fFxuICAgICAgICAgIGVudHJ5Lm5hbWUuZW5kc1dpdGgoJ3dhc2ktd29ya2VyLWJyb3dzZXIubWpzJykgfHxcbiAgICAgICAgICBlbnRyeS5uYW1lLmVuZHNXaXRoKCd3YXNpLXdvcmtlci5tanMnKSB8fFxuICAgICAgICAgIGVudHJ5Lm5hbWUgPT09ICdicm93c2VyLmpzJylcbiAgICAgICkge1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgYXdhaXQgZnMuY29weUZpbGUoc3JjUGF0aCwgZGVzdFBhdGgpXG4gICAgfVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZpbHRlclRhcmdldHNJblBhY2thZ2VKc29uKFxuICBmaWxlUGF0aDogc3RyaW5nLFxuICBlbmFibGVkVGFyZ2V0czogc3RyaW5nW10sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgY29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGVQYXRoLCAndXRmLTgnKVxuICBjb25zdCBwYWNrYWdlSnNvbiA9IEpTT04ucGFyc2UoY29udGVudClcbiAgY29uc3QgaW5jbHVkZVdhc2lCaW5kaW5ncyA9IGVuYWJsZWRUYXJnZXRzLmluY2x1ZGVzKFdBU0lfVEFSR0VUKVxuXG4gIC8vIEZpbHRlciBuYXBpLnRhcmdldHNcbiAgaWYgKHBhY2thZ2VKc29uLm5hcGk/LnRhcmdldHMpIHtcbiAgICBwYWNrYWdlSnNvbi5uYXBpLnRhcmdldHMgPSBwYWNrYWdlSnNvbi5uYXBpLnRhcmdldHMuZmlsdGVyKFxuICAgICAgKHRhcmdldDogc3RyaW5nKSA9PiBlbmFibGVkVGFyZ2V0cy5pbmNsdWRlcyh0YXJnZXQpLFxuICAgIClcbiAgfVxuXG4gIGlmICghaW5jbHVkZVdhc2lCaW5kaW5ncykge1xuICAgIGlmIChcbiAgICAgIHBhY2thZ2VKc29uLmJyb3dzZXIgPT09ICdicm93c2VyLmpzJyB8fFxuICAgICAgcGFja2FnZUpzb24uYnJvd3NlciA9PT0gJy4vYnJvd3Nlci5qcydcbiAgICApIHtcbiAgICAgIGRlbGV0ZSBwYWNrYWdlSnNvbi5icm93c2VyXG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkocGFja2FnZUpzb24uZmlsZXMpKSB7XG4gICAgICBwYWNrYWdlSnNvbi5maWxlcyA9IHBhY2thZ2VKc29uLmZpbGVzLmZpbHRlcihcbiAgICAgICAgKGZpbGU6IHVua25vd24pID0+IGZpbGUgIT09ICdicm93c2VyLmpzJyAmJiBmaWxlICE9PSAnLi9icm93c2VyLmpzJyxcbiAgICAgIClcbiAgICB9XG4gIH1cblxuICBhd2FpdCBmcy53cml0ZUZpbGUoZmlsZVBhdGgsIEpTT04uc3RyaW5naWZ5KHBhY2thZ2VKc29uLCBudWxsLCAyKSArICdcXG4nKVxufVxuXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVDYXJnb1RvbWxUeXBlRGVmKFxuICBmaWxlUGF0aDogc3RyaW5nLFxuICBlbmFibGVUeXBlRGVmOiBib29sZWFuLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChlbmFibGVUeXBlRGVmKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBjb25zdCBjb250ZW50ID0gYXdhaXQgZnMucmVhZEZpbGUoZmlsZVBhdGgsICd1dGYtOCcpXG4gIGNvbnN0IGNhcmdvVG9tbCA9IHBhcnNlVG9tbChjb250ZW50KSBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+XG4gIGNvbnN0IGRlcGVuZGVuY2llcyA9IGNhcmdvVG9tbC5kZXBlbmRlbmNpZXNcblxuICBpZiAoIWRlcGVuZGVuY2llcyB8fCAhZGVwZW5kZW5jaWVzWyduYXBpLWRlcml2ZSddKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBjb25zdCBuYXBpRGVyaXZlRGVwZW5kZW5jeSA9IGRlcGVuZGVuY2llc1snbmFwaS1kZXJpdmUnXVxuICBjb25zdCBkZXBlbmRlbmN5Q29uZmlnID1cbiAgICB0eXBlb2YgbmFwaURlcml2ZURlcGVuZGVuY3kgPT09ICdzdHJpbmcnXG4gICAgICA/IHsgdmVyc2lvbjogbmFwaURlcml2ZURlcGVuZGVuY3kgfVxuICAgICAgOiB7IC4uLm5hcGlEZXJpdmVEZXBlbmRlbmN5IH1cblxuICBjb25zdCBleGlzdGluZ0ZlYXR1cmVzOiBzdHJpbmdbXSA9IEFycmF5LmlzQXJyYXkoZGVwZW5kZW5jeUNvbmZpZy5mZWF0dXJlcylcbiAgICA/IGRlcGVuZGVuY3lDb25maWcuZmVhdHVyZXMuZmlsdGVyKFxuICAgICAgICAoZmVhdHVyZTogdW5rbm93bik6IGZlYXR1cmUgaXMgc3RyaW5nID0+IHR5cGVvZiBmZWF0dXJlID09PSAnc3RyaW5nJyxcbiAgICAgIClcbiAgICA6IFtdXG5cbiAgZGVwZW5kZW5jeUNvbmZpZ1snZGVmYXVsdC1mZWF0dXJlcyddID0gZmFsc2VcbiAgZGVwZW5kZW5jeUNvbmZpZy5mZWF0dXJlcyA9IFtcbiAgICAnc3RyaWN0JyxcbiAgICAuLi5leGlzdGluZ0ZlYXR1cmVzLmZpbHRlcigoZmVhdHVyZSkgPT4gZmVhdHVyZSAhPT0gJ3N0cmljdCcpLFxuICBdLmZpbHRlcigoZmVhdHVyZSkgPT4gZmVhdHVyZSAhPT0gJ3R5cGUtZGVmJylcblxuICBkZXBlbmRlbmNpZXNbJ25hcGktZGVyaXZlJ10gPSBkZXBlbmRlbmN5Q29uZmlnXG5cbiAgYXdhaXQgZnMud3JpdGVGaWxlKGZpbGVQYXRoLCBzdHJpbmdpZnlUb21sKGNhcmdvVG9tbCkpXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB1cGRhdGVDYXJnb1RvbWxOb2RlQXBpVmVyc2lvbihcbiAgZmlsZVBhdGg6IHN0cmluZyxcbiAgbWluTm9kZUFwaVZlcnNpb246IG51bWJlcixcbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBjb250ZW50ID0gYXdhaXQgZnMucmVhZEZpbGUoZmlsZVBhdGgsICd1dGYtOCcpXG4gIGNvbnN0IGNhcmdvVG9tbCA9IHBhcnNlVG9tbChjb250ZW50KSBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+XG4gIGNvbnN0IGRlcGVuZGVuY2llcyA9IGNhcmdvVG9tbC5kZXBlbmRlbmNpZXNcblxuICBpZiAoIWRlcGVuZGVuY2llcyB8fCAhZGVwZW5kZW5jaWVzLm5hcGkpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIGNvbnN0IG5hcGlEZXBlbmRlbmN5ID0gZGVwZW5kZW5jaWVzLm5hcGlcbiAgY29uc3QgZGVwZW5kZW5jeUNvbmZpZyA9XG4gICAgdHlwZW9mIG5hcGlEZXBlbmRlbmN5ID09PSAnc3RyaW5nJ1xuICAgICAgPyB7IHZlcnNpb246IG5hcGlEZXBlbmRlbmN5IH1cbiAgICAgIDogeyAuLi5uYXBpRGVwZW5kZW5jeSB9XG4gIGNvbnN0IHVzZWREZWZhdWx0RmVhdHVyZXMgPSBkZXBlbmRlbmN5Q29uZmlnWydkZWZhdWx0LWZlYXR1cmVzJ10gIT09IGZhbHNlXG4gIGNvbnN0IGV4aXN0aW5nRmVhdHVyZXM6IHN0cmluZ1tdID0gQXJyYXkuaXNBcnJheShkZXBlbmRlbmN5Q29uZmlnLmZlYXR1cmVzKVxuICAgID8gZGVwZW5kZW5jeUNvbmZpZy5mZWF0dXJlcy5maWx0ZXIoXG4gICAgICAgIChmZWF0dXJlOiB1bmtub3duKTogZmVhdHVyZSBpcyBzdHJpbmcgPT4gdHlwZW9mIGZlYXR1cmUgPT09ICdzdHJpbmcnLFxuICAgICAgKVxuICAgIDogW11cblxuICBkZXBlbmRlbmN5Q29uZmlnLmZlYXR1cmVzID0gW1xuICAgIGBuYXBpJHttaW5Ob2RlQXBpVmVyc2lvbn1gLFxuICAgIC4uLmV4aXN0aW5nRmVhdHVyZXMuZmlsdGVyKChmZWF0dXJlKSA9PiAhL15uYXBpXFxkKyQvLnRlc3QoZmVhdHVyZSkpLFxuICBdXG5cbiAgLy8gbmFwaSdzIGRlZmF1bHQgZmVhdHVyZXMgaW5jbHVkZSBuYXBpNC4gRGlzYWJsZSB0aGVtIGZvciBsb3dlciByZXF1ZXN0ZWRcbiAgLy8gbGV2ZWxzLCB3aGlsZSByZXRhaW5pbmcgdGhlIGRlZmF1bHQgZHluYW1pYyBOb2RlLUFQSSBzeW1ib2wgbG9hZGluZyBtb2RlLlxuICBpZiAobWluTm9kZUFwaVZlcnNpb24gPCA0KSB7XG4gICAgZGVwZW5kZW5jeUNvbmZpZ1snZGVmYXVsdC1mZWF0dXJlcyddID0gZmFsc2VcbiAgICBpZiAoXG4gICAgICB1c2VkRGVmYXVsdEZlYXR1cmVzICYmXG4gICAgICAhZGVwZW5kZW5jeUNvbmZpZy5mZWF0dXJlcy5pbmNsdWRlcygnZHluLXN5bWJvbHMnKVxuICAgICkge1xuICAgICAgZGVwZW5kZW5jeUNvbmZpZy5mZWF0dXJlcy5wdXNoKCdkeW4tc3ltYm9scycpXG4gICAgfVxuICB9XG5cbiAgZGVwZW5kZW5jaWVzLm5hcGkgPSBkZXBlbmRlbmN5Q29uZmlnXG5cbiAgYXdhaXQgZnMud3JpdGVGaWxlKGZpbGVQYXRoLCBzdHJpbmdpZnlUb21sKGNhcmdvVG9tbCkpXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZpbHRlclRhcmdldHNJbkdpdGh1YkFjdGlvbnMoXG4gIGZpbGVQYXRoOiBzdHJpbmcsXG4gIGVuYWJsZWRUYXJnZXRzOiBzdHJpbmdbXSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBjb250ZW50ID0gYXdhaXQgZnMucmVhZEZpbGUoZmlsZVBhdGgsICd1dGYtOCcpXG4gIGNvbnN0IHlhbWwgPSB5YW1sTG9hZChjb250ZW50KSBhcyBhbnlcblxuICBjb25zdCBsaW51eFRhcmdldHMgPSBuZXcgU2V0KFtcbiAgICAneDg2XzY0LXVua25vd24tbGludXgtZ251JyxcbiAgICAneDg2XzY0LXVua25vd24tbGludXgtbXVzbCcsXG4gICAgJ2FhcmNoNjQtdW5rbm93bi1saW51eC1nbnUnLFxuICAgICdhYXJjaDY0LXVua25vd24tbGludXgtbXVzbCcsXG4gICAgJ2FybXY3LXVua25vd24tbGludXgtZ251ZWFiaWhmJyxcbiAgICAnYXJtdjctdW5rbm93bi1saW51eC1tdXNsZWFiaWhmJyxcbiAgICAnbG9vbmdhcmNoNjQtdW5rbm93bi1saW51eC1nbnUnLFxuICAgICdyaXNjdjY0Z2MtdW5rbm93bi1saW51eC1nbnUnLFxuICAgICdwb3dlcnBjNjRsZS11bmtub3duLWxpbnV4LWdudScsXG4gICAgJ3MzOTB4LXVua25vd24tbGludXgtZ251JyxcbiAgICAnYWFyY2g2NC1saW51eC1hbmRyb2lkJyxcbiAgICAnYXJtdjctbGludXgtYW5kcm9pZGVhYmknLFxuICBdKVxuXG4gIC8vIENoZWNrIGlmIGFueSBMaW51eCB0YXJnZXRzIGFyZSBlbmFibGVkXG4gIGNvbnN0IGhhc0xpbnV4VGFyZ2V0cyA9IGVuYWJsZWRUYXJnZXRzLnNvbWUoKHRhcmdldCkgPT5cbiAgICBsaW51eFRhcmdldHMuaGFzKHRhcmdldCksXG4gIClcbiAgY29uc3QgaGFzTWFjT1NPcldpbmRvd3NUYXJnZXRzID0gZW5hYmxlZFRhcmdldHMuc29tZSgodGFyZ2V0KSA9PiB7XG4gICAgY29uc3QgcGxhdGZvcm0gPSBwYXJzZVRyaXBsZSh0YXJnZXQpLnBsYXRmb3JtXG4gICAgcmV0dXJuIHBsYXRmb3JtID09PSAnZGFyd2luJyB8fCBwbGF0Zm9ybSA9PT0gJ3dpbjMyJ1xuICB9KVxuXG4gIC8vIEZpbHRlciB0aGUgbWF0cml4IGNvbmZpZ3VyYXRpb25zIGluIHRoZSBidWlsZCBqb2JcbiAgaWYgKHlhbWw/LmpvYnM/LmJ1aWxkPy5zdHJhdGVneT8ubWF0cml4Py5zZXR0aW5ncykge1xuICAgIHlhbWwuam9icy5idWlsZC5zdHJhdGVneS5tYXRyaXguc2V0dGluZ3MgPVxuICAgICAgeWFtbC5qb2JzLmJ1aWxkLnN0cmF0ZWd5Lm1hdHJpeC5zZXR0aW5ncy5maWx0ZXIoKHNldHRpbmc6IGFueSkgPT4ge1xuICAgICAgICBpZiAoc2V0dGluZy50YXJnZXQpIHtcbiAgICAgICAgICByZXR1cm4gZW5hYmxlZFRhcmdldHMuaW5jbHVkZXMoc2V0dGluZy50YXJnZXQpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH0pXG4gIH1cblxuICBjb25zdCBqb2JzVG9SZW1vdmU6IHN0cmluZ1tdID0gW11cblxuICBpZiAoIWhhc01hY09TT3JXaW5kb3dzVGFyZ2V0cykge1xuICAgIGpvYnNUb1JlbW92ZS5wdXNoKCd0ZXN0LW1hY09TLXdpbmRvd3MtYmluZGluZycpXG4gIH0gZWxzZSB7XG4gICAgLy8gRmlsdGVyIHRoZSBtYXRyaXggY29uZmlndXJhdGlvbnMgaW4gdGhlIHRlc3QtbWFjT1Mtd2luZG93cy1iaW5kaW5nIGpvYlxuICAgIGlmIChcbiAgICAgIHlhbWw/LmpvYnM/LlsndGVzdC1tYWNPUy13aW5kb3dzLWJpbmRpbmcnXT8uc3RyYXRlZ3k/Lm1hdHJpeD8uc2V0dGluZ3NcbiAgICApIHtcbiAgICAgIHlhbWwuam9ic1sndGVzdC1tYWNPUy13aW5kb3dzLWJpbmRpbmcnXS5zdHJhdGVneS5tYXRyaXguc2V0dGluZ3MgPVxuICAgICAgICB5YW1sLmpvYnNbJ3Rlc3QtbWFjT1Mtd2luZG93cy1iaW5kaW5nJ10uc3RyYXRlZ3kubWF0cml4LnNldHRpbmdzLmZpbHRlcihcbiAgICAgICAgICAoc2V0dGluZzogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoc2V0dGluZy50YXJnZXQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGVuYWJsZWRUYXJnZXRzLmluY2x1ZGVzKHNldHRpbmcudGFyZ2V0KVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgICB9LFxuICAgICAgICApXG4gICAgfVxuICB9XG5cbiAgLy8gSWYgbm8gTGludXggdGFyZ2V0cyBhcmUgZW5hYmxlZCwgcmVtb3ZlIExpbnV4LXNwZWNpZmljIGpvYnNcbiAgaWYgKCFoYXNMaW51eFRhcmdldHMpIHtcbiAgICAvLyBSZW1vdmUgdGVzdC1saW51eC1iaW5kaW5nIGpvYlxuICAgIGlmICh5YW1sPy5qb2JzPy5bJ3Rlc3QtbGludXgtYmluZGluZyddKSB7XG4gICAgICBqb2JzVG9SZW1vdmUucHVzaCgndGVzdC1saW51eC1iaW5kaW5nJylcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gRmlsdGVyIHRoZSBtYXRyaXggY29uZmlndXJhdGlvbnMgaW4gdGhlIHRlc3QtbGludXgteDY0LWdudS1iaW5kaW5nIGpvYlxuICAgIGlmICh5YW1sPy5qb2JzPy5bJ3Rlc3QtbGludXgtYmluZGluZyddPy5zdHJhdGVneT8ubWF0cml4Py50YXJnZXQpIHtcbiAgICAgIHlhbWwuam9ic1sndGVzdC1saW51eC1iaW5kaW5nJ10uc3RyYXRlZ3kubWF0cml4LnRhcmdldCA9IHlhbWwuam9ic1tcbiAgICAgICAgJ3Rlc3QtbGludXgtYmluZGluZydcbiAgICAgIF0uc3RyYXRlZ3kubWF0cml4LnRhcmdldC5maWx0ZXIoKHRhcmdldDogc3RyaW5nKSA9PiB7XG4gICAgICAgIGlmICh0YXJnZXQpIHtcbiAgICAgICAgICByZXR1cm4gZW5hYmxlZFRhcmdldHMuaW5jbHVkZXModGFyZ2V0KVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIGlmICghZW5hYmxlZFRhcmdldHMuaW5jbHVkZXMoV0FTSV9UQVJHRVQpKSB7XG4gICAgam9ic1RvUmVtb3ZlLnB1c2goJ3Rlc3Qtd2FzaScpXG4gIH1cblxuICBpZiAoIWVuYWJsZWRUYXJnZXRzLmluY2x1ZGVzKCd4ODZfNjQtdW5rbm93bi1mcmVlYnNkJykpIHtcbiAgICBqb2JzVG9SZW1vdmUucHVzaCgnYnVpbGQtZnJlZWJzZCcpXG4gIH1cblxuICAvLyBGaWx0ZXIgb3RoZXIgdGVzdCBqb2JzIGJhc2VkIG9uIHRhcmdldFxuICBmb3IgKGNvbnN0IFtqb2JOYW1lLCBqb2JDb25maWddIG9mIE9iamVjdC5lbnRyaWVzKHlhbWwuam9icyB8fCB7fSkpIHtcbiAgICBpZiAoXG4gICAgICBqb2JOYW1lLnN0YXJ0c1dpdGgoJ3Rlc3QtJykgJiZcbiAgICAgIGpvYk5hbWUgIT09ICd0ZXN0LW1hY09TLXdpbmRvd3MtYmluZGluZycgJiZcbiAgICAgIGpvYk5hbWUgIT09ICd0ZXN0LWxpbnV4LXg2NC1nbnUtYmluZGluZydcbiAgICApIHtcbiAgICAgIC8vIEV4dHJhY3QgdGFyZ2V0IGZyb20gam9iIG5hbWUgb3IgY29uZmlnXG4gICAgICBjb25zdCBqb2IgPSBqb2JDb25maWcgYXMgYW55XG4gICAgICBpZiAoam9iLnN0cmF0ZWd5Py5tYXRyaXg/LnNldHRpbmdzPy5bMF0/LnRhcmdldCkge1xuICAgICAgICBjb25zdCB0YXJnZXQgPSBqb2Iuc3RyYXRlZ3kubWF0cml4LnNldHRpbmdzWzBdLnRhcmdldFxuICAgICAgICBpZiAoIWVuYWJsZWRUYXJnZXRzLmluY2x1ZGVzKHRhcmdldCkpIHtcbiAgICAgICAgICBqb2JzVG9SZW1vdmUucHVzaChqb2JOYW1lKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gUmVtb3ZlIGpvYnMgZm9yIGRpc2FibGVkIHRhcmdldHNcbiAgZm9yIChjb25zdCBqb2JOYW1lIG9mIGpvYnNUb1JlbW92ZSkge1xuICAgIGRlbGV0ZSB5YW1sLmpvYnNbam9iTmFtZV1cbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KHlhbWwuam9icz8ucHVibGlzaD8ubmVlZHMpKSB7XG4gICAgeWFtbC5qb2JzLnB1Ymxpc2gubmVlZHMgPSB5YW1sLmpvYnMucHVibGlzaC5uZWVkcy5maWx0ZXIoXG4gICAgICAobmVlZDogc3RyaW5nKSA9PiAham9ic1RvUmVtb3ZlLmluY2x1ZGVzKG5lZWQpLFxuICAgIClcbiAgfVxuXG4gIC8vIFdyaXRlIGJhY2sgdGhlIGZpbHRlcmVkIFlBTUxcbiAgY29uc3QgdXBkYXRlZFlhbWwgPSB5YW1sRHVtcCh5YW1sLCB7XG4gICAgbGluZVdpZHRoOiAtMSxcbiAgICBub1JlZnM6IHRydWUsXG4gICAgc29ydEtleXM6IGZhbHNlLFxuICB9KVxuICBhd2FpdCBmcy53cml0ZUZpbGUoZmlsZVBhdGgsIHVwZGF0ZWRZYW1sKVxufVxuXG5mdW5jdGlvbiBwcm9jZXNzT3B0aW9ucyhvcHRpb25zOiBSYXdOZXdPcHRpb25zKSB7XG4gIGRlYnVnKCdQcm9jZXNzaW5nIG9wdGlvbnMuLi4nKVxuICBjb25zdCBtaW5Ob2RlQXBpVmVyc2lvbiA9IG9wdGlvbnMubWluTm9kZUFwaVZlcnNpb24gPz8gNFxuICBpZiAoXG4gICAgIU51bWJlci5pc0ludGVnZXIobWluTm9kZUFwaVZlcnNpb24pIHx8XG4gICAgIVNVUFBPUlRFRF9OQVBJX1ZFUlNJT05TLnNvbWUoKHZlcnNpb24pID0+IHZlcnNpb24gPT09IG1pbk5vZGVBcGlWZXJzaW9uKVxuICApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcbiAgICAgIGBVbnN1cHBvcnRlZCBOb2RlLUFQSSB2ZXJzaW9uICR7bWluTm9kZUFwaVZlcnNpb259LiBFeHBlY3RlZCBvbmUgb2Y6ICR7U1VQUE9SVEVEX05BUElfVkVSU0lPTlMuam9pbignLCAnKX1gLFxuICAgIClcbiAgfVxuICBvcHRpb25zLm1pbk5vZGVBcGlWZXJzaW9uID0gbWluTm9kZUFwaVZlcnNpb25cblxuICBpZiAoIW9wdGlvbnMucGF0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHByb3ZpZGUgdGhlIHBhdGggYXMgdGhlIGFyZ3VtZW50JylcbiAgfVxuICBvcHRpb25zLnBhdGggPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgb3B0aW9ucy5wYXRoKVxuICBkZWJ1ZyhgUmVzb2x2ZWQgdGFyZ2V0IHBhdGggdG86ICR7b3B0aW9ucy5wYXRofWApXG5cbiAgaWYgKCFvcHRpb25zLm5hbWUpIHtcbiAgICBvcHRpb25zLm5hbWUgPSBwYXRoLnBhcnNlKG9wdGlvbnMucGF0aCkuYmFzZVxuICAgIGRlYnVnKGBObyBwcm9qZWN0IG5hbWUgcHJvdmlkZWQsIGZpeCBpdCB0byBkaXIgbmFtZTogJHtvcHRpb25zLm5hbWV9YClcbiAgfVxuXG4gIGlmICghb3B0aW9ucy50YXJnZXRzPy5sZW5ndGgpIHtcbiAgICBpZiAob3B0aW9ucy5lbmFibGVBbGxUYXJnZXRzKSB7XG4gICAgICBvcHRpb25zLnRhcmdldHMgPSBBVkFJTEFCTEVfVEFSR0VUUy5jb25jYXQoKVxuICAgICAgZGVidWcoJ0VuYWJsZSBhbGwgdGFyZ2V0cycpXG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmVuYWJsZURlZmF1bHRUYXJnZXRzKSB7XG4gICAgICBvcHRpb25zLnRhcmdldHMgPSBERUZBVUxUX1RBUkdFVFMuY29uY2F0KClcbiAgICAgIGRlYnVnKCdFbmFibGUgZGVmYXVsdCB0YXJnZXRzJylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBdCBsZWFzdCBvbmUgdGFyZ2V0IG11c3QgYmUgZW5hYmxlZCcpXG4gICAgfVxuICB9XG4gIGlmIChcbiAgICBvcHRpb25zLnRhcmdldHMuc29tZSgodGFyZ2V0KSA9PiB0YXJnZXQgPT09ICd3YXNtMzItd2FzaS1wcmV2aWV3MS10aHJlYWRzJylcbiAgKSB7XG4gICAgY29uc3Qgb3V0ID0gZXhlY1N5bmMoYHJ1c3R1cCB0YXJnZXQgbGlzdGAsIHtcbiAgICAgIGVuY29kaW5nOiAndXRmOCcsXG4gICAgfSlcbiAgICBpZiAob3V0LmluY2x1ZGVzKFdBU0lfVEFSR0VUKSkge1xuICAgICAgb3B0aW9ucy50YXJnZXRzID0gb3B0aW9ucy50YXJnZXRzLm1hcCgodGFyZ2V0KSA9PlxuICAgICAgICB0YXJnZXQgPT09ICd3YXNtMzItd2FzaS1wcmV2aWV3MS10aHJlYWRzJyA/IFdBU0lfVEFSR0VUIDogdGFyZ2V0LFxuICAgICAgKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBhcHBseURlZmF1bHROZXdPcHRpb25zKG9wdGlvbnMpIGFzIE5ld09wdGlvbnNcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG5ld1Byb2plY3QodXNlck9wdGlvbnM6IFJhd05ld09wdGlvbnMpIHtcbiAgZGVidWcoJ1dpbGwgY3JlYXRlIG5hcGktcnMgcHJvamVjdCB3aXRoIGdpdmVuIG9wdGlvbnM6JylcbiAgZGVidWcodXNlck9wdGlvbnMpXG5cbiAgY29uc3Qgb3B0aW9ucyA9IHByb2Nlc3NPcHRpb25zKHVzZXJPcHRpb25zKVxuXG4gIGRlYnVnKCdUYXJnZXRzIHRvIGJlIGVuYWJsZWQ6JylcbiAgZGVidWcob3B0aW9ucy50YXJnZXRzKVxuXG4gIC8vIENoZWNrIGlmIGdpdCBpcyBhdmFpbGFibGVcbiAgaWYgKCEoYXdhaXQgY2hlY2tHaXRDb21tYW5kKCkpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0dpdCBpcyBub3QgaW5zdGFsbGVkIG9yIG5vdCBhdmFpbGFibGUgaW4gUEFUSC4gUGxlYXNlIGluc3RhbGwgR2l0IHRvIGNvbnRpbnVlLicsXG4gICAgKVxuICB9XG5cbiAgY29uc3QgcGFja2FnZU1hbmFnZXIgPSBvcHRpb25zLnBhY2thZ2VNYW5hZ2VyIGFzIFN1cHBvcnRlZFBhY2thZ2VNYW5hZ2VyXG5cbiAgLy8gRW5zdXJlIHRhcmdldCBkaXJlY3RvcnkgZXhpc3RzIGFuZCBpcyBlbXB0eVxuICBhd2FpdCBlbnN1cmVQYXRoKG9wdGlvbnMucGF0aCwgb3B0aW9ucy5kcnlSdW4pXG5cbiAgaWYgKCFvcHRpb25zLmRyeVJ1bikge1xuICAgIHRyeSB7XG4gICAgICAvLyBEb3dubG9hZCBvciB1cGRhdGUgdGVtcGxhdGVcbiAgICAgIGNvbnN0IGNhY2hlRGlyID0gYXdhaXQgZW5zdXJlQ2FjaGVEaXIocGFja2FnZU1hbmFnZXIpXG4gICAgICBhd2FpdCBkb3dubG9hZFRlbXBsYXRlKHBhY2thZ2VNYW5hZ2VyLCBjYWNoZURpcilcblxuICAgICAgLy8gQ29weSB0ZW1wbGF0ZSBmaWxlcyB0byB0YXJnZXQgZGlyZWN0b3J5XG4gICAgICBjb25zdCB0ZW1wbGF0ZVBhdGggPSBwYXRoLmpvaW4oY2FjaGVEaXIsICdyZXBvJylcbiAgICAgIGF3YWl0IGNvcHlEaXJlY3RvcnkoXG4gICAgICAgIHRlbXBsYXRlUGF0aCxcbiAgICAgICAgb3B0aW9ucy5wYXRoLFxuICAgICAgICBvcHRpb25zLnRhcmdldHMuaW5jbHVkZXMoV0FTSV9UQVJHRVQpLFxuICAgICAgKVxuXG4gICAgICAvLyBSZW5hbWUgcHJvamVjdCB1c2luZyB0aGUgcmVuYW1lIEFQSVxuICAgICAgYXdhaXQgcmVuYW1lUHJvamVjdCh7XG4gICAgICAgIGN3ZDogb3B0aW9ucy5wYXRoLFxuICAgICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICAgIGJpbmFyeU5hbWU6IGdldEJpbmFyeU5hbWUob3B0aW9ucy5uYW1lKSxcbiAgICAgIH0pXG5cbiAgICAgIGNvbnN0IGNhcmdvVG9tbFBhdGggPSBwYXRoLmpvaW4ob3B0aW9ucy5wYXRoLCAnQ2FyZ28udG9tbCcpXG4gICAgICBpZiAoZXhpc3RzU3luYyhjYXJnb1RvbWxQYXRoKSkge1xuICAgICAgICBhd2FpdCB1cGRhdGVDYXJnb1RvbWxUeXBlRGVmKGNhcmdvVG9tbFBhdGgsIG9wdGlvbnMuZW5hYmxlVHlwZURlZilcbiAgICAgICAgYXdhaXQgdXBkYXRlQ2FyZ29Ub21sTm9kZUFwaVZlcnNpb24oXG4gICAgICAgICAgY2FyZ29Ub21sUGF0aCxcbiAgICAgICAgICBvcHRpb25zLm1pbk5vZGVBcGlWZXJzaW9uLFxuICAgICAgICApXG4gICAgICB9XG5cbiAgICAgIC8vIEZpbHRlciB0YXJnZXRzIGluIHBhY2thZ2UuanNvblxuICAgICAgY29uc3QgcGFja2FnZUpzb25QYXRoID0gcGF0aC5qb2luKG9wdGlvbnMucGF0aCwgJ3BhY2thZ2UuanNvbicpXG4gICAgICBpZiAoZXhpc3RzU3luYyhwYWNrYWdlSnNvblBhdGgpKSB7XG4gICAgICAgIGF3YWl0IGZpbHRlclRhcmdldHNJblBhY2thZ2VKc29uKHBhY2thZ2VKc29uUGF0aCwgb3B0aW9ucy50YXJnZXRzKVxuICAgICAgfVxuXG4gICAgICAvLyBGaWx0ZXIgdGFyZ2V0cyBpbiBHaXRIdWIgQWN0aW9ucyBDSVxuICAgICAgY29uc3QgY2lQYXRoID0gcGF0aC5qb2luKG9wdGlvbnMucGF0aCwgJy5naXRodWInLCAnd29ya2Zsb3dzJywgJ0NJLnltbCcpXG4gICAgICBpZiAoZXhpc3RzU3luYyhjaVBhdGgpICYmIG9wdGlvbnMuZW5hYmxlR2l0aHViQWN0aW9ucykge1xuICAgICAgICBhd2FpdCBmaWx0ZXJUYXJnZXRzSW5HaXRodWJBY3Rpb25zKGNpUGF0aCwgb3B0aW9ucy50YXJnZXRzKVxuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgIW9wdGlvbnMuZW5hYmxlR2l0aHViQWN0aW9ucyAmJlxuICAgICAgICBleGlzdHNTeW5jKHBhdGguam9pbihvcHRpb25zLnBhdGgsICcuZ2l0aHViJykpXG4gICAgICApIHtcbiAgICAgICAgLy8gUmVtb3ZlIC5naXRodWIgZGlyZWN0b3J5IGlmIEdpdEh1YiBBY3Rpb25zIGlzIG5vdCBlbmFibGVkXG4gICAgICAgIGF3YWl0IGZzLnJtKHBhdGguam9pbihvcHRpb25zLnBhdGgsICcuZ2l0aHViJyksIHtcbiAgICAgICAgICByZWN1cnNpdmU6IHRydWUsXG4gICAgICAgICAgZm9yY2U6IHRydWUsXG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSBwYWNrYWdlLmpzb24gd2l0aCBhZGRpdGlvbmFsIGNvbmZpZ3VyYXRpb25zXG4gICAgICBjb25zdCBwa2dKc29uQ29udGVudCA9IGF3YWl0IGZzLnJlYWRGaWxlKHBhY2thZ2VKc29uUGF0aCwgJ3V0Zi04JylcbiAgICAgIGNvbnN0IHBrZ0pzb24gPSBKU09OLnBhcnNlKHBrZ0pzb25Db250ZW50KVxuXG4gICAgICAvLyBVcGRhdGUgZW5naW5lIHJlcXVpcmVtZW50XG4gICAgICBpZiAoIXBrZ0pzb24uZW5naW5lcykge1xuICAgICAgICBwa2dKc29uLmVuZ2luZXMgPSB7fVxuICAgICAgfVxuICAgICAgcGtnSnNvbi5lbmdpbmVzLm5vZGUgPSBuYXBpRW5naW5lUmVxdWlyZW1lbnQob3B0aW9ucy5taW5Ob2RlQXBpVmVyc2lvbilcblxuICAgICAgLy8gVXBkYXRlIGxpY2Vuc2UgaWYgZGlmZmVyZW50IGZyb20gdGVtcGxhdGVcbiAgICAgIGlmIChvcHRpb25zLmxpY2Vuc2UgJiYgcGtnSnNvbi5saWNlbnNlICE9PSBvcHRpb25zLmxpY2Vuc2UpIHtcbiAgICAgICAgcGtnSnNvbi5saWNlbnNlID0gb3B0aW9ucy5saWNlbnNlXG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSB0ZXN0IGZyYW1ld29yayBpZiBuZWVkZWRcbiAgICAgIGlmIChvcHRpb25zLnRlc3RGcmFtZXdvcmsgIT09ICdhdmEnKSB7XG4gICAgICAgIC8vIFRoaXMgd291bGQgcmVxdWlyZSBtb3JlIGNvbXBsZXggbG9naWMgdG8gdXBkYXRlIHRlc3Qgc2NyaXB0cyBhbmQgZGVwZW5kZW5jaWVzXG4gICAgICAgIGRlYnVnKFxuICAgICAgICAgIGBUZXN0IGZyYW1ld29yayAke29wdGlvbnMudGVzdEZyYW1ld29ya30gcmVxdWVzdGVkIGJ1dCBub3QgeWV0IGltcGxlbWVudGVkYCxcbiAgICAgICAgKVxuICAgICAgfVxuXG4gICAgICBhd2FpdCBmcy53cml0ZUZpbGUoXG4gICAgICAgIHBhY2thZ2VKc29uUGF0aCxcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkocGtnSnNvbiwgbnVsbCwgMikgKyAnXFxuJyxcbiAgICAgIClcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gY3JlYXRlIHByb2plY3Q6ICR7ZXJyb3J9YClcbiAgICB9XG4gIH1cblxuICBkZWJ1ZyhgUHJvamVjdCBjcmVhdGVkIGF0OiAke29wdGlvbnMucGF0aH1gKVxufVxuXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVQYXRoKHBhdGg6IHN0cmluZywgZHJ5UnVuID0gZmFsc2UpIHtcbiAgY29uc3Qgc3RhdCA9IGF3YWl0IHN0YXRBc3luYyhwYXRoLCB7fSkuY2F0Y2goKCkgPT4gdW5kZWZpbmVkKVxuXG4gIC8vIGZpbGUgZGVzY3JpcHRvciBleGlzdHNcbiAgaWYgKHN0YXQpIHtcbiAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgUGF0aCAke3BhdGh9IGZvciBjcmVhdGluZyBuZXcgbmFwaS1ycyBwcm9qZWN0IGFscmVhZHkgZXhpc3RzIGFuZCBpdCdzIG5vdCBhIGRpcmVjdG9yeS5gLFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoc3RhdC5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICBjb25zdCBmaWxlcyA9IGF3YWl0IHJlYWRkaXJBc3luYyhwYXRoKVxuICAgICAgaWYgKGZpbGVzLmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYFBhdGggJHtwYXRofSBmb3IgY3JlYXRpbmcgbmV3IG5hcGktcnMgcHJvamVjdCBhbHJlYWR5IGV4aXN0cyBhbmQgaXQncyBub3QgZW1wdHkuYCxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmICghZHJ5UnVuKSB7XG4gICAgdHJ5IHtcbiAgICAgIGRlYnVnKGBUcnkgdG8gY3JlYXRlIHRhcmdldCBkaXJlY3Rvcnk6ICR7cGF0aH1gKVxuICAgICAgaWYgKCFkcnlSdW4pIHtcbiAgICAgICAgYXdhaXQgbWtkaXJBc3luYyhwYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSB0YXJnZXQgZGlyZWN0b3J5OiAke3BhdGh9YCwge1xuICAgICAgICBjYXVzZTogZSxcbiAgICAgIH0pXG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldEJpbmFyeU5hbWUobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIG5hbWUuc3BsaXQoJy8nKS5wb3AoKSFcbn1cblxuZXhwb3J0IHR5cGUgeyBOZXdPcHRpb25zIH1cbiIsIi8vIFRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgYnkgY29kZWdlbi9pbmRleC50c1xuLy8gRG8gbm90IGVkaXQgdGhpcyBmaWxlIG1hbnVhbGx5XG5pbXBvcnQgeyBDb21tYW5kLCBPcHRpb24gfSBmcm9tICdjbGlwYW5pb24nXG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlUHJlUHVibGlzaENvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcbiAgc3RhdGljIHBhdGhzID0gW1sncHJlLXB1Ymxpc2gnXSwgWydwcmVwdWJsaXNoJ11dXG5cbiAgc3RhdGljIHVzYWdlID0gQ29tbWFuZC5Vc2FnZSh7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnVXBkYXRlIHBhY2thZ2UuanNvbiBhbmQgY29weSBhZGRvbnMgaW50byBwZXIgcGxhdGZvcm0gcGFja2FnZXMnLFxuICB9KVxuXG4gIGN3ZCA9IE9wdGlvbi5TdHJpbmcoJy0tY3dkJywgcHJvY2Vzcy5jd2QoKSwge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1RoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aCcsXG4gIH0pXG5cbiAgY29uZmlnUGF0aD86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tY29uZmlnLXBhdGgsLWMnLCB7XG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlJyxcbiAgfSlcblxuICBwYWNrYWdlSnNvblBhdGggPSBPcHRpb24uU3RyaW5nKCctLXBhY2thZ2UtanNvbi1wYXRoJywgJ3BhY2thZ2UuanNvbicsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gYHBhY2thZ2UuanNvbmAnLFxuICB9KVxuXG4gIG5wbURpciA9IE9wdGlvbi5TdHJpbmcoJy0tbnBtLWRpciwtcCcsICducG0nLCB7XG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgdGhlIG5wbSBwYWNrYWdlcyBwdXQnLFxuICB9KVxuXG4gIHRhZ1N0eWxlID0gT3B0aW9uLlN0cmluZygnLS10YWctc3R5bGUsLS10YWdzdHlsZSwtdCcsICdsZXJuYScsIHtcbiAgICBkZXNjcmlwdGlvbjogJ2dpdCB0YWcgc3R5bGUsIGBucG1gIG9yIGBsZXJuYWAnLFxuICB9KVxuXG4gIGdoUmVsZWFzZSA9IE9wdGlvbi5Cb29sZWFuKCctLWdoLXJlbGVhc2UnLCB0cnVlLCB7XG4gICAgZGVzY3JpcHRpb246ICdXaGV0aGVyIGNyZWF0ZSBHaXRIdWIgcmVsZWFzZScsXG4gIH0pXG5cbiAgZ2hSZWxlYXNlTmFtZT86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tZ2gtcmVsZWFzZS1uYW1lJywge1xuICAgIGRlc2NyaXB0aW9uOiAnR2l0SHViIHJlbGVhc2UgbmFtZScsXG4gIH0pXG5cbiAgZ2hSZWxlYXNlSWQ/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWdoLXJlbGVhc2UtaWQnLCB7XG4gICAgZGVzY3JpcHRpb246ICdFeGlzdGluZyBHaXRIdWIgcmVsZWFzZSBpZCcsXG4gIH0pXG5cbiAgc2tpcE9wdGlvbmFsUHVibGlzaCA9IE9wdGlvbi5Cb29sZWFuKCctLXNraXAtb3B0aW9uYWwtcHVibGlzaCcsIGZhbHNlLCB7XG4gICAgZGVzY3JpcHRpb246ICdXaGV0aGVyIHNraXAgb3B0aW9uYWxEZXBlbmRlbmNpZXMgcGFja2FnZXMgcHVibGlzaCcsXG4gIH0pXG5cbiAgZHJ5UnVuID0gT3B0aW9uLkJvb2xlYW4oJy0tZHJ5LXJ1bicsIGZhbHNlLCB7XG4gICAgZGVzY3JpcHRpb246ICdEcnkgcnVuIHdpdGhvdXQgdG91Y2hpbmcgZmlsZSBzeXN0ZW0nLFxuICB9KVxuXG4gIGdldE9wdGlvbnMoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGN3ZDogdGhpcy5jd2QsXG4gICAgICBjb25maWdQYXRoOiB0aGlzLmNvbmZpZ1BhdGgsXG4gICAgICBwYWNrYWdlSnNvblBhdGg6IHRoaXMucGFja2FnZUpzb25QYXRoLFxuICAgICAgbnBtRGlyOiB0aGlzLm5wbURpcixcbiAgICAgIHRhZ1N0eWxlOiB0aGlzLnRhZ1N0eWxlLFxuICAgICAgZ2hSZWxlYXNlOiB0aGlzLmdoUmVsZWFzZSxcbiAgICAgIGdoUmVsZWFzZU5hbWU6IHRoaXMuZ2hSZWxlYXNlTmFtZSxcbiAgICAgIGdoUmVsZWFzZUlkOiB0aGlzLmdoUmVsZWFzZUlkLFxuICAgICAgc2tpcE9wdGlvbmFsUHVibGlzaDogdGhpcy5za2lwT3B0aW9uYWxQdWJsaXNoLFxuICAgICAgZHJ5UnVuOiB0aGlzLmRyeVJ1bixcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBVcGRhdGUgcGFja2FnZS5qc29uIGFuZCBjb3B5IGFkZG9ucyBpbnRvIHBlciBwbGF0Zm9ybSBwYWNrYWdlc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFByZVB1Ymxpc2hPcHRpb25zIHtcbiAgLyoqXG4gICAqIFRoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aFxuICAgKlxuICAgKiBAZGVmYXVsdCBwcm9jZXNzLmN3ZCgpXG4gICAqL1xuICBjd2Q/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGVcbiAgICovXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gYHBhY2thZ2UuanNvbmBcbiAgICpcbiAgICogQGRlZmF1bHQgJ3BhY2thZ2UuanNvbidcbiAgICovXG4gIHBhY2thZ2VKc29uUGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0XG4gICAqXG4gICAqIEBkZWZhdWx0ICducG0nXG4gICAqL1xuICBucG1EaXI/OiBzdHJpbmdcbiAgLyoqXG4gICAqIGdpdCB0YWcgc3R5bGUsIGBucG1gIG9yIGBsZXJuYWBcbiAgICpcbiAgICogQGRlZmF1bHQgJ2xlcm5hJ1xuICAgKi9cbiAgdGFnU3R5bGU/OiAnbnBtJyB8ICdsZXJuYSdcbiAgLyoqXG4gICAqIFdoZXRoZXIgY3JlYXRlIEdpdEh1YiByZWxlYXNlXG4gICAqXG4gICAqIEBkZWZhdWx0IHRydWVcbiAgICovXG4gIGdoUmVsZWFzZT86IGJvb2xlYW5cbiAgLyoqXG4gICAqIEdpdEh1YiByZWxlYXNlIG5hbWVcbiAgICovXG4gIGdoUmVsZWFzZU5hbWU/OiBzdHJpbmdcbiAgLyoqXG4gICAqIEV4aXN0aW5nIEdpdEh1YiByZWxlYXNlIGlkXG4gICAqL1xuICBnaFJlbGVhc2VJZD86IHN0cmluZ1xuICAvKipcbiAgICogV2hldGhlciBza2lwIG9wdGlvbmFsRGVwZW5kZW5jaWVzIHBhY2thZ2VzIHB1Ymxpc2hcbiAgICpcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIHNraXBPcHRpb25hbFB1Ymxpc2g/OiBib29sZWFuXG4gIC8qKlxuICAgKiBEcnkgcnVuIHdpdGhvdXQgdG91Y2hpbmcgZmlsZSBzeXN0ZW1cbiAgICpcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIGRyeVJ1bj86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5RGVmYXVsdFByZVB1Ymxpc2hPcHRpb25zKG9wdGlvbnM6IFByZVB1Ymxpc2hPcHRpb25zKSB7XG4gIHJldHVybiB7XG4gICAgY3dkOiBwcm9jZXNzLmN3ZCgpLFxuICAgIHBhY2thZ2VKc29uUGF0aDogJ3BhY2thZ2UuanNvbicsXG4gICAgbnBtRGlyOiAnbnBtJyxcbiAgICB0YWdTdHlsZTogJ2xlcm5hJyxcbiAgICBnaFJlbGVhc2U6IHRydWUsXG4gICAgc2tpcE9wdGlvbmFsUHVibGlzaDogZmFsc2UsXG4gICAgZHJ5UnVuOiBmYWxzZSxcbiAgICAuLi5vcHRpb25zLFxuICB9XG59XG4iLCIvLyBUaGlzIGZpbGUgaXMgZ2VuZXJhdGVkIGJ5IGNvZGVnZW4vaW5kZXgudHNcbi8vIERvIG5vdCBlZGl0IHRoaXMgZmlsZSBtYW51YWxseVxuaW1wb3J0IHsgQ29tbWFuZCwgT3B0aW9uIH0gZnJvbSAnY2xpcGFuaW9uJ1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZVZlcnNpb25Db21tYW5kIGV4dGVuZHMgQ29tbWFuZCB7XG4gIHN0YXRpYyBwYXRocyA9IFtbJ3ZlcnNpb24nXV1cblxuICBzdGF0aWMgdXNhZ2UgPSBDb21tYW5kLlVzYWdlKHtcbiAgICBkZXNjcmlwdGlvbjogJ1VwZGF0ZSB2ZXJzaW9uIGluIGNyZWF0ZWQgbnBtIHBhY2thZ2VzJyxcbiAgfSlcblxuICBjd2QgPSBPcHRpb24uU3RyaW5nKCctLWN3ZCcsIHByb2Nlc3MuY3dkKCksIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGgnLFxuICB9KVxuXG4gIGNvbmZpZ1BhdGg/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWNvbmZpZy1wYXRoLC1jJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZScsXG4gIH0pXG5cbiAgcGFja2FnZUpzb25QYXRoID0gT3B0aW9uLlN0cmluZygnLS1wYWNrYWdlLWpzb24tcGF0aCcsICdwYWNrYWdlLmpzb24nLCB7XG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGBwYWNrYWdlLmpzb25gJyxcbiAgfSlcblxuICBucG1EaXIgPSBPcHRpb24uU3RyaW5nKCctLW5wbS1kaXInLCAnbnBtJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byB0aGUgZm9sZGVyIHdoZXJlIHRoZSBucG0gcGFja2FnZXMgcHV0JyxcbiAgfSlcblxuICBnZXRPcHRpb25zKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjd2Q6IHRoaXMuY3dkLFxuICAgICAgY29uZmlnUGF0aDogdGhpcy5jb25maWdQYXRoLFxuICAgICAgcGFja2FnZUpzb25QYXRoOiB0aGlzLnBhY2thZ2VKc29uUGF0aCxcbiAgICAgIG5wbURpcjogdGhpcy5ucG1EaXIsXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogVXBkYXRlIHZlcnNpb24gaW4gY3JlYXRlZCBucG0gcGFja2FnZXNcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBWZXJzaW9uT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGUgd29ya2luZyBkaXJlY3Rvcnkgb2Ygd2hlcmUgbmFwaSBjb21tYW5kIHdpbGwgYmUgZXhlY3V0ZWQgaW4sIGFsbCBvdGhlciBwYXRocyBvcHRpb25zIGFyZSByZWxhdGl2ZSB0byB0aGlzIHBhdGhcbiAgICpcbiAgICogQGRlZmF1bHQgcHJvY2Vzcy5jd2QoKVxuICAgKi9cbiAgY3dkPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAqL1xuICBjb25maWdQYXRoPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIGBwYWNrYWdlLmpzb25gXG4gICAqXG4gICAqIEBkZWZhdWx0ICdwYWNrYWdlLmpzb24nXG4gICAqL1xuICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFBhdGggdG8gdGhlIGZvbGRlciB3aGVyZSB0aGUgbnBtIHBhY2thZ2VzIHB1dFxuICAgKlxuICAgKiBAZGVmYXVsdCAnbnBtJ1xuICAgKi9cbiAgbnBtRGlyPzogc3RyaW5nXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseURlZmF1bHRWZXJzaW9uT3B0aW9ucyhvcHRpb25zOiBWZXJzaW9uT3B0aW9ucykge1xuICByZXR1cm4ge1xuICAgIGN3ZDogcHJvY2Vzcy5jd2QoKSxcbiAgICBwYWNrYWdlSnNvblBhdGg6ICdwYWNrYWdlLmpzb24nLFxuICAgIG5wbURpcjogJ25wbScsXG4gICAgLi4ub3B0aW9ucyxcbiAgfVxufVxuIiwiaW1wb3J0IHsgam9pbiwgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCdcblxuaW1wb3J0IHtcbiAgYXBwbHlEZWZhdWx0VmVyc2lvbk9wdGlvbnMsXG4gIHR5cGUgVmVyc2lvbk9wdGlvbnMsXG59IGZyb20gJy4uL2RlZi92ZXJzaW9uLmpzJ1xuaW1wb3J0IHtcbiAgcmVhZE5hcGlDb25maWcsXG4gIGRlYnVnRmFjdG9yeSxcbiAgdXBkYXRlUGFja2FnZUpzb24sXG59IGZyb20gJy4uL3V0aWxzL2luZGV4LmpzJ1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSgndmVyc2lvbicpXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2ZXJzaW9uKHVzZXJPcHRpb25zOiBWZXJzaW9uT3B0aW9ucykge1xuICBjb25zdCBvcHRpb25zID0gYXBwbHlEZWZhdWx0VmVyc2lvbk9wdGlvbnModXNlck9wdGlvbnMpXG4gIGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IHJlc29sdmUob3B0aW9ucy5jd2QsIG9wdGlvbnMucGFja2FnZUpzb25QYXRoKVxuXG4gIGNvbnN0IGNvbmZpZyA9IGF3YWl0IHJlYWROYXBpQ29uZmlnKFxuICAgIHBhY2thZ2VKc29uUGF0aCxcbiAgICBvcHRpb25zLmNvbmZpZ1BhdGggPyByZXNvbHZlKG9wdGlvbnMuY3dkLCBvcHRpb25zLmNvbmZpZ1BhdGgpIDogdW5kZWZpbmVkLFxuICApXG5cbiAgZm9yIChjb25zdCB0YXJnZXQgb2YgY29uZmlnLnRhcmdldHMpIHtcbiAgICBjb25zdCBwa2dEaXIgPSByZXNvbHZlKG9wdGlvbnMuY3dkLCBvcHRpb25zLm5wbURpciwgdGFyZ2V0LnBsYXRmb3JtQXJjaEFCSSlcblxuICAgIGRlYnVnKGBVcGRhdGUgdmVyc2lvbiB0byAlaSBpbiBbJWldYCwgY29uZmlnLnBhY2thZ2VKc29uLnZlcnNpb24sIHBrZ0RpcilcbiAgICBhd2FpdCB1cGRhdGVQYWNrYWdlSnNvbihqb2luKHBrZ0RpciwgJ3BhY2thZ2UuanNvbicpLCB7XG4gICAgICB2ZXJzaW9uOiBjb25maWcucGFja2FnZUpzb24udmVyc2lvbixcbiAgICB9KVxuICB9XG59XG4iLCJpbXBvcnQgeyBleGVjU3luYyB9IGZyb20gJ25vZGU6Y2hpbGRfcHJvY2VzcydcbmltcG9ydCB7IGV4aXN0c1N5bmMsIHN0YXRTeW5jIH0gZnJvbSAnbm9kZTpmcydcbmltcG9ydCB7IGpvaW4sIHJlc29sdmUgfSBmcm9tICdub2RlOnBhdGgnXG5cbmltcG9ydCB7IE9jdG9raXQgfSBmcm9tICdAb2N0b2tpdC9yZXN0J1xuXG5pbXBvcnQge1xuICBhcHBseURlZmF1bHRQcmVQdWJsaXNoT3B0aW9ucyxcbiAgdHlwZSBQcmVQdWJsaXNoT3B0aW9ucyxcbn0gZnJvbSAnLi4vZGVmL3ByZS1wdWJsaXNoLmpzJ1xuaW1wb3J0IHtcbiAgcmVhZEZpbGVBc3luYyxcbiAgcmVhZE5hcGlDb25maWcsXG4gIGRlYnVnRmFjdG9yeSxcbiAgdXBkYXRlUGFja2FnZUpzb24sXG59IGZyb20gJy4uL3V0aWxzL2luZGV4LmpzJ1xuXG5pbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSAnLi92ZXJzaW9uLmpzJ1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSgncHJlLXB1Ymxpc2gnKVxuXG5pbnRlcmZhY2UgUGFja2FnZUluZm8ge1xuICBuYW1lOiBzdHJpbmdcbiAgdmVyc2lvbjogc3RyaW5nXG4gIHRhZzogc3RyaW5nXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcmVQdWJsaXNoKHVzZXJPcHRpb25zOiBQcmVQdWJsaXNoT3B0aW9ucykge1xuICBkZWJ1ZygnUmVjZWl2ZSBwcmUtcHVibGlzaCBvcHRpb25zOicpXG4gIGRlYnVnKCcgICVPJywgdXNlck9wdGlvbnMpXG5cbiAgY29uc3Qgb3B0aW9ucyA9IGFwcGx5RGVmYXVsdFByZVB1Ymxpc2hPcHRpb25zKHVzZXJPcHRpb25zKVxuXG4gIGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IHJlc29sdmUob3B0aW9ucy5jd2QsIG9wdGlvbnMucGFja2FnZUpzb25QYXRoKVxuXG4gIGNvbnN0IHsgcGFja2FnZUpzb24sIHRhcmdldHMsIHBhY2thZ2VOYW1lLCBiaW5hcnlOYW1lLCBucG1DbGllbnQgfSA9XG4gICAgYXdhaXQgcmVhZE5hcGlDb25maWcoXG4gICAgICBwYWNrYWdlSnNvblBhdGgsXG4gICAgICBvcHRpb25zLmNvbmZpZ1BhdGggPyByZXNvbHZlKG9wdGlvbnMuY3dkLCBvcHRpb25zLmNvbmZpZ1BhdGgpIDogdW5kZWZpbmVkLFxuICAgIClcblxuICBhc3luYyBmdW5jdGlvbiBjcmVhdGVHaFJlbGVhc2UocGFja2FnZU5hbWU6IHN0cmluZywgdmVyc2lvbjogc3RyaW5nKSB7XG4gICAgaWYgKCFvcHRpb25zLmdoUmVsZWFzZSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3duZXI6IG51bGwsXG4gICAgICAgIHJlcG86IG51bGwsXG4gICAgICAgIHBrZ0luZm86IHsgbmFtZTogbnVsbCwgdmVyc2lvbjogbnVsbCwgdGFnOiBudWxsIH0sXG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHsgcmVwbywgb3duZXIsIHBrZ0luZm8sIG9jdG9raXQgfSA9IGdldFJlcG9JbmZvKHBhY2thZ2VOYW1lLCB2ZXJzaW9uKVxuXG4gICAgaWYgKCFyZXBvIHx8ICFvd25lcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3duZXI6IG51bGwsXG4gICAgICAgIHJlcG86IG51bGwsXG4gICAgICAgIHBrZ0luZm86IHsgbmFtZTogbnVsbCwgdmVyc2lvbjogbnVsbCwgdGFnOiBudWxsIH0sXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFvcHRpb25zLmRyeVJ1bikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgb2N0b2tpdC5yZXBvcy5jcmVhdGVSZWxlYXNlKHtcbiAgICAgICAgICBvd25lcixcbiAgICAgICAgICByZXBvLFxuICAgICAgICAgIHRhZ19uYW1lOiBwa2dJbmZvLnRhZyxcbiAgICAgICAgICBuYW1lOiBvcHRpb25zLmdoUmVsZWFzZU5hbWUsXG4gICAgICAgICAgcHJlcmVsZWFzZTpcbiAgICAgICAgICAgIHZlcnNpb24uaW5jbHVkZXMoJ2FscGhhJykgfHxcbiAgICAgICAgICAgIHZlcnNpb24uaW5jbHVkZXMoJ2JldGEnKSB8fFxuICAgICAgICAgICAgdmVyc2lvbi5pbmNsdWRlcygncmMnKSxcbiAgICAgICAgfSlcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZGVidWcoXG4gICAgICAgICAgYFBhcmFtczogJHtKU09OLnN0cmluZ2lmeShcbiAgICAgICAgICAgIHsgb3duZXIsIHJlcG8sIHRhZ19uYW1lOiBwa2dJbmZvLnRhZyB9LFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIDIsXG4gICAgICAgICAgKX1gLFxuICAgICAgICApXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSlcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgb3duZXIsIHJlcG8sIHBrZ0luZm8sIG9jdG9raXQgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0UmVwb0luZm8ocGFja2FnZU5hbWU6IHN0cmluZywgdmVyc2lvbjogc3RyaW5nKSB7XG4gICAgY29uc3QgaGVhZENvbW1pdCA9IGV4ZWNTeW5jKCdnaXQgbG9nIC0xIC0tcHJldHR5PSVCJywge1xuICAgICAgY3dkOiBvcHRpb25zLmN3ZCxcbiAgICAgIGVuY29kaW5nOiAndXRmLTgnLFxuICAgIH0pLnRyaW0oKVxuXG4gICAgY29uc3QgeyBHSVRIVUJfUkVQT1NJVE9SWSB9ID0gcHJvY2Vzcy5lbnZcbiAgICBpZiAoIUdJVEhVQl9SRVBPU0lUT1JZKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvd25lcjogbnVsbCxcbiAgICAgICAgcmVwbzogbnVsbCxcbiAgICAgICAgcGtnSW5mbzogeyBuYW1lOiBudWxsLCB2ZXJzaW9uOiBudWxsLCB0YWc6IG51bGwgfSxcbiAgICAgIH1cbiAgICB9XG4gICAgZGVidWcoYEdpdGh1YiByZXBvc2l0b3J5OiAke0dJVEhVQl9SRVBPU0lUT1JZfWApXG4gICAgY29uc3QgW293bmVyLCByZXBvXSA9IEdJVEhVQl9SRVBPU0lUT1JZLnNwbGl0KCcvJylcbiAgICBjb25zdCBvY3Rva2l0ID0gbmV3IE9jdG9raXQoe1xuICAgICAgYXV0aDogcHJvY2Vzcy5lbnYuR0lUSFVCX1RPS0VOLFxuICAgIH0pXG4gICAgbGV0IHBrZ0luZm86IFBhY2thZ2VJbmZvIHwgdW5kZWZpbmVkXG4gICAgaWYgKG9wdGlvbnMudGFnU3R5bGUgPT09ICdsZXJuYScpIHtcbiAgICAgIGNvbnN0IHBhY2thZ2VzVG9QdWJsaXNoID0gaGVhZENvbW1pdFxuICAgICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAgIC5tYXAoKGxpbmUpID0+IGxpbmUudHJpbSgpKVxuICAgICAgICAuZmlsdGVyKChsaW5lLCBpbmRleCkgPT4gbGluZS5sZW5ndGggJiYgaW5kZXgpXG4gICAgICAgIC5tYXAoKGxpbmUpID0+IGxpbmUuc3Vic3RyaW5nKDIpKVxuICAgICAgICAubWFwKHBhcnNlVGFnKVxuXG4gICAgICBwa2dJbmZvID0gcGFja2FnZXNUb1B1Ymxpc2guZmluZChcbiAgICAgICAgKHBrZ0luZm8pID0+IHBrZ0luZm8ubmFtZSA9PT0gcGFja2FnZU5hbWUsXG4gICAgICApXG5cbiAgICAgIGlmICghcGtnSW5mbykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGBObyByZWxlYXNlIGNvbW1pdCBmb3VuZCB3aXRoICR7cGFja2FnZU5hbWV9LCBvcmlnaW5hbCBjb21taXQgaW5mbzogJHtoZWFkQ29tbWl0fWAsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcGtnSW5mbyA9IHtcbiAgICAgICAgdGFnOiBgdiR7dmVyc2lvbn1gLFxuICAgICAgICB2ZXJzaW9uLFxuICAgICAgICBuYW1lOiBwYWNrYWdlTmFtZSxcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgb3duZXIsIHJlcG8sIHBrZ0luZm8sIG9jdG9raXQgfVxuICB9XG5cbiAgaWYgKCFvcHRpb25zLmRyeVJ1bikge1xuICAgIGF3YWl0IHZlcnNpb24odXNlck9wdGlvbnMpXG4gICAgYXdhaXQgdXBkYXRlUGFja2FnZUpzb24ocGFja2FnZUpzb25QYXRoLCB7XG4gICAgICBvcHRpb25hbERlcGVuZGVuY2llczogdGFyZ2V0cy5yZWR1Y2UoXG4gICAgICAgIChkZXBzLCB0YXJnZXQpID0+IHtcbiAgICAgICAgICBkZXBzW2Ake3BhY2thZ2VOYW1lfS0ke3RhcmdldC5wbGF0Zm9ybUFyY2hBQkl9YF0gPSBwYWNrYWdlSnNvbi52ZXJzaW9uXG5cbiAgICAgICAgICByZXR1cm4gZGVwc1xuICAgICAgICB9LFxuICAgICAgICB7fSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LFxuICAgICAgKSxcbiAgICB9KVxuICB9XG5cbiAgY29uc3QgeyBvd25lciwgcmVwbywgcGtnSW5mbywgb2N0b2tpdCB9ID0gb3B0aW9ucy5naFJlbGVhc2VJZFxuICAgID8gZ2V0UmVwb0luZm8ocGFja2FnZU5hbWUsIHBhY2thZ2VKc29uLnZlcnNpb24pXG4gICAgOiBhd2FpdCBjcmVhdGVHaFJlbGVhc2UocGFja2FnZU5hbWUsIHBhY2thZ2VKc29uLnZlcnNpb24pXG5cbiAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgIGNvbnN0IHBrZ0RpciA9IHJlc29sdmUoXG4gICAgICBvcHRpb25zLmN3ZCxcbiAgICAgIG9wdGlvbnMubnBtRGlyLFxuICAgICAgYCR7dGFyZ2V0LnBsYXRmb3JtQXJjaEFCSX1gLFxuICAgIClcbiAgICBjb25zdCBleHQgPVxuICAgICAgdGFyZ2V0LnBsYXRmb3JtID09PSAnd2FzaScgfHwgdGFyZ2V0LnBsYXRmb3JtID09PSAnd2FzbScgPyAnd2FzbScgOiAnbm9kZSdcbiAgICBjb25zdCBmaWxlbmFtZSA9IGAke2JpbmFyeU5hbWV9LiR7dGFyZ2V0LnBsYXRmb3JtQXJjaEFCSX0uJHtleHR9YFxuICAgIGNvbnN0IGRzdFBhdGggPSBqb2luKHBrZ0RpciwgZmlsZW5hbWUpXG5cbiAgICBpZiAoIW9wdGlvbnMuZHJ5UnVuKSB7XG4gICAgICBpZiAoIWV4aXN0c1N5bmMoZHN0UGF0aCkpIHtcbiAgICAgICAgZGVidWcud2FybihgJXMgZG9lc24ndCBleGlzdGAsIGRzdFBhdGgpXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmICghb3B0aW9ucy5za2lwT3B0aW9uYWxQdWJsaXNoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3Qgb3V0cHV0ID0gZXhlY1N5bmMoYCR7bnBtQ2xpZW50fSBwdWJsaXNoYCwge1xuICAgICAgICAgICAgY3dkOiBwa2dEaXIsXG4gICAgICAgICAgICBlbnY6IHByb2Nlc3MuZW52LFxuICAgICAgICAgICAgc3RkaW86ICdwaXBlJyxcbiAgICAgICAgICB9KVxuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKG91dHB1dClcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGUgaW5zdGFuY2VvZiBFcnJvciAmJlxuICAgICAgICAgICAgZS5tZXNzYWdlLmluY2x1ZGVzKFxuICAgICAgICAgICAgICAnWW91IGNhbm5vdCBwdWJsaXNoIG92ZXIgdGhlIHByZXZpb3VzbHkgcHVibGlzaGVkIHZlcnNpb25zJyxcbiAgICAgICAgICAgIClcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhlLm1lc3NhZ2UpXG4gICAgICAgICAgICBkZWJ1Zy53YXJuKGAke3BrZ0Rpcn0gaGFzIGJlZW4gcHVibGlzaGVkLCBza2lwcGluZ2ApXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IGVcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMuZ2hSZWxlYXNlICYmIHJlcG8gJiYgb3duZXIpIHtcbiAgICAgICAgZGVidWcuaW5mbyhgQ3JlYXRpbmcgR2l0SHViIHJlbGVhc2UgJHtwa2dJbmZvLnRhZ31gKVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHJlbGVhc2VJZCA9IG9wdGlvbnMuZ2hSZWxlYXNlSWRcbiAgICAgICAgICAgID8gTnVtYmVyKG9wdGlvbnMuZ2hSZWxlYXNlSWQpXG4gICAgICAgICAgICA6IChcbiAgICAgICAgICAgICAgICBhd2FpdCBvY3Rva2l0IS5yZXBvcy5nZXRSZWxlYXNlQnlUYWcoe1xuICAgICAgICAgICAgICAgICAgcmVwbzogcmVwbyxcbiAgICAgICAgICAgICAgICAgIG93bmVyOiBvd25lcixcbiAgICAgICAgICAgICAgICAgIHRhZzogcGtnSW5mby50YWcsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgKS5kYXRhLmlkXG4gICAgICAgICAgY29uc3QgZHN0RmlsZVN0YXRzID0gc3RhdFN5bmMoZHN0UGF0aClcbiAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBvY3Rva2l0IS5yZXBvcy51cGxvYWRSZWxlYXNlQXNzZXQoe1xuICAgICAgICAgICAgb3duZXI6IG93bmVyLFxuICAgICAgICAgICAgcmVwbzogcmVwbyxcbiAgICAgICAgICAgIG5hbWU6IGZpbGVuYW1lLFxuICAgICAgICAgICAgcmVsZWFzZV9pZDogcmVsZWFzZUlkLFxuICAgICAgICAgICAgbWVkaWFUeXBlOiB7IGZvcm1hdDogJ3JhdycgfSxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgJ2NvbnRlbnQtbGVuZ3RoJzogZHN0RmlsZVN0YXRzLnNpemUsXG4gICAgICAgICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIG9jdG9raXQgdHlwZXMgYXJlIHdyb25nXG4gICAgICAgICAgICBkYXRhOiBhd2FpdCByZWFkRmlsZUFzeW5jKGRzdFBhdGgpLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgZGVidWcuaW5mbyhgR2l0SHViIHJlbGVhc2UgY3JlYXRlZGApXG4gICAgICAgICAgZGVidWcuaW5mbyhgRG93bmxvYWQgVVJMOiAlc2AsIGFzc2V0SW5mby5kYXRhLmJyb3dzZXJfZG93bmxvYWRfdXJsKVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgZGVidWcuZXJyb3IoXG4gICAgICAgICAgICBgUGFyYW06ICR7SlNPTi5zdHJpbmdpZnkoXG4gICAgICAgICAgICAgIHsgb3duZXIsIHJlcG8sIHRhZzogcGtnSW5mby50YWcsIGZpbGVuYW1lOiBkc3RQYXRoIH0sXG4gICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAgIDIsXG4gICAgICAgICAgICApfWAsXG4gICAgICAgICAgKVxuICAgICAgICAgIGRlYnVnLmVycm9yKGUpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VUYWcodGFnOiBzdHJpbmcpIHtcbiAgY29uc3Qgc2VnbWVudHMgPSB0YWcuc3BsaXQoJ0AnKVxuICBjb25zdCB2ZXJzaW9uID0gc2VnbWVudHMucG9wKCkhXG4gIGNvbnN0IG5hbWUgPSBzZWdtZW50cy5qb2luKCdAJylcblxuICByZXR1cm4ge1xuICAgIG5hbWUsXG4gICAgdmVyc2lvbixcbiAgICB0YWcsXG4gIH1cbn1cbiIsIi8vIFRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgYnkgY29kZWdlbi9pbmRleC50c1xuLy8gRG8gbm90IGVkaXQgdGhpcyBmaWxlIG1hbnVhbGx5XG5pbXBvcnQgeyBDb21tYW5kLCBPcHRpb24gfSBmcm9tICdjbGlwYW5pb24nXG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlVW5pdmVyc2FsaXplQ29tbWFuZCBleHRlbmRzIENvbW1hbmQge1xuICBzdGF0aWMgcGF0aHMgPSBbWyd1bml2ZXJzYWxpemUnXV1cblxuICBzdGF0aWMgdXNhZ2UgPSBDb21tYW5kLlVzYWdlKHtcbiAgICBkZXNjcmlwdGlvbjogJ0NvbWJpbGUgYnVpbHQgYmluYXJpZXMgaW50byBvbmUgdW5pdmVyc2FsIGJpbmFyeScsXG4gIH0pXG5cbiAgY3dkID0gT3B0aW9uLlN0cmluZygnLS1jd2QnLCBwcm9jZXNzLmN3ZCgpLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoJyxcbiAgfSlcblxuICBjb25maWdQYXRoPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1jb25maWctcGF0aCwtYycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gYG5hcGlgIGNvbmZpZyBqc29uIGZpbGUnLFxuICB9KVxuXG4gIHBhY2thZ2VKc29uUGF0aCA9IE9wdGlvbi5TdHJpbmcoJy0tcGFja2FnZS1qc29uLXBhdGgnLCAncGFja2FnZS5qc29uJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgcGFja2FnZS5qc29uYCcsXG4gIH0pXG5cbiAgb3V0cHV0RGlyID0gT3B0aW9uLlN0cmluZygnLS1vdXRwdXQtZGlyLC1vJywgJy4vJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1BhdGggdG8gdGhlIGZvbGRlciB3aGVyZSBhbGwgYnVpbHQgYC5ub2RlYCBmaWxlcyBwdXQsIHNhbWUgYXMgYC0tb3V0cHV0LWRpcmAgb2YgYnVpbGQgY29tbWFuZCcsXG4gIH0pXG5cbiAgZ2V0T3B0aW9ucygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY3dkOiB0aGlzLmN3ZCxcbiAgICAgIGNvbmZpZ1BhdGg6IHRoaXMuY29uZmlnUGF0aCxcbiAgICAgIHBhY2thZ2VKc29uUGF0aDogdGhpcy5wYWNrYWdlSnNvblBhdGgsXG4gICAgICBvdXRwdXREaXI6IHRoaXMub3V0cHV0RGlyLFxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENvbWJpbGUgYnVpbHQgYmluYXJpZXMgaW50byBvbmUgdW5pdmVyc2FsIGJpbmFyeVxuICovXG5leHBvcnQgaW50ZXJmYWNlIFVuaXZlcnNhbGl6ZU9wdGlvbnMge1xuICAvKipcbiAgICogVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoXG4gICAqXG4gICAqIEBkZWZhdWx0IHByb2Nlc3MuY3dkKClcbiAgICovXG4gIGN3ZD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgbmFwaWAgY29uZmlnIGpzb24gZmlsZVxuICAgKi9cbiAgY29uZmlnUGF0aD86IHN0cmluZ1xuICAvKipcbiAgICogUGF0aCB0byBgcGFja2FnZS5qc29uYFxuICAgKlxuICAgKiBAZGVmYXVsdCAncGFja2FnZS5qc29uJ1xuICAgKi9cbiAgcGFja2FnZUpzb25QYXRoPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIHRoZSBmb2xkZXIgd2hlcmUgYWxsIGJ1aWx0IGAubm9kZWAgZmlsZXMgcHV0LCBzYW1lIGFzIGAtLW91dHB1dC1kaXJgIG9mIGJ1aWxkIGNvbW1hbmRcbiAgICpcbiAgICogQGRlZmF1bHQgJy4vJ1xuICAgKi9cbiAgb3V0cHV0RGlyPzogc3RyaW5nXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseURlZmF1bHRVbml2ZXJzYWxpemVPcHRpb25zKG9wdGlvbnM6IFVuaXZlcnNhbGl6ZU9wdGlvbnMpIHtcbiAgcmV0dXJuIHtcbiAgICBjd2Q6IHByb2Nlc3MuY3dkKCksXG4gICAgcGFja2FnZUpzb25QYXRoOiAncGFja2FnZS5qc29uJyxcbiAgICBvdXRwdXREaXI6ICcuLycsXG4gICAgLi4ub3B0aW9ucyxcbiAgfVxufVxuIiwiaW1wb3J0IHsgc3Bhd25TeW5jIH0gZnJvbSAnbm9kZTpjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ25vZGU6cGF0aCdcblxuaW1wb3J0IHtcbiAgYXBwbHlEZWZhdWx0VW5pdmVyc2FsaXplT3B0aW9ucyxcbiAgdHlwZSBVbml2ZXJzYWxpemVPcHRpb25zLFxufSBmcm9tICcuLi9kZWYvdW5pdmVyc2FsaXplLmpzJ1xuaW1wb3J0IHsgcmVhZE5hcGlDb25maWcgfSBmcm9tICcuLi91dGlscy9jb25maWcuanMnXG5pbXBvcnQgeyBkZWJ1Z0ZhY3RvcnkgfSBmcm9tICcuLi91dGlscy9sb2cuanMnXG5pbXBvcnQgeyBmaWxlRXhpc3RzIH0gZnJvbSAnLi4vdXRpbHMvbWlzYy5qcydcbmltcG9ydCB7IFVuaUFyY2hzQnlQbGF0Zm9ybSB9IGZyb20gJy4uL3V0aWxzL3RhcmdldC5qcydcblxuY29uc3QgZGVidWcgPSBkZWJ1Z0ZhY3RvcnkoJ3VuaXZlcnNhbGl6ZScpXG5cbmZ1bmN0aW9uIGNyZWF0ZURhcndpblVuaXZlcnNhbEJpbmFyeShpbnB1dHM6IHN0cmluZ1tdLCBvdXRwdXQ6IHN0cmluZykge1xuICBjb25zdCByZXN1bHQgPSBzcGF3blN5bmMoJ2xpcG8nLCBbJy1jcmVhdGUnLCAnLW91dHB1dCcsIG91dHB1dCwgLi4uaW5wdXRzXSwge1xuICAgIHN0ZGlvOiAnaW5oZXJpdCcsXG4gIH0pXG5cbiAgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgIHRocm93IHJlc3VsdC5lcnJvclxuICB9XG5cbiAgaWYgKHJlc3VsdC5zaWduYWwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgRmFpbGVkIHRvIGNyZWF0ZSB1bml2ZXJzYWwgYmluYXJ5ICcke291dHB1dH0nOiBsaXBvIHRlcm1pbmF0ZWQgd2l0aCBzaWduYWwgJHtyZXN1bHQuc2lnbmFsfS5gLFxuICAgIClcbiAgfVxuXG4gIGlmIChyZXN1bHQuc3RhdHVzICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEZhaWxlZCB0byBjcmVhdGUgdW5pdmVyc2FsIGJpbmFyeSAnJHtvdXRwdXR9JzogbGlwbyBleGl0ZWQgd2l0aCBzdGF0dXMgJHtyZXN1bHQuc3RhdHVzfS5gLFxuICAgIClcbiAgfVxufVxuXG5jb25zdCB1bml2ZXJzYWxpemVyczogUGFydGlhbDxcbiAgUmVjb3JkPE5vZGVKUy5QbGF0Zm9ybSwgKGlucHV0czogc3RyaW5nW10sIG91dHB1dDogc3RyaW5nKSA9PiB2b2lkPlxuPiA9IHtcbiAgZGFyd2luOiBjcmVhdGVEYXJ3aW5Vbml2ZXJzYWxCaW5hcnksXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB1bml2ZXJzYWxpemVCaW5hcmllcyh1c2VyT3B0aW9uczogVW5pdmVyc2FsaXplT3B0aW9ucykge1xuICBjb25zdCBvcHRpb25zID0gYXBwbHlEZWZhdWx0VW5pdmVyc2FsaXplT3B0aW9ucyh1c2VyT3B0aW9ucylcblxuICBjb25zdCBwYWNrYWdlSnNvblBhdGggPSByZXNvbHZlKG9wdGlvbnMuY3dkLCBvcHRpb25zLnBhY2thZ2VKc29uUGF0aClcblxuICBjb25zdCBjb25maWcgPSBhd2FpdCByZWFkTmFwaUNvbmZpZyhcbiAgICBwYWNrYWdlSnNvblBhdGgsXG4gICAgb3B0aW9ucy5jb25maWdQYXRoID8gcmVzb2x2ZShvcHRpb25zLmN3ZCwgb3B0aW9ucy5jb25maWdQYXRoKSA6IHVuZGVmaW5lZCxcbiAgKVxuXG4gIGNvbnN0IHRhcmdldCA9IGNvbmZpZy50YXJnZXRzLmZpbmQoXG4gICAgKHQpID0+IHQucGxhdGZvcm0gPT09IHByb2Nlc3MucGxhdGZvcm0gJiYgdC5hcmNoID09PSAndW5pdmVyc2FsJyxcbiAgKVxuXG4gIGlmICghdGFyZ2V0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYCd1bml2ZXJzYWwnIGFyY2ggZm9yIHBsYXRmb3JtICcke3Byb2Nlc3MucGxhdGZvcm19JyBub3QgZm91bmQgaW4gY29uZmlnIWAsXG4gICAgKVxuICB9XG5cbiAgY29uc3Qgc3JjRmlsZXMgPSBVbmlBcmNoc0J5UGxhdGZvcm1bcHJvY2Vzcy5wbGF0Zm9ybV0/Lm1hcCgoYXJjaCkgPT5cbiAgICByZXNvbHZlKFxuICAgICAgb3B0aW9ucy5jd2QsXG4gICAgICBvcHRpb25zLm91dHB1dERpcixcbiAgICAgIGAke2NvbmZpZy5iaW5hcnlOYW1lfS4ke3Byb2Nlc3MucGxhdGZvcm19LSR7YXJjaH0ubm9kZWAsXG4gICAgKSxcbiAgKVxuXG4gIGlmICghc3JjRmlsZXMgfHwgIXVuaXZlcnNhbGl6ZXJzW3Byb2Nlc3MucGxhdGZvcm1dKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYCd1bml2ZXJzYWwnIGFyY2ggZm9yIHBsYXRmb3JtICcke3Byb2Nlc3MucGxhdGZvcm19JyBub3Qgc3VwcG9ydGVkLmAsXG4gICAgKVxuICB9XG5cbiAgZGVidWcoYExvb2tpbmcgdXAgc291cmNlIGJpbmFyaWVzIHRvIGNvbWJpbmU6IGApXG4gIGRlYnVnKCcgICVPJywgc3JjRmlsZXMpXG5cbiAgY29uc3Qgc3JjRmlsZUxvb2t1cCA9IGF3YWl0IFByb21pc2UuYWxsKHNyY0ZpbGVzLm1hcCgoZikgPT4gZmlsZUV4aXN0cyhmKSkpXG5cbiAgY29uc3Qgbm90Rm91bmRGaWxlcyA9IHNyY0ZpbGVzLmZpbHRlcigoXywgaSkgPT4gIXNyY0ZpbGVMb29rdXBbaV0pXG5cbiAgaWYgKG5vdEZvdW5kRmlsZXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFNvbWUgYmluYXJ5IGZpbGVzIHdlcmUgbm90IGZvdW5kOiAke0pTT04uc3RyaW5naWZ5KG5vdEZvdW5kRmlsZXMpfWAsXG4gICAgKVxuICB9XG5cbiAgY29uc3Qgb3V0cHV0ID0gcmVzb2x2ZShcbiAgICBvcHRpb25zLmN3ZCxcbiAgICBvcHRpb25zLm91dHB1dERpcixcbiAgICBgJHtjb25maWcuYmluYXJ5TmFtZX0uJHtwcm9jZXNzLnBsYXRmb3JtfS11bml2ZXJzYWwubm9kZWAsXG4gIClcblxuICB1bml2ZXJzYWxpemVyc1twcm9jZXNzLnBsYXRmb3JtXT8uKHNyY0ZpbGVzLCBvdXRwdXQpXG5cbiAgaWYgKCEoYXdhaXQgZmlsZUV4aXN0cyhvdXRwdXQpKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5pdmVyc2FsIGJpbmFyeSB3YXMgbm90IGNyZWF0ZWQ6ICR7b3V0cHV0fWApXG4gIH1cblxuICBkZWJ1ZyhgUHJvZHVjZWQgdW5pdmVyc2FsIGJpbmFyeTogJHtvdXRwdXR9YClcbn1cbiIsImltcG9ydCB7IENvbW1hbmQgfSBmcm9tICdjbGlwYW5pb24nXG5cbmltcG9ydCB7IGNvbGxlY3RBcnRpZmFjdHMgfSBmcm9tICcuLi9hcGkvYXJ0aWZhY3RzLmpzJ1xuaW1wb3J0IHsgQmFzZUFydGlmYWN0c0NvbW1hbmQgfSBmcm9tICcuLi9kZWYvYXJ0aWZhY3RzLmpzJ1xuXG5leHBvcnQgY2xhc3MgQXJ0aWZhY3RzQ29tbWFuZCBleHRlbmRzIEJhc2VBcnRpZmFjdHNDb21tYW5kIHtcbiAgc3RhdGljIHVzYWdlID0gQ29tbWFuZC5Vc2FnZSh7XG4gICAgZGVzY3JpcHRpb246ICdDb3B5IGFydGlmYWN0cyBmcm9tIEdpdGh1YiBBY3Rpb25zIGludG8gc3BlY2lmaWVkIGRpcicsXG4gICAgZXhhbXBsZXM6IFtcbiAgICAgIFtcbiAgICAgICAgJyQwIGFydGlmYWN0cyAtLW91dHB1dC1kaXIgLi9hcnRpZmFjdHMgLS1kaXN0IC4vbnBtJyxcbiAgICAgICAgYENvcHkgW2JpbmFyeU5hbWVdLltwbGF0Zm9ybV0ubm9kZSB1bmRlciBjdXJyZW50IGRpciguKSBpbnRvIHBhY2thZ2VzIHVuZGVyIG5wbSBkaXIuXG5lLmc6IGluZGV4LmxpbnV4LXg2NC1nbnUubm9kZSAtLT4gLi9ucG0vbGludXgteDY0LWdudS9pbmRleC5saW51eC14NjQtZ251Lm5vZGVgLFxuICAgICAgXSxcbiAgICBdLFxuICB9KVxuXG4gIHN0YXRpYyBwYXRocyA9IFtbJ2FydGlmYWN0cyddXVxuXG4gIGFzeW5jIGV4ZWN1dGUoKSB7XG4gICAgYXdhaXQgY29sbGVjdEFydGlmYWN0cyh0aGlzLmdldE9wdGlvbnMoKSlcbiAgfVxufVxuIiwiLy8gVGhpcyBmaWxlIGlzIGdlbmVyYXRlZCBieSBjb2RlZ2VuL2luZGV4LnRzXG4vLyBEbyBub3QgZWRpdCB0aGlzIGZpbGUgbWFudWFsbHlcbmltcG9ydCB7IENvbW1hbmQsIE9wdGlvbiB9IGZyb20gJ2NsaXBhbmlvbidcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEJhc2VCdWlsZENvbW1hbmQgZXh0ZW5kcyBDb21tYW5kIHtcbiAgc3RhdGljIHBhdGhzID0gW1snYnVpbGQnXV1cblxuICBzdGF0aWMgdXNhZ2UgPSBDb21tYW5kLlVzYWdlKHtcbiAgICBkZXNjcmlwdGlvbjogJ0J1aWxkIHRoZSBOQVBJLVJTIHByb2plY3QnLFxuICB9KVxuXG4gIHRhcmdldD86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tdGFyZ2V0LC10Jywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ0J1aWxkIGZvciB0aGUgdGFyZ2V0IHRyaXBsZSwgYnlwYXNzZWQgdG8gYGNhcmdvIGJ1aWxkIC0tdGFyZ2V0YCcsXG4gIH0pXG5cbiAgY3dkPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1jd2QnLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnVGhlIHdvcmtpbmcgZGlyZWN0b3J5IG9mIHdoZXJlIG5hcGkgY29tbWFuZCB3aWxsIGJlIGV4ZWN1dGVkIGluLCBhbGwgb3RoZXIgcGF0aHMgb3B0aW9ucyBhcmUgcmVsYXRpdmUgdG8gdGhpcyBwYXRoJyxcbiAgfSlcblxuICBtYW5pZmVzdFBhdGg/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLW1hbmlmZXN0LXBhdGgnLCB7XG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGBDYXJnby50b21sYCcsXG4gIH0pXG5cbiAgY29uZmlnUGF0aD86IHN0cmluZyA9IE9wdGlvbi5TdHJpbmcoJy0tY29uZmlnLXBhdGgsLWMnLCB7XG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlJyxcbiAgfSlcblxuICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLXBhY2thZ2UtanNvbi1wYXRoJywge1xuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBgcGFja2FnZS5qc29uYCcsXG4gIH0pXG5cbiAgdGFyZ2V0RGlyPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS10YXJnZXQtZGlyJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ0RpcmVjdG9yeSBmb3IgYWxsIGNyYXRlIGdlbmVyYXRlZCBhcnRpZmFjdHMsIHNlZSBgY2FyZ28gYnVpbGQgLS10YXJnZXQtZGlyYCcsXG4gIH0pXG5cbiAgb3V0cHV0RGlyPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1vdXRwdXQtZGlyLC1vJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1BhdGggdG8gd2hlcmUgYWxsIHRoZSBidWlsdCBmaWxlcyB3b3VsZCBiZSBwdXQuIERlZmF1bHQgdG8gdGhlIGNyYXRlIGZvbGRlcicsXG4gIH0pXG5cbiAgcGxhdGZvcm0/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tcGxhdGZvcm0nLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnQWRkIHBsYXRmb3JtIHRyaXBsZSB0byB0aGUgZ2VuZXJhdGVkIG5vZGVqcyBiaW5kaW5nIGZpbGUsIGVnOiBgW25hbWVdLmxpbnV4LXg2NC1nbnUubm9kZWAnLFxuICB9KVxuXG4gIGpzUGFja2FnZU5hbWU/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWpzLXBhY2thZ2UtbmFtZScsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdQYWNrYWdlIG5hbWUgaW4gZ2VuZXJhdGVkIGpzIGJpbmRpbmcgZmlsZS4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnJyxcbiAgfSlcblxuICBjb25zdEVudW0/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tY29uc3QtZW51bScsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1doZXRoZXIgZ2VuZXJhdGUgY29uc3QgZW51bSBmb3IgdHlwZXNjcmlwdCBiaW5kaW5ncycsXG4gIH0pXG5cbiAgcnVudGltZVN0cmluZ0VudW0/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tcnVudGltZS1zdHJpbmctZW51bScsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdFbWl0IGAjW25hcGkoc3RyaW5nX2VudW0pXWAgZW51bXMgYXMgcnVudGltZSBlbnVtcyAoYGV4cG9ydCBkZWNsYXJlIGVudW1gKSB1bmRlciBgLS1uby1jb25zdC1lbnVtYC4gRGVmYXVsdDogdHlwZS1vbmx5IHVuaW9uLicsXG4gIH0pXG5cbiAganNCaW5kaW5nPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1qcycsIHtcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdQYXRoIGFuZCBmaWxlbmFtZSBvZiBnZW5lcmF0ZWQgSlMgYmluZGluZyBmaWxlLiBPbmx5IHdvcmtzIHdpdGggYC0tcGxhdGZvcm1gIGZsYWcuIFJlbGF0aXZlIHRvIGAtLW91dHB1dC1kaXJgLicsXG4gIH0pXG5cbiAgbm9Kc0JpbmRpbmc/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tbm8tanMnLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnV2hldGhlciB0byBkaXNhYmxlIHRoZSBnZW5lcmF0aW9uIEpTIGJpbmRpbmcgZmlsZS4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnLicsXG4gIH0pXG5cbiAgZHRzPzogc3RyaW5nID0gT3B0aW9uLlN0cmluZygnLS1kdHMnLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnUGF0aCBhbmQgZmlsZW5hbWUgb2YgZ2VuZXJhdGVkIHR5cGUgZGVmIGZpbGUuIFJlbGF0aXZlIHRvIGAtLW91dHB1dC1kaXJgJyxcbiAgfSlcblxuICBkdHNIZWFkZXI/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWR0cy1oZWFkZXInLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnQ3VzdG9tIGZpbGUgaGVhZGVyIGZvciBnZW5lcmF0ZWQgdHlwZSBkZWYgZmlsZS4gT25seSB3b3JrcyB3aGVuIGB0eXBlZGVmYCBmZWF0dXJlIGVuYWJsZWQuJyxcbiAgfSlcblxuICBub0R0c0hlYWRlcj86IGJvb2xlYW4gPSBPcHRpb24uQm9vbGVhbignLS1uby1kdHMtaGVhZGVyJywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1doZXRoZXIgdG8gZGlzYWJsZSB0aGUgZGVmYXVsdCBmaWxlIGhlYWRlciBmb3IgZ2VuZXJhdGVkIHR5cGUgZGVmIGZpbGUuIE9ubHkgd29ya3Mgd2hlbiBgdHlwZWRlZmAgZmVhdHVyZSBlbmFibGVkLicsXG4gIH0pXG5cbiAgZHRzQ2FjaGUgPSBPcHRpb24uQm9vbGVhbignLS1kdHMtY2FjaGUnLCB0cnVlLCB7XG4gICAgZGVzY3JpcHRpb246ICdXaGV0aGVyIHRvIGVuYWJsZSB0aGUgZHRzIGNhY2hlLCBkZWZhdWx0IHRvIHRydWUnLFxuICB9KVxuXG4gIGVzbT86IGJvb2xlYW4gPSBPcHRpb24uQm9vbGVhbignLS1lc20nLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnV2hldGhlciB0byBlbWl0IGFuIEVTTSBKUyBiaW5kaW5nIGZpbGUgaW5zdGVhZCBvZiBDSlMgZm9ybWF0LiBPbmx5IHdvcmtzIHdpdGggYC0tcGxhdGZvcm1gIGZsYWcuJyxcbiAgfSlcblxuICBzdHJpcD86IGJvb2xlYW4gPSBPcHRpb24uQm9vbGVhbignLS1zdHJpcCwtcycsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1doZXRoZXIgc3RyaXAgdGhlIGxpYnJhcnkgdG8gYWNoaWV2ZSB0aGUgbWluaW11bSBmaWxlIHNpemUnLFxuICB9KVxuXG4gIHJlbGVhc2U/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tcmVsZWFzZSwtcicsIHtcbiAgICBkZXNjcmlwdGlvbjogJ0J1aWxkIGluIHJlbGVhc2UgbW9kZScsXG4gIH0pXG5cbiAgdmVyYm9zZT86IGJvb2xlYW4gPSBPcHRpb24uQm9vbGVhbignLS12ZXJib3NlLC12Jywge1xuICAgIGRlc2NyaXB0aW9uOiAnVmVyYm9zZWx5IGxvZyBidWlsZCBjb21tYW5kIHRyYWNlJyxcbiAgfSlcblxuICBiaW4/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLWJpbicsIHtcbiAgICBkZXNjcmlwdGlvbjogJ0J1aWxkIG9ubHkgdGhlIHNwZWNpZmllZCBiaW5hcnknLFxuICB9KVxuXG4gIHBhY2thZ2U/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLXBhY2thZ2UsLXAnLCB7XG4gICAgZGVzY3JpcHRpb246ICdCdWlsZCB0aGUgc3BlY2lmaWVkIGxpYnJhcnkgb3IgdGhlIG9uZSBhdCBjd2QnLFxuICB9KVxuXG4gIHByb2ZpbGU/OiBzdHJpbmcgPSBPcHRpb24uU3RyaW5nKCctLXByb2ZpbGUnLCB7XG4gICAgZGVzY3JpcHRpb246ICdCdWlsZCBhcnRpZmFjdHMgd2l0aCB0aGUgc3BlY2lmaWVkIHByb2ZpbGUnLFxuICB9KVxuXG4gIGNyb3NzQ29tcGlsZT86IGJvb2xlYW4gPSBPcHRpb24uQm9vbGVhbignLS1jcm9zcy1jb21waWxlLC14Jywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ1tleHBlcmltZW50YWxdIGNyb3NzIGNvbXBpbGUgYnkgcmVwbGFjaW5nIHRoZSBjYXJnbyBzdWJjb21tYW5kOiBXaW5kb3dzIE1TVkMgdGFyZ2V0cyBmcm9tIGEgbm9uLVdpbmRvd3MgaG9zdCBidWlsZCB3aXRoIGBjYXJnby14d2luYCAoYHdpbmRvd3MtZ251YCB0YXJnZXRzIGFyZSByZWplY3RlZCwgYGNhcmdvLXh3aW5gIGNhbm5vdCBoYW5kbGUgdGhlbSksIG5vbi1XaW5kb3dzIHRhcmdldHMgYnVpbGQgd2l0aCBgY2FyZ28temlnYnVpbGRgIChyZXF1aXJlcyBgemlnYCBvbiBQQVRIKS4gVGhlIHNlbGVjdGVkIHN1YmNvbW1hbmQgaXMgYXV0by1pbnN0YWxsZWQgb24gZmlyc3QgdXNlLiBDYW5ub3QgYmUgY29tYmluZWQgd2l0aCBgLS11c2UtY3Jvc3NgLCBgLS11c2UtbmFwaS1jcm9zc2Agb3IgYC0td2F0Y2hgJyxcbiAgfSlcblxuICB1c2VDcm9zcz86IGJvb2xlYW4gPSBPcHRpb24uQm9vbGVhbignLS11c2UtY3Jvc3MnLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnW2V4cGVyaW1lbnRhbF0gbm90IHJlY29tbWVuZGVkLCBwcmVmZXIgYC0tY3Jvc3MtY29tcGlsZWAgb3IgYC0tdXNlLW5hcGktY3Jvc3NgOiBidWlsZCBpbiBhIERvY2tlciBvciBQb2RtYW4gY29udGFpbmVyIHdpdGggW2Nyb3NzXShodHRwczovL2dpdGh1Yi5jb20vY3Jvc3MtcnMvY3Jvc3MpLCB3aGljaCBtdXN0IGJlIGluc3RhbGxlZCBtYW51YWxseSBhbmQgbmVlZHMgYSBydW5uaW5nIGNvbnRhaW5lciBlbmdpbmUuIENhbm5vdCBiZSBjb21iaW5lZCB3aXRoIGAtLWNyb3NzLWNvbXBpbGVgLCBgLS11c2UtbmFwaS1jcm9zc2Agb3IgYC0td2F0Y2hgJyxcbiAgfSlcblxuICB1c2VOYXBpQ3Jvc3M/OiBib29sZWFuID0gT3B0aW9uLkJvb2xlYW4oJy0tdXNlLW5hcGktY3Jvc3MnLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnW2V4cGVyaW1lbnRhbF0gZG93bmxvYWQgYSBwcmVidWlsdCBnY2MgY3Jvc3MgdG9vbGNoYWluIGZyb20gYEBuYXBpLXJzL2Nyb3NzLXRvb2xjaGFpbmAgKGdsaWJjIDIuMTcpIGFuZCBzZXQgbGlua2VyIGFuZCBDIGNvbXBpbGVyIGVudmlyb25tZW50IHZhcmlhYmxlcy4gTGludXggZ2xpYmMgdGFyZ2V0cyBvbmx5ICh4NjQsIGFybTY0LCBhcm12NywgcHBjNjRsZSwgczM5MHgpIG9uIGEgTGludXggeDY0IG9yIGFybTY0IGhvc3QsIGFueSBvdGhlciB0YXJnZXQgb3IgaG9zdCBlcnJvcnMuIENhbm5vdCBiZSBjb21iaW5lZCB3aXRoIGAtLWNyb3NzLWNvbXBpbGVgIG9yIGAtLXVzZS1jcm9zc2AnLFxuICB9KVxuXG4gIHdhdGNoPzogYm9vbGVhbiA9IE9wdGlvbi5Cb29sZWFuKCctLXdhdGNoLC13Jywge1xuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ3dhdGNoIHRoZSBjcmF0ZSBjaGFuZ2VzIGFuZCBidWlsZCBjb250aW51b3VzbHkgd2l0aCBgY2FyZ28td2F0Y2hgIGNyYXRlcycsXG4gIH0pXG5cbiAgZmVhdHVyZXM/OiBzdHJpbmdbXSA9IE9wdGlvbi5BcnJheSgnLS1mZWF0dXJlcywtRicsIHtcbiAgICBkZXNjcmlwdGlvbjogJ1NwYWNlLXNlcGFyYXRlZCBsaXN0IG9mIGZlYXR1cmVzIHRvIGFjdGl2YXRlJyxcbiAgfSlcblxuICBhbGxGZWF0dXJlcz86IGJvb2xlYW4gPSBPcHRpb24uQm9vbGVhbignLS1hbGwtZmVhdHVyZXMnLCB7XG4gICAgZGVzY3JpcHRpb246ICdBY3RpdmF0ZSBhbGwgYXZhaWxhYmxlIGZlYXR1cmVzJyxcbiAgfSlcblxuICBub0RlZmF1bHRGZWF0dXJlcz86IGJvb2xlYW4gPSBPcHRpb24uQm9vbGVhbignLS1uby1kZWZhdWx0LWZlYXR1cmVzJywge1xuICAgIGRlc2NyaXB0aW9uOiAnRG8gbm90IGFjdGl2YXRlIHRoZSBgZGVmYXVsdGAgZmVhdHVyZScsXG4gIH0pXG5cbiAgZ2V0T3B0aW9ucygpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdGFyZ2V0OiB0aGlzLnRhcmdldCxcbiAgICAgIGN3ZDogdGhpcy5jd2QsXG4gICAgICBtYW5pZmVzdFBhdGg6IHRoaXMubWFuaWZlc3RQYXRoLFxuICAgICAgY29uZmlnUGF0aDogdGhpcy5jb25maWdQYXRoLFxuICAgICAgcGFja2FnZUpzb25QYXRoOiB0aGlzLnBhY2thZ2VKc29uUGF0aCxcbiAgICAgIHRhcmdldERpcjogdGhpcy50YXJnZXREaXIsXG4gICAgICBvdXRwdXREaXI6IHRoaXMub3V0cHV0RGlyLFxuICAgICAgcGxhdGZvcm06IHRoaXMucGxhdGZvcm0sXG4gICAgICBqc1BhY2thZ2VOYW1lOiB0aGlzLmpzUGFja2FnZU5hbWUsXG4gICAgICBjb25zdEVudW06IHRoaXMuY29uc3RFbnVtLFxuICAgICAgcnVudGltZVN0cmluZ0VudW06IHRoaXMucnVudGltZVN0cmluZ0VudW0sXG4gICAgICBqc0JpbmRpbmc6IHRoaXMuanNCaW5kaW5nLFxuICAgICAgbm9Kc0JpbmRpbmc6IHRoaXMubm9Kc0JpbmRpbmcsXG4gICAgICBkdHM6IHRoaXMuZHRzLFxuICAgICAgZHRzSGVhZGVyOiB0aGlzLmR0c0hlYWRlcixcbiAgICAgIG5vRHRzSGVhZGVyOiB0aGlzLm5vRHRzSGVhZGVyLFxuICAgICAgZHRzQ2FjaGU6IHRoaXMuZHRzQ2FjaGUsXG4gICAgICBlc206IHRoaXMuZXNtLFxuICAgICAgc3RyaXA6IHRoaXMuc3RyaXAsXG4gICAgICByZWxlYXNlOiB0aGlzLnJlbGVhc2UsXG4gICAgICB2ZXJib3NlOiB0aGlzLnZlcmJvc2UsXG4gICAgICBiaW46IHRoaXMuYmluLFxuICAgICAgcGFja2FnZTogdGhpcy5wYWNrYWdlLFxuICAgICAgcHJvZmlsZTogdGhpcy5wcm9maWxlLFxuICAgICAgY3Jvc3NDb21waWxlOiB0aGlzLmNyb3NzQ29tcGlsZSxcbiAgICAgIHVzZUNyb3NzOiB0aGlzLnVzZUNyb3NzLFxuICAgICAgdXNlTmFwaUNyb3NzOiB0aGlzLnVzZU5hcGlDcm9zcyxcbiAgICAgIHdhdGNoOiB0aGlzLndhdGNoLFxuICAgICAgZmVhdHVyZXM6IHRoaXMuZmVhdHVyZXMsXG4gICAgICBhbGxGZWF0dXJlczogdGhpcy5hbGxGZWF0dXJlcyxcbiAgICAgIG5vRGVmYXVsdEZlYXR1cmVzOiB0aGlzLm5vRGVmYXVsdEZlYXR1cmVzLFxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEJ1aWxkIHRoZSBOQVBJLVJTIHByb2plY3RcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCdWlsZE9wdGlvbnMge1xuICAvKipcbiAgICogQnVpbGQgZm9yIHRoZSB0YXJnZXQgdHJpcGxlLCBieXBhc3NlZCB0byBgY2FyZ28gYnVpbGQgLS10YXJnZXRgXG4gICAqL1xuICB0YXJnZXQ/OiBzdHJpbmdcbiAgLyoqXG4gICAqIFRoZSB3b3JraW5nIGRpcmVjdG9yeSBvZiB3aGVyZSBuYXBpIGNvbW1hbmQgd2lsbCBiZSBleGVjdXRlZCBpbiwgYWxsIG90aGVyIHBhdGhzIG9wdGlvbnMgYXJlIHJlbGF0aXZlIHRvIHRoaXMgcGF0aFxuICAgKi9cbiAgY3dkPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIGBDYXJnby50b21sYFxuICAgKi9cbiAgbWFuaWZlc3RQYXRoPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIGBuYXBpYCBjb25maWcganNvbiBmaWxlXG4gICAqL1xuICBjb25maWdQYXRoPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIGBwYWNrYWdlLmpzb25gXG4gICAqL1xuICBwYWNrYWdlSnNvblBhdGg/OiBzdHJpbmdcbiAgLyoqXG4gICAqIERpcmVjdG9yeSBmb3IgYWxsIGNyYXRlIGdlbmVyYXRlZCBhcnRpZmFjdHMsIHNlZSBgY2FyZ28gYnVpbGQgLS10YXJnZXQtZGlyYFxuICAgKi9cbiAgdGFyZ2V0RGlyPzogc3RyaW5nXG4gIC8qKlxuICAgKiBQYXRoIHRvIHdoZXJlIGFsbCB0aGUgYnVpbHQgZmlsZXMgd291bGQgYmUgcHV0LiBEZWZhdWx0IHRvIHRoZSBjcmF0ZSBmb2xkZXJcbiAgICovXG4gIG91dHB1dERpcj86IHN0cmluZ1xuICAvKipcbiAgICogQWRkIHBsYXRmb3JtIHRyaXBsZSB0byB0aGUgZ2VuZXJhdGVkIG5vZGVqcyBiaW5kaW5nIGZpbGUsIGVnOiBgW25hbWVdLmxpbnV4LXg2NC1nbnUubm9kZWBcbiAgICovXG4gIHBsYXRmb3JtPzogYm9vbGVhblxuICAvKipcbiAgICogUGFja2FnZSBuYW1lIGluIGdlbmVyYXRlZCBqcyBiaW5kaW5nIGZpbGUuIE9ubHkgd29ya3Mgd2l0aCBgLS1wbGF0Zm9ybWAgZmxhZ1xuICAgKi9cbiAganNQYWNrYWdlTmFtZT86IHN0cmluZ1xuICAvKipcbiAgICogV2hldGhlciBnZW5lcmF0ZSBjb25zdCBlbnVtIGZvciB0eXBlc2NyaXB0IGJpbmRpbmdzXG4gICAqL1xuICBjb25zdEVudW0/OiBib29sZWFuXG4gIC8qKlxuICAgKiBFbWl0IGAjW25hcGkoc3RyaW5nX2VudW0pXWAgZW51bXMgYXMgcnVudGltZSBlbnVtcyAoYGV4cG9ydCBkZWNsYXJlIGVudW1gKSB1bmRlciBgLS1uby1jb25zdC1lbnVtYC4gRGVmYXVsdDogdHlwZS1vbmx5IHVuaW9uLlxuICAgKi9cbiAgcnVudGltZVN0cmluZ0VudW0/OiBib29sZWFuXG4gIC8qKlxuICAgKiBQYXRoIGFuZCBmaWxlbmFtZSBvZiBnZW5lcmF0ZWQgSlMgYmluZGluZyBmaWxlLiBPbmx5IHdvcmtzIHdpdGggYC0tcGxhdGZvcm1gIGZsYWcuIFJlbGF0aXZlIHRvIGAtLW91dHB1dC1kaXJgLlxuICAgKi9cbiAganNCaW5kaW5nPzogc3RyaW5nXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGRpc2FibGUgdGhlIGdlbmVyYXRpb24gSlMgYmluZGluZyBmaWxlLiBPbmx5IHdvcmtzIHdpdGggYC0tcGxhdGZvcm1gIGZsYWcuXG4gICAqL1xuICBub0pzQmluZGluZz86IGJvb2xlYW5cbiAgLyoqXG4gICAqIFBhdGggYW5kIGZpbGVuYW1lIG9mIGdlbmVyYXRlZCB0eXBlIGRlZiBmaWxlLiBSZWxhdGl2ZSB0byBgLS1vdXRwdXQtZGlyYFxuICAgKi9cbiAgZHRzPzogc3RyaW5nXG4gIC8qKlxuICAgKiBDdXN0b20gZmlsZSBoZWFkZXIgZm9yIGdlbmVyYXRlZCB0eXBlIGRlZiBmaWxlLiBPbmx5IHdvcmtzIHdoZW4gYHR5cGVkZWZgIGZlYXR1cmUgZW5hYmxlZC5cbiAgICovXG4gIGR0c0hlYWRlcj86IHN0cmluZ1xuICAvKipcbiAgICogV2hldGhlciB0byBkaXNhYmxlIHRoZSBkZWZhdWx0IGZpbGUgaGVhZGVyIGZvciBnZW5lcmF0ZWQgdHlwZSBkZWYgZmlsZS4gT25seSB3b3JrcyB3aGVuIGB0eXBlZGVmYCBmZWF0dXJlIGVuYWJsZWQuXG4gICAqL1xuICBub0R0c0hlYWRlcj86IGJvb2xlYW5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gZW5hYmxlIHRoZSBkdHMgY2FjaGUsIGRlZmF1bHQgdG8gdHJ1ZVxuICAgKlxuICAgKiBAZGVmYXVsdCB0cnVlXG4gICAqL1xuICBkdHNDYWNoZT86IGJvb2xlYW5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdG8gZW1pdCBhbiBFU00gSlMgYmluZGluZyBmaWxlIGluc3RlYWQgb2YgQ0pTIGZvcm1hdC4gT25seSB3b3JrcyB3aXRoIGAtLXBsYXRmb3JtYCBmbGFnLlxuICAgKi9cbiAgZXNtPzogYm9vbGVhblxuICAvKipcbiAgICogV2hldGhlciBzdHJpcCB0aGUgbGlicmFyeSB0byBhY2hpZXZlIHRoZSBtaW5pbXVtIGZpbGUgc2l6ZVxuICAgKi9cbiAgc3RyaXA/OiBib29sZWFuXG4gIC8qKlxuICAgKiBCdWlsZCBpbiByZWxlYXNlIG1vZGVcbiAgICovXG4gIHJlbGVhc2U/OiBib29sZWFuXG4gIC8qKlxuICAgKiBWZXJib3NlbHkgbG9nIGJ1aWxkIGNvbW1hbmQgdHJhY2VcbiAgICovXG4gIHZlcmJvc2U/OiBib29sZWFuXG4gIC8qKlxuICAgKiBCdWlsZCBvbmx5IHRoZSBzcGVjaWZpZWQgYmluYXJ5XG4gICAqL1xuICBiaW4/OiBzdHJpbmdcbiAgLyoqXG4gICAqIEJ1aWxkIHRoZSBzcGVjaWZpZWQgbGlicmFyeSBvciB0aGUgb25lIGF0IGN3ZFxuICAgKi9cbiAgcGFja2FnZT86IHN0cmluZ1xuICAvKipcbiAgICogQnVpbGQgYXJ0aWZhY3RzIHdpdGggdGhlIHNwZWNpZmllZCBwcm9maWxlXG4gICAqL1xuICBwcm9maWxlPzogc3RyaW5nXG4gIC8qKlxuICAgKiBbZXhwZXJpbWVudGFsXSBjcm9zcyBjb21waWxlIGJ5IHJlcGxhY2luZyB0aGUgY2FyZ28gc3ViY29tbWFuZDogV2luZG93cyBNU1ZDIHRhcmdldHMgZnJvbSBhIG5vbi1XaW5kb3dzIGhvc3QgYnVpbGQgd2l0aCBgY2FyZ28teHdpbmAgKGB3aW5kb3dzLWdudWAgdGFyZ2V0cyBhcmUgcmVqZWN0ZWQsIGBjYXJnby14d2luYCBjYW5ub3QgaGFuZGxlIHRoZW0pLCBub24tV2luZG93cyB0YXJnZXRzIGJ1aWxkIHdpdGggYGNhcmdvLXppZ2J1aWxkYCAocmVxdWlyZXMgYHppZ2Agb24gUEFUSCkuIFRoZSBzZWxlY3RlZCBzdWJjb21tYW5kIGlzIGF1dG8taW5zdGFsbGVkIG9uIGZpcnN0IHVzZS4gQ2Fubm90IGJlIGNvbWJpbmVkIHdpdGggYC0tdXNlLWNyb3NzYCwgYC0tdXNlLW5hcGktY3Jvc3NgIG9yIGAtLXdhdGNoYFxuICAgKi9cbiAgY3Jvc3NDb21waWxlPzogYm9vbGVhblxuICAvKipcbiAgICogW2V4cGVyaW1lbnRhbF0gbm90IHJlY29tbWVuZGVkLCBwcmVmZXIgYC0tY3Jvc3MtY29tcGlsZWAgb3IgYC0tdXNlLW5hcGktY3Jvc3NgOiBidWlsZCBpbiBhIERvY2tlciBvciBQb2RtYW4gY29udGFpbmVyIHdpdGggW2Nyb3NzXShodHRwczovL2dpdGh1Yi5jb20vY3Jvc3MtcnMvY3Jvc3MpLCB3aGljaCBtdXN0IGJlIGluc3RhbGxlZCBtYW51YWxseSBhbmQgbmVlZHMgYSBydW5uaW5nIGNvbnRhaW5lciBlbmdpbmUuIENhbm5vdCBiZSBjb21iaW5lZCB3aXRoIGAtLWNyb3NzLWNvbXBpbGVgLCBgLS11c2UtbmFwaS1jcm9zc2Agb3IgYC0td2F0Y2hgXG4gICAqL1xuICB1c2VDcm9zcz86IGJvb2xlYW5cbiAgLyoqXG4gICAqIFtleHBlcmltZW50YWxdIGRvd25sb2FkIGEgcHJlYnVpbHQgZ2NjIGNyb3NzIHRvb2xjaGFpbiBmcm9tIGBAbmFwaS1ycy9jcm9zcy10b29sY2hhaW5gIChnbGliYyAyLjE3KSBhbmQgc2V0IGxpbmtlciBhbmQgQyBjb21waWxlciBlbnZpcm9ubWVudCB2YXJpYWJsZXMuIExpbnV4IGdsaWJjIHRhcmdldHMgb25seSAoeDY0LCBhcm02NCwgYXJtdjcsIHBwYzY0bGUsIHMzOTB4KSBvbiBhIExpbnV4IHg2NCBvciBhcm02NCBob3N0LCBhbnkgb3RoZXIgdGFyZ2V0IG9yIGhvc3QgZXJyb3JzLiBDYW5ub3QgYmUgY29tYmluZWQgd2l0aCBgLS1jcm9zcy1jb21waWxlYCBvciBgLS11c2UtY3Jvc3NgXG4gICAqL1xuICB1c2VOYXBpQ3Jvc3M/OiBib29sZWFuXG4gIC8qKlxuICAgKiB3YXRjaCB0aGUgY3JhdGUgY2hhbmdlcyBhbmQgYnVpbGQgY29udGludW91c2x5IHdpdGggYGNhcmdvLXdhdGNoYCBjcmF0ZXNcbiAgICovXG4gIHdhdGNoPzogYm9vbGVhblxuICAvKipcbiAgICogU3BhY2Utc2VwYXJhdGVkIGxpc3Qgb2YgZmVhdHVyZXMgdG8gYWN0aXZhdGVcbiAgICovXG4gIGZlYXR1cmVzPzogc3RyaW5nW11cbiAgLyoqXG4gICAqIEFjdGl2YXRlIGFsbCBhdmFpbGFibGUgZmVhdHVyZXNcbiAgICovXG4gIGFsbEZlYXR1cmVzPzogYm9vbGVhblxuICAvKipcbiAgICogRG8gbm90IGFjdGl2YXRlIHRoZSBgZGVmYXVsdGAgZmVhdHVyZVxuICAgKi9cbiAgbm9EZWZhdWx0RmVhdHVyZXM/OiBib29sZWFuXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseURlZmF1bHRCdWlsZE9wdGlvbnMob3B0aW9uczogQnVpbGRPcHRpb25zKSB7XG4gIHJldHVybiB7XG4gICAgZHRzQ2FjaGU6IHRydWUsXG4gICAgLi4ub3B0aW9ucyxcbiAgfVxufVxuIiwiaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdub2RlOmNoaWxkX3Byb2Nlc3MnXG5cbmltcG9ydCB7IE9wdGlvbiB9IGZyb20gJ2NsaXBhbmlvbidcblxuaW1wb3J0IHsgYnVpbGRQcm9qZWN0IH0gZnJvbSAnLi4vYXBpL2J1aWxkLmpzJ1xuaW1wb3J0IHsgQmFzZUJ1aWxkQ29tbWFuZCB9IGZyb20gJy4uL2RlZi9idWlsZC5qcydcbmltcG9ydCB7IGRlYnVnRmFjdG9yeSB9IGZyb20gJy4uL3V0aWxzL2luZGV4LmpzJ1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSgnYnVpbGQnKVxuXG5leHBvcnQgY2xhc3MgQnVpbGRDb21tYW5kIGV4dGVuZHMgQmFzZUJ1aWxkQ29tbWFuZCB7XG4gIHBpcGUgPSBPcHRpb24uU3RyaW5nKCctLXBpcGUnLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnUGlwZSBhbGwgb3V0cHV0cyBmaWxlIHRvIGdpdmVuIGNvbW1hbmQuIGUuZy4gYG5hcGkgYnVpbGQgLS1waXBlIFwibnB4IHByZXR0aWVyIC0td3JpdGVcImAnLFxuICB9KVxuXG4gIGNhcmdvT3B0aW9ucyA9IE9wdGlvbi5SZXN0KClcblxuICBhc3luYyBleGVjdXRlKCkge1xuICAgIGNvbnN0IHsgdGFzayB9ID0gYXdhaXQgYnVpbGRQcm9qZWN0KHtcbiAgICAgIC4uLnRoaXMuZ2V0T3B0aW9ucygpLFxuICAgICAgY2FyZ29PcHRpb25zOiB0aGlzLmNhcmdvT3B0aW9ucyxcbiAgICB9KVxuXG4gICAgY29uc3Qgb3V0cHV0cyA9IGF3YWl0IHRhc2tcblxuICAgIGlmICh0aGlzLnBpcGUpIHtcbiAgICAgIGZvciAoY29uc3Qgb3V0cHV0IG9mIG91dHB1dHMpIHtcbiAgICAgICAgZGVidWcoJ1BpcGluZyBvdXRwdXQgZmlsZSB0byBjb21tYW5kOiAlcycsIHRoaXMucGlwZSlcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBleGVjU3luYyhgJHt0aGlzLnBpcGV9ICR7b3V0cHV0LnBhdGh9YCwge1xuICAgICAgICAgICAgc3RkaW86ICdpbmhlcml0JyxcbiAgICAgICAgICAgIGN3ZDogdGhpcy5jd2QsXG4gICAgICAgICAgfSlcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGRlYnVnLmVycm9yKGBGYWlsZWQgdG8gcGlwZSBvdXRwdXQgZmlsZSAke291dHB1dC5wYXRofSB0byBjb21tYW5kYClcbiAgICAgICAgICBkZWJ1Zy5lcnJvcihlKVxuICAgICAgICAgIHRocm93IGVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJ2NsaXBhbmlvbidcblxuaW1wb3J0IHsgQ0xJX1ZFUlNJT04gfSBmcm9tICcuLi91dGlscy9taXNjLmpzJ1xuXG4vKipcbiAqIEEgY29tbWFuZCB0aGF0IHByaW50cyB0aGUgdmVyc2lvbiBvZiB0aGUgQ0xJLlxuICpcbiAqIFBhdGhzOiBgLXZgLCBgLS12ZXJzaW9uYFxuICovXG5leHBvcnQgY2xhc3MgQ2xpVmVyc2lvbkNvbW1hbmQgZXh0ZW5kcyBDb21tYW5kPGFueT4ge1xuICBzdGF0aWMgcGF0aHMgPSBbW2AtdmBdLCBbYC0tdmVyc2lvbmBdXVxuICBhc3luYyBleGVjdXRlKCkge1xuICAgIGF3YWl0IHRoaXMuY29udGV4dC5zdGRvdXQud3JpdGUoYCR7Q0xJX1ZFUlNJT059XFxuYClcbiAgfVxufVxuIiwiaW1wb3J0IHsgY3JlYXRlTnBtRGlycyB9IGZyb20gJy4uL2FwaS9jcmVhdGUtbnBtLWRpcnMuanMnXG5pbXBvcnQgeyBCYXNlQ3JlYXRlTnBtRGlyc0NvbW1hbmQgfSBmcm9tICcuLi9kZWYvY3JlYXRlLW5wbS1kaXJzLmpzJ1xuXG5leHBvcnQgY2xhc3MgQ3JlYXRlTnBtRGlyc0NvbW1hbmQgZXh0ZW5kcyBCYXNlQ3JlYXRlTnBtRGlyc0NvbW1hbmQge1xuICBhc3luYyBleGVjdXRlKCkge1xuICAgIGF3YWl0IGNyZWF0ZU5wbURpcnModGhpcy5nZXRPcHRpb25zKCkpXG4gIH1cbn1cbiIsImltcG9ydCB7IENvbW1hbmQgfSBmcm9tICdjbGlwYW5pb24nXG5cbi8qKlxuICogQSBjb21tYW5kIHRoYXQgcHJpbnRzIHRoZSB1c2FnZSBvZiBhbGwgY29tbWFuZHMuXG4gKlxuICogUGF0aHM6IGAtaGAsIGAtLWhlbHBgXG4gKi9cbmV4cG9ydCBjbGFzcyBIZWxwQ29tbWFuZCBleHRlbmRzIENvbW1hbmQ8YW55PiB7XG4gIHN0YXRpYyBwYXRocyA9IFtbYC1oYF0sIFtgLS1oZWxwYF1dXG4gIGFzeW5jIGV4ZWN1dGUoKSB7XG4gICAgYXdhaXQgdGhpcy5jb250ZXh0LnN0ZG91dC53cml0ZSh0aGlzLmNsaS51c2FnZSgpKVxuICB9XG59XG4iLCJpbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnXG5cbmltcG9ydCB7IGlucHV0LCBzZWxlY3QsIGNoZWNrYm94LCBjb25maXJtIH0gZnJvbSAnQGlucXVpcmVyL3Byb21wdHMnXG5pbXBvcnQgeyBPcHRpb24gfSBmcm9tICdjbGlwYW5pb24nXG5cbmltcG9ydCB7IG5ld1Byb2plY3QgfSBmcm9tICcuLi9hcGkvbmV3LmpzJ1xuaW1wb3J0IHsgQmFzZU5ld0NvbW1hbmQgfSBmcm9tICcuLi9kZWYvbmV3LmpzJ1xuaW1wb3J0IHtcbiAgQVZBSUxBQkxFX1RBUkdFVFMsXG4gIGRlYnVnRmFjdG9yeSxcbiAgREVGQVVMVF9UQVJHRVRTLFxuICB0eXBlIFRhcmdldFRyaXBsZSxcbn0gZnJvbSAnLi4vdXRpbHMvaW5kZXguanMnXG5pbXBvcnQge1xuICBuYXBpRW5naW5lUmVxdWlyZW1lbnQsXG4gIFNVUFBPUlRFRF9OQVBJX1ZFUlNJT05TLFxufSBmcm9tICcuLi91dGlscy92ZXJzaW9uLmpzJ1xuXG5jb25zdCBkZWJ1ZyA9IGRlYnVnRmFjdG9yeSgnbmV3JylcblxuZXhwb3J0IGZ1bmN0aW9uIGdldE5hcGlWZXJzaW9uQ2hvaWNlcygpIHtcbiAgcmV0dXJuIFNVUFBPUlRFRF9OQVBJX1ZFUlNJT05TLm1hcCgodmVyc2lvbikgPT4gKHtcbiAgICBuYW1lOiBgbmFwaSR7dmVyc2lvbn0gKCR7bmFwaUVuZ2luZVJlcXVpcmVtZW50KHZlcnNpb24pfSlgLFxuICAgIHZhbHVlOiB2ZXJzaW9uLFxuICB9KSlcbn1cblxuZXhwb3J0IGNsYXNzIE5ld0NvbW1hbmQgZXh0ZW5kcyBCYXNlTmV3Q29tbWFuZCB7XG4gIGludGVyYWN0aXZlID0gT3B0aW9uLkJvb2xlYW4oJy0taW50ZXJhY3RpdmUsLWknLCB0cnVlLCB7XG4gICAgZGVzY3JpcHRpb246XG4gICAgICAnQXNrIHByb2plY3QgYmFzaWMgaW5mb3JtYXRpb24gaW50ZXJhY3RpdmVseSB3aXRob3V0IGp1c3QgdXNpbmcgdGhlIGRlZmF1bHQuJyxcbiAgfSlcblxuICBhc3luYyBleGVjdXRlKCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBvcHRpb25zID0gYXdhaXQgdGhpcy5mZXRjaE9wdGlvbnMoKVxuICAgICAgYXdhaXQgbmV3UHJvamVjdChvcHRpb25zKVxuICAgICAgcmV0dXJuIDBcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBkZWJ1ZygnRmFpbGVkIHRvIGNyZWF0ZSBuZXcgcHJvamVjdCcpXG4gICAgICBkZWJ1Zy5lcnJvcihlKVxuICAgICAgcmV0dXJuIDFcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGZldGNoT3B0aW9ucygpIHtcbiAgICBjb25zdCBjbWRPcHRpb25zID0gc3VwZXIuZ2V0T3B0aW9ucygpXG5cbiAgICBpZiAodGhpcy5pbnRlcmFjdGl2ZSkge1xuICAgICAgY29uc3QgdGFyZ2V0UGF0aDogc3RyaW5nID0gY21kT3B0aW9ucy5wYXRoXG4gICAgICAgID8gY21kT3B0aW9ucy5wYXRoXG4gICAgICAgIDogYXdhaXQgaW5xdWlyZXJQcm9qZWN0UGF0aCgpXG4gICAgICBjbWRPcHRpb25zLnBhdGggPSB0YXJnZXRQYXRoXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5jbWRPcHRpb25zLFxuICAgICAgICBuYW1lOiBhd2FpdCB0aGlzLmZldGNoTmFtZShwYXRoLnBhcnNlKHRhcmdldFBhdGgpLmJhc2UpLFxuICAgICAgICBtaW5Ob2RlQXBpVmVyc2lvbjogYXdhaXQgdGhpcy5mZXRjaE5hcGlWZXJzaW9uKCksXG4gICAgICAgIHRhcmdldHM6IGF3YWl0IHRoaXMuZmV0Y2hUYXJnZXRzKCksXG4gICAgICAgIGxpY2Vuc2U6IGF3YWl0IHRoaXMuZmV0Y2hMaWNlbnNlKCksXG4gICAgICAgIGVuYWJsZVR5cGVEZWY6IGF3YWl0IHRoaXMuZmV0Y2hUeXBlRGVmKCksXG4gICAgICAgIGVuYWJsZUdpdGh1YkFjdGlvbnM6IGF3YWl0IHRoaXMuZmV0Y2hHaXRodWJBY3Rpb25zKCksXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNtZE9wdGlvbnNcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZmV0Y2hOYW1lKGRlZmF1bHROYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLiQkbmFtZSA/P1xuICAgICAgaW5wdXQoe1xuICAgICAgICBtZXNzYWdlOiAnUGFja2FnZSBuYW1lICh0aGUgbmFtZSBmaWVsZCBpbiB5b3VyIHBhY2thZ2UuanNvbiBmaWxlKScsXG4gICAgICAgIGRlZmF1bHQ6IGRlZmF1bHROYW1lLFxuICAgICAgfSlcbiAgICApXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGZldGNoTGljZW5zZSgpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiBpbnB1dCh7XG4gICAgICBtZXNzYWdlOiAnTGljZW5zZSBmb3Igb3Blbi1zb3VyY2VkIHByb2plY3QnLFxuICAgICAgZGVmYXVsdDogdGhpcy5saWNlbnNlLFxuICAgIH0pXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGZldGNoTmFwaVZlcnNpb24oKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICByZXR1cm4gc2VsZWN0KHtcbiAgICAgIG1lc3NhZ2U6ICdNaW5pbXVtIG5vZGUtYXBpIHZlcnNpb24gKHdpdGggbm9kZSB2ZXJzaW9uIHJlcXVpcmVtZW50KScsXG4gICAgICBsb29wOiBmYWxzZSxcbiAgICAgIHBhZ2VTaXplOiAxMCxcbiAgICAgIGNob2ljZXM6IGdldE5hcGlWZXJzaW9uQ2hvaWNlcygpLFxuICAgICAgLy8gY2hvaWNlIGluZGV4XG4gICAgICBkZWZhdWx0OiB0aGlzLm1pbk5vZGVBcGlWZXJzaW9uIC0gMSxcbiAgICB9KVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBmZXRjaFRhcmdldHMoKTogUHJvbWlzZTxUYXJnZXRUcmlwbGVbXT4ge1xuICAgIGlmICh0aGlzLmVuYWJsZUFsbFRhcmdldHMpIHtcbiAgICAgIHJldHVybiBBVkFJTEFCTEVfVEFSR0VUUy5jb25jYXQoKVxuICAgIH1cblxuICAgIGNvbnN0IHRhcmdldHMgPSBhd2FpdCBjaGVja2JveCh7XG4gICAgICBsb29wOiBmYWxzZSxcbiAgICAgIG1lc3NhZ2U6ICdDaG9vc2UgdGFyZ2V0KHMpIHlvdXIgY3JhdGUgd2lsbCBiZSBjb21waWxlZCB0bycsXG4gICAgICBjaG9pY2VzOiBBVkFJTEFCTEVfVEFSR0VUUy5tYXAoKHRhcmdldCkgPT4gKHtcbiAgICAgICAgbmFtZTogdGFyZ2V0LFxuICAgICAgICB2YWx1ZTogdGFyZ2V0LFxuICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gICAgICAgIGNoZWNrZWQ6IERFRkFVTFRfVEFSR0VUUy5pbmNsdWRlcyh0YXJnZXQpLFxuICAgICAgfSkpLFxuICAgIH0pXG5cbiAgICByZXR1cm4gdGFyZ2V0c1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBmZXRjaFR5cGVEZWYoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgZW5hYmxlVHlwZURlZiA9IGF3YWl0IGNvbmZpcm0oe1xuICAgICAgbWVzc2FnZTogJ0VuYWJsZSB0eXBlIGRlZmluaXRpb24gYXV0by1nZW5lcmF0aW9uJyxcbiAgICAgIGRlZmF1bHQ6IHRoaXMuZW5hYmxlVHlwZURlZixcbiAgICB9KVxuXG4gICAgcmV0dXJuIGVuYWJsZVR5cGVEZWZcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZmV0Y2hHaXRodWJBY3Rpb25zKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IGVuYWJsZUdpdGh1YkFjdGlvbnMgPSBhd2FpdCBjb25maXJtKHtcbiAgICAgIG1lc3NhZ2U6ICdFbmFibGUgR2l0aHViIEFjdGlvbnMgQ0knLFxuICAgICAgZGVmYXVsdDogdGhpcy5lbmFibGVHaXRodWJBY3Rpb25zLFxuICAgIH0pXG5cbiAgICByZXR1cm4gZW5hYmxlR2l0aHViQWN0aW9uc1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGlucXVpcmVyUHJvamVjdFBhdGgoKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgcmV0dXJuIGlucHV0KHtcbiAgICBtZXNzYWdlOiAnVGFyZ2V0IHBhdGggdG8gY3JlYXRlIHRoZSBwcm9qZWN0LCByZWxhdGl2ZSB0byBjd2QuJyxcbiAgfSkudGhlbigocGF0aCkgPT4ge1xuICAgIGlmICghcGF0aCkge1xuICAgICAgcmV0dXJuIGlucXVpcmVyUHJvamVjdFBhdGgoKVxuICAgIH1cbiAgICByZXR1cm4gcGF0aFxuICB9KVxufVxuIiwiaW1wb3J0IHsgcHJlUHVibGlzaCB9IGZyb20gJy4uL2FwaS9wcmUtcHVibGlzaC5qcydcbmltcG9ydCB7IEJhc2VQcmVQdWJsaXNoQ29tbWFuZCB9IGZyb20gJy4uL2RlZi9wcmUtcHVibGlzaC5qcydcblxuZXhwb3J0IGNsYXNzIFByZVB1Ymxpc2hDb21tYW5kIGV4dGVuZHMgQmFzZVByZVB1Ymxpc2hDb21tYW5kIHtcbiAgYXN5bmMgZXhlY3V0ZSgpIHtcbiAgICAvLyBAdHMtZXhwZWN0LWVycm9yIGNvbnN0ICducG0nIHwgJ2xlcm5hJyB0byBzdHJpbmdcbiAgICBhd2FpdCBwcmVQdWJsaXNoKHRoaXMuZ2V0T3B0aW9ucygpKVxuICB9XG59XG4iLCJpbXBvcnQgeyBpbnB1dCB9IGZyb20gJ0BpbnF1aXJlci9wcm9tcHRzJ1xuXG5pbXBvcnQgeyByZW5hbWVQcm9qZWN0IH0gZnJvbSAnLi4vYXBpL3JlbmFtZS5qcydcbmltcG9ydCB7IEJhc2VSZW5hbWVDb21tYW5kIH0gZnJvbSAnLi4vZGVmL3JlbmFtZS5qcydcblxuZXhwb3J0IGNsYXNzIFJlbmFtZUNvbW1hbmQgZXh0ZW5kcyBCYXNlUmVuYW1lQ29tbWFuZCB7XG4gIGFzeW5jIGV4ZWN1dGUoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuZ2V0T3B0aW9ucygpXG4gICAgaWYgKCFvcHRpb25zLm5hbWUpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBhd2FpdCBpbnB1dCh7XG4gICAgICAgIG1lc3NhZ2U6IGBFbnRlciB0aGUgbmV3IHBhY2thZ2UgbmFtZSBpbiB0aGUgcGFja2FnZS5qc29uYCxcbiAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICB9KVxuICAgICAgb3B0aW9ucy5uYW1lID0gbmFtZVxuICAgIH1cbiAgICBpZiAoIW9wdGlvbnMuYmluYXJ5TmFtZSkge1xuICAgICAgY29uc3QgYmluYXJ5TmFtZSA9IGF3YWl0IGlucHV0KHtcbiAgICAgICAgbWVzc2FnZTogYEVudGVyIHRoZSBuZXcgYmluYXJ5IG5hbWVgLFxuICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgIH0pXG4gICAgICBvcHRpb25zLmJpbmFyeU5hbWUgPSBiaW5hcnlOYW1lXG4gICAgfVxuICAgIGF3YWl0IHJlbmFtZVByb2plY3Qob3B0aW9ucylcbiAgfVxufVxuIiwiaW1wb3J0IHsgdW5pdmVyc2FsaXplQmluYXJpZXMgfSBmcm9tICcuLi9hcGkvdW5pdmVyc2FsaXplLmpzJ1xuaW1wb3J0IHsgQmFzZVVuaXZlcnNhbGl6ZUNvbW1hbmQgfSBmcm9tICcuLi9kZWYvdW5pdmVyc2FsaXplLmpzJ1xuXG5leHBvcnQgY2xhc3MgVW5pdmVyc2FsaXplQ29tbWFuZCBleHRlbmRzIEJhc2VVbml2ZXJzYWxpemVDb21tYW5kIHtcbiAgYXN5bmMgZXhlY3V0ZSgpIHtcbiAgICBhd2FpdCB1bml2ZXJzYWxpemVCaW5hcmllcyh0aGlzLmdldE9wdGlvbnMoKSlcbiAgfVxufVxuIiwiaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gJy4uL2FwaS92ZXJzaW9uLmpzJ1xuaW1wb3J0IHsgQmFzZVZlcnNpb25Db21tYW5kIH0gZnJvbSAnLi4vZGVmL3ZlcnNpb24uanMnXG5cbmV4cG9ydCBjbGFzcyBWZXJzaW9uQ29tbWFuZCBleHRlbmRzIEJhc2VWZXJzaW9uQ29tbWFuZCB7XG4gIGFzeW5jIGV4ZWN1dGUoKSB7XG4gICAgYXdhaXQgdmVyc2lvbih0aGlzLmdldE9wdGlvbnMoKSlcbiAgfVxufVxuIiwiaW1wb3J0IHsgQ2xpIH0gZnJvbSAnY2xpcGFuaW9uJ1xuXG5pbXBvcnQgeyBjb2xsZWN0QXJ0aWZhY3RzIH0gZnJvbSAnLi9hcGkvYXJ0aWZhY3RzLmpzJ1xuaW1wb3J0IHsgYnVpbGRQcm9qZWN0IH0gZnJvbSAnLi9hcGkvYnVpbGQuanMnXG5pbXBvcnQgeyBjcmVhdGVOcG1EaXJzIH0gZnJvbSAnLi9hcGkvY3JlYXRlLW5wbS1kaXJzLmpzJ1xuaW1wb3J0IHsgbmV3UHJvamVjdCB9IGZyb20gJy4vYXBpL25ldy5qcydcbmltcG9ydCB7IHByZVB1Ymxpc2ggfSBmcm9tICcuL2FwaS9wcmUtcHVibGlzaC5qcydcbmltcG9ydCB7IHJlbmFtZVByb2plY3QgfSBmcm9tICcuL2FwaS9yZW5hbWUuanMnXG5pbXBvcnQgeyB1bml2ZXJzYWxpemVCaW5hcmllcyB9IGZyb20gJy4vYXBpL3VuaXZlcnNhbGl6ZS5qcydcbmltcG9ydCB7IHZlcnNpb24gfSBmcm9tICcuL2FwaS92ZXJzaW9uLmpzJ1xuaW1wb3J0IHsgQXJ0aWZhY3RzQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvYXJ0aWZhY3RzLmpzJ1xuaW1wb3J0IHsgQnVpbGRDb21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy9idWlsZC5qcydcbmltcG9ydCB7IENsaVZlcnNpb25Db21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy9jbGktdmVyc2lvbi5qcydcbmltcG9ydCB7IENyZWF0ZU5wbURpcnNDb21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy9jcmVhdGUtbnBtLWRpcnMuanMnXG5pbXBvcnQgeyBIZWxwQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMvaGVscC5qcydcbmltcG9ydCB7IE5ld0NvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL25ldy5qcydcbmltcG9ydCB7IFByZVB1Ymxpc2hDb21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy9wcmUtcHVibGlzaC5qcydcbmltcG9ydCB7IFJlbmFtZUNvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL3JlbmFtZS5qcydcbmltcG9ydCB7IFVuaXZlcnNhbGl6ZUNvbW1hbmQgfSBmcm9tICcuL2NvbW1hbmRzL3VuaXZlcnNhbGl6ZS5qcydcbmltcG9ydCB7IFZlcnNpb25Db21tYW5kIH0gZnJvbSAnLi9jb21tYW5kcy92ZXJzaW9uLmpzJ1xuaW1wb3J0IHsgQ0xJX1ZFUlNJT04gfSBmcm9tICcuL3V0aWxzL21pc2MuanMnXG5cbmV4cG9ydCBjb25zdCBjbGkgPSBuZXcgQ2xpKHtcbiAgYmluYXJ5TmFtZTogJ25hcGknLFxuICBiaW5hcnlWZXJzaW9uOiBDTElfVkVSU0lPTixcbn0pXG5cbmNsaS5yZWdpc3RlcihOZXdDb21tYW5kKVxuY2xpLnJlZ2lzdGVyKEJ1aWxkQ29tbWFuZClcbmNsaS5yZWdpc3RlcihDcmVhdGVOcG1EaXJzQ29tbWFuZClcbmNsaS5yZWdpc3RlcihBcnRpZmFjdHNDb21tYW5kKVxuY2xpLnJlZ2lzdGVyKFVuaXZlcnNhbGl6ZUNvbW1hbmQpXG5jbGkucmVnaXN0ZXIoUmVuYW1lQ29tbWFuZClcbmNsaS5yZWdpc3RlcihQcmVQdWJsaXNoQ29tbWFuZClcbmNsaS5yZWdpc3RlcihWZXJzaW9uQ29tbWFuZClcbmNsaS5yZWdpc3RlcihIZWxwQ29tbWFuZClcbmNsaS5yZWdpc3RlcihDbGlWZXJzaW9uQ29tbWFuZClcblxuLyoqXG4gKlxuICogQHVzYWdlXG4gKlxuICogYGBgdHNcbiAqIGNvbnN0IGNsaSA9IG5ldyBOYXBpQ2xpKClcbiAqXG4gKiBjbGkuYnVpbGQoe1xuICogICBjd2Q6ICcvcGF0aC90by95b3VyL3Byb2plY3QnLFxuICogfSlcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgTmFwaUNsaSB7XG4gIGFydGlmYWN0cyA9IGNvbGxlY3RBcnRpZmFjdHNcbiAgbmV3ID0gbmV3UHJvamVjdFxuICBidWlsZCA9IGJ1aWxkUHJvamVjdFxuICBjcmVhdGVOcG1EaXJzID0gY3JlYXRlTnBtRGlyc1xuICBwcmVQdWJsaXNoID0gcHJlUHVibGlzaFxuICByZW5hbWUgPSByZW5hbWVQcm9qZWN0XG4gIHVuaXZlcnNhbGl6ZSA9IHVuaXZlcnNhbGl6ZUJpbmFyaWVzXG4gIHZlcnNpb24gPSB2ZXJzaW9uXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCdWlsZENvbW1hbmQoYXJnczogc3RyaW5nW10pOiBCdWlsZENvbW1hbmQge1xuICByZXR1cm4gY2xpLnByb2Nlc3MoWydidWlsZCcsIC4uLmFyZ3NdKSBhcyBCdWlsZENvbW1hbmRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFydGlmYWN0c0NvbW1hbmQoYXJnczogc3RyaW5nW10pOiBBcnRpZmFjdHNDb21tYW5kIHtcbiAgcmV0dXJuIGNsaS5wcm9jZXNzKFsnYXJ0aWZhY3RzJywgLi4uYXJnc10pIGFzIEFydGlmYWN0c0NvbW1hbmRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNyZWF0ZU5wbURpcnNDb21tYW5kKFxuICBhcmdzOiBzdHJpbmdbXSxcbik6IENyZWF0ZU5wbURpcnNDb21tYW5kIHtcbiAgcmV0dXJuIGNsaS5wcm9jZXNzKFsnY3JlYXRlLW5wbS1kaXJzJywgLi4uYXJnc10pIGFzIENyZWF0ZU5wbURpcnNDb21tYW5kXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQcmVQdWJsaXNoQ29tbWFuZChhcmdzOiBzdHJpbmdbXSk6IFByZVB1Ymxpc2hDb21tYW5kIHtcbiAgcmV0dXJuIGNsaS5wcm9jZXNzKFsncHJlLXB1Ymxpc2gnLCAuLi5hcmdzXSkgYXMgUHJlUHVibGlzaENvbW1hbmRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlbmFtZUNvbW1hbmQoYXJnczogc3RyaW5nW10pOiBSZW5hbWVDb21tYW5kIHtcbiAgcmV0dXJuIGNsaS5wcm9jZXNzKFsncmVuYW1lJywgLi4uYXJnc10pIGFzIFJlbmFtZUNvbW1hbmRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVVuaXZlcnNhbGl6ZUNvbW1hbmQoYXJnczogc3RyaW5nW10pOiBVbml2ZXJzYWxpemVDb21tYW5kIHtcbiAgcmV0dXJuIGNsaS5wcm9jZXNzKFsndW5pdmVyc2FsaXplJywgLi4uYXJnc10pIGFzIFVuaXZlcnNhbGl6ZUNvbW1hbmRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVZlcnNpb25Db21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogVmVyc2lvbkNvbW1hbmQge1xuICByZXR1cm4gY2xpLnByb2Nlc3MoWyd2ZXJzaW9uJywgLi4uYXJnc10pIGFzIFZlcnNpb25Db21tYW5kXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVOZXdDb21tYW5kKGFyZ3M6IHN0cmluZ1tdKTogTmV3Q29tbWFuZCB7XG4gIHJldHVybiBjbGkucHJvY2VzcyhbJ25ldycsIC4uLmFyZ3NdKSBhcyBOZXdDb21tYW5kXG59XG5cbmV4cG9ydCB7IHBhcnNlVHJpcGxlIH0gZnJvbSAnLi91dGlscy90YXJnZXQuanMnXG5leHBvcnQge1xuICB0eXBlIEdlbmVyYXRlVHlwZURlZk9wdGlvbnMsXG4gIHR5cGUgV3JpdGVKc0JpbmRpbmdPcHRpb25zLFxuICB3cml0ZUpzQmluZGluZyxcbiAgZ2VuZXJhdGVUeXBlRGVmLFxufSBmcm9tICcuL2FwaS9idWlsZC5qcydcbmV4cG9ydCB7IHJlYWROYXBpQ29uZmlnIH0gZnJvbSAnLi91dGlscy9jb25maWcuanMnXG4iLCIjIS91c3IvYmluL2VudiBub2RlXG5cbmltcG9ydCB7IGNsaSB9IGZyb20gJy4vaW5kZXguanMnXG5cbnZvaWQgY2xpLnJ1bkV4aXQocHJvY2Vzcy5hcmd2LnNsaWNlKDIpKVxuIl0sInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlsxOCwxOSwyMCwyMSwyMywyNCwyNV0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBSUEsSUFBc0IsdUJBQXRCLGNBQW1ELFFBQVE7Q0FDekQsT0FBTyxRQUFRLENBQUMsQ0FBQyxXQUFXLENBQUM7Q0FFN0IsT0FBTyxRQUFRLFFBQVEsTUFBTSxFQUMzQixhQUNFLDRFQUNKLENBQUM7Q0FFRCxNQUFNLE9BQU8sT0FBTyxTQUFTLFFBQVEsSUFBSSxHQUFHLEVBQzFDLGFBQ0UscUhBQ0osQ0FBQztDQUVELGFBQXNCLE9BQU8sT0FBTyxvQkFBb0IsRUFDdEQsYUFBYSxrQ0FDZixDQUFDO0NBRUQsa0JBQWtCLE9BQU8sT0FBTyx1QkFBdUIsZ0JBQWdCLEVBQ3JFLGFBQWEseUJBQ2YsQ0FBQztDQUVELFlBQVksT0FBTyxPQUFPLHNCQUFzQixlQUFlLEVBQzdELGFBQ0UsZ0dBQ0osQ0FBQztDQUVELFNBQVMsT0FBTyxPQUFPLGFBQWEsT0FBTyxFQUN6QyxhQUFhLGdEQUNmLENBQUM7Q0FFRCxpQkFBMEIsT0FBTyxPQUFPLHNCQUFzQixFQUM1RCxhQUNFLGtGQUNKLENBQUM7Q0FFRCxhQUFhO0VBQ1gsT0FBTztHQUNMLEtBQUssS0FBSztHQUNWLFlBQVksS0FBSztHQUNqQixpQkFBaUIsS0FBSztHQUN0QixXQUFXLEtBQUs7R0FDaEIsUUFBUSxLQUFLO0dBQ2IsZ0JBQWdCLEtBQUs7RUFDdkI7Q0FDRjtBQUNGO0FBd0NBLFNBQWdCLDZCQUE2QixTQUEyQjtDQUN0RSxPQUFPO0VBQ0wsS0FBSyxRQUFRLElBQUk7RUFDakIsaUJBQWlCO0VBQ2pCLFdBQVc7RUFDWCxRQUFRO0VBQ1IsR0FBRztDQUNMO0FBQ0Y7OztBQ3RGQSxNQUFhLGdCQUFnQixj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