const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

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
        // 检查API密钥配置
        if (!API_KEY) {
            console.error('API密钥未配置，请确保环境变量API_KEY已正确设置');
            throw new Error('API密钥未配置');
        }
        
        // 验证API密钥格式
        if (typeof API_KEY !== 'string' || !API_KEY.trim()) {
            console.error('API密钥格式无效');
            throw new Error('API密钥格式无效');
        }

        const userMessage = req.body.message;
        if (!userMessage) {
            throw new Error('消息内容不能为空');
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
        console.log('正在发送API请求到:', API_URL);
        console.log('请求头部:', JSON.stringify({ ...headers, Authorization: 'Bearer ****' }));
        
        const response = await axios.post(API_URL, requestData, {
            headers,
            timeout: 60000, // 60秒超时
            responseType: 'stream',
            validateStatus: function (status) {
                return status >= 200 && status < 300; // 只接受2xx的响应状态码
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
        console.error('请求处理失败:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        });

        // 根据错误类型返回适当的状态码
        if (error.response) {
            // API服务器返回了错误响应
            const status = error.response.status;
            const errorMessage = error.response.data?.error?.message || error.response.statusText || '服务器返回错误';
            res.status(status).json({
                error: errorMessage,
                details: `API服务器返回 ${status} 错误`
            });
        } else if (error.request) {
            // 请求已发出，但没有收到响应
            res.status(503).json({
                error: '无法连接到API服务器',
                details: error.message
            });
        } else {
            // 请求配置出错
            res.status(500).json({
                error: '服务器内部错误',
                details: error.message
            });
        }
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});