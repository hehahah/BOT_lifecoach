// 初始化页面元素
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const chatHistory = document.getElementById('chatHistory');

// 处理表单提交
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;

    // 添加用户消息到聊天历史
    appendMessage('user', message);
    userInput.value = '';

    try {
        // 发送请求到服务器
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '网络请求失败');
        }

        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiMessage = '';

        // 创建AI消息容器
        const aiMessageElement = createMessageElement('ai', '');
        chatHistory.appendChild(aiMessageElement);
        const aiMessageContent = aiMessageElement.querySelector('.message-content');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        break;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            aiMessage += parsed.content;
                            aiMessageContent.textContent = aiMessage;
                            // 自动滚动到底部
                            chatHistory.scrollTop = chatHistory.scrollHeight;
                        }
                    } catch (e) {
                        console.error('解析响应数据失败:', e);
                    }
                }
            }
        }
    } catch (error) {
        console.error('请求失败:', error);
        appendMessage('ai', '抱歉，发生了一些错误，请稍后再试。');
    }
});

// 添加消息到聊天历史
function appendMessage(role, content) {
    const messageElement = createMessageElement(role, content);
    chatHistory.appendChild(messageElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// 创建消息元素
function createMessageElement(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    return messageDiv;
}