$ErrorActionPreference = "Stop"

$projectRoot = "C:\Users\o\Documents\GitHub\ai-inbox"
$adbPath = "C:\Users\o\AppData\Local\Android\Sdk\platform-tools\adb.exe"

Write-Host "Cleaning up previous virtual drive Z:..."
try { cmd /c "subst Z: /D" } catch {}

Write-Host "Mapping Z: to project root..."
cmd /c "subst Z: $projectRoot"

if (-not (Test-Path "Z:\mobile\android")) {
    Write-Error "Failed to map drive correctly. Z:\mobile\android not found."
    exit 1
}

Write-Host "Building Release APK..."
Set-Location "Z:\mobile\android"
cmd /c "gradlew.bat assembleRelease"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed with exit code $LASTEXITCODE"
    Set-Location "$projectRoot\mobile"
    cmd /c "subst Z: /D"
    exit 1
}

Write-Host "Installing APK..."
Set-Location "$projectRoot\mobile"
& $adbPath install -r "android\app\build\outputs\apk\release\app-release.apk"

Write-Host "Cleaning up..."
cmd /c "subst Z: /D"

Write-Host "Done!"
