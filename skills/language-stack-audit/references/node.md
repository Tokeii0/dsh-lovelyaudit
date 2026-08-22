# Node.js / TypeScript 审计要点

## 语言级陷阱

| 陷阱 | 说明 |
|---|---|
| **原型链污染** | `lodash.merge` / `Object.assign(target, userJson)` / 深合并 / `qs` 解析 `?__proto__[x]=y` → 污染全局行为，可升级 RCE |
| **NoSQL 注入** | `{ "user": {"$ne": null} }`、`$where`、`$regex`——**JSON 体天然可传对象**，类型没校验就中招 |
| 类型混淆 | `req.query.id` 可能是 string 也可能是 **array**（`?id=1&id=2`）或 object（`?id[a]=1`），`.replace()` 之类直接抛错或绕过校验 |
| `child_process.exec` | 走 shell = 命令注入；`execFile`/`spawn` 相对安全但仍有参数注入 |
| `vm` / `vm2` 沙箱 | 逃逸历史众多，**不能当安全边界** |
| `eval` / `new Function` / `setTimeout("字符串")` | RCE |
| `path.join` / `path.resolve` | 与 Python 同：绝对路径吞并、`..` 需 `path.normalize` 后前缀校验 |
| 异步竞态 | `await` 之间的检查-使用间隙；单进程也有竞态 |
| `JSON.parse` 后直接入库/入模板 | 二次污点 |
| 依赖 `postinstall` 脚本 | 供应链 RCE |

## Sink 锚点

```bash
grep -rniE '\beval\s*\(|new Function\s*\(|child_process|\.exec\s*\(|execSync|spawnSync' . --include="*.js" --include="*.ts"
grep -rniE 'require\s*\(\s*[^\x27"]|import\s*\(' . | grep -iE 'req\.|param|query|body'   # 动态 require
grep -rniE 'merge\s*\(|deepExtend|Object\.assign\s*\(|__proto__|constructor\.prototype' .
grep -rniE '\$where|\$ne|\$gt|\$regex|find\s*\(\s*req\.(body|query)' .
grep -rniE 'innerHTML|outerHTML|document\.write|dangerouslySetInnerHTML|v-html|bypassSecurityTrust' .
grep -rniE 'res\.redirect\s*\(\s*req\.|res\.sendFile\s*\(|fs\.(readFile|writeFile|unlink)\s*\(' .
grep -rniE 'jwt\.(sign|verify|decode)\s*\(' .          # decode 不验签
```

## 框架特有

- **Express**：中间件**顺序**决定鉴权是否覆盖（鉴权中间件注册在路由之后 = 形同虚设）；`app.use(express.static)` 暴露目录；`req.params` 通配路由；缺 `helmet`。
- **NestJS**：Guard 是否挂全局；`@Public()` 白名单误用；`ValidationPipe` 未开 `whitelist:true` → **Mass Assignment**；`forbidNonWhitelisted` 缺失。
- **Next.js / Nuxt（SSR）**：服务端组件里泄露密钥到客户端 bundle；API route 无鉴权；`getServerSideProps` 里的 SSRF；中间件路径匹配绕过。
- **Sequelize / TypeORM / Prisma**：`literal()` / `$queryRaw` 拼接；`findOne({where: req.body})` → 条件注入。
- **模板**：`ejs` / `pug` / `handlebars` 传用户数据当模板 → SSTI RCE（`process.mainModule.require('child_process')`）。

## 服务端原型链污染

不只是客户端问题。Node 后端用 `lodash.merge` 处理用户 JSON → 污染 `Object.prototype` → 影响后续所有对象的属性查找，可绕鉴权判断、注入模板选项，甚至升级为 RCE。**是 Node 栈最值得单独查的一类。**
