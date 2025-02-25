const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
// 配置CORS和请求体解析
app.use(cors());
app.use(express.json());

// 在Vercel环境中不需要指定端口，它会自动处理

// 配置静态文件服务
app.use(express.static(path.join(__dirname, '..')));

// API配置
const API_KEY = process.env.API_KEY;
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 系统提示词，定义AI角色
const SYSTEM_PROMPT = `你是一位专业的Life Coach，拥有丰富的个人成长和职业发展指导经验。你的目标是通过对话帮助用户发现自己的潜力，克服困难，实现个人成长。

在对话中，你应该：
1. 以同理心倾听用户的问题和困扰
2. 提供具体、可行的建议和指导
3. 鼓励用户积极思考和行动
4. 帮助用户制定合理的目标和计划
5. 保持专业、积极和支持的态度`;

// 处理聊天请求
app.post('/chat', async (req, res) => {
    try {
        if (!API_KEY) {
            console.error('API密钥未配置');
            return res.status(500).json({
                error: '服务器配置错误：API密钥未正确配置，请检查环境变量设置。',
                code: 'API_KEY_NOT_CONFIGURED'
            });
        }

        const userMessage = req.body.message;
        if (!userMessage) {
            return res.status(400).json({
                error: '消息内容不能为空',
                code: 'EMPTY_MESSAGE'
            });
        }

        // 准备请求数据
        const requestData = {
            model: 'deepseek-r1-250120',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.7,
            stream: true
        };

        // 设置请求头
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        };

        // 设置响应头，启用流式输出
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 发送API请求
        const response = await axios.post(API_URL, requestData, {
            headers,
            timeout: 60000, // 60秒超时
            responseType: 'stream'
        });

        // 处理流式响应
        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            lines.forEach(line => {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data !== '[DONE]') {
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0].delta.content;
                            if (content) {
                                res.write(`data: ${JSON.stringify({ content })}\n\n`);
                            }
                        } catch (e) {
                            console.error('解析响应数据失败:', e);
                            res.write(`data: ${JSON.stringify({ error: '解析响应数据失败' })}\n\n`);
                        }
                    }
                }
            });
        });

        response.data.on('error', (error) => {
            console.error('流数据处理错误:', error);
            res.write(`data: ${JSON.stringify({ error: '数据流处理错误' })}\n\n`);
            res.end();
        });

        response.data.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();
        });

    } catch (error) {
        console.error('请求处理失败:', error);
        const errorMessage = error.response?.data?.error?.message || error.message || '服务器内部错误';
        res.status(500).json({ error: errorMessage });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});