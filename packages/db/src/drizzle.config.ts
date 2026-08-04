import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './schema.ts',
  out: '../drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://opentelecrm:CHANGE_ME@127.0.0.1:5432/opentelecrm',
  },
  strict: true,
  verbose: true,
});
