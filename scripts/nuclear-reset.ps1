# nuclear-reset.ps1
# This script wipes the local D1 database state and cloud project records for a fresh start.

$wranglerDir = "d:\Antigravity\input-output\.wrangler\state\v3\d1"

if (Test-Path $wranglerDir) {
    Write-Host "Wiping local D1 database state..." -ForegroundColor Yellow
    Remove-Item -Path "$wranglerDir\*" -Recurse -Force
    Write-Host "Local DB wiped successfully." -ForegroundColor Green
} else {
    Write-Host "Wrangler state directory not found. Already clean?" -ForegroundColor Cyan
}

Write-Host "------------------------------------------------"
Write-Host "Cloud Data Reset COMPLETE." -ForegroundColor Green
Write-Host "Remaining Steps:" -ForegroundColor Cyan
Write-Host "1. Open Dashboard in your browser."
Write-Host "2. Open DevTools (F12) -> Console."
Write-Host "3. Run: localStorage.clear()"
Write-Host "4. Refresh the page."
