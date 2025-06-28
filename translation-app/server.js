require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// JSONリクエストボディをパースするためのミドルウェア
app.use(express.json());

// 静的ファイル（HTML, CSS, JS）を提供
app.use(express.static(path.join(__dirname, 'public')));

// 翻訳APIへのプロキシエンドポイント
app.post('/api/translate', async (req, res) => {
    const { text, from, to } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'APIキーがサーバーに設定されていません。' });
    }

    const fromLang = (from === 'ja-JP') ? '日本語' : 'メキシコスペイン語';
    const toLang = (to === 'ja-JP') ? '日本語' : 'メキシコスペイン語';
    const prompt = `以下のテキストを${fromLang}から${toLang}に翻訳してください。翻訳結果のテキストだけを返してください.\n\nテキスト: "${text}"`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}&alt=sse`;
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        }, { responseType: 'stream' });

        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    try {
                        const json = JSON.parse(jsonStr);
                        if (json.candidates && json.candidates[0].content.parts[0].text) {
                            // Send only the translated text as SSE
                            res.write(`data: ${JSON.stringify({ translatedText: json.candidates[0].content.parts[0].text })}\n\n`);
                        }
                    } catch (e) {
                        // Ignore JSON parse errors for incomplete lines
                    }
                }
            }
        });

        response.data.on('end', () => {
            res.end();
        });

    } catch (error) {
        console.error('Google API Error:', error.response ? error.response.data : error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: '翻訳中にエラーが発生しました。' });
        }
    }
});

app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました`);
});