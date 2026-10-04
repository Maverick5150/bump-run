<#
.SYNOPSIS
  Installs (or updates) the BUMP RUN debug APK on a Fire TV / Android TV device over ADB.

.PARAMETER DeviceIp
  The Fire TV's IP address (Settings -> My Fire TV -> About -> Network, or
  Settings -> Device & Software -> About on some Fire OS versions).

.PARAMETER ApkPath
  Path to the APK. Defaults to the standard debug APK output location.

.EXAMPLE
  .\scripts\install-firetv.ps1 -DeviceIp 192.168.1.123
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$DeviceIp,

    [string]$ApkPath = "$PSScriptRoot\..\apps\tv\app\build\outputs\apk\debug\app-debug.apk",

    [int]$Port = 5555
)

$adb = "adb"
if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    $sdkAdb = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
    if (Test-Path $sdkAdb) { $adb = $sdkAdb }
    else {
        Write-Error "adb not found. Set ANDROID_HOME or add platform-tools to PATH."
        exit 1
    }
}

if (-not (Test-Path $ApkPath)) {
    Write-Error "APK not found at $ApkPath. Run 'npm run apk:debug' first."
    exit 1
}

Write-Host "Connecting to Fire TV at ${DeviceIp}:${Port} ..."
& $adb connect "${DeviceIp}:${Port}" 2>&1 | Write-Host

Write-Host "Installing $ApkPath ..."
$installOutput = & $adb -s "${DeviceIp}:${Port}" install -r $ApkPath 2>&1
Write-Host $installOutput

if ($installOutput -match "Success") {
    Write-Host "`nBUMP RUN installed successfully. Find it under Apps on the Fire TV home screen." -ForegroundColor Green
} else {
    Write-Error "Install failed. See output above. Common causes: ADB debugging not enabled on the device, or wrong IP."
    exit 1
}
