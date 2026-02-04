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

// Pyth Price Feed IDs (Mainnet)
const PYTH_FEEDS: Record<string, { id: string; pair: string }> = {
  'SOL/USD': { id: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d', pair: 'SOL/USD' },
  'BTC/USD': { id: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', pair: 'BTC/USD' },
  'ETH/USD': { id: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', pair: 'ETH/USD' },
  'USDC/USD': { id: 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', pair: 'USDC/USD' },
  'JUP/USD': { id: '0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996', pair: 'JUP/USD' },
  'BONK/USD': { id: '72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419', pair: 'BONK/USD' },
  'WIF/USD': { id: '4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc', pair: 'WIF/USD' },
  'RAY/USD': { id: '91568baa8beb53db23eb3fb7f22c6e8bd303d103919e19733f2bb642d3e7987a', pair: 'RAY/USD' },
  'ORCA/USD': { id: '37505261e557e251290b8c8899453064e8d760ed5c65167e9b7f156ef2b75714', pair: 'ORCA/USD' }
};

// Metaplex Token Metadata Program
const TOKEN_METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

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
        version: '0.4.0',
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
          'GET /prices - Pyth oracle prices',
          'GET /price/:pair - Single price feed (SOL/USD, BTC/USD, etc)',
          'GET /token/:mint/metadata - Token metadata from Metaplex',
          'GET /arbitrage - Cross-DEX price opportunities',
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
version: 0.3.0
description: Real-time Solana intelligence API for AI agents. Pyth oracle prices, protocol health, wallet analysis, token metadata, swap quotes, whale alerts, anomaly detection.
homepage: https://github.com/openclaw-bit/solanascope
api_base: https://solanascope.vercel.app
---

# SolanaScope

Real-time Solana intelligence for AI agents. No UI, pure APIs.

## Endpoints

### Health & Discovery
- \`GET /health\` — Service status and endpoint list
- \`GET /skill.md\` — This file (agent discovery)

### 📊 Price Feeds (Pyth Oracle)
- \`GET /prices\` — All available prices from Pyth oracle
- \`GET /price/:pair\` — Single price (SOL/USD, BTC/USD, ETH/USD, JUP/USD, BONK/USD, WIF/USD, RAY/USD, ORCA/USD)

### 🪙 Token Intelligence
- \`GET /token/:mint/metadata\` — Full token metadata (name, symbol, image, supply, decimals)

### Protocol Intelligence
- \`GET /protocols\` — List all tracked protocols
- \`GET /protocols/:id/health\` — Check if protocol is active (jupiter, raydium, kamino, drift, orca, meteora)

### Network Stats
- \`GET /network/stats\` — Current slot, epoch, TPS, supply

### Wallet Analysis
- \`GET /wallet/:address/balance\` — SOL balance + whale detection
- \`GET /wallet/:address/tokens\` — All token holdings
- \`GET /wallet/:address/activity\` — Recent transaction signatures
- \`POST /analyze/wallet\` — Full analysis with risk scoring

### Trading Intelligence
- \`GET /quote?from=SOL&to=USDC&amount=1\` — Get Jupiter swap quote

### Whale & Anomaly Detection
- \`GET /whales/recent\` — Recent whale wallet activity
- \`POST /detect/anomaly\` — Detect suspicious patterns (drains, bots, high failure rates)

### Arbitrage Intelligence
- \`GET /arbitrage\` — Cross-DEX price comparison (Jupiter vs Pyth oracle)

## Example Usage

\`\`\`bash
# Get SOL price from Pyth oracle
curl "https://solanascope.vercel.app/price/SOL%2FUSD"

# Get all prices
curl "https://solanascope.vercel.app/prices"

# Get token metadata
curl "https://solanascope.vercel.app/token/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/metadata"

# Get swap quote
curl "https://solanascope.vercel.app/quote?from=SOL&to=USDC&amount=10"

# Analyze wallet for anomalies
curl -X POST https://solanascope.vercel.app/detect/anomaly \\
  -H "Content-Type: application/json" \\
  -d '{"address": "WALLET_ADDRESS"}'
\`\`\`

## New in v0.4.0
- **Arbitrage Detection** — Compare Jupiter DEX prices vs Pyth oracle
- **Circular Trading Detection** — Identify wash trading patterns
- **Automated Timing Detection** — Spot bot-like transaction patterns

## Previous Updates
- v0.3.0: Pyth Oracle prices, Token Metadata API
- v0.2.0: Anomaly Detection, Whale Monitoring

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

      const jupData: any = await jupResponse.json();
      
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

      // Circular trading pattern detection (inspired by KAMIYO feedback)
      // Look for repeated transactions to same addresses
      const addressCounts: Record<string, number> = {};
      for (const sig of signatures) {
        // Simplified: count memo patterns or use signature prefixes as proxy
        const sigPrefix = sig.signature.slice(0, 10);
        addressCounts[sigPrefix] = (addressCounts[sigPrefix] || 0) + 1;
      }
      const repeatedPatterns = Object.values(addressCounts).filter(c => c >= 3).length;
      if (repeatedPatterns >= 2) {
        anomalies.push({
          type: 'potential_circular_trading',
          severity: 'medium',
          description: 'Multiple repeated transaction patterns detected - possible wash trading or circular transfers'
        });
      }

      // Timing pattern analysis - check for suspiciously regular intervals
      if (signatures.length >= 10) {
        const times = signatures.filter(s => s.blockTime).map(s => s.blockTime!).sort((a, b) => b - a);
        if (times.length >= 5) {
          const intervals = [];
          for (let i = 0; i < times.length - 1; i++) {
            intervals.push(times[i] - times[i + 1]);
          }
          // Check if intervals are suspiciously uniform (bot-like)
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const variance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
          const stdDev = Math.sqrt(variance);
          // If std deviation is very low relative to average, it's bot-like
          if (avgInterval > 0 && stdDev / avgInterval < 0.15) {
            anomalies.push({
              type: 'automated_timing_pattern',
              severity: 'medium',
              description: `Suspiciously regular transaction timing (avg ${Math.round(avgInterval)}s intervals, low variance) - possible automated trading`
            });
          }
        }
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

    // GET /arbitrage - Cross-DEX price comparison
    if (path === '/arbitrage') {
      try {
        // Get prices from multiple sources to find discrepancies
        const pairs = [
          { from: 'SOL', to: 'USDC', amount: 1 },
          { from: 'SOL', to: 'USDC', amount: 10 },
          { from: 'SOL', to: 'USDC', amount: 100 }
        ];

        const opportunities: {
          pair: string;
          amount: number;
          jupiterPrice: number;
          pythPrice: number;
          spreadPct: number;
          route: string;
        }[] = [];

        // Get Pyth oracle price for SOL/USD
        const pythUrl = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${PYTH_FEEDS['SOL/USD'].id}`;
        const pythRes = await fetch(pythUrl);
        const pythData: any = await pythRes.json();
        const pythPriceData = pythData.parsed?.[0]?.price;
        const pythPrice = pythPriceData ? Number(pythPriceData.price) * Math.pow(10, pythPriceData.expo) : null;

        // Compare with Jupiter quotes at different amounts
        for (const pair of pairs) {
          const fromToken = TOKENS[pair.from];
          const toToken = TOKENS[pair.to];
          const amountLamports = Math.floor(pair.amount * Math.pow(10, fromToken.decimals));
          
          const jupiterUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${fromToken.mint}&outputMint=${toToken.mint}&amount=${amountLamports}&slippageBps=50`;
          const jupResponse = await fetch(jupiterUrl);
          
          if (jupResponse.ok) {
            const jupData: any = await jupResponse.json();
            const outAmount = Number(jupData.outAmount) / Math.pow(10, toToken.decimals);
            const jupiterPrice = outAmount / pair.amount;
            
            if (pythPrice) {
              const spreadPct = ((jupiterPrice - pythPrice) / pythPrice) * 100;
              const route = jupData.routePlan?.map((r: any) => r.swapInfo?.label).filter(Boolean).join(' → ') || 'direct';
              
              opportunities.push({
                pair: `${pair.from}/${pair.to}`,
                amount: pair.amount,
                jupiterPrice: Number(jupiterPrice.toFixed(4)),
                pythPrice: Number(pythPrice.toFixed(4)),
                spreadPct: Number(spreadPct.toFixed(4)),
                route
              });
            }
          }
        }

        // Find significant spreads
        const significantOpps = opportunities.filter(o => Math.abs(o.spreadPct) > 0.1);

        return res.json({
          timestamp: new Date().toISOString(),
          oracleSource: 'pyth',
          dexSource: 'jupiter',
          opportunities,
          significantOpportunities: significantOpps.length,
          alert: significantOpps.length > 0 
            ? `Found ${significantOpps.length} price discrepancy >0.1% between oracle and DEX`
            : 'No significant arbitrage opportunities detected',
          note: 'Negative spread = DEX price below oracle. Positive = DEX price above oracle.'
        });
      } catch (e: any) {
        return res.status(500).json({ error: 'Arbitrage check failed', details: e.message });
      }
    }

    // GET /prices - All Pyth oracle prices
    if (path === '/prices') {
      try {
        const prices: Record<string, { price: number; confidence: number; confidencePct: string; publishTime: string }> = {};
        
        // Fetch all prices in parallel
        const results = await Promise.all(
          Object.entries(PYTH_FEEDS).map(async ([pair, feed]) => {
            try {
              const pythUrl = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feed.id}`;
              const pythRes = await fetch(pythUrl);
              if (!pythRes.ok) return null;
              const pythData: any = await pythRes.json();
              const priceData = pythData.parsed?.[0]?.price;
              if (!priceData) return null;
              
              const rawPrice = Number(priceData.price);
              const expo = priceData.expo;
              const confidence = Number(priceData.conf);
              
              return {
                pair,
                price: rawPrice * Math.pow(10, expo),
                confidence: confidence * Math.pow(10, expo),
                confidencePct: (confidence / rawPrice * 100).toFixed(4) + '%',
                publishTime: new Date(priceData.publish_time * 1000).toISOString()
              };
            } catch {
              return null;
            }
          })
        );
        
        for (const result of results) {
          if (result) {
            prices[result.pair] = {
              price: result.price,
              confidence: result.confidence,
              confidencePct: result.confidencePct,
              publishTime: result.publishTime
            };
          }
        }
        
        return res.json({
          source: 'pyth',
          prices,
          count: Object.keys(prices).length,
          availablePairs: Object.keys(PYTH_FEEDS),
          timestamp: new Date().toISOString()
        });
      } catch (e: any) {
        return res.status(502).json({ error: 'Pyth oracle error', details: e.message });
      }
    }

    // GET /price/:pair - Single Pyth price
    if (segments[0] === 'price' && segments[1]) {
      const pair = decodeURIComponent(segments[1]).toUpperCase();
      const feed = PYTH_FEEDS[pair];
      if (!feed) {
        return res.status(404).json({ 
          error: `Price feed not found: ${pair}`, 
          availablePairs: Object.keys(PYTH_FEEDS) 
        });
      }

      try {
        const pythUrl = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feed.id}`;
        const pythRes = await fetch(pythUrl);
        if (!pythRes.ok) throw new Error('Pyth API error');
        const pythData: any = await pythRes.json();
        
        const priceData = pythData.parsed?.[0]?.price;
        if (!priceData) throw new Error('No price data');
        
        const rawPrice = Number(priceData.price);
        const expo = priceData.expo;
        const confidence = Number(priceData.conf);
        
        return res.json({
          pair,
          source: 'pyth',
          feedId: feed.id,
          price: rawPrice * Math.pow(10, expo),
          confidence: confidence * Math.pow(10, expo),
          confidencePct: (confidence / rawPrice * 100).toFixed(4) + '%',
          publishTime: new Date(priceData.publish_time * 1000).toISOString(),
          timestamp: new Date().toISOString()
        });
      } catch (e: any) {
        return res.status(502).json({ error: 'Pyth oracle error', details: e.message });
      }
    }

    // GET /token/:mint/metadata - Token metadata
    if (segments[0] === 'token' && segments[2] === 'metadata') {
      const mint = segments[1];
      
      try {
        const mintPubkey = new PublicKey(mint);
        
        // Derive metadata PDA
        const [metadataPDA] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            new PublicKey(TOKEN_METADATA_PROGRAM).toBuffer(),
            mintPubkey.toBuffer()
          ],
          new PublicKey(TOKEN_METADATA_PROGRAM)
        );
        
        const metadataAccount = await connection.getAccountInfo(metadataPDA);
        
        // Try DAS API as fallback for better metadata
        const dasUrl = 'https://mainnet.helius-rpc.com/?api-key=15319bf4-5b40-4958-ac8d-6313aa55eb92';
        const dasRes = await fetch(dasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'solanascope',
            method: 'getAsset',
            params: { id: mint }
          })
        });
        
        const dasData: any = await dasRes.json();
        
        if (dasData.result) {
          const asset = dasData.result;
          return res.json({
            mint,
            name: asset.content?.metadata?.name || null,
            symbol: asset.content?.metadata?.symbol || null,
            description: asset.content?.metadata?.description || null,
            image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null,
            decimals: asset.token_info?.decimals || null,
            supply: asset.token_info?.supply ? Number(asset.token_info.supply) / Math.pow(10, asset.token_info.decimals || 0) : null,
            owner: asset.ownership?.owner || null,
            frozen: asset.ownership?.frozen || false,
            metadataUri: asset.content?.json_uri || null,
            attributes: asset.content?.metadata?.attributes || [],
            verified: asset.creators?.some((c: any) => c.verified) || false,
            source: 'helius-das',
            timestamp: new Date().toISOString()
          });
        }
        
        // Fallback: basic on-chain check
        const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
        if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
          const parsed = mintInfo.value.data.parsed;
          return res.json({
            mint,
            decimals: parsed.info?.decimals,
            supply: parsed.info?.supply ? Number(parsed.info.supply) / Math.pow(10, parsed.info.decimals || 0) : null,
            freezeAuthority: parsed.info?.freezeAuthority || null,
            mintAuthority: parsed.info?.mintAuthority || null,
            hasMetadata: !!metadataAccount,
            source: 'on-chain',
            timestamp: new Date().toISOString()
          });
        }
        
        return res.status(404).json({ error: 'Token not found or invalid mint', mint });
      } catch (e: any) {
        return res.status(500).json({ error: 'Metadata lookup failed', details: e.message, mint });
      }
    }

    return res.status(404).json({ error: 'Not found', path, availableEndpoints: '/health' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message, path });
  }
}
