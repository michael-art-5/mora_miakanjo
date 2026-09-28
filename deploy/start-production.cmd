@echo off
rem Demarre l'API MORA MIAKANJO en production, derriere IIS (ecoute locale uniquement).
rem Lance au demarrage de Windows par la tache planifiee "MORA_MIAKANJO API".
cd /d "%~dp0.."
set NODE_ENV=production
set PORT=3080
set HOST=127.0.0.1
if not exist storage\logs mkdir storage\logs
"%ProgramFiles%\nodejs\node.exe" server\index.js --production >> storage\logs\production.log 2>&1
