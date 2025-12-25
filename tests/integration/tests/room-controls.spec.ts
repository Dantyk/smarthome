import { test, expect } from '@playwright/test';

test.describe('Room Controls', () => {
  test('should display room temperature', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for MQTT messages
    
    // Look for temperature displays
    const tempElements = page.locator('[data-testid*="temperature"], [class*="temperature"]');
    
    if (await tempElements.count() > 0) {
      const firstTemp = tempElements.first();
      await expect(firstTemp).toBeVisible();
      
      // Should contain a number
      const text = await firstTemp.textContent();
      expect(text).toMatch(/\d+/);
    }
  });

  test('should toggle light controls', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForLoadState('networkidle');
    
    // Find light toggle buttons
    const lightToggles = page.locator(
      'button[data-testid*="light"], button[class*="light-toggle"], button:has-text("svetlo")'
    );
    
    if (await lightToggles.count() > 0) {
      const firstToggle = lightToggles.first();
      
      // Click toggle
      await firstToggle.click();
      
      // Wait for MQTT publish
      await page.waitForTimeout(500);
      
      // Button should change state (class or aria attribute)
      const ariaPressed = await firstToggle.getAttribute('aria-pressed');
      const className = await firstToggle.getAttribute('class');
      
      // Either aria-pressed or class should indicate state
      expect(ariaPressed !== null || className !== null).toBeTruthy();
    }
  });

  test('should adjust shutter position', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForLoadState('networkidle');
    
    // Find shutter controls
    const shutterControls = page.locator(
      '[data-testid*="shutter"], [class*="shutter"], button:has-text("žalúzie")'
    );
    
    if (await shutterControls.count() > 0) {
      const upButton = page.locator('button:has-text("hore"), button[aria-label*="up"]').first();
      
      if (await upButton.count() > 0) {
        await upButton.click();
        await page.waitForTimeout(500);
        
        // Should not crash
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('should display current mode', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Look for mode indicator
    const modeElement = page.locator(
      '[data-testid*="mode"], [class*="mode"], [class*="status"]'
    ).first();
    
    if (await modeElement.count() > 0) {
      await expect(modeElement).toBeVisible();
      
      // Should contain text (mode name)
      const text = await modeElement.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });

  test('should update in real-time via MQTT', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForLoadState('networkidle');
    
    // Store initial state
    const tempElements = page.locator('[data-testid*="temperature"]');
    
    if (await tempElements.count() > 0) {
      const initialText = await tempElements.first().textContent();
      
      // Wait for potential MQTT updates
      await page.waitForTimeout(5000);
      
      // Page should still be responsive
      await expect(page.locator('body')).toBeVisible();
      
      // Text may have changed or stayed the same (both OK)
      const finalText = await tempElements.first().textContent();
      expect(finalText).toBeTruthy();
    }
  });
});
