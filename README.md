# 黑盒/代审工作区

DSH Web GUI 侧边栏底部的可展开面板 **黑盒/代审** + 模型工具 `audit_workspace`。按 P0–P7 记实例、指纹、可达面、缺陷、覆盖矩阵和点子；点子只跟当前会话走。每个已验证漏洞单独产出一份带 PoC/EXP 的 SRC 专项报告。

包名：`dsh-lovelyaudit`  
形态：DSH **profile 组合包**（Host `index.js` + Client `client.js` + `cordis.patch.yml`），不是动态 `cordis_define` 插件。

## 别人怎么装

对方需要已安装 DSH，并用 **web** profile 开 GUI。

### 1. 拿到插件目录或 `.tgz`

把整个插件文件夹发给对方，或把下面打出来的 `dsh-lovelyaudit-0.1.0.tgz` 发给对方。

### 2. 加到 web profile 依赖

在任意目录执行（把路径换成对方本机上的插件目录或 tgz）：

```bat
dsh plugin --profile web add D:\path\to\audit-workspace
```

或：

```bat
dsh plugin --profile web add D:\path\to\dsh-lovelyaudit-0.1.0.tgz
```

### 3. 把组合包写进 profile（这一步不能省）

打开 `%USERPROFILE%\.dsh\profiles\web\package.json`（或 `$DSH_HOME/profiles/web/package.json`），确认两处都有这个包：

```json
{
  "dependencies": {
    "dsh-lovelyaudit": "..."
  },
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

`dsh plugin add` 只会加 `dependencies`。不写进 `bundles`，Host 不会加载，侧边栏也不会出现。

### 4. 重启 DSH

关掉再开 `dsh web`（或你平时的 GUI 启动命令）。**刷新页面不够**，Host 半边只在启动时加载。

打开 GUI 后：左侧边栏底部应出现可展开的 **黑盒/代审**；设置里应有 **黑盒/代审** 一节。

### 卸载

1. 从 `bundles` 里删掉 `dsh-lovelyaudit`
2. 执行：

```bat
dsh plugin --profile web remove dsh-lovelyaudit
```

3. 重启 DSH

## 你怎么打包发给别人

在插件源码目录（本目录）执行：

```bat
npm pack
```

会生成 `dsh-lovelyaudit-0.1.0.tgz`。把这个文件，或整个文件夹（至少含 `package.json`、`index.js`、`client.js`、`cordis.patch.yml`、`lib/`）发出去即可。

不要发 `%USERPROFILE%\.dsh\local-plugins\audit-workspace` 的安装副本当唯一源；以本仓库目录为准。

发 Git 仓库时，对方可以：

```bat
git clone <你的仓库>
dsh plugin --profile web add <克隆出来的 plugins\audit-workspace>
```

然后同样改 `bundles` 并重启。

## 开发者本机

源码：本目录  
安装副本：`$DSH_HOME/local-plugins/audit-workspace`（与 web profile 的 `link:` 对应）

改代码后：同步到安装副本，**重启 DSH**。不要改出厂 `agent-presets`。

## 使用

P0 填目标 URL、注意事项、可选账号/Header/Cookie、可选红线、CTF / Goal。点 **开始自动审计** 会新开一个会话。页内 tab：配置 / 目标 / 点子 / 测绘 / 漏洞。
