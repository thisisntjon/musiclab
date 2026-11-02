@echo off
rem MusicLab launcher: starts the local server (if it isn't already running) and opens the app.
rem Everything stays on this computer. Close the "MusicLab server" window to stop it.
cd /d "%~dp0"
set PORT=8777
set URL=http://127.0.0.1:%PORT%/

curl.exe -s -o nul -f %URL%api/patches && goto open

start "MusicLab server" /min python app.py --host 127.0.0.1 --port %PORT%
for /l %%i in (1,1,30) do (
  timeout /t 1 /nobreak >nul
  curl.exe -s -o nul -f %URL%api/patches && goto open
)
echo MusicLab didn't start. Check the "MusicLab server" window for the reason.
pause
exit /b 1

:open
start "" %URL%
