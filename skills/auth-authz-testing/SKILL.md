---
name: auth-authz-testing
description: 认证/授权/会话专项：身份来源审计、多角色×端点矩阵、认证绕过与密码重置链、会话安全、JWT/OAuth2-OIDC/SAML 令牌攻击、多租户隔离与 BFLA 函数级越权。测越权/IDOR/登录/SSO/token/租户隔离，或覆盖矩阵要给「认证」结论时使用。
---

# 认证与授权专项

**为什么单列一章**：威胁模型里两大最坏后果——「账号接管」和「全量数据泄露」——主通道都在这里。而覆盖矩阵只有「越权」一列，极易被一格带过。本 skill 把这一列拆成**可穷举的清单**。

核心命题一句话：**身份必须来自服务端不可伪造的凭据；授权必须在服务端对「这个身份 × 这个资源 × 这个动作」逐次判定。** 任何偏离都是洞。

## Z1 身份来源审计（第一件事）

对每个受保护端点，回答：**服务端凭什么认为你是你？**

| 身份来源 | 可信度 | 结论 |
|---|---|---|
| 服务端会话（session 中的 userId） | ✅ 可信 | 正确做法 |
| 服务端校验过签名的 token（密钥在服务端） | ✅ 可信 | 看签名校验是否真做 |
| 请求参数 `uid/userId/role/orgId/tenantId` | ❌ 客户端可控 | **必是越权** |
| 请求头 `X-User-Id / X-Role / X-Tenant` | ❌ 客户端可伪造（除非有前置网关剥离） | 高危：网关不剥离=直接伪造 |
| Cookie 中的明文身份（`user=admin`） | ❌ 可改 | 认证绕过 |
| `Referer / Origin / User-Agent` | ❌ 可伪造 | 不能做安全决策 |
| `getRemoteAddr` / XFF | ⚠️ XFF 可伪造，RemoteAddr 在反代后是代理 IP | 见 blackbox-testing 信任头 |

白盒 grep 锚点：

```bash
# 身份从请求里取 = 高度可疑
grep -rniE 'getParameter\("(uid|userid|user_id|role|isadmin|admin|orgid|deptid|tenantid|companyid|shopid)"' $SRC
grep -rniE 'getHeader\("(x-user|x-uid|x-role|x-tenant|x-org|x-admin)' $SRC
# 身份从会话里取 = 正确基线，用来对照哪些端点没走这条路
grep -rnE 'getSession\(\)\.getAttribute\(' $SRC
```

**判读**：同一个项目里如果 90% 端点用 session 取身份、10% 用 getParameter 取，那 10% 就是攻击面——**对照差异比孤立看代码高效得多**。

## Z2 角色矩阵测试法（越权测试的系统做法）

不要零散地"试试改 id"。建 **N 角色 × M 端点 × {读, 写} 矩阵**，逐格填。

角色至少覆盖（有几个建几个）：

```
R0 未认证游客
R1 普通用户 A
R2 普通用户 B（与 A 同级，用于水平越权/同租户）
R3 管理员 / 高权角色（用于垂直越权对照：先用 R3 抓到管理端点，再用 R1 打）
R4 另一租户的用户（多租户产品必测）
R5 已注销 / 已禁用 / 已离职账号（会话与权限是否随之失效）
```

矩阵每格三种结论：`允许(预期) / 允许(越权!) / 拒绝`。

标准差分动作：

```bash
# 水平越权：A 的会话去拿 B 的资源
curl -s -b "$SESS_A" "http://TARGET/api/order?id=$ID_OF_B" -o a.txt -w "%{http_code} %{size_download}\n"
curl -s -b "$SESS_B" "http://TARGET/api/order?id=$ID_OF_B" -o b.txt -w "%{http_code} %{size_download}\n"
diff a.txt b.txt && echo "IDOR: A 拿到了 B 的数据"

# 垂直越权：先用管理员抓出管理端点，再逐个用普通用户 / 未认证打
for u in $(cat admin_endpoints.txt); do
  printf "%-40s " "$u"
  curl -s -o /dev/null -w "R0=%{http_code} " "http://TARGET$u"
  curl -s -o /dev/null -w "R1=%{http_code}\n" -b "$SESS_A" "http://TARGET$u"
done
```

**关键纪律：**

1. **读和写要分开测。** 常见模式：列表/详情有鉴权，**导出 / 打印 / 报表 / 附件下载 / 批量接口没有**。
2. **改 id 不通不等于安全**——试 id 的其他表示：加密 id（密文可枚举/可重放）、UUID（可能从别处泄露）、复合参数（`id` 挡了，`ids[]`/`orderNo`/`bizKey` 没挡）。
3. **越权点常在"第二个参数"**：主参数校验了归属，附带的 `deptId`/`fileId`/`attachId` 没校验。
4. **状态变更类优先**：改密、改绑手机/邮箱、改角色、删除、审批、退款——这些一旦越权就是接管。

