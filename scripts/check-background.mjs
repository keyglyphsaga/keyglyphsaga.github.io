import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch();
await mkdir('screenshots', { recursive: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto('http://localhost:4321/');
    assert.deepEqual(await page.locator('.tabs a').allTextContents(), ['I. Shadow', 'II. Self', 'Author']);
    assert(await page.locator('.tabs a').evaluateAll(links => links.every(link => {
      const rect = link.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    })), 'All navigation labels must fit the viewport');
    await page.locator('.hero-bg-img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    await page.evaluate(() => { window.savedBackground = document.querySelector('.hero-bg'); });
    async function verify(self) {
      await page.waitForFunction(self => {
        const opacity = selector => Number(getComputedStyle(document.querySelector(selector)).opacity);
        return opacity('.hero-bg-self') === (self ? 1 : 0) && opacity('.hero-bg-original') === (self ? 0 : 1);
      }, self);
      assert(await page.evaluate(() => window.savedBackground === document.querySelector('.hero-bg')), 'Background should persist');
    }
    async function navigate(label, self) {
      await page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
      await page.waitForFunction(self => document.body.dataset.background === (self ? 'self' : 'original'), self);
      // Assert a real intermediate opacity, not merely the final image.
      await page.waitForFunction(() => {
        const opacity = Number(getComputedStyle(document.querySelector('.hero-bg-self')).opacity);
        return opacity > 0 && opacity < 1;
      }, null, { timeout: 2000 });
      await verify(self);
    }
    await verify(false);
    await navigate('II. Self', true);
    await page.screenshot({ path: `screenshots/self-${viewport.width}.png` });
    await navigate('Author', false);
    await navigate('II. Self', true);
    await navigate('I. Shadow', false);
    await page.goBack();
    await verify(true);
    await page.goForward();
    await verify(false);
    await page.goto('http://localhost:4321/self');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero-bg-self')).opacity === '1');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.hero-bg-self').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    await page.getByRole('navigation').getByRole('link', { name: 'Author', exact: true }).click();
    await page.waitForFunction(() => document.body.dataset.background === 'original' && getComputedStyle(document.querySelector('.hero-bg-self')).opacity === '0');
    console.log(`PASS ${viewport.width}px: cross-fades both ways, original tabs, persistence, history, direct Self, reduced motion`);
    await page.close();
  }
} finally {
  await browser.close();
}
