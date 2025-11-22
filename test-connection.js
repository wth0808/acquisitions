// test-db-connection.js
import "dotenv/config"; // Loads variables from .env file

import { neon } from "@neondatabase/serverless";

async function testConnection() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not set.");
    return;
  }

  // Initialize the Neon serverless client
  const sql = neon(dbUrl);

  console.log("Attempting to connect to the database...");

  try {
    // Execute a simple query that returns the PostgreSQL version
    const result = await sql`SELECT version();`;

    console.log("✅ Connection Successful!");
    console.log("Database Version:", result[0].version);
  } catch (error) {
    console.error("\n❌ CONNECTION FAILED!");
    console.error("--- Detailed Error ---");
    console.error("Error connecting to database:", error.message);

    if (error.cause && error.cause.message.includes("fetch failed")) {
      console.error(
        "\n🔑 Likely Cause: 'fetch failed' suggests a **network issue**, **incorrect URL format**, or **DNS/Firewall block**."
      );
    }
  } finally {
    // Since the serverless driver is HTTP-based, no explicit client.end() is required.
  }
}

testConnection();
