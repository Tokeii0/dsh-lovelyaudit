---
name: vuln-coverage
description: 已知漏洞类型全覆盖清单与入口×类型矩阵：RCE/注入/文件/SSRF/XXE/XSS/越权/CORS/WebSocket/原型链/协议层/认证/密码学/配置/竞态逐类锚点与易漏点。白盒逐类扫描、P7 收口自查、或要确认「这类查过没有」时使用。
---

# 漏洞类型全覆盖清单

「不放过任何一个」的白盒兜底：**每一类漏洞逐条过一遍**，用固定的 Source/Sink/模式扫全库。当 checklist——每类都要有明确的「已查·有/无」结论。

> 锚点默认给通用与 Java 写法；**你的目标是别的语言时，同一类漏洞的函数名完全不同**——每类都要再用 `language-stack-audit` 的对应 references 文件扫一遍。

覆盖矩阵模板（收尾自查用）：每个入口（行）× 每类漏洞（列）打勾，**不允许空格**：

| 入口\类型 | RCE | SQLi | 文件 | SSRF | XXE | XSS | 越权 | 认证 | CSRF | 重定向 | 密码学 | 并发 | 信息 | 逻辑 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Controller/路由 A | | | | | | | | | | | | | | |

各列口径（避免"打勾了但没真查"）：**认证**=该入口的身份来源与鉴权是否可信（→ `auth-authz-testing`）；**并发**=该入口有无"检查后使用"的竞态窗口；**信息**=该入口响应/报错/日志是否泄露敏感数据或内部信息。

> ⚠️ **矩阵是「入口 × 类型」，盖不住不属于单个入口的面。** CORS、WebSocket、HTTP 协议层（Host 头/缓存/走私）、Mass Assignment、多租户隔离、依赖 CVE 与供应链、配置基线、云与非 HTTP 服务 **都不在列里**——它们永远不会因为"有空格"被发现漏掉。这些走本篇的 **§H 矩阵外必查清单**，与矩阵一起交付。

# A · RCE 类（最高优先）

## A1 反序列化

- **Source**：请求体/参数/Cookie/Header 中的序列化数据。魔术前缀：Java `rO0`(base64)/`aced`(hex)；.NET `AAEAAAD`；PHP `O:`/`a:`；Python pickle `\x80`。
- **Sink grep 锚点**：
  - Java：`readObject` `readUnshared` `XMLDecoder` `xstream.fromXML` `SerializationUtils.deserialize` `readValue`+`enableDefaultTyping` fastjson `JSON.parse`(autotype)
  - PHP：`unserialize(` `yaml_parse`
  - Python：`pickle.loads` `yaml.load`(非 safe) `marshal.loads`
  - .NET：`BinaryFormatter.Deserialize` `LosFormatter` `ObjectStateFormatter` `Json.NET TypeNameHandling`
- **判定**：不可信数据是否进入 Sink；classpath 是否有 gadget（commons-collections/beanutils…）。
- **易漏**：处理「自身生成的固定文件」≠漏洞，处理**用户可控字节流**才是；二次污点（DB/文件读出的序列化数据）。

## A2 命令注入

- **Sink**：Java `Runtime.exec`/`ProcessBuilder`；PHP `system/exec/shell_exec/passthru/popen/proc_open`/反引号；Python `os.system`/`subprocess(shell=True)`；Node `child_process.exec`；Ruby `system`/反引号/`%x`。
- **判定**：用户输入是否拼进命令行；有无 shell 元字符过滤（`; | & $ \` > <`）。
- **易漏**：间接调用（脚本/批处理里再拼）；**参数注入**（`-o`/`--option` 型，不需元字符）。

## A3 表达式/模板注入（OGNL/SpEL/EL/SSTI）

- **Sink**：`Ognl.getValue`、`SpelExpressionParser.parseExpression`、`${...}` 进 ExpressionFactory；Velocity/Freemarker/Thymeleaf/Jinja2/Twig 的 evaluate/merge/render 传入用户数据。
- **判定**：用户数据是否作为**表达式/模板**而非数据被求值。
- **黑盒探针**：`${7*7}` `#{7*7}` `{{7*7}}` `<%=7*7%>` → 返回 `49`。

## A4 文件上传 → WebShell

