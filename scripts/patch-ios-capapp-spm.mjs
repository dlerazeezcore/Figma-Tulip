import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('ios/App/CapApp-SPM/Package.swift');

if (!fs.existsSync(packagePath)) {
  console.log(`Skipping patch-ios-capapp-spm: missing ${packagePath}`);
  process.exit(0);
}

let source = fs.readFileSync(packagePath, 'utf8');

if (!source.includes('firebase-ios-sdk')) {
  source = source.replace(
    '    platforms: [.iOS(.v15)],',
    `    platforms: [
        .iOS(.v15),
        .macOS(.v10_15)
    ],`
  );

  source = source.replace(
    '        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.2.0"),',
    `        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.2.0"),
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "12.0.0"),`
  );

  source = source.replace(
    '                .product(name: "Cordova", package: "capacitor-swift-pm"),',
    `                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseMessaging", package: "firebase-ios-sdk"),`
  );
}

fs.writeFileSync(packagePath, source);
console.log('Patched ios/App/CapApp-SPM/Package.swift');
