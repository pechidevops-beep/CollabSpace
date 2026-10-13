#!/bin/bash
# CollabSpace Execution Server — Setup & Start Script
# Run this once after cloning / setting up the project

set -e

echo "========================================"
echo "  CollabSpace Docker Execution Engine"
echo "========================================"

# 1. Build Docker sandbox images
echo ""
echo "[1/3] Building Java sandbox image (collabspace-java)..."
docker build -f docker/java.Dockerfile -t collabspace-java .

echo ""
echo "[2/3] Building Python sandbox image (collabspace-python)..."
docker build -f docker/python.Dockerfile -t collabspace-python .

# 2. Install Node deps (if not already done)
echo ""
echo "[3/3] Starting execution server..."
node src/index.js
