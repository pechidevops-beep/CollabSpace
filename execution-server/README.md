# CollabSpace Execution Server

Docker-based multi-language code execution engine for CollabSpace.
Supports **full multi-file Java projects** (packages, imports) and **Python modules** — just like a real IDE.

## Structure

```
execution-server/
├── docker/
│   ├── java.Dockerfile      # OpenJDK 17 sandbox
│   └── python.Dockerfile    # Python 3.11 sandbox
├── src/
│   ├── index.js             # Express entry point (port 4000)
│   ├── routes/run.js        # POST /api/run
│   ├── executor/
│   │   ├── javaExecutor.js  # Detects main class, compiles all .java files
│   │   └── pythonExecutor.js# Detects entry point, sets PYTHONPATH
│   └── utils/
│       ├── fileSystem.js    # Temp dir creation & cleanup
│       └── docker.js        # Docker runner with limits
├── .env                     # Config (copy of .env.example)
└── start.ps1                # One-click Windows setup
```

## Prerequisites

- **Docker Desktop running** (Windows)
- Node.js 18+

## First-Time Setup (Windows PowerShell)

```powershell
cd execution-server

# 1. Build Docker sandbox images (only needed once)
docker build -f docker/java.Dockerfile -t collabspace-java .
docker build -f docker/python.Dockerfile -t collabspace-python .

# 2. Start the server
node src/index.js
```

Or use the provided script:
```powershell
.\start.ps1
```

## Running

```powershell
cd execution-server
node src/index.js
# → http://localhost:4000
```

## API

### `POST /api/run`

**Request:**
```json
{
  "language": "java",
  "files": [
    { "path": "src/com/project/Main.java", "content": "..." },
    { "path": "src/com/project/Helper.java", "content": "..." }
  ]
}
```

**Response:**
```json
{
  "stdout": "Hello from Helper!\n",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 1240
}
```

## Security

- No network access (`--network=none`)
- Memory limited to 128MB
- CPU limited to 0.5 cores
- 8 second execution timeout
- Non-root sandbox user
- Read-only filesystem mount

## Running Both Servers Together

Open **two terminals**:

**Terminal 1 — Frontend:**
```powershell
cd CollabSpace
npm run dev
```

**Terminal 2 — Execution Server:**
```powershell
cd CollabSpace/execution-server
node src/index.js
```
