$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$VbsLauncher = Join-Path $ScriptDir 'launch-app.vbs'
$IconPath = Join-Path $ProjectDir 'public\app-icon.ico'

$DesktopPath = [Environment]::GetFolderPath('Desktop')
$StartMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'

$WshShell = New-Object -ComObject WScript.Shell

function Create-AppShortcut([string]$ShortcutPath) {
  $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
  $Shortcut.TargetPath = 'wscript.exe'
  $Shortcut.Arguments = "//B `"$VbsLauncher`""
  $Shortcut.WorkingDirectory = $ProjectDir
  $Shortcut.Description = 'Launch SheetKanban Desktop App'
  if (Test-Path $IconPath) {
    $Shortcut.IconLocation = "$IconPath,0"
  }
  $Shortcut.Save()
}

Create-AppShortcut (Join-Path $DesktopPath 'SheetKanban.lnk')
Create-AppShortcut (Join-Path $StartMenuDir 'SheetKanban.lnk')

Write-Host "Installed one-click shortcuts:"
Write-Host "  Desktop:    $(Join-Path $DesktopPath 'SheetKanban.lnk')"
Write-Host "  Start Menu: $(Join-Path $StartMenuDir 'SheetKanban.lnk')"
