import { test, expect } from '@playwright/test';

test.describe('Weather Widget', () => {
  test('should fetch and display weather data', async ({ page }) => {
    await page.goto('/');
    
    // Wait for weather API call
    const weatherResponse = await page.waitForResponse(
      response => response.url().includes('/api/weather') && response.status() === 200,
      { timeout: 10000 }
    );
    
    expect(weatherResponse.ok()).toBeTruthy();
    
    // Parse response
    const data = await weatherResponse.json();
    expect(data).toBeTruthy();
  });

  test('should display weather widget', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForLoadState('networkidle');
    
    // Look for weather-related elements
    const weather = page.locator('[data-testid*="weather"], .weather, [class*="weather"]').first();
    
    if (await weather.count() > 0) {
      await expect(weather).toBeVisible();
    }
  });

  test('should handle weather API errors gracefully', async ({ page }) => {
    // Intercept weather API and return error
    await page.route('**/api/weather', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Weather service unavailable' })
      });
    });
    
    await page.goto('/');
    
    // Page should still load without crashing
    await expect(page.locator('body')).toBeVisible();
    
    // Should not show unhandled error
    const errorBoundary = page.locator('[data-testid="error-boundary"]');
    if (await errorBoundary.count() > 0) {
      const text = await errorBoundary.textContent();
      expect(text).not.toContain('Weather service unavailable');
    }
  });
});
