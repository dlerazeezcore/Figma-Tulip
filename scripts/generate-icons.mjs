import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SVG_SOURCE = 'src/imports/Tulipbooking-logo-full.svg';

async function generate() {
  console.log('Generating native assets...');

  // 1. iOS AppIcon
  // Use solid white background and larger logo size (approx 98% of what was 75% -> 98% total)
  // Previous: resize(768) with 128 padding on 1024 base. (768/1024 = 0.75)
  // New: 0.75 * 1.3 = 0.975. Using 998 for a slightly larger, balanced feel without cropping.
  const iosPath = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png';
  const iosIconDir = path.dirname(iosPath);
  if (!fs.existsSync(iosIconDir)) fs.mkdirSync(iosIconDir, { recursive: true });

  const iosLogoSize = 998;
  const iosPadding = Math.floor((1024 - iosLogoSize) / 2);

  await sharp(SVG_SOURCE)
    .resize(iosLogoSize, iosLogoSize, { 
      fit: 'contain', 
      background: '#FFFFFF' 
    })
    .extend({
      top: iosPadding, bottom: 1024 - iosLogoSize - iosPadding, 
      left: iosPadding, right: 1024 - iosLogoSize - iosPadding,
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

    // Legacy Icons (Solid background white, increased logo size)
    // Previous: 0.65. New: 0.65 * 1.3 = 0.845.
    const legacySize = Math.floor(map.size * 0.84);
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
      // Previous: 0.62. New: 0.62 * 1.3 = 0.806.
      // We'll use 80% of the box for the logo content.
      const contentSize = Math.floor(map.size * 0.80);
      
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
