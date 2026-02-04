/**
 * SolanaScope - Vercel Serverless API
 * Real-time Solana Intelligence for AI Agents
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

const PROTOCOLS: Record<string, { name: string; programId: string; type: string }> = {
  jupiter: { name: 'Jupiter', programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', type: 'dex-aggregator' },
  raydium: { name: 'Raydium', programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', type: 'amm' },
  kamino: { name: 'Kamino Finance', programId: '6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc', type: 'yield' },
  marinade: { name: 'Marinade Finance', programId: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD', type: 'liquid-staking' },
  drift: { name: 'Drift Protocol', programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', type: 'perps' }
};

const WHALE_THRESHOLD = 10000;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*').end();
  }

  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  const path = req.url?.split('?')[0] || '/';
  const segments = path.split('/').filter(Boolean);

  try {
    // GET /health
    if (path === '/health' || path === '/') {
      return res.json({
        status: 'healthy',
        service: 'solanascope',
        version: '0.1.0',
        endpoints: ['/health', '/protocols', '/protocols/:id/health', '/network/stats', '/wallet/:address/balance', '/wallet/:address/tokens', '/analyze/wallet', '/skill.md'],
        timestamp: new Date().toISOString()
      });
    }

    // GET /skill.md
    if (path === '/skill.md') {
      res.setHeader('Content-Type', 'text/markdown');
      return res.send(`---
name: solanascope
version: 0.1.0
description: Real-time Solana intelligence API for AI agents
homepage: https://github.com/openclaw-bit/solanascope
---

# SolanaScope

Real-time Solana intelligence for AI agents.

## Endpoints

- GET /health — Service health check
- GET /protocols — List tracked protocols  
- GET /protocols/:id/health — Check protocol status
- GET /network/stats — Solana network statistics
- GET /wallet/:address/balance — Wallet SOL balance
- GET /wallet/:address/tokens — Wallet token holdings
- POST /analyze/wallet — Comprehensive wallet analysis

## Usage

\`\`\`bash
curl https://solanascope.vercel.app/health
curl https://solanascope.vercel.app/wallet/YOUR_ADDRESS/balance
curl -X POST https://solanascope.vercel.app/analyze/wallet -H "Content-Type: application/json" -d '{"address":"WALLET"}'
\`\`\`

Built for the Colosseum Agent Hackathon by clawdbot-prime.
`);
    }

    // GET /protocols
    if (path === '/protocols') {
      return res.json({
        protocols: Object.entries(PROTOCOLS).map(([id, p]) => ({ id, ...p })),
        count: Object.keys(PROTOCOLS).length
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
        status: accountInfo ? 'active' : 'unknown',
        executable: accountInfo?.executable || false,
        checkedAt: new Date().toISOString()
      });
    }

    // GET /network/stats
    if (path === '/network/stats') {
      const [slot, epochInfo, supply] = await Promise.all([
        connection.getSlot(),
        connection.getEpochInfo(),
        connection.getSupply()
      ]);

      return res.json({
        slot,
        epoch: epochInfo.epoch,
        epochProgress: (epochInfo.slotIndex / epochInfo.slotsInEpoch * 100).toFixed(2) + '%',
        totalSupply: Math.floor(supply.value.total / LAMPORTS_PER_SOL),
        circulatingSupply: Math.floor(supply.value.circulating / LAMPORTS_PER_SOL),
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
        isWhale: solBalance >= WHALE_THRESHOLD,
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
        .filter(t => t.balance > 0);

      return res.json({ address, tokens, count: tokens.length, timestamp: new Date().toISOString() });
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
        connection.getSignaturesForAddress(pubkey, { limit: 10 })
      ]);

      const solBalance = balance / LAMPORTS_PER_SOL;
      const tokens = tokenAccounts.value
        .map(a => ({ mint: a.account.data.parsed.info.mint, balance: a.account.data.parsed.info.tokenAmount.uiAmount }))
        .filter(t => t.balance > 0);

      let riskScore = 0;
      const riskFactors: string[] = [];
      if (solBalance < 0.1) { riskScore += 20; riskFactors.push('low_sol_balance'); }
      if (signatures.length === 0) { riskScore += 30; riskFactors.push('no_recent_activity'); }

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
        risk: { score: riskScore, level: riskScore < 20 ? 'low' : riskScore < 50 ? 'medium' : 'high', factors: riskFactors },
        timestamp: new Date().toISOString()
      });
    }

    return res.status(404).json({ error: 'Not found', path });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
