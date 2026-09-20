/**
 * Screenshots every listed screen at desktop 1440 and mobile 390, in light and
 * dark, into docs/screenshots/. The UI rule is that no screen is "done" until
 * all four exist for it.
 *
 *   node ai/scripts/screenshots.mjs [baseUrl]
 *
 * Routes are declared below. `auth: true` routes sign in with the seeded
 * reviewer account first, using SEED_USER_EMAIL / SEED_USER_PASSWORD.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000';
const OUT = 'docs/screenshots';

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
];
const THEMES = ['light', 'dark'];

/**
 * Routes are resolved at run time, because the editor and report URLs contain
 * the seeded template's id.
 *
 * @type {{ name: string, path: string | ((ctx: { templateId: string }) => string), auth?: boolean, waitFor?: string }[]}
 */
const ROUTES = [
  { name: 'login', path: '/login' },
  { name: 'templates', path: '/templates', auth: true, waitFor: 'text=InterNACHI' },
  { name: 'import', path: '/import', auth: true },
  {
    name: 'editor',
    path: ({ templateId }) => `/templates/${templateId}`,
    auth: true,
    waitFor: 'input[aria-label^="Section name"]',
    // The editor scrolls inside its own panels; a full-page shot would be
    // one enormous strip of tree rather than the screen as it is used.
    fullPage: false,
  },
  {
    name: 'import-report',
    path: ({ templateId }) => `/templates/${templateId}/report`,
    auth: true,
    waitFor: 'text=Import report',
  },
];

async function signIn(page) {
  const email = process.env.SEED_REVIEWER_1_EMAIL;
  const password = process.env.SEED_REVIEWER_1_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set SEED_REVIEWER_1_EMAIL and SEED_REVIEWER_1_PASSWORD to shoot authenticated routes.',
    );
  }
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/templates/, { timeout: 15_000 });
}

/** Reads the seeded template's id straight off the list screen. */
async function findSampleTemplateId(page) {
  await page.waitForSelector('a[href^="/templates/"]', { timeout: 20_000 });
  const href = await page
    .locator('a[href^="/templates/"]')
    .first()
    .getAttribute('href');
  const id = (href ?? '').split('/').pop() ?? '';
  if (!id) throw new Error('Could not find a seeded template to screenshot.');
  return id;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  let shot = 0;

  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme,
        deviceScaleFactor: 2,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      let signedIn = false;
      let templateId = '';

      for (const route of ROUTES) {
        if (route.auth && !signedIn) {
          await signIn(page);
          signedIn = true;
          templateId = await findSampleTemplateId(page);
        }
        const path = typeof route.path === 'function' ? route.path({ templateId }) : route.path;
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
        if (route.waitFor) await page.waitForSelector(route.waitFor, { timeout: 15_000 });
        const file = `${OUT}/${route.name}--${viewport.name}--${theme}.png`;
        await page.screenshot({ path: file, fullPage: route.fullPage !== false });
        console.log(`wrote ${file}`);
        shot += 1;
      }

      await context.close();
    }
  }

  await browser.close();
  console.log(`\n${shot} screenshots across ${ROUTES.length} routes.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
