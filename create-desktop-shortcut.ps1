$ProjectRoot = $PSScriptRoot
$ShortcutName = "Asuka Pet Assistant"
$TargetPath = Join-Path $ProjectRoot "start-pet.bat"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "$ShortcutName.lnk"

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $ProjectRoot
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
