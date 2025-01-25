import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { Database } from "./schema";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Initialize pgvector extension
pool.query("CREATE EXTENSION IF NOT EXISTS vector;").catch(console.error);

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
});
