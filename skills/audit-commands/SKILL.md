---
name: audit-commands
description: 审计工具与命令速查：反编译取源、指纹、路由提取、边界探测、逐类型 grep 模式库、注入探针、fuzz/并发、依赖 CVE 扫描。需要具体命令时使用。
---

# 工具与命令速查

可复制粘贴的命令库，按审计阶段组织。目标占位符统一 `TARGET`；示例默认 Java/JSP，附其他栈等价。

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

# 其他栈路由
grep -rn "Route::\|app.get(\|@app.route\|router\." .
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

## 7 未知漏洞：Fuzz / 并发 / 差分

```bash
# 参数 fuzz（畸形值）
ffuf -u "http://TARGET/api?p=FUZZ" -w payloads.txt -mc all -fr "正常特征"
# 隐藏参数挖掘
arjun -u "http://TARGET/api"

# 并发竞态（突破"限一次"）
seq 30 | xargs -P30 -I{} curl -s -b "SESSION=x" -X POST "http://TARGET/claim"

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

## 附：非破坏红线（生产环境）

- ✅ 只读探测、响应差分、时延判定、字节码分析、读无害文件。
- ⚠️ 控制强度：盲注 sleep 时长要小、避免大量并发、不 --dump / 不 --os-shell。
- ❌ 禁：写/删数据、真传 WebShell、爆破口令、DoS、越红线利用需要密钥的写通道。
- 原则：**能用差分/时延/带外证明的，就不落地真实利用。** 用户 P0 红线优先。
