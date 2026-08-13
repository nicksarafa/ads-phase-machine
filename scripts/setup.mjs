#!/usr/bin/env node
/**
 * Interactive setup. Asks what it needs and writes `.env`.
 *
 * Two rules govern everything here:
 *
 *   1. Never clobber. Existing answers are offered back as the default and an
 *      empty reply keeps them, so re-running this is always safe.
 *   2. Live mode is opt-in, twice. It defaults to off, and turning it on needs
 *      the word LIVE typed in full — because that answer is what decides
 *      whether this software can spend the operator's money.
 *
 * Run with: npm run setup
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env");

/**
 * Created lazily so this module can be imported for testing without opening a
 * terminal interface or exiting the process.
 */
let rl;
function ui() {
  if (!rl) rl = readline.createInterface({ input: stdin, output: stdout });
  return rl;
}

// ------------------------------------------------------------------ output
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const warn = (s) => `\x1b[33m${s}\x1b[0m`;
const good = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

function heading(title, blurb) {
  console.log(`\n${bold(title)}`);
  if (blurb) console.log(dim(blurb));
}

// ------------------------------------------------------------- env parsing
function readEnv() {
  const out = {};
  if (!fs.existsSync(ENV_PATH)) return out;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  }
  return out;
}

/** Show a secret as its shape, never its value. */
function mask(v) {
  if (!v) return "";
  return v.length <= 8 ? "•".repeat(v.length) : `${v.slice(0, 4)}…${"•".repeat(6)} (${v.length} chars)`;
}

// ------------------------------------------------------------------ prompts
async function ask(question, { current = "", secret = false, fallback = "" } = {}) {
  const shown = current ? (secret ? mask(current) : current) : fallback;
  const suffix = shown ? dim(` [${shown}]`) : dim(" [skip]");
  const answer = (await ui().question(`  ${question}${suffix}\n  > `)).trim();
  if (!answer) return current || fallback;
  if (answer === "-") return ""; // explicit clear
  return answer;
}

async function confirm(question, defaultYes = false) {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const a = (await ui().question(`  ${question} ${dim(hint)} `)).trim().toLowerCase();
  if (!a) return defaultYes;
  return a === "y" || a === "yes";
}

