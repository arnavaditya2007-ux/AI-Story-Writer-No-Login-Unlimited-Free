const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables from .env manually to avoid external dependencies
const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
        if (match) {
            let val = match[2].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.substring(1, val.length - 1);
            }
            env[match[1]] = val;
        }
    });
}

const PORT = 3001;
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const parsedBody = JSON.parse(body);
                const { messages, max_tokens } = parsedBody;

                const geminiApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

                if (geminiApiKey && geminiApiKey.trim() !== '') {
                    // --- DIRECT GEMINI API FLOW ---
                    // Convert OpenAI messages array to Gemini contents & systemInstruction
                    let systemInstruction = '';
                    const contents = [];

                    messages.forEach(msg => {
                        if (msg.role === 'system') {
                            systemInstruction = msg.content;
                        } else {
                            contents.push({
                                role: msg.role === 'assistant' ? 'model' : 'user',
                                parts: [{ text: msg.content }]
                            });
                        }
                    });

                    const geminiPayload = {
                        contents: contents,
                        generationConfig: {
                            maxOutputTokens: max_tokens || 8192
                        }
                    };

                    if (systemInstruction) {
                        geminiPayload.systemInstruction = {
                            parts: [{ text: systemInstruction }]
                        };
                    }

                    const postData = JSON.stringify(geminiPayload);
                    const options = {
                        hostname: 'generativelanguage.googleapis.com',
                        port: 443,
                        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.trim()}`,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        }
                    };

                    const proxyReq = https.request(options, (proxyRes) => {
                        let responseBody = '';
                        proxyRes.on('data', chunk => { responseBody += chunk; });
                        proxyRes.on('end', () => {
                            try {
                                const parsedRes = JSON.parse(responseBody);
                                if (proxyRes.statusCode !== 200) {
                                    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: { message: parsedRes.error?.message || 'Gemini API Error' } }));
                                    return;
                                }

                                // Convert Gemini response format back to OpenAI choices format
                                const generatedText = parsedRes.candidates?.[0]?.content?.parts?.[0]?.text || '';
                                const openAiFormattedResponse = {
                                    choices: [
                                        {
                                            message: {
                                                role: 'assistant',
                                                content: generatedText
                                            }
                                        }
                                    ]
                                };

                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify(openAiFormattedResponse));
                            } catch (e) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: { message: 'Failed to parse Gemini response: ' + e.message } }));
                            }
                        });
                    });

                    proxyReq.on('error', (e) => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: { message: 'Gemini request failed: ' + e.message } }));
                    });

                    proxyReq.write(postData);
                    proxyReq.end();

                } else {
                    // --- OPENROUTER API FLOW ---
                    const openRouterKey = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
                    const modelId = env.MODEL_ID || process.env.MODEL_ID || 'google/gemma-2-9b-it:free';

                    const postData = JSON.stringify({
                        model: modelId,
                        messages: messages,
                        max_tokens: max_tokens || 8192
                    });

                    const options = {
                        hostname: 'openrouter.ai',
                        port: 443,
                        path: '/api/v1/chat/completions',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${openRouterKey}`,
                            'Content-Length': Buffer.byteLength(postData)
                        }
                    };

                    const proxyReq = https.request(options, (proxyRes) => {
                        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                        proxyRes.pipe(res);
                    });

                    proxyReq.on('error', (e) => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: { message: 'OpenRouter proxy request failed: ' + e.message } }));
                    });

                    proxyReq.write(postData);
                    proxyReq.end();
                }

            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: 'Invalid JSON request body: ' + err.message } }));
            }
        });
        return;
    }

    let reqPath = req.url.split('?')[0];
    let filePath = path.join(__dirname, reqPath === '/' ? 'index.html' : reqPath);
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`AI Story Generator running locally at http://localhost:${PORT}/`);
});
