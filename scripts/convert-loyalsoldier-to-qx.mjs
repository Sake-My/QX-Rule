import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULESET_DIR = path.join(ROOT, "ruleset");
const SKIPPED_DIR = path.join(RULESET_DIR, "_skipped");
const REPO_RAW_BASE = process.env.QX_RAW_BASE_URL || "https://raw.githubusercontent.com/Sake-My/QX-Rule/release";
const ALL_IN_ONE_OUTPUT = "loyalsoldier-qx.list";

const SOURCE_BASES = [
  "https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release",
  "https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release",
  "https://fastly.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release",
];

const POLICIES = {
  proxy: process.env.QX_PROXY_POLICY || "proxy",
  direct: process.env.QX_DIRECT_POLICY || "direct",
  reject: process.env.QX_REJECT_POLICY || "reject",
};

const SOURCES = [
  {
    name: "reject",
    source: "reject-list.txt",
    output: "reject.list",
    policy: "reject",
    description: "geosite:category-ads-all",
  },
  {
    name: "reject-tld",
    source: "reject-tld-list.txt",
    output: "reject-tld.list",
    policy: "reject",
    description: "reject TLD list",
  },
  {
    name: "apple-cn",
    source: "apple-cn.txt",
    output: "apple-cn.list",
    policy: "direct",
    description: "geosite:apple-cn",
  },
  {
    name: "google-cn",
    source: "google-cn.txt",
    output: "google-cn.list",
    policy: "direct",
    description: "geosite:google-cn",
  },
  {
    name: "direct-tld",
    source: "direct-tld-list.txt",
    output: "direct-tld.list",
    policy: "direct",
    description: "geosite:tld-cn and related direct TLDs",
  },
  {
    name: "proxy",
    source: "proxy-list.txt",
    output: "proxy.list",
    policy: "proxy",
    description: "geosite:geolocation-!cn",
  },
  {
    name: "proxy-tld",
    source: "proxy-tld-list.txt",
    output: "proxy-tld.list",
    policy: "proxy",
    description: "proxy TLD list",
  },
  {
    name: "direct",
    source: "direct-list.txt",
    output: "direct.list",
    policy: "direct",
    description: "geosite:cn",
  },
  {
    name: "china-list",
    source: "china-list.txt",
    output: "china-list.list",
    policy: "direct",
    description: "felixonmars accelerated domains in China",
  },
  {
    name: "gfw",
    source: "gfw.txt",
    output: "gfw.list",
    policy: "proxy",
    description: "geosite:gfw",
  },
  {
    name: "win-spy",
    source: "win-spy.txt",
    output: "win-spy.list",
    policy: "reject",
    description: "Windows spy domains",
  },
  {
    name: "win-update",
    source: "win-update.txt",
    output: "win-update.list",
    policy: "reject",
    description: "Windows update domains",
  },
  {
    name: "win-extra",
    source: "win-extra.txt",
    output: "win-extra.list",
    policy: "reject",
    description: "Windows extra tracking domains",
  },
];

const ALL_IN_ONE_ORDER = [
  "reject",
  "reject-tld",
  "apple-cn",
  "google-cn",
  "direct-tld",
  "proxy",
  "proxy-tld",
  "direct",
];

const BUILT_IN_DIRECT_RULES = [
  "host-suffix, local, direct",
  "ip-cidr, 10.0.0.0/8, direct, no-resolve",
  "ip-cidr, 127.0.0.0/8, direct, no-resolve",
  "ip-cidr, 172.16.0.0/12, direct, no-resolve",
  "ip-cidr, 192.168.0.0/16, direct, no-resolve",
  "ip-cidr, 224.0.0.0/24, direct, no-resolve",
  "ip6-cidr, fc00::/7, direct, no-resolve",
  "ip6-cidr, fe80::/10, direct, no-resolve",
];

async function main() {
  await mkdir(RULESET_DIR, { recursive: true });
  await mkdir(SKIPPED_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();
  const convertedByName = new Map();
  const manifest = {
    generatedAt,
    upstream: "https://github.com/Loyalsoldier/v2ray-rules-dat/tree/release",
    policies: POLICIES,
    primaryRuleResource: `${REPO_RAW_BASE}/ruleset/${ALL_IN_ONE_OUTPUT}`,
    files: [],
  };

  for (const source of SOURCES) {
    const text = await fetchTextWithFallback(source.source);
    const result = convertToQuantumultX(text, POLICIES[source.policy]);
    convertedByName.set(source.name, result);
    const outputPath = path.join(RULESET_DIR, source.output);
    const header = buildHeader({
      title: "Quantumult X rules",
      generatedAt,
      source: `Loyalsoldier/v2ray-rules-dat release/${source.source}`,
      description: source.description,
      policy: POLICIES[source.policy],
    });

    await writeFile(outputPath, header + result.rules.join("\n") + "\n", "utf8");
    await writeFile(
      path.join(SKIPPED_DIR, `${source.name}.skipped.txt`),
      buildSkippedFile(source, generatedAt, result.skippedLines),
      "utf8",
    );
    manifest.files.push({
      name: source.name,
      source: source.source,
      output: `ruleset/${source.output}`,
      policy: POLICIES[source.policy],
      rules: result.rules.length,
      skipped: result.skippedLines.length,
    });
  }

  const allInOne = buildAllInOneRules(generatedAt, convertedByName);
  await writeFile(path.join(RULESET_DIR, ALL_IN_ONE_OUTPUT), allInOne.content, "utf8");
  manifest.files.unshift({
    name: "loyalsoldier-qx",
    source: "combined",
    output: `ruleset/${ALL_IN_ONE_OUTPUT}`,
    policy: "mixed",
    rules: allInOne.ruleCount,
    skipped: manifest.files.reduce((sum, file) => sum + file.skipped, 0),
  });

  await writeFile(
    path.join(RULESET_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );

  await writeFile(
    path.join(RULESET_DIR, "qx-filter-remote.conf.template"),
    buildQuantumultXTemplate(),
    "utf8",
  );

  for (const file of manifest.files) {
    console.log(`${file.output}: ${file.rules} rules, ${file.skipped} skipped`);
  }
}

async function fetchTextWithFallback(file) {
  let lastError;

  for (const base of SOURCE_BASES) {
    const url = `${base}/${file}`;

    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "loyalsoldier-qx-converter",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      console.warn(`Failed to fetch ${url}: ${error.message}`);
    }
  }

  throw new Error(`Unable to fetch ${file}: ${lastError?.message || "unknown error"}`);
}

function convertToQuantumultX(text, policy) {
  const rules = [];
  const skippedLines = [];
  const seen = new Set();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizeLine(rawLine);
    if (!line) {
      continue;
    }

    const converted = convertLine(line, policy);
    if (!converted) {
      skippedLines.push(line);
      continue;
    }

    if (!seen.has(converted)) {
      seen.add(converted);
      rules.push(converted);
    }
  }

  return { rules, skippedLines };
}

