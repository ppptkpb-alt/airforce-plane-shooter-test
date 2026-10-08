@echo off
setlocal
cd /d "%~dp0"

rem ---- build once if the game file is missing ----
if not exist "dist\index.html" (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo [Airforce Strike] dist\index.html not found and Node.js/npm is not installed.
    echo Install Node.js from https://nodejs.org then run this file again.
    pause
    exit /b 1
  )
  if not exist "node_modules" call npm install || goto :fail
  call npm run build || goto :fail
)

rem ---- open in Edge app mode (no browser toolbar), fallback to default browser ----
set "GAME_URL=file:///%~dp0dist/index.html"
set "GAME_URL=%GAME_URL:\=/%"
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" >nul 2>nul
if not errorlevel 1 (
  start "" msedge --app="%GAME_URL%" --window-size=720,960
) else (
  start "" "%~dp0dist\index.html"
)
exit /b 0

:fail
echo [Airforce Strike] build failed.
pause
exit /b 1
