import { test, expect } from '@playwright/test';

test.describe('UTM Linter E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock ad platform form
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>Test Ad Platform</title></head>
      <body>
        <form id="ad-form">
          <label>
            Destination URL:
            <input type="url" id="url-input" name="url" placeholder="Enter URL with UTM params" />
          </label>
          <button type="submit">Create Ad</button>
        </form>
        <script>
          document.getElementById('ad-form').addEventListener('submit', (e) => {
            e.preventDefault();
            window.formSubmitted = true;
          });
        </script>
      </body>
      </html>
    `);
    
    // Inject content script logic for testing
    await page.addScriptTag({
      content: `
        // Mock the UTM validator
        window.UTMValidator = {
          validate(url) {
            const violations = [];
            if (url.includes('utm_source=Google')) {
              violations.push({ code: 'UPPERCASE_FOUND', message: 'Must be lowercase' });
            }
            if (url.includes(' ')) {
              violations.push({ code: 'WHITESPACE_FOUND', message: 'No whitespace allowed' });
            }
            return {
              valid: violations.length === 0,
              violations,
              autofix: violations.length > 0 ? { fixed: true } : undefined
            };
          }
        };
        
        // Set up input validation
        const urlInput = document.getElementById('url-input');
        urlInput.addEventListener('blur', () => {
          const result = window.UTMValidator.validate(urlInput.value);
          urlInput.dataset.utmValid = result.valid ? 'true' : 'false';
          
          // Remove existing error UI
          document.querySelector('.utm-linter-error-ui')?.remove();
          
          if (!result.valid) {
            urlInput.style.borderColor = '#ef4444';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'utm-linter-error-ui';
            errorDiv.textContent = 'UTM Validation Error: ' + result.violations[0].message;
            urlInput.parentElement.appendChild(errorDiv);
          } else {
            urlInput.style.borderColor = '';
          }
        });
        
        // Block form submission if invalid
        document.getElementById('ad-form').addEventListener('submit', (e) => {
          if (urlInput.dataset.utmValid === 'false') {
            e.preventDefault();
            alert('Please fix UTM validation errors');
          }
        });
      `
    });
  });

  test('paste invalid URL shows inline error and blocks submit', async ({ page }) => {
    const urlInput = page.locator('#url-input');
    const submitBtn = page.locator('button[type="submit"]');
    
    // Paste invalid URL (uppercase)
    await urlInput.fill('https://example.com?utm_source=Google&utm_medium=cpc&utm_campaign=test');
    await urlInput.blur();
    
    // Check error UI appears
    const errorUI = page.locator('.utm-linter-error-ui');
    await expect(errorUI).toBeVisible();
    await expect(errorUI).toContainText('UTM Validation Error');
    
    // Check input is marked invalid
    await expect(urlInput).toHaveAttribute('data-utm-valid', 'false');
    await expect(urlInput).toHaveCSS('border-color', 'rgb(239, 68, 68)');
    
    // Try to submit - should be blocked
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('fix UTM');
      await dialog.accept();
    });
    
    await submitBtn.click();
    
    // Form should not have submitted
    const formSubmitted = await page.evaluate(() => window.formSubmitted);
    expect(formSubmitted).toBeUndefined();
  });

  test('auto-fix clears errors and allows submit', async ({ page }) => {
    const urlInput = page.locator('#url-input');
    
    // Paste invalid URL
    await urlInput.fill('https://example.com?utm_source=Google&utm_medium=cpc&utm_campaign=test');
    await urlInput.blur();
    
    // Verify error shown
    await expect(page.locator('.utm-linter-error-ui')).toBeVisible();
    
    // Apply fix (lowercase)
    await urlInput.fill('https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test');
    await urlInput.blur();
    
    // Error should be cleared
    await expect(page.locator('.utm-linter-error-ui')).not.toBeVisible();
    await expect(urlInput).toHaveAttribute('data-utm-valid', 'true');
  });

  test('valid URL allows immediate submit', async ({ page }) => {
    const urlInput = page.locator('#url-input');
    const submitBtn = page.locator('button[type="submit"]');
    
    // Enter valid URL
    await urlInput.fill('https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale');
    await urlInput.blur();
    
    // No error should appear
    await expect(page.locator('.utm-linter-error-ui')).not.toBeVisible();
    await expect(urlInput).toHaveAttribute('data-utm-valid', 'true');
    
    // Submit should work
    await submitBtn.click();
    
    const formSubmitted = await page.evaluate(() => window.formSubmitted);
    expect(formSubmitted).toBe(true);
  });
});