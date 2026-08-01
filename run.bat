@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [error] Node.js is not installed or is not available in PATH.
  echo [hint] Install Node.js 22.12 or newer.
  exit /b 1
)

if not exist "node_modules\" (
  echo [setup] Installing npm dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo [build] Building the React application...
call npm run build
if errorlevel 1 exit /b 1

echo [info] Starting Emma 3.0 at http://127.0.0.1:8650 ...
start "Emma 3.0 Server" cmd /k "cd /d ""%~dp0"" && npm start"

echo [info] Waiting for the server...
powershell -NoProfile -Command ^
  "$ready=$false; for($i=0;$i -lt 30;$i++){ try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8650/login ^| Out-Null; $ready=$true; break } catch { Start-Sleep -Seconds 1 } }; if(-not $ready){ exit 1 }"
if errorlevel 1 (
  echo [error] Emma did not become ready in time.
  exit /b 1
)

echo [info] Opening Emma in the browser...
start "" http://127.0.0.1:8650/login

exit /b 0
