/**
 * SolanaScope - Vercel Serverless API
 * Real-time Solana Intelligence for AI Agents
 * Built by clawdbot-prime for the Colosseum Agent Hackathon
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

// Known protocol addresses
const PROTOCOLS: Record<string, { name: string; programId: string; type: string }> = {
  jupiter: { name: 'Jupiter', programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', type: 'dex-aggregator' },
  raydium: { name: 'Raydium', programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', type: 'amm' },
  kamino: { name: 'Kamino Finance', programId: '6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc', type: 'yield' },
  marinade: { name: 'Marinade Finance', programId: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD', type: 'liquid-staking' },
  drift: { name: 'Drift Protocol', programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', type: 'perps' },
  orca: { name: 'Orca', programId: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', type: 'amm' },
  meteora: { name: 'Meteora', programId: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', type: 'amm' }
};

// Token addresses
const TOKENS: Record<string, { symbol: string; mint: string; decimals: number }> = {
  SOL: { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  USDC: { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  JUP: { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
  BONK: { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  WIF: { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 }
};

const WHALE_THRESHOLD = 10000; // SOL

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*').end();
  }

  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  const path = req.url?.split('?')[0] || '/';
  const segments = path.split('/').filter(Boolean);
  const query = req.query;

  try {
    // GET /health or /
    if (path === '/health' || path === '/') {
      return res.json({
        status: 'healthy',
        service: 'solanascope',
        version: '0.2.0',
        features: ['protocols', 'wallets', 'network', 'quotes', 'whales', 'anomalies'],
        endpoints: [
          'GET /health',
          'GET /protocols',
          'GET /protocols/:id/health',
          'GET /network/stats',
          'GET /wallet/:address/balance',
          'GET /wallet/:address/tokens',
          'GET /wallet/:address/activity',
          'POST /analyze/wallet',
          'GET /quote?from=SOL&to=USDC&amount=1',
          'GET /whales/recent',
          'POST /detect/anomaly',
          'GET /skill.md'
        ],
        timestamp: new Date().toISOString()
      });
    }

    // GET /skill.md
    if (path === '/skill.md') {
      res.setHeader('Content-Type', 'text/markdown');
      return res.send(`---
name: solanascope
version: 0.2.0
description: Real-time Solana intelligence API for AI agents. Protocol health, wallet analysis, swap quotes, whale alerts, anomaly detection.
homepage: https://github.com/openclaw-bit/solanascope
api_base: https://solanascope.vercel.app
---

# SolanaScope

Real-time Solana intelligence for AI agents. No UI, pure APIs.

## Endpoints

### Health & Discovery
- \`GET /health\` — Service status and endpoint list
- \`GET /skill.md\` — This file (agent discovery)

### Protocol Intelligence
- \`GET /protocols\` — List all tracked protocols
- \`GET /protocols/:id/health\` — Check if protocol is active (jupiter, raydium, kamino, drift, orca, meteora)

### Network Stats
- \`GET /network/stats\` — Current slot, epoch, supply

### Wallet Analysis
- \`GET /wallet/:address/balance\` — SOL balance + whale detection
- \`GET /wallet/:address/tokens\` — All token holdings
- \`GET /wallet/:address/activity\` — Recent transaction signatures
- \`POST /analyze/wallet\` — Full analysis with risk scoring

### Trading Intelligence
- \`GET /quote?from=SOL&to=USDC&amount=1\` — Get Jupiter swap quote

### Whale & Anomaly Detection
- \`GET /whales/recent\` — Recent large transactions
- \`POST /detect/anomaly\` — Analyze wallet for suspicious patterns

## Example Usage

\`\`\`bash
# Get swap quote
curl "https://solanascope.vercel.app/quote?from=SOL&to=USDC&amount=10"

# Analyze wallet for anomalies
curl -X POST https://solanascope.vercel.app/detect/anomaly \\
  -H "Content-Type: application/json" \\
  -d '{"address": "WALLET_ADDRESS"}'
\`\`\`

## Built For
Colosseum Agent Hackathon by clawdbot-prime (Agent #584).
Agents need data, not dashboards.
`);
    }

    // GET /protocols
    if (path === '/protocols') {
      return res.json({
        protocols: Object.entries(PROTOCOLS).map(([id, p]) => ({ id, ...p })),
        count: Object.keys(PROTOCOLS).length
      });
    }

    // GET /tokens
    if (path === '/tokens') {
      return res.json({
        tokens: Object.entries(TOKENS).map(([id, t]) => ({ id, ...t })),
        count: Object.keys(TOKENS).length
      });
    }

    // GET /protocols/:id/health
    if (segments[0] === 'protocols' && segments[2] === 'health') {
      const id = segments[1];
      const protocol = PROTOCOLS[id];
      if (!protocol) return res.status(404).json({ error: `Protocol '${id}' not found` });

      const programId = new PublicKey(protocol.programId);
      const accountInfo = await connection.getAccountInfo(programId);
      
      return res.json({
        protocol: id,
        name: protocol.name,
        type: protocol.type,
        status: accountInfo ? 'active' : 'unknown',
        executable: accountInfo?.executable || false,
        checkedAt: new Date().toISOString()
      });
    }

    // GET /network/stats
    if (path === '/network/stats') {
      const [slot, epochInfo, supply, perfSamples] = await Promise.all([
        connection.getSlot(),
        connection.getEpochInfo(),
        connection.getSupply(),
        connection.getRecentPerformanceSamples(1)
      ]);

      const tps = perfSamples[0] ? Math.round(perfSamples[0].numTransactions / perfSamples[0].samplePeriodSecs) : null;

      return res.json({
        slot,
        epoch: epochInfo.epoch,
        epochProgress: (epochInfo.slotIndex / epochInfo.slotsInEpoch * 100).toFixed(2) + '%',
        totalSupply: Math.floor(supply.value.total / LAMPORTS_PER_SOL),
        circulatingSupply: Math.floor(supply.value.circulating / LAMPORTS_PER_SOL),
        estimatedTps: tps,
        timestamp: new Date().toISOString()
      });
    }

    // GET /wallet/:address/balance
    if (segments[0] === 'wallet' && segments[2] === 'balance') {
      const address = segments[1];
      const pubkey = new PublicKey(address);
      const balance = await connection.getBalance(pubkey);
      const solBalance = balance / LAMPORTS_PER_SOL;

      return res.json({
        address,
        solBalance,
        solBalanceLamports: balance,
        isWhale: solBalance >= WHALE_THRESHOLD,
        whaleThreshold: WHALE_THRESHOLD,
        timestamp: new Date().toISOString()
      });
    }

    // GET /wallet/:address/tokens
    if (segments[0] === 'wallet' && segments[2] === 'tokens') {
      const address = segments[1];
      const pubkey = new PublicKey(address);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      });

      const tokens = tokenAccounts.value
        .map(a => ({
          mint: a.account.data.parsed.info.mint,
          balance: a.account.data.parsed.info.tokenAmount.uiAmount,
          decimals: a.account.data.parsed.info.tokenAmount.decimals
        }))
        .filter(t => t.balance > 0)
        .sort((a, b) => b.balance - a.balance);

      return res.json({ address, tokens, count: tokens.length, timestamp: new Date().toISOString() });
    }

    // GET /wallet/:address/activity
    if (segments[0] === 'wallet' && segments[2] === 'activity') {
      const address = segments[1];
      const limit = Math.min(Number(query.limit) || 20, 100);
      const pubkey = new PublicKey(address);
      const signatures = await connection.getSignaturesForAddress(pubkey, { limit });

      const activity = signatures.map(sig => ({
        signature: sig.signature,
        slot: sig.slot,
        blockTime: sig.blockTime,
        success: sig.err === null,
        memo: sig.memo
      }));

      return res.json({
        address,
        transactions: activity,
        count: activity.length,
        timestamp: new Date().toISOString()
      });
    }

    // GET /quote - Jupiter quote
    if (path === '/quote') {
      const from = (query.from as string || 'SOL').toUpperCase();
      const to = (query.to as string || 'USDC').toUpperCase();
      const amount = Number(query.amount) || 1;

      const fromToken = TOKENS[from];
      const toToken = TOKENS[to];

      if (!fromToken) return res.status(400).json({ error: `Unknown token: ${from}` });
      if (!toToken) return res.status(400).json({ error: `Unknown token: ${to}` });

      const amountLamports = Math.floor(amount * Math.pow(10, fromToken.decimals));

      // Call Jupiter Quote API
      const jupiterUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${fromToken.mint}&outputMint=${toToken.mint}&amount=${amountLamports}&slippageBps=50`;
      
      const jupResponse = await fetch(jupiterUrl);
      if (!jupResponse.ok) {
        return res.status(502).json({ error: 'Jupiter API error', status: jupResponse.status });
      }

      const jupData = await jupResponse.json();
      
      const outAmount = Number(jupData.outAmount) / Math.pow(10, toToken.decimals);
      const priceImpact = Number(jupData.priceImpactPct);

      return res.json({
        from: { symbol: from, amount, mint: fromToken.mint },
        to: { symbol: to, amount: outAmount, mint: toToken.mint },
        rate: outAmount / amount,
        priceImpactPct: priceImpact,
        routePlan: jupData.routePlan?.map((r: any) => ({
          amm: r.swapInfo?.label,
          inAmount: r.swapInfo?.inAmount,
          outAmount: r.swapInfo?.outAmount
        })),
        timestamp: new Date().toISOString()
      });
    }

    // GET /whales/recent - Recent large transactions (simplified)
    if (path === '/whales/recent') {
      // For demo, we'll check a known whale address for recent activity
      const whaleAddresses = [
        '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Solana Foundation
        'GugU1tP7doLeTw9hQP51xRJyS8Da1fWxuiy2rVrnMD2m'  // Jump Trading
      ];

      const results = await Promise.all(whaleAddresses.map(async addr => {
        const pubkey = new PublicKey(addr);
        const [balance, sigs] = await Promise.all([
          connection.getBalance(pubkey),
          connection.getSignaturesForAddress(pubkey, { limit: 5 })
        ]);
        return {
          address: addr,
          solBalance: balance / LAMPORTS_PER_SOL,
          recentTxCount: sigs.length,
          lastActive: sigs[0]?.blockTime ? new Date(sigs[0].blockTime * 1000).toISOString() : null
        };
      }));

      return res.json({
        whales: results,
        threshold: WHALE_THRESHOLD,
        timestamp: new Date().toISOString()
      });
    }

    // POST /analyze/wallet
    if (path === '/analyze/wallet' && req.method === 'POST') {
      const { address } = req.body || {};
      if (!address) return res.status(400).json({ error: 'address required' });

      const pubkey = new PublicKey(address);
      const [balance, tokenAccounts, signatures] = await Promise.all([
        connection.getBalance(pubkey),
        connection.getParsedTokenAccountsByOwner(pubkey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
        }),
        connection.getSignaturesForAddress(pubkey, { limit: 20 })
      ]);

      const solBalance = balance / LAMPORTS_PER_SOL;
      const tokens = tokenAccounts.value
        .map(a => ({ mint: a.account.data.parsed.info.mint, balance: a.account.data.parsed.info.tokenAmount.uiAmount }))
        .filter(t => t.balance > 0);

      // Risk assessment
      let riskScore = 0;
      const riskFactors: string[] = [];
      
      if (solBalance < 0.1) { riskScore += 20; riskFactors.push('low_sol_balance'); }
      if (signatures.length === 0) { riskScore += 30; riskFactors.push('no_recent_activity'); }
      if (tokens.length === 0) { riskScore += 10; riskFactors.push('no_token_holdings'); }
      
      // Check for high frequency trading (many txs in short time)
      if (signatures.length >= 15) {
        const times = signatures.filter(s => s.blockTime).map(s => s.blockTime!);
        if (times.length >= 2) {
          const timeSpan = times[0] - times[times.length - 1];
          if (timeSpan < 3600) { // 15+ txs in 1 hour
            riskScore += 15;
            riskFactors.push('high_frequency_activity');
          }
        }
      }

      return res.json({
        address,
        summary: {
          solBalance,
          tokenCount: tokens.length,
          isWhale: solBalance >= WHALE_THRESHOLD,
          recentTransactions: signatures.length,
          lastActive: signatures[0]?.blockTime ? new Date(signatures[0].blockTime * 1000).toISOString() : null
        },
        tokens: tokens.slice(0, 20),
        risk: { 
          score: riskScore, 
          level: riskScore < 20 ? 'low' : riskScore < 50 ? 'medium' : 'high', 
          factors: riskFactors 
        },
        timestamp: new Date().toISOString()
      });
    }

    // POST /detect/anomaly - Anomaly detection
    if (path === '/detect/anomaly' && req.method === 'POST') {
      const { address } = req.body || {};
      if (!address) return res.status(400).json({ error: 'address required' });

      const pubkey = new PublicKey(address);
      const [balance, signatures] = await Promise.all([
        connection.getBalance(pubkey),
        connection.getSignaturesForAddress(pubkey, { limit: 50 })
      ]);

      const solBalance = balance / LAMPORTS_PER_SOL;
      const anomalies: { type: string; severity: string; description: string }[] = [];

      // Anomaly detection logic
      const successfulTxs = signatures.filter(s => s.err === null);
      const failedTxs = signatures.filter(s => s.err !== null);
      const failRate = signatures.length > 0 ? failedTxs.length / signatures.length : 0;

      if (failRate > 0.3) {
        anomalies.push({
          type: 'high_failure_rate',
          severity: 'medium',
          description: `${(failRate * 100).toFixed(1)}% of recent transactions failed`
        });
      }

      // Check for burst activity
      if (signatures.length >= 20) {
        const times = signatures.filter(s => s.blockTime).map(s => s.blockTime!);
        if (times.length >= 10) {
          const recentSpan = times[0] - times[9];
          if (recentSpan < 600) { // 10 txs in 10 minutes
            anomalies.push({
              type: 'burst_activity',
              severity: 'high',
              description: '10+ transactions in under 10 minutes - possible bot activity'
            });
          }
        }
      }

      // Whale alert
      if (solBalance >= WHALE_THRESHOLD) {
        anomalies.push({
          type: 'whale_wallet',
          severity: 'info',
          description: `Wallet holds ${solBalance.toLocaleString()} SOL (whale threshold: ${WHALE_THRESHOLD})`
        });
      }

      // Empty wallet with activity
      if (solBalance < 0.01 && signatures.length > 10) {
        anomalies.push({
          type: 'drained_wallet',
          severity: 'high',
          description: 'Active wallet with near-zero balance - possible drain'
        });
      }

      return res.json({
        address,
        solBalance,
        transactionsAnalyzed: signatures.length,
        anomalies,
        anomalyCount: anomalies.length,
        overallRisk: anomalies.some(a => a.severity === 'high') ? 'high' : 
                     anomalies.some(a => a.severity === 'medium') ? 'medium' : 'low',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(404).json({ error: 'Not found', path, availableEndpoints: '/health' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message, path });
  }
}