## Z3 认证绕过与账号接管链

| 面 | 测什么 |
|---|---|
| 登录本身 | 默认口令（admin/admin、产品出厂口令）、空口令、SQL 注入登录绕过、大小写/前后空格绕过、超长口令截断 |
| 逻辑短路 | 代码里 `if (user != null)` 少了密码比对；`return true` 的调试分支；万能口令/后门参数 |
| 二次认证 | 短信/OTP 只在前端校验、验证码可复用/不失效/可空、验证码返回在响应里、错误次数不限、换端点跳过 MFA |
| **密码重置链**（最高频接管路径） | token 可预测（时间戳/自增/md5(手机号)）；token 不一次性/不过期；重置接口不校验 token 与账号的绑定（**拿 A 的 token 改 B 的密码**）；重置链接域名来自 **Host 头**（Host 头投毒 → 链接发到攻击者域）；重置只需知道手机号 |
| 注册/绑定 | 同邮箱/手机重复注册覆盖；第三方登录按 email 匹配 → 注册同名 email 接管；换绑不校验旧凭据 |
| 越权改密 | 改密接口不要求旧密码 + 用户 id 来自参数 = 任意用户改密 |

**账号接管往往不是一个洞，是一条链**：`用户枚举（登录/找回接口响应差分）→ 重置 token 可预测 → 改密不校验绑定 → 接管`。审计要把链画出来（写进 audit_workspace 的 findings 关联）。

用户枚举差分：登录失败提示"用户不存在" vs "密码错误"、响应时延差、找回密码接口的存在性差异。

## Z4 会话安全

- **会话固定**：登录前后 SessionID 是否更换？不换 = 会话固定。
- **注销**：注销后旧 SessionID 是否真的服务端失效（不是只删 Cookie）？
- **超时**：空闲超时 + 绝对超时；"记住我" token 是否长期有效、是否可撤销、是否绑定设备。
- **并发会话**：改密/踢下线后旧会话是否失效？
- **Cookie 属性**：`HttpOnly` / `Secure` / `SameSite` / `Domain` 是否设到父域（`.example.com` → 任意子域 XSS 可偷主站会话）/ `Path` 过宽。
- **token 存放**：放 `localStorage` 的 token 无法 HttpOnly 保护，XSS 即接管——这是设计缺陷，要在报告里点名。

## Z5 JWT 专项（逐条过）

| 攻击 | 判定 | 快速验证 |
|---|---|---|
| `alg: none` | 服务端是否接受无签名 | 头改 `{"alg":"none"}`，去掉签名段 |
| **HS/RS 算法混淆** | RS256 验签服务端误用公钥当 HMAC 密钥 | 拿公钥当密钥 HS256 重签 |
| **kid 注入** | `kid` 拼进文件路径/SQL/命令 | `kid: ../../dev/null`（空密钥）、`kid: ' union select ...` |
| **jku / x5u 外链** | 服务端按头里的 URL 去取验签公钥 | 指向自己的 JWKS → 自签任意 token（同时是 SSRF） |
| 弱密钥 | HS256 密钥是弱口令/硬编码 | **离线**跑字典（不打目标，不算爆破） |
| 不校验 `exp/nbf` | 过期 token 仍可用 | 用旧 token 重放 |
| 不校验 `iss/aud` | 别的系统签的 token 通用 | 跨系统重放 |
| 载荷明文敏感信息 | JWT 只是 base64 不是加密 | 直接解码看有无口令/身份证/内部 ID |
| 无撤销机制 | 改密/注销后 token 仍有效 | 改密后重放 |
| 载荷即权限 | `{"role":"user"}` 且验签有缺陷 | 改 role 重签 |

白盒锚点：`grep -rniE 'setSigningKey|parseClaimsJws|parse\(|verify\(|decode\(|HMAC|Jwts\.' $SRC` —— 重点看有没有 `parseClaimsJwt`（**不验签**版本）和 `decode` 而非 `verify`。

## Z6 OAuth2 / OIDC / SSO

| 面 | 缺陷 |
|---|---|
| `redirect_uri` 校验 | 前缀匹配（`https://good.com.evil.com`）、只校验域名不校验路径 + 站内开放重定向串联、允许子域、允许 `localhost`、path traversal、缺失校验 |
| `state` | 缺失/不校验/固定 → **CSRF 绑定劫持**：把攻击者的 code 塞给受害者，受害者账号被绑到攻击者的第三方号（反向也成立） |
| `code` | 可复用（应一次性）、泄露路径（Referer 带走、日志、前端 URL 残留）、不绑定 client、不绑定 redirect_uri |
| PKCE | 公共客户端缺 PKCE → 授权码劫持 |
| implicit 流 | token 走 URL fragment → 浏览器历史/Referer 泄露 |
| `scope` | 客户端可自行提权 scope；服务端不校验 scope 与操作的匹配 |
| `id_token` | 不校验签名 / `aud` / `iss` / nonce |
| 第三方登录 | 按 **email 匹配已有账号** 且第三方未验证邮箱 → 注册同名邮箱接管；`sub` 与本地账号的绑定关系可被覆盖 |

