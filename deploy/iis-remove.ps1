<#
  Retire la publication IIS de MORA MIAKANJO — À LANCER EN ADMINISTRATEUR.
  Supprime le site et le pool IIS, la règle de pare-feu et la tâche planifiée, et arrête l'API de production.
  Ne touche ni au code, ni à la base de données, ni aux réglages ARR / URL Rewrite partagés par IIS.
#>
param([int]$Port = 8080, [string]$SiteName = 'MORA_MIAKANJO')
$ErrorActionPreference = 'Continue'
$appcmd = "$env:windir\System32\inetsrv\appcmd.exe"

& $appcmd stop site /site.name:$SiteName 2>$null | Out-Null
& $appcmd delete site $SiteName 2>$null | Out-Null
& $appcmd delete apppool $SiteName 2>$null | Out-Null
Get-NetFirewallRule -DisplayName "MORA MIAKANJO (HTTP $Port)" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Stop-ScheduledTask -TaskName 'MORA_MIAKANJO API' -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'MORA_MIAKANJO API' -Confirm:$false -ErrorAction SilentlyContinue
# Arrête le processus Node de production (port 3080)
Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Write-Host 'Publication IIS retirée : le site n''est plus accessible depuis le réseau.' -ForegroundColor Green
