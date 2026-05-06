// utility for generating invoice HTML used across various components

// Helper: split product name into 2 lines (first 4 words on line 1, rest on line 2)
function splitProductName(name) {
  if (!name) return 'Item';
  const words = name.trim().split(/\s+/);
  if (words.length <= 4) return name;
  const line1 = words.slice(0, 4).join(' ');
  const line2 = words.slice(4).join(' ');
  return `<span style="display:block;line-height:1.3">${line1}</span><span style="display:block;line-height:1.3">${line2}</span>`;
}

export function generateInvoiceHTML(invoice, products = []) {
  const itemsHaveDiscount = (invoice.items || []).some(i => Number(i.discount) > 0);
  // build refund maps keyed by productId/SKU to total refunded qty and amount
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

  // net amount should come from invoice if available (backend updates it), else compute from remaining quantities
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

  // Subtract global discount if present
  if (invoice.discountAmount && Number(invoice.discountAmount) > 0) {
    netAmount -= Number(invoice.discountAmount);
  }

  // Calculate total selling amount without any discounts
  const totalWithoutDiscount = (invoice.items || []).reduce((s, i) => {
    const key = String(i.productId || i.SKU || i._id || '');
    const origQty = Number(i.quantity) || 0;
    const refundedQty = Number(refundQtyMap.get(key) || 0);
    const usedQty = Math.max(0, origQty - refundedQty);
    return s + ((Number(i.perPiecePrice) || 0) * usedQty);
  }, 0);

  // check if invoice has any refunds at all
  const hasRefunds = (invoice.refunds || []).length > 0;

  // helper to compute warranty string for an item
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
      if (now <= warrantyUntil) {
        warrantyString = warrantyUntil.toLocaleDateString();
      } else {
        warrantyString = 'Expired';
      }
    }
    return warrantyString;
  };

  return `
      <html>
        <head>
          <title>Invoice #${(invoice._id || '').toString().slice(-6)}</title>
          <style>
            /* ── Reset ───────────────────────────────────────────── */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            /* ── Screen preview ──────────────────────────────────── */
            html, body {
              background: #f0f0f0;
            }

            body {
              font-family: 'Courier New', monospace;
              /* 
                72mm usable out of 80mm roll
                (80mm - 4mm left margin - 4mm right margin)
              */
              width: 72mm;
              margin: 0 auto;
              padding: 4mm 0;
              color: #333;
              background: white;
            }

            /* ── Header ──────────────────────────────────────────── */
            .header {
              text-align: center;
              margin-bottom: 3mm;
              border-bottom: 1px dashed #000;
              padding-bottom: 3mm;
            }

            .header h1 {
              font-size: 11pt;
              font-weight: bold;
              margin-bottom: 1mm;
            }

            .header p {
              font-size: 7pt;
              margin: 0.5mm 0;
            }

            /* ── Invoice meta ────────────────────────────────────── */
            .invoice-info {
              margin: 2mm 0;
              font-size: 7.5pt;
            }

            .invoice-info div {
              margin: 0.8mm 0;
            }

            .invoice-info strong {
              font-weight: bold;
            }

            /* ── Items table ─────────────────────────────────────── */
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 2mm 0;
            }

            th {
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
              padding: 1.5mm 1mm;
              text-align: left;
              font-weight: bold;
              font-size: 7pt;
            }

            td {
              padding: 1.5mm 1mm;
              border-bottom: 1px dotted #ccc;
              font-size: 7pt;
              word-break: break-word;
            }

            tr:last-child td {
              border-bottom: 1px solid #000;
            }

            .text-right {
              text-align: right !important;
            }

            .total-row {
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
              font-weight: bold;
            }

            .total-amount {
              font-weight: bold;
              font-size: 8pt;
            }

            /* ── Payment summary ─────────────────────────────────── */
            .payment-info {
              margin-top: 2mm;
              border-top: 1px dashed #000;
              padding-top: 2mm;
            }

            .payment-info div {
              margin: 1mm 0;
              font-size: 7.5pt;
              display: flex;
              justify-content: space-between;
            }

            /* ── Footer ──────────────────────────────────────────── */
            .footer {
              text-align: center;
              margin-top: 4mm;
              padding-top: 2mm;
              border-top: 1px dashed #000;
              font-size: 8pt;
              font-weight: bold;
            }

            /* ── PRINT — BlackCopper BC-88AC 80mm Thermal ────────── */
            @media print {
              @page {
                /*
                  80mm wide roll; auto height so the page grows with content
                  and never creates a second blank page.
                  Margins: 2mm top/bottom, 4mm left/right (inside the printable
                  area the driver already clips the outer ~4mm per side).
                */
                size: 80mm auto;
                margin: 2mm 4mm;
              }

              html, body {
                background: white;
              }

              body {
                /*
                  Use 100% so it fills the @page printable width exactly.
                  Do NOT set a fixed mm width here — let the @page margin
                  control the gutter so content never gets clipped.
                */
                width: 100%;
                margin: 0;
                padding: 0;
                font-size: 8pt;
              }

              /* Prevent orphaned rows / cut-off content */
              tr {
                page-break-inside: avoid;
              }

              .footer {
                page-break-after: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>New Adil Electric Concern</h1>
            <p>4-B, Jamiat Center, Shah Alam Market</p>
            <p>Lahore, Pakistan</p>
            <p>Phone: 0333-4263733 | Email: info@adilelectric.com</p>
            <p>Website: e-roshni.com</p>
          </div>

          <div class="invoice-info">
            <div><strong>Invoice #</strong>${(invoice._id || '').toString().slice(-6)}</div>
            <div><strong>Date:</strong> ${new Date(invoice.createdAt || invoice.date).toLocaleDateString()} &nbsp;<strong>Time:</strong> ${new Date(invoice.createdAt || invoice.date).toLocaleTimeString()}</div>
            <div><strong>Customer:</strong> ${invoice.customerName || '-'} | <strong>Contact:</strong> ${invoice.customerContact || '-'}</div>
            <div><strong>Payment:</strong> ${invoice.paymentMethod || '-'} | <strong>Status:</strong> ${invoice.paymentStatus || '-'}${invoice.paymentStatus === 'Credit' && invoice.dueDate ? ` | <strong>Due:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}` : ''}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Rate</th>
                ${hasRefunds ? '<th class="text-right">Refund</th>' : ''}
                <th class="text-right">Warranty</th>
                ${itemsHaveDiscount ? '<th class="text-right">Disc.</th>' : ''}
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.items || []).map((i, idx) => {
                const warrantyString = warrantyForItem(i);
                const key = String(i.productId || i.SKU || i._id || '');
                const origQty = Number(i.quantity) || 0;
                const refundedQty = Number(refundQtyMap.get(key) || 0);
                const refundAmt = Number(refundAmtMap.get(key) || 0);
                const remainingQty = Math.max(0, origQty - refundedQty);
                const itemSubtotal = ((Number(i.perPiecePrice) || 0) * remainingQty) - (Number(i.discount) || 0);
                return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${splitProductName(i.productName)}</td>
                  <td class="text-right">${origQty}${refundedQty ? ` (-${refundedQty})` : ''}</td>
                  <td class="text-right">${Number(i.perPiecePrice || 0).toLocaleString()}</td>
                  ${hasRefunds ? `<td class="text-right">${refundAmt ? 'Rs.' + refundAmt.toLocaleString() : '-'}</td>` : ''}
                  <td class="text-right">${warrantyString}</td>
                  ${itemsHaveDiscount ? `<td class="text-right">${i.discount || 0}</td>` : ''}
                  <td class="text-right">${Number(itemSubtotal).toLocaleString()}</td>
                </tr>
              `;
              }).join('')}

              <tr class="total-row">
                <td colspan="${5 + (hasRefunds ? 1 : 0) + (itemsHaveDiscount ? 1 : 0)}">Total</td>
                <td class="text-right total-amount">Rs.${Number(totalWithoutDiscount).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div class="payment-info">
            ${(() => {
              const paidVal = invoice.paymentMethod === 'Cash'
                ? (invoice.cashAmount || invoice.paidAmount || 0)
                : (invoice.paidAmount || 0);
              const changeVal = invoice.changeAmount || 0;
              const discountVal = invoice.discountAmount || 0;
              const grossTotal = netAmount + discountVal;
              const totalRefundAmount = (invoice.refunds || []).reduce((s, r) => s + (Number(r.totalRefundAmount) || 0), 0);
              let extra = '';
              if (invoice.paymentStatus === 'Partial Paid') {
                const remaining = Math.max(0, netAmount - (invoice.paidAmount || 0));
                const parts = Array.isArray(invoice.paymentParts) && invoice.paymentParts.length > 0
                  ? invoice.paymentParts
                  : [{ amount: paidVal, date: new Date(invoice.createdAt || invoice.date).toISOString().split('T')[0] }];
                const partsHtml = parts.map((p, idx2) =>
                  `<div><span>Payment ${idx2 + 1} (${p.date ? new Date(p.date).toLocaleDateString() : '-'})</span><span>Rs. ${Number(p.amount || 0).toLocaleString()}</span></div>`
                ).join('');
                extra = `
                  ${partsHtml}
                  <div><span>Remaining</span><span>Rs. ${remaining.toLocaleString()}</span></div>`;
              } else if (invoice.paymentStatus === 'Credit') {
                extra = `
                  <div><span>Due Date</span><span>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}</span></div>`;
              }
              return `
                ${discountVal > 0 ? `<div><span>Discount</span><span>Rs. ${Number(discountVal).toLocaleString()}</span></div>` : ''}
                <div><span>Total Amount</span><span>Rs. ${Number(grossTotal).toLocaleString()}</span></div>
                <div><span>Paid Amount</span><span>Rs. ${Number(paidVal).toLocaleString()}</span></div>
                ${totalRefundAmount > 0 ? `<div><span>Refunded</span><span>Rs. ${totalRefundAmount.toLocaleString()}</span></div>` : ''}
                <div><span>Change</span><span>Rs. ${Number(changeVal).toLocaleString()}</span></div>
                ${extra}
              `;
            })()}
          </div>

          <div class="footer">*** Thank you for your business! ***</div>
        </body>
      </html>
    `;
}