/**
 * 判断目标字符串是否匹配通配符模式
 * @param pattern 通配符模式（可能包含星号）
 * @param target 目标字符串
 * @returns 是否匹配
 */
function wildcardMatch(pattern: string, target: string): boolean {
    // 如果模式不包含星号，则直接比较字符串
    if (pattern.indexOf('*') === -1) {
        return pattern === target;
    }

    // 将模式按星号拆分成多个部分
    const parts = pattern.split('*');
    // 如果模式以星号开头，则第一个部分为空字符串；同样，以星号结尾时最后一个部分为空
    const isStartWithStar = pattern.startsWith('*');
    const isEndWithStar = pattern.endsWith('*');

    let currentIndex = 0;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // 空部分（连续星号或开头/结尾星号）直接跳过
        if (part === '') continue;

        // 查找当前部分在目标字符串中的位置
        const index = target.indexOf(part, currentIndex);
        if (index === -1) return false;

        // 对于第一个部分（非空），如果不是以星号开头，则必须从目标字符串开头匹配
        if (i === 0 && !isStartWithStar && index !== 0) {
            return false;
        }

        // 更新当前查找位置
        currentIndex = index + part.length;
    }

    // 检查最后一个部分是否匹配到目标字符串的末尾（如果不是以星号结尾）
    if (!isEndWithStar) {
        const lastPart = parts[parts.length - 1];
        if (lastPart !== '' && !target.endsWith(lastPart)) {
            return false;
        }
    }

    return true;
}

/**
 * 判断 URL 是否符合带通配符的约束模式
 * @param url 要检查的 URL 字符串
 * @param pattern 通配符模式，格式为 (a)://(b)/(c)
 * @returns 是否匹配
 */
function isPatternMatch(url: string, pattern: string): boolean {
    // 解析 pattern：分割协议部分
    const [protocolPattern, rest] = pattern.split('://');
    if (!rest) return isPatternMatch(url, `*://${protocolPattern}/*`);

    // 查找第一个斜杠，用于分割域名和路径
    const slashIndex = rest.indexOf('/');
    if (slashIndex === -1) return false;

    // 提取域名部分和路径部分
    const hostPattern = rest.substring(0, slashIndex);
    const pathPattern = rest.substring(slashIndex); // 包含开头的斜杠

    // 解析 URL
    let urlObj: URL;
    try {
        urlObj = new URL(url);
    } catch (e) {
        return false; // 无效的 URL
    }

    // 处理协议：移除实际协议中的冒号后缀
    const actualProtocol = urlObj.protocol.replace(/:$/, '');
    // 获取主机名、端口和路径名
    const actualHostname = urlObj.hostname;
    const actualPort = urlObj.port;
    const actualPathname = urlObj.pathname;

    // 1. 匹配协议部分
    if (!wildcardMatch(protocolPattern, actualProtocol)) {
        return false;
    }

    // 2. 处理域名部分（分离主机名和端口）
    let hostnamePattern: string;
    let portPattern: string | null = null;
    const colonIndex = hostPattern.indexOf(':');
    if (colonIndex !== -1) {
        hostnamePattern = hostPattern.substring(0, colonIndex);
        portPattern = hostPattern.substring(colonIndex + 1);
    } else {
        hostnamePattern = hostPattern;
    }

    // 3. 匹配端口部分
    if (portPattern !== null) {
        // 模式指定了端口，必须显式匹配
        if (!wildcardMatch(portPattern, actualPort)) {
            return false;
        }
    } else {
        // 模式未指定端口，则实际端口必须为空（不考虑默认端口）
        if (actualPort !== '') {
            return false;
        }
    }

    // 4. 匹配主机名部分（反转域名层级进行后缀匹配）
    const patternHostArray = hostnamePattern.split('.').reverse();
    const actualHostArray = actualHostname.split('.').reverse();

    // 实际域名层级不能少于模式
    if (actualHostArray.length < patternHostArray.length) {
        return false;
    }

    for (let i = 0; i < patternHostArray.length; i++) {
        if (!wildcardMatch(patternHostArray[i], actualHostArray[i])) {
            return false;
        }
    }

    // 5. 匹配路径部分
    return wildcardMatch(pathPattern, actualPathname);
}

console.log(isPatternMatch("https://example.com/affbfbcdeeecdiii", "https://example.com/a*b*c*d")); // true