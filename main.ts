// ==UserScript==
// @name         ContentGuard - AI Content Filter
// @namespace    https://your-namespace.com
// @version      1.0
// @description  AI-powered content filter with secure API key management
// @author       normalpcer & DeepSeek R1
// @match        *://*/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.deepseek.com
// @require      https://cdn.jsdelivr.net/npm/vue@3.2.47/dist/vue.global.prod.js
// ==/UserScript==

const STYLE = `
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
`;

namespace ContentGuard {
    /**
     * 配置文件相关
     * @author DeepSeek R1
     */
    export namespace Config {
        // 应用基本配置
        export interface AppConfig {
            apiKey: string; // api-key
            baseUrl: string; // api url 地址
            budgetLimit: number; // 预算限制，单位为字符数
            strictMode: boolean; // 严格模式
        }

        // 预算相关数据
        export interface BudgetData {
            tokensUsed: number; // 已使用的字符数
        }

        // 配置文件键名
        const KEY_PREFIX = "content_guard_";
        const CONFIG_KEY = KEY_PREFIX + "config";
        const BUDGET_KEY = KEY_PREFIX + "budget";

        // 默认配置
        const DEFAULT_CONFIG: AppConfig = {
            apiKey: "",
            baseUrl: "https://api.deepseek.com/v1",
            budgetLimit: 2000.0,
            strictMode: true,
        };

        // 获取配置
        export async function getConfig(): Promise<AppConfig> {
            try {
                const savedConfig = await GM.getValue<AppConfig>(CONFIG_KEY);
                return { ...DEFAULT_CONFIG, ...savedConfig };
            } catch (error) {
                console.error("获取配置失败:", error);
                return DEFAULT_CONFIG;
            }
        }

        // 保存配置
        export async function saveConfig(config: AppConfig): Promise<void> {
            try {
                await GM.setValue(CONFIG_KEY, config);
            } catch (error) {
                console.error("保存配置失败:", error);
            }
        }

        export async function getBudgetData(): Promise<BudgetData> {
            try {
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
                const budget = await GM.getValue<Record<string, BudgetData>>(BUDGET_KEY, {});

                if (!budget[monthKey]) {
                    budget[monthKey] = { tokensUsed: 0 };
                }

                return budget[monthKey];
            } catch (error) {
                console.error("获取预算数据失败:", error);
                return { tokensUsed: 0 };
            }
        }

        export async function updateBudget(tokensUsed: number): Promise<void> {
            try {
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
                const budget = await GM.getValue<Record<string, BudgetData>>(BUDGET_KEY, {});

                if (!budget[monthKey]) {
                    budget[monthKey] = { tokensUsed: 0 };
                }
                budget[monthKey].tokensUsed += tokensUsed;

                await GM.setValue(BUDGET_KEY, budget);
            } catch (error) {
                console.error("更新预算失败:", error);
            }
        }

