// 获取DOM元素
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const chatHistory = document.getElementById('chatHistory');

// 添加消息到聊天历史
function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = content;
    
    messageDiv.appendChild(messageContent);
    chatHistory.appendChild(messageDiv);
    
    // 滚动到最新消息
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// 处理用户提交
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // 显示用户消息
    addMessage(message, true);
    
    // 清空输入框
    userInput.value = '';
    
    try {
        // 发送请求到服务器
        const response = await fetch('http://localhost:3000/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        if (!response.ok) {
            throw new Error('网络请求失败');
        }
        
        // 创建新的消息元素用于AI回复
        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = 'message ai';
        const aiMessageContent = document.createElement('div');
        aiMessageContent.className = 'message-content';
        aiMessageDiv.appendChild(aiMessageContent);
        chatHistory.appendChild(aiMessageDiv);
        
        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponse = '';
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const text = decoder.decode(value);
            const lines = text.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            aiResponse += parsed.content;
                            aiMessageContent.textContent = aiResponse;
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
        addMessage('抱歉，发生了一些错误，请稍后重试。', false);
    }
});

// 自动调整输入框高度
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});