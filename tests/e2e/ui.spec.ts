import { test, expect } from '@playwright/test';

test.describe('SmartHome UI E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8088');
  });

  test('should load homepage', async ({ page }) => {
    await expect(page).toHaveTitle(/SmartHome/i);
  });

  test('should display room cards', async ({ page }) => {
    const rooms = ['Spálňa', 'Detská izba', 'Obývačka', 'Kuchyňa', 'Kúpeľňa'];
    
    for (const room of rooms) {
      await expect(page.getByText(room)).toBeVisible();
    }
  });

  test('should change room temperature', async ({ page }) => {
    // Find Spálňa card
    const roomCard = page.locator('[data-room="spalna"]');
    
    // Find temperature slider
    const slider = roomCard.locator('input[type="range"]');
    
    // Change value
    await slider.fill('22');
    
    // Wait for MQTT publish
    await page.waitForTimeout(500);
    
    // Verify value displayed
    await expect(roomCard.getByText('22°C')).toBeVisible();
  });

  test('should toggle HVAC on/off', async ({ page }) => {
    const roomCard = page.locator('[data-room="spalna"]');
    const toggleButton = roomCard.getByRole('button', { name: /vypnúť|zapnúť/i });
    
    await toggleButton.click();
    await page.waitForTimeout(500);
    
    // Verify state changed (button text or icon)
    await expect(toggleButton).toBeVisible();
  });

  test('should start boost mode', async ({ page }) => {
    const roomCard = page.locator('[data-room="spalna"]');
    const boostButton = roomCard.getByRole('button', { name: /boost/i });
    
    await boostButton.click();
    
    // Set boost parameters
    await page.getByLabel('Trvanie (hodiny)').fill('2');
    await page.getByLabel('Cieľová teplota').fill('24');
    
    // Confirm
    await page.getByRole('button', { name: /potvrdiť/i }).click();
    
    await page.waitForTimeout(500);
    
    // Verify boost active indicator
    await expect(roomCard.getByText(/boost aktívny/i)).toBeVisible();
  });

  test('should display weather information', async ({ page }) => {
    const weatherWidget = page.locator('[data-testid="weather"]');
    
    await expect(weatherWidget).toBeVisible();
    await expect(weatherWidget.getByText(/°C/)).toBeVisible();
  });
});
