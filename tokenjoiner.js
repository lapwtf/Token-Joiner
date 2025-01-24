const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs').promises;
const inquirer = require('inquirer');
const ora = require('ora');
const https = require('https');

class TokenJoiner {
    constructor() {
        this.tokens = [];
        this.proxies = [];
        this.joinedCount = 0;
        this.failedCount = 0;
        this.successfulJoins = [];
        this.agent = new https.Agent({
            rejectUnauthorized: false,
            ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384'
        });
    }

    getHeaders(token) {
        return {
            'authority': 'discord.com',
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'authorization': token,
            'content-type': 'application/json',
            'cookie': 'locale=en-US',
            'origin': 'https://discord.com',
            'referer': 'https://discord.com/channels/@me',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="115", "Google Chrome";v="115"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            'x-context-properties': 'eyJsb2NhdGlvbiI6IkpvaW4gR3VpbGQiLCJsb2NhdGlvbl9ndWlsZF9pZCI6IjExMDQzNzg1NDMwNzg2Mzc1OTEiLCJsb2NhdGlvbl9jaGFubmVsX2lkIjoiMTEwNzI4NDk3MTkwMDYzMzIzMCIsImxvY2F0aW9uX2NoYW5uZWxfdHlwZSI6MH0=',
            'x-debug-options': 'bugReporterEnabled',
            'x-discord-locale': 'en-US',
            'x-super-properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6ImVuLVVTIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzExNS4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTE1LjAuMC4wIiwib3NfdmVyc2lvbiI6IjEwIiwicmVmZXJyZXIiOiIiLCJyZWZlcnJpbmdfZG9tYWluIjoiIiwicmVmZXJyZXJfY3VycmVudCI6IiIsInJlZmVycmluZ19kb21haW5fY3VycmVudCI6IiIsInJlbGVhc2VfY2hhbm5lbCI6InN0YWJsZSIsImNsaWVudF9idWlsZF9udW1iZXIiOjI0MzE4MywiY2xpZW50X2V2ZW50X3NvdXJjZSI6bnVsbH0='
        };
    }

    async getCookies() {
        try {
            const response = await axios.get('https://discord.com');
            return response.headers['set-cookie'] || [];
        } catch (error) {
            this.log('Failed to obtain cookies: ' + error.message, 'error');
            return [];
        }
    }

    async handleOnboarding(guildId, token, proxy = null, isPreJoin = false) {
        try {
            this.log('Getting onboarding questions...', 'loading');
            const response = await axios.get(
                `https://discord.com/api/v9/guilds/${guildId}/onboarding`,
                {
                    headers: this.getHeaders(token),
                    proxy,
                    httpsAgent: this.agent
                }
            );

            if (!response.data.enabled) {
                this.log('Onboarding not enabled for this server', 'info');
                return true;
            }

            const prompts = response.data.prompts || [];
            if (!prompts.length) {
                this.log('No onboarding prompts found', 'info');
                return true;
            }

            const answers = [];
            const currentTime = Date.now();
            const promptsSeen = {};
            const answersSeen = {};

            prompts.forEach(prompt => {
                if (prompt.options && prompt.options.length) {
                    const option = prompt.options[0];
                    answers.push(option.id);
                    promptsSeen[prompt.id] = currentTime;
                    answersSeen[option.id] = currentTime;
                }
            });

            if (isPreJoin) {
                const seenPayload = {
                    prompts_seen: promptsSeen,
                    answers_seen: answersSeen
                };

                await axios.post(
                    `https://discord.com/api/v9/guilds/${guildId}/onboarding-prompts-seen`,
                    seenPayload,
                    {
                        headers: this.getHeaders(token),
                        proxy,
                        httpsAgent: this.agent
                    }
                );

                await new Promise(resolve => setTimeout(resolve, 1000));

                const payload = {
                    guild_id: guildId,
                    answers,
                    prompts_seen: promptsSeen,
                    answers_seen: answersSeen
                };

                await axios.post(
                    `https://discord.com/api/v9/guilds/${guildId}/onboarding-application`,
                    payload,
                    {
                        headers: this.getHeaders(token),
                        proxy,
                        httpsAgent: this.agent
                    }
                );
            } else {
                const payload = {
                    responses: answers,
                    prompts_seen: promptsSeen,
                    responses_seen: answersSeen
                };

                await axios.put(
                    `https://discord.com/api/v9/guilds/${guildId}/onboarding-responses`,
                    payload,
                    {
                        headers: this.getHeaders(token),
                        proxy,
                        httpsAgent: this.agent
                    }
                );
            }

            this.log('Onboarding completed successfully', 'success');
            return true;
        } catch (error) {
            this.log('Onboarding error: ' + error.message, 'error');
            return false;
        }
    }

    async leaveGuild(token, guildId, proxy = null) {
        try {
            this.log(`Leaving guild for token ${token.substring(0, 25)}...`, 'loading');
            
            await axios.delete(
                `https://discord.com/api/v9/users/@me/guilds/${guildId}`,
                {
                    headers: this.getHeaders(token),
                    proxy,
                    httpsAgent: this.agent,
                    data: {}
                }
            );
            
            this.log(`Token ${token.substring(0, 25)}... left successfully`, 'success');
            return true;
        } catch (error) {
            this.log(`Error leaving guild: ${error.message}`, 'error');
            return false;
        }
    }

