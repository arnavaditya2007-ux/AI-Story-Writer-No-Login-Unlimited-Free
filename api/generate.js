// Vercel Edge Runtime — 30s execution limit (vs 10s for serverless on Hobby plan)
export const config = { runtime: 'edge' };

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS });
    }

    if (req.method !== 'POST') {
        return json({ error: { message: 'Method not allowed' } }, 405);
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return json({ error: { message: 'Invalid JSON body' } }, 400);
    }

    const { messages, max_tokens } = body;

    if (!messages || !Array.isArray(messages)) {
        return json({ error: { message: 'Invalid request body' } }, 400);
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (geminiApiKey && geminiApiKey.trim() !== '') {
        // --- DIRECT GEMINI API FLOW ---
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

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.trim()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(geminiPayload)
            });

            const parsedRes = await response.json();

            if (!response.ok) {
                return json({ error: { message: parsedRes.error?.message || 'Gemini API Error' } }, response.status);
            }

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

            return json(openAiFormattedResponse);
        } catch (err) {
            return json({ error: { message: 'Gemini request failed: ' + err.message } }, 500);
        }

    } else {
        // --- OPENROUTER API FLOW ---
        const callOpenRouter = async (model) => {
            return fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                },
                body: JSON.stringify({
                    model,
                    max_tokens: max_tokens || 8192,
                    messages,
                }),
            });
        };

        try {
            const primaryModel = process.env.MODEL_ID || 'google/gemma-2-9b-it:free';
            let response = await callOpenRouter(primaryModel);
            let data = await response.json();

            // On 402 (insufficient credits) try fallback models
            if (response.status === 402) {
                const fallbacks = ['google/gemini-2.5-flash-lite', 'google/gemini-2.0-flash-001'];
                for (const model of fallbacks) {
                    try {
                        const fb = await callOpenRouter(model);
                        const fbData = await fb.json();
                        if (fb.ok) return json(fbData);
                        console.error(`Fallback ${model} failed:`, fbData);
                    } catch (e) {
                        console.error(`Error during fallback to ${model}:`, e);
                    }
                }
            }

            if (!response.ok) {
                return json({ error: { message: data?.error?.message || 'API error' } }, response.status);
            }

            return json(data);
        } catch (err) {
            console.error('Edge proxy error:', err);
            return json({ error: { message: 'Internal server error: ' + err.message } }, 500);
        }
    }
}
