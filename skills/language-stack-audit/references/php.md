# PHP 审计要点

## 语言级陷阱（PHP 独有，最易漏）

| 陷阱 | 表现 | 后果 |
|---|---|---|
| **弱类型比较** | `==` 下 `"0e123" == "0e456"`（科学计数法都等于 0）、`"1abc" == 1`、`null == 0` | 口令/token/签名比对绕过。**审计要求：安全比对必须 `===` 或 `hash_equals()`** |
| `in_array($x, $arr)` 默认松散 | `in_array("1abc", [1,2,3])` 为真 | 白名单绕过 |
| **变量覆盖** | `extract()`、`$$var`、`parse_str()`、老代码 `register_globals` 习惯 | 覆盖已初始化的鉴权变量 |
| `$_REQUEST` | GET/POST/COOKIE 混取，顺序由 `request_order` 决定 | Cookie 覆盖 POST，绕 WAF |
| **伪协议** | `php://filter/convert.base64-encode/resource=` 读源码；`php://input`；`data://`；`phar://` | LFI 升级为源码泄露 / RCE |
| **phar 反序列化** | 任何文件操作函数（`file_exists` `is_file` `filesize` `unlink` `md5_file`…）传入 `phar://` 触发反序列化 | **无 `unserialize()` 也能反序列化 RCE** |
| 字符串截断 | `%00`（老版本）、超长路径截断 | 扩展名绕过 |
| `preg_replace` `/e` | 老代码（PHP<7） | RCE |
| 类型戏法 | `strcmp(数组, 字符串)` 返回 null == 0 | 比对绕过 |

## Sink 锚点

```bash
# RCE
grep -rniE '\b(system|exec|shell_exec|passthru|popen|proc_open|pcntl_exec|assert|eval|create_function|preg_replace\s*\(.*/e)\s*\(' .
grep -rn '`' . --include="*.php"                       # 反引号执行

# 文件包含（PHP 独有的高危类）
grep -rniE '\b(include|include_once|require|require_once)\s*\(?\s*\$' .

# 反序列化 + phar
grep -rniE 'unserialize\s*\(|__wakeup|__destruct|__toString|__invoke|__call\b' .
grep -rniE '\b(file_exists|is_file|is_dir|filesize|filemtime|unlink|md5_file|copy|fopen)\s*\(\s*\$' .   # phar:// 触发点

# SQL
grep -rniE 'mysqli_query|->query\(|->exec\(|mysql_query|pg_query' . | grep -E '\$|\.'

# 文件读写
grep -rniE '\b(readfile|file_get_contents|file_put_contents|fopen|move_uploaded_file|unlink|scandir)\s*\(\s*\$' .

# SSRF
grep -rniE 'curl_setopt|curl_exec|fsockopen|get_headers|file_get_contents\s*\(\s*\$.*http' .

# XXE
grep -rniE 'simplexml_load_(string|file)|DOMDocument|XMLReader|libxml_disable_entity_loader' .

# 变量覆盖 / 弱比较
grep -rniE '\bextract\s*\(|\bparse_str\s*\(|\$\$[a-z_]' .
grep -rnE 'if\s*\(\s*\$[a-z_]+\s*==\s*\$' . --include="*.php"     # 逐个看是否为安全比对
```

## 框架特有

- **Laravel**：`->fill($request->all())` / `$guarded = []` → Mass Assignment；`DB::raw()` 拼接；`APP_DEBUG=true` 泄露（`.env` 泄露 → `APP_KEY` → **反序列化 RCE**）；`Route::any`；`storage/logs/laravel.log` 可读。
- **ThinkPHP / 国产框架**：历史 RCE（`invokefunction`、`_method` 变量覆盖）是高频；先按版本查已知洞。
- **WordPress / 通用 CMS**：插件/主题目录是主战场；`admin-ajax.php` 的 `nopriv` 动作（未认证可调）。
- **Symfony**：`_fragment` 端点、`secret` 泄露。

## 密钥泄露即接管

`.env` 里的 `APP_KEY`（Laravel）泄露 → 会话/加密 cookie 伪造 → 反序列化 RCE。这是 PHP 栈最高价值的单点。
