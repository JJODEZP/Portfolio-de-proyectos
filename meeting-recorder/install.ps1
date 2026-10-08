# Instala `meetnotes` como comando global en Windows (PowerShell).
# Uso:  powershell -ExecutionPolicy Bypass -File .\install.ps1
#       $env:EXTRAS = "capture,transcribe"; .\install.ps1   (sin IA para los apuntes)
$ErrorActionPreference = "Stop"
$extras = if ($env:EXTRAS) { $env:EXTRAS } else { "all" }
$src = $PSScriptRoot
$prefix = Join-Path $env:LOCALAPPDATA "meetnotes"

$py = Get-Command py -ErrorAction SilentlyContinue
$pyCmd = if ($py) { @("py", "-3") } else { @("python") }
& $pyCmd[0] $pyCmd[1..($pyCmd.Length)] -c "import sys; sys.exit(sys.version_info < (3,10))"
if ($LASTEXITCODE -ne 0) { throw "Se requiere Python 3.10+ (https://www.python.org/downloads/)" }

Write-Host "-> Creando entorno en $prefix"
& $pyCmd[0] $pyCmd[1..($pyCmd.Length)] -m venv "$prefix\venv"
& "$prefix\venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
& "$prefix\venv\Scripts\python.exe" -m pip install --quiet "$src[$extras]"

$scripts = "$prefix\venv\Scripts"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$scripts*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$scripts", "User")
    Write-Host "Se añadió $scripts al PATH. Abre una terminal nueva."
}
Write-Host "Instalado. Prueba con:  meetnotes devices"
