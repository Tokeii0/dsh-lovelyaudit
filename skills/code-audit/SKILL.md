---
name: code-audit
description: 跨语言代码审计：取全源码、Source/Sink/Sanitizer 污点模型、逆向连线、配置与依赖。做 P4 白盒或已有源码/字节码时使用。
---

# 代码审计完整流程

使命：在看得见逻辑的前提下，找出「哪里可能有洞」——包括黑盒永远摸不到的盲区包、需要特定参数组合的洞、被吞掉回显的洞。

核心方法只有一句话：**污点分析——追踪不可信输入（Source）如何流到危险操作（Sink）。** 其余都是围绕它的工程手段。

## W1 取源（拿到可审的代码）

**字节码/编译产物也是源码。**

| 栈 | 产物 | 取源方法 |
|---|---|---|
| Java | .class/.jar/.war | CFR/Procyon/Fernflower 反编译；`jar -xf` 拆包 |
| .NET | .dll/.exe | dnSpy/ILSpy |
| PHP | .php（可能 ionCube/Zend 加密） | 直接读；加密需解密工具 |
| Node | .js（压缩/混淆/打包） | Prettier 美化；source map 还原；`asar extract` |
| Python | .pyc | decompyle3/uncompyle6 |
| Go | 编译二进制 | 符号/字符串分析（strings、Ghidra），难还原 |
| 前端 | bundle.js | source map、webcrack、AST 反混淆 |

```bash
# Java 示例：classes 整体反编译（比逐个 .class 高效）
jar -cf all.jar -C WEB-INF/classes .
java -jar cfr.jar all.jar --outputdir ./src
# 嵌套 jar / 归档也要拆开
find . -name "*.jar" -o -name "*.rar" -o -name "*.zip" -o -name "*.bak"
```

**关键纪律：取全，别漏。** 只反编译主包、漏掉 `lib/` 自研 jar、`.rar` 备份、`.class.bak` 是高频失误——硬编码口令常藏在不起眼的工具类里。**没反编译的，就是没审的。**

## W2 建立污点模型（Source / Sink / Sanitizer 三张全集表）

缺一漏一片。

### ① Source 全集（不可信输入从哪来）

不要只盯 getParameter：

| 类别 | Java | 其他栈等价 |
|---|---|---|
| 请求参数 | getParameter/getParameterValues | `$_GET/$_POST`、`req.query/body`、`request.args` |
| 请求头 | getHeader/getHeaders | `$_SERVER['HTTP_*']`、`req.headers` |
| Cookie | getCookies | `$_COOKIE`、`req.cookies` |
| 请求体/流 | getInputStream/getReader | `php://input`、`req.on('data')` |
| 路径 | getPathInfo/getRequestURI | `$_SERVER['PATH_INFO']`、`req.path` |
| 上传 | MultipartFile.getOriginalFilename | `$_FILES`、multer |
| **二次污点** | **数据库回读值、缓存、文件内容、第三方回调** | 同 |

**二次污点最易漏**：从 DB 读出的值再拼进 SQL/命令/HTML 同样是注入；存储型 XSS、二阶 SQLi 都属此类。**把「可被用户写入的持久化数据」也当 Source。**

### ② Sink 全集（危险操作汇聚点）

| Sink 类 | 后果 | grep 锚点（Java） |
|---|---|---|
| SQL/ORM 执行 | 注入 | `Statement.execute*`、`createQuery`、`createSQLQuery` |
| 文件路径 | 穿越/任意读写删 | `new File`、`FileInputStream/OutputStream`、`getRealPath`、`transferTo`、`delete` |
| 命令执行 | RCE | `Runtime.exec`、`ProcessBuilder` |
| 反序列化 | RCE | `readObject`、`XMLDecoder`、`fromXML`、fastjson autotype、`readValue`+enableDefaultTyping |
| XML 解析 | XXE | `SAXReader`、`DocumentBuilderFactory`、`SAXParser`、`Unmarshaller` |
| 外部请求 | SSRF | `new URL().openConnection`、`HttpClient`、`HttpGet`、代理转发 |
| 响应输出 | XSS | `out.print`、`response.getWriter().write`、JSP `<%= %>` |
| 重定向 | 开放重定向 | `sendRedirect`、Location 头、`window.open/location=` |
| 模板 | SSTI | 模板引擎 `evaluate/merge/render` 传入用户数据 |
| 表达式 | EL/OGNL/SpEL 注入 | `ExpressionParser`、`Ognl.getValue` |
| 加解密/口令 | 弱密码学/硬编码 | `Cipher.getInstance`、硬编码 `= "..."` |

