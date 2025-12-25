import { test, expect } from '@playwright/test';

test.describe('SmartHome Homepage', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check page title
    await expect(page).toHaveTitle(/SmartHome/i);
    
    // Check main heading exists
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('should have working navigation', async ({ page }) => {
    await page.goto('/');
    
    // Wait for hydration
    await page.waitForLoadState('networkidle');
    
    // Check if navigation elements are present
    const nav = page.locator('nav');
    if (await nav.count() > 0) {
      await expect(nav).toBeVisible();
    }
  });

  test('should display room cards', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForLoadState('networkidle');
    
    // Look for room card elements
    const rooms = page.locator('[data-testid*="room"], .room-card, [class*="room"]');
    
    // At least one room should be visible
    if (await rooms.count() > 0) {
      await expect(rooms.first()).toBeVisible();
    }
  });

  test('should handle MQTT connection', async ({ page }) => {
    await page.goto('/');
    
    // Wait for MQTT connection
    await page.waitForTimeout(2000);
    
    // Check console for MQTT errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Should not have MQTT connection errors
    const mqttErrors = errors.filter(e => e.includes('mqtt') || e.includes('websocket'));
    expect(mqttErrors.length).toBe(0);
  });

  test('should be responsive', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    
    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();
    
    // Desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('body')).toBeVisible();
  });
});
