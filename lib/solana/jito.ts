const JITO_BLOCK_ENGINE_URL = process.env.JITO_BLOCK_ENGINE_URL || 'https://mainnet.block-engine.jito.mainnet.solana.com/api/v1/bundles';

export async function sendJitoBundle(serializedTransactions: string[]) {
  try {
    const response = await fetch(JITO_BLOCK_ENGINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [serializedTransactions],
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Jito Bundle Submission Failed');
    }

    return { success: true, bundleId: data.result };
  } catch (error: any) {
    console.error('Jito Bundle Error:', error);
    return { success: false, error: error.message };
  }
}
