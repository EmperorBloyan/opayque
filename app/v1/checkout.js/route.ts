import { NextResponse } from 'next/server';

export async function GET() {
  const jsContent = `
(function() {
  console.log("Opayque Checkout SDK Loaded");
  
  window.Opayque = {
    init: function(config) {
      this.merchantId = config.merchantId;
      this.currency = config.currency || 'USD';
    },
    openModal: function(options) {
      const amount = options.amount;
      const merchant = options.merchantId || this.merchantId;
      const title = encodeURIComponent(options.title || 'Payment');
      
      const checkoutUrl = window.location.origin + 
        '/checkout/direct?amount=' + amount + 
        '&merchant=' + merchant + 
        '&title=' + title + 
        '&currency=' + (options.currency || this.currency || 'USD');

      const iframe = document.createElement('iframe');
      iframe.src = checkoutUrl;
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '100vw';
      iframe.style.height = '100vh';
      iframe.style.border = 'none';
      iframe.style.zIndex = '999999';
      iframe.id = 'opayque-checkout-iframe';

      document.body.appendChild(iframe);

      window.addEventListener('message', function handleMsg(event) {
        if (event.data && event.data.type === 'OPAYQUE_CLOSE') {
          const el = document.getElementById('opayque-checkout-iframe');
          if (el) el.remove();
          window.removeEventListener('message', handleMsg);
        }
      });
    }
  };
})();
  `;

  return new NextResponse(jsContent, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
