# Go 审计要点

Go 的坑与动态语言完全不同——没有 eval、没有弱类型，重心在**模板引擎选错**、**默认行为**和**并发**。

## 语言级陷阱

| 陷阱 | 说明 |
|---|---|
| **`text/template` vs `html/template`** | 用 `text/template` 渲染 HTML = **无自动转义 = XSS**。这是 Go 最高频的 XSS 根因 |
| `html/template` 的 `template.HTML(userInput)` | 显式绕过转义 |
| **SSRF 默认跟随重定向** | `http.Get` 默认最多 10 次重定向 → 内网黑名单被重定向绕过；需自定义 `CheckRedirect` |
| 整数溢出/转换 | `int32`/`uint` 转换截断 → 长度/金额校验绕过；`len()` 与 `strconv.Atoi` 未查错 |
| `filepath.Join` | 需 `filepath.Clean` + 前缀校验；Windows 下分隔符差异 |
| **goroutine 竞态** | 共享 map/结构体无锁；`go test -race` 是现成的审计工具 |
| `defer` 在循环里 | 资源耗尽 |
| 错误被忽略 | `_ = err` 吞掉校验失败仍继续执行 |
| `math/rand` | 非密码学安全（应 `crypto/rand`） |
| `encoding/gob`、`gopkg.in/yaml` | 反序列化面 |
| 结构体标签 | `json:"-"` 缺失 → 敏感字段随 API 返回；反向：无字段白名单 → Mass Assignment |

## Sink 锚点

```bash
grep -rn '"text/template"' . && echo "!! text/template 渲染 HTML = XSS 风险"
grep -rniE 'template\.HTML\(|template\.JS\(|template\.URL\(' .
grep -rniE 'exec\.Command\(' . | grep -iE '"sh"|"bash"|"cmd"|-c'
grep -rniE 'db\.(Query|Exec|Raw)\(|fmt\.Sprintf\(.*(SELECT|INSERT|UPDATE|DELETE)' .
grep -rniE 'http\.(Get|Post|NewRequest)\(' . | grep -iE 'r\.URL|c\.Query|c\.Param|req\.'
grep -rniE 'os\.(Open|ReadFile|Create|Remove)\(|filepath\.Join\(' . | grep -iE 'Query|Param|Form'
grep -rniE 'math/rand|CheckRedirect|InsecureSkipVerify' .
go test -race ./...        # 竞态直接扫出来
```

## 框架特有

- **Gin / Echo / Fiber**：`c.ShouldBind` 无字段白名单 → Mass Assignment；路由通配 `*path` → 穿越；中间件分组是否覆盖全部路由。
- **GORM**：`Where(fmt.Sprintf(...))`、`Raw()`、`Select(userInput)`（**列名注入**）、`Updates(map)` → Mass Assignment。
- `net/http` 自带 `ServeMux` 的路径清洗与反代差异 → 鉴权绕过。
- `/debug/pprof` 默认挂载时会暴露运行时信息，属管理端点暴露。

## 模板注入

Go template 的 SSTI 面比其他语言小——探针 `{{.}}`，主要后果是**结构体字段信息泄露**而非 RCE。别照搬 Jinja2 的判定标准。
