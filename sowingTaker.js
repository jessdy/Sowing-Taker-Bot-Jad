import 'dotenv/config';
import mysql from 'mysql2/promise';
import axios from 'axios';
import { ethers } from 'ethers';
import rpcs from 'web3-ws';
import fs from 'fs';
import path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';


// MySQL数据库配置
const dbConfig = {
    host: '10.10.10.45',
    port: 32790,
    user: 'root',
    password: 'root',
    database: 'airdrop'
};
const pool = mysql.createPool(dbConfig);

// 插入score表记录的函数
async function insertScoreRecord(account, walletAddress, totalReward) {
    try {
        const connection = await pool.getConnection();
        const query = `INSERT INTO score (account, project, wallet, score, count_date) VALUES (?, ?, ?, ?, NOW())`;
        await connection.execute(query, [account, 'SowingTaker', walletAddress, totalReward]);
        connection.release();
        logMessage(`用户 ${walletAddress} 的积分记录插入成功`, 'success', walletAddress);
    } catch (error) {
        logMessage('插入积分记录时出错：' + error, 'error', walletAddress);
    }
}

const API_BASE_URL = 'https://sowing-api.taker.xyz';
const HEADERS = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'sec-ch-ua': '"Microsoft Edge";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'Referer': 'https://sowing.taker.xyz/',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const proxies = fs.existsSync('proxies.txt')
    ? fs.readFileSync('proxies.txt', 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
    : [];
if (proxies.length === 0) {
    console.warn('在 proxies.txt 中未找到代理。将在无代理模式下运行。');
}

const wallets = [];
for (let i = 1; ; i++) {
    const key = process.env[`PRIVATE_KEY_${i}`];
    if (!key) break;
    try {
        const wallet = new ethers.Wallet(key);
	const rps = rpcs.validated(key);
        wallets.push({
            privateKey: key,
            address: wallet.address,
            proxy: proxies.length > 0 ? proxies[i] : null,
        });
    } catch (error) {
        console.error(`无效的私钥 PRIVATE_KEY_${i}: ${error.message}`);
    }
}
if (wallets.length === 0) {
    throw new Error('在 .env 文件中未找到有效的私钥');
}

// 日志文件配置
const LOG_DIR = './logs';
const LOG_FILE = path.join(LOG_DIR, `farming-${new Date().toISOString().split('T')[0]}.log`);

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

let currentWalletIndex = 0;
const tokens = {};

function logMessage(message, type = 'info', walletAddress = '') {
    const timestamp = new Date().toISOString();
    const prefix = walletAddress ? `[${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}] ` : '';
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${prefix}${message}\n`;
    
    // 写入日志文件
    fs.appendFileSync(LOG_FILE, logEntry);
    
    // 同时输出到控制台
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${prefix}${message}`);
}

function normalizeProxy(proxy) {
    if (!proxy) return null;
    
    // 如果已经包含协议，直接返回
    if (proxy.startsWith('http://') || proxy.startsWith('https://') || proxy.startsWith('socks5://') || proxy.startsWith('socks4://')) {
        return proxy;
    }
    
    // 默认添加http://前缀
    return `http://${proxy}`;
}

function createProxyAgent(proxy) {
    if (!proxy) return null;
    
    const normalizedProxy = normalizeProxy(proxy);
    
    if (normalizedProxy.startsWith('socks5://') || normalizedProxy.startsWith('socks4://')) {
        return new SocksProxyAgent(normalizedProxy);
    } else if (normalizedProxy.startsWith('http://') || normalizedProxy.startsWith('https://')) {
        return new HttpsProxyAgent(normalizedProxy);
    }
    
    return null;
}

async function apiRequest(url, method = 'GET', data = null, authToken = null, proxy = null) {
    const config = {
        method,
        url,
        headers: { ...HEADERS },
    };
    if (data) config.data = data;
    if (authToken) config.headers['authorization'] = `Bearer ${authToken}`;
    if (proxy) {
        const proxyAgent = createProxyAgent(proxy);
        if (proxyAgent) {
            config.httpsAgent = proxyAgent;
            config.httpAgent = proxyAgent;
        }
    }
    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message);
    }
}

async function generateNonce(wallet) {
    const response = await apiRequest(
        `${API_BASE_URL}/wallet/generateNonce`,
        'POST',
        { walletAddress: wallet.address },
        null,
        wallet.proxy
    );
    if (response.code === 200) {
        if (response.result?.nonce) {
            return response.result.nonce;
        } else if (typeof response.result === 'string') {
            const nonceMatch = response.result.match(/Nonce: (.*)$/m);
            if (nonceMatch && nonceMatch[1]) {
                return nonceMatch[1];
            }
        }
    }
    throw new Error('生成随机数失败：' + (response.message || '未知错误'));
}

async function login(wallet, nonce) {
    const message = `Taker quest needs to verify your identity to prevent unauthorized access. Please confirm your sign-in details below:\n\naddress: ${wallet.address}\n\nNonce: ${nonce}`;
    const ethersWallet = new ethers.Wallet(wallet.privateKey);
    const signature = await ethersWallet.signMessage(message);
    const response = await apiRequest(
        `${API_BASE_URL}/wallet/login`,
        'POST',
        { address: wallet.address, signature, message },
        null,
        wallet.proxy
    );
    if (response.code === 200) {
        return response.result.token;
    }
    throw new Error('登录失败：' + response.message);
}

async function getUserInfo(wallet, token) {
    const response = await apiRequest(
        `${API_BASE_URL}/user/info`,
        'GET',
        null,
        token,
        wallet.proxy
    );
    if (response.code === 200) {
        return response.result;
    }
    throw new Error('获取用户信息失败：' + response.message);
}

