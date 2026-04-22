import fs from 'fs';
import https from 'https';
import path from 'path';

const url = 'https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar';
const dest = 'android/gradle/wrapper/gradle-wrapper.jar';

https.get(url, (res) => {
    if (res.statusCode !== 200) {
        console.error('Failed to download: ' + res.statusCode);
        process.exit(1);
    }
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => {
        file.close();
        console.log('Successfully downloaded gradle-wrapper.jar');
        fs.chmodSync('android/gradlew', 0o755);
        console.log('Made android/gradlew executable');
    });
}).on('error', (err) => {
    console.error(err);
    process.exit(1);
});
