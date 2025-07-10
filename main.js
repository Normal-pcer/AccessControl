"use strict";
// ==UserScript==
// @name         ContentGuard - AI Content Filter
// @namespace    https://github.com/normal-pcer/AccessControl
// @version      1.0
// @license      MIT
// @description  基于人工智能的敏感内容过滤系统
// @author       normalpcer & DeepSeek R1
// @match        *://*/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.deepseek.com
// @require      https://cdn.jsdelivr.net/npm/vue@3.2.47/dist/vue.global.prod.js
// @run-at document-start
// ==/UserScript==
//
const DEBUG_MODE = true;
const STYLE = `
#content-guard-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 420px;
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

.content-guard-config-section {
    margin-bottom: 20px;
}

.content-guard-section-title {
    font-size: 15px;
    font-weight: 500;
    margin-bottom: 10px;
    color: #444;
}

.content-guard-form-group {
    margin-bottom: 15px;
}

.content-guard-form-label {
    display: block;
    margin-bottom: 5px;
    font-size: 13px;
    color: #666;
}

.content-guard-form-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    box-sizing: border-box;
    transition: border 0.2s;
}

.content-guard-form-input:focus {
    border-color: #4d90fe;
    outline: none;
    box-shadow: 0 0 0 2px rgba(77, 144, 254, 0.2);
}

.content-guard-form-input[type="password"] {
    letter-spacing: 1px;
}

.content-guard-form-help {
    font-size: 12px;
    color: #888;
    margin-top: 5px;
}

.content-guard-btn {
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
}

.content-guard-btn-primary {
    background-color: #4d90fe;
    color: white;
}

.content-guard-btn-primary:hover {
    background-color: #3d7de0;
}

.content-guard-btn-secondary {
    background-color: #f0f0f0;
    color: #333;
}

.content-guard-btn-secondary:hover {
    background-color: #e0e0e0;
}

.content-guard-btn-group {
    display: flex;
    gap: 10px;
    margin-top: 15px;
}

.content-guard-status-message {
    padding: 10px;
    border-radius: 6px;
    margin-top: 15px;
    font-size: 13px;
}

.content-guard-status-success {
    background-color: #e8f5e9;
    color: #2e7d32;
    border: 1px solid #c8e6c9;
}

.content-guard-status-error {
    background-color: #ffebee;
    color: #c62828;
    border: 1px solid #ffcdd2;
}

.content-guard-budget-info {
    padding: 12px;
    background: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #eee;
    font-size: 13px;
}

.content-guard-budget-meter {
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    margin: 8px 0;
    overflow: hidden;
}

.content-guard-budget-progress {
    height: 100%;
    background: #4d90fe;
    border-radius: 3px;
    transition: width 0.5s ease;
}

.content-guard-config-tabs {
    display: flex;
    margin-bottom: 15px;
    border-bottom: 1px solid #eee;
}

.content-guard-tab-item {
    padding: 8px 15px;
    cursor: pointer;
    font-size: 14px;
    color: #666;
    border-bottom: 2px solid transparent;
}

.content-guard-tab-item.active {
    color: #4d90fe;
    border-bottom-color: #4d90fe;
    font-weight: 500;
}

.content-guard-whitelist-item {
    display: flex;
    margin-bottom: 8px;
    align-items: center;
}

.content-guard-whitelist-item input {
    flex: 1;
    margin-right: 8px;
}

.content-guard-btn-delete {
    background: #ff4d4f;
    color: white;
    border: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
}
`;
var ContentGuard;
(function (ContentGuard) {
    /**
     * 实用工具
     */
    let Utils;
    (function (Utils) {
        /**
         * 判断目标字符串是否匹配通配符模式（支持单词内通配）
         * @param pattern 通配符模式（可能包含星号）
         * @param target 目标字符串
         * @returns 是否匹配
         */
        function wildcardMatch(pattern, target) {
            if (pattern === "*")
                return true;
            if (pattern.indexOf("*") === -1)
                return pattern === target;
            const parts = pattern.split("*");
            const isStartWithStar = pattern.startsWith("*");
            const isEndWithStar = pattern.endsWith("*");
            let currentIndex = 0;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (part === "")
                    continue;
                const index = target.indexOf(part, currentIndex);
                if (index === -1)
                    return false;
                if (i === 0 && !isStartWithStar && index !== 0)
                    return false;
                currentIndex = index + part.length;
            }
            if (!isEndWithStar) {
                const lastPart = parts[parts.length - 1];
                if (lastPart !== "" && !target.endsWith(lastPart))
                    return false;
            }
            return true;
        }
        /**
         * 匹配域名部分（支持单词通配和星号单词匹配）
         * @param actualParts 实际域名分割数组
         * @param patternParts 模式域名分割数组
         * @returns 是否匹配
         */
        function matchHost(actualParts, patternParts) {
            // 反转数组，从顶级域开始匹配
            const actual = actualParts.slice().reverse();
            const pattern = patternParts.slice().reverse();
            let i = 0, j = 0;
            let starJ = -1, starI = -1;
            while (i < actual.length) {
                // 如果模式还有且当前模式是星号
                if (j < pattern.length && pattern[j] === "*") {
                    starJ = j;
                    starI = i;
                    j++;
                    continue;
                }
                // 正常匹配：模式存在且当前部分匹配
                if (j < pattern.length && wildcardMatch(pattern[j], actual[i])) {
                    i++;
                    j++;
                }
                // 如果之前遇到过星号，则回溯：让星号多匹配一个实际部分
                else if (starJ !== -1) {
                    j = starJ + 1;
                    i = starI + 1;
                    starI = i;
                }
                else {
                    return false;
                }
            }
            // 处理模式中剩余的部分（必须都是星号）
            while (j < pattern.length) {
                if (pattern[j] !== "*")
                    return false;
                j++;
            }
            return true;
        }
        /**
         * 判断URL是否符合带通配符的约束模式
         * @author DeepSeek R1
         *
         * @param url 要检查的URL字符串
         * @param pattern 通配符模式，格式为 (a)://(b)/(c)
         * @returns 是否匹配
         */
        function isPatternMatch(url, pattern) {
            // 解析模式：分割协议部分
            const [protocolPattern, rest] = pattern.split("://");
            if (!rest) {
                // 域名模式
                return isPatternMatch(url, "*://" + "*." + pattern + "/*");
            }
            // 分割域名和路径
            const slashIndex = rest.indexOf("/");
            if (slashIndex === -1)
                return false;
            const hostPattern = rest.substring(0, slashIndex);
            const pathPattern = rest.substring(slashIndex);
            // 解析URL
            let urlObj;
            try {
                urlObj = new URL(url);
            }
            catch (e) {
                return false;
            }
            // 处理协议
            const actualProtocol = urlObj.protocol.replace(/:$/, "");
            if (!wildcardMatch(protocolPattern, actualProtocol)) {
                return false;
            }
            // 处理端口
            let hostnamePattern;
            let portPattern = null;
            const colonIndex = hostPattern.indexOf(":");
            if (colonIndex !== -1) {
                hostnamePattern = hostPattern.substring(0, colonIndex);
                portPattern = hostPattern.substring(colonIndex + 1);
            }
            else {
                hostnamePattern = hostPattern;
            }
            // 匹配端口
            const actualPort = urlObj.port;
            if (portPattern !== null) {
                if (!wildcardMatch(portPattern, actualPort))
                    return false;
            }
            else if (actualPort !== "") {
                return false;
            }
            // 匹配域名
            const actualHostname = urlObj.hostname;
            const patternHostParts = hostnamePattern.split(".");
            const actualHostParts = actualHostname.split(".");
            if (!matchHost(actualHostParts, patternHostParts)) {
                return false;
            }
            // 匹配路径
            const actualPathname = urlObj.pathname;
            return wildcardMatch(pathPattern, actualPathname);
        }
        Utils.isPatternMatch = isPatternMatch;
    })(Utils = ContentGuard.Utils || (ContentGuard.Utils = {}));
    /**
     * 配置文件相关
     * @author DeepSeek R1
     */
    let Config;
    (function (Config) {
        // 配置文件键名
        const KEY_PREFIX = "content_guard_";
        const CONFIG_KEY = KEY_PREFIX + "config";
        const BUDGET_KEY = KEY_PREFIX + "budget";
        const CREDITS_KEY = KEY_PREFIX + "credits";
        // 默认配置
        const DEFAULT_CONFIG = {
            apiKey: "",
            baseUrl: "https://api.deepseek.com/v1",
            modelName: "deepseek-chat",
            budgetLimit: 2e6,
            saveMode: true,
            whitelist: [],
            strictCount: 0,
        };
        let CreditSystem;
        (function (CreditSystem) {
            const DEFAULT_CREDIT = 0;
            const MIN_CREDIT = -10;
            const MAX_CREDIT = 10;
            async function getCreditData(host) {
                try {
                    const credits = await GM.getValue(CREDITS_KEY, {});
                    if (!credits[host]) {
                        credits[host] = { amount: DEFAULT_CREDIT, safeTimestamps: [] };
                    }
                    return credits[host];
                }
                catch (error) {
                    console.error("获取信用数据失败:", error);
                    return { amount: DEFAULT_CREDIT, safeTimestamps: [] };
                }
            }
            CreditSystem.getCreditData = getCreditData;
            async function updateCreditData(host, data) {
                try {
                    const credits = await GM.getValue(CREDITS_KEY, {});
                    credits[host] = data;
                    await GM.setValue(CREDITS_KEY, credits);
                }
                catch (error) {
                    console.error("更新信用数据失败:", error);
                }
            }
            async function increaseCredit(host, amount) {
                const creditData = await getCreditData(host);
                creditData.amount += amount;
                creditData.amount = Math.min(creditData.amount, MAX_CREDIT * 1.2);
                creditData.amount = Math.max(creditData.amount, MIN_CREDIT * 1.2);
                await updateCreditData(host, creditData);
            }
            CreditSystem.increaseCredit = increaseCredit;
            /**
             * 记录安全标记（marksafe）
             * 更新最近三次安全标记的时间戳
             */
            async function markSafe(host) {
                const creditData = await getCreditData(host);
                const now = Date.now();
                // 初始化或更新安全时间戳数组
                if (!creditData.safeTimestamps) {
                    creditData.safeTimestamps = [now];
                }
                else {
                    // 保留最近三次记录
                    const timestamps = [...creditData.safeTimestamps, now];
                    creditData.safeTimestamps = timestamps.slice(-3);
                }
                await updateCreditData(host, creditData);
            }
            CreditSystem.markSafe = markSafe;
            /**
             * 检查是否满足安全条件（1小时内3次安全标记）
             */
            async function isFrequentSafe(host) {
                const creditData = await getCreditData(host);
                const now = Date.now();
                if (!creditData.safeTimestamps || creditData.safeTimestamps.length < 3) {
                    return false;
                }
                // 检查所有时间戳是否都在1小时内
                return creditData.safeTimestamps.every((timestamp) => now - timestamp <= 3600 * 1000);
            }
            /**
             * 获取网页采样概率（基于信用分）
             * 如果1小时内有3次安全标记，返回固定概率10%
             */
            async function getProb(host) {
                // 检查安全标记条件
                if (await isFrequentSafe(host)) {
                    console.log("安全模式激活：固定采样率10%");
                    return 0.1;
                }
                // 正常信用分计算
                let score = (await CreditSystem.getCreditData(host)).amount;
                console.log("信用分：", score);
                score = Math.min(Math.max(score, MIN_CREDIT), MAX_CREDIT);
                const result = Math.log(11.5 - score) / Math.log(1.4) / 10;
                console.log("采样概率：", result);
                return result;
            }
            CreditSystem.getProb = getProb;
        })(CreditSystem = Config.CreditSystem || (Config.CreditSystem = {}));
        // 获取配置
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
        Config.getConfig = getConfig;
        // 保存配置
        async function saveConfig(config) {
            try {
                await GM.setValue(CONFIG_KEY, config);
            }
            catch (error) {
                console.error("保存配置失败:", error);
            }
        }
        Config.saveConfig = saveConfig;
        async function getBudgetData() {
            try {
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
                const budget = await GM.getValue(BUDGET_KEY, {});
                if (!budget[monthKey]) {
                    budget[monthKey] = { tokensUsed: 0 };
                }
                return budget[monthKey];
            }
            catch (error) {
                console.error("获取预算数据失败:", error);
                return { tokensUsed: 0 };
            }
        }
        Config.getBudgetData = getBudgetData;
        async function updateBudget(tokensUsed) {
            try {
                const now = new Date();
                const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
                const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
                const budget = await GM.getValue(BUDGET_KEY, {});
                let monthData = budget[monthKey] || { tokensUsed: 0 };
                // 更新月总量
                monthData.tokensUsed = (monthData.tokensUsed || 0) + tokensUsed;
                // 更新日记录
                if (!monthData.dailyUsage) {
                    monthData.dailyUsage = {
                        today: { date: today, tokens: tokensUsed },
                        yesterday: null,
                    };
                }
                else {
                    const { dailyUsage } = monthData;
                    if (dailyUsage.today.date === today) {
                        // 当天记录累加
                        dailyUsage.today.tokens += tokensUsed;
                    }
                    else {
                        // 日期变化：今天变昨天，新建今天记录
                        dailyUsage.yesterday = dailyUsage.today;
                        dailyUsage.today = { date: today, tokens: tokensUsed };
                    }
                }
                budget[monthKey] = monthData;
                await GM.setValue(BUDGET_KEY, budget);
                // 检查日用量是否超过月预算5%
                const config = await getConfig();
                const dailyLimit = config.budgetLimit * 0.05;
                if (monthData.dailyUsage.today.tokens > dailyLimit) {
                    const message = `今日用量已达月预算 5%: ${monthData.dailyUsage.today.tokens.toLocaleString()}/${Math.floor(dailyLimit).toLocaleString()} 字符`;
                    console.warn(message);
                    alert(message);
                }
            }
            catch (error) {
                console.error("更新预算失败:", error);
            }
        }
        Config.updateBudget = updateBudget;
        function isWhitelisted(url, patterns) {
            return patterns.some((pattern) => Utils.isPatternMatch(url, pattern));
        }
        Config.isWhitelisted = isWhitelisted;
        /**
         * 将完整域名转换为带通配符的域名格式，特别处理双顶级域名（如 .com.cn, .edu.us）
         * @param url 输入的URL或域名
         * @returns 带通配符的域名格式
         */
        function convertToWildcardDomain(url) {
            // 移除协议部分（如果存在）
            let domain = url.replace(/^(https?:\/\/)?(www\.)?/, "");
            // 移除路径和查询参数
            domain = domain.split("/")[0];
            // 分割域名部分
            const parts = domain.split(".");
            // 定义常见的单顶级域名
            // prettier-ignore
            const commonSingleSuffixes = new Set([
                "com", "net", "org", "gov", "edu", "cn",
                "hk", "tw", "uk", "us", "au", "jp", "de",
                "fr", "it", "ru", "br", "in", "ca", "mx"
            ]);
            // 检查是否是双顶级域名情况
            if (parts.length >= 2) {
                const secondLastPart = parts[parts.length - 2];
                // 如果倒数第二部分是常见单顶级域名，则认为是双顶级域名情况
                if (commonSingleSuffixes.has(secondLastPart)) {
                    if (parts.length === 2) {
                        return `*.${domain}`;
                    }
                    else {
                        return `*.${parts.slice(-3).join(".")}`;
                    }
                }
            }
            // 普通情况，返回 *.上级域名
            if (parts.length <= 2) {
                return `*.${domain}`;
            }
            else {
                return `*.${parts.slice(-2).join(".")}`;
            }
        }
        /**
         * 判断当前是否处于严格模式下。
         * 如果是，将会消耗一次计数
         */
        async function isStrictMode() {
            const config = await getConfig();
            if (config.strictCount > 0) {
                config.strictCount--;
                saveConfig(config);
                return true;
            }
            return false;
        }
        Config.isStrictMode = isStrictMode;
        // 获取今日使用量（实用函数）
        async function getTodayUsage() {
            const budget = await getBudgetData();
            const today = new Date().toISOString().slice(0, 10);
            return budget.dailyUsage?.today.date === today ? budget.dailyUsage.today.tokens : 0;
        }
        Config.getTodayUsage = getTodayUsage;
        // 创建配置界面
        function createConfigUI() {
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
        <div class="content-guard-config-tabs">
            <div class="content-guard-tab-item active" data-tab="api">API 设置</div>
            <div class="content-guard-tab-item" data-tab="budget">预算管理</div>
            <div class="content-guard-tab-item" data-tab="behavior">行为设置</div>
            <div class="content-guard-tab-item" data-tab="whitelist">白名单管理</div>
        </div>
        <div id="content-guard-config-content"></div>
    `;
            document.body.appendChild(container);
            // 获取DOM元素
            const closeButton = document.getElementById("content-guard-close");
            const configContent = document.getElementById("content-guard-config-content");
            const tabItems = container.querySelectorAll(".content-guard-tab-item");
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
                const budgetPercentage = Math.min(100, (budgetData.tokensUsed / config.budgetLimit) * 100);
                switch (tabName) {
                    case "api":
                        configContent.innerHTML = `
<div class="content-guard-config-section">
    <div class="content-guard-section-title">API 设置</div>
    
    <div class="content-guard-form-group">
        <label class="content-guard-form-label">API 密钥</label>
        <input type="password" id="content-guard-config-api-key" class="content-guard-form-input" value="${config.apiKey}" placeholder="输入您的 API 密钥">
        <div class="content-guard-form-help">在 AI 提供商创建 API 密钥</div>
    </div>
    
    <div class="content-guard-form-group">
        <label class="content-guard-form-label">API 基础 URL</label>
        <input type="text" id="content-guard-config-base-url" class="content-guard-form-input" value="${config.baseUrl}">
        <div class="content-guard-form-help">参考 AI 文档</div>
    </div>

    <div class="content-guard-form-group">
        <label class="content-guard-form-label">模型名称</label>
        <input type="text" id="content-guard-config-model-name" class="content-guard-form-input" value="${config.modelName}">
        <div class="content-guard-form-help">参考 AI 文档</div>
    </div>
</div>

<div class="content-guard-btn-group">
    <button id="content-guard-save-config" class="content-guard-btn content-guard-btn-primary">保存设置</button>
    <button id="content-guard-test-api" class="content-guard-btn content-guard-btn-secondary">测试连接</button>
</div>

<div id="content-guard-api-status"></div>
                    `;
                        break;
                    case "budget":
                        const currentLimit = config.budgetLimit / 1000;
                        const formated = Number.isInteger(currentLimit)
                            ? currentLimit.toString()
                            : currentLimit.toFixed(3);
                        configContent.innerHTML = `
<div class="content-guard-config-section">
    <div class="content-guard-section-title">预算管理</div>
    
    <div class="content-guard-budget-info">
        <div>本月已用 token: ${(budgetData.tokensUsed / 1000).toFixed(2)} K</div>
        <div>预算上限 token: ${(config.budgetLimit / 1000).toFixed(2)} K</div>
        <div class="content-guard-budget-meter">
            <div class="content-guard-budget-progress" style="width: ${budgetPercentage}%"></div>
        </div>
        <div>Token 使用: ${budgetData.tokensUsed.toLocaleString()}</div>
    </div>
    
    <div class="content-guard-form-group">
        <label class="content-guard-form-label">每月预算限制 (千 token)</label>
        <input type="number" id="content-guard-config-budget" class="content-guard-form-input" value="${formated}" min="0.5" step="0.1">
        <div class="content-guard-form-help">设置最大月预算，防止意外费用</div>
    </div>
</div>

<div class="content-guard-btn-group">
    <button id="content-guard-save-budget" class="content-guard-btn content-guard-btn-primary">保存预算设置</button>
    <button id="content-guard-reset-budget" class="content-guard-btn content-guard-btn-secondary">重置本月使用</button>
</div>
                    `;
                        break;
                    case "behavior":
                        configContent.innerHTML = `
<div class="content-guard-config-section">
    <div class="content-guard-section-title">行为设置</div>
    
    <div class="content-guard-form-group">
        <label class="content-guard-form-label">
            <input type="checkbox" id="content-guard-config-strict-mode" ${config.saveMode ? "checked" : ""}>
            启用省token模式
        </label>
        <div class="content-guard-form-help">牺牲识别准度，节约 token</div>
    </div>
</div>

<div class="content-guard-btn-group">
    <button id="content-guard-save-behavior" class="content-guard-btn content-guard-btn-primary">保存设置</button>
</div>
`;
                        break;
                    case "whitelist":
                        configContent.innerHTML = `
<div class="content-guard-config-section">
    <div class="content-guard-section-title">网站白名单</div>
    <div class="content-guard-form-help">在此列表中的网站将不会被审查</div>
    
    <div id="content-guard-whitelist-container">
        ${config.whitelist
                            .map((url) => `
            <div class="content-guard-whitelist-item">
                <input type="text" value="${url}" class="content-guard-form-input">
                <button class="content-guard-btn-delete">×</button>
            </div>
        `)
                            .join("")}
    </div>
    
    <button id="content-guard-add-whitelist" class="content-guard-btn">+ 添加网站</button>
    
    <div class="content-guard-form-help">
        格式提示：<br>
        • 完整域名：google.com<br>
        • 子域名：*.twitter.com<br>
        • 路径：youtube.com/education
    </div>
</div>

<div class="content-guard-btn-group">
    <button id="content-guard-save-whitelist" class="content-guard-btn content-guard-btn-primary">保存白名单</button>
</div>`;
                        break;
                }
                // 绑定保存事件
                document
                    .getElementById("content-guard-save-config")
                    ?.addEventListener("click", saveApiConfig);
                document
                    .getElementById("content-guard-test-api")
                    ?.addEventListener("click", testApiConnection);
                document
                    .getElementById("content-guard-save-budget")
                    ?.addEventListener("click", saveBudgetConfig);
                document
                    .getElementById("content-guard-reset-budget")
                    ?.addEventListener("click", resetBudget);
                document
                    .getElementById("content-guard-save-behavior")
                    ?.addEventListener("click", saveBehaviorConfig);
                const container = document.getElementById("content-guard-whitelist-container");
                // 添加白名单项
                document
                    .getElementById("content-guard-add-whitelist")
                    ?.addEventListener("click", () => {
                    const initValue = convertToWildcardDomain(window.location.href);
                    const newItem = document.createElement("div");
                    newItem.className = "content-guard-whitelist-item";
                    newItem.innerHTML = `
                <input type="text" value="${initValue}" class="content-guard-form-input" placeholder="输入网址">
                <button class="content-guard-btn-delete">×</button>
            `;
                    container?.appendChild(newItem);
                });
                // 删除白名单项
                container?.addEventListener("click", (e) => {
                    if (e.target.classList.contains("content-guard-btn-delete")) {
                        e.target.parentElement?.remove();
                    }
                });
                // 保存白名单
                document
                    .getElementById("content-guard-save-whitelist")
                    ?.addEventListener("click", async () => {
                    const inputs = Array.from(document.querySelectorAll("#content-guard-whitelist-container .content-guard-whitelist-item input"));
                    const config = await getConfig();
                    config.whitelist = inputs
                        .map((input) => input.value.trim())
                        .filter((url) => url.length > 0);
                    await saveConfig(config);
                    showStatus("白名单已保存!", true);
                });
                // API 配置保存
                async function saveApiConfig() {
                    const apiKeyInput = document.getElementById("content-guard-config-api-key");
                    const baseUrlInput = document.getElementById("content-guard-config-base-url");
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
                    const budgetInput = document.getElementById("content-guard-config-budget");
                    if (!budgetInput)
                        return;
                    const newBudget = parseFloat(budgetInput.value);
                    if (isNaN(newBudget))
                        return;
                    const config = await getConfig();
                    config.budgetLimit = newBudget * 1000; // KB -> chars
                    await saveConfig(config);
                    showStatus("预算设置已更新!", true);
                    renderTabContent("budget"); // 刷新显示
                }
                // 行为配置保存
                async function saveBehaviorConfig() {
                    const strictModeInput = document.getElementById("content-guard-config-strict-mode");
                    if (!strictModeInput)
                        return;
                    const config = await getConfig();
                    config.saveMode = strictModeInput.checked;
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
                            budget[monthKey] = { tokensUsed: 0 };
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
                    const statusDiv = document.getElementById("content-guard-api-status");
                    if (!statusDiv)
                        return;
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
                    const statusDiv = document.getElementById("content-guard-api-status");
                    if (!statusDiv)
                        return;
                    statusDiv.className = `content-guard-status-message ${isSuccess ? "content-guard-status-success" : "content-guard-status-error"}`;
                    statusDiv.textContent = message;
                    // 5秒后自动清除
                    setTimeout(() => {
                        statusDiv.textContent = "";
                        statusDiv.className = "content-guard-status-message";
                    }, 5000);
                }
            }
        }
        Config.createConfigUI = createConfigUI;
    })(Config = ContentGuard.Config || (ContentGuard.Config = {}));
    /**
     * 人工智能相关交互
     * @author DeepSeek R1
     */
    let AITools;
    (function (AITools) {
        async function callAPI(prompt, maxTokens = 128) {
            console.log("callAPI", prompt);
            const config = await Config.getConfig();
            if (!config.apiKey) {
                console.error("API 密钥未配置");
                return null;
            }
            try {
                const requestData = {
                    model: config.modelName,
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
                                    ContentGuard.Config.getTodayUsage().then((usage) => {
                                        console.log("[ContentGuard] 本日已用 token", usage);
                                    });
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
        AITools.callAPI = callAPI;
    })(AITools = ContentGuard.AITools || (ContentGuard.AITools = {}));
    /**
     * 网页采样工具
     * @author DeepSeek R1
     */
    let WebSampler;
    (function (WebSampler) {
        const DEFAULT_MAX_LENGTH = 1000;
        const DEFAULT_SAMPLE_RATE = 0.3;
        // 公共接口：采样页面内容
        function sampleContent(maxLength = DEFAULT_MAX_LENGTH) {
            try {
                const fullContent = getVisiblePageContent();
                return sampleContentBySections(fullContent, maxLength);
            }
            catch (e) {
                console.error("内容采样失败:", e);
                return "";
            }
        }
        WebSampler.sampleContent = sampleContent;
        // 基于文本长度加权，去除过短的文本
        function getWeightByTextLength(len) {
            if (len <= 2)
                return 0;
            if (len >= 6)
                return 1;
            return 1 / len;
        }
        // 获取整个页面的可见文本内容
        function getVisiblePageContent() {
            const visibleNodes = [];
            const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                acceptNode: function (node) {
                    const parent = node.parentNode;
                    if (!parent ||
                        parent.nodeName === "SCRIPT" ||
                        parent.nodeName === "STYLE" ||
                        parent.nodeName === "NOSCRIPT") {
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
                const posA = getElementPosition(a.node.parentNode);
                const posB = getElementPosition(b.node.parentNode);
                return posA - posB;
            });
            return visibleNodes.map((n) => n.text).join(" ");
        }
        // 元素可见性检测
        function isElementVisible(element) {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) {
                return element?.parentNode
                    ? isElementVisible(element.parentNode)
                    : false;
            }
            try {
                const style = window.getComputedStyle(element);
                if (style.display === "none" ||
                    style.visibility === "hidden" ||
                    parseFloat(style.opacity) < 0.1) {
                    return false;
                }
                if (element.offsetWidth === 0 && element.offsetHeight === 0) {
                    return false;
                }
            }
            catch (e) {
                return false;
            }
            if (element.parentNode && element.parentNode !== document) {
                return isElementVisible(element.parentNode);
            }
            return true;
        }
        // 获取元素位置
        function getElementPosition(element) {
            if (!element || element.nodeType !== Node.ELEMENT_NODE)
                return 0;
            try {
                const rect = element.getBoundingClientRect();
                return rect.top + window.scrollY;
            }
            catch (e) {
                return 0;
            }
        }
        // 分层采样内容
        function sampleContentBySections(content, maxLength) {
            if (!content || content.length === 0)
                return "";
            const sections = splitContentIntoSections(content);
            let sampledText = "";
            sections.forEach((section) => {
                if (section.length < 10)
                    return;
                const sectionQuota = Math.floor(maxLength * (section.length / content.length) * DEFAULT_SAMPLE_RATE);
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
        function splitContentIntoSections(content) {
            const headingSections = content.split(/(?=\【[^\】]+\】|§ [A-Za-z0-9]+)/g);
            if (headingSections.length > 3)
                return headingSections;
            const paragraphSections = content.split(/\s{2,}/g);
            if (paragraphSections.length > 5)
                return paragraphSections;
            return content.split(/(?<=[.!?。！？])\s+/g);
        }
        function extractSentences(text) {
            return text
                .split(/(?<=[.!?。！？])\s+/g)
                .filter((s) => s.length > 15 && s.length < 200)
                .filter((s) => /[a-zA-Z0-9\u4e00-\u9fa5]/.test(s));
        }
        function sampleFromSentences(sentences, maxLength) {
            if (!sentences || sentences.length === 0)
                return "";
            let result = "";
            let count = 0;
            const maxSamples = Math.min(5, sentences.length);
            let startIndex = Math.floor(Math.random() * sentences.length);
            while (result.length < maxLength && count < maxSamples) {
                const sentence = sentences[startIndex % sentences.length];
                if (result.length + sentence.length <= maxLength) {
                    result += sentence + " ";
                }
                else {
                    const partial = sentence.substring(0, maxLength - result.length - 5) + "...";
                    result += partial;
                    break;
                }
                startIndex++;
                count++;
            }
            return result.trim();
        }
        function getRandomContentSamples(content, length) {
            if (!content || content.length <= length)
                return content || "";
            const start = Math.floor(Math.random() * (content.length - length));
            return content.substring(start, start + length);
        }
    })(WebSampler = ContentGuard.WebSampler || (ContentGuard.WebSampler = {}));
    /**
     * 拦截器
     * @author DeepSeek R1 & normalpcer
     */
    let Blocker;
    (function (Blocker) {
        /**
         * 测试用，仅在控制台打印日志
         */
        class TestBlocker {
            execute() {
                console.log("Blocking...");
            }
        }
        Blocker.TestBlocker = TestBlocker;
        class NoneBlocker {
            execute() {
                // 不进行操作
            }
        }
        Blocker.NoneBlocker = NoneBlocker;
        /**
         * 将接下来几次访问标记为严格模式
         */
        class MarkStrictBlocker {
            times;
            constructor(times) {
                this.times = times;
            }
            async execute() {
                console.log("标记严格模式");
                const config = await Config.getConfig();
                config.strictCount = Math.max(config.strictCount, this.times);
                await Config.saveConfig(config);
            }
        }
        Blocker.MarkStrictBlocker = MarkStrictBlocker;
        /**
         * 提供强制冷却时间的拦截器
         * @author DeepSeek R1 & normalpcer
         */
        class CooldownBlocker {
            seconds;
            challengeRequired;
            static OVERLAY_ID = "content-guard-cooldown-challenge-overlay";
            static TIMER_ID = "content-guard-cooldown-timer";
            static CHALLENGE_COUNTER_ID = "content-guard-challenge-counter";
            static QUESTION_CONTAINER_ID = "content-guard-question-container";
            static ANSWER_INPUT_ID = "content-guard-answer-input";
            static SUBMIT_BUTTON_ID = "content-guard-submit-button";
            static STATUS_ID = "content-guard-challenge-status";
            remainingSeconds;
            correctCount = 0;
            currentQuestion = null;
            timerInterval = null;
            attempts = 0;
            constructor(seconds, challengeRequired) {
                this.seconds = seconds;
                this.challengeRequired = challengeRequired;
                this.remainingSeconds = seconds;
            }
            execute() {
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
            removeExistingOverlay() {
                const existing = document.getElementById(CooldownBlocker.OVERLAY_ID);
                if (existing)
                    existing.remove();
                document.body.style.overflow = "";
                if (this.timerInterval) {
                    clearInterval(this.timerInterval);
                    this.timerInterval = null;
                }
            }
            createOverlay() {
                const overlay = document.createElement("div");
                overlay.id = CooldownBlocker.OVERLAY_ID;
                // 高不透明度设计（几乎完全遮挡）
                Object.assign(overlay.style, {
                    position: "fixed",
                    top: "0",
                    left: "0",
                    width: "100vw",
                    height: "100vh",
                    backgroundColor: "rgba(0, 0, 0, 1)", // 完全不透明
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
            createTimer() {
                const timer = document.createElement("div");
                timer.id = CooldownBlocker.TIMER_ID;
                timer.textContent = `剩余等待时间: ${this.remainingSeconds} 秒`;
                timer.style.fontSize = "32px";
                timer.style.margin = "15px 0";
                timer.style.fontWeight = "bold";
                return timer;
            }
            createChallengeCounter() {
                const counter = document.createElement("div");
                counter.id = CooldownBlocker.CHALLENGE_COUNTER_ID;
                counter.textContent = `连续挑战进度: 0/${this.challengeRequired}`;
                counter.style.fontSize = "24px";
                counter.style.margin = "15px 0";
                return counter;
            }
            startCountdown(timer) {
                this.timerInterval = window.setInterval(() => {
                    if (this.remainingSeconds === 0)
                        return;
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
            generateNewQuestion() {
                this.attempts++;
                // 辅助函数：格式化项
                function formatTerm(coefficient, power) {
                    if (coefficient === 0)
                        return "";
                    const absCoeff = Math.abs(coefficient);
                    const sign = coefficient < 0 ? "-" : "+";
                    let term = "";
                    if (power === 2) {
                        term = absCoeff === 1 ? "x²" : `${absCoeff}x²`;
                    }
                    else {
                        term = absCoeff === 1 ? "x" : `${absCoeff}x`;
                    }
                    return `${sign} ${term}`.trim();
                }
                // 辅助函数：格式化常数项
                function formatConstant(value) {
                    if (value === 0)
                        return "";
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
                    const root1 = [numerator1 / gcd1, denominator1 / gcd1];
                    const root2 = [numerator2 / gcd2, denominator2 / gcd2];
                    // 计算根的和与积（分数形式）
                    const sum = [
                        root1[0] * root2[1] + root2[0] * root1[1],
                        root1[1] * root2[1],
                    ];
                    const product = [root1[0] * root2[0], root1[1] * root2[1]];
                    // 随机生成缩放因子k（1-4之间）
                    const k = Math.floor(Math.random() * 4) + 1; // [1, 4]
                    // 随机生成右边系数（-3到3之间，d≠0）
                    let d;
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
                    if (lhs.startsWith("+"))
                        lhs = lhs.substring(1);
                    if (rhs.startsWith("+"))
                        rhs = rhs.substring(1);
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
                function chooseDifficulty(n, i) {
                    // 1. 基础权重配置
                    const baseWeights = Array.from({ length: n }, (_, idx) => n - (idx * 2) / 3);
                    // 指数函数+一次函数的分段函数，避免指数爆炸
                    const f = (x) => {
                        if (x < 5)
                            return Math.pow(x, 1.5);
                        else
                            return 3 * x - 7.4;
                    };
                    // 2. 增长系数配置（非线性递增）
                    const growthFactors = Array.from({ length: n }, (_, idx) => 0.9 + ((1.3 - 0.9) * f(idx)) / f(n - 1));
                    // 3. 计算当前轮次的动态权重
                    const dynamicWeights = baseWeights.map((w, idx) => w * Math.pow(growthFactors[idx], i - 1) // i-1因为首次调用i=1
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
            gcd(a, b) {
                return b === 0 ? a : this.gcd(b, a % b);
            }
            renderQuestion() {
                const container = document.getElementById(CooldownBlocker.QUESTION_CONTAINER_ID);
                if (!container || !this.currentQuestion)
                    return;
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
            updateChallengeCounter() {
                const counter = document.getElementById(CooldownBlocker.CHALLENGE_COUNTER_ID);
                if (counter) {
                    counter.textContent = `连续挑战进度: ${this.correctCount}/${this.challengeRequired}`;
                }
            }
            updateStatus(message, isError = false) {
                const status = document.getElementById(CooldownBlocker.STATUS_ID);
                if (status) {
                    status.textContent = message;
                    status.style.color = isError ? "#ff5555" : "#55ff55";
                }
            }
            checkAnswer() {
                const input = document.getElementById(CooldownBlocker.ANSWER_INPUT_ID);
                const status = document.getElementById(CooldownBlocker.STATUS_ID);
                if (!input || !status || !this.currentQuestion)
                    return;
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
                        }
                        else {
                            return parseFloat(numOrFrac);
                        }
                    })
                        .filter((n) => !isNaN(n))
                        .sort();
                    const correctAnswers = this.currentQuestion.answer;
                    isCorrect =
                        userAnswers.length === correctAnswers.length &&
                            userAnswers.every((val, idx) => Math.abs(val - correctAnswers[idx]) < 1e-6);
                }
                else {
                    // 处理单个答案的情况
                    const numericAnswer = Number(userAnswer);
                    isCorrect =
                        !isNaN(numericAnswer) &&
                            Math.abs(numericAnswer - this.currentQuestion.answer) < 0.001;
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
                    }
                    else {
                        // 生成下一题
                        setTimeout(() => {
                            this.generateNewQuestion();
                            this.updateStatus("");
                        }, 1000);
                    }
                }
                else {
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
        Blocker.CooldownBlocker = CooldownBlocker;
        /**
         * 组合拦截器
         * 将会依次执行几个拦截器
         */
        class CombinedBlocker {
            blockers;
            constructor(blockers) {
                this.blockers = blockers;
            }
            execute() {
                for (const x of this.blockers) {
                    x.execute();
                }
            }
        }
        Blocker.CombinedBlocker = CombinedBlocker;
    })(Blocker = ContentGuard.Blocker || (ContentGuard.Blocker = {}));
    /**
     * 预拦截器
     * @author DeepSeek R1
     */
    let PreBlocker;
    (function (PreBlocker) {
        class Lock {
            id;
            static nextId = 0;
            constructor(id) {
                this.id = id;
            }
            static generate() {
                return new Lock(Lock.nextId++);
            }
        }
        const locks = [];
        // 全局状态 - 全部重置为可重新初始化的状态
        let blockerCreated = false;
        let blockerElement = null;
        let styleElement = null;
        const safeCreateElement = (tag, attributes = {}, text) => {
            const el = document.createElement(tag);
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === "style") {
                    Object.assign(el.style, parseStyles(value));
                }
                else {
                    el.setAttribute(key, value);
                }
            });
            if (text)
                el.textContent = text;
            return el;
        };
        const parseStyles = (styleStr) => {
            return styleStr.split(";").reduce((styles, rule) => {
                const [key, value] = rule.split(":").map((s) => s.trim());
                if (key && value)
                    styles[key.replace(/-./g, (m) => m[1].toUpperCase())] = value;
                return styles;
            }, {});
        };
        const makeLock = () => {
            const lock = Lock.generate();
            locks.push(lock);
            return lock;
        };
        PreBlocker.show = () => {
            // 如果元素仍在移除过程中，先强制完成移除
            if (blockerElement && blockerElement.parentNode) {
                blockerElement.parentNode.removeChild(blockerElement);
                blockerElement = null;
            }
            if (styleElement && styleElement.parentNode) {
                styleElement.parentNode.removeChild(styleElement);
                styleElement = null;
            }
            // 重置创建状态
            blockerCreated = false;
            if (blockerCreated)
                return;
            blockerCreated = true;
            if (!document.documentElement) {
                console.warn("[PreBlocker] document.documentElement 不存在");
                return;
            }
            blockerElement = safeCreateElement("div", {
                id: "pre-blocker-overlay",
                style: `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 1);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 2147483647;
                color: white;
                font-size: 20px;
                font-family: sans-serif;
                backdrop-filter: blur(8px);
                padding: 20px;
                box-sizing: border-box;
            `,
            });
            const noise = safeCreateElement("div", {
                style: `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 1px, transparent 1px, transparent 4px);
                pointer-events: none;
            `,
            });
            blockerElement.appendChild(noise);
            const spinner = safeCreateElement("div", {
                style: `
                width: 60px;
                height: 60px;
                border: 5px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: white;
                animation: spin 1s linear infinite;
                margin-bottom: 20px;
            `,
            });
            const hint = safeCreateElement("div", {
                style: "margin-bottom: 30px; opacity: 0.8;",
            }, "正在进行内容安全审查...");
            styleElement = safeCreateElement("style");
            styleElement.textContent = `
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
            blockerElement.appendChild(spinner);
            blockerElement.appendChild(hint);
            document.documentElement.appendChild(styleElement);
            document.documentElement.appendChild(blockerElement);
            blockerElement.oncontextmenu = (e) => e.preventDefault();
            blockerElement.onselectstart = (e) => e.preventDefault();
        };
        PreBlocker.remove = (lock) => {
            if (!blockerCreated || !blockerElement)
                return;
            const lockIndex = locks.indexOf(lock);
            if (lockIndex === -1)
                return;
            locks.splice(lockIndex, 1);
            if (locks.length !== 0)
                return;
            blockerElement.style.opacity = "0";
            blockerElement.style.transition = "opacity 0.5s ease";
            setTimeout(() => {
                if (blockerElement && blockerElement.parentNode) {
                    blockerElement.parentNode.removeChild(blockerElement);
                    blockerElement = null;
                }
                if (styleElement && styleElement.parentNode) {
                    styleElement.parentNode.removeChild(styleElement);
                    styleElement = null;
                }
                // 重置状态以允许重新初始化
                blockerCreated = false;
            }, 500);
        };
        const waitForDOMReady = (callback) => {
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", callback);
            }
            else {
                setTimeout(callback, 0);
            }
        };
        PreBlocker.init = () => {
            try {
                PreBlocker.show();
            }
            catch (e) {
                console.error("[PreBlocker] 初始创建失败:", e);
                waitForDOMReady(PreBlocker.show);
            }
            return makeLock();
        };
    })(PreBlocker = ContentGuard.PreBlocker || (ContentGuard.PreBlocker = {}));
    /**
     * 针对搜索引擎界面优化的特殊检测逻辑
     * @author DeepSeek R1
     */
    let SearchObserver;
    (function (SearchObserver_1) {
        // 防抖机制
        let lock = false;
        // 搜索引擎配置
        const ENGINE_CONFIGS = [
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
        // 主控制器
        class SearchObserver {
            handlers;
            currentEngine = null;
            lastQuery = "";
            urlObserver = null;
            apiState = {
                pending: false,
                query: "",
                requestId: 0,
            };
            visibilityHandler = null;
            constructor(handlers = []) {
                this.handlers = handlers;
                console.log("construct");
                this.init();
            }
            dispatch(event) {
                for (const handler of this.handlers) {
                    handler(event);
                }
            }
            // 初始化
            init() {
                this.detectEngine();
                if (!this.currentEngine)
                    return;
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
            setupVisibilityHandler() {
                this.visibilityHandler = () => {
                    if (document.visibilityState === "hidden" && this.apiState.pending) {
                        console.warn(`页面隐藏，取消查询: ${this.apiState.query}`);
                        this.cancelAPIRequest();
                    }
                };
                document.addEventListener("visibilitychange", this.visibilityHandler);
            }
            // 检测当前搜索引擎
            detectEngine() {
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
            setupFormObserver() {
                if (!this.currentEngine)
                    return;
                const form = document.querySelector(this.currentEngine.searchFormSelector);
                if (form) {
                    form.addEventListener("submit", this.handleFormSubmit.bind(this));
                }
                else {
                    setTimeout(() => this.setupFormObserver(), 500);
                }
            }
            // 设置URL变化监听 (SPA引擎)
            setupUrlObserver() {
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
            handleFormSubmit(event) {
                event.preventDefault();
                if (!this.currentEngine)
                    return;
                const query = this.getSearchQueryFromForm();
                if (!query || query === this.lastQuery)
                    return;
                // 对于传统搜索引擎，延迟处理
                if (!this.currentEngine.isSPA) {
                    this.delayedLogSearchQuery(query);
                }
                else {
                    this.safeLogSearchQuery(query);
                }
                // 允许表单继续提交
                setTimeout(() => {
                    const form = event.target;
                    if (form)
                        form.submit();
                }, 0);
            }
            // 安全记录搜索词（带取消机制）
            safeLogSearchQuery(query) {
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
                }
                else {
                    this.executeAPIRequest(query, requestId);
                }
            }
            // 延迟记录搜索词
            delayedLogSearchQuery(query) {
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
            executeAPIRequest(query, requestId) {
                if (lock)
                    return;
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
            cancelAPIRequest() {
                if (this.apiState.pending) {
                    console.warn(`取消查询: ${this.apiState.query}`);
                    this.apiState.pending = false;
                    // 这里可以添加实际的API取消逻辑
                }
            }
            // 从表单获取搜索词
            getSearchQueryFromForm() {
                if (!this.currentEngine)
                    return null;
                if (this.currentEngine.name === "Google") {
                    const input = document.querySelector("textarea[name='q']");
                    return input?.value.trim() || null;
                }
                if (this.currentEngine.name === "Baidu") {
                    const input = document.getElementById("kw");
                    return input?.value.trim() || null;
                }
                if (this.currentEngine.name === "Bing") {
                    const input = document.getElementById("sb_form_q");
                    return input?.value.trim() || null;
                }
                return null;
            }
            // 从URL获取搜索词
            getSearchQueryFromURL() {
                if (!this.currentEngine)
                    return "";
                const urlParams = new URLSearchParams(window.location.search);
                const query = urlParams.get(this.currentEngine.searchParam) || "";
                return this.normalizeQuery(query);
            }
            // 标准化查询词
            normalizeQuery(query) {
                return decodeURIComponent(query).trim().replace(/\s+/g, " ");
            }
            // 清理资源
            cleanup() {
                if (this.visibilityHandler) {
                    document.removeEventListener("visibilitychange", this.visibilityHandler);
                }
                if (this.urlObserver) {
                    this.urlObserver.disconnect();
                }
                this.cancelAPIRequest();
            }
        }
        let observerInstance = null;
        function getInstance() {
            if (observerInstance === null) {
                throw Error("Uninitialized SearchObserver");
            }
            return observerInstance;
        }
        SearchObserver_1.getInstance = getInstance;
        // 启动监听
        function start(handlers = []) {
            const init = () => {
                if (observerInstance) {
                    observerInstance.cleanup();
                }
                observerInstance = new SearchObserver(handlers);
            };
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", init);
            }
            else {
                init();
            }
            // 添加beforeunload事件确保清理
            window.addEventListener("beforeunload", () => {
                if (observerInstance) {
                    observerInstance.cleanup();
                }
            });
        }
        SearchObserver_1.start = start;
        // 是否为潜在的搜索引擎
        function isPotentialSearchEngine(url) {
            const keywords = ["baidu.com", "google.com", "bing.com"];
            return keywords.some((keyword) => url.includes(keyword));
        }
        SearchObserver_1.isPotentialSearchEngine = isPotentialSearchEngine;
    })(SearchObserver = ContentGuard.SearchObserver || (ContentGuard.SearchObserver = {}));
    /**
     * 核心逻辑实现
     * @author normalpcer
     */
    let Core;
    (function (Core) {
        /**
         * 网页评级枚举，定义网页的敏感程度。
         * @enum {number}
         */
        let Rating;
        (function (Rating) {
            Rating[Rating["L0_SAFE"] = 0] = "L0_SAFE";
            Rating[Rating["L1_MILD"] = 1] = "L1_MILD";
            Rating[Rating["L2_SENSITIVE"] = 2] = "L2_SENSITIVE";
            Rating[Rating["L3_STRONG"] = 3] = "L3_STRONG";
            Rating[Rating["L4_WARNING"] = 4] = "L4_WARNING";
            Rating[Rating["L5_EXPLICIT"] = 5] = "L5_EXPLICIT";
        })(Rating = Core.Rating || (Core.Rating = {}));
        function getCreditByRating(rating) {
            const values = [0.3, 0, -0.3, -0.5, -1, -1.5];
            return values[rating] ?? 0;
        }
        /**
         * 用于 AI 评分的 prompt
         */
        const AI_JUDGE_PROMPT = `
严格按照JSON返回{"score": 0-5, "info": "5-30字的原因"}。
0. 无敏感内容
1. 过度身体评价/极轻微性暗示/轻度人身攻击
2. 敏感部位评价/少量性暗示、物化/人身攻击、脏话
3. 一般性暗示等/少量性幻想/群体歧视，煽动对立
4. 软色情，严重性暗示等/性行为隐喻/裸露场景/更多性幻想/侵犯隐私
5. 明确色情、性暗示/隐喻严重性暴力/能判断是色情网站
涉未成年或相关内容过多，酌情升级。
给以下文字评0~5分。`;
        class AIJudgeResponse {
            score;
            info;
            constructor(score, info) {
                this.score = score;
                this.info = info;
            }
            static parse(json) {
                // 去掉潜在的“```”和“```json”
                json = json.replace(/^```(json)?\s*|\s*```$/g, "");
                let obj = JSON.parse(json);
                if (typeof obj !== "object" || obj === null)
                    return null;
                if (!("score" in obj && typeof obj.score === "number"))
                    return null;
                if (!("info" in obj && typeof obj.info === "string"))
                    return null;
                return new AIJudgeResponse(obj.score, obj.info);
            }
            getRating() {
                // 数据异常
                if (Rating[this.score] === undefined)
                    return null;
                return this.score; // 转化是安全的
            }
        }
        /**
         * 创建一个拦截器
         */
        class BlockerFactory {
            static createForRating(rating) {
                const baseBlocker = (() => {
                    switch (rating) {
                        case Rating.L0_SAFE:
                            return new Blocker.NoneBlocker();
                        case Rating.L1_MILD:
                            return new Blocker.NoneBlocker();
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
                })();
                const extraBlocker = (() => {
                    switch (rating) {
                        case Rating.L0_SAFE:
                            return new Blocker.NoneBlocker();
                        case Rating.L1_MILD:
                            return new Blocker.MarkStrictBlocker(1);
                        default:
                            return new Blocker.MarkStrictBlocker(2);
                    }
                })();
                return new Blocker.CombinedBlocker([baseBlocker, extraBlocker]);
            }
        }
        /**
         * 获取当前页面的评级
         */
        async function getPageRating(content) {
            // if (DEBUG_MODE) return Rating.L2_SENSITIVE;
            // 构建完整提示词
            const fullPrompt = AI_JUDGE_PROMPT + "文本信息：" + content;
            const value = await AITools.callAPI(fullPrompt);
            if (value === null)
                return null;
            const response = AIJudgeResponse.parse(value);
            if (response === null)
                return null;
            const result = response.getRating();
            if (result === null)
                return null;
            return result;
        }
        /**
         * 以“搜索模式”检查网页内容。
         * 特性：
         * - 会向 AI 提交搜索主题，随后再接网页摘要。
         * - 当搜索内容变更时，重新检查
         */
        /**
         * 以“搜索模式”检查网页内容。
         * 特性：
         * - 会向 AI 提交搜索主题，随后再接网页摘要。
         * - 当搜索内容变更时，重新检查
         */
        async function getSearchPageRating(query, content) {
            // 特别地，如果搜索包含 site:白名单网站，直接返回安全
            // ... 帮助我实现，进入分支也需要 console.log
            // 检查查询中是否包含 site: 白名单域名
            const siteRegex = /site:\s*([\w.-]+)/gi;
            const siteMatch = siteRegex.exec(query);
            if (siteMatch) {
                const domain = siteMatch[1];
                const hypotheticalUrl = `https://${domain}/`;
                const config = await Config.getConfig();
                if (Config.isWhitelisted(hypotheticalUrl, config.whitelist)) {
                    console.log(`检测到白名单域名: ${domain}，直接返回安全评级`);
                    return Rating.L0_SAFE;
                }
                else {
                    console.log(`检测到 site: 限定域名，但不在白名单: ${domain}`);
                }
            }
            const MAX_QUERY = 40;
            if (query.length > MAX_QUERY)
                query = query.substring(0, MAX_QUERY);
            const fullContent = `${content}---
这是一个搜索引擎页面，如果有可能指向敏感内容，请酌情加分。
搜索关键词：${query}`;
            const original = await getPageRating(fullContent);
            // 考虑到搜索引擎特性，非安全内容额外加分
            if ([null, Rating.L0_SAFE, Rating.L5_EXPLICIT].includes(original)) {
                return original;
            }
            else {
                if (original === null)
                    return Rating.L5_EXPLICIT; // 程序逻辑错误
                return original + 1;
            }
        }
        Core.getSearchPageRating = getSearchPageRating;
        /**
         * 这个网页是否一定可以跳过检查
         * 当前可能的情况：
         * 1. 处于白名单
         * 2. 处于测试模式，存在相关选项
         */
        async function ensureSkip(config = null) {
            if (config === null) {
                config = await Config.getConfig();
            }
            const currentUrl = window.location.href;
            if (Config.isWhitelisted(currentUrl, config.whitelist)) {
                console.log("[ContentGuard] 白名单网站，跳过审查");
                return true;
            }
            if (DEBUG_MODE && window.location.href.includes("no-content-guard")) {
                console.log("[ContentGuard] 测试模式，跳过审查");
                return true;
            }
            return false;
        }
        Core.ensureSkip = ensureSkip;
        /**
         * 检查当前网页内容，并执行相关策略
         */
        async function checkPage() {
            const config = await Config.getConfig();
            if (await ensureSkip(config)) {
                return;
            }
            // 获取 Rating 之后的处理步骤
            const blockByRating = (rating) => {
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
                const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
                // 尝试获取搜索关键词
                SearchObserver.start([
                    async (data) => {
                        searchMode = true;
                        // 开启搜索模式的遮罩
                        const searchLock = PreBlocker.init();
                        // 执行逻辑
                        if (searchMode) {
                            // 已经不是初次调用，重新等待网页搜索
                            console.log("等待重新搜索");
                            await new Promise((resolve) => setTimeout(resolve, 3000));
                            console.log("停止等待");
                        }
                        const query = data.query;
                        const rating = await getSearchPageRating(query, WebSampler.sampleContent(764));
                        blockByRating(rating);
                        // 移除遮罩
                        PreBlocker.remove(searchLock);
                    },
                ]);
                await timeout;
            }
            // 经济模式下，非搜索页有概率直接取消采样
            // 除非同时处于严格模式
            const strict = await Config.isStrictMode();
            if (strict) {
                console.log("当前处于严格模式");
            }
            if (config.saveMode && !strict) {
                const prob = await Config.CreditSystem.getProb(window.location.hostname);
                const rand = Math.random();
                if (rand > prob) {
                    console.log("[ContentGuard] 经济模式下，取消采样");
                    console.log(`${rand} > ${prob}`);
                    return;
                }
            }
            // 当前如果处于搜索模式，则已经开始处理了，不需要重复处理
            if (!searchMode) {
                const sampleLength = config.saveMode ? 512 : 764; // 进一步缩减采样长度
                const rating = await getPageRating(WebSampler.sampleContent(sampleLength));
                if (rating === null) {
                    console.error("Cannot get page rating.");
                    return;
                }
                blockByRating(rating);
                await Config.CreditSystem.increaseCredit(window.location.hostname, getCreditByRating(rating));
                if (rating === Rating.L0_SAFE) {
                    Config.CreditSystem.markSafe(window.location.hostname);
                }
            }
        }
        Core.checkPage = checkPage;
    })(Core = ContentGuard.Core || (ContentGuard.Core = {}));
    /**
     * 初始化主程序
     * @author DeepSeek R1
     */
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
            Config.createConfigUI();
        });
        document.body.appendChild(configButton);
        // 首次运行检查
        const config = await Config.getConfig();
        if (!config.apiKey) {
            setTimeout(() => {
                Config.createConfigUI();
                const statusDiv = document.getElementById("content-guard-api-status");
                if (statusDiv) {
                    statusDiv.className = "content-guard-status-message content-guard-status-error";
                    statusDiv.textContent = "请配置 API 密钥以启用内容过滤功能";
                }
            }, 2000);
        }
    }
    ContentGuard.initContentGuard = initContentGuard;
})(ContentGuard || (ContentGuard = {}));
(function () {
    "use strict";
    if (window.self !== window.top) {
        console.log("Skipping iframe:", window.location.href);
        return;
    }
    // 创建预拦截器遮罩
    const mainLock = ContentGuard.PreBlocker.init();
    let ensureSkip = false;
    ContentGuard.Core.ensureSkip().then((skip) => {
        if (skip) {
            // 直接隐藏遮罩
            ContentGuard.PreBlocker.remove(mainLock);
            ensureSkip = true;
        }
    });
    // 设置样式
    GM_addStyle(STYLE);
    // 检查页面内容是否充足
    const hasContent = () => {
        // innerText 内容足够
        const visibleText = document.body.innerText.replace(/\s/g, "");
        if (visibleText.length < 100)
            return false;
        // 尝试采样网页
        const sample = ContentGuard.WebSampler.sampleContent(512);
        if (sample.length < 100)
            return false;
        return true;
    };
    let checked = false; // 是否已经执行过检查
    /**
     * 如果内容充足，就检查页面
     * @param force 如果 force 为真，强制检查
     */
    const conditionalCheck = async (force = false) => {
        if (ensureSkip)
            return;
        if (checked)
            return; // 始终不重复检查
        if (force || hasContent()) {
            checked = true;
            await ContentGuard.Core.checkPage();
            ContentGuard.PreBlocker.remove(mainLock);
        }
        else {
            console.log("未提取到足够内容，等待重试");
        }
    };
    window.addEventListener("DOMContentLoaded", () => {
        ContentGuard.initContentGuard();
        setTimeout(() => conditionalCheck(), 1000);
        setTimeout(() => conditionalCheck(), 3000);
    });
    window.addEventListener("load", () => {
        setTimeout(() => conditionalCheck(true), 2000);
    }, { once: true });
})();
