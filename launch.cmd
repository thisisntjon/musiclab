@echo off
rem MusicLab launcher: starts the local server (if it isn't already running) and opens the app.
rem Everything stays on this computer. Close the "MusicLab server" window to stop it.
cd /d "%~dp0"
set PORT=8777
set URL=http://127.0.0.1:%PORT%/

curl.exe -s -o nul -f %URL%api/patches && start "" %URL% && exit /b 0

rem Find a Python 3 that runs. The py launcher works even when python.exe is not on PATH.
set PY=
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1 && set "PY=py -3"
if not defined PY python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1 && set "PY=python"
if not defined PY (
  echo.
  echo MusicLab needs Python 3.11 or newer on this computer.
  echo Get it from https://www.python.org/downloads/ and tick "Add python.exe to PATH" in the installer.
  echo Then double-click launch.cmd again.
  echo.
  echo You can also play online with nothing to install: https://musiclab.simoneresearch.com/
  echo.
  pause
  exit /b 1
)

rem cmd /k keeps the server window open, so an error stays readable.
start "MusicLab server" /min cmd /k %PY% app.py --host 127.0.0.1 --port %PORT%
for /l %%i in (1,1,30) do (
  timeout /t 1 /nobreak >nul
  curl.exe -s -o nul -f %URL%api/patches && start "" %URL% && exit /b 0
)
echo MusicLab did not start. Open the "MusicLab server" window on the taskbar to see why.
pause
exit /b 1
