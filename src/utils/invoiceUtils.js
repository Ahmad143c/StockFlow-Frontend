// utility for generating invoice HTML used across various components

// Helper: split product name into 2 lines (first 4 words on line 1, rest on line 2)
function splitProductName(name) {
  if (!name) return 'Item';
  const words = name.trim().split(/\s+/);
  if (words.length <= 4) return name;
  const line1 = words.slice(0, 4).join(' ');
  const line2 = words.slice(4).join(' ');
  return `<span style="display:block;line-height:1.4">${line1}</span><span style="display:block;line-height:1.4">${line2}</span>`;
}

export function generateInvoiceHTML(invoice, products = []) {
  const itemsHaveDiscount = (invoice.items || []).some(i => Number(i.discount) > 0);

  const refundQtyMap = new Map();
  const refundAmtMap = new Map();
  (invoice.refunds || []).forEach(r => {
    (r.items || []).forEach(it => {
      const key = String(it.productId || it.SKU || it._id || '');
      const qty = Number(it.quantity) || 0;
      const price = Number(it.perPiecePrice || 0);
      refundQtyMap.set(key, (refundQtyMap.get(key) || 0) + qty);
      refundAmtMap.set(key, (refundAmtMap.get(key) || 0) + qty * price);
    });
  });

  let netAmount;
  if (invoice.netAmount !== undefined && invoice.netAmount !== null) {
    netAmount = Number(invoice.netAmount) || 0;
  } else {
    netAmount = (invoice.items || []).reduce((s, i) => {
      const key = String(i.productId || i.SKU || i._id || '');
      const origQty = Number(i.quantity) || 0;
      const refundedQty = Number(refundQtyMap.get(key) || 0);
      const usedQty = Math.max(0, origQty - refundedQty);
      return s + ((Number(i.perPiecePrice) || 0) * usedQty - (Number(i.discount) || 0));
    }, 0);
  }

  if (invoice.discountAmount && Number(invoice.discountAmount) > 0) {
    netAmount -= Number(invoice.discountAmount);
  }

  const totalWithoutDiscount = (invoice.items || []).reduce((s, i) => {
    const key = String(i.productId || i.SKU || i._id || '');
    const origQty = Number(i.quantity) || 0;
    const refundedQty = Number(refundQtyMap.get(key) || 0);
    const usedQty = Math.max(0, origQty - refundedQty);
    return s + ((Number(i.perPiecePrice) || 0) * usedQty);
  }, 0);

  const hasRefunds = (invoice.refunds || []).length > 0;

  const warrantyForItem = (i) => {
    let warrantyString = 'No warranty';
    const prod = Array.isArray(products)
      ? products.find(p => p._id === (i.productId || i._id))
      : products[i.productId || i._id];
    const months = prod ? Number(prod.warrantyMonths || 0) : 0;
    if (months > 0) {
      const saleDate = new Date(invoice.createdAt || invoice.date || Date.now());
      const warrantyUntil = new Date(saleDate);
      warrantyUntil.setMonth(warrantyUntil.getMonth() + months);
      const now = new Date();
      warrantyString = now <= warrantyUntil
        ? warrantyUntil.toLocaleDateString()
        : 'Expired';
    }
    return warrantyString;
  };

  return `
    <html>
      <head>
        <title>Invoice #${(invoice._id || '').toString().slice(-6)}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }

          /* FIX 1: Screen preview - proper centering without overflow */
          html {
            background: #e8e8e8;
            display: flex;
            justify-content: center;
            min-height: 100vh;
          }

          body {
            background: #e8e8e8;
            display: flex;
            justify-content: center;
            padding: 16px 12px;
            margin: 0;
            width: 100%;
          }

          /* Receipt card - fixed 272px (≈72mm) */
          .receipt {
            font-family: 'Times New Roman', Times, serif;
            font-size: 18px;
            line-height: 1.45;
            color: #000;
            background: #fff;
            width: 272px;
            padding: 8px 6px 12px;
            box-shadow: 0 1px 8px rgba(0,0,0,0.15);
          }

          .header {
            text-align: center;
            padding-bottom: 3mm;
            margin-bottom: 3mm;
            border-bottom: 2px dashed #000;
          }
          .header h1 { font-size: 20px; font-weight: bold; margin-bottom: 2px; }
          .header p { font-size: 16px; margin: 1px 0; }

          .invoice-info { margin: 2mm 0; }
          .invoice-info div { font-size: 16px; margin: 1.5mm 0; }
          .invoice-info strong { font-weight: bold; }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 2mm 0;
          }
          th {
            font-size: 16px;
            font-weight: bold;
            padding: 2mm 1mm;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            text-align: left;
          }
          td {
            font-size: 16px;
            padding: 2mm 1mm;
            border-bottom: 1px dashed #888;
            vertical-align: top;
          }
          tr:last-child td { border-bottom: 2px solid #000; }
          .text-right { text-align: right !important; }

          .total-row td {
            font-size: 17px;
            font-weight: bold;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 2mm 1mm;
          }

          .payment-info {
            margin-top: 2mm;
            padding-top: 2mm;
            border-top: 2px dashed #000;
          }
          .payment-info .row {
            display: flex;
            justify-content: space-between;
            font-size: 16px;
            margin: 1.5mm 0;
          }
          .payment-info .row.bold {
            font-size: 17px;
            font-weight: bold;
          }

          .footer {
            text-align: center;
            margin-top: 3mm;
            padding: 2mm 0 4mm 0;
            border-top: 2px dashed #000;
            font-size: 16px;
            font-weight: bold;
          }

          /* FIX 2: PRINT - 80mm thermal printer optimization */
          @media print {
            @page {
              size: 80mm auto;
              margin: 2mm 2mm;
            }

            html, body {
              background: white;
              width: 100%;
              margin: 0;
              padding: 0;
              display: block;
            }

            body {
              padding: 0;
            }

            .receipt {
              width: 100% !important;
              max-width: 100%;
              padding: 4px 3px !important;
              margin: 0 !important;
              box-shadow: none !important;
              /* NO zoom - let printer handle actual size */
            }

            /* Keep consistent font sizes */
            .header h1 { font-size: 18px; }
            .header p { font-size: 14px; }
            .invoice-info div { font-size: 14px; }
            th, td { font-size: 14px; }
            .total-row td { font-size: 15px; }
            .payment-info .row { font-size: 14px; }
            .payment-info .row.bold { font-size: 15px; }
            .footer { font-size: 14px; }

            /* Prevent page breaks inside elements - this fixes height issue */
            tr, .payment-info, .footer, .header, .invoice-info {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            
            /* Ensure no extra blank pages */
            body, html {
              height: auto;
              min-height: auto;
            }
          }

          /* Screen zoom adjustment - prevents horizontal scroll */
          @media screen and (max-width: 320px) {
            .receipt {
              transform: scale(0.95);
              transform-origin: center top;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt" id="receipt">
          <!-- HEADER -->
          <div class="header">
            <h1>New Adil Electric Concern</h1>
            <p>4-B, Jamiat Center, Shah Alam Market</p>
            <p>Lahore, Pakistan</p>
            <p>Ph: 0333-4263733</p>
            <p>info@adilelectric.com | e-roshni.com</p>
          </div>

          <!-- INVOICE META -->
          <div class="invoice-info">
            <div><strong>Invoice #:</strong> ${(invoice._id || '').toString().slice(-6)}</div>
            <div><strong>Date:</strong> ${new Date(invoice.createdAt || invoice.date).toLocaleDateString()} &nbsp;<strong>Time:</strong> ${new Date(invoice.createdAt || invoice.date).toLocaleTimeString()}</div>
            <div><strong>Customer:</strong> ${invoice.customerName || '-'}</div>
            <div><strong>Contact:</strong> ${invoice.customerContact || '-'}</div>
            <div><strong>Payment:</strong> ${invoice.paymentMethod || '-'} &nbsp;<strong>Status:</strong> ${invoice.paymentStatus || '-'}${invoice.paymentStatus === 'Credit' && invoice.dueDate ? `<br><strong>Due:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}` : ''}</div>
          </div>

          <!-- ITEMS TABLE -->
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Rate</th>
                ${hasRefunds ? '<th class="text-right">Refund</th>' : ''}
                <th class="text-right">Wrnty</th>
                ${itemsHaveDiscount ? '<th class="text-right">Disc</th>' : ''}
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.items || []).map((i, idx) => {
                const warrantyString = warrantyForItem(i);
                const key = String(i.productId || i.SKU || i._id || '');
                const origQty      = Number(i.quantity) || 0;
                const refundedQty  = Number(refundQtyMap.get(key) || 0);
                const refundAmt    = Number(refundAmtMap.get(key) || 0);
                const remainingQty = Math.max(0, origQty - refundedQty);
                const itemSubtotal = ((Number(i.perPiecePrice) || 0) * remainingQty) - (Number(i.discount) || 0);
                return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${splitProductName(i.productName)}</td>
                  <td class="text-right">${origQty}${refundedQty ? `<br>(-${refundedQty})` : ''}</td>
                  <td class="text-right">${Number(i.perPiecePrice || 0).toLocaleString()}</td>
                  ${hasRefunds ? `<td class="text-right">${refundAmt ? 'Rs.' + refundAmt.toLocaleString() : '-'}</td>` : ''}
                  <td class="text-right">${warrantyString}</td>
                  ${itemsHaveDiscount ? `<td class="text-right">${i.discount || 0}</td>` : ''}
                  <td class="text-right">${Number(itemSubtotal).toLocaleString()}</td>
                </tr>`;
              }).join('')}

              <tr class="total-row">
                <td colspan="${5 + (hasRefunds ? 1 : 0) + (itemsHaveDiscount ? 1 : 0)}"><strong>Total</strong></td>
                <td class="text-right"><strong>Rs.${Number(totalWithoutDiscount).toLocaleString()}</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- PAYMENT SUMMARY -->
          <div class="payment-info">
            ${(() => {
              const paidVal = invoice.paymentMethod === 'Cash'
                ? (invoice.cashAmount || invoice.paidAmount || 0)
                : (invoice.paidAmount || 0);
              const changeVal   = invoice.changeAmount || 0;
              const discountVal = invoice.discountAmount || 0;
              const grossTotal  = netAmount + discountVal;
              const totalRefundAmount = (invoice.refunds || []).reduce(
                (s, r) => s + (Number(r.totalRefundAmount) || 0), 0
              );

              let extra = '';
              if (invoice.paymentStatus === 'Partial Paid') {
                const remaining = Math.max(0, netAmount - (invoice.paidAmount || 0));
                const parts = Array.isArray(invoice.paymentParts) && invoice.paymentParts.length > 0
                  ? invoice.paymentParts
                  : [{ amount: paidVal, date: new Date(invoice.createdAt || invoice.date).toISOString().split('T')[0] }];
                const partsHtml = parts.map((p, i2) =>
                  `<div class="row"><span>Payment ${i2 + 1} (${p.date ? new Date(p.date).toLocaleDateString() : '-'})</span><span>Rs. ${Number(p.amount || 0).toLocaleString()}</span></div>`
                ).join('');
                extra = `${partsHtml}<div class="row bold"><span>Remaining</span><span>Rs. ${remaining.toLocaleString()}</span></div>`;
              } else if (invoice.paymentStatus === 'Credit') {
                extra = `<div class="row"><span>Due Date</span><span>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}</span></div>`;
              }

              return `
                ${discountVal > 0 ? `<div class="row"><span>Discount</span><span>Rs. ${Number(discountVal).toLocaleString()}</span></div>` : ''}
                <div class="row bold"><span>Total Amount</span><span>Rs. ${Number(grossTotal).toLocaleString()}</span></div>
                <div class="row bold"><span>Paid Amount</span><span>Rs. ${Number(paidVal).toLocaleString()}</span></div>
                ${totalRefundAmount > 0 ? `<div class="row"><span>Refunded</span><span>Rs. ${totalRefundAmount.toLocaleString()}</span></div>` : ''}
                <div class="row"><span>Change</span><span>Rs. ${Number(changeVal).toLocaleString()}</span></div>
                ${extra}
              `;
            })()}
          </div>

          <!-- FOOTER -->
          <div class="footer">*** Thank you for your business! ***</div>
        </div>
      </body>
    </html>
  `;
}