# Restores worlds/factory.wbt to its committed state.
#
# Webots writes the live simulation back into the .wbt when the world is saved
# (Ctrl+S, or accepting "save changes?" on exit). That bakes in wherever the
# robots and cubes happened to be — and because the controllers drive by
# hardcoded distances from a known start pose, a displaced robot misses the
# cube on the next run. This throws away those drifted positions.
#
# Usage (from robot-sim/):  .\reset-world.ps1

$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    git checkout -- 'worlds/factory.wbt'
    Write-Host 'world restored to committed positions — reload it in Webots'
} finally {
    Pop-Location
}
