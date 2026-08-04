import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Module from 'node:module';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit loads schema files through its bundled esbuild-register (CJS
// `require`), which cannot resolve ESM-style relative specifiers like
// `./schema.js` to their `.ts` sources. Patch module resolution so a
// relative `*.js` request whose `.js` file doesn't exist falls back to the
// sibling `.ts` file — only while drizzle-kit runs (this config is loaded
// before the schema files in the same process). Runtime (tsx) and tsc are
// unaffected; both already resolve `./schema.js` → `./schema.ts`.
type ResolveFilename = (
  this: Module,
  request: string,
  parent: Module,
  isMain: boolean,
  options?: { paths?: string[] },
) => string;

const originalResolveFilename: ResolveFilename = Module._resolveFilename.bind(Module);

Module._resolveFilename = function (
  this: Module,
  request: string,
  parent: Module,
  isMain: boolean,
  options?: { paths?: string[] },
): string {
  if (parent && /^\.{1,2}\//.test(request) && request.endsWith('.js')) {
    const jsPath = join(dirname(parent.filename), request);
    if (!existsSync(jsPath)) {
      const tsPath = jsPath.replace(/\.js$/, '.ts');
      if (existsSync(tsPath)) {
        return originalResolveFilename(request, parent, isMain, options);
      }
    }
  }
  return originalResolveFilename(request, parent, isMain, options);
};

export default defineConfig({
  schema: ['./src/schema.ts', './src/whatsapp-schema.ts', './src/telephony-schema.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://opentelecrm:***@127.0.0.1:5432/opentelecrm',
  },
  strict: true,
  verbose: true,
});
