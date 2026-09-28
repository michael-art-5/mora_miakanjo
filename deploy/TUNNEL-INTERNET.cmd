@echo off
rem Ouvre un tunnel Cloudflare gratuit vers le site IIS (port 8080).
rem L'adresse publique https://....trycloudflare.com s'affiche ci-dessous (ligne "Your quick Tunnel").
rem Laisser cette fenetre ouverte : fermer la fenetre coupe l'acces depuis Internet.
cd /d "%~dp0"
tools\cloudflared.exe tunnel --no-autoupdate --url http://localhost:8080
pause
