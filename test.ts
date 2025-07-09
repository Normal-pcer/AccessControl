// ==UserScript==
// @name         多引擎搜索监听器(防浪费版)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  监听搜索内容并防止页面刷新导致的token浪费
// @author       You
// @match        *://*.bing.com/*
// @match        *://*.google.com/*
// @match        *://*.baidu.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

namespace SEObserver {
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
                const input = document.querySelector("textarea[name='q']") as HTMLTextAreaElement;
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
}

(function () {
    "use strict";
    if (window.self !== window.top) {
        console.log("Skipping iframe:", window.location.href);
        return;
    }

    // 启动脚本
    SEObserver.start([
        (e) => {
            console.log("handle", e);
        },
    ]);
})();
