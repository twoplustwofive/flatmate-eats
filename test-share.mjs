/**
 * Test: Verify the share-as-image feature captures all 6 days expanded.
 *
 * Steps:
 * 1. Launch browser, navigate to the app
 * 2. Wait for meal plan to load
 * 3. Click the Share button (which triggers image download)
 * 4. Intercept the download and inspect the resulting PNG
 * 5. Also screenshot the hidden SharePreview to verify it's fully rendered
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'test-output');

async function run() {
  // Ensure output dir
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 480, height: 900 });

  // Set up download interception
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: OUTPUT_DIR,
  });

  console.log('1. Navigating to app...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 15000 });

  // Wait for the plan to render (Day 1 card should exist)
  await page.waitForSelector('button', { timeout: 10000 });
  console.log('2. App loaded, meal plan rendered.');

  // Screenshot the main UI for reference
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01_app_loaded.png'), fullPage: true });
  console.log('   -> Saved 01_app_loaded.png');

  // Check the hidden SharePreview is rendered off-screen
  const sharePreviewExists = await page.evaluate(() => {
    const hidden = document.querySelector('[aria-hidden="true"]');
    if (!hidden) return { exists: false };
    const allText = hidden.innerText || hidden.textContent || '';
    const dayMatches = allText.match(/Day \d/g) || [];
    return {
      exists: true,
      hasContent: allText.length > 0,
      textLength: allText.length,
      dayCount: dayMatches.length,
      containsAllDays: dayMatches.length >= 6,
      sampleText: allText.substring(0, 300),
    };
  });

  console.log('3. SharePreview check:', JSON.stringify(sharePreviewExists, null, 2));

  if (!sharePreviewExists.containsAllDays) {
    console.error('   ❌ FAIL: SharePreview does NOT contain all 6 days!');
  } else {
    console.log('   ✅ PASS: SharePreview contains all 6 days expanded.');
  }

  // Now make the hidden share preview temporarily visible and screenshot it
  await page.evaluate(() => {
    const hidden = document.querySelector('[aria-hidden="true"]');
    if (hidden) {
      hidden.style.position = 'static';
      hidden.style.left = '0';
      hidden.style.zIndex = '9999';
      hidden.style.pointerEvents = 'auto';
    }
  });
  
  // Take a screenshot of just the share preview element
  const previewEl = await page.$('[aria-hidden="true"] > div');
  if (previewEl) {
    await previewEl.screenshot({ path: path.join(OUTPUT_DIR, '02_share_preview.png') });
    console.log('4. Saved 02_share_preview.png (the image that would be shared)');
  }

  // Now click the Share button and wait for the download
  // First, restore the hidden element
  await page.evaluate(() => {
    const hidden = document.querySelector('[aria-hidden="true"]');
    if (hidden) {
      hidden.style.position = 'fixed';
      hidden.style.left = '-9999px';
      hidden.style.zIndex = '-1';
      hidden.style.pointerEvents = 'none';
    }
  });

  console.log('5. Clicking Share button...');
  // Find the Share button (the one with "Share" text)
  const shareBtn = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(b => b.textContent.includes('Share'));
  });

  if (shareBtn) {
    await shareBtn.click();
    // Wait for the download to complete
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if the PNG was downloaded
    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
    console.log('   Downloaded files:', files);
    
    const mealPlanFile = files.find(f => f.includes('flatmate-eats'));
    if (mealPlanFile) {
      const stats = fs.statSync(path.join(OUTPUT_DIR, mealPlanFile));
      console.log(`   ✅ PASS: Downloaded ${mealPlanFile} (${(stats.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log('   ⚠️  Download file not found in output dir (may have gone to default Downloads folder)');
    }
  }

  // Final summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`SharePreview rendered: ${sharePreviewExists.exists ? '✅' : '❌'}`);
  console.log(`All 6 days present:   ${sharePreviewExists.containsAllDays ? '✅' : '❌'}`);
  console.log(`Days found:           ${sharePreviewExists.dayCount}`);
  console.log(`Output files saved to: ${OUTPUT_DIR}`);

  await browser.close();
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
