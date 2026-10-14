#!/bin/sh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Building collabspace-java:latest..."
docker build -t collabspace-java:latest -f "$DIR/java.Dockerfile" "$DIR"

echo "==> Building collabspace-python:latest..."
docker build -t collabspace-python:latest -f "$DIR/python.Dockerfile" "$DIR"

echo "==> Both Docker sandbox images built successfully."