### ③ Sanitizer 全集（防护在哪、是否有效）

找出项目的防护函数，逐个评估：

- **上下文是否正确**？HTML 编码防不了 JS 上下文、URL 上下文。
- **是否可绕**？黑名单 `../` 可被 `..%2f`/`....//` 绕；只转单引号的 escapeSql 对数字/标识符上下文无效。
- **是否被真正调用**？有的路径根本没走 sanitizer。

**把无效防护当有效，是系统性误判。审计必须验证每个 sanitizer 的真实强度。**

## W3 污点连线（Source → Sink）

每条从 Source 到 Sink 且中间无有效 Sanitizer 的路径，就是一个候选漏洞。

- **逆向（Sink 驱动，推荐主用）**：Sink 数量远少于 Source，且 Sink 才是出事的地方。先扫全所有 Sink，对每个命中向上追参数来源、看调用链、看有没有白名单/参数化。
- **正向（Source 驱动）**：适合回答「这个参数会怎样」。

```bash
grep -rnE 'execute(Query|Update)\("[^"]*"\s*\+|createQuery\([^)]*\+' src --include="*.java"
```

**自动化辅助但不能全信**：Fortify/Checkmarx/CodeQL/Semgrep/find-sec-bugs（Java）、Psalm/Phan（PHP）、Bandit（Python）、gosec（Go）。CodeQL/Semgrep 可写自定义 taint 规则。误报多、漏报也多（框架特有 Source、反射、动态派发）——**人工看逻辑，工具扫广度。**

## W4 逐类型全库扫（白盒兜底）

对 `vuln-coverage` skill 里的**每一类漏洞**用固定模式扫全库，一类不落——这是纪律，不是灵感。顺序按后果严重度：

1. RCE 类：反序列化、命令注入、表达式注入、上传、SSTI
2. 数据泄露类：SQLi、任意文件读、越权/IDOR、信息泄露
3. 写入/破坏类：任意文件写/删、SSRF、XXE
4. 客户端类：XSS、开放重定向、CSRF
5. 密码学/配置类：硬编码密钥、弱加密、会话/传输配置

## W5 配置审计（常被忽略、却是根因）

**配置决定「防护是否真的生效」。**

| 配置 | 审什么 |
|---|---|
| web.xml / 路由配置 | Filter/鉴权**映射范围**、是否被注释、url-pattern、welcome/error 页 |
| Spring/DI 配置 | AOP **切点范围**、拦截器覆盖、Bean 暴露 |
| ORM 配置 | 数据源、方言、SQL 打印、二级缓存（硬编码数据源、SQL 明文入日志） |
| 中间件 | 目录列表、脚本解析目录、错误页、Server 头（上传目录能否解析脚本） |
| 密钥/凭据 | 硬编码口令/AK/SK、弱默认密钥 |

**读配置是理解「真实执行」的唯一途径。代码写了鉴权、配置没挂上，等于没有。注释掉的配置尤其要读——它揭示「本来该有什么防护，现在没了」。**

## W6 依赖与组件审计

```bash
# Java: WEB-INF/lib/*.jar；Node: package-lock.json；PHP: composer.lock；Python: requirements.txt
trivy fs --scanners vuln .   # 或 OWASP Dependency-Check / Snyk / grype
```

1. **有 CVE ≠ 可利用**——看是否存在可达调用点（回到污点分析）。分「链路已确认」和「存在即风险」两级。
2. 重点组件：序列化库（fastjson/Jackson/xstream）、日志库（log4j）、上传库、XML 库、模板引擎、Web 框架本身。
3. **传递依赖**也要查。

## W7 逻辑与业务审计（通向未知漏洞）

模式扫描覆盖「已知类型」，但**逻辑漏洞、业务越权、状态机缺陷扫不出来**——0-day 主战场，见 `unknown-vuln` skill。白盒阶段先标记：

- 认证/授权判定逻辑（哪里判 userId、判 role、判归属）。
- 涉及金额/数量/状态/权限变更的流程。
- 多步流程、并发、幂等、签名校验、验证码校验的实现。

## 白盒产出清单（交给 P5 互证）

1. **缺陷清单**（未定级）：文件:行、Source、Sink、Sanitizer 评估、触发前置。
2. **配置根因**（鉴权范围、注释掉的防护、硬编码凭据）。
3. **依赖 CVE 清单**（分「链路已确认/存在即风险」）。
4. **逻辑可疑点**（交 unknown-vuln 深挖）。

这些与黑盒可达面地图在 P5 互证叠加定级——**不要直接当黑盒结论**。
