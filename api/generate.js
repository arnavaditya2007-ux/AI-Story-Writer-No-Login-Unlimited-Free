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
        return json({ error: 'Method not allowed' }, 405);
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return json({ error: 'Invalid JSON body' }, 400);
    }

    const { messages, max_tokens } = body;

    if (!messages || !Array.isArray(messages)) {
        return json({ error: 'Invalid request body' }, 400);
    }

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
        const primaryModel = process.env.MODEL_ID || 'google/gemini-2.5-flash';
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
            return json({ error: data?.error?.message || 'API error' }, response.status);
        }

        return json(data);
    } catch (err) {
        console.error('Edge proxy error:', err);
        return json({ error: 'Internal server error: ' + err.message }, 500);
    }
}
