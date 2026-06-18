import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const packageLockPath = path.join(projectRoot, "package-lock.json");
const packageLock = fs.existsSync(packageLockPath)
  ? JSON.parse(fs.readFileSync(packageLockPath, "utf8"))
  : {};
const optionalDependencies = packageJson.optionalDependencies ?? {};

const platform = process.platform;
const arch = process.arch;
const npmCommand = platform === "win32" ? "npm.cmd" : "npm";

const nativePackages = [];

if (platform === "darwin") {
  nativePackages.push(`chromadb-js-bindings-darwin-${arch}`);
  nativePackages.push(`@llamaindex/liteparse-darwin-${arch}`);
} else if (platform === "linux") {
  // For x64 and arm64
  if (arch === "x64" || arch === "arm64") {
    nativePackages.push(`chromadb-js-bindings-linux-${arch}-gnu`);
    nativePackages.push(`@llamaindex/liteparse-linux-${arch}-gnu`);
  } else {
    console.warn(`⚠️  Unsupported Linux architecture: ${arch}`);
  }
} else if (platform === "win32") {
  if (arch === "x64") {
    nativePackages.push("chromadb-js-bindings-win32-x64-msvc");
  } else {
    console.warn(`⚠️  Chroma native bindings are not available for Windows ${arch}.`);
  }

  if (arch === "x64" || arch === "arm64") {
    nativePackages.push(`@llamaindex/liteparse-win32-${arch}-msvc`);
  } else {
    console.warn(`⚠️  Unsupported Windows architecture: ${arch}`);
  }
}

function packageDirectory(packageName) {
  const parts = packageName.startsWith("@")
    ? packageName.split("/")
    : [packageName];
  return path.join(projectRoot, "node_modules", ...parts);
}

function packageInstalled(packageName) {
  try {
    require.resolve(packageName);
    return true;
  } catch {
    try {
      require.resolve(`${packageName}/package.json`);
      return true;
    } catch {
      return fs.existsSync(path.join(packageDirectory(packageName), "package.json"));
    }
  }
}

function packageInstallSpec(packageName) {
  const locked = packageLock.packages?.[`node_modules/${packageName}`]?.version;
  const version = locked ?? optionalDependencies[packageName];
  return version ? `${packageName}@${version}` : packageName;
}

const missing = nativePackages.filter((packageName) => !packageInstalled(packageName));

if (missing.length === 0) {
  process.exit(0);
}

console.log(
  `Missing native packages for ${platform}-${arch}: ${missing.join(", ")}`,
);

if (process.env.AUTO_INSTALL_NATIVE_DEPS !== "1") {
  console.warn(
    "Continuing without auto-installing optional native packages. Run `npm install --include=optional` or set AUTO_INSTALL_NATIVE_DEPS=1 if Chroma/LiteParse native features are required.",
  );
  process.exit(0);
}

console.log("Installing missing native packages because AUTO_INSTALL_NATIVE_DEPS=1.");

const result = spawnSync(
  npmCommand,
  [
    "install",
    "--include=optional",
    "--no-audit",
    "--no-fund",
    "--no-save",
    "--package-lock=false",
    ...missing.map(packageInstallSpec),
  ],
  {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const stillMissing = missing.filter((packageName) => {
  return !packageInstalled(packageName);
});

if (stillMissing.length > 0) {
  console.error(
    `Missing native packages after npm install: ${stillMissing.join(", ")}`,
  );
  process.exit(1);
}