function normalizeLine(rawLine) {
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";") || trimmed.startsWith("//")) {
    return "";
  }

  return trimmed
    .replace(/\s+#.*$/, "")
    .replace(/\s+\/\/.*$/, "")
    .split(/\s+/)[0]
    .trim();
}

function convertLine(line, policy) {
  const lower = line.toLowerCase();

  if (lower.startsWith("regexp:") || lower.startsWith("include:") || lower.startsWith("geosite:")) {
    return "";
  }

  if (lower.startsWith("full:")) {
    const host = cleanHost(line.slice(5));
    return host ? `host, ${host}, ${policy}` : "";
  }

  if (lower.startsWith("domain:")) {
    const host = cleanHost(line.slice(7));
    return host ? `host-suffix, ${host}, ${policy}` : "";
  }

  if (lower.startsWith("keyword:")) {
    const keyword = line.slice(8).trim();
    return keyword ? `host-keyword, ${keyword}, ${policy}` : "";
  }

  if (line.includes("*") || line.includes("?")) {
    return `host-wildcard, ${line}, ${policy}`;
  }

  if (isIpv4Cidr(line)) {
    return `ip-cidr, ${line}, ${policy}, no-resolve`;
  }

  if (isIpv6Cidr(line)) {
    return `ip6-cidr, ${line}, ${policy}, no-resolve`;
  }

  const host = cleanHost(line);
  return host ? `host-suffix, ${host}, ${policy}` : "";
}

function cleanHost(value) {
  return value
    .trim()
    .replace(/^\|\|/, "")
    .replace(/^\*\./, "")
    .replace(/^\./, "")
    .replace(/\^$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

function isIpv4Cidr(value) {
  return /^(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(value);
}

function isIpv6Cidr(value) {
  return /^[0-9a-f:]+\/\d{1,3}$/i.test(value) && value.includes(":");
}

function buildHeader({ title, generatedAt, source, description, policy }) {
  const lines = [`# ${title}`, `# Generated at: ${generatedAt}`];

  if (source) {
    lines.push(`# Source: ${source}`);
  }

  if (description) {
    lines.push(`# Description: ${description}`);
  }

  if (policy) {
    lines.push(`# Policy: ${policy}`);
  }

  lines.push("");
  return lines.join("\n");
}

function buildAllInOneRules(generatedAt, convertedByName) {
  const lines = [];
  const seen = new Set();

  lines.push(
    buildHeader({
      title: "Loyalsoldier all-in-one Quantumult X rule resource",
      generatedAt,
      source: "https://github.com/Loyalsoldier/v2ray-rules-dat/tree/release",
      description: "Add this file as one Quantumult X filter/rule resource.",
    }).trimEnd(),
  );

  appendSection(lines, "LAN and private addresses", BUILT_IN_DIRECT_RULES, seen);

  for (const name of ALL_IN_ONE_ORDER) {
    const source = SOURCES.find((item) => item.name === name);
    const result = convertedByName.get(name);
    appendSection(lines, source.description, result?.rules || [], seen);
  }

  appendSection(
    lines,
    "China IP and final fallback",
    [`geoip, cn, ${POLICIES.direct}`, `final, ${POLICIES.proxy}`],
    seen,
  );

  return {
    content: lines.join("\n") + "\n",
    ruleCount: seen.size,
  };
}

function appendSection(lines, title, rules, seen) {
  lines.push("", `# ${title}`);

  for (const rule of rules) {
    if (!seen.has(rule)) {
      seen.add(rule);
      lines.push(rule);
    }
  }
}

function buildQuantumultXTemplate() {
  return [
    "# Add this single URL as a Quantumult X filter/rule resource.",
    "# It already includes rule policies and final fallback.",
    "",
    "[filter_remote]",
    `${REPO_RAW_BASE}/ruleset/${ALL_IN_ONE_OUTPUT}, tag=Loyalsoldier QX, update-interval=86400, opt-parser=false, enabled=true`,
    "",
  ].join("\n");
}

function buildSkippedFile(source, generatedAt, skippedLines) {
  const lines = [
    "# Lines that could not be converted to Quantumult X filter rules.",
    `# Source: Loyalsoldier/v2ray-rules-dat release/${source.source}`,
    `# Generated at: ${generatedAt}`,
    "",
  ];

  lines.push(...skippedLines);
  return lines.join("\n") + "\n";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
