---
name: blackbox-testing
description: 黑盒测试完整流程：指纹、攻击面枚举、可达性与鉴权边界测绘、认证/注入/盲态探测。看不见代码或做 P3 黑盒摸底时使用。
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
| 反序列化 | 已知 magic（`rO0`/`AAEAAAD`/`O:`）+ gadget 探针 | 带外 |

**带外（OOB）是黑盒盲态的命门**：备一个 DNSLog/Collaborator，SSRF/XXE/盲注/命令注入没有回显时，全靠带外确认。

## B6 盲态与逻辑测试

看不见回显时，靠**副作用可观测量**：时延（sleep/重计算）、状态码差异、响应长度差异、报错指纹、带外请求。

业务逻辑黑盒也能测很多（详见 `unknown-vuln` skill）：改价、改数量为负、并发下单、跳步骤、重放、越权改状态。

## 黑盒产出清单（交给 P5 互证）

1. **可达面地图**：每类入口的未授权响应 + 哪些绕过成功。
2. **鉴权边界行为表**（拦 / 落应用 / 盲区三种待遇）。
3. **信任头/白名单绕过结论**。
4. **确认可达的高危端点**（含产品级已知点）。
5. **注入/输入类探针的差分结果**。

每条探针结果写入 audit_workspace 的可达面/发现（record_surface / add_finding），不要只留在终端输出。