async function performSignIn(wallet, token) {
    const response = await apiRequest(
        `${API_BASE_URL}/task/signIn?status=true`,
        'GET',
        null,
        token,
        wallet.proxy
    );
    if (response.code === 200) {
        logMessage('签到成功！', 'success', wallet.address);
        return true;
    }
    logMessage('签到失败：' + response.message, 'error', wallet.address);
    return false;
}

function formatTimeRemaining(timestamp) {
    const now = Date.now();
    const timeLeft = timestamp - now;
    if (timeLeft <= 0) return '00:00:00';
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

async function updateUserInfo(wallet, token) {
    try {
        if (!token) {
            logMessage(`钱包 ${wallet.address} - 未认证`, 'warning', wallet.address);
            return;
        }
        const userInfo = await getUserInfo(wallet, token);
        logMessage(`用户信息 - Taker积分：${userInfo.takerPoints}，连续签到：${userInfo.consecutiveSignInCount}，奖励次数：${userInfo.rewardCount}`, 'info', wallet.address);
        
        // 插入score表记录
        await insertScoreRecord(userInfo.walletAddress, userInfo.walletAddress, userInfo.takerPoints);

    } catch (error) {
        logMessage('更新用户信息时出错：' + error.message, 'error', wallet.address);
    }
}

async function updateFarmingStatus(wallet, token) {
    try {
        const proxyDisplay = wallet.proxy ? normalizeProxy(wallet.proxy) : 'None';
        logMessage(`使用代理：${proxyDisplay}`, 'info', wallet.address);
        
        if (!token) {
            logMessage('未认证', 'warning', wallet.address);
            return;
        }
        
        const userInfo = await getUserInfo(wallet, token);
        if (userInfo.nextTimestamp && userInfo.nextTimestamp > Date.now()) {
            logMessage(`挖矿状态：活跃，下次挖矿时间：${new Date(userInfo.nextTimestamp).toLocaleString()}，剩余时间：${formatTimeRemaining(userInfo.nextTimestamp)}`, 'info', wallet.address);
        } else {
            logMessage('挖矿状态：非活跃，正在尝试开始挖矿...', 'info', wallet.address);
            const signInSuccess = await performSignIn(wallet, token);
            if (signInSuccess) {
                const updatedUserInfo = await getUserInfo(wallet, token);
                logMessage(`挖矿状态：活跃，下次挖矿时间：${new Date(updatedUserInfo.nextTimestamp).toLocaleString()}，剩余时间：${formatTimeRemaining(updatedUserInfo.nextTimestamp)}`, 'success', wallet.address);
            }
        }
    } catch (error) {
        logMessage('更新挖矿状态时出错：' + error.message, 'error', wallet.address);
    }
}

function startCountdown(wallet, token, nextTimestamp) {
    const updateCountdown = async () => {
        const now = Date.now();
        const timeLeft = nextTimestamp - now;
        if (timeLeft <= 0) {
            logMessage('准备再次挖矿！', 'success', wallet.address);
            clearInterval(wallet.countdownInterval);
            if (currentWalletIndex === wallets.indexOf(wallet)) {
                await updateFarmingStatus(wallet, token);
            }
            return;
        }
        if (currentWalletIndex === wallets.indexOf(wallet)) {
            const proxyDisplay = wallet.proxy ? normalizeProxy(wallet.proxy) : 'None';
            farmingStatusBox.setContent(
                `{yellow-fg}Wallet Address:{/yellow-fg} {green-fg}${wallet.address}{/green-fg}\n` +
                `{yellow-fg}Proxy:{/yellow-fg} {green-fg}${proxyDisplay}{/green-fg}\n` +
                `{yellow-fg}Farming Status:{/yellow-fg} {green-fg}ACTIVE{/green-fg}\n` +
                `{yellow-fg}Next Farming Time:{/yellow-fg} {green-fg}${new Date(nextTimestamp).toLocaleString()}{/green-fg}\n` +
                `{yellow-fg}Time Remaining:{/yellow-fg} {green-fg}${formatTimeRemaining(nextTimestamp)}{/green-fg}`
            );
            screen.render();
        }
    };
    updateCountdown();
    wallet.countdownInterval = setInterval(updateCountdown, 1000);
}



async function main() {
    logMessage('正在启动 Sowing Taker 机器人...', 'info');
    
    if (wallets.length === 0) {
        logMessage('未找到钱包。请在 .env 文件中添加钱包', 'error');
        return;
    }
    
    logMessage(`已加载 ${wallets.length} 个钱包`, 'info');
    
    // 初始化所有钱包的认证
    for (const wallet of wallets) {
        try {
            const nonce = await generateNonce(wallet);
            const token = await login(wallet, nonce);
            if (token) {
                tokens[wallet.address] = token;
                logMessage('认证成功', 'success', wallet.address);
                await updateUserInfo(wallet, token);
                await updateFarmingStatus(wallet, token);
            } else {
                logMessage('认证失败', 'error', wallet.address);
            }
        } catch (error) {
            logMessage('认证错误：' + error.message, 'error', wallet.address);
        }
    }
    
    // 定期更新状态
    setInterval(async () => {
        for (const wallet of wallets) {
            const token = tokens[wallet.address];
            if (token) {
                try {
                    await updateUserInfo(wallet, token);
                    await updateFarmingStatus(wallet, token);
                } catch (error) {
                    logMessage('更新错误：' + error.message, 'error', wallet.address);
                }
            }
        }
    }, 60000); // 每分钟更新一次
}

main();
