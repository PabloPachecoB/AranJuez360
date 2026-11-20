@echo off
rem Abre el panel visual de pruebas e2e (Playwright UI). Levanta backend y web de prueba solo.
cd /d "%~dp0e2e"
if not exist node_modules call npm install
call npx playwright test --ui
