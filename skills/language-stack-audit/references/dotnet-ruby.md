# .NET / C# 与 Ruby / Rails 审计要点

---

# 一 · .NET / C#

| 面 | 锚点 |
|---|---|
| **反序列化** | `BinaryFormatter` `LosFormatter` `ObjectStateFormatter` `NetDataContractSerializer` `SoapFormatter` `JavaScriptSerializer(SimpleTypeResolver)` `Json.NET TypeNameHandling != None` `XmlSerializer(动态类型)` |
| **ViewState** | `MachineKey` 泄露/弱/固定 → ViewState 伪造 → **RCE**；`enableViewStateMac=false`（老版） |
| 命令执行 | `Process.Start` + `/c` |
| SQL | 字符串拼接 + `SqlCommand`；EF `FromSqlRaw` / `ExecuteSqlRaw` 拼接 |
| 路径 | `Server.MapPath`、`Path.Combine`（**同样吞并绝对路径**）、`File.*` |
| XXE | `XmlDocument` / `XmlTextReader` 老版本默认解析 DTD；`XmlResolver` 未置 null |
| 模板/表达式 | Razor 动态编译、`DataBinder.Eval` |
| 反射 | `Type.GetType(userInput)` / `Activator.CreateInstance` |
| **Mass Assignment** | MVC Model Binding 无 `[Bind(Include=...)]` / 无 DTO |
| 配置 | `customErrors=Off`（堆栈泄露）、`debug=true`、`web.config` 泄露、`elmah.axd` / `trace.axd` 暴露 |
| 路径解析 | IIS 短文件名（`~1`）枚举、`.aspx` 的分号/冒号解析差异 |

```bash
grep -rniE 'BinaryFormatter|LosFormatter|ObjectStateFormatter|TypeNameHandling|JavaScriptSerializer|NetDataContractSerializer' .
grep -rniE 'FromSqlRaw|ExecuteSqlRaw|new SqlCommand\(.*\+|Process\.Start|Server\.MapPath|Type\.GetType\(' .
```

**密钥泄露即接管**：`MachineKey` 泄露 → ViewState / Forms 认证票据伪造 → RCE + 接管。

取源：`ilspycmd app.dll -o ./src` 或 dnSpy。

---

# 二 · Ruby / Rails

| 陷阱 | 说明 |
|---|---|
| **`YAML.load` / `Marshal.load`** | 反序列化 RCE（`YAML.safe_load` 才安全） |
| **`send` / `public_send` / `constantize` / `const_get`** | 参数控制方法名 → 任意方法调用 |
| **Mass Assignment** | `params.permit!`、`update(params[:user])` 无 strong parameters |
| ERB 注入 | `ERB.new(user_input).result` → RCE |
| 命令执行 | `eval` / 反引号 / `system` / `%x[]`；**`Kernel#open` 传 `\|` 开头即执行命令**，`URI.open` 同理 → SSRF 升级 RCE |
| ActiveRecord | `where("name = '#{p}'")` 拼接、`order(params[:sort])`（**标识符注入**）、`find_by_sql` |
| `render` | `render params[:template]` / `render inline:` → 文件读 / RCE |
| Rails 配置 | `secret_key_base` 泄露 → cookie 会话伪造；`config.consider_all_requests_local` |

```bash
grep -rniE 'YAML\.load\b|Marshal\.load|\.constantize|const_get|\bsend\s*\(|public_send' .
grep -rniE 'params\.permit!|update_attributes\(params|\.update\(params' .
grep -rniE 'eval\(|system\(|%x\[|`|Kernel\.open|URI\.open|IO\.popen' . --include="*.rb"
grep -rniE 'where\s*\(\s*"[^"]*#\{|order\s*\(\s*params|find_by_sql' .
```

路由清单：`config/routes.rb`；线上残留 `/rails/info/routes`。

工具：`brakeman` 做广度扫描。

**密钥泄露即接管**：`secret_key_base` 泄露 → 会话 cookie 伪造 → 直接接管。
