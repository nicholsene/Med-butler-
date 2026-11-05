# Medical Butler

A private home-screen web app for tracking symptoms, keeping a next step close, and preparing for doctor visits. It runs on one phone. There is no account and no server.

## Privacy

**GitHub holds code and general guidance only.** The app's code and general, non-personal guidance live in this repository. Everything you enter stays in the browser storage of your phone.

- The app has no server and no analytics. It makes no network requests with your data.
- It sends no automatic alerts. A call or text starts only when you tap, and a text still waits for you to press send.
- A backup is encrypted on the phone with your passphrase (PBKDF2 and AES-GCM). The passphrase is never stored. If it's forgotten, the backup can't be opened by anyone.
- A file leaves the phone only when you tap to save or share it. That includes the optional deep review file, which shows you exactly what it contains first.
- The build fails if a data file contains anything that looks like an email or phone number (`npm run check:data`). Don't put names, conditions or other personal details in this repository.

The app is not medical advice, doesn't diagnose, and doesn't replace your doctors or 911.

## Install on iPhone

1. In **Safari**, open `https://nicholsene.github.io/med-butler-/`.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Close Safari and open **Butler** from the home screen. Use only this icon from now on.
4. Finish setup. Then, in **Settings**, check the **Storage** line.
5. Make a backup in **Settings > Back up or restore**, and keep the file somewhere off the phone.

Good to know:

- On iPhone, a Safari tab and the home screen app keep separate data. Anything entered in the tab doesn't move across, so start from the home screen icon.
- To move to a new phone, install the app there, tap **Restore from a backup instead**, and choose your backup file.
- Deleting the home screen icon deletes the app's data. Back up first.

## Develop

```sh
npm ci
npm run dev           # local server
npm test              # unit tests
npm run check:data    # email and phone check on data files
npm run build         # data check, type check, then dist/
npm run build:single  # one self-contained HTML file in dist-single/
```

## Deploy

Pushing to `main` runs `.github/workflows/pages.yml`, which checks the data, runs the tests, builds and deploys.

Once, in the repository on GitHub: **Settings > Pages > Source: GitHub Actions**.

The Vite `base` in `vite.config.ts` must match the repository name exactly, including case. It's currently `/med-butler-/`.
