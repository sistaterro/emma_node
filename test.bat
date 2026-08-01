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

echo [test] Checking JavaScript, JSX, and TypeScript declarations...
call npm run check
if errorlevel 1 exit /b 1

echo [test] Running the complete unit and integration test suite...
call npm test
if errorlevel 1 exit /b 1

echo [test] OK
exit /b 0
