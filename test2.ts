/**
 * 判断目标字符串是否匹配通配符模式（支持单词内通配）
 * @param pattern 通配符模式（可能包含星号）
 * @param target 目标字符串
 * @returns 是否匹配
 */
function wildcardMatch(pattern: string, target: string): boolean {
    if (pattern === "*") return true;
    if (pattern.indexOf("*") === -1) return pattern === target;

    const parts = pattern.split("*");
    const isStartWithStar = pattern.startsWith("*");
    const isEndWithStar = pattern.endsWith("*");

    let currentIndex = 0;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === "") continue;

        const index = target.indexOf(part, currentIndex);
        if (index === -1) return false;

        if (i === 0 && !isStartWithStar && index !== 0) return false;
        currentIndex = index + part.length;
    }

    if (!isEndWithStar) {
        const lastPart = parts[parts.length - 1];
        if (lastPart !== "" && !target.endsWith(lastPart)) return false;
    }

    return true;
}

/**
 * 匹配域名部分（支持单词通配和星号单词匹配）
 * @param actualParts 实际域名分割数组
 * @param patternParts 模式域名分割数组
 * @returns 是否匹配
 */
function matchHost(actualParts: string[], patternParts: string[]): boolean {
    // 反转数组，从顶级域开始匹配
    const actual = actualParts.slice().reverse();
    const pattern = patternParts.slice().reverse();

    let i = 0,
        j = 0;
    let starJ = -1,
        starI = -1;

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
        } else {
            return false;
        }
    }

    // 处理模式中剩余的部分（必须都是星号）
    while (j < pattern.length) {
        if (pattern[j] !== "*") return false;
        j++;
    }

    return true;
}

/**
 * 判断URL是否符合带通配符的约束模式
 * @param url 要检查的URL字符串
 * @param pattern 通配符模式，格式为 (a)://(b)/(c)
 * @returns 是否匹配
 */
export function isPatternMatch(url: string, pattern: string): boolean {
    // 解析模式：分割协议部分
    const [protocolPattern, rest] = pattern.split("://");
    if (!rest) {
        // 域名模式
        return isPatternMatch(url, "*://" + "*." + pattern + "/*");
    }

    // 分割域名和路径
    const slashIndex = rest.indexOf("/");
    if (slashIndex === -1) return false;

    const hostPattern = rest.substring(0, slashIndex);
    const pathPattern = rest.substring(slashIndex);

    // 解析URL
    let urlObj: URL;
    try {
        urlObj = new URL(url);
    } catch (e) {
        return false;
    }

    // 处理协议
    const actualProtocol = urlObj.protocol.replace(/:$/, "");
    if (!wildcardMatch(protocolPattern, actualProtocol)) {
        return false;
    }

    // 处理端口
    let hostnamePattern: string;
    let portPattern: string | null = null;
    const colonIndex = hostPattern.indexOf(":");
    if (colonIndex !== -1) {
        hostnamePattern = hostPattern.substring(0, colonIndex);
        portPattern = hostPattern.substring(colonIndex + 1);
    } else {
        hostnamePattern = hostPattern;
    }

    // 匹配端口
    const actualPort = urlObj.port;
    if (portPattern !== null) {
        if (!wildcardMatch(portPattern, actualPort)) return false;
    } else if (actualPort !== "") {
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

console.log(
    "Test 1: *.example.com → example.com",
    isPatternMatch("https://example.com", "*://*.example.com/*") === true
); // true

console.log(
    "Test 2: baidu.com → fanyi.baidu.com",
    isPatternMatch("https://fanyi.baidu.com", "*://baidu.com/*") === true
); // true

console.log(
    "Test 3: luogu.com → www.luogu.com.cn",
    isPatternMatch("https://www.luogu.com.cn", "*://luogu.com/*") === false
); // false

console.log(
    "Test 4: www.*.cn → www.luogu.com.cn",
    isPatternMatch("https://www.luogu.com.cn", "*://www.*.cn/*") === true
); // true

console.log(
    "Test 5: *.cn → cn.bing.com",
    isPatternMatch("https://cn.bing.com", "*://*.cn/*") === false
); // false

console.log(
    "Test 6: Port wildcard",
    isPatternMatch("https://tieba.baidu.com:8080", "http*://*.baidu.com:8*/*") === true
); // true

console.log(
    "Test 7: Path matching",
    isPatternMatch("https://example.com/path", "*://example.com/*") === true
); // true

console.log(
    "Test 8: *.com → sub.domain.com",
    isPatternMatch("https://sub.domain.com", "*://*.com/*") === true
); // true

console.log(
    "Test 9: *.com.cn → test.com.cn",
    isPatternMatch("https://test.com.cn", "*://*.com.cn/*") === true
); // true

console.log(
    "Test 10: test.*.cn → test.com.cn",
    isPatternMatch("https://test.com.cn", "*://test.*.cn/*") === true
); // true

console.log(
    "Test 11: *.d.com → a.b.c.d.com",
    isPatternMatch("https://a.b.c.d.com", "*://*.d.com/*") === true
); // true

console.log(
    "Test 12: example.* → example.com",
    isPatternMatch("https://example.com", "*://example.*/*") === true
); // true

console.log(
    "Test 13: *.z.com → x.y.z.com",
    isPatternMatch("https://x.y.z.com", "*://*.z.com/*") === true
); // true

console.log(
    "Test 14: y.z.com → x.y.z.com",
    isPatternMatch("https://x.y.z.com", "*://y.z.com/*") === true
); // true

console.log(
    "Test 15: Port mismatch",
    isPatternMatch("https://example.com:8080", "*://example.com:80/*") === false
); // false

console.log(
    "Test 16: *.baidu.com → baidu.com",
    isPatternMatch("https://baidu.com", "*://*.baidu.com/*") === true
); // true

console.log(
    "Test 17: ",
    isPatternMatch("https://www.luogu.com.cn:8000/", "*://*.*u*gu.c*.*.*:*0/*") === true
);