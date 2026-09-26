import { type Page, expect, test } from '@playwright/test';

/**
 * The money path, end to end, with two real browser sessions:
 * guest browses and customises a dish -> registers (guest cart merges) -> applies a coupon ->
 * checks out with a new address (COD) -> the partner moves the order through the kitchen ->
 * the customer's tracking page updates live over Socket.IO -> the customer rates the order.
 * Requires the seeded demo data (`npm run seed -- --reset`).
 */

const RESTAURANT = { slug: 'handi-hustle', name: 'Handi & Hustle' };
const PARTNER = { email: 'partner@novafood.dev', password: 'NovaDemo@123' };

async function waitForApi(page: Page, pathPart: string, method = 'GET') {
  return page.waitForResponse((r) => r.url().includes(pathPart) && r.request().method() === method && r.ok());
}

test('guest to delivered order, with live tracking and a review', async ({ browser }) => {
  const customerCtx = await browser.newContext();
  const page = await customerCtx.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  /* ----------------------------- Browse and search ---------------------------- */
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goto('/search?q=biryani');
  await expect(page.getByRole('link', { name: 'Hyderabadi Chicken Dum Biryani' }).first()).toBeVisible();

  await page.goto(`/r/${RESTAURANT.slug}`);
  await expect(page.getByRole('heading', { name: RESTAURANT.name, level: 1 })).toBeVisible();

  /* ------------------ Customise a dish and add it as a guest ------------------ */
  const biryani = page.locator('article').filter({ has: page.getByRole('link', { name: 'Hyderabadi Chicken Dum Biryani', exact: true }) });
  await biryani.getByRole('button', { name: /^ADD/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByText('Full', { exact: false }).first().click();
  await dialog.getByText('Raita').click();
  await dialog.getByRole('button', { name: /Add item/ }).click();
  await expect(dialog).toBeHidden();

  const naan = page.locator('article').filter({ has: page.getByRole('link', { name: 'Butter Naan', exact: true }) });
  await naan.getByRole('button', { name: /^ADD/ }).click();

  await page.goto('/cart');
  await expect(page.getByText('Hyderabadi Chicken Dum Biryani')).toBeVisible();
  await expect(page.getByText('Butter Naan')).toBeVisible();

  /* ------------------- Register; the guest cart must survive ------------------ */
  const email = `e2e.${Date.now()}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Name').fill('Playwright Diner');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Phone (optional)').fill('9812345678');
  await page.getByLabel('Password').fill('Tasty@2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).not.toHaveURL(/register/);

  await page.goto('/cart');
  await expect(page.getByText('Hyderabadi Chicken Dum Biryani')).toBeVisible();
  await expect(page.getByText('Raita')).toBeVisible();

  /* ------------------------------ Apply a coupon ------------------------------ */
  await page.getByLabel('Coupon code').fill('NOVA50');
  const applied = waitForApi(page, '/api/cart/coupon', 'POST');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await applied;
  await expect(page.getByRole('button', { name: 'Remove coupon' })).toBeVisible();

  /* -------------------- Checkout with a new address, COD ---------------------- */
  await page.getByRole('link', { name: /Proceed to checkout/ }).or(page.getByRole('button', { name: /Proceed to checkout/ })).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

  const addressDialog = page.getByRole('dialog');
  if (!(await addressDialog.isVisible())) await page.getByRole('button', { name: 'Add new' }).click();
  await addressDialog.getByLabel('House / flat, building and street').fill('42, Test Towers, 80 Feet Road');
  await addressDialog.getByLabel('City').fill('Bengaluru');
  await addressDialog.getByLabel('State').fill('Karnataka');
  await addressDialog.getByLabel('PIN code').fill('560095');
  await addressDialog.getByRole('button', { name: 'Save address' }).click();
  await expect(addressDialog).toBeHidden();

  await page.getByText('Cash on delivery').click();
  const placed = waitForApi(page, '/api/orders', 'POST');
  await page.getByRole('button', { name: /Place order/ }).click();
  const order = (await (await placed).json()).data.order as { _id: string; orderNumber: string; status: string };
  expect(order.status).toBe('ORDER_PLACED');

  await expect(page).toHaveURL(new RegExp(`/orders/${order._id}`));
  await expect(page.getByText('Live updates on')).toBeVisible();

  /* ------------------ Partner runs the order through the kitchen -------------- */
  const partnerCtx = await browser.newContext();
  const partner = await partnerCtx.newPage();
  await partner.goto('/login');
  await partner.getByLabel('Email').fill(PARTNER.email);
  await partner.getByLabel('Password').fill(PARTNER.password);
  await partner.getByRole('button', { name: 'Log in' }).click();
  await expect(partner).not.toHaveURL(/login/);
  await partner.goto('/partner/orders');
  // The demo partner runs two kitchens; the board shows one at a time.
  await partner.getByLabel('Choose restaurant').selectOption({ label: RESTAURANT.name });

  const card = partner.locator('div').filter({ hasText: order.orderNumber }).filter({ has: partner.getByRole('button', { name: 'Accept' }) }).last();
  await expect(card).toBeVisible();

  const steps: [string, RegExp][] = [
    ['Accept', /accepted/i],
    ['Start preparing', /preparing|cooking/i],
    ['Mark ready', /ready/i],
    ['Hand to rider', /out for delivery|on the way/i],
    ['Mark delivered', /delivered/i],
  ];
  for (const [action, customerSees] of steps) {
    const orderCard = partner.locator('div').filter({ hasText: order.orderNumber }).filter({ has: partner.getByRole('button', { name: action }) }).last();
    const moved = waitForApi(partner, `/orders/${order._id}/status`, 'POST');
    await orderCard.getByRole('button', { name: action }).click();
    await moved;
    // No reload: the customer's page must change through the realtime channel.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(customerSees, { timeout: 15_000 });
  }

  /* ------------------------------- Rate the order ----------------------------- */
  await page.getByRole('button', { name: 'Rate this order' }).click();
  const review = page.getByRole('dialog');
  await review.getByRole('radiogroup', { name: 'Overall rating' }).getByRole('radio', { name: '5 stars' }).click();
  await review.getByPlaceholder(/What should others order/).fill('Biryani was proper dum, raita was cold. Would order again.');
  const posted = waitForApi(page, '/api/reviews', 'POST');
  await review.getByRole('button', { name: 'Post review' }).click();
  await posted;
  await expect(page.getByRole('button', { name: 'Rate this order' })).toBeHidden();

  expect(pageErrors).toEqual([]);
  await partnerCtx.close();
  await customerCtx.close();
});

test('an anonymous visitor cannot reach account or partner pages', async ({ page }) => {
  await page.goto('/orders');
  await expect(page).toHaveURL(/login/);
  await page.goto('/partner/orders');
  await expect(page).toHaveURL(/login/);
});
