import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/schema.ts',
    './src/whatsapp-schema.ts',
    './src/telephony-schema.ts',
    './src/automation-schema.ts',
    './src/workforce-schema.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://opentelecrm:***@127.0.0.1:5432/opentelecrm',
  },
  strict: true,
  verbose: true,
});
