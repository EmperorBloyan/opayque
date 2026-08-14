'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, Shield, ArrowRight, CheckCircle2, Loader2, AlertTriangle, Lock } from 'lucide-react';
import { useCurrency } from '@/lib/context/CurrencyContext';

interface OpayqueCheckoutProps {
  apiKey: string;
  orderId: string;
  amountUsdc: number;
  merchantWallet: string;
  onSuccess?: (txHash: string) => void;
  onClose?: () => void;
}

export default function OpayqueCheckout({
  apiKey,
  orderId,
  amountUsdc,
  merchantWallet,
  onSuccess,
  onClose
}: OpayqueCheckoutProps) {
  const [step, setStep] = useState<'idle' | 'initializing' | 'compiling' | 'signing' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [txHash, setTxHash] = useState('');
  
  // Hook into Currency Conversion Context
  const { currency, convert } = useCurrency();
  const fiatEquivalent = convert(amountUsdc);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString().split('T')[1].substring(0, 8)}] ${message}`]);
  };

  const executePaymentFlow = async () => {
    try {
      setLogs([]);
      setStep('initializing');
      addLog('> INITIATING_SECURE_SESSION...');

      // 1. Generate Payment Intent Session
      const sessionRes = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          order_id: orderId,
          amount_fiat: amountUsdc,
          currency: currency
        })
      });

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(sessionData.message || 'Failed to establish session.');
      addLog(`> SESSION_ESTABLISHED: ${sessionData.data.session_id}`);

      setStep('compiling');
      addLog('> COMPILING_ATOMIC_PAYLOAD...');

      // 2. Compile Solana Transaction Instructions
      const txRes = await fetch('/api/v1/checkout/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionData.data.session_id,
          customer_wallet_address: 'CustomerDummyWalletPublicAddress111111', 
          merchant_wallet_address: merchantWallet,
          amount_usdc: amountUsdc
        })
      });

      const txData = await txRes.json();
      if (!txRes.ok) throw new Error(txData.message || 'Failed to compile transaction.');
      addLog('> ENFORCING_FEE_SPLIT: 99.5% / 0.5%');
      addLog('> PAYLOAD_COMPILED. AWAITING_SIGNATURE...');

      setStep('signing');

      // 3. Simulate Wallet Signature & Network Settlement
      setTimeout(() => {
        const mockHash = `5Kj${Math.random().toString(36).substring(2, 12)}OpayqueTx99x`;
        setTxHash(mockHash);
        addLog(`> NETWORK_CONFIRMED: ${mockHash.substring(0, 16)}...`);
        setStep('success');
        if (onSuccess) onSuccess(mockHash);
      }, 2500);

    } catch (err: any) {
      setStep('error');
      addLog(`> ERROR: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050508]/90 backdrop-blur-md flex items-center justify-center p-4 z-50 font-mono fade-in">
      <div className="bg-[#0a0d14] border border-[#1f293d] rounded-xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col">
        {/* Dynamic Top Border */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ffcc] to-transparent ${step === 'error' ? 'via-[#ff5f56]' : ''}`}></div>
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[#1f293d] bg-[#050508]/50">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-[#00ffcc]/10 rounded-md border border-[#00ffcc]/20">
              <Lock className="w-4 h-4 text-[#00ffcc]" />
            </div>
            <span className="text-xs font-bold text-white tracking-widest uppercase">Opayque_Checkout</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">✕</button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Order Summary */}
          <div className="bg-[#050508] border border-[#1f293d] rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center border-b border-[#1f293d]/50 pb-2">
              <span className="text-[10px] text-gray-500 tracking-widest">ORDER_REF</span>
              <span className="text-xs text-white font-bold">{orderId}</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#1f293d]/50 pb-2">
              <span className="text-[10px] text-gray-500 tracking-widest">NETWORK</span>
              <span className="text-[10px] text-[#ffb86c] px-2 py-0.5 bg-[#ffb86c]/10 rounded border border-[#ffb86c]/20">SOLANA_MAINNET</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-[10px] text-gray-500 tracking-widest">AMOUNT_DUE</span>
              <div className="text-right">
                <span className="text-lg text-[#00ffcc] font-light block">{amountUsdc.toFixed(2)} USDC</span>
                {currency !== 'USD' && (
                  <span className="text-[10px] text-gray-400 tracking-wider">≈ {fiatEquivalent.formatted}</span>
                )}
              </div>
            </div>
          </div>

          {/* Terminal Output Logs (Visible during processing) */}
          {(step !== 'idle') && (
            <div className="bg-[#050508] border border-[#1f293d] rounded-lg p-3 h-24 overflow-y-auto font-mono text-[9px] text-gray-400 space-y-1">
              {logs.map((log, i) => (
                <div key={i} className={log.includes('ERROR') ? 'text-[#ff5f56]' : 'text-gray-400'}>
                  {log}
                </div>
              ))}
              {(step === 'initializing' || step === 'compiling' || step === 'signing') && (
                <div className="flex items-center space-x-2 text-[#00ffcc] mt-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="animate-pulse">PROCESSING_TX...</span>
                </div>
              )}
            </div>
          )}

          {/* Action Area */}
          {step === 'idle' && (
            <button
              onClick={executePaymentFlow}
              className="w-full bg-[#00ffcc] text-black font-bold py-3.5 rounded-md hover:bg-[#00e6b8] transition-all text-xs tracking-widest flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(0,255,204,0.2)]"
            >
              <span>CONNECT_WALLET_&_PAY</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {step === 'success' && (
            <div className="bg-[#27c93f]/10 border border-[#27c93f]/20 rounded-lg p-4 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-[#27c93f] mx-auto" />
              <p className="text-xs font-bold text-[#27c93f] tracking-widest">SETTLEMENT_COMPLETE</p>
              <button
                onClick={onClose}
                className="w-full mt-4 bg-[#0a0d14] border border-[#1f293d] text-white py-2.5 rounded-md text-[10px] tracking-widest hover:border-[#27c93f] transition-all"
              >
                RETURN_TO_MERCHANT
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="bg-[#ff5f56]/10 border border-[#ff5f56]/20 rounded-lg p-4 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-[#ff5f56] mx-auto" />
              <p className="text-xs font-bold text-[#ff5f56] tracking-widest">TRANSACTION_FAILED</p>
              <button
                onClick={() => setStep('idle')}
                className="w-full mt-4 bg-[#0a0d14] border border-[#1f293d] text-white py-2.5 rounded-md text-[10px] tracking-widest hover:border-[#ff5f56] transition-all"
              >
                RETRY_AUTHORIZATION
              </button>
            </div>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
      `}} />
    </div>
  );
}
