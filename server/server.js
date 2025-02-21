const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
// 配置CORS和请求体解析
app.use(cors());
app.use(express.json());

// 配置静态文件服务
app.use(express.static(path.join(__dirname, '..'), {
  maxAge: '1h',
  etag: true
}));

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  if (err.response) {
    // API请求错误
    console.error('API响应错误:', err.response.data);
    res.status(err.response.status).json({
      error: '服务器请求失败',
      details: err.response.data
    });
  } else if (err.request) {
    // 请求未收到响应
    console.error('未收到API响应');
    res.status(504).json({
      error: '服务器网关超时',
      details: '未能收到API响应'
    });
  } else {
    // 其他错误
    res.status(500).json({
      error: '服务器内部错误',
      details: err.message
    });
  }
});

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
    // 验证API密钥
    if (!API_KEY) {
        return res.status(500).json({
            error: '服务器配置错误',
            details: 'API密钥未配置'
        });
    }

    try {
        const userMessage = req.body.message;

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
            responseType: 'stream',
            validateStatus: function (status) {
                return status >= 200 && status < 300; // 只接受2xx状态码
            }
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
                        }
                    }
                }
            });
        });

        response.data.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();
        });

    } catch (error) {
        console.error('请求处理失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 导出app实例供Vercel使用
module.exports = app;