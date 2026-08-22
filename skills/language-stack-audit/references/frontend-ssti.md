# 前端框架 与 模板引擎 SSTI 速查

---

# 一 · 前端框架（XSS 的现代形态）

框架默认转义，**漏洞几乎都出在显式绕过点**——直接 grep 这些即可：

| 框架 | 绕过点 |
|---|---|
| React | `dangerouslySetInnerHTML`、`href={userInput}`（`javascript:`）、`ref` 里操作 DOM |
| Vue | `v-html`、`:href` 绑定、动态组件 `<component :is>`、**模板编译用户字符串 = Vue SSTI** |
| Angular | `bypassSecurityTrustHtml/Script/Url/ResourceUrl`、`[innerHTML]`、模板注入（老版 sandbox 逃逸） |
| Svelte | `{@html ...}` |
| 通用 | `location = userInput`、`window.open`、`document.write`、`eval`、`new Function`、`postMessage` 处理、`JSON.parse(location.hash)` |

```bash
grep -rniE 'dangerouslySetInnerHTML|v-html|\{@html|bypassSecurityTrust|\[innerHTML\]' .
grep -rniE 'location\s*=|location\.href\s*=|window\.open\(|document\.write\(' . | grep -iE 'hash|search|params|query'
```

配套必查（见 `modern-attack-surface` M2）：

- `.js.map` 泄露、bundle 里的硬编码密钥与内部接口清单
- 前端拿到的完整菜单/权限 JSON = **现成的管理端点字典**
- token 存 `localStorage`（XSS 即接管，属设计缺陷）
- 原型链污染、DOM Clobbering、postMessage 无 origin 校验

---

# 二 · 模板引擎 SSTI 速查（跨语言）

先用探针定引擎，再上对应利用链：

| 引擎 | 语言 | 探针 | 升级方向 |
|---|---|---|---|
| Jinja2 | Python | `{{7*7}}`→49 | `{{config}}`、`__subclasses__` → RCE |
| Twig | PHP | `{{7*7}}` | `_self.env.registerUndefinedFilterCallback` → RCE |
| Smarty | PHP | `{7*7}` | `{php}` / `Smarty_Internal_Write_File` |
| Freemarker | Java | `${7*7}` | `Execute` / `ObjectConstructor` → RCE |
| Velocity | Java | `#set($x=7*7)$x` | `ClassTool` / 反射 → RCE |
| Thymeleaf | Java | `__${7*7}__::.x` | SpEL → RCE |
| ERB | Ruby | `<%= 7*7 %>` | 直接 Ruby 代码 |
| EJS / Pug / Handlebars | Node | `#{7*7}` / `{{7*7}}` | `process.mainModule.require('child_process')` |
| Razor | .NET | `@(7*7)` | 动态编译 |
| Go template | Go | `{{.}}` | 主要是信息泄露（结构体字段），**RCE 面小，别照搬其他语言的判定** |

**判定纪律**：返回 `49` 只证明「表达式被求值」。**升级到 RCE 前先看红线**——生产环境到「求值成立」即可定级为 Critical，不必打穿。
