import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.EVAL_BASE_URL || "http://localhost:3001";
const botId = process.env.BOT_ID;
const evalFile = process.env.EVAL_FILE || "evaluation/sample-eval-set.json";
const outputDir = process.env.EVAL_OUTPUT_DIR || "evaluation/reports";

if (!botId) {
  console.error("BOT_ID is required.");
  process.exit(1);
}

const evalSet = JSON.parse(
  await fs.readFile(new URL(`../${evalFile}`, import.meta.url), "utf8"),
);

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function includesAll(haystack, needles) {
  const lowered = haystack.toLowerCase();
  return needles.every((needle) => lowered.includes(String(needle).toLowerCase()));
}

function includesNone(haystack, needles) {
  const lowered = haystack.toLowerCase();
  return needles.every((needle) => !lowered.includes(String(needle).toLowerCase()));
}

const results = [];
let health = null;

try {
  const healthResponse = await fetch(`${baseUrl}/health`);
  health = await healthResponse.json();
} catch {
  health = { status: "unavailable" };
}

for (const item of evalSet) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ botId, message: item.question }),
  });
  const latencyMs = Math.round(performance.now() - startedAt);
  const payload = await response.json();
  const reply = String(payload.reply || payload.error || "");
  const citations = Array.isArray(payload.citations) ? payload.citations : [];
  const citationFiles = citations.map((citation) => citation.fileName);

  const citationAccurate =
    includesAll(citationFiles.join(" "), item.requiredCitations || []);
  const grounded =
    includesAll(reply, item.requiredAnswerFragments || []) &&
    includesNone(reply, item.forbiddenFragments || []) &&
    citations.length > 0;

  results.push({
    question: item.question,
    status: response.status,
    reply,
    citations: citations,
    latencyMs,
    citationAccurate,
    grounded,
  });
}

const latencies = results.map((result) => result.latencyMs);
const summary = {
  generatedAt: new Date().toISOString(),
  botId,
  baseUrl,
  health,
  totalQuestions: results.length,
  groundedness: Number(
    ((results.filter((result) => result.grounded).length / results.length) * 100).toFixed(1),
  ),
  citationAccuracy: Number(
    ((results.filter((result) => result.citationAccurate).length / results.length) * 100).toFixed(1),
  ),
  latency: {
    averageMs: Math.round(latencies.reduce((sum, value) => sum + value, 0) / Math.max(1, latencies.length)),
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
  },
};

const report = { summary, results };

function renderMarkdownReport(data) {
  const lines = [];
  lines.push("# Evaluation Report");
  lines.push("");
  lines.push(`- Generated at: ${data.summary.generatedAt}`);
  lines.push(`- Bot ID: ${data.summary.botId}`);
  lines.push(`- Base URL: ${data.summary.baseUrl}`);
  lines.push(`- Health: ${JSON.stringify(data.summary.health)}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total questions: ${data.summary.totalQuestions}`);
  lines.push(`- Groundedness: ${data.summary.groundedness}%`);
  lines.push(`- Citation accuracy: ${data.summary.citationAccuracy}%`);
  lines.push(`- Average latency: ${data.summary.latency.averageMs} ms`);
  lines.push(`- P50 latency: ${data.summary.latency.p50Ms} ms`);
  lines.push(`- P95 latency: ${data.summary.latency.p95Ms} ms`);
  lines.push("");
  lines.push("## Per-question Results");
  lines.push("");

  data.results.forEach((result, index) => {
    lines.push(`### ${index + 1}. ${result.question}`);
    lines.push("");
    lines.push(`- HTTP status: ${result.status}`);
    lines.push(`- Grounded: ${result.grounded ? "yes" : "no"}`);
    lines.push(`- Citation accurate: ${result.citationAccurate ? "yes" : "no"}`);
    lines.push(`- Latency: ${result.latencyMs} ms`);
    lines.push(`- Reply: ${result.reply}`);
    lines.push("- Citations:");
    if (result.citations.length === 0) {
      lines.push("  - none");
    } else {
      result.citations.forEach((citation) => {
        lines.push(`  - ${citation.fileName}: ${citation.snippet}`);
      });
    }
    lines.push("");
  });

  return lines.join("\n");
}

const reportDirUrl = new URL(`../${outputDir}/`, import.meta.url);
await fs.mkdir(reportDirUrl, { recursive: true });

const jsonPath = new URL(`report-${timestamp}.json`, reportDirUrl);
const mdPath = new URL(`report-${timestamp}.md`, reportDirUrl);

await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
await fs.writeFile(mdPath, renderMarkdownReport(report));

console.log(JSON.stringify(report, null, 2));
console.error(
  `Saved evaluation reports to ${path.relative(process.cwd(), jsonPath.pathname)} and ${path.relative(process.cwd(), mdPath.pathname)}`,
);
