## 什么是 winget

winget（Windows Package Manager）是 Windows 系统自带的软件包管理器，相当于手机上的"应用商店"命令行版。用一条命令就能完成软件的下载、安装、升级和卸载，装过的软件还能统一升级，告别到处找安装包。

## 安装前提

- Windows 10 1809（2018 年 10 月更新）及以上，或 Windows 11
- winget 随「应用安装程序」（App Installer）提供，系统自带，一般无需单独安装

### 检查 winget 是否可用

按 `Win` 键输入 `powershell`，打开 Windows PowerShell，运行：

```powershell
winget --version
```

能显示版本号（如 `v1.9.x`）即可使用。若提示"找不到命令"，请到 Microsoft Store 搜索并安装「应用安装程序」，然后重新打开 PowerShell。

## 一键安装 Vantage

在 PowerShell 或命令提示符中运行：

```powershell
winget install ASYS.Vantage
```

等待进度条走完即安装完成，之后在开始菜单中搜索 **Vantage** 即可启动。

> 💡 **首次使用提示**：第一次运行 winget 会询问是否同意源协议，输入 `Y` 回车即可。想跳过所有确认，用这条命令：

```powershell
winget install ASYS.Vantage --accept-package-agreements --accept-source-agreements
```

## 其他常用命令

| 用途 | 命令 |
|------|------|
| 查看软件信息 | `winget show ASYS.Vantage` |
| 升级到最新版 | `winget upgrade ASYS.Vantage` |
| 卸载 Vantage | `winget uninstall ASYS.Vantage` |

> 💡 **升级提示**：Vantage 发布新版本后运行 `winget upgrade` 即可检查和升级，无需再去官网重新下载安装包。

## 常见问题

**提示"找不到软件包"**：请确认包名拼写为 `ASYS.Vantage`，或稍等片刻重试——新发布的软件包同步到 winget 源需要一定时间。
