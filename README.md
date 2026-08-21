# dsh-lovelyaudit

DSH 侧边栏 **黑盒/代审**：P0–P7 测绘、点子、漏洞专项报告（含 PoC/EXP）。

## 安装

```bat
dsh plugin --profile web add https://github.com/Tokeii0/dsh-lovelyaudit/releases/latest/download/dsh-lovelyaudit-0.1.0.tgz
```

然后编辑 `%USERPROFILE%\.dsh\profiles\web\package.json`，把包名加进 `bundles`：

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-lovelyaudit"
      ]
    }
  }
}
```

重启 DSH。侧边栏底部出现 **黑盒/代审** 即成功。

## 使用

配置页填目标 URL，可选账号、Header、红线、CTF / Goal，点开始。进度看「目标」，漏洞看「漏洞」。
