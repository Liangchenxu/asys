# 关于代码签名

Vantage 免费、开源，不靠收费盈利。与许多开源项目一样，跨平台的代码签名受制于各商业平台的门槛，因此在不同系统上，你可能会看到不一样的安全提示。本页把这些情况统一说明清楚。

## Windows

Windows 会对下载的安装包做 SmartScreen / UAC 检查。

**目前 Vantage 的 Windows 版本尚未签名**，因此在部分设备上首次运行时，可能出现「未知发布者」「Windows 已保护你的电脑」之类的提示。这不影响安装与使用；如果今后接入签名，我们会在此页更新说明。

> 参考：若由开源签名项目代签，UAC 中显示的发布者会是该签名项目，而不是 Vantage 本身。这也是不少开源软件的做法。

## macOS

**Vantage 的 macOS 版本未签名、未公证，因此无法直接运行。** 我们没有付费的 Apple Developer 许可，也不愿支持这种被放在付费墙后、却没有带来实质收益的签名机制。

首次打开时，系统会拦截，提示「已损坏，无法打开」或「无法验证开发者」。解除隔离后即可正常使用：

```bash
xattr -dr com.apple.quarantine /Applications/Vantage.app
```

## Linux

Linux 不使用代码签名，而是用 GPG 校验安装包与仓库：

- **deb / rpm 仓库**：通过 GPG 公钥验证（见 [Linux 安装教程](docs.html#linux-repos)）
- **AppImage / tar.gz**：附带 `.asc` 分离签名，可用公钥校验

公钥文件：`vantage-archive-keyring.asc`（各项安装教程中均给出链接）。