    async joinServer(token, invite, proxy = null) {
        try {
            const inviteCode = invite.split('/').pop();
            
            const inviteResponse = await axios.get(
                `https://discord.com/api/v9/invites/${inviteCode}?with_counts=true&with_expiration=true`,
                {
                    headers: this.getHeaders(token),
                    proxy,
                    httpsAgent: this.agent
                }
            );

            const guildId = inviteResponse.data.guild.id;

            const onboardingResponse = await axios.get(
                `https://discord.com/api/v9/guilds/${guildId}/onboarding`,
                {
                    headers: this.getHeaders(token),
                    proxy,
                    httpsAgent: this.agent
                }
            );

            const requiresPreJoin = onboardingResponse.data.enabled && onboardingResponse.data.mode === 1;

            if (requiresPreJoin) {
                this.log('Pre-join onboarding required', 'info');
                if (!await this.handleOnboarding(guildId, token, proxy, true)) {
                    this.failedCount++;
                    return;
                }
            }

            const joinPayload = {
                session_id: Math.random().toString(36).substring(2, 15)
            };

            await axios.post(
                `https://discord.com/api/v10/invites/${inviteCode}`,
                joinPayload,
                {
                    headers: this.getHeaders(token),
                    proxy,
                    httpsAgent: this.agent
                }
            );

            this.log(`Token ${token.substring(0, 25)}... joined successfully`, 'success');
            this.joinedCount++;
            this.successfulJoins.push([token, guildId]);

            if (!requiresPreJoin) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (!await this.handleOnboarding(guildId, token, proxy, false)) {
                    this.log(`Post-join onboarding failed for token ${token.substring(0, 25)}...`, 'warning');
                }
            }
        } catch (error) {
            this.log(`Error with token ${token.substring(0, 25)}...: ${error.message}`, 'error');
            this.failedCount++;
        }
    }

    async loadTokens() {
        try {
            const data = await fs.readFile('tokens.txt', 'utf8');
            return data.split('\n').filter(line => line.trim());
        } catch (error) {
            this.log('No tokens found in tokens.txt', 'error');
            return [];
        }
    }

    async loadProxies() {
        try {
            const data = await fs.readFile('proxies.txt', 'utf8');
            return data.split('\n').filter(line => line.trim());
        } catch (error) {
            this.log('No proxies loaded, using direct connection', 'warning');
            return [];
        }
    }

    log(message, type = 'info') {
        const colors = {
            info: chalk.cyan,
            success: chalk.green,
            error: chalk.red,
            warning: chalk.yellow,
            loading: chalk.magenta
        };
        console.log(colors[type](`[ >.< ] ${message}`));
    }

    printBanner() {
        console.clear();
        console.log(chalk.magenta(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                ${chalk.cyan('Discord Token Joiner v1.0')}                     ║
    ╚══════════════════════════════════════════════════════════════╝
`));
    }

    async start() {
        this.printBanner();
        
        this.log('Loading configuration...', 'loading');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        this.tokens = await this.loadTokens();
        if (!this.tokens.length) {
            this.log('No tokens found in tokens.txt', 'error');
            return;
        }

        this.proxies = await this.loadProxies();
        if (this.proxies.length) {
            this.log(`Loaded ${this.proxies.length} proxies`, 'success');
        }

        while (true) {
            const { choice } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'choice',
                    message: 'Select an option:',
                    choices: [
                        'Join Server',
                        'Leave Server',
                        'Exit'
                    ]
                }
            ]);

            if (choice === 'Join Server') {
                const { invite, tokenCount, delay } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'invite',
                        message: 'Enter Discord invite link or code:'
                    },
                    {
                        type: 'number',
                        name: 'tokenCount',
                        message: `Enter number of tokens to use (max ${this.tokens.length}):`,
                        validate: input => input > 0 && input <= this.tokens.length
                    },
                    {
                        type: 'number',
                        name: 'delay',
                        message: 'Enter delay between joins (in seconds):',
                        validate: input => input >= 0
                    }
                ]);

                this.log('Starting join process...', 'loading');
                await new Promise(resolve => setTimeout(resolve, 1000));

                this.joinedCount = 0;
                this.failedCount = 0;
                this.successfulJoins = [];

                const proxyCycle = this.proxies.length ?
                    [...Array(tokenCount)].map((_, i) => this.proxies[i % this.proxies.length]) :
                    Array(tokenCount).fill(null);

                for (let i = 0; i < tokenCount; i++) {
                    await this.joinServer(this.tokens[i], invite, proxyCycle[i]);
                    await new Promise(resolve => setTimeout(resolve, delay * 1000));
                }

                this.log('Join process completed!', 'success');
                this.log(`Successful joins: ${this.joinedCount}`, 'success');
                this.log(`Failed joins: ${this.failedCount}`, 'error');

            } else if (choice === 'Leave Server') {
                if (!this.successfulJoins.length) {
                    this.log('No successful joins to leave from', 'error');
                    continue;
                }

                const { confirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `Found ${this.successfulJoins.length} tokens that can leave. Proceed?`
                    }
                ]);

                if (confirm) {
                    this.log('Starting leave process...', 'loading');
                    
                    for (const [token, guildId] of this.successfulJoins) {
                        await this.leaveGuild(token, guildId);
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    this.successfulJoins = [];
                    this.log('Leave process completed!', 'success');
                }

            } else {
                this.log('Exiting...', 'info');
                break;
            }
        }
    }
}

new TokenJoiner().start().catch(console.error);
