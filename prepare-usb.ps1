#Requires -Version 5.1
<#
.SYNOPSIS
  Build a YayaPrintSetup folder on a USB drive (or any folder) for warehouse PCs.

.EXAMPLE
  cd C:\Users\You\Desktop\store1\print-agent\setup
  .\prepare-usb.ps1 -OutputPath E:\ -ProductionUrl "https://your-store.vercel.app"

.EXAMPLE
  .\prepare-usb.ps1 -OutputPath D:\YayaPrintSetup -ProductionUrl "https://your-store.vercel.app" -PrinterName "Xprinter XP-365B"
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $OutputPath,

  [Parameter(Mandatory = $true)]
  [string] $ProductionUrl,

  [string] $PrinterName = "Xprinter XP-365B",

  [string] $NodeVersion = "22.16.0",

  [switch] $SkipNpmInstall,

  [switch] $SkipPortableNode
)

$ErrorActionPreference = "Stop"

$setupDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$printAgentRoot = Resolve-Path (Join-Path $setupDir "print-agent")
$templateConfig = Join-Path $setupDir "print-agent.config.template.json"

if (-not (Test-Path $templateConfig)) {
  throw "Missing template: $templateConfig"
}

$productionUrl = $ProductionUrl.Trim().TrimEnd("/")
if ($productionUrl -notmatch "^https?://") {
  throw "ProductionUrl must start with http:// or https:// (got: $ProductionUrl)"
}

$usbRoot = Join-Path $OutputPath "YayaPrintSetup"
$targetAgent = Join-Path $usbRoot "print-agent"

if (-not (Test-Path -LiteralPath $OutputPath)) {
  New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
}

$resolvedOutput = (Resolve-Path -LiteralPath $OutputPath).Path
$resolvedAgentRoot = $printAgentRoot.Path

if ($resolvedOutput.StartsWith($resolvedAgentRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw @"
OutputPath must not be inside the print-agent folder (causes recursive copy).
Use a USB drive letter or a folder outside the repo, for example:
  -OutputPath E:\
  -OutputPath C:\Temp
"@
}

Write-Host ""
Write-Host "========================================"
Write-Host "  Prepare Yaya Print USB kit"
Write-Host "========================================"
Write-Host ""
Write-Host "Output:         $usbRoot"
Write-Host "Production URL: $productionUrl"
Write-Host "Printer name:   $PrinterName"
Write-Host ""

if (Test-Path $usbRoot) {
  Write-Host "Removing existing folder..."
  Remove-Item -LiteralPath $usbRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $targetAgent -Force | Out-Null

Write-Host "Copying print-agent..."
$exclude = @("node_modules", ".git", "setup")
Get-ChildItem -LiteralPath $printAgentRoot -Force | Where-Object {
  $exclude -notcontains $_.Name
} | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $targetAgent -Recurse -Force
}

Write-Host "Writing print-agent.config.json..."
$configTemplate = Get-Content -LiteralPath $templateConfig -Raw
$configJson = $configTemplate -replace "__PRODUCTION_URL__", $productionUrl
$configJson = $configJson -replace '"usbPrinterName": "Xprinter XP-365B"', "`"usbPrinterName`": `"$PrinterName`""
$configPath = Join-Path $targetAgent "print-agent.config.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configPath, $configJson, $utf8NoBom)

Write-Host "Copying launcher scripts..."
Copy-Item (Join-Path $setupDir "start-print-agent.bat") (Join-Path $usbRoot "START PRINT AGENT.bat") -Force
Copy-Item (Join-Path $setupDir "install-to-pc.bat") (Join-Path $usbRoot "INSTALL TO THIS PC.bat") -Force
Copy-Item (Join-Path $setupDir "resolve-node.bat") (Join-Path $usbRoot "resolve-node.bat") -Force
Copy-Item (Join-Path $setupDir "WAREHOUSE-STAFF.txt") $usbRoot -Force
Copy-Item (Join-Path $setupDir "IT-SETUP-GUIDE.md") (Join-Path $usbRoot "IT-SETUP-GUIDE.md") -Force

if (-not $SkipPortableNode) {
  $nodeTarget = Join-Path $usbRoot "node"
  $zipName = "node-v$NodeVersion-win-x64.zip"
  $nodeUrl = "https://nodejs.org/dist/v$NodeVersion/$zipName"
  $tempZip = Join-Path $env:TEMP $zipName
  $tempExtract = Join-Path $env:TEMP "yaya-node-$NodeVersion"

  Write-Host "Downloading portable Node.js $NodeVersion..."
  Invoke-WebRequest -Uri $nodeUrl -OutFile $tempZip -UseBasicParsing

  if (Test-Path $tempExtract) {
    Remove-Item -LiteralPath $tempExtract -Recurse -Force
  }

  Expand-Archive -LiteralPath $tempZip -DestinationPath $tempExtract -Force
  $extractedNode = Join-Path $tempExtract "node-v$NodeVersion-win-x64"

  if (-not (Test-Path $extractedNode)) {
    throw "Node archive did not extract to the expected folder: $extractedNode"
  }

  if (Test-Path $nodeTarget) {
    Remove-Item -LiteralPath $nodeTarget -Recurse -Force
  }

  New-Item -ItemType Directory -Path $nodeTarget -Force | Out-Null
  Copy-Item -Path (Join-Path $extractedNode "*") -Destination $nodeTarget -Recurse -Force

  Remove-Item -LiteralPath $tempZip -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $tempExtract -Recurse -Force -ErrorAction SilentlyContinue

  Write-Host "Portable Node.js ready in node\"
} else {
  Write-Host "Skipped portable Node (-SkipPortableNode). Warehouse PC needs Node 22 installed."
}

if (-not $SkipNpmInstall) {
  Write-Host "Running npm install (Windows binaries for node_modules)..."
  Push-Location $targetAgent
  try {
    & npm install
    if ($LASTEXITCODE -ne 0) {
      throw "npm install failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
} else {
  Write-Host "Skipped npm install (-SkipNpmInstall). Run npm install on the USB folder before deploying."
}

Write-Host ""
Write-Host "Done."
Write-Host ""
Write-Host "USB contents:"
Write-Host "  $usbRoot"
Write-Host "    START PRINT AGENT.bat      <- daily use (or after install-to-pc)"
Write-Host "    INSTALL TO THIS PC.bat     <- one-time copy to C:\YayaPrint"
Write-Host "    WAREHOUSE-STAFF.txt"
Write-Host "    IT-SETUP-GUIDE.md"
Write-Host "    node\                     <- portable Node.js (no separate install)"
Write-Host "    print-agent\"
Write-Host ""
Write-Host "Safely eject the USB drive, then follow IT-SETUP-GUIDE.md on the warehouse PC."
Write-Host ""
