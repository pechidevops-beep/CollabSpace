# CollabSpace Execution Server — Windows Setup & Start
# Run this in PowerShell after Docker Desktop is fully started

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CollabSpace Docker Execution Engine" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Build Java sandbox image
Write-Host "`n[1/3] Building Java sandbox image (collabspace-java)..." -ForegroundColor Yellow
docker build -f docker/java.Dockerfile -t collabspace-java .
Write-Host "Java image built!" -ForegroundColor Green

# 2. Build Python sandbox image
Write-Host "`n[2/3] Building Python sandbox image (collabspace-python)..." -ForegroundColor Yellow
docker build -f docker/python.Dockerfile -t collabspace-python .
Write-Host "Python image built!" -ForegroundColor Green

# 3. Start the execution server
Write-Host "`n[3/3] Starting execution server on http://localhost:4000..." -ForegroundColor Yellow
node src/index.js
