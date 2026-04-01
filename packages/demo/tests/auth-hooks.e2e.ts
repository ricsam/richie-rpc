import { expect, test, type Page } from '@playwright/test';

async function loadHarness(page: Page) {
  await page.goto('/auth-hooks.html');
  await page.waitForFunction(() =>
    Boolean((window as { __authHooksTest?: unknown }).__authHooksTest),
  );
}

test.describe('Browser Auth Hooks', () => {
  test('rotates auth tokens across standard requests', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(async () => {
      return await (window as any).__authHooksTest.runStandardScenario();
    });

    expect(result.firstStatus).toBe(200);
    expect(result.secondStatus).toBe(200);
    expect(result.sentTokens).toEqual(['Bearer standard-0', 'Bearer standard-1']);
    expect(result.responseTokens).toEqual(['Bearer standard-1', 'Bearer standard-2']);
    expect(result.statuses).toEqual([200, 200]);
    expect(result.total).toBeGreaterThanOrEqual(2);
  });

  test('uses auth hooks for XHR upload progress requests', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(async () => {
      return await (window as any).__authHooksTest.runUploadScenario();
    });

    expect(result.sentTokens).toEqual(['Bearer upload-0']);
    expect(result.responseTokens).toEqual(['Bearer upload-1']);
    expect(result.statuses).toEqual([201]);
    expect(result.uploadedCount).toBe(1);
    expect(result.progressEvents.length).toBeGreaterThan(0);
    expect(result.progressEvents[result.progressEvents.length - 1]).toBe(1);
  });

  test('uses auth hooks for download requests before body consumption', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(async () => {
      return await (window as any).__authHooksTest.runDownloadScenario();
    });

    expect(result.sentTokens).toEqual(['Bearer download-0']);
    expect(result.responseTokens).toEqual(['Bearer download-1']);
    expect(result.statuses).toEqual([200]);
    expect(result.fileName).toBe('hello.txt');
    expect(result.fileSize).toBeGreaterThan(0);
    expect(result.progressEvents.length).toBeGreaterThan(0);
  });

  test('uses auth hooks for streaming fetch responses', async ({ page }) => {
    await loadHarness(page);

    const result = await page.evaluate(async () => {
      return await (window as any).__authHooksTest.runStreamingScenario();
    });

    expect(result.sentTokens).toEqual(['Bearer streaming-0']);
    expect(result.responseTokens).toEqual(['Bearer streaming-1']);
    expect(result.statuses).toEqual([200]);
    expect(
      result.contentTypes.some((value: string) => value.includes('application/x-ndjson')),
    ).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.final).toBeDefined();
    expect(result.final?.totalTokens).toBeGreaterThan(0);
  });
});
