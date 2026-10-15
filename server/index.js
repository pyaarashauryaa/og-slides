// Starts the auth server:  npm run server   (reads server/.env, never prints its values)
import { fileURLToPath } from "node:url";
import { loadEnvFile, readConfig } from "./env.js";
import { createApp } from "./app.js";

loadEnvFile(fileURLToPath(new URL("./.env", import.meta.url)));
const { ok, problems, config } = readConfig();
if (!ok) {
  console.error("OGSlides auth server can't start. Fix these settings in server/.env:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
const app = createApp({ config, logger: (e) => console.log(JSON.stringify({ t: new Date().toISOString(), ...e })) });
app.server().listen(config.port, () => {
  console.log(`OGSlides auth server listening on http://localhost:${config.port}`);
  console.log(`Allowed browser origins: ${config.origins.join(", ")}`);
  if (config.demoAccounts) console.warn("WARNING: ALLOW_DEMO_ACCOUNTS=true. Shared demo logins are open. Never use this on a public server.");
});
