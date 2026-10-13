require('dotenv').config();
const express = require('express');
const cors = require('cors');
const runRouter = require('./routes/run');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/run', runRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`🚀 CollabSpace Execution Server running on http://localhost:${PORT}`);
    console.log(`   Java image:   ${process.env.JAVA_IMAGE || 'collabspace-java'}`);
    console.log(`   Python image: ${process.env.PYTHON_IMAGE || 'collabspace-python'}`);
    console.log(`   Timeout:      ${process.env.EXECUTION_TIMEOUT_MS || 8000}ms`);
});
