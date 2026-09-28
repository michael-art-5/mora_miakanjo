@echo off
rem Clic droit sur ce fichier puis "Executer en tant qu'administrateur".
rem Lance deploy\iis-setup.ps1 (publication du site sous IIS, port 8080).
net session >nul 2>&1
if errorlevel 1 goto pasadmin
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iis-setup.ps1"
echo.
echo Journal complet : %~dp0..\storage\logs\iis-setup.log
pause
exit /b 0
:pasadmin
echo.
echo Ce fichier doit etre lance EN ADMINISTRATEUR :
echo clic droit sur PUBLIER-SUR-IIS.bat puis "Executer en tant qu'administrateur".
echo.
pause
exit /b 1
