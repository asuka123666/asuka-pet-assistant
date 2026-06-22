$ProjectRoot = $PSScriptRoot
$ShortcutName = "Asuka Pet Assistant"
$TargetPath = "wscript.exe"
$TargetArgs = Join-Path $ProjectRoot "launch-hidden.vbs"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "$ShortcutName.lnk"

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.Arguments = $TargetArgs
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.WindowStyle = 7
$Shortcut.Description = "Launch Asuka Pet Assistant"

$IconCandidates = @(
  (Join-Path $ProjectRoot "app.ico"),
  (Join-Path $ProjectRoot "icon.ico")
)

foreach ($Icon in $IconCandidates) {
  if (Test-Path -LiteralPath $Icon) {
    $Shortcut.IconLocation = $Icon
    break
  }
}

$Shortcut.Save()
Write-Host "Created shortcut: $ShortcutPath"
