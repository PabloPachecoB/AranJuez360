@echo off
cd /d "%~dp0"
node scripts\iniciar-red.mjs
if errorlevel 1 pause
