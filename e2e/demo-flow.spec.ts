import { test, expect } from '@playwright/test';

// The critical path a first-time visitor hits: the app signs them in anonymously,
// seeds a personal demo library, loads it, and shows live costing. Selectors use
// roles and proper nouns so the test is locale-independent (DE is the default).
test('a first-time visitor lands on a seeded, costed bar', async ({ page }) => {
  await page.goto('/');

  // Anonymous sign-in + seed + fetch: a seeded ingredient proves the whole chain.
  await expect(page.getByText('Tanqueray London Dry Gin')).toBeVisible();

  // Move to the recipes view via the tab role (label differs per locale).
  await page.getByRole('tab', { name: /rezepte|recipes/i }).click();

  // A seeded classic cocktail is listed...
  await expect(page.getByRole('button', { name: 'Negroni' })).toBeVisible();

  // ...and the profitability summary has computed the book (e.g. "10/10 …").
  await expect(page.getByText(/\d+\/\d+/)).toBeVisible();
});
