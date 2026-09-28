<#
  Publication de MORA MIAKANJO sous IIS — À LANCER EN ADMINISTRATEUR.

  Ce script modifie la configuration de votre PC :
    1. Active le mode proxy d'ARR dans IIS (relais des requêtes /api vers Node).
    2. Autorise IIS à transmettre l'adresse IP réelle des visiteurs à Node (variable HTTP_X_FORWARDED_FOR).
    3. Crée le pool d'applications et le site IIS « MORA_MIAKANJO » sur le port choisi (8080 par défaut).
    4. Donne à IIS le droit de LIRE le dossier dist\ (le site compilé).
    5. OUVRE LE PORT dans le pare-feu Windows (entrées TCP) : le site devient joignable depuis le réseau.
    6. Crée la tâche planifiée « MORA_MIAKANJO API » qui démarre l'API Node au démarrage de Windows.

  Annulation : deploy\iis-remove.ps1 (en administrateur).
#>
param(
  [int]$Port = 8080,
  [string]$SiteName = 'MORA_MIAKANJO'
)
$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Ce script doit être lancé en administrateur (clic droit sur PowerShell > Exécuter en tant qu''administrateur).' -ForegroundColor Red
  exit 1
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
# Journal complet de l'exécution, lisible même si la fenêtre est fermée
New-Item -ItemType Directory -Force (Join-Path $root 'storage\logs') | Out-Null
Start-Transcript -Path (Join-Path $root 'storage\logs\iis-setup.log') -Force | Out-Null
trap { Write-Host "ERREUR : $_" -ForegroundColor Red; Stop-Transcript | Out-Null; exit 1 }
$dist = Join-Path $root 'dist'
$appcmd = "$env:windir\System32\inetsrv\appcmd.exe"
$taskName = 'MORA_MIAKANJO API'

function Step($text) { Write-Host "`n> $text" -ForegroundColor Cyan }

if (-not (Test-Path (Join-Path $dist 'index.html')) -or -not (Test-Path (Join-Path $dist 'web.config'))) {
  Write-Host "Site non compilé : lancez d'abord « npm run build » dans $root" -ForegroundColor Red
  exit 1
}

Step '1. Activation du proxy ARR'
& $appcmd set config -section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" /reverseRewriteHostInResponseHeaders:"False" /commit:apphost | Out-Null

Step '2. Autorisation de la variable HTTP_X_FORWARDED_FOR'
$vars = & $appcmd list config -section:system.webServer/rewrite/allowedServerVariables /commit:apphost
if (-not ($vars -match 'HTTP_X_FORWARDED_FOR')) {
  & $appcmd set config -section:system.webServer/rewrite/allowedServerVariables /+"[name='HTTP_X_FORWARDED_FOR']" /commit:apphost | Out-Null
}

Step "3. Pool d'applications et site IIS « $SiteName » (port $Port)"
if (-not (& $appcmd list apppool /name:$SiteName)) {
  & $appcmd add apppool /name:$SiteName /managedRuntimeVersion:"" /managedPipelineMode:Integrated | Out-Null
}
if (& $appcmd list site /name:$SiteName) {
  & $appcmd set site /site.name:$SiteName /bindings:"http/*:${Port}:" | Out-Null
  & $appcmd set vdir "$SiteName/" /physicalPath:"$dist" | Out-Null
} else {
  & $appcmd add site /name:$SiteName /bindings:"http/*:${Port}:" /physicalPath:"$dist" | Out-Null
}
& $appcmd set site /site.name:$SiteName /applicationDefaults.applicationPool:$SiteName | Out-Null
& $appcmd set app "$SiteName/" /applicationPool:$SiteName | Out-Null

Step '4. Droits de lecture de IIS sur dist\'
icacls $dist /grant 'IIS_IUSRS:(OI)(CI)RX' /grant 'IUSR:(OI)(CI)RX' /T /Q | Out-Null

Step "5. Pare-feu Windows : ouverture du port TCP $Port en entrée"
$ruleName = "MORA MIAKANJO (HTTP $Port)"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
}

Step "6. Tâche planifiée « $taskName » (API Node au démarrage)"
$action = New-ScheduledTaskAction -Execute (Join-Path $root 'deploy\start-production.cmd') -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
$principalTask = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principalTask -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Step 'Démarrage et vérification'
& $appcmd start apppool /apppool.name:$SiteName 2>$null | Out-Null
& $appcmd start site /site.name:$SiteName 2>$null | Out-Null
$ok = $false
for ($i = 0; $i -lt 20 -and -not $ok; $i++) {
  Start-Sleep -Seconds 2
  try { $ok = (Invoke-WebRequest "http://localhost:$Port/api/public/site" -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200 } catch {}
}

$lan = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127|169\.254)' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1).IPAddress
Write-Host ''
if ($ok) {
  Write-Host 'Site publié et API opérationnelle.' -ForegroundColor Green
} else {
  Write-Host "Le site ne répond pas encore : consultez $root\storage\logs\production.log" -ForegroundColor Yellow
}
Write-Host "  Sur ce PC          : http://localhost:$Port"
Write-Host "  Sur le réseau local: http://${lan}:$Port"
Write-Host "  Depuis Internet    : http://<votre IP publique>:$Port  (après redirection du port $Port sur votre box vers ${lan})"
Stop-Transcript | Out-Null
