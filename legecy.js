"use strict";
// ==UserScript==
// @name         ContentGuard - AI Content Filter
// @namespace    https://your-namespace.com
// @version      1.0
// @description  AI-powered content filter with secure API key management
// @author       Your Name
// @match        *://*/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.deepseek.com
// @require      https://cdn.jsdelivr.net/npm/vue@3.2.47/dist/vue.global.prod.js
// ==/UserScript==
(function () {
    "use strict";
    // 2. 常量定义
    const CONFIG_KEY = "content_guard_config";
    const BUDGET_KEY = "content_guard_budget";
    const DEFAULT_CONFIG = {
        apiKey: "",
        baseUrl: "https://api.deepseek.com/v1",
        budgetLimit: 2.0,
        strictMode: true,
    };
    // 3. 样式定义
    GM_addStyle(`
        #content-guard-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 380px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            transition: all 0.3s ease;
            max-height: 90vh;
            overflow-y: auto;
        }
        
        #content-guard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 1px solid #eee;
        }
        
        #content-guard-title {
            font-size: 18px;
            font-weight: 600;
            color: #333;
        }
        
        #content-guard-close {
            cursor: pointer;
            font-size: 22px;
            color: #999;
            transition: color 0.2s;
        }
        
        #content-guard-close:hover {
            color: #333;
        }
        
        .config-section {
            margin-bottom: 20px;
        }
        
        .section-title {
            font-size: 15px;
            font-weight: 500;
            margin-bottom: 10px;
            color: #444;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-label {
            display: block;
            margin-bottom: 5px;
            font-size: 13px;
            color: #666;
        }
        
        .form-input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
            transition: border 0.2s;
        }
        
        .form-input:focus {
            border-color: #4d90fe;
            outline: none;
            box-shadow: 0 0 0 2px rgba(77, 144, 254, 0.2);
        }
        
        .form-input[type="password"] {
            letter-spacing: 1px;
        }
        
        .form-help {
            font-size: 12px;
            color: #888;
            margin-top: 5px;
        }
        
        .btn {
            padding: 10px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
        }
        
        .btn-primary {
            background-color: #4d90fe;
            color: white;
        }
        
        .btn-primary:hover {
            background-color: #3d7de0;
        }
        
        .btn-secondary {
            background-color: #f0f0f0;
            color: #333;
        }
        
        .btn-secondary:hover {
            background-color: #e0e0e0;
        }
        
        .btn-group {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        
        .status-message {
            padding: 10px;
            border-radius: 6px;
            margin-top: 15px;
            font-size: 13px;
        }
        
        .status-success {
            background-color: #e8f5e9;
            color: #2e7d32;
            border: 1px solid #c8e6c9;
        }
        
        .status-error {
            background-color: #ffebee;
            color: #c62828;
            border: 1px solid #ffcdd2;
        }
        
        .budget-info {
            padding: 12px;
            background: #f9f9f9;
            border-radius: 6px;
            border: 1px solid #eee;
            font-size: 13px;
        }
        
        .budget-meter {
            height: 6px;
            background: #e0e0e0;
            border-radius: 3px;
            margin: 8px 0;
            overflow: hidden;
        }
        
        .budget-progress {
            height: 100%;
            background: #4d90fe;
            border-radius: 3px;
            transition: width 0.5s ease;
        }
        
        .config-tabs {
            display: flex;
            margin-bottom: 15px;
            border-bottom: 1px solid #eee;
        }
        
        .tab-item {
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
            color: #666;
            border-bottom: 2px solid transparent;
        }
        
        .tab-item.active {
            color: #4d90fe;
            border-bottom-color: #4d90fe;
            font-weight: 500;
        }
    `);
    // 4. 配置管理函数
    async function getConfig() {
        try {
            const savedConfig = await GM.getValue(CONFIG_KEY);
            return { ...DEFAULT_CONFIG, ...savedConfig };
        }
        catch (error) {
            console.error("获取配置失败:", error);
            return DEFAULT_CONFIG;
        }
    }
    async function saveConfig(config) {
        try {
            await GM.setValue(CONFIG_KEY, config);
        }
        catch (error) {
            console.error("保存配置失败:", error);
        }
    }
    // 5. 预算管理函数
    async function getBudgetData() {
        try {
            const now = new Date();
            const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
            const budget = await GM.getValue(BUDGET_KEY, {});
            if (!budget[monthKey]) {
                budget[monthKey] = { tokensUsed: 0, cost: 0 };
            }
            return budget[monthKey];
        }
        catch (error) {
            console.error("获取预算数据失败:", error);
            return { tokensUsed: 0, cost: 0 };
        }
    }
    async function updateBudget(tokensUsed) {
        try {
            const now = new Date();
            const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
            const budget = await GM.getValue(BUDGET_KEY, {});
            if (!budget[monthKey]) {
                budget[monthKey] = { tokensUsed: 0, cost: 0 };
            }
            // 计算成本（简化为每百万token ¥2）
            const cost = tokensUsed * (2 / 1e6);
            budget[monthKey].tokensUsed += tokensUsed;
            budget[monthKey].cost += cost;
            await GM.setValue(BUDGET_KEY, budget);
        }
        catch (error) {
            console.error("更新预算失败:", error);
        }
    }
    // 6. 创建配置界面
    function createConfigUI() {
        // 创建容器
        const container = document.createElement("div");
        container.id = "content-guard-container";
        container.innerHTML = `
            <div id="content-guard-header">
                <div id="content-guard-title">ContentGuard 配置</div>
                <div id="content-guard-close">×</div>
            </div>
            <div class="config-tabs">
                <div class="tab-item active" data-tab="api">API 设置</div>
                <div class="tab-item" data-tab="budget">预算管理</div>
                <div class="tab-item" data-tab="behavior">行为设置</div>
            </div>
            <div id="config-content"></div>
        `;
        document.body.appendChild(container);
        // 获取DOM元素
        const closeButton = document.getElementById("content-guard-close");
        const configContent = document.getElementById("config-content");
        const tabItems = container.querySelectorAll(".tab-item");
        // 关闭按钮事件
        closeButton?.addEventListener("click", () => {
            container.style.display = "none";
        });
        // 标签页切换
        tabItems.forEach((tab) => {
            tab.addEventListener("click", () => {
                // 移除所有active类
                tabItems.forEach((t) => t.classList.remove("active"));
                // 添加active类到当前标签
                tab.classList.add("active");
                // 加载对应内容
                renderTabContent(tab.getAttribute("data-tab") || "api");
            });
        });
        // 初始加载API设置
        renderTabContent("api");
        // 渲染标签页内容
        async function renderTabContent(tabName) {
            if (!configContent)
                return;
            const config = await getConfig();
            const budgetData = await getBudgetData();
            const budgetPercentage = Math.min(100, (budgetData.cost / config.budgetLimit) * 100);
            switch (tabName) {
                case "api":
                    configContent.innerHTML = `
                        <div class="config-section">
                            <div class="section-title">API 设置</div>
                            
                            <div class="form-group">
                                <label class="form-label">DeepSeek API 密钥</label>
                                <input type="password" id="config-api-key" class="form-input" value="${config.apiKey}" placeholder="输入您的 API 密钥">
                                <div class="form-help">在 DeepSeek 平台创建 API 密钥</div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">API 基础 URL</label>
                                <input type="text" id="config-base-url" class="form-input" value="${config.baseUrl}">
                                <div class="form-help">通常不需要修改</div>
                            </div>
                        </div>
                        
                        <div class="btn-group">
                            <button id="save-config" class="btn btn-primary">保存设置</button>
                            <button id="test-api" class="btn btn-secondary">测试连接</button>
                        </div>
                        
                        <div id="api-status"></div>
                    `;
                    break;
                case "budget":
                    configContent.innerHTML = `
                        <div class="config-section">
                            <div class="section-title">预算管理</div>
                            
                            <div class="budget-info">
                                <div>本月已用: ¥${budgetData.cost.toFixed(4)}</div>
                                <div>预算上限: ¥${config.budgetLimit.toFixed(2)}</div>
                                <div class="budget-meter">
                                    <div class="budget-progress" style="width: ${budgetPercentage}%"></div>
                                </div>
                                <div>Token 使用: ${budgetData.tokensUsed.toLocaleString()}</div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">每月预算限制 (¥)</label>
                                <input type="number" id="config-budget" class="form-input" value="${config.budgetLimit}" min="0.5" step="0.1">
                                <div class="form-help">设置最大月预算，防止意外费用</div>
                            </div>
                        </div>
                        
                        <div class="btn-group">
                            <button id="save-budget" class="btn btn-primary">保存预算设置</button>
                            <button id="reset-budget" class="btn btn-secondary">重置本月使用</button>
                        </div>
                    `;
                    break;
                case "behavior":
                    configContent.innerHTML = `
                        <div class="config-section">
                            <div class="section-title">行为设置</div>
                            
                            <div class="form-group">
                                <label class="form-label">
                                    <input type="checkbox" id="config-strict-mode" ${config.strictMode ? "checked" : ""}>
                                    启用严格模式
                                </label>
                                <div class="form-help">严格模式会进行更全面的内容分析</div>
                            </div>
                        </div>
                        
                        <div class="btn-group">
                            <button id="save-behavior" class="btn btn-primary">保存设置</button>
                        </div>
                    `;
                    break;
            }
            // 绑定保存事件
            document.getElementById("save-config")?.addEventListener("click", saveApiConfig);
            document.getElementById("test-api")?.addEventListener("click", testApiConnection);
            document.getElementById("save-budget")?.addEventListener("click", saveBudgetConfig);
            document.getElementById("reset-budget")?.addEventListener("click", resetBudget);
            document.getElementById("save-behavior")?.addEventListener("click", saveBehaviorConfig);
        }
        // API 配置保存
        async function saveApiConfig() {
            const apiKeyInput = document.getElementById("config-api-key");
            const baseUrlInput = document.getElementById("config-base-url");
            if (!apiKeyInput || !baseUrlInput)
                return;
            const config = await getConfig();
            config.apiKey = apiKeyInput.value.trim();
            config.baseUrl = baseUrlInput.value.trim();
            await saveConfig(config);
            showStatus("配置已保存!", true);
        }
        // 预算配置保存
        async function saveBudgetConfig() {
            const budgetInput = document.getElementById("config-budget");
            if (!budgetInput)
                return;
            const newBudget = parseFloat(budgetInput.value);
            if (isNaN(newBudget))
                return;
            const config = await getConfig();
            config.budgetLimit = newBudget;
            await saveConfig(config);
            showStatus("预算设置已更新!", true);
            renderTabContent("budget"); // 刷新显示
        }
        // 行为配置保存
        async function saveBehaviorConfig() {
            const strictModeInput = document.getElementById("config-strict-mode");
            if (!strictModeInput)
                return;
            const config = await getConfig();
            config.strictMode = strictModeInput.checked;
            await saveConfig(config);
            showStatus("行为设置已保存!", true);
        }
        // 重置预算
        async function resetBudget() {
            try {
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
                const budget = await GM.getValue(BUDGET_KEY, {});
                if (budget[monthKey]) {
                    budget[monthKey] = { tokensUsed: 0, cost: 0 };
                    await GM.setValue(BUDGET_KEY, budget);
                    showStatus("本月预算数据已重置!", true);
                    renderTabContent("budget"); // 刷新显示
                }
            }
            catch (error) {
                console.error("重置预算失败:", error);
                showStatus("重置预算失败!", false);
            }
        }
        // 测试 API 连接
        async function testApiConnection() {
            const statusDiv = document.getElementById("api-status");
            if (!statusDiv)
                return;
            const config = await getConfig();
            if (!config.apiKey) {
                showStatus("请先输入 API 密钥!", false);
                return;
            }
            showStatus("正在测试 API 连接...", true);
            try {
                const response = await callDeepSeekAPI('请回复"OK"表示连接成功', 5);
                if (response && response.includes("OK")) {
                    showStatus("API 连接成功!", true);
                }
                else {
                    showStatus("API 响应异常", false);
                }
            }
            catch (error) {
                if (error instanceof Error)
                    showStatus(`连接失败: ${error.message}`, false);
                else
                    showStatus("连接失败", false);
            }
        }
        // 显示状态消息
        function showStatus(message, isSuccess) {
            const statusDiv = document.getElementById("api-status");
            if (!statusDiv)
                return;
            statusDiv.className = `status-message ${isSuccess ? "status-success" : "status-error"}`;
            statusDiv.textContent = message;
            // 5秒后自动清除
            setTimeout(() => {
                statusDiv.textContent = "";
                statusDiv.className = "status-message";
            }, 5000);
        }
    }
    // 7. API 调用函数
    async function callDeepSeekAPI(prompt, maxTokens = 100) {
        console.log("callDeepSeekAPI", prompt);
        const config = await getConfig();
        if (!config.apiKey) {
            console.error("API 密钥未配置");
            return null;
        }
        try {
            const requestData = {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                max_tokens: maxTokens,
                temperature: 0.7,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            };
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "POST",
                    url: `${config.baseUrl}/chat/completions`,
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${config.apiKey}`,
                    },
                    data: JSON.stringify(requestData),
                    responseType: "json",
                    timeout: 10000,
                    onload: function (response) {
                        if (response.status >= 200 && response.status < 300) {
                            const data = response.response;
                            if (data.choices && data.choices.length > 0) {
                                const result = data.choices[0].message.content;
                                // 更新预算
                                const tokensUsed = data.usage?.total_tokens || 100;
                                updateBudget(tokensUsed);
                                resolve(result);
                            }
                            else {
                                reject(new Error("API 响应格式错误"));
                            }
                        }
                        else {
                            const error = response.response?.error?.message || response.statusText;
                            reject(new Error(`API 错误: ${response.status} - ${error}`));
                        }
                    },
                    onerror: function (error) {
                        reject(new Error(`网络错误: ${error}`));
                    },
                    ontimeout: function () {
                        reject(new Error("请求超时"));
                    },
                });
            });
        }
        catch (error) {
            console.error("API 调用失败:", error);
            return null;
        }
    }
    // 8. 初始化函数
    async function initContentGuard() {
        // 检查是否已存在容器
        if (document.getElementById("content-guard-container"))
            return;
        // 创建配置按钮
        const configButton = document.createElement("button");
        configButton.textContent = "⚙️ ContentGuard";
        configButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99998;
            background: #4d90fe;
            color: white;
            border: none;
            border-radius: 20px;
            padding: 8px 16px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;
        configButton.addEventListener("mouseenter", () => {
            configButton.style.transform = "scale(1.05)";
            configButton.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
        });
        configButton.addEventListener("mouseleave", () => {
            configButton.style.transform = "scale(1)";
            configButton.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
        });
        configButton.addEventListener("click", () => {
            createConfigUI();
        });
        document.body.appendChild(configButton);
        // 首次运行检查
        const config = await getConfig();
        if (!config.apiKey) {
            setTimeout(() => {
                createConfigUI();
                const statusDiv = document.getElementById("api-status");
                if (statusDiv) {
                    statusDiv.className = "status-message status-error";
                    statusDiv.textContent = "请配置 API 密钥以启用内容过滤功能";
                }
            }, 2000);
        }
    }
    // 9. 启动脚本
    initContentGuard();
})();
