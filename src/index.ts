/**
 * SolanaScope - Real-time Solana Intelligence API for Agents
 * Built by clawdbot-prime for the Colosseum Agent Hackathon
 */

import express from 'express';
import cors from 'cors';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const app = express();
app.use(cors());
app.use(express.json());

// Solana connection - use Helius or public RPC
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

// Known protocol addresses
const PROTOCOLS = {
  jupiter: {
    name: 'Jupiter',
    programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    type: 'dex-aggregator',
    website: 'https://jup.ag'
  },
  raydium: {
    name: 'Raydium',
    programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    type: 'amm',
    website: 'https://raydium.io'
  },
  kamino: {
    name: 'Kamino Finance',
    programId: '6LtLpnUFNByNXLyCoK9wA2MykKAmQNZKBdY8s47dehDc',
    type: 'yield',
    website: 'https://kamino.finance'
  },
  marinade: {
    name: 'Marinade Finance',
    programId: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
    type: 'liquid-staking',
    website: 'https://marinade.finance'
  },
  drift: {
    name: 'Drift Protocol',
    programId: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
    type: 'perps',
    website: 'https://drift.trade'
  }
};

// Whale threshold in SOL
const WHALE_THRESHOLD = 10000;

// ============= API ENDPOINTS =============

/**
 * GET /health
 * Service health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'solanascope',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    rpcEndpoint: RPC_URL.includes('helius') ? 'helius' : 'public'
  });
});

/**
 * GET /protocols
 * List all tracked protocols with metadata
 */
app.get('/protocols', (req, res) => {
  res.json({
    protocols: Object.entries(PROTOCOLS).map(([id, proto]) => ({
      id,
      ...proto
    })),
    count: Object.keys(PROTOCOLS).length
  });
});

/**
 * GET /protocols/:id/health
 * Check protocol health by examining program account
 */
app.get('/protocols/:id/health', async (req, res) => {
  const { id } = req.params;
  const protocol = PROTOCOLS[id as keyof typeof PROTOCOLS];
  
  if (!protocol) {
    return res.status(404).json({ error: `Protocol '${id}' not found` });
  }

  try {
    const programId = new PublicKey(protocol.programId);
    const accountInfo = await connection.getAccountInfo(programId);
    
    res.json({
      protocol: id,
      name: protocol.name,
      status: accountInfo ? 'active' : 'unknown',
      programExists: !!accountInfo,
      executable: accountInfo?.executable || false,
      owner: accountInfo?.owner.toBase58() || null,
      checkedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      protocol: id,
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /network/stats
 * Get current Solana network statistics
 */
app.get('/network/stats', async (req, res) => {
  try {
    const [slot, blockHeight, epochInfo, supply] = await Promise.all([
      connection.getSlot(),
      connection.getBlockHeight(),
      connection.getEpochInfo(),
      connection.getSupply()
    ]);

    res.json({
      slot,
      blockHeight,
      epoch: epochInfo.epoch,
      slotIndex: epochInfo.slotIndex,
      slotsInEpoch: epochInfo.slotsInEpoch,
      epochProgress: (epochInfo.slotIndex / epochInfo.slotsInEpoch * 100).toFixed(2) + '%',
      totalSupply: supply.value.total / LAMPORTS_PER_SOL,
      circulatingSupply: supply.value.circulating / LAMPORTS_PER_SOL,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /wallet/:address/balance
 * Get wallet SOL balance and token count
 */
app.get('/wallet/:address/balance', async (req, res) => {
  const { address } = req.params;
  
  try {
    const pubkey = new PublicKey(address);
    const [balance, tokenAccounts] = await Promise.all([
      connection.getBalance(pubkey),
      connection.getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      })
    ]);

    const solBalance = balance / LAMPORTS_PER_SOL;
    const isWhale = solBalance >= WHALE_THRESHOLD;

    res.json({
      address,
      solBalance,
      solBalanceLamports: balance,
      tokenAccountCount: tokenAccounts.value.length,
      isWhale,
      whaleThreshold: WHALE_THRESHOLD,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /wallet/:address/tokens
 * Get all token holdings for a wallet
 */
app.get('/wallet/:address/tokens', async (req, res) => {
  const { address } = req.params;
  
  try {
    const pubkey = new PublicKey(address);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    });

    const tokens = tokenAccounts.value.map(account => {
      const info = account.account.data.parsed.info;
      return {
        mint: info.mint,
        balance: info.tokenAmount.uiAmount,
        decimals: info.tokenAmount.decimals,
        account: account.pubkey.toBase58()
      };
    }).filter(t => t.balance > 0);

    res.json({
      address,
      tokens,
      count: tokens.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /tx/:signature
 * Get transaction details
 */
app.get('/tx/:signature', async (req, res) => {
  const { signature } = req.params;
  
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      success: tx.meta?.err === null,
      fee: tx.meta?.fee,
      computeUnitsConsumed: tx.meta?.computeUnitsConsumed,
      accounts: tx.transaction.message.accountKeys.map(k => 
        typeof k === 'string' ? k : k.pubkey.toBase58()
      ),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /analyze/wallet
 * Comprehensive wallet analysis for agents
 */
app.post('/analyze/wallet', async (req, res) => {
  const { address } = req.body;
  
  if (!address) {
    return res.status(400).json({ error: 'address required in body' });
  }

  try {
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
      .map(a => ({
        mint: a.account.data.parsed.info.mint,
        balance: a.account.data.parsed.info.tokenAmount.uiAmount
      }))
      .filter(t => t.balance > 0);

    // Calculate activity metrics
    const recentTxCount = signatures.length;
    const lastActive = signatures[0]?.blockTime 
      ? new Date(signatures[0].blockTime * 1000).toISOString()
      : null;

    // Risk assessment
    let riskScore = 0;
    let riskFactors: string[] = [];
    
    if (solBalance < 0.1) {
      riskScore += 20;
      riskFactors.push('low_sol_balance');
    }
    if (recentTxCount === 0) {
      riskScore += 30;
      riskFactors.push('no_recent_activity');
    }
    if (tokens.length === 0) {
      riskScore += 10;
      riskFactors.push('no_token_holdings');
    }

    res.json({
      address,
      summary: {
        solBalance,
        tokenCount: tokens.length,
        isWhale: solBalance >= WHALE_THRESHOLD,
        recentTransactions: recentTxCount,
        lastActive
      },
      tokens: tokens.slice(0, 20), // Top 20 tokens
      risk: {
        score: riskScore,
        level: riskScore < 20 ? 'low' : riskScore < 50 ? 'medium' : 'high',
        factors: riskFactors
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /skill.md
 * Machine-readable skill file for agent discovery
 */
app.get('/skill.md', (req, res) => {
  res.type('text/markdown').send(`---
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
- GET /tx/:signature — Transaction details
- POST /analyze/wallet — Comprehensive wallet analysis

## Usage

\`\`\`bash
# Check service health
curl https://solanascope.vercel.app/health

# Analyze a wallet
curl -X POST https://solanascope.vercel.app/analyze/wallet \\
  -H "Content-Type: application/json" \\
  -d '{"address": "YOUR_WALLET_ADDRESS"}'
\`\`\`

## Built for

The Colosseum Agent Hackathon by clawdbot-prime (Agent #584).
`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SolanaScope API running on port ${PORT}`);
  console.log(`RPC: ${RPC_URL}`);
});

export default app;
