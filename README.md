# QX-Rule

这是一个给 Quantumult X 用的规则转换仓库。

我平时更习惯 Loyalsoldier 那套 V2Ray / Xray 分流思路：国内直连、国外代理、广告和追踪拒绝。但 Quantumult X 不能直接读取 `geosite.dat` 和 `geoip.dat`，所以这个仓库每天从 [Loyalsoldier/v2ray-rules-dat](https://github.com/Loyalsoldier/v2ray-rules-dat) 拉取公开文本规则，转换成 Quantumult X 可以直接添加的规则资源。

简单说，就是把熟悉的 Loyalsoldier 规则变成一条 QX 可用的远程规则链接。

## 直接使用

在 Quantumult X 的规则资源里添加这一条：

```text
https://raw.githubusercontent.com/Sake-My/QX-Rule/release/ruleset/loyalsoldier-qx.list
```

如果你是手动编辑配置文件，可以放到 `[filter_remote]`：

```ini
[filter_remote]
https://raw.githubusercontent.com/Sake-My/QX-Rule/release/ruleset/loyalsoldier-qx.list, tag=Loyalsoldier QX, update-interval=86400, opt-parser=false, enabled=true
```

这一个文件里已经写好了 `proxy`、`direct`、`reject`，不需要再额外指定 `force-policy`，也不需要新建策略组。

## 分流效果

默认规则顺序大致是：

```text
局域网和私有地址 -> direct
广告和追踪域名 -> reject
Apple CN / Google CN / 中国 TLD -> direct
非中国域名 / 代理列表 -> proxy
中国域名 -> direct
中国 IP -> direct
剩余流量 -> proxy
```

主规则资源末尾已经包含：

```ini
geoip, cn, direct
final, proxy
```

所以一般不需要再单独添加 `FILTER_REGION` 或另一条 `final, proxy`。如果你的本地配置里已经有 `final, proxy`，保留也可以。

## 自动更新

`main` 分支只放脚本、说明和 GitHub Actions，不保存每天生成出来的大量规则文件。这样本地改 README 或脚本时，不会因为 Actions 自动提交规则而反复需要同步。

每天香港时间 06:30，GitHub Actions 会自动：

```text
拉取 Loyalsoldier release 分支文本规则
转换为 Quantumult X 规则格式
发布到本仓库的 release 分支
```

Quantumult X 读取的就是 `release` 分支里的规则文件。

## 隐私说明

这个仓库只处理公开规则数据，不会读取、保存或上传你的机场订阅链接、节点信息、token 或账号内容。

你的节点订阅仍然放在 Quantumult X 自己的 `[server_remote]` 或资源管理里；本项目只负责分流规则。

## 生成文件

Actions 会在 `release` 分支生成这些文件：

```text
ruleset/loyalsoldier-qx.list
ruleset/reject.list
ruleset/reject-tld.list
ruleset/apple-cn.list
ruleset/google-cn.list
ruleset/direct-tld.list
ruleset/proxy.list
ruleset/proxy-tld.list
ruleset/direct.list
ruleset/china-list.list
ruleset/gfw.list
ruleset/win-spy.list
ruleset/win-update.list
ruleset/win-extra.list
ruleset/_skipped/*.skipped.txt
ruleset/manifest.json
ruleset/qx-filter-remote.conf.template
```

日常只需要使用 `ruleset/loyalsoldier-qx.list`。其他拆分文件主要用于排查问题，或者以后想自己组合规则时备用。

## 本地运行

需要本地检查生成结果时，可以运行：

```bash
node scripts/convert-loyalsoldier-to-qx.mjs
```

本地会生成 `ruleset/`，但这个目录已经被 `.gitignore` 忽略，不会提交到 `main` 分支。

如果以后想把代理动作改成自定义策略组，例如 `节点选择`，可以这样跑：

```bash
QX_PROXY_POLICY="节点选择" QX_DIRECT_POLICY="direct" QX_REJECT_POLICY="reject" node scripts/convert-loyalsoldier-to-qx.mjs
```

PowerShell 写法：

```powershell
$env:QX_PROXY_POLICY="节点选择"
$env:QX_DIRECT_POLICY="direct"
$env:QX_REJECT_POLICY="reject"
node scripts/convert-loyalsoldier-to-qx.mjs
```

## 转换规则

脚本会把 Loyalsoldier 的文本规则转换成 QX 的分流格式：

```text
full:example.com      -> host, example.com, policy
domain:example.com    -> host-suffix, example.com, policy
keyword:example       -> host-keyword, example, policy
example.com           -> host-suffix, example.com, policy
```

少量 `regexp:` 规则无法等价转换为 Quantumult X 分流规则，会记录在 `ruleset/_skipped/` 里。

## 首次启用 Actions

如果 GitHub Actions 第一次运行时无法提交，请到仓库设置里打开写入权限：

```text
Settings -> Actions -> General -> Workflow permissions -> Read and write permissions
```

然后手动重新运行一次 `Update Quantumult X rules` 工作流。
