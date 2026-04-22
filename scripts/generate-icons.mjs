import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SVG_SOURCE = 'src/imports/Tulipbooking-logo-full.svg';

async function generate() {
  console.log('Generating native assets...');

  // 1. iOS AppIcon
  // Use solid white background and smaller logo size (approx 75%)
  const iosPath = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png';
  const iosIconDir = path.dirname(iosPath);
  if (!fs.existsSync(iosIconDir)) fs.mkdirSync(iosIconDir, { recursive: true });

  await sharp(SVG_SOURCE)
    .resize(768, 768, { 
      fit: 'contain', 
      background: '#FFFFFF' 
    })
    .extend({
      top: 128, bottom: 128, left: 128, right: 128,
      background: '#FFFFFF'
    })
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(iosPath);
  console.log(`Generated iOS Icon: ${iosPath}`);

  // 2. Android Mipmaps (Legacy/Round)
  // Sizes for standard icons: 48, 72, 96, 144, 192
  const androidMipmaps = [
    { name: 'mdpi', size: 48 },
    { name: 'hdpi', size: 72 },
    { name: 'xhdpi', size: 96 },
    { name: 'xxhdpi', size: 144 },
    { name: 'xxxhdpi', size: 192 },
  ];

  for (const map of androidMipmaps) {
    const dir = `android/app/src/main/res/mipmap-${map.name}`;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Legacy Icons (Solid background white, approx 65% logo)
    const legacySize = Math.floor(map.size * 0.65);
    const legacyPadding = Math.floor((map.size - legacySize) / 2);

    await sharp(SVG_SOURCE)
      .resize(legacySize, legacySize, { fit: 'contain', background: '#FFFFFF' })
      .extend({
        top: legacyPadding,
        bottom: map.size - legacySize - legacyPadding,
        left: legacyPadding,
        right: map.size - legacySize - legacyPadding,
        background: '#FFFFFF'
      })
      .flatten({ background: '#FFFFFF' })
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));
    
    await sharp(SVG_SOURCE)
      .resize(legacySize, legacySize, { fit: 'contain', background: '#FFFFFF' })
      .extend({
        top: legacyPadding,
        bottom: map.size - legacySize - legacyPadding,
        left: legacyPadding,
        right: map.size - legacySize - legacyPadding,
        background: '#FFFFFF'
      })
      .flatten({ background: '#FFFFFF' })
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // Adaptive Foreground (Transparent, centered)
    // Adaptive icons are 108dp. Safe zone is 66dp.
    // We'll scale density correctly: 108, 162, 216, 324, 432
    // But we'll just use the standard density scale from the 48-192 list
    // Actually, adaptive foreground is usually in mipmap-anydpi-v26 or similar, 
    // but putting density versions in mipmap folders is more standard.
  }

  // Generate Adaptive Foreground PNGs
  const adaptiveSizes = [
      { name: 'mdpi', size: 108 },
      { name: 'hdpi', size: 162 },
      { name: 'xhdpi', size: 216 },
      { name: 'xxhdpi', size: 324 },
      { name: 'xxxhdpi', size: 432 },
  ];

  for (const map of adaptiveSizes) {
      const dir = `android/app/src/main/res/mipmap-${map.name}`;
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const foregroundPath = path.join(dir, 'ic_launcher_foreground.png');
      
      // Icon should be centered in 108dp box. 
      // Safe zone is 66dp of 108dp (approx 61%).
      // We'll use 62% of the box for the logo content for a clean, non-clipped look.
      const contentSize = Math.floor(map.size * 0.62);
      
      await sharp(SVG_SOURCE)
        .resize(contentSize, contentSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .extend({
          top: Math.floor((map.size - contentSize) / 2),
          bottom: Math.ceil((map.size - contentSize) / 2),
          left: Math.floor((map.size - contentSize) / 2),
          right: Math.ceil((map.size - contentSize) / 2),
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toFile(foregroundPath);
  }

  console.log('Native assets generated successfully.');
}

generate().catch(err => {
    console.error('Generation failed:', err);
    process.exit(1);
});