## Z7 SAML

- **签名未校验 / 只校验存在不校验内容**。
- **XSW（XML Signature Wrapping）**：把合法签名断言包进去，另塞一份被篡改的断言让业务逻辑读——签名校验和业务读取取的是**不同节点**。
- **XML 注释截断**：`admin<!--x-->@evil.com` 在某些解析器里被读成 `admin`。
- **断言重放**：不校验 `NotOnOrAfter` / 无 replay 缓存。
- **IdP 混淆**：不校验 Issuer，接受任意 IdP 签的断言。
- SAML 本身走 XML → **同时必测 XXE**。

## Z8 多租户隔离（SaaS 必测，极高频）

**问题模型**：`WHERE id = ?` 少了 `AND tenant_id = ?`。

逐个面查：

- 每张业务表的查询是否强制带租户条件？是 ORM 全局过滤器还是靠每个开发者手写？**靠手写 = 必有遗漏**，全库扫找漏的那几处。
- 租户 ID 从哪来？请求参数/头 = 直接跨租户。
- **共享资源泄露**：共享缓存 key 不含租户（`user:123`）、共享上传目录、共享搜索索引、共享导出文件名可猜、共享消息队列 topic。
- 跨租户的**间接通道**：全局搜索、@提及/人员选择器、统计报表、日志查询、附件直链、字典/枚举接口。
- 管理端：超管切换租户的接口是否鉴权。

```bash
# 找没带租户条件的查询
grep -rniE 'select .* from [a-z_]+ where' $SRC | grep -viE 'tenant|company|org|corp|shop'
```

## Z9 BFLA / 函数级授权（OWASP API Top10 #5）

**认证 ≠ 授权。** 常见：登录了就能调所有接口，只有 UI 上不显示按钮。

- 授权是**注解式**（`@PreAuthorize`/`@RequiresPermissions`）还是**拦截器式**还是**方法内 if**？
- 把「控制器方法全集」减去「带授权注解的方法集」= **裸奔方法清单**。这是最有产出的一条 grep：

```bash
# 全部控制器方法
grep -rn "@RequestMapping\|@GetMapping\|@PostMapping\|@DeleteMapping\|@PutMapping" $SRC > all_ep.txt
# 带授权注解的
grep -rn "@PreAuthorize\|@RequiresPermissions\|@RequiresRoles\|@Secured\|@RolesAllowed" $SRC > authz_ep.txt
# 差集人工比对 → 裸奔清单
```

- 注解表达式本身的洞：`@PreAuthorize("hasRole('#role')")` 里混入用户输入、`permitAll` 误用、通配符过宽。
- **管理端点暴露**：`/actuator/*`、`/druid`、`/swagger-ui`、`/console`、`/api/admin/*`、`/monitor`——它们常在鉴权拦截器的 url-pattern 之外。
- **方法级 vs URL 级不一致**：URL 拦截器按路径挡，但同一个方法有第二个 URL 映射（别名路由）绕开。

## Z10 与 P5 互证定级的衔接

认证/授权类缺陷的定级要点：

- **未授权成立**：R0（游客）就能打通 → Critical，写清"无需任何账号"。
- **需会话**：R1 打 R2 的数据 = 水平越权，仍是高危（一个注册账号即可，注册开放时约等于未授权）。**必须注明"注册是否开放"**——开放注册的水平越权 ≈ 未授权数据泄露。
- **跨租户**：几乎必然 Critical（一个租户看全平台）。
- **只在管理员角色下成立** = 低危或不算漏洞，别报级别通胀。

结论写进 audit_workspace：角色矩阵结果 → `record_surface`；每个越权点 → `add_finding`（三点闭合：为什么是缺陷、入口可达性、A/B 会话差分证据）。

## 收尾自查

- [ ] 角色矩阵每格都有结论（含 R0 未认证行、R4 跨租户行、R5 失效账号行）
- [ ] 读接口和写接口分别测过；导出/报表/附件/批量接口单独测过
- [ ] 密码重置链完整走过一遍（token 可预测性 + 绑定校验 + Host 头）
- [ ] JWT 十条逐条有结论（若用 JWT）
- [ ] OAuth/SAML 逐条有结论（若用 SSO）
- [ ] 裸奔方法清单（控制器全集 − 授权注解集）已产出并逐个验证
- [ ] 管理端点（actuator/druid/swagger/console）已线上验证可达性
