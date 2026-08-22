# Python 审计要点

## 语言级陷阱

| 陷阱 | 说明 |
|---|---|
| `pickle.loads` / `yaml.load`（非 `safe_load`）/ `marshal` | 反序列化即 RCE，无需 gadget 链 |
| `eval` / `exec` / `compile` | 直接 RCE；`input()` 在 py2 等于 eval |
| **`os.path.join` 吞并绝对路径** | `join("/base", "/etc/passwd")` → `/etc/passwd`。前缀拼接的穿越防护在此失效 |
| **格式化字符串注入** | 用户控制 `"{}".format` 的**模板串**或 f-string 模板 → `{0.__class__.__init__.__globals__}` 读到全局对象与密钥 |
| `assert` 做安全校验 | `python -O` 会整体去掉 assert → 校验消失 |
| `tarfile.extractall` / `zipfile` | **Zip Slip / Tar Slip** 路径穿越写文件 |
| `subprocess(..., shell=True)` | 命令注入；`shell=False` 但拼 `-o`/`--config` 型参数仍是**参数注入** |
| `requests(..., verify=False)` | 中间人 |
| 可变默认参数 / 全局状态 | 并发下跨请求数据串号（**信息泄露**） |
| `random` 非密码学安全 | token 可预测（应 `secrets`） |
| `xml.etree` / `lxml` 默认 | XXE（`lxml` 需显式 `resolve_entities=False`） |

## Sink 锚点

```bash
grep -rniE '\b(eval|exec|compile)\s*\(|pickle\.(loads|load)|yaml\.load\s*\(|marshal\.loads|dill\.loads' .
grep -rniE 'subprocess\.(run|call|Popen|check_output)|os\.(system|popen|spawn)' . | grep -iE 'shell\s*=\s*True|\+|%|f"|format'
grep -rniE 'os\.path\.join\s*\(' . | grep -iE 'request|args|form|json|param'
grep -rniE '\.format\s*\(|f["\x27]' . | grep -iE 'request|user|input'
grep -rniE 'extractall\s*\(|tarfile\.open|zipfile\.ZipFile' .
grep -rniE '\.execute\s*\(\s*["\x27].*%|\.execute\s*\(\s*f["\x27]|\.raw\s*\(|\.extra\s*\(' .
grep -rniE 'render_template_string|Template\s*\(|jinja2\.|\|safe|Markup\(' .
```

## 框架特有

- **Django**：`.extra()` / `.raw()` / `RawSQL` 拼接；`|safe` 与 `mark_safe`；`DEBUG=True`（泄露 settings 与 SECRET_KEY）；**`SECRET_KEY` 泄露 → session 伪造 → 接管**；`ALLOWED_HOSTS=['*']` → Host 头攻击；`@csrf_exempt`；ORM 的 `filter(**request.GET)` → 字段注入/越权；默认无对象级权限（**每个 view 自己判归属，必逐个查**）。
- **Flask**：`render_template_string(user_input)` → **SSTI 直通 RCE**；`app.secret_key` 弱/硬编码 → session cookie 可伪造（`flask-unsign`）；`debug=True` 的 Werkzeug 控制台（PIN 可推算）→ RCE。
- **FastAPI / Pydantic**：`response_model` 缺失导致**返回整个 ORM 对象**（泄露 hash/token 字段）；依赖注入里的鉴权是否覆盖全部路由。

## Jinja2 SSTI 升级链

`{{7*7}}` → `{{config}}` → `{{''.__class__.__mro__[1].__subclasses__()}}` → RCE。

## 密钥泄露即接管

Django `SECRET_KEY` / Flask `app.secret_key` 泄露 → 会话伪造 → 直接接管。`DEBUG=True` 是最常见的泄露路径。
