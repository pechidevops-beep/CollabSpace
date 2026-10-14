$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==> Building collabspace-java:latest..." -ForegroundColor Cyan
docker build -t collabspace-java:latest -f "$scriptDir\java.Dockerfile" "$scriptDir"

Write-Host "==> Building collabspace-python:latest..." -ForegroundColor Cyan
docker build -t collabspace-python:latest -f "$scriptDir\python.Dockerfile" "$scriptDir"

Write-Host "==> Both Docker sandbox images built successfully." -ForegroundColor Green
