"use strict";
// ==UserScript==
// @name         AI监管拦截系统 (安全兼容版)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  修复document.body为null的问题
// @author       You
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
// 配置常量
const AI_CHECK_DELAY = 2000;
const SAFE_CONTENT = true;
// 全局状态
let blockerCreated = false;
let bodyObserver = null;
let blockerRemoved = false;
var WebSampler;
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
})(WebSampler || (WebSampler = {}));
// 样本内容生成函数
function sampleContent(maxLength = 800) {
    return WebSampler.sampleContent(maxLength);
}
// 安全创建元素函数
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
// 解析样式字符串为对象
const parseStyles = (styleStr) => {
    return styleStr.split(";").reduce((styles, rule) => {
        const [key, value] = rule.split(":").map((s) => s.trim());
        if (key && value)
            styles[key.replace(/-./g, (m) => m[1].toUpperCase())] = value;
        return styles;
    }, {});
};
// 创建初始拦截遮罩
const createBlocker = () => {
    if (blockerCreated)
        return;
    blockerCreated = true;
    // 确保文档根元素存在
    if (!document.documentElement) {
        console.warn("[AI监管] document.documentElement 不存在");
        return;
    }
    // 创建遮罩容器
    const blocker = safeCreateElement("div", {
        id: "ai-content-blocker",
        style: `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(135deg, #1a2a6c, #b21f1f, #1a2a6c);
      background-size: 400% 400%;
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 2147483647;
      font-family: Arial, sans-serif;
      text-align: center;
      padding: 20px;
      box-sizing: border-box;
      cursor: wait;
    `,
    });
    // 添加动画样式
    const style = safeCreateElement("style");
    style.textContent = `
    @keyframes gradientBG {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    #ai-content-blocker {
      animation: gradientBG 15s ease infinite;
    }
  `;
    // 创建内容元素
    const title = safeCreateElement("h1", {
        style: "font-size: 2.5rem; margin-bottom: 20px;",
    }, "AI 安全扫描中");
    const message = safeCreateElement("div", {
        style: "font-size: 1.2rem; max-width: 600px; margin-bottom: 30px;",
    }, "正在使用深度神经网络分析页面内容，请稍候...");
    const spinner = safeCreateElement("div", {
        style: "width: 60px; height: 60px; border: 5px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: white; animation: spin 1s linear infinite;",
    });
    const footer = safeCreateElement("div", {
        style: "margin-top: 30px; font-size: 0.9rem; opacity: 0.7;",
    }, "高级内容保护系统 | 实时威胁检测");
    // 组装元素
    blocker.appendChild(title);
    blocker.appendChild(message);
    blocker.appendChild(spinner);
    blocker.appendChild(footer);
    // 添加到文档
    document.documentElement.appendChild(style);
    document.documentElement.appendChild(blocker);
    // 使用MutationObserver等待body可用
    if (!bodyObserver) {
        bodyObserver = new MutationObserver(() => {
            if (document.body && !blockerRemoved) {
                // 确保body存在后再设置overflow
                document.body.style.overflow = "hidden";
                // 添加额外安全措施，防止滚动穿透
                const preventScroll = (e) => {
                    if (blockerCreated && !blockerRemoved) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                };
                document.addEventListener("wheel", preventScroll, { passive: false });
                document.addEventListener("touchmove", preventScroll, { passive: false });
                document.addEventListener("keydown", (e) => {
                    if ([32, 33, 34, 35, 36, 38, 40].includes(e.keyCode)) {
                        preventScroll(e);
                    }
                });
            }
        });
        bodyObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });
    }
};
// 移除拦截器
const removeBlocker = () => {
    if (blockerRemoved)
        return;
    blockerRemoved = true;
    const blocker = document.getElementById("ai-content-blocker");
    if (blocker) {
        blocker.style.opacity = "0";
        blocker.style.transition = "opacity 0.5s ease";
        setTimeout(() => {
            blocker.remove();
            // 移除样式标签
            document.querySelectorAll("style").forEach((style) => {
                if (style.textContent?.includes("gradientBG")) {
                    style.remove();
                }
            });
            // 恢复滚动
            if (document.body) {
                document.body.style.overflow = "";
            }
            // 停止观察
            if (bodyObserver) {
                bodyObserver.disconnect();
                bodyObserver = null;
            }
        }, 500);
    }
};
// 显示永久拦截警告
const showPermanentBlock = () => {
    const blocker = document.getElementById("ai-content-blocker");
    if (!blocker)
        return;
    // 更新背景
    blocker.style.background = "radial-gradient(circle, #8B0000, #4B0000)";
    blocker.style.animation = "none";
    // 清空内容
    while (blocker.firstChild) {
        blocker.removeChild(blocker.firstChild);
    }
    // 创建新内容
    const title = safeCreateElement("h1", {
        style: "font-size: 2.5rem; margin-bottom: 20px;",
    }, "⚠️ 危险内容拦截");
    const message = document.createElement("div");
    message.style.cssText =
        "font-size: 1.2rem; max-width: 600px; margin-bottom: 30px; line-height: 1.6;";
    const textNode1 = document.createTextNode("系统检测到违反安全政策的内容");
    const br = document.createElement("br");
    const strong = document.createElement("strong");
    strong.textContent = "此页面已被永久屏蔽";
    message.appendChild(textNode1);
    message.appendChild(br);
    message.appendChild(strong);
    const buttonContainer = safeCreateElement("div", {
        style: "display: grid; grid-template-columns: 1fr 1fr; gap: 15px; max-width: 400px; width: 100%;",
    });
    const backButton = safeCreateElement("button", {
        id: "ai-back-btn",
        style: "padding: 12px; background: #444; border: none; color: white; border-radius: 4px; cursor: pointer;",
    }, "安全返回");
    const reportButton = safeCreateElement("button", {
        id: "ai-report-btn",
        style: "padding: 12px; background: #8B0000; border: none; color: white; border-radius: 4px; cursor: pointer;",
    }, "举报内容");
    const finalFooter = safeCreateElement("div", {
        style: "margin-top: 30px; font-size: 0.9rem; opacity: 0.7;",
    }, "您的安全是我们的首要任务");
    // 组装元素
    buttonContainer.appendChild(backButton);
    buttonContainer.appendChild(reportButton);
    blocker.appendChild(title);
    blocker.appendChild(message);
    blocker.appendChild(buttonContainer);
    blocker.appendChild(finalFooter);
    // 添加按钮功能
    backButton.addEventListener("click", () => {
        window.history.back();
    });
    reportButton.addEventListener("click", () => {
        alert("感谢举报！安全团队将审查此内容");
    });
};
// DOM就绪检查
const waitForDOMReady = (callback) => {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback);
    }
    else {
        setTimeout(callback, 0);
    }
};
// 主执行函数
(() => {
    // 立即尝试创建拦截遮罩
    try {
        createBlocker();
    }
    catch (e) {
        console.error("[AI监管] 初始创建失败:", e);
        // 如果失败，等待DOM就绪后再试
        waitForDOMReady(() => {
            createBlocker();
            // 模拟AI内容检查
            setTimeout(() => {
                if (SAFE_CONTENT) {
                    removeBlocker();
                }
                else {
                    showPermanentBlock();
                }
            }, AI_CHECK_DELAY);
        });
        return;
    }
    // 模拟AI内容检查
    document.addEventListener("DOMContentLoaded", () => {
        console.log("sample", sampleContent());
        setTimeout(() => {
            if (Math.random() < 0.7) {
                removeBlocker();
                console.log("[AI监管] 内容安全 - 已放行");
            }
            else {
                showPermanentBlock();
                console.log("[AI监管] 危险内容 - 已永久拦截");
            }
        }, AI_CHECK_DELAY);
    });
})();