// --------------------------------------------------------------------- run
async function main() {
  // Without a terminal, readline's question() never resolves once the input
  // stream ends — the process would exit having written nothing while
  // reporting success. Fail loudly instead of appearing to work.
  if (!stdin.isTTY) {
    console.error(
      "npm run setup needs an interactive terminal.\n" +
        "In CI or a script, copy .env.example to .env and set the values directly.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(bold("\nAds Phase Machine — setup"));
  console.log(
    dim(
      "Writes .env, which is gitignored and stays on this machine.\n" +
        "Press Enter to keep the value in brackets. Type - to clear one.\n" +
        "Keys you paste are echoed by your terminal — run this somewhere private.",
    ),
  );

  const env = readEnv();
  const had = Object.keys(env).length > 0;
  if (had) console.log(dim(`\nFound an existing .env with ${Object.keys(env).length} values. Nothing is overwritten unless you change it.`));

  // ---------------------------------------------------------- copy + images
  heading(
    "1. Writing the ad copy",
    "Optional. Without a key it falls back to your local `claude` CLI, and\n" +
      "without that to an offline composer. Both work; the key is just faster.",
  );
  env.ANTHROPIC_API_KEY = await ask("Anthropic API key (starts sk-ant-)", {
    current: env.ANTHROPIC_API_KEY,
    secret: true,
  });

  heading(
    "2. Rendering the ad images",
    "Optional. Without a key every ad still gets procedural artwork, instantly\n" +
      "and locally. With one, images cost money per render — see ADS_IMAGE_* below.",
  );
  env.GEMINI_API_KEY = await ask("Google Gemini API key", {
    current: env.GEMINI_API_KEY,
    secret: true,
  });
  if (env.GEMINI_API_KEY) {
    env.GEMINI_IMAGE_MODEL = await ask("Image model", {
      current: env.GEMINI_IMAGE_MODEL,
      fallback: "gemini-3-pro-image",
    });
  }

  // ------------------------------------------------------------- live mode
  heading(
    "3. Placing real ads",
    "This is the part that spends money. Leave it off to run the simulator,\n" +
      "which contacts no ad account and cannot spend a cent.",
  );

  const alreadyLive = ["1", "true", "yes"].includes(String(env.ADS_LIVE || "").toLowerCase());
  console.log(dim(`  Currently: ${alreadyLive ? warn("LIVE — can place real ads") : good("simulation only")}`));

  const wantsLive = await confirm("Set up live placement on a real Meta ad account?", alreadyLive);

  if (!wantsLive) {
    env.ADS_LIVE = "";
    console.log(good("\n  Live mode left off. The machine will simulate delivery."));
  } else {
    console.log(
      warn(
        "\n  Live mode lets this software create ads on a real account.\n" +
          "  Ads are always created PAUSED — nothing spends until you activate\n" +
          "  them by hand in Meta Ads Manager. A hard daily cap applies on top.",
      ),
    );
    const typed = (await ui().question(`  Type ${bold("LIVE")} to enable, or anything else to skip: `)).trim();
    if (typed !== "LIVE") {
      env.ADS_LIVE = "";
      console.log(good("  Skipped. Live mode stays off."));
    } else {
      env.ADS_LIVE = "1";

      console.log(
        dim(
          "\n  Placement goes through the facebook-ads MCP driven by your local\n" +
            "  `claude` CLI, so there is no Meta token to paste. Connect it once with:\n" +
            "    claude mcp add --transport http facebook-ads https://mcp.facebook.com/ads",
        ),
      );

      heading("   Account");
      env.ADS_META_AD_ACCOUNT_ID = await ask("Meta ad account id (digits only, no act_ prefix)", {
        current: env.ADS_META_AD_ACCOUNT_ID,
      });
      env.ADS_META_PAGE_ID = await ask("Facebook Page id the ads post as", {
        current: env.ADS_META_PAGE_ID,
      });

      heading("   Where the clicks go", "One destination per campaign. Both must be real, reachable URLs.");
      env.ADS_LANDING_URL_WORKSHOPS = await ask("Workshops destination URL", {
        current: env.ADS_LANDING_URL_WORKSHOPS || env.ADS_LANDING_URL,
      });
      env.ADS_LANDING_URL_TEAMS = await ask("Team training destination URL", {
        current: env.ADS_LANDING_URL_TEAMS,
      });
      env.ADS_LANDING_URL = env.ADS_LANDING_URL_WORKSHOPS || env.ADS_LANDING_URL;

      heading(
        "   Targeting",
        "A custom-location pin rather than a city key, so any coordinate works.",
      );
      env.ADS_GEO_CITY = await ask("City label", { current: env.ADS_GEO_CITY, fallback: "Lisbon" });
      env.ADS_GEO_COUNTRY = (
        await ask("Country code", { current: env.ADS_GEO_COUNTRY, fallback: "PT" })
      ).toUpperCase();
      env.ADS_GEO_LAT = await ask("Latitude", { current: env.ADS_GEO_LAT, fallback: "38.7223" });
      env.ADS_GEO_LNG = await ask("Longitude", { current: env.ADS_GEO_LNG, fallback: "-9.1393" });
      env.ADS_GEO_RADIUS_KM = await ask("Radius in km", {
        current: env.ADS_GEO_RADIUS_KM,
        fallback: "40",
      });

      heading(
        "   The spending cap",
        "A ceiling this process refuses to cross, across ALL campaigns combined,\n" +
          "whatever the dashboard or a saved state file asks for.",
      );
      let cap = await ask("Maximum total spend per day, in dollars", {
        current: env.ADS_LIVE_MAX_DAILY_USD,
        fallback: "10",
      });
      if (!(Number(cap) > 0)) {
        console.log(warn("  Not a positive number — using 10."));
        cap = "10";
      }
      env.ADS_LIVE_MAX_DAILY_USD = cap;

      env.ADS_LIVE_POLL_MINUTES = await ask(
        "Minutes between reads of Meta (each read is a billable model call)",
        { current: env.ADS_LIVE_POLL_MINUTES, fallback: "30" },
      );

      // What was actually agreed to, said back plainly before it is written.
      console.log(bold("\n  About to enable live placement:"));
      console.log(`    ad account   ${env.ADS_META_AD_ACCOUNT_ID || red("MISSING")}`);
      console.log(`    page         ${env.ADS_META_PAGE_ID || red("MISSING")}`);
      console.log(`    workshops →  ${env.ADS_LANDING_URL_WORKSHOPS || red("MISSING")}`);
      console.log(`    teams     →  ${env.ADS_LANDING_URL_TEAMS || red("MISSING")}`);
      console.log(`    targeting    ${env.ADS_GEO_CITY} ${env.ADS_GEO_RADIUS_KM}km · ${env.ADS_GEO_COUNTRY}`);
      console.log(`    hard cap     ${warn(`$${env.ADS_LIVE_MAX_DAILY_USD}/day total`)}`);
      console.log(`    ads created  ${good("PAUSED — you activate them by hand")}`);

      if (!(await confirm("\n  Write this?", false))) {
        env.ADS_LIVE = "";
        console.log(good("  Not enabled. Live mode stays off; other settings still saved."));
      }
    }
  }

  // ------------------------------------------------------------------ write
  const missing = [];
  if (env.ADS_LIVE) {
    for (const k of [
      "ADS_META_AD_ACCOUNT_ID",
      "ADS_META_PAGE_ID",
      "ADS_LANDING_URL_WORKSHOPS",
      "ADS_LANDING_URL_TEAMS",
    ]) {
      if (!env[k]) missing.push(k);
    }
  }

  writeEnv(env);
  console.log(good(`\n✓ Wrote ${path.relative(ROOT, ENV_PATH)}`));

  if (missing.length) {
    console.log(
      warn(
        `\n! Live mode is on but ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} empty.\n` +
          "  The dashboard will refuse to place ads until you fill them in.",
      ),
    );
  }

  // ------------------------------------------------------------ commit guard
  heading(
    "4. Keeping your details out of git",
    "This repo is public. The guard blocks any commit containing a credential\n" +
      "or a value from your own .env — your ad account id, page id, URLs.",
  );
  const hookPath = path.join(ROOT, ".git", "hooks", "pre-commit");
  if (fs.existsSync(hookPath)) {
    console.log(good("  Already installed."));
  } else if (await confirm("Install the pre-commit guard?", true)) {
    try {
      fs.mkdirSync(path.dirname(hookPath), { recursive: true });
      fs.writeFileSync(hookPath, "#!/usr/bin/env bash\nexec bash scripts/check-secrets.sh\n");
      fs.chmodSync(hookPath, 0o755);
      console.log(good("  Installed."));
    } catch (e) {
      console.log(warn(`  Could not install it: ${e.message}`));
      console.log(dim("  Run: bash scripts/check-secrets.sh --install"));
    }
  }

  console.log(bold("\nDone.\n"));
  console.log("  npm run dev        " + dim("→ http://localhost:3737"));
  console.log(
    env.ADS_LIVE
      ? warn("  Live mode is ARMED. Arm the toggle in the dashboard too before it places anything.\n")
      : dim("  Running in simulation. Re-run npm run setup to go live.\n"),
  );
}

/**
 * Rewrite .env, preserving comments and key order for keys already present and
 * appending anything new. Values we were given as empty are written as empty
 * rather than dropped, so "off" is explicit in the file.
 */
function writeEnv(env) {
  const seen = new Set();
  const lines = [];

  if (fs.existsSync(ENV_PATH)) {
    for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
      const s = line.trim();
      if (!s || s.startsWith("#") || !s.includes("=")) {
        lines.push(line);
        continue;
      }
      const key = s.slice(0, s.indexOf("=")).trim();
      if (key in env) {
        lines.push(`${key}=${env[key]}`);
        seen.add(key);
      } else {
        lines.push(line);
      }
    }
  } else {
    lines.push("# Local secrets. This file is gitignored — never commit it.");
  }

  const added = Object.keys(env).filter((k) => !seen.has(k));
  if (added.length) {
    lines.push("", "# Added by npm run setup");
    for (const k of added) lines.push(`${k}=${env[k]}`);
  }

  const tmp = `${ENV_PATH}.tmp`;
  fs.writeFileSync(tmp, lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n", { mode: 0o600 });
  fs.renameSync(tmp, ENV_PATH);
}

// Exported so the file-rewriting logic — the part that can destroy an
// operator's existing configuration — is testable without a terminal.
export { readEnv, writeEnv, mask };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main()
    .catch((e) => {
      console.error(red(`\nSetup failed: ${e.message}`));
      process.exitCode = 1;
    })
    .finally(() => rl?.close());
}
