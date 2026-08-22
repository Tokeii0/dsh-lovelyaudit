---
name: code-audit
description: 跨语言代码审计方法论：取全源码与反编译、Source/Sink/Sanitizer 污点模型、Sink 驱动逆向连线、逐类型全库扫、配置与依赖审计。做 P4 白盒、拿到源码或字节码、审 Java/PHP/Python/Node/Go/.NET/Ruby 任意语言项目时使用；语言专属陷阱另见 language-stack-audit。
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
| Ruby | .rb（一般不编译） | 直接读；`gem unpack` 拆 gem |
| Rust | 编译二进制 | 符号/字符串分析；有源码优先审 `unsafe` |
| C/C++ | 二进制/.so/.dll | Ghidra/IDA；有源码直接审内存安全 |
| 移动端 | .apk / .ipa | `apktool` + `jadx`（Android）；`class-dump`/Hopper（iOS） |
| 前端 | bundle.js | source map、webcrack、AST 反混淆 |

```bash
# Java 示例：classes 整体反编译（比逐个 .class 高效）
jar -cf all.jar -C WEB-INF/classes .
java -jar cfr.jar all.jar --outputdir ./src
# 嵌套 jar / 归档也要拆开
find . -name "*.jar" -o -name "*.rar" -o -name "*.zip" -o -name "*.bak"
```

**关键纪律：取全，别漏。** 只反编译主包、漏掉 `lib/` 自研 jar、`.rar` 备份、`.class.bak` 是高频失误——硬编码口令常藏在不起眼的工具类里。**没反编译的，就是没审的。**

**多语言项目要逐栈过。** 现实项目常是「主站 Java + 老模块 PHP + 前端 TS + 某个服务 Go + native 加密库 C」。先跑一遍栈盘点，每个栈都要按 `language-stack-audit` 的对应 references 文件配锚点：

```bash
ls package.json composer.json requirements.txt pyproject.toml go.mod pom.xml build.gradle \
   Gemfile *.csproj Cargo.toml CMakeLists.txt 2>/dev/null
find . -name "*.php" -o -name "*.py" -o -name "*.go" -o -name "*.rb" -o -name "*.cs" \
     -o -name "*.java" -o -name "*.ts" | sed 's/.*\.//' | sort | uniq -c | sort -rn
```

**只用 Java 的 grep 模式去扫一个混栈项目，就是系统性漏报。**

**版本控制历史也是源。** 有 `.git` 时：`git log -p` 找被删掉的密钥、`git stash list`、被 revert 的补丁（**revert 掉的安全修复 = 现存漏洞**）；补丁 diff 是 1-day 与变体的富矿（见 `unknown-vuln` 技术三）。

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
| **框架自动绑定** | `@RequestBody Entity`、`@ModelAttribute` | Laravel `$request->all()`、Rails `params`、Django Form/Serializer、Gin `ShouldBind`、NestJS DTO、.NET Model Binding |
| **二次污点** | **数据库回读值、缓存、文件内容、第三方回调** | 同 |
| 非 HTTP 入口 | MQ 消息、定时任务读的文件、导入的 Excel/CSV/XML、WebSocket 消息、gRPC 请求、CLI 参数、环境变量 | 同 |

**二次污点最易漏**：从 DB 读出的值再拼进 SQL/命令/HTML 同样是注入；存储型 XSS、二阶 SQLi 都属此类。**把「可被用户写入的持久化数据」也当 Source。**

**框架自动绑定是被低估的 Source**：一次绑定就把请求体所有字段灌进实体——不给字段白名单就是 **Mass Assignment**（多传 `role`/`isAdmin`/`balance`）。各栈锚点见 `language-stack-audit`。

**非 HTTP 入口同样是 Source**：只审 Controller 会漏掉「MQ 消费者 / 定时任务 / 文件导入 / 管理后台批量操作」这些路径——它们往往**因为"内部调用"而完全没做校验**。

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

**自动化辅助但不能全信**：Fortify/Checkmarx/CodeQL/Semgrep/find-sec-bugs（Java）、Psalm/Phan（PHP）、Bandit（Python）、gosec（Go）、brakeman（Rails）、eslint-plugin-security（Node）、cargo-audit + clippy（Rust）。CodeQL/Semgrep 可写自定义 taint 规则。误报多、漏报也多——**人工看逻辑，工具扫广度。**

**污点链断在哪里，漏洞就藏在哪里。** 工具和人都容易在这些地方跟丢：

| 断链处 | 表现 | 对策 |
|---|---|---|
| **反射 / 动态派发** | `Method.invoke`、`Type.GetType(x)`、PHP `$$f()`/`call_user_func`、Python `getattr`、Ruby `send` | 手工连；同时**本身就是漏洞**（方法名可控 = 任意方法调用） |
| **依赖注入 / AOP** | 接口调用看不到实现 | 按接口找全部实现类，逐个看 |
| **配置驱动的分发** | XML/YAML/注解里配的处理器映射 | 从配置反查 |
| **跨语言/跨进程** | Java 调 native、Node 调 Python 脚本、走 MQ/RPC | 两端都要审，Sink 在另一个仓库里 |
| **模板/前端** | 后端只给数据，渲染在模板里 | 模板文件也要扫（未转义输出） |
| **存储中转** | Source 写库 → 另一个模块读库 → Sink | 二次污点，靠字段名跨模块搜 |

遇到断链**不要默认安全**——标记为「未追完」并在 P7 复查清单里留项。

## W4 逐类型全库扫（白盒兜底）

对 `vuln-coverage` skill 里的**每一类漏洞**用固定模式扫全库，一类不落——这是纪律，不是灵感。**每一类都要同时用「通用锚点」和「本项目语言的专属锚点」（`language-stack-audit`）扫两遍。** 顺序按后果严重度：

