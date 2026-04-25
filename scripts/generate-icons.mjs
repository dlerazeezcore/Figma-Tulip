import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SVG_SOURCE = 'src/imports/Tulipbooking-logo-full.svg';

async function generate() {
  console.log('Generating native assets...');

  // 1. iOS AppIcon
  const IOS_ICONSET_DIR = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';
  const IOS_ICON_FILE = 'AppIcon-1024.png';
  const iosPath = path.join(IOS_ICONSET_DIR, IOS_ICON_FILE);
  if (!fs.existsSync(IOS_ICONSET_DIR)) fs.mkdirSync(IOS_ICONSET_DIR, { recursive: true });

  const iosLogoSize = 980; // Larger logo size
  const iosPadding = (1024 - iosLogoSize) / 2;

  await sharp(SVG_SOURCE)
    .resize(iosLogoSize, iosLogoSize, { 
      fit: 'contain', 
      background: '#FFFFFF' 
    })
    .extend({
      top: iosPadding, bottom: iosPadding, left: iosPadding, right: iosPadding,
      background: '#FFFFFF'
    })
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(iosPath);
  console.log(`Generated iOS Icon: ${iosPath}`);

  // Clean up old PNGs
  const filesInDir = fs.readdirSync(IOS_ICONSET_DIR);
  for (const file of filesInDir) {
    if (file.endsWith('.png') && file !== IOS_ICON_FILE) {
      fs.unlinkSync(path.join(IOS_ICONSET_DIR, file));
    }
  }

  // Rewrite Contents.json
  const contentsJson = {
    "images": [
      {
        "idiom": "universal",
        "size": "1024x1024",
        "filename": "AppIcon-1024.png",
        "platform": "ios"
      }
    ],
    "info": {
      "author": "xcode",
      "version": 1
    }
  };
  fs.writeFileSync(
    path.join(IOS_ICONSET_DIR, 'Contents.json'),
    JSON.stringify(contentsJson, null, 2)
  );

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

    // Legacy Icons (Solid background white, larger logo approx 92%)
    const legacySize = Math.floor(map.size * 0.92);
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
      
      // Icon centered in 108dp box. 
      // Increased size to approx 88% for a very large, premium look
      // while staying just within safe limits for most masks.
      const contentSize = Math.floor(map.size * 0.88);
      
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