- **Sink**：`transferTo`、MultipartFile.getInputStream+写盘、`move_uploaded_file`、multer。
- **判定要点（穷举绕过面）**：
  - 扩展名：黑名单 vs 白名单？大小写？`.jsp.`/`.jsp;`/`.jspx`/`.phtml`/`.pht`/`.asa`？双扩展？`%00` 截断？
  - 内容：有无文件头校验？图片马绕过？
  - 落地目录：可控？能否穿越？**该目录中间件是否解析脚本？**（根因——目录不解析脚本，上传再随意也难 getshell）
  - 文件名：是否随机化？可否覆盖已有文件？
- **易漏**：`.svg/.html/.swf` 白名单内 → 存储型 XSS；中间件历史解析漏洞。

## A5 解压与解析器（上传的"下半场"，极易整块漏掉）

上传只是入口，**服务端拿到文件后怎么处理**才是 RCE 面：

- **Zip Slip / Tar Slip**：压缩包内条目名带 `../` 或绝对路径 → 解压时写到目录外（写 webshell / 覆盖配置 / 覆盖计划任务）。锚点：Java `ZipEntry.getName()` 直接拼路径、Python `extractall`、Node `unzip`、PHP `ZipArchive::extractTo`。**判定：解压前有没有对 entry name 做 canonical 化 + 前缀校验。**
- **压缩炸弹**：高压缩比文件 → 磁盘/内存耗尽（红线内只评估不实打）。
- **解析器 RCE/SSRF**：ImageMagick（ImageTragick、MSL/MVG）、ffmpeg（HLS/concat 读本地文件、SSRF）、LibreOffice/Office 宏与外部实体、PDF 解析器、字体/压缩库、Excel 公式注入（CSV Injection → 客户端 RCE）。**凡是"服务端替你处理上传文件"的功能（缩略图、转码、预览、导入、水印、OCR）都是解析器攻击面。**
- **XML/SVG 类文件同时是 XXE 入口**（docx/xlsx/svg 本质是 XML）。

## A6 JNDI / 日志注入（Java 生态高危，非 Java 也有日志伪造）

- **JNDI 注入**：`${jndi:ldap://}` 进 log4j2 lookup → RCE。凡是**用户可控内容进日志**（UA、Referer、用户名、参数、异常消息）且 log4j2 版本落后都要测。同类：Logback JNDI、`InitialContext.lookup(userInput)`、JNDI 数据源可配置。
- **日志注入/日志伪造**：`\n` 未过滤 → 伪造日志行，掩盖攻击痕迹、污染审计与 SIEM 告警；日志被下游系统解析时可升级为二次注入。
- **日志内容泄露**：口令/token/身份证/完整请求体进日志，日志文件 Web 可读 = 直接泄露。

# B · 数据泄露类

## B1 SQL / HQL / NoSQL 注入

- **Sink**：`Statement.execute*("..."+x)`、`createQuery/createSQLQuery(...+x)`、拼完才 prepare 的假参数化；PHP `mysqli_query`/`$pdo->query(拼接)`；Node 拼接进 query；Mongo `$where`/JS 注入。
- **grep**：
  ```
  execute(Query|Update)\("[^"]*"\s*\+       # Java 原生拼接
  createQuery\(|createSQLQuery\(            # HQL（+ 号拼接）
  \$pdo->query\(|mysqli_query\(             # PHP
  ```
- **判定**：参数是否绑定（?/命名参数）**且拼接发生在 prepare 之前**；标识符（表名/列名/order by）**无法绑定，必须白名单**。
- **上下文决定可利用性**：
  - 字符串上下文 `'...'` → 需闭合引号
  - **数字上下文** `id=1` → 无需引号，escapeSql 类防护无效
  - **标识符上下文** `order by X`/表名 → 绑定无效，最危险
- **易漏**：`PreparedStatement.executeQuery(sql)` 传参退化成普通 Statement；二阶注入。

## B2 路径穿越 / 任意文件读

- **Sink**：`new File(base + userInput)`、`getRealPath(userInput)`、FileInputStream、PHP `readfile/include/require`、Node `fs.readFile`、Python `send_file`。
- **判定**：是否 canonical 化后做**前缀校验**（`getCanonicalPath().startsWith(base)`）；黑名单 `../` 不可靠。
- **易漏**：**只校验了一个参数漏了另一个**（校验 filename 漏 moduleName / uploadPath——一个模式带一串）；编码绕过 `..%2f`/`..%c0%af`/`....//`；绝对路径；空字节。

## B3 越权 / IDOR（逻辑，模式扫不出）

