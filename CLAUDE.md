# Marifatul Quran — notes for Claude

## Running the app: always local AND on the owner's phone via ngrok

Run the app with the script, never by hand:

```bash
scripts/dev-phone.sh [app-folder]   # default: the git checkout you are in
```

From a worktree, call the main checkout's copy with the worktree as the argument:
`/home/mejazbese21/Work/RndProjects/PersonalProjects/QuranAccademy/MFF/Marifatul-Quran/scripts/dev-phone.sh "$PWD"`
(run it in the background; it stays up until stopped).

What it does:
- Local dev server: http://localhost:8794/ (`scripts/serve.js`; reused if already running).
- Phone: **https://hardcopy-legume-unwatched.ngrok-free.dev**, through a read-only copy
  (`scripts/static-readonly.py`: GET only, no `.git`, no listings) on the first free port from 8796.
  The dev server is never tunnelled: its `POST /__save-timings` writes `timings.js`.
- Prints the link and a QR code (`/tmp/mq-phone-qr.png`); open the image for the owner.
- Ctrl+C (or stopping the task) stops everything it started.

Give the owner the link and the QR code every time; on first visit they tap "Visit Site" on
ngrok's page.
