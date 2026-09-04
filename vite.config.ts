import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

// Vercel builds run vinext's plain Node output (no Workers runtime), so the
// Cloudflare plugin is skipped there. Locally and on Cloudflare Pages we keep
// emulating Workers via the plugin for production parity.
const useCloudflarePlatform = !process.env.VERCEL;

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

export default defineConfig(async () => {
  const plugins = [vinext(), sites()];

  if (useCloudflarePlatform) {
    // Keep Wrangler and Miniflare state project-local. These are non-secret
    // tool settings; application environment belongs in ignored `.env*` files.
    process.env.WRANGLER_WRITE_LOGS ??= 'false';
    process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
    process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

    // Wrangler snapshots its log path while the Cloudflare plugin is imported.
    const { cloudflare } = await import('@cloudflare/vite-plugin');
    plugins.push(
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    );
  }

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins,
    build: useCloudflarePlatform
      ? undefined
      : {
          // lib/db.ts imports the Workers-only `cloudflare:workers` module for
          // D1 access. Vercel's plain Node build has no such module, so it
          // must stay external rather than fail bundling; the D1-backed
          // routes simply aren't functional in that deployment.
          rolldownOptions: { external: ['cloudflare:workers'] },
        },
  };
});