> 这一列在矩阵里只有一格，但实际是**一整个专项**——完整清单见 `auth-authz-testing`（角色矩阵、多租户、BFLA、密码重置链）。这里只列最小判定。

- **看**：每个「按 id 取数据/改数据」的入口，是否校验**该资源归属当前用户**。
- **判定**：`where id=?` 但没有 `and owner=当前用户`；权限判定用**客户端传入**的 role/orgId 而非会话值。
- 高危变体：某参数可切换会话身份——认证/授权逻辑把「请求参数」当「身份来源」，属逻辑越权（见 unknown-vuln）。
- **易漏**：列表/详情有鉴权但**导出/打印/报表/附件下载/批量接口**没有；主参数校验了归属而**第二个参数**（`deptId`/`fileId`/`attachId`）没校验。

## B3.5 Mass Assignment / 参数污染

- **Mass Assignment（CWE-915）**：请求体直接绑定实体且无字段白名单 → 多传 `role`/`isAdmin`/`status`/`balance`/`tenantId` 直接提权改数据。各栈锚点见 `language-stack-audit`（Spring `@RequestBody`、Laravel `fill($request->all())`、Rails `permit!`、Gin `ShouldBind`、NestJS 未开 `whitelist`、.NET Model Binding）。**这是 API 时代最高频却最少被查的一类。**
- **HPP 参数污染**：`?id=1&id=2` 或 `id[]=1&id[]=2` —— WAF 与后端取值不一致（绕过），或类型从 string 变 array 让校验逻辑失效。
- **字段过度暴露（API3）**：返回整个 ORM 对象，把 `passwordHash`/`token`/`idCard`/内部字段一起吐出来——前端不显示不等于没返回。**逐个 API 看响应体全字段。**

## B4 信息泄露

- 硬编码凭据/密钥：`grep -riE '(password|secret|ak|sk|token)\s*=\s*"'`
- 异常堆栈回显；调试输出（`System.out`/`printStackTrace`/`console.log`/`var_dump`）
- 备份/VCS 文件；日志含 PII/口令；页面注释含内网 IP

# C · 服务端请求 / 解析类

## C1 SSRF

- **Sink**：`new URL(x).openConnection`、HttpClient/HttpGet(x)、PHP `curl_exec`、Python `requests.get(x)`、Node fetch/axios(x)、图片抓取/URL 预览/Webhook/代理转发。
- **判定**：目标 URL 是否用户可控；有无协议白名单（禁 file/gopher/dict）、内网地址黑名单、**禁重定向**。
- **易漏（绕过面）**：漏 loopback/link-local（`169.254.169.254` 云元数据）/IPv6；跟随重定向绕过；十进制/十六进制/八进制 IP；DNS rebinding；`[::]`/`0.0.0.0`。

## C2 XXE

- **Sink**：SAXReader、DocumentBuilderFactory、SAXParserFactory、XMLStreamReader、Unmarshaller、PHP simplexml_load_string、Python lxml.etree。
- **判定**：是否**禁用 DTD/外部实体**；全库 grep 解析器创建点看有无加固——**零加固 = 全部有 XXE 面**。
- **易漏**：入口在第三方回调/文件上传解析里（docx/xlsx/svg 都是 XML）；OOB XXE（盲态）；SAML 登录流。

## C3 HTTP 协议层（白盒扫不出，根因是"两套解析器"）

- **Host 头攻击**：服务端用 `Host` 拼绝对 URL（密码重置链接、邮件链接、跳转）→ 链接投毒。锚点：`getServerName()`、`request.get_host()`、`$_SERVER['HTTP_HOST']`、`req.headers.host` 进 URL 拼接。
- **Web 缓存投毒 / 缓存欺骗**：未进缓存键的输入影响响应；静态后缀让 CDN 缓存私有页面。
- **请求走私**：CL.TE / TE.CL / H2 降级 → 前置鉴权全线失效。
- **CRLF / 响应头注入**：参数进 `Location`/`Set-Cookie` 未过滤 `%0d%0a`。
- 详见 `modern-attack-surface` M3。

## C4 其他注入（常被"注入=SQLi"的思维定式漏掉）