        // 创建配置界面
        export function createConfigUI() {
            const CONTAINER_ID = "content-guard-container";
            // 如果容器存在，直接显示它
            let container = document.getElementById(CONTAINER_ID);
            if (container !== null) {
                container.style.display = "block";
                return;
            }

            // 创建容器
            container = document.createElement("div");
            container.id = CONTAINER_ID;
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
            async function renderTabContent(tabName: string) {
                if (!configContent) return;

                const config = await getConfig();
                const budgetData = await getBudgetData();
                const budgetPercentage = Math.min(
                    100,
                    (budgetData.tokensUsed / config.budgetLimit) * 100
                );

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
                        const currentLimit = config.budgetLimit / 1000;
                        const formated = Number.isInteger(currentLimit)
                            ? currentLimit.toString()
                            : currentLimit.toFixed(3);
                        configContent.innerHTML = `
                        <div class="config-section">
                            <div class="section-title">预算管理</div>
                            
                            <div class="budget-info">
                                <div>本月已用 token: ${(budgetData.tokensUsed / 1000).toFixed(
                                    2
                                )} K</div>
                                <div>预算上限 token: ${(config.budgetLimit / 1000).toFixed(
                                    2
                                )} K</div>
                                <div class="budget-meter">
                                    <div class="budget-progress" style="width: ${budgetPercentage}%"></div>
                                </div>
                                <div>Token 使用: ${budgetData.tokensUsed.toLocaleString()}</div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">每月预算限制 (千 token)</label>
                                <input type="number" id="config-budget" class="form-input" value="${formated}" min="0.5" step="0.1">
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
                                    <input type="checkbox" id="config-strict-mode" ${
                                        config.strictMode ? "checked" : ""
                                    }>
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
                document
                    .getElementById("save-behavior")
                    ?.addEventListener("click", saveBehaviorConfig);
            }

            // API 配置保存
            async function saveApiConfig() {
                const apiKeyInput = document.getElementById("config-api-key") as HTMLInputElement;
                const baseUrlInput = document.getElementById("config-base-url") as HTMLInputElement;

                if (!apiKeyInput || !baseUrlInput) return;

                const config = await getConfig();
                config.apiKey = apiKeyInput.value.trim();
                config.baseUrl = baseUrlInput.value.trim();

                await saveConfig(config);
                showStatus("配置已保存!", true);
            }

            // 预算配置保存
            async function saveBudgetConfig() {
                const budgetInput = document.getElementById("config-budget") as HTMLInputElement;
                if (!budgetInput) return;

                const newBudget = parseFloat(budgetInput.value);
                if (isNaN(newBudget)) return;

                const config = await getConfig();
                config.budgetLimit = newBudget * 1000; // KB -> chars

                await saveConfig(config);
                showStatus("预算设置已更新!", true);
                renderTabContent("budget"); // 刷新显示
            }

            // 行为配置保存
            async function saveBehaviorConfig() {
                const strictModeInput = document.getElementById(
                    "config-strict-mode"
                ) as HTMLInputElement;
                if (!strictModeInput) return;

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
                    const budget = await GM.getValue<Record<string, BudgetData>>(BUDGET_KEY, {});

                    if (budget[monthKey]) {
                        budget[monthKey] = { tokensUsed: 0 };
                        await GM.setValue(BUDGET_KEY, budget);
                        showStatus("本月预算数据已重置!", true);
                        renderTabContent("budget"); // 刷新显示
                    }
                } catch (error) {
                    console.error("重置预算失败:", error);
                    showStatus("重置预算失败!", false);
                }
            }

            // 测试 API 连接
            async function testApiConnection() {
                const statusDiv = document.getElementById("api-status");
                if (!statusDiv) return;

                const config = await getConfig();

                if (!config.apiKey) {
                    showStatus("请先输入 API 密钥!", false);
                    return;
                }

                showStatus("正在测试 API 连接...", true);

                try {
                    const response = await AITools.callAPI('请回复"OK"表示连接成功', 5);

                    if (response && response.includes("OK")) {
                        showStatus("API 连接成功!", true);
                    } else {
                        showStatus("API 响应异常", false);
                    }
                } catch (error) {
                    if (error instanceof Error) showStatus(`连接失败: ${error.message}`, false);
                    else showStatus("连接失败", false);
                }
            }

            // 显示状态消息
            function showStatus(message: string, isSuccess: boolean) {
                const statusDiv = document.getElementById("api-status");
                if (!statusDiv) return;

                statusDiv.className = `status-message ${
                    isSuccess ? "status-success" : "status-error"
                }`;
                statusDiv.textContent = message;

                // 5秒后自动清除
                setTimeout(() => {
                    statusDiv.textContent = "";
                    statusDiv.className = "status-message";
                }, 5000);
            }
        }
    }

    /**
     * 人工智能相关交互
     * @author DeepSeek R1
     */
    export namespace AITools {
        export async function callAPI(prompt: string, maxTokens = 100): Promise<string | null> {
            console.log("callAPI", prompt);

            const config = await Config.getConfig();

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
                                    Config.updateBudget(tokensUsed);

                                    console.log("API result", result);
                                    resolve(result);
                                } else {
                                    reject(new Error("API 响应格式错误"));
                                }
                            } else {
                                const error =
                                    response.response?.error?.message || response.statusText;
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
            } catch (error) {
                console.error("API 调用失败:", error);
                return null;
            }
        }
    }

    /**
     * 网页采样工具
     * @author DeepSeek R1
     */
    export namespace WebSampler {
        const DEFAULT_MAX_LENGTH = 1000;
        const DEFAULT_SAMPLE_RATE = 0.3;

        // 公共接口：采样页面内容
        export function sampleContent(maxLength: number = DEFAULT_MAX_LENGTH): string {
            try {
                const fullContent = getVisiblePageContent();
                return sampleContentBySections(fullContent, maxLength);
            } catch (e) {
                console.error("内容采样失败:", e);
                return "";
            }
        }

        // 获取整个页面的可见文本内容
        function getVisiblePageContent(): string {
            const visibleNodes: { node: Node; text: string }[] = [];

            const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                acceptNode: function (node: Node) {
                    const parent = node.parentNode as HTMLElement;
                    if (
                        !parent ||
                        parent.nodeName === "SCRIPT" ||
                        parent.nodeName === "STYLE" ||
                        parent.nodeName === "NOSCRIPT"
                    ) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return isElementVisible(parent)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                },
            });

            while (treeWalker.nextNode()) {
                const text = treeWalker.currentNode.textContent?.trim() || "";
                if (text.length > 1) {
                    visibleNodes.push({
                        node: treeWalker.currentNode,
                        text: text,
                    });
                }
            }

            visibleNodes.sort((a, b) => {
                const posA = getElementPosition(a.node.parentNode as HTMLElement);
                const posB = getElementPosition(b.node.parentNode as HTMLElement);
                return posA - posB;
            });

            return visibleNodes.map((n) => n.text).join(" ");
        }

        // 元素可见性检测
        function isElementVisible(element: HTMLElement | null): boolean {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) {
                return element?.parentNode
                    ? isElementVisible(element.parentNode as HTMLElement)
                    : false;
            }

            try {
                const style = window.getComputedStyle(element);
                if (
                    style.display === "none" ||
                    style.visibility === "hidden" ||
                    parseFloat(style.opacity) < 0.1
                ) {
                    return false;
                }

                if (element.offsetWidth === 0 && element.offsetHeight === 0) {
                    return false;
                }
            } catch (e) {
                return false;
            }

            if (element.parentNode && element.parentNode !== document) {
                return isElementVisible(element.parentNode as HTMLElement);
            }

            return true;
        }

        // 获取元素位置
        function getElementPosition(element: HTMLElement | null): number {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) return 0;

            try {
                const rect = element.getBoundingClientRect();
                return rect.top + window.scrollY;
            } catch (e) {
                return 0;
            }
        }

        // 分层采样内容
        function sampleContentBySections(content: string, maxLength: number): string {
            if (!content || content.length === 0) return "";

            const sections = splitContentIntoSections(content);
            let sampledText = "";

            sections.forEach((section) => {
                if (section.length < 10) return;

                const sectionQuota = Math.floor(
                    maxLength * (section.length / content.length) * DEFAULT_SAMPLE_RATE
                );

                if (sectionQuota > 10) {
                    const sectionSentences = extractSentences(section);
                    const sectionSample = sampleFromSentences(sectionSentences, sectionQuota);

                    if (sectionSample) {
                        sampledText += sectionSample + " ";
                    }
                }
            });

            if (sampledText.length < maxLength * 0.5) {
                const remaining = maxLength - sampledText.length;
                sampledText += getRandomContentSamples(content, remaining);
            }

            return sampledText.trim().substring(0, maxLength);
        }

        // 内容分割辅助函数
        function splitContentIntoSections(content: string): string[] {
            const headingSections = content.split(/(?=\【[^\】]+\】|§ [A-Za-z0-9]+)/g);
            if (headingSections.length > 3) return headingSections;

            const paragraphSections = content.split(/\s{2,}/g);
            if (paragraphSections.length > 5) return paragraphSections;

            return content.split(/(?<=[.!?。！？])\s+/g);
        }

        function extractSentences(text: string): string[] {
            return text
                .split(/(?<=[.!?。！？])\s+/g)
                .filter((s) => s.length > 15 && s.length < 200)
                .filter((s) => /[a-zA-Z0-9\u4e00-\u9fa5]/.test(s));
        }

        function sampleFromSentences(sentences: string[], maxLength: number): string {
            if (!sentences || sentences.length === 0) return "";

            let result = "";
            let count = 0;
            const maxSamples = Math.min(5, sentences.length);
            let startIndex = Math.floor(Math.random() * sentences.length);

            while (result.length < maxLength && count < maxSamples) {
                const sentence = sentences[startIndex % sentences.length];

                if (result.length + sentence.length <= maxLength) {
                    result += sentence + " ";
                } else {
                    const partial = sentence.substring(0, maxLength - result.length - 5) + "...";
                    result += partial;
                    break;
                }

                startIndex++;
                count++;
            }

            return result.trim();
        }

        function getRandomContentSamples(content: string, length: number): string {
            if (!content || content.length <= length) return content || "";
            const start = Math.floor(Math.random() * (content.length - length));
            return content.substring(start, start + length);
        }
    }

    /**
     * 核心逻辑实现
     * @author normalpcer
     */
    export namespace Core {
        /**
         * 网页评级枚举，定义网页的敏感程度。
         * @enum {number}
         */
        export enum Rating {
            L0_SAFE,
            L1_MILD,
            L2_SENSITIVE,
            L3_STRONG,
            L4_WARNING,
            L5_EXPLICIT,
        }

        /**
         * 拦截器，用于拦截当前网页内容
         */
        interface IBlocker {
            execute(): void;
        }

        /**
         * 测试用，仅在控制台打印日志
         */
        class TestBlocker implements IBlocker {
            execute(): void {
                console.log("Blocking...");
            }
        }

        /**
         * 创建一个拦截器
         */
        class BlockerFactory {
            static createForRating(_: Rating): IBlocker {
                return new TestBlocker();
            }
        }

        /**
         * 获取当前页面的评级
         */
        function getRating(): Rating {
            return Rating.L0_SAFE;  // 测试用
        }

        /**
         * 检查当前网页内容，并执行相关策略
         */
        export function checkPage(): void {
            const rating = getRating();
            const blocker = BlockerFactory.createForRating(rating);

            blocker.execute();
        }
    }

    /**
     * 初始化主程序
     * @author DeepSeek R1
     */
    export async function initContentGuard() {
        // 检查是否已存在容器
        if (document.getElementById("content-guard-container")) return;

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
            Config.createConfigUI();
        });

        document.body.appendChild(configButton);

        // 首次运行检查
        const config = await Config.getConfig();
        if (!config.apiKey) {
            setTimeout(() => {
                Config.createConfigUI();
                const statusDiv = document.getElementById("api-status");
                if (statusDiv) {
                    statusDiv.className = "status-message status-error";
                    statusDiv.textContent = "请配置 API 密钥以启用内容过滤功能";
                }
            }, 2000);
        }
    }
}

(function () {
    "use strict";

    // 设置样式
    GM_addStyle(STYLE);

    ContentGuard.initContentGuard();

    window.onload = () => {
        setTimeout(ContentGuard.Core.checkPage, 2000);
    }
})();
