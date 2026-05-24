@echo off
SET PATH=C:\Program Files\nodejs\;%PATH%
SET NODE=C:\Program Files\nodejs\node.exe
SET FIREBASE=C:/Users/bohle/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js
SET PROJECT=C:\Bohleh experimenting\discord-clone

echo === Node version ===
"%NODE%" --version

echo === Logging into Firebase ===
"%NODE%" "%FIREBASE%" login

echo === Deploying ===
cd /d "%PROJECT%"
"%NODE%" "%FIREBASE%" deploy --only hosting --project cloning-clone

echo.
echo === Done! Visit https://cloning-clone.web.app ===
pause
