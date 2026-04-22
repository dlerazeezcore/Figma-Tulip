import fs from 'fs';

function ensureAndroidPermissions() {
  try {
    fs.chmodSync('android/gradlew', 0o755);
    console.log('Ensured android/gradlew is executable');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('Could not set permissions on android/gradlew:', err.message);
    }
  }
}

ensureAndroidPermissions();
