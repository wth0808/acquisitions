import "dotenv/config";

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "#models/user.model.js";

// if (process.env.NODE_ENV === "development") {
//   neonConfig.fetchEndpoint = "http://neon-local:5432/sql";
//   neonConfig.useSecureWebSocket = false;
//   neonConfig.poolQueryViaFetch = true;
// }

const sql = neon(process.env.DATABASE_URL);

const db = drizzle(sql, { schema });

export { db, sql };
