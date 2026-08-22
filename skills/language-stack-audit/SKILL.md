---
name: language-stack-audit
description: 跨语言/框架审计要点索引：PHP、Python、Node/TypeScript、Go、Java/Kotlin、.NET/C#、Ruby/Rails、Rust、C/C++、前端框架、模板引擎 SSTI 各自专属的 Source/Sink 锚点、语言级陷阱（弱类型、变量覆盖、原型链、模板引擎误用、内存安全）与框架特有漏洞。确定目标技术栈后、做 P4 白盒逐类扫描前使用；细节按栈从 references/ 按需读取。
---

# 各语言 / 框架专属审计要点

**通用污点模型（Source→Sink→Sanitizer）跨语言通用，但「危险函数名」「语言级陷阱」「框架默认行为」各不相同。用错语言的 grep 模式 = 系统性漏报。**

本篇是**索引页**。逐语言的细节在 `references/` 下，**只读你这次真正用得上的那一两个**——按上面 `<skill_resources>` 给出的基准目录解析相对路径。

## 1 先定栈

```bash
ls package.json composer.json requirements.txt pyproject.toml go.mod pom.xml build.gradle \
   Gemfile *.csproj *.sln Cargo.toml CMakeLists.txt Makefile 2>/dev/null
find . -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -20
```

黑盒指纹对照：

| 线索 | 栈 |
|---|---|
| Cookie `PHPSESSID`、`.php` 后缀 | PHP |
| Cookie `sessionid` + `csrftoken` | Django |
| Cookie `session` + Werkzeug 报错页 | Flask |
| Cookie `connect.sid`、`X-Powered-By: Express` | Node |
| Cookie `_<app>_session`、`/rails/info/routes` | Rails |
| Cookie `ASP.NET_SessionId`、`.aspx`、`__VIEWSTATE` | .NET |
| Cookie `JSESSIONID`、`.do` `.action` `.jsp` | Java |
| 无框架特征 + 响应极快 + `X-Powered-By` 缺失 | Go 常见 |

## 2 按栈读细节

| 目标栈 | 读这个文件 |
|---|---|
| PHP（含 Laravel / ThinkPHP / WordPress） | `references/php.md` |
| Python（含 Django / Flask / FastAPI） | `references/python.md` |
| Node / TypeScript（含 Express / NestJS / Next） | `references/node.md` |
| Go（含 Gin / Echo / GORM） | `references/go.md` |
| Java / Kotlin（含 Spring / Android） | `references/java-kotlin.md` |
| .NET/C# 或 Ruby/Rails | `references/dotnet-ruby.md` |
| Rust 或 C/C++（native、二进制、IoT） | `references/native-rust-c.md` |
| 前端框架（React/Vue/Angular/Svelte）与**模板引擎 SSTI 探针表** | `references/frontend-ssti.md` |

**多语言项目逐栈都要读。** 现实项目常是「主站 Java + 老模块 PHP + 前端 TS + 某服务 Go + native 加密库 C」——只用一套语言的模式扫，等于只审了一部分。

## 3 跨栈同构的高价值面（不分语言，先查这四条）

这四类在每个栈都成立，且回报最高：

### ① 框架主密钥泄露 = 直接接管

| 栈 | 密钥 | 泄露后果 |
|---|---|---|
| Django | `SECRET_KEY` | session 伪造 |
| Flask | `app.secret_key` | session cookie 伪造（`flask-unsign`） |
| Laravel | `APP_KEY`（在 `.env`） | 加密 cookie 伪造 → 反序列化 RCE |
| Rails | `secret_key_base` | 会话 cookie 伪造 |
| .NET | `MachineKey` | ViewState 伪造 → RCE |
| Java/Spring | 各类 secret、`/actuator/heapdump` | 会话与口令直接落地 |

泄露路径高度同构：**调试模式开启、配置文件 Web 可读、`.git` 历史、堆转储、前端 bundle**。

### ② Mass Assignment（字段白名单缺失）

请求体直绑实体 → 多传 `role` / `isAdmin` / `status` / `balance` / `tenantId`。

| 栈 | 锚点 |
|---|---|
| Spring | `@RequestBody Entity`（缺 DTO / `@JsonIgnore`） |
| Laravel | `->fill($request->all())`、`$guarded = []` |
| Rails | `params.permit!`、`update(params[:user])` |
| Django | `ModelForm` 无 `fields` 白名单、`filter(**request.GET)` |
| Node/NestJS | `ValidationPipe` 未开 `whitelist:true` |
| Go | `c.ShouldBind`、GORM `Updates(map)` |
| .NET | Model Binding 无 `[Bind(Include=...)]` |

### ③ 调试模式与管理端点

`DEBUG=True`(Django) / `debug=true`(Flask、Spring) / `APP_DEBUG`(Laravel) / `customErrors=Off`(.NET) / `display_errors`(PHP) / `consider_all_requests_local`(Rails)。

配套端点：`/actuator/*`、`/debug/pprof`(Go)、`elmah.axd`·`trace.axd`(.NET)、Django admin、`/druid`、`/swagger-ui`、Werkzeug 控制台（**可直接 RCE**）。

### ④ 连接串 / 数据源可控 = RCE 候选

凡是「用户可填数据库或服务连接串」的功能（数据源管理、数据同步、报表配置），各栈都能指向攻击者服务器触发客户端解析漏洞：JDBC `autoDeserialize` / H2 `INIT=RUNSCRIPT`、Python `sqlalchemy` URL、Node 连接串、PHP PDO DSN。

## 4 收尾自查

- [ ] 目标每个技术栈（含遗留模块、前端、native 组件）都读了对应的 `references/` 并配了锚点
- [ ] 语言级陷阱逐条有结论——不只是通用 Sink（PHP 弱比较 / Python `os.path.join` / Go `text/template` / Node 原型链 / Ruby `send` / .NET ViewState / Rust `unsafe`）
- [ ] 框架默认行为（Mass Assignment、自动转义、中间件顺序、调试模式）逐个确认
- [ ] §3 四条跨栈同构面全部查过——**尤其框架主密钥，它是「一个洞直接接管」的最短路径**
