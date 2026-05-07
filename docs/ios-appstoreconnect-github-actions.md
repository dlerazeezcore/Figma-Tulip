# iOS App Store Connect via GitHub Actions

This repository now includes:

- `.github/workflows/ios-appstoreconnect.yml`

It builds the Capacitor iOS app, signs it, exports an `.ipa`, uploads the IPA as a workflow artifact, and optionally uploads it to TestFlight/App Store Connect.

## Required GitHub Secrets

Create these in `Settings -> Secrets and variables -> Actions`:

1. `APPSTORE_CERTIFICATES_FILE_BASE64`
   Base64 of your Apple Distribution `.p12` file.
2. `APPSTORE_CERTIFICATES_PASSWORD`
   Password you set when exporting the `.p12`.
3. `KEYCHAIN_PASSWORD`
   Any strong random password for temporary CI keychain.
4. `APPSTORE_API_PRIVATE_KEY`
   Contents of `AuthKey_<KEY_ID>.p8` from App Store Connect API Keys.

## Required GitHub Variables

Create these in `Settings -> Secrets and variables -> Actions -> Variables`:

1. `APPSTORE_API_KEY_ID`
   App Store Connect API key ID.
2. `APPSTORE_ISSUER_ID`
   App Store Connect issuer ID.

## One-time Apple Portal Setup

1. Ensure app exists in App Store Connect with bundle id `com.theesim.app`.
2. Ensure Apple Distribution certificate exists and export it as `.p12`.
3. Ensure an `IOS_APP_STORE` provisioning profile exists for `com.theesim.app`.
4. Ensure API key has at least `App Manager` access.

## Run the Workflow

1. Open `Actions -> iOS App Store Connect`.
2. Click `Run workflow`.
3. Keep defaults unless needed:
   - `bundle_id`: `com.theesim.app`
   - `team_id`: `LFF7L83D75`
   - `scheme`: `App`
   - `upload_to_testflight`: `true`

## Notes

- The workflow always runs `npm run ios:sync` before archive.
- If `upload_to_testflight` is `false`, the build still produces IPA artifact for manual upload.
- If upload fails with signing errors, regenerate the App Store provisioning profile after confirming the distribution certificate is included.
