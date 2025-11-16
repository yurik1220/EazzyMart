@echo off
cd /d "%~dp0"
echo Starting Grocery Store Backend...
start /min cmd /c "npm start"
exit