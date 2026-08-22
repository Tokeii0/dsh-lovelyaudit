# dsh-lovelyaudit

DSH 侧边栏 **黑盒/代审**：P0–P7 测绘、点子、漏洞专项报告（含 PoC/EXP）。

## 安装

```bat
dsh plugin --profile web add https://github.com/Tokeii0/dsh-lovelyaudit/releases/latest/download/dsh-lovelyaudit.tgz
```

装完重启 DSH。侧边栏底部出现 **黑盒/代审** 即成功。

`dsh plugin add` 会自动把本包写进 web profile 的 `bundles`，不用手改 `package.json`。

## 更新

先卸载旧版再装最新版：

```bat
dsh plugin --profile web remove dsh-lovelyaudit
dsh plugin --profile web add https://github.com/Tokeii0/dsh-lovelyaudit/releases/latest/download/dsh-lovelyaudit.tgz
```

重启 DSH 生效。目标台账、漏洞、设置都不受影响（存在 `~/.dsh` 下，不在插件包里）。

## 使用

配置页填目标 URL，可选账号、Header、红线、CTF / Goal，点开始。进度看「目标」，漏洞看「漏洞」。


<img width="985" height="965" alt="image" src="https://github.com/user-attachments/assets/44b35cd8-64dd-47d4-bedb-a4a54eb96b95" />
