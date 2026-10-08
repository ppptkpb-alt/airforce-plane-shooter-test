@echo off
setlocal
cd /d "%~dp0"

rem ---- rebuild after editing src\ then launch the game ----
if not exist "node_modules" call npm install || goto :fail
call npm run build || goto :fail
call "%~dp0play.bat"
exit /b 0

:fail
echo [Airforce Strike] build failed.
pause
exit /b 1
