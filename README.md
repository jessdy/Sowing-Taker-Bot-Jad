# Sowing Taker Bot 自动机器人

一个专为与 Taker Sowing 协议交互而设计的自动化挖矿机器人。该机器人帮助自动化每日签到和挖矿活动，以积累 Taker 积分，这些积分可能对未来的空投有价值。

## 注册

- 链接：[Taker Sowing](https://sowing.taker.xyz)

## 功能特性

- 自动每日签到
- 支持多个钱包
- 为高级用户提供代理支持
- 实时日志记录和状态更新
- 自动令牌刷新
- 下次挖矿机会的倒计时器

## 安装

### 前置要求

- Node.js (v16 或更高版本)
- npm 或 yarn 包管理器

### 设置

1. 克隆仓库：

```bash
git clone https://github.com/jessdy/Sowing-Taker-Bot-Jad.git
cd Sowing-Taker-Bot-Jad
```

2. 安装依赖：

```bash
npm install
```

3. 复制 `.env` 文件到项目根目录并添加您的私钥：

```bash
cp .env.example .env
```
```
PRIVATE_KEY_1=your_private_key_here
PRIVATE_KEY_2=another_private_key_here
# 根据需要添加更多
```

4. （可选）如果您想使用代理，创建一个 `proxies.txt` 文件并每行添加一个代理：

```
socks5://username:password@host:port
http://username:password@host:port
# 根据需要添加更多
```

## 使用方法

启动机器人：

```bash
npm start
```

### 控制说明

注意：当前版本已改为日志文件输出模式，不再支持交互式控制。所有操作信息将记录在 `logs/` 目录下的日志文件中。

## 工作原理

1. 机器人使用以太坊签名对每个钱包进行身份验证
2. 执行每日签到以赚取 Taker 积分
3. 系统记录当前积分、连续签到次数和下次挖矿机会的时间
4. 机器人会在需要时自动刷新令牌并跟踪每个钱包的状态

## 安全注意事项

- 永远不要分享您的 `.env` 文件或私钥
- 此机器人在本地运行，不会将您的私钥发送到任何外部服务器
- 所有签名都使用 ethers.js 库在本地创建

## 故障排除

如果您遇到任何问题：

1. 确保您的私钥格式正确
2. 检查您的代理（如果使用）是否正常工作
3. 确保您有稳定的互联网连接
4. 查看日志文件以获取详细的错误信息

## 免责声明

此机器人仅供教育目的提供。使用风险自负。开发者不对使用此软件可能产生的任何潜在风险（包括但不限于经济损失）承担责任。

## 捐赠支持
如果您觉得这个项目对您有帮助，可以通过以下地址进行捐赠支持项目开发：

- EVM (以太坊/BSC/Polygon等): `0xD6611773079e022B4E403a5DF8152Cda9fA9B11f` 或 `jessdy.eth`
- Solana: `EEG8sYSWaU7S9c1NPKvkzWXZbfutvoRaR7sNtqrA22ru`
- Bitcoin: `bc1pv5xfcrvqadltd9vj83k7lshtz9vj4caj2uldj8d87e6f4c4p5unqh9um6q`

您的支持是我们持续改进和维护项目的动力！🙏