1. RCE 类：反序列化、命令注入、表达式/模板注入、上传、文件包含（PHP）、JNDI/日志注入（Java）、解压与解析器
2. 数据泄露类：SQLi/NoSQL、任意文件读、越权/IDOR/多租户、信息泄露
3. 写入/破坏类：任意文件写/删、SSRF、XXE、Zip Slip
4. 客户端类：XSS、开放重定向、CSRF、CORS、原型链污染
5. 认证授权类：认证绕过、会话、JWT/OAuth、BFLA（→ `auth-authz-testing`）
6. 密码学/配置类：硬编码密钥、弱加密、框架密钥泄露、会话/传输配置
7. 并发类：竞态/TOCTOU（→ `unknown-vuln` 技术五）

## W5 配置审计（常被忽略、却是根因）

**配置决定「防护是否真的生效」。**

| 配置 | 审什么 |
|---|---|
| web.xml / 路由配置 | Filter/鉴权**映射范围**、是否被注释、url-pattern、welcome/error 页 |
| Spring/DI 配置 | AOP **切点范围**、拦截器覆盖、Bean 暴露 |
| ORM 配置 | 数据源、方言、SQL 打印、二级缓存（硬编码数据源、SQL 明文入日志） |
| 中间件 | 目录列表、脚本解析目录、错误页、Server 头（上传目录能否解析脚本） |
| 密钥/凭据 | 硬编码口令/AK/SK、弱默认密钥 |
| **框架主密钥** | Django `SECRET_KEY`、Flask `secret_key`、Laravel `APP_KEY`、Rails `secret_key_base`、.NET `MachineKey`、Spring 各类 secret——**泄露即会话伪造/反序列化/直接接管**，跨栈同构，价值极高 |
| **调试模式** | `DEBUG=True`(Django)、`debug=true`(Flask/Spring)、`APP_DEBUG`、`customErrors=Off`(.NET)、`display_errors`(PHP)、`consider_all_requests_local`(Rails) —— 泄露堆栈、配置甚至可 RCE（Werkzeug 控制台） |
| **CORS 与安全响应头** | `Allow-Origin` 是否反射/通配 + `Allow-Credentials`；CSP/HSTS/X-Frame-Options/X-Content-Type-Options 基线 |
| **管理端点暴露** | actuator（尤其 `/env` `/heapdump` `/jolokia`）、druid、swagger、console、trace.axd/elmah.axd、`/debug/pprof`(Go)、Django admin |
| **云与容器配置** | 云凭据文件与环境变量、K8s manifest 里的 secret、`docker-compose.yml` 明文口令、对象存储桶 ACL |
| **CI/CD 配置** | `.github/workflows`、`.gitlab-ci.yml`、Jenkinsfile 里的凭据与不可信输入插值 |

**读配置是理解「真实执行」的唯一途径。代码写了鉴权、配置没挂上，等于没有。注释掉的配置尤其要读——它揭示「本来该有什么防护，现在没了」。**

## W6 依赖与组件审计

```bash
# Java: WEB-INF/lib/*.jar；Node: package-lock.json；PHP: composer.lock；Python: requirements.txt
trivy fs --scanners vuln .   # 或 OWASP Dependency-Check / Snyk / grype
```

1. **有 CVE ≠ 可利用**——看是否存在可达调用点（回到污点分析）。分「链路已确认」和「存在即风险」两级。
2. 重点组件：序列化库（fastjson/Jackson/xstream/pickle/PHP POP 链）、日志库（log4j）、上传库、XML/YAML 库、模板引擎、图片与文档解析器（ImageMagick/ffmpeg/PDF/Office——**解析器就是 RCE 面**）、压缩库、Web 框架本身。
3. **传递依赖**也要查；无 lockfile / 版本范围过宽（`^` `*` `latest`）本身就是缺陷。
4. **供应链视角**（不止查 CVE）：依赖混淆（私有包名在公共源可抢注）、registry 优先级配置、制品签名、`postinstall` 脚本、镜像层泄密、CI 里的凭据与不可信输入插值 → 见 `modern-attack-surface` M7。
5. **自研"安全工具类"要单独审**：项目里那个 `SecurityUtil` / `Filter` / `XssUtil` 往往是黑名单实现，是全站防护的单点——**它一被绕，所有依赖它的地方同时失守**（这也是变体分析最高效的入口）。

## W7 逻辑与业务审计（通向未知漏洞）

模式扫描覆盖「已知类型」，但**逻辑漏洞、业务越权、状态机缺陷扫不出来**——0-day 主战场，见 `unknown-vuln` skill。白盒阶段先标记：

- 认证/授权判定逻辑（哪里判 userId、判 role、判归属）。
- 涉及金额/数量/状态/权限变更的流程。
- 多步流程、并发、幂等、签名校验、验证码校验的实现。

## 白盒产出清单（交给 P5 互证）

1. **缺陷清单**（未定级）：文件:行、Source、Sink、Sanitizer 评估、触发前置。
2. **配置根因**（鉴权范围、注释掉的防护、硬编码凭据、框架主密钥、调试模式）。
3. **依赖 CVE 清单**（分「链路已确认/存在即风险」）+ 供应链缺陷。
4. **逻辑可疑点**（交 unknown-vuln 深挖）。
5. **裸奔方法清单**（控制器方法全集 − 授权注解集，见 `auth-authz-testing` Z9）。
6. **未追完的断链清单**（反射/跨进程/跨仓库处跟丢的污点）——**交 P7 复查，不能默认安全**。
7. **技术栈盘点**：每个栈是否都按 `language-stack-audit` 对应 references 文件扫过。

这些与黑盒可达面地图在 P5 互证叠加定级——**不要直接当黑盒结论**。
