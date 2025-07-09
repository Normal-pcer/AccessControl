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

const DEBUG_MODE = false;

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
        export async function callAPI(prompt: string, maxTokens = 128): Promise<string | null> {
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

        // 基于文本长度加权，去除过短的文本
        function getWeightByTextLength(len: number): number {
            if (len <= 2) return 0;
            if (len >= 6) return 1;
            return 1 / len;
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
                let text = treeWalker.currentNode.textContent?.trim() || "";
                if (text.length > 0 && Math.random() < getWeightByTextLength(text.length)) {
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
     * 拦截器
     * @author DeepSeek R1 & normalpcer
     */
    export namespace Blocker {
        /**
         * 拦截器，用于拦截当前网页内容
         */
        export interface IBlocker {
            execute(): void;
        }

        /**
         * 测试用，仅在控制台打印日志
         */
        export class TestBlocker implements IBlocker {
            execute(): void {
                console.log("Blocking...");
            }
        }

        /**
         * 提供强制冷却时间的拦截器
         * @author DeepSeek R1 & normalpcer
         */
        export class CooldownBlocker implements IBlocker {
            private static readonly OVERLAY_ID = "cooldown-challenge-overlay";
            private static readonly TIMER_ID = "cooldown-timer";
            private static readonly CHALLENGE_COUNTER_ID = "challenge-counter";
            private static readonly QUESTION_CONTAINER_ID = "question-container";
            private static readonly ANSWER_INPUT_ID = "answer-input";
            private static readonly SUBMIT_BUTTON_ID = "submit-button";
            private static readonly STATUS_ID = "challenge-status";

            private remainingSeconds: number;
            private correctCount: number = 0;
            private currentQuestion: { text: string; answer: number | number[] } | null = null;
            private timerInterval: number | null = null;
            private attempts: number = 0;

            constructor(private seconds: number, private challengeRequired: number) {
                this.remainingSeconds = seconds;
            }

            execute(): void {
                this.remainingSeconds = this.seconds;
                this.removeExistingOverlay();

                const overlay = this.createOverlay();
                document.body.appendChild(overlay);
                document.body.style.overflow = "hidden";

                // 创建主容器
                const container = document.createElement("div");
                container.style.textAlign = "center";
                container.style.maxWidth = "600px";
                container.style.margin = "0 auto";

                // 创建倒计时显示
                const timer = this.createTimer();
                container.appendChild(timer);

                // 创建挑战计数器
                const counter = this.createChallengeCounter();
                container.appendChild(counter);

                // 创建题目容器
                const questionContainer = document.createElement("div");
                questionContainer.id = CooldownBlocker.QUESTION_CONTAINER_ID;
                questionContainer.style.margin = "20px 0";
                questionContainer.style.fontSize = "24px";
                container.appendChild(questionContainer);

                // 创建状态显示
                const status = document.createElement("div");
                status.id = CooldownBlocker.STATUS_ID;
                status.style.minHeight = "30px";
                status.style.margin = "15px 0";
                container.appendChild(status);

                overlay.appendChild(container);

                // 启动倒计时
                this.startCountdown(timer);

                // 生成第一道题目
                if (this.challengeRequired !== 0) {
                    this.generateNewQuestion();
                }
            }

            private removeExistingOverlay(): void {
                const existing = document.getElementById(CooldownBlocker.OVERLAY_ID);
                if (existing) existing.remove();
                document.body.style.overflow = "";

                if (this.timerInterval) {
                    clearInterval(this.timerInterval);
                    this.timerInterval = null;
                }
            }

            private createOverlay(): HTMLDivElement {
                const overlay = document.createElement("div");
                overlay.id = CooldownBlocker.OVERLAY_ID;

                // 高不透明度设计（几乎完全遮挡）
                Object.assign(overlay.style, {
                    position: "fixed",
                    top: "0",
                    left: "0",
                    width: "100vw",
                    height: "100vh",
                    backgroundColor: "rgba(0, 0, 0, 0.99)", // 99% 不透明度
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: "2147483647",
                    color: "white",
                    fontSize: "20px",
                    fontFamily: "sans-serif",
                    backdropFilter: "blur(8px)",
                    flexDirection: "column",
                    padding: "20px",
                    boxSizing: "border-box",
                });

                // 添加视觉干扰元素
                const noise = document.createElement("div");
                noise.style.position = "absolute";
                noise.style.top = "0";
                noise.style.left = "0";
                noise.style.width = "100%";
                noise.style.height = "100%";
                noise.style.backgroundImage =
                    "repeating-linear-gradient(0deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 1px, transparent 1px, transparent 4px)";
                noise.style.pointerEvents = "none";
                overlay.appendChild(noise);

                // 添加警示图标
                const warningIcon = document.createElement("div");
                warningIcon.textContent = "⛔";
                warningIcon.style.fontSize = "48px";
                warningIcon.style.marginBottom = "20px";
                warningIcon.style.opacity = "0.7";
                overlay.appendChild(warningIcon);

                // 添加提示文本
                const hint = document.createElement("div");
                hint.textContent = "检测到需要注意力管理的内容";
                hint.style.marginBottom = "30px";
                hint.style.opacity = "0.8";
                overlay.appendChild(hint);

                // 防止用户交互
                overlay.oncontextmenu = (e) => e.preventDefault();
                overlay.onselectstart = (e) => e.preventDefault();

                return overlay;
            }

            private createTimer(): HTMLDivElement {
                const timer = document.createElement("div");
                timer.id = CooldownBlocker.TIMER_ID;
                timer.textContent = `剩余等待时间: ${this.remainingSeconds} 秒`;
                timer.style.fontSize = "32px";
                timer.style.margin = "15px 0";
                timer.style.fontWeight = "bold";
                return timer;
            }

            private createChallengeCounter(): HTMLDivElement {
                const counter = document.createElement("div");
                counter.id = CooldownBlocker.CHALLENGE_COUNTER_ID;
                counter.textContent = `连续挑战进度: 0/${this.challengeRequired}`;
                counter.style.fontSize = "24px";
                counter.style.margin = "15px 0";
                return counter;
            }

            private startCountdown(timer: HTMLElement): void {
                this.timerInterval = window.setInterval(() => {
                    if (this.remainingSeconds === 0) return;
                    this.remainingSeconds--;
                    timer.textContent = `剩余等待时间: ${this.remainingSeconds} 秒`;

                    // 最后 5 秒颜色变化
                    if (this.remainingSeconds <= 5) {
                        timer.style.color = this.remainingSeconds % 2 === 1 ? "#ff5555" : "#ffffff";
                    }

                    // 检查是否满足解除条件
                    if (this.remainingSeconds <= 0 && this.correctCount >= this.challengeRequired) {
                        this.removeExistingOverlay();
                    }
                }, 1000);
            }

            private generateNewQuestion(): void {
                this.attempts++;

                // 辅助函数：格式化项
                function formatTerm(coefficient: number, power: number): string {
                    if (coefficient === 0) return "";
                    const absCoeff = Math.abs(coefficient);
                    const sign = coefficient < 0 ? "-" : "+";
                    let term = "";

                    if (power === 2) {
                        term = absCoeff === 1 ? "x²" : `${absCoeff}x²`;
                    } else {
                        term = absCoeff === 1 ? "x" : `${absCoeff}x`;
                    }

                    return `${sign} ${term}`.trim();
                }

                // 辅助函数：格式化常数项
                function formatConstant(value: number): string {
                    if (value === 0) return "";
                    const absValue = Math.abs(value);
                    const sign = value < 0 ? "-" : "+";
                    return `${sign} ${absValue}`;
                }

                const easy = () => {
                    const root1 = Math.floor(Math.random() * 5) - 2;
                    const root2 = Math.floor(Math.random() * 5) - 2;
                    const a = 1;
                    const b = -(root1 + root2);
                    const c = root1 * root2;

                    let question = `解方程: x² ${formatTerm(b, 1)} ${formatConstant(c)} = 0`;
                    const answer = [root1, root2].sort();

                    return {
                        text: question,
                        answer: answer,
                    };
                };

                const hard = () => {
                    // 生成两个有理数根（分子分母在-5到5之间）
                    const numerator1 = Math.floor(Math.random() * 11) - 5; // [-5, 5]
                    const denominator1 = Math.floor(Math.random() * 5) + 1; // [1, 5]
                    const numerator2 = Math.floor(Math.random() * 11) - 5; // [-5, 5]
                    const denominator2 = Math.floor(Math.random() * 5) + 1; // [1, 5]

                    // 约分根
                    const gcd1 = this.gcd(Math.abs(numerator1), denominator1);
                    const gcd2 = this.gcd(Math.abs(numerator2), denominator2);
                    const root1: [number, number] = [numerator1 / gcd1, denominator1 / gcd1];
                    const root2: [number, number] = [numerator2 / gcd2, denominator2 / gcd2];

                    // 计算根的和与积（分数形式）
                    const sum: [number, number] = [
                        root1[0] * root2[1] + root2[0] * root1[1],
                        root1[1] * root2[1],
                    ];
                    const product: [number, number] = [root1[0] * root2[0], root1[1] * root2[1]];

                    // 随机生成缩放因子k（1-4之间）
                    const k = Math.floor(Math.random() * 4) + 1; // [1, 4]

                    // 随机生成右边系数（-3到3之间，d≠0）
                    let d: number;
                    do {
                        d = Math.floor(Math.random() * 7) - 3; // [-3, 3]
                    } while (d === 0);

                    const e = Math.floor(Math.random() * 7) - 3; // [-3, 3]
                    const f = Math.floor(Math.random() * 7) - 3; // [-3, 3]

                    // 计算左边系数（确保整数系数）
                    const a = d + k * product[1]; // a = d + k * (分母积)
                    const b = e - k * sum[0] * (product[1] / sum[1]); // 调整使b为整数
                    const c = f + k * product[0] * (sum[1] / product[1]); // 调整使c为整数

                    // 构建方程字符串
                    let lhs = `${formatTerm(a, 2)} ${formatTerm(b, 1)} ${formatConstant(c)}`;
                    let rhs = `${formatTerm(d, 2)} ${formatTerm(e, 1)} ${formatConstant(f)}`;

                    if (lhs.startsWith("+")) lhs = lhs.substring(1);
                    if (rhs.startsWith("+")) rhs = rhs.substring(1);

                    const equation = `${lhs} = ${rhs}`;

                    return {
                        text: `解方程: ${equation}`,
                        answer: [root1[0] / root1[1], root2[0] / root2[1]].sort((x, y) => x - y),
                    };
                };

                const difficulties = [easy, hard];

                /**
                 * 判定此次问题难度
                 * 尝试次数越多，越有可能是困难
                 * @author DeepSeek V3 & normalpcer
                 *
                 * @param n 难度等级数量
                 * @param i 尝试次数
                 * @returns 选中的难度编号
                 */
                function chooseDifficulty(n: number, i: number): number {
                    // 1. 基础权重配置
                    const baseWeights = Array.from({ length: n }, (_, idx) => n - (idx * 2) / 3);

                    // 指数函数+一次函数的分段函数，避免指数爆炸
                    const f = (x: number) => {
                        if (x < 5) return Math.pow(x, 1.5);
                        else return 3 * x - 7.4;
                    };

                    // 2. 增长系数配置（非线性递增）
                    const growthFactors = Array.from(
                        { length: n },
                        (_, idx) => 0.9 + ((1.3 - 0.9) * f(idx)) / f(n - 1)
                    );

                    // 3. 计算当前轮次的动态权重
                    const dynamicWeights = baseWeights.map(
                        (w, idx) => w * Math.pow(growthFactors[idx], i - 1) // i-1因为首次调用i=1
                    );

                    console.log("各难度动态权重", dynamicWeights);

                    // 4. 随机选择
                    const totalWeight = dynamicWeights.reduce((sum, w) => sum + w, 0);
                    let random = Math.random() * totalWeight;
                    for (let difficulty = 0; difficulty < n; difficulty++) {
                        if (random < dynamicWeights[difficulty]) {
                            return difficulty; // 返回0-based难度级别
                        }
                        random -= dynamicWeights[difficulty];
                    }
                    return n - 1; // 保底返回最高难度
                }

                const selected = difficulties[chooseDifficulty(difficulties.length, this.attempts)];

                this.currentQuestion = selected();
                // 设置当前问题和答案（根排序）
                this.renderQuestion();
            }

            // 辅助函数：求最大公约数
            private gcd(a: number, b: number): number {
                return b === 0 ? a : this.gcd(b, a % b);
            }

            private renderQuestion(): void {
                const container = document.getElementById(CooldownBlocker.QUESTION_CONTAINER_ID);
                if (!container || !this.currentQuestion) return;

                container.innerHTML = "";

                // 显示问题
                const question = document.createElement("div");
                question.textContent = this.currentQuestion.text;
                question.style.marginBottom = "20px";
                container.appendChild(question);

                // 创建输入框
                const input = document.createElement("input");
                input.id = CooldownBlocker.ANSWER_INPUT_ID;
                input.type = "text";
                input.placeholder = "输入答案";
                input.style.padding = "10px";
                input.style.fontSize = "18px";
                input.style.width = "200px";
                input.style.textAlign = "center";

                // 防止粘贴
                input.onpaste = (e) => e.preventDefault();

                container.appendChild(input);

                // 创建提交按钮
                const submitButton = document.createElement("button");
                submitButton.id = CooldownBlocker.SUBMIT_BUTTON_ID;
                submitButton.textContent = "提交答案";
                submitButton.style.padding = "10px 20px";
                submitButton.style.margin = "15px";
                submitButton.style.fontSize = "18px";

                submitButton.addEventListener("click", () => this.checkAnswer());
                container.appendChild(submitButton);

                // 自动聚焦输入框
                input.focus();
            }

            private updateChallengeCounter(): void {
                const counter = document.getElementById(CooldownBlocker.CHALLENGE_COUNTER_ID);
                if (counter) {
                    counter.textContent = `连续挑战进度: ${this.correctCount}/${this.challengeRequired}`;
                }
            }

            private updateStatus(message: string, isError: boolean = false): void {
                const status = document.getElementById(CooldownBlocker.STATUS_ID);
                if (status) {
                    status.textContent = message;
                    status.style.color = isError ? "#ff5555" : "#55ff55";
                }
            }

            private checkAnswer(): void {
                const input = document.getElementById(
                    CooldownBlocker.ANSWER_INPUT_ID
                ) as HTMLInputElement;
                const status = document.getElementById(CooldownBlocker.STATUS_ID);

                if (!input || !status || !this.currentQuestion) return;

                const userAnswer = input.value.trim();

                // 检查答案是否正确
                let isCorrect = false;

                if (Array.isArray(this.currentQuestion.answer)) {
                    // 处理多个答案的情况（如二次方程）
                    const userAnswers = userAnswer
                        .split(/[,，\s]+/)
                        .map((numOrFrac) => {
                            if (numOrFrac.includes("/")) {
                                const [numerator, denominator] = numOrFrac.split("/");
                                return parseInt(numerator) / parseInt(denominator);
                            } else {
                                return parseFloat(numOrFrac);
                            }
                        })
                        .filter((n) => !isNaN(n))
                        .sort();
                    const correctAnswers = this.currentQuestion.answer;

                    isCorrect =
                        userAnswers.length === correctAnswers.length &&
                        userAnswers.every((val, idx) => Math.abs(val - correctAnswers[idx]) < 1e-6);
                } else {
                    // 处理单个答案的情况
                    const numericAnswer = Number(userAnswer);
                    isCorrect =
                        !isNaN(numericAnswer) &&
                        Math.abs(numericAnswer - (this.currentQuestion.answer as number)) < 0.001;
                }

                if (isCorrect) {
                    this.correctCount++;
                    this.updateChallengeCounter();
                    this.updateStatus("✓ 答案正确！", false);

                    // 检查是否完成挑战
                    if (this.correctCount >= this.challengeRequired) {
                        this.updateStatus("✓ 挑战完成！等待倒计时结束...", false);

                        // 如果倒计时也已结束，立即解除
                        if (this.remainingSeconds <= 0) {
                            this.removeExistingOverlay();
                        }
                    } else {
                        // 生成下一题
                        setTimeout(() => {
                            this.generateNewQuestion();
                            this.updateStatus("");
                        }, 1000);
                    }
                } else {
                    this.correctCount = 0; // 重置连续正确计数
                    this.updateChallengeCounter();
                    this.updateStatus("✗ 答案错误，请重试！", true);

                    // 延迟后生成新题目
                    setTimeout(() => {
                        this.generateNewQuestion();
                        this.updateStatus("");
                    }, 1500);
                }

                // 清除输入框
                input.value = "";
            }
        }
    }

    /**
     * 针对搜索引擎界面优化的特殊检测逻辑
     * @author DeepSeek R1
     */
    export namespace SearchObserver {
        // 防抖机制
        let lock = false;

        // 引擎配置类型
        type EngineConfig = {
            name: string;
            searchPagePattern: RegExp;
            searchParam: string;
            searchFormSelector: string;
            isSPA?: boolean;
        };

        // 搜索引擎配置
        const ENGINE_CONFIGS: EngineConfig[] = [
            {
                name: "Bing",
                searchPagePattern: /^\/search$/i,
                searchParam: "q",
                searchFormSelector: "#sb_form",
                isSPA: true,
            },
            {
                name: "Google",
                searchPagePattern: /^\/search$/i,
                searchParam: "q",
                searchFormSelector: "form[action='/search']",
                isSPA: true,
            },
            {
                name: "Baidu",
                searchPagePattern: /^\/s$/i,
                searchParam: "wd",
                searchFormSelector: "#form",
                isSPA: false,
            },
        ];

        // API调用状态
        type APIState = {
            pending: boolean;
            query: string;
            requestId: number;
        };

        type ObserverData = { engineName: string; query: string };
        type Handler = (data: ObserverData) => void;

        // 主控制器
        class SearchObserver {
            private currentEngine: EngineConfig | null = null;
            private lastQuery: string = "";
            private urlObserver: MutationObserver | null = null;
            private apiState: APIState = {
                pending: false,
                query: "",
                requestId: 0,
            };
            private visibilityHandler: (() => void) | null = null;

            constructor(private handlers: Handler[] = []) {
                console.log("construct");
                this.init();
            }

            public dispatch(event: ObserverData): void {
                for (const handler of this.handlers) {
                    handler(event);
                }
            }

            // 初始化
            private init(): void {
                this.detectEngine();
                if (!this.currentEngine) return;

                // 初始搜索词捕获
                const initialQuery = this.getSearchQueryFromURL();
                if (initialQuery) {
                    this.safeLogSearchQuery(initialQuery);
                }

                // 设置监听器
                this.setupFormObserver();

                // 设置页面可见性监听
                this.setupVisibilityHandler();

                if (this.currentEngine.isSPA) {
                    this.setupUrlObserver();
                }
            }

            // 设置页面可见性处理器
            private setupVisibilityHandler(): void {
                this.visibilityHandler = () => {
                    if (document.visibilityState === "hidden" && this.apiState.pending) {
                        console.warn(`页面隐藏，取消查询: ${this.apiState.query}`);
                        this.cancelAPIRequest();
                    }
                };

                document.addEventListener("visibilitychange", this.visibilityHandler);
            }

            // 检测当前搜索引擎
            private detectEngine(): void {
                const hostname = window.location.hostname;
                const pathname = window.location.pathname;

                for (const config of ENGINE_CONFIGS) {
                    if (hostname.includes(config.name.toLowerCase())) {
                        this.currentEngine = config;
                        break;
                    }
                }

                if (!this.currentEngine) {
                    for (const config of ENGINE_CONFIGS) {
                        if (config.searchPagePattern.test(pathname)) {
                            this.currentEngine = config;
                            break;
                        }
                    }
                }
            }

            // 设置表单监听
            private setupFormObserver(): void {
                if (!this.currentEngine) return;

                const form = document.querySelector(
                    this.currentEngine.searchFormSelector
                ) as HTMLFormElement | null;

                if (form) {
                    form.addEventListener("submit", this.handleFormSubmit.bind(this));
                } else {
                    setTimeout(() => this.setupFormObserver(), 500);
                }
            }

            // 设置URL变化监听 (SPA引擎)
            private setupUrlObserver(): void {
                this.urlObserver = new MutationObserver(() => {
                    const query = this.getSearchQueryFromURL();
                    if (query && query !== this.lastQuery) {
                        this.safeLogSearchQuery(query);
                    }
                });

                this.urlObserver.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                });
            }

            // 处理表单提交
            private handleFormSubmit(event: SubmitEvent): void {
                event.preventDefault();
                if (!this.currentEngine) return;

                const query = this.getSearchQueryFromForm();
                if (!query || query === this.lastQuery) return;

                // 对于传统搜索引擎，延迟处理
                if (!this.currentEngine.isSPA) {
                    this.delayedLogSearchQuery(query);
                } else {
                    this.safeLogSearchQuery(query);
                }

                // 允许表单继续提交
                setTimeout(() => {
                    const form = event.target as HTMLFormElement;
                    if (form) form.submit();
                }, 0);
            }

            // 安全记录搜索词（带取消机制）
            private safeLogSearchQuery(query: string): void {
                // 取消之前的请求
                this.cancelAPIRequest();

                const requestId = Date.now();
                this.apiState = {
                    pending: true,
                    query,
                    requestId,
                };

                // 对于传统搜索引擎，延迟API调用
                if (!this.currentEngine?.isSPA) {
                    setTimeout(() => this.executeAPIRequest(query, requestId), 500);
                } else {
                    this.executeAPIRequest(query, requestId);
                }
            }

            // 延迟记录搜索词
            private delayedLogSearchQuery(query: string): void {
                this.cancelAPIRequest();

                const requestId = Date.now();
                this.apiState = {
                    pending: true,
                    query,
                    requestId,
                };

                // 设置延迟执行
                setTimeout(() => {
                    // 检查请求是否仍然有效
                    if (this.apiState.requestId === requestId && this.apiState.pending) {
                        this.executeAPIRequest(query, requestId);
                    }
                }, 500);
            }

            // 执行API请求
            private executeAPIRequest(query: string, requestId: number): void {
                if (lock) return;
                lock = true;
                setTimeout(() => (lock = false), 1000);

                // 检查请求是否被取消
                if (!this.apiState.pending || this.apiState.requestId !== requestId) {
                    return;
                }

                // 更新状态
                this.lastQuery = query;
                this.apiState.pending = false;

                const engineName = this.currentEngine?.name || "Unknown";
                // 实际调用AI API
                this.dispatch({ engineName: engineName, query: query });
                console.log(`[${engineName}] 搜索内容: ${query}`);
            }

            // 取消API请求
            private cancelAPIRequest(): void {
                if (this.apiState.pending) {
                    console.warn(`取消查询: ${this.apiState.query}`);
                    this.apiState.pending = false;
                    // 这里可以添加实际的API取消逻辑
                }
            }

            // 从表单获取搜索词
            private getSearchQueryFromForm(): string | null {
                if (!this.currentEngine) return null;

                if (this.currentEngine.name === "Google") {
                    const input = document.querySelector(
                        "textarea[name='q']"
                    ) as HTMLTextAreaElement;
                    return input?.value.trim() || null;
                }

                if (this.currentEngine.name === "Baidu") {
                    const input = document.getElementById("kw") as HTMLInputElement;
                    return input?.value.trim() || null;
                }

                if (this.currentEngine.name === "Bing") {
                    const input = document.getElementById("sb_form_q") as HTMLInputElement;
                    return input?.value.trim() || null;
                }

                return null;
            }

            // 从URL获取搜索词
            private getSearchQueryFromURL(): string {
                if (!this.currentEngine) return "";

                const urlParams = new URLSearchParams(window.location.search);
                const query = urlParams.get(this.currentEngine.searchParam) || "";
                return this.normalizeQuery(query);
            }

            // 标准化查询词
            private normalizeQuery(query: string): string {
                return decodeURIComponent(query).trim().replace(/\s+/g, " ");
            }

            // 清理资源
            public cleanup(): void {
                if (this.visibilityHandler) {
                    document.removeEventListener("visibilitychange", this.visibilityHandler);
                }
                if (this.urlObserver) {
                    this.urlObserver.disconnect();
                }
                this.cancelAPIRequest();
            }
        }

        let observerInstance: SearchObserver | null = null;

        export function getInstance(): SearchObserver {
            if (observerInstance === null) {
                throw Error("Uninitialized SearchObserver");
            }
            return observerInstance;
        }

        // 启动监听
        export function start(handlers: Handler[] = []): void {
            const init = () => {
                if (observerInstance) {
                    observerInstance.cleanup();
                }
                observerInstance = new SearchObserver(handlers);
            };

            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", init);
            } else {
                init();
            }

            // 添加beforeunload事件确保清理
            window.addEventListener("beforeunload", () => {
                if (observerInstance) {
                    observerInstance.cleanup();
                }
            });
        }

        // 是否为潜在的搜索引擎
        export function isPotentialSearchEngine(url: string): boolean {
            const keywords = ["baidu.com", "google.com", "bing.com"];
            return keywords.some((keyword) => url.includes(keyword));
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
         * 用于 AI 评分的 prompt
         */
        const AI_JUDGE_PROMPT = `
严格按照 JSON 格式返回：{"score": 0-5, "info": "5-30字的原因"}。
根据以下内容，给我接下来输入的文字评 0~5 分。
0. 无敏感内容
1. 过度身体评价/极轻微性暗示（“撩人”）/轻度人身攻击
2. 敏感部位评价/少量性暗示/轻微物化（“性感色气”）/人身攻击、脏话
3. 一般性暗示、物化、凝视（“诱惑”）/少量性幻想（“想亲”）/群体歧视，煽动对立
4. 软色情，严重性暗示、物化/性行为隐喻/裸露场景描写/更多性幻想/侵犯隐私
5. 明确色情/隐喻严重性暴力/极明确性暗示/能判断是色情网站
涉及未成年，或相关内容过多，酌情提升等级。`;

        class AIJudgeResponse {
            constructor(public score: number, public info: string) {}

            static parse(json: string): AIJudgeResponse | null {
                // 去掉潜在的“```”和“```json”
                json = json.replace(/^```(json)?\s*|\s*```$/g, "");
                let obj: unknown = JSON.parse(json);
                if (typeof obj !== "object" || obj === null) return null;
                if (!("score" in obj && typeof obj.score === "number")) return null;
                if (!("info" in obj && typeof obj.info === "string")) return null;
                return new AIJudgeResponse(obj.score, obj.info);
            }

            getRating(): Rating | null {
                // 数据异常
                if (Rating[this.score] === undefined) return null;
                return this.score as Rating; // 转化是安全的
            }
        }

        /**
         * 创建一个拦截器
         */
        class BlockerFactory {
            static createForRating(rating: Rating): Blocker.IBlocker {
                switch (rating) {
                    case Rating.L0_SAFE:
                        return new Blocker.TestBlocker();
                    case Rating.L1_MILD:
                        return new Blocker.TestBlocker();
                    case Rating.L2_SENSITIVE:
                        return new Blocker.CooldownBlocker(15, 0);
                    case Rating.L3_STRONG:
                        return new Blocker.CooldownBlocker(45, 2);
                    case Rating.L4_WARNING:
                        return new Blocker.CooldownBlocker(90, 3);
                    case Rating.L5_EXPLICIT:
                        return new Blocker.CooldownBlocker(180, 5);
                    default:
                        throw new Error(`Invalid rating: ${rating}`);
                }
            }
        }

        /**
         * 获取当前页面的评级
         */
        async function getPageRating(content: string): Promise<Rating | null> {
            if (DEBUG_MODE) return Rating.L5_EXPLICIT;

            // 构建完整提示词
            const fullPrompt = AI_JUDGE_PROMPT + "文本信息：" + content;
            const value = await AITools.callAPI(fullPrompt);
            if (value === null) return null;
            const response = AIJudgeResponse.parse(value);
            if (response === null) return null;
            const result = response.getRating();
            if (result === null) return null;

            return result;
        }

        /**
         * 以“搜索模式”检查网页内容。
         * 特性：
         * - 会向 AI 提交搜索主题，随后再接网页摘要。
         * - 当搜索内容变更时，重新检查
         */
        export async function getSearchPageRating(
            query: string,
            content: string
        ): Promise<Rating | null> {
            const MAX_QUERY = 40;
            if (query.length > MAX_QUERY) query = query.substring(0, MAX_QUERY);

            const fullContent = `${content}---
这是一个搜索引擎页面，如果有可能指向敏感内容，请酌情加分。
搜索关键词：${query}`;
            const original = await getPageRating(fullContent);

            // 考虑到搜索引擎特性，非安全内容额外加分
            if ([null, Rating.L0_SAFE, Rating.L5_EXPLICIT].includes(original)) {
                return original;
            } else {
                if (original === null) return Rating.L5_EXPLICIT;  // 程序逻辑错误
                return original + 1;
            }
        }

        /**
         * 检查当前网页内容，并执行相关策略
         */
        export async function checkPage(): Promise<void> {
            // 获取 Rating 之后的处理步骤
            const blockByRating = (rating: Rating | null) => {
                if (rating === null) {
                    console.error("Cannot get page rating.");
                    return;
                }
                const blocker = BlockerFactory.createForRating(rating);
                blocker.execute();
            };

            let searchMode = false; // 确认处于搜索模式
            if (SearchObserver.isPotentialSearchEngine(window.location.href)) {
                // 可能是搜索模式
                // 尝试提取搜索关键词，等待至多 2 秒
                // 两秒后固定停止
                const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000));
                // 尝试获取搜索关键词
                SearchObserver.start([
                    async (data) => {
                        if (searchMode) {
                            // 已经不是初次调用，重新等待网页搜索
                            console.log("等待重新搜索");
                            await new Promise<void>((resolve) => setTimeout(resolve, 3000));
                            console.log("停止等待");
                        }
                        searchMode = true;
                        const query = data.query;
                        const rating = await getSearchPageRating(
                            query,
                            WebSampler.sampleContent(764)
                        );
                        blockByRating(rating);
                    },
                ]);

                await timeout;
            }

            // 当前如果处于搜索模式，则已经开始处理了，不需要重复处理
            if (!searchMode) {
                const rating = await getPageRating(WebSampler.sampleContent(764));
                blockByRating(rating);
            }
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
    if (window.self !== window.top) {
        console.log("Skipping iframe:", window.location.href);
        return;
    }

    // 设置样式
    GM_addStyle(STYLE);

    ContentGuard.initContentGuard();

    window.addEventListener(
        "load",
        () => {
            setTimeout(() => {
                ContentGuard.Core.checkPage().catch((err) => {
                    console.error(err);
                });
            }, 2000);
        },
        { once: true }
    );
})();
