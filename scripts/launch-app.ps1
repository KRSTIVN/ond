$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$Port = 5173
$BaseUrl = "http://127.0.0.1:$Port"
$HealthUrl = "$BaseUrl/api/health"

function Test-ServerReady {
  try {
    $resp = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
    return $resp.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-ServerReady)) {
  $DistIndex = Join-Path $ProjectDir 'dist\index.html'
  if (-not (Test-Path $DistIndex)) {
    Push-Location $ProjectDir
    & npm.cmd run build | Out-Null
    Pop-Location
  }

  Start-Process -FilePath 'node' `
    -ArgumentList 'server.mjs' `
    -WorkingDirectory $ProjectDir `
    -WindowStyle Hidden

  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 150
    if (Test-ServerReady) { break }
  }
}

$ChromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)

$BrowserExe = $ChromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($BrowserExe) {
  Start-Process -FilePath $BrowserExe -ArgumentList "--app=$BaseUrl", "--window-size=1440,900"
} else {
  Start-Process $BaseUrl
}
