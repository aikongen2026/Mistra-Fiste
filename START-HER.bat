@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Installer Node.js LTS forst.
 pause
 exit /b 1
)
if not exist node_modules\leaflet (
 call npm install --omit=dev
 if errorlevel 1 (pause & exit /b 1)
)
start "" http://localhost:3000
call npm start
pause
