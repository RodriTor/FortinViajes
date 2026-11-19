import { loadConfig } from "./config.js";
import { Database } from "./db.js";
import { createApp } from "./app.js";

const config = loadConfig();
const db = new Database(config.databaseUrl, config.isProduction);
const app = createApp(db, config);

const server = app.listen(config.port, () => {
  console.log(`FortínViajes API escuchando en el puerto ${config.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => db.close().finally(() => process.exit(0)));
  });
}
