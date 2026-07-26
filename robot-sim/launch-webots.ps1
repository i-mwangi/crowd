# Launches Webots with a clean PATH.
#
# Webots ships its own libcrypto-3-x64.dll but no libssl-3-x64.dll, so Windows
# falls back to searching PATH and can pick up an unrelated OpenSSL build —
# scoop's PostgreSQL is a common culprit. Mixing the two produces:
#
#   The procedure entry point OPENSSL_LH_set_thunks could not be located
#   in ...\postgresql\current\bin\libssl-3-x64.DLL
#
# Dropping scoop shims from PATH for this process only avoids the mismatch;
# nothing is uninstalled and other tools are unaffected.
#
# Usage (from robot-sim/):  .\launch-webots.ps1

$ErrorActionPreference = 'Stop'

$webots = 'C:\Program Files\Webots\msys64\mingw64\bin\webots.exe'
if (-not (Test-Path $webots)) {
    throw "Webots not found at $webots — adjust the path in this script."
}

$world = Join-Path $PSScriptRoot 'worlds\factory.wbt'
if (-not (Test-Path $world)) { throw "World not found: $world" }

# Keep every PATH entry except the ones that ship a conflicting OpenSSL.
$clean = ($env:PATH -split ';' | Where-Object {
    $_ -and $_ -notmatch 'scoop\\apps\\postgresql' -and $_ -notmatch 'scoop\\shims'
}) -join ';'

# Webots' own libraries take precedence.
$env:PATH = 'C:\Program Files\Webots\msys64\mingw64\bin;' + $clean

Write-Host "launching Webots with $world"
& $webots $world @args
