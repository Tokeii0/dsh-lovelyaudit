# Rust 与 C / C++（native 组件、二进制、IoT）审计要点

---

# 一 · Rust

内存安全大体由编译器保证，审计重心转向：

- **`unsafe` 块**：逐个审——裸指针、`transmute`、FFI 边界、`from_utf8_unchecked`、手写 `Send`/`Sync` 实现。**`unsafe` 是 Rust 项目里唯一可能出现传统内存漏洞的地方，全部列出来逐个看。**
- **整数与逻辑**：release 模式整数溢出**回绕不 panic**（`wrapping_*` 语义）→ 金额/长度校验绕过；`as` 截断转换。
- **panic 可达 = DoS**：服务端路径上的 `unwrap` / `expect` / 切片越界 / 除零。
- **依赖**：`cargo audit`；`unsafe` 大量出现的第三方 crate。
- **Web 框架**（actix / axum / rocket）：提取器缺鉴权；`sqlx` 的 `query!` 宏安全但 `query(&format!(...))` 不安全。

```bash
grep -rn "unsafe" --include="*.rs" . | wc -l
grep -rn "unsafe" --include="*.rs" .
grep -rnE '\.unwrap\(\)|\.expect\(' --include="*.rs" .
grep -rnE 'format!\(.*(SELECT|INSERT|UPDATE|DELETE)' --include="*.rs" .
cargo audit
```

---

# 二 · C / C++

传统内存安全类，模式扫描高产：

| 类 | 锚点 |
|---|---|
| 栈/堆溢出 | `strcpy` `strcat` `sprintf` `gets` `scanf("%s")` `memcpy`（长度可控）`alloca` |
| 格式化字符串 | `printf(user)` `syslog(user)` `snprintf(buf, n, user)` |
| 整数问题 | `int` 长度计算、`malloc(n*size)` 溢出、有符号/无符号比较、`strlen` 返回值截断 |
| UAF / 双重释放 | `free` 后仍用、错误路径重复 free、C++ 悬垂引用 / 迭代器失效 |
| 越界 | `arr[i]` 无边界检查、off-by-one（`<=`）、`memcpy` 长度取自报文 |
| 命令/路径 | `system` `popen` `execl` 拼接；`chroot` 后未 `chdir` |
| 竞态 | `access()` 后 `open()`（TOCTOU）、临时文件 `mktemp` |

```bash
grep -rnE '\b(strcpy|strcat|sprintf|gets|vsprintf|alloca)\s*\(' . --include="*.c" --include="*.cpp" --include="*.h"
grep -rnE '\b(printf|fprintf|syslog|snprintf)\s*\(\s*[a-z_]+\s*\)' .        # 格式串非常量
grep -rnE '\bmemcpy\s*\(|\bmalloc\s*\(|\bsystem\s*\(|\bpopen\s*\(' .
```

## 配套动作

- **编译加固检查**：`checksec --file=./bin`（NX / PIE / Canary / RELRO）。
- **动态检测**：ASan / UBSan / Valgrind 跑现有测试。
- **Fuzz**：给每个解析器 / 协议处理写 harness——AFL++ / libFuzzer。崩溃后分析可利用性（见 `unknown-vuln` 技术四）。
- 无源码时：Ghidra / IDA 逆向 + 字符串与导入表分析。
