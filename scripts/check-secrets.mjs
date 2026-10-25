import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9_]{30,}/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{30,}/,
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /AKIA[A-Z0-9]{16}/,
];
const files = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter((path) => path && existsSync(path));
const matches = [];
for (const path of files) {
  if (path === "scripts/check-secrets.mjs") continue;
  const text = readFileSync(path, "utf8");
  text.split("\n").forEach((line, i) => {
    if (patterns.some((pattern) => pattern.test(line)))
      matches.push(path + ":" + (i + 1));
  });
}
if (matches.length) {
  console.error(
    "Potential credentials (values withheld):\n" + matches.join("\n"),
  );
  process.exitCode = 1;
} else
  console.log(
    "No matches for configured credential patterns. This does not replace GitHub secret scanning.",
  );
