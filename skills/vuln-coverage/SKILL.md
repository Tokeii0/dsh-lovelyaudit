---
name: vuln-coverage
description: 已知漏洞类型全覆盖清单与入口×类型矩阵。白盒逐类扫描或 P7 收口自查时使用。
---

# 漏洞类型全覆盖清单

「不放过任何一个」的白盒兜底：**每一类漏洞逐条过一遍**，用固定的 Source/Sink/模式扫全库。当 checklist——每类都要有明确的「已查·有/无」结论。

覆盖矩阵模板（收尾自查用）：每个入口（行）× 每类漏洞（列）打勾，**不允许空格**：

| 入口\类型 | RCE | SQLi | 文件 | SSRF | XXE | XSS | 越权 | 重定向 | 密码学 | 逻辑 |
|---|---|---|---|---|---|---|---|---|---|---|
| Controller/路由 A | | | | | | | | | | |

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

- **看**：每个「按 id 取数据/改数据」的入口，是否校验**该资源归属当前用户**。
- **判定**：`where id=?` 但没有 `and owner=当前用户`；权限判定用**客户端传入**的 role/orgId 而非会话值。
- 高危变体：某参数可切换会话身份——认证/授权逻辑把「请求参数」当「身份来源」，属逻辑越权（见 unknown-vuln）。

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
- **易漏**：入口在第三方回调/文件上传解析里；OOB XXE（盲态）。

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
- **易漏**：只保护了部分接口；GET 型状态变更；JSON 接口误以为天然免疫（text/plain 可绕过）。

# E · 认证 / 会话 / 密码学

## E1 认证与会话

认证绕过（默认口令、空口令、逻辑短路）；会话固定（登录不换 SID）；会话超时过长；Cookie 缺 HttpOnly/Secure/SameSite；JWT alg:none/弱密钥/不校验。

## E2 密码学

- 口令存储：明文/MD5/SHA1 无盐（应 BCrypt/Argon2/PBKDF2）；硬编码密钥；弱算法（DES/ECB/固定 IV）；自研加密；`Math.random`/`java.util.Random` 当安全随机。
- **签名不含服务端密钥 = 可离线伪造**——审计要问：这个签名/token 的密钥在哪？没有密钥的签名等于没签名。

# F · 配置 / 基线（易被跳过）

- 鉴权 Filter/拦截器**映射范围**、被注释的防护、独立 Servlet 盲区
- 传输层无 TLS；错误页泄露；目录列表；上传目录可解析脚本
- 依赖组件 CVE；管理端点暴露（actuator/console/swagger/druid）

# G · 通向未知漏洞

模式扫不出的部分——逻辑漏洞、业务流程、竞态、状态机——见 `unknown-vuln` skill。白盒阶段先把「涉及金额/数量/状态/权限/签名/并发」的代码标出来。

## 收尾

每一类都有「已查·有/无」结论，且覆盖矩阵无空格，才算不放过任何一个已知类型。未知类型靠 unknown-vuln 兜底。覆盖矩阵写进 audit_workspace。
