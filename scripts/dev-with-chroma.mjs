import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const chromaUrl = process.env.CHROMA_URL ?? "http://localhost:8000";
const parsedChromaUrl = new URL(chromaUrl);
const chromaHost = process.env.CHROMA_HOST ?? parsedChromaUrl.hostname;
const chromaPort = Number(process.env.CHROMA_PORT ?? (parsedChromaUrl.port || "8000"));
const chromaHealthUrl = new URL("/api/v2/heartbeat", chromaUrl).toString();
const chromaCurlTimeout = Number(process.env.CHROMA_CURL_TIMEOUT ?? "2") * 1000;
const chromaStartupAttempts = Number(process.env.CHROMA_STARTUP_ATTEMPTS ?? "15");

let chromaProcess;
let nextProcess;
let shuttingDown = false;

function npmCommand() {
  return isWindows ? "npm.cmd" : "npm";
}

function localBin(name) {
  return path.join(projectRoot, "node_modules", ".bin", isWindows ? `${name}.cmd` : name);
}

function resolveCommand(command) {
  if (fs.existsSync(command)) return command;

  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const extensions = isWindows
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(entry, `${command}${extension}`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return undefined;
}

function resolveTessdataPrefix() {
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const candidates = [
    process.env.TESSDATA_PREFIX,
    "/usr/local/share/tessdata",
    "/opt/homebrew/share/tessdata",
    "/usr/share/tesseract-ocr/5/tessdata",
    "/usr/share/tesseract-ocr/4.00/tessdata",
    "/usr/share/tessdata",
    programFiles && path.join(programFiles, "Tesseract-OCR", "tessdata"),
    programFilesX86 && path.join(programFilesX86, "Tesseract-OCR", "tessdata"),
  ].filter(Boolean);

  return candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "eng.traineddata")),
  );
}

function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
    ...options,
  });
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args);
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });
}

function assertChromaPort() {
  if (!Number.isInteger(chromaPort) || chromaPort < 1 || chromaPort > 65535) {
    throw new Error(`Invalid Chroma port in CHROMA_URL/CHROMA_PORT: ${chromaPort}`);
  }
}

function portAvailable(host, port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (["EADDRINUSE", "EACCES", "EPERM"].includes(error.code)) {
        resolve(false);
        return;
      }
      if (error.code === "EADDRNOTAVAIL") {
        resolve(true);
        return;
      }
      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen({ host, port, exclusive: true });
  });
}

async function chromaPortAvailable() {
  const hosts =
    chromaHost === "localhost" ? ["localhost", "127.0.0.1", "::1"] : [chromaHost];

  for (const host of hosts) {
    if (!(await portAvailable(host, chromaPort))) return false;
  }

  return true;
}

async function chromaReady() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), chromaCurlTimeout);

  try {
    const response = await fetch(chromaHealthUrl, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForChroma() {
  for (let i = 0; i < chromaStartupAttempts; i += 1) {
    if (await chromaReady()) return true;
    if (chromaProcess?.exitCode !== null) return false;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;

  if (isWindows && child.pid) {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill("SIGTERM");
}

function stopChildren() {
  if (shuttingDown) return;
  shuttingDown = true;
  stopProcess(nextProcess);
  stopProcess(chromaProcess);
}

async function main() {
  assertChromaPort();
  fs.mkdirSync(path.join(projectRoot, "rag", "dataStore"), { recursive: true });

  const tessdataPrefix = resolveTessdataPrefix();
  if (tessdataPrefix && !process.env.TESSDATA_PREFIX) {
    process.env.TESSDATA_PREFIX = tessdataPrefix;
  }

  await runCommand(process.execPath, [path.join(projectRoot, "scripts", "ensure-native-deps.mjs")]);

  if (await chromaReady()) {
    console.log(`Chroma is already running at ${chromaUrl}.`);
  } else {
    if (!(await chromaPortAvailable())) {
      console.warn(
        [
          `Port ${chromaHost}:${chromaPort} is already in use, but Chroma is not ready at ${chromaHealthUrl}.`,
          "Continuing with Next.js; RAG will use local fallback when Chroma is unavailable.",
        ].join("\n"),
      );
    } else {
      const chromaBin = resolveCommand(localBin("chroma")) ?? resolveCommand("chroma");
      if (!chromaBin) {
        console.warn("Chroma CLI was not found. Run npm install to install project dependencies.");
        console.warn("Continuing with Next.js; RAG will use local fallback when Chroma is unavailable.");
      } else {
        chromaProcess = spawnProcess(chromaBin, [
          "run",
          "--path",
          "./rag/dataStore",
          "--host",
          chromaHost,
          "--port",
          String(chromaPort),
        ]);

        const ready = await waitForChroma();
        if (!ready) {
          stopProcess(chromaProcess);
          console.warn(`Chroma did not become ready at ${chromaUrl}. Continuing with Next.js.`);
        }
      }
    }
  }

  nextProcess = spawnProcess(npmCommand(), ["run", "dev:next"]);
  nextProcess.on("exit", (code) => {
    stopProcess(chromaProcess);
    process.exit(code ?? 0);
  });
}

process.on("SIGINT", () => {
  stopChildren();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopChildren();
  process.exit(143);
});
process.on("exit", stopChildren);

main().catch((error) => {
  stopChildren();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