| 类型 | Sink 锚点 | 后果 |
|---|---|---|
| LDAP 注入 | `search(filter + userInput)`、`InitialDirContext` | 认证绕过 / 全量账号 |
| XPath 注入 | `XPath.evaluate(拼接)`、`selectNodes` | 数据泄露 |
| XSLT 注入 | `Transformer.transform(用户 XSL)` | RCE / 文件读 |
| 邮件头注入 | 收件人/主题拼进邮件头未过滤换行 | 伪造发信、垃圾邮件中继 |
| CSV / 公式注入 | 导出的 CSV 字段以 `=` `+` `-` `@` 开头 | 客户端 Excel RCE |
| 正则 DoS (ReDoS) | 用户可控输入进灾难性回溯正则 | 服务不可用 |
| 表达式/模板注入 | 见 A3 与 `language-stack-audit` 的 references/frontend-ssti.md | RCE |

# D · 客户端类

## D1 XSS（反射/存储/DOM）

- **Sink**：`out.print(x)`、JSP `<%=x%>`、`response.getWriter().write(x)`、`innerHTML/document.write/eval`、模板未转义输出（`{{{ }}}`/`| safe`/`v-html`）。
- **判定**：输出是否按**上下文**编码（HTML body / 属性 / JS / URL / CSS 各不同）；框架自动转义是否被 `|raw`/`dangerouslySetInnerHTML` 绕过。
- **易漏**：JS 上下文用 HTML 编码无效（`'<%=x%>'`）；href/src 里的 `javascript:`；DOM XSS（source=location/document.URL，sink=eval/innerHTML）。

## D2 开放重定向

- **Sink**：`sendRedirect(x)`、Location 头、`window.open/location=x`、`res.redirect(x)`。
- **判定**：跳转目标是否白名单（仅站内/可信域）；`//evil.com`、`https:evil.com`、`\/\/`、`@` 绕过。

## D3 CSRF

- **看**：状态变更操作（POST/改密/删除/转账）是否有**一次性令牌** + Origin/Referer 校验；Cookie 是否 SameSite。
- **易漏**：只保护了部分接口；GET 型状态变更；JSON 接口误以为天然免疫（`text/plain`/`form-urlencoded` 可绕过）。

## D4 CORS 配置错误

- **判定**：`Access-Control-Allow-Origin` 是否**反射请求 Origin**、是否允许 `null`、是否通配子域/后缀匹配；配合 `Allow-Credentials: true` 即成立（任意站点读取用户数据）。
- 白盒锚点：`setHeader("Access-Control-Allow-Origin", request.getHeader("Origin"))`、Spring `@CrossOrigin(origins="*")`、Express `cors({origin:true})`、Django `CORS_ALLOW_ALL_ORIGINS`、Laravel `cors.php` 的 `allowed_origins: ['*']`。
- **易漏**：只测了主接口没测 API 子域；`*` 配 credentials 浏览器会拒（不算洞），**反射 Origin 配 credentials 才是真洞**——两者要分清。

## D5 WebSocket

- **CSWSH**：握手只靠 Cookie 且不校验 `Origin` → 跨站以受害者身份建连。
- 鉴权只在握手做、消息级不再校验 → 建连后越权。
- 消息体是完整注入面且绕过 HTTP WAF。
- 详见 `modern-attack-surface` M1。

## D6 原型链污染 / DOM Clobbering / postMessage / 点击劫持

- **原型链污染**：客户端与**服务端 Node** 都要查（`merge`/`Object.assign`/`__proto__`）；服务端污染可升级 RCE。
- **postMessage**：监听端不校验 `event.origin`；发送端 targetOrigin 用 `*` 泄露数据。
- **DOM Clobbering**：受限 HTML 注入下用 `id`/`name` 覆盖 JS 全局变量。
- **点击劫持**：状态变更页面缺 `X-Frame-Options` / `frame-ancestors`。

# E · 认证 / 会话 / 密码学

> **E 类整体是矩阵没有的列**，且是「账号接管」的主通道——完整清单见 `auth-authz-testing`。这里是最小 checklist，**不要停在这里**。

## E1 认证与会话

认证绕过（默认口令、空口令、逻辑短路、SQL 注入登录）；密码重置链（token 可预测/不失效/不绑定账号/Host 头投毒）；会话固定（登录不换 SID）；注销不失效；会话超时过长；Cookie 缺 HttpOnly/Secure/SameSite 或 Domain 设到父域；JWT（alg:none/HS-RS 混淆/kid 注入/jku 外链/弱密钥/不校验 exp-iss-aud）；OAuth（redirect_uri 校验、state 缺失、code 复用、PKCE）；SAML（XSW、注释截断、断言重放）；MFA/验证码（可复用、仅前端校验、可跳过）。

## E2 密码学

- 口令存储：明文/MD5/SHA1 无盐（应 BCrypt/Argon2/PBKDF2）；硬编码密钥；弱算法（DES/ECB/固定 IV）；自研加密；`Math.random`/`java.util.Random` 当安全随机。
- **签名不含服务端密钥 = 可离线伪造**——审计要问：这个签名/token 的密钥在哪？没有密钥的签名等于没签名。

# F · 配置 / 基线（易被跳过）

- 鉴权 Filter/拦截器**映射范围**、被注释的防护、独立 Servlet/裸奔路由盲区
- **框架主密钥泄露**（Django SECRET_KEY / Flask secret_key / Laravel APP_KEY / Rails secret_key_base / .NET MachineKey）→ **会话伪造直接接管**
- **调试模式开启**（DEBUG/APP_DEBUG/customErrors=Off/display_errors）→ 堆栈与配置泄露，Werkzeug 控制台可 RCE
- 传输层无 TLS / 弱 TLS；错误页泄露；目录列表；上传目录可解析脚本
- 安全响应头缺失（CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy）——**属加固建议，不计入漏洞数**
- 管理端点暴露（actuator 尤其 `/env` `/heapdump` `/jolokia`、console、swagger、druid、trace.axd、`/debug/pprof`、Django admin）
- 依赖组件 CVE + 供应链（依赖混淆、lockfile、CI 凭据）→ `modern-attack-surface` M7
- 云与容器配置（云凭据、桶 ACL、K8s secret、docker-compose 明文口令）→ M4 M5
- 残留与泄露：`.git`/`.svn`/`.env`/`.DS_Store`/备份包/`.map`/源码泄露

# G · 并发与资源

- **竞态 / TOCTOU**：任何「先检查后使用」（查余额→扣款、查库存→下单、判重复→插入、查权限→操作）中间无锁/无事务/无原子操作。详见 `unknown-vuln` 技术五。
- **缺少限速（API4）**：登录、短信、验证码、导出、重计算接口无限速 → 撞库、短信轰炸、成本型 DoS。
- **资源耗尽**：无分页上限（`pageSize=999999`）、无上传大小限制、无解压比限制、ReDoS、无查询超时。
- **幂等性缺失**：重复提交/重复回调 → 重复发货、重复入账。

# H · 矩阵外必查清单（交付时与矩阵并列）

不属于单个入口、因而矩阵盖不住的面，逐项给「已查·有/无」：

- [ ] 多租户隔离 — [ ] BFLA 裸奔方法清单（控制器全集 − 授权注解集）
- [ ] 密码重置链与账号接管路径 — [ ] JWT/OAuth/SAML 逐条（若使用）
- [ ] CORS — [ ] WebSocket — [ ] 原型链污染/postMessage/DOM Clobbering/点击劫持
- [ ] HTTP 协议层（Host 头/缓存投毒/缓存欺骗/走私/CRLF）
- [ ] 其他注入（LDAP/XPath/XSLT/邮件头/CSV 公式/ReDoS）
- [ ] Mass Assignment / HPP / 字段过度暴露
- [ ] 解压与解析器（Zip Slip/ImageMagick/ffmpeg/Office/PDF）
- [ ] JNDI 与日志注入（Java 目标必查） — [ ] 残留与源码泄露（.git/.env/.map/备份）
- [ ] 依赖 CVE 与供应链（依赖混淆/lockfile/CI 凭据）
- [ ] 配置基线（框架主密钥、调试模式、管理端点、安全响应头、TLS）
- [ ] 限速与资源耗尽 — [ ] 非 HTTP 服务与云面（M4/M6） — [ ] AI/LLM 面（若有）
- [ ] 每个技术栈都按 `language-stack-audit` 对应 references 文件扫过（多语言项目逐栈）

# I · 通向未知漏洞

模式扫不出的部分——逻辑漏洞、业务流程、竞态、状态机——见 `unknown-vuln` skill。白盒阶段先把「涉及金额/数量/状态/权限/签名/并发」的代码标出来。

## 收尾

每一类都有「已查·有/无」结论、覆盖矩阵无空格、**且 §H 矩阵外清单逐项有结论**，才算不放过任何一个已知类型。未知类型靠 `unknown-vuln` 兜底，定级与交付按 `audit-reporting`。覆盖矩阵与 §H 清单都写进 audit_workspace。
