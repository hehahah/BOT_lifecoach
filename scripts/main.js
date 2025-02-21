// 初始化页面元素
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const chatHistory = document.getElementById('chatHistory');
const moodButtons = document.querySelectorAll('.mood-btn');
const currentMoodDisplay = document.getElementById('currentMood');
const drawerToggle = document.getElementById('drawerToggle');
const historyDrawer = document.getElementById('historyDrawer');
const conversationHistory = document.getElementById('conversationHistory');

// 当前会话状态
let currentMood = '';
let currentConversationId = Date.now().toString();
let conversations = JSON.parse(localStorage.getItem('conversations') || '[]');

// 初始化心情选择器
moodButtons.forEach(button => {
    button.addEventListener('click', () => {
        moodButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentMood = button.dataset.mood;
        currentMoodDisplay.textContent = `当前心情：${getMoodText(currentMood)}`;
        updateAnalysis();
    });
});

// 初始化历史记录抽屉
drawerToggle.addEventListener('click', () => {
    historyDrawer.classList.toggle('open');
    updateConversationList();
});

// 获取心情文本
function getMoodText(mood) {
    const moodTexts = {
        happy: '开心',
        sad: '难过',
        angry: '生气',
        neutral: '平静'
    };
    return moodTexts[mood] || '未选择';
}

// 处理表单提交
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;

    // 添加用户消息到聊天历史
    appendMessage('user', message);
    userInput.value = '';

    try {
        // 显示正在输入提示
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message ai';
        typingIndicator.innerHTML = '<div class="message-content">对方正在输入...</div>';
        chatHistory.appendChild(typingIndicator);

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

        // 移除打字提示
        chatHistory.removeChild(typingIndicator);

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
                        if (parsed.error) {
                            aiMessageContent.textContent = `错误: ${parsed.error}`;
                            return;
                        }
                        if (parsed.content) {
                            aiMessage += parsed.content;
                            aiMessageContent.textContent = aiMessage;
                            // 自动滚动到底部
                            chatHistory.scrollTop = chatHistory.scrollHeight;
                        }
                    } catch (e) {
                        console.error('解析响应数据失败:', e);
                        aiMessageContent.textContent = '解析响应数据失败';
                    }
                }
            }
        }
    } catch (error) {
        console.error('请求失败:', error);
        appendMessage('ai', `错误: ${error.message}`);
    }
});

// 添加消息到聊天历史
function appendMessage(role, content) {
    const messageElement = createMessageElement(role, content);
    chatHistory.appendChild(messageElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // 保存到本地存储
    const message = {
        role,
        content,
        timestamp: Date.now(),
        mood: currentMood
    };

    let conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) {
        conversation = {
            id: currentConversationId,
            messages: [],
            startTime: Date.now()
        };
        conversations.push(conversation);
    }
    conversation.messages.push(message);
    localStorage.setItem('conversations', JSON.stringify(conversations));
    
    // 更新分析
    updateAnalysis();
}

// 更新对话列表
function updateConversationList() {
    conversationHistory.innerHTML = '';
    conversations.sort((a, b) => b.startTime - a.startTime).forEach(conversation => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        const preview = conversation.messages[0]?.content.slice(0, 50) + '...';
        item.textContent = preview;
        item.addEventListener('click', () => loadConversation(conversation.id));
        conversationHistory.appendChild(item);
    });
}

// 加载历史对话
function loadConversation(conversationId) {
    chatHistory.innerHTML = '';
    currentConversationId = conversationId;
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
        conversation.messages.forEach(msg => {
            const messageElement = createMessageElement(msg.role, msg.content);
            chatHistory.appendChild(messageElement);
        });
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
}

// 更新分析面板
function updateAnalysis() {
    // 情绪趋势分析
    const moodTrend = document.getElementById('moodTrend');
    if (!conversations || conversations.length === 0) {
        // 初始化示例数据
        moodTrend.textContent = '😊 开心: 5次\n😢 难过: 2次\n😠 生气: 1次\n😐 平静: 3次';
    } else {
        const moodCounts = conversations.flatMap(c => c.messages)
            .filter(m => m.mood)
            .reduce((acc, msg) => {
                acc[msg.mood] = (acc[msg.mood] || 0) + 1;
                return acc;
            }, {});
        moodTrend.textContent = Object.entries(moodCounts)
            .map(([mood, count]) => `${getMoodText(mood)}: ${count}次`)
            .join('\n');
    }

    // 关键话题分析
    const keyTopics = document.getElementById('keyTopics');
    if (!conversations || conversations.length === 0) {
        // 初始化示例数据
        keyTopics.textContent = '工作压力: 8次\n人际关系: 6次\n生活目标: 5次\n时间管理: 4次\n健康习惯: 3次';
    } else {
        const words = conversations.flatMap(c => c.messages)
            .filter(m => m.role === 'user')
            .flatMap(m => m.content.split(/\s+/))
            .reduce((acc, word) => {
                acc[word] = (acc[word] || 0) + 1;
                return acc;
            }, {});
        const topWords = Object.entries(words)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word, count]) => `${word}: ${count}次`)
            .join('\n');
        keyTopics.textContent = topWords;
    }

    // 建议摘要
    const suggestions = document.getElementById('suggestions');
    if (!conversations || conversations.length === 0) {
        // 初始化示例数据
        suggestions.textContent = '建议1: 尝试每天进行15分钟的冥想，帮助缓解压力...\n\n' +
            '建议2: 制定一个合理的作息时间表，保证充足的休息...\n\n' +
            '建议3: 多与家人朋友交流，保持良好的社交关系...';
    } else {
        const recentMessages = conversations.flatMap(c => c.messages)
            .filter(m => m.role === 'ai')
            .slice(-3)
            .map(m => m.content.slice(0, 50) + '...')
            .join('\n\n');
        suggestions.textContent = recentMessages;
    }
}

// 创建消息元素
function createMessageElement(message, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    return messageDiv;
}

function addMessage(message, isUser = false) {
    const chatHistory = document.getElementById('chatHistory');
    const messageElement = createMessageElement(message, isUser);
    chatHistory.appendChild(messageElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// 添加回车键发送消息功能
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});