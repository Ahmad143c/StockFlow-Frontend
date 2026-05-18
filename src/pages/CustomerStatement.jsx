import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Grid, CircularProgress, Alert, IconButton,
  Divider, Chip, Tooltip, Breadcrumbs, Link as MuiLink
} from '@mui/material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';
import API from '../api/api';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintIcon from '@mui/icons-material/Print';
import ReceiptIcon from '@mui/icons-material/Receipt';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AddPaymentModal from '../components/AddPaymentModal';

const CustomerStatement = () => {
  const { customerId } = useParams();
  const { darkMode } = useDarkMode();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let ledgerData = null;
      let customerInfo = null;

      // Only try the formal API if the ID looks like a valid MongoDB ObjectId (24 hex chars)
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(customerId);

      if (isObjectId) {
        try {
          const res = await API.get(`/customers/ledger/${customerId}`);
          if (Array.isArray(res.data) && res.data.length > 0) {
            ledgerData = res.data;
            const custRes = await API.get(`/customers/${customerId}`).catch(() => null);
            customerInfo = custRes?.data;
          }
        } catch (e) {
          console.log('Formal ledger API failed, falling back to sales aggregation');
        }
      } else {
        console.log('Customer ID is not an ObjectId (likely a name), skipping API and using fallback...');
      }

      // If no data from formal API (or skipped), derive from sales
      if (!ledgerData) {
        console.log('Comprehensive derivation from /sales...');
        const [salesRes, customersRes] = await Promise.all([
          API.get('/sales'),
          API.get('/customers').catch(() => ({ data: [] }))
        ]);
        
        const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
        customerInfo = customerInfo || (Array.isArray(customersRes.data) 
          ? customersRes.data.find(c => c._id === customerId)
          : null);

        const customerSales = allSales.filter(s => 
          String(s.customerId?._id || s.customerId || s.customerName) === String(customerId)
        );

        const entries = [];
        let totalPurchases = 0;
        let totalPaid = 0;

        customerSales.forEach(s => {
          const net = Number(s.netAmount || s.totalAmount || 0);
          const paid = Number(s.paidAmount || s.cashAmount || 0);
          
          totalPurchases += net;
          totalPaid += paid;

          // Add Invoice Entry
          entries.push({
            date: s.date || s.createdAt,
            type: 'Invoice',
            amount: net,
            reference: s.invoiceNumber || s._id,
            description: `Sales Invoice ${s.invoiceNumber || ''}`,
            paymentStatus: s.paymentStatus || 'unpaid'
          });

          // Add Payment Entry if anything was paid
          if (paid > 0) {
            entries.push({
              date: s.date || s.createdAt,
              type: 'Payment',
              amount: paid,
              reference: s.invoiceNumber || s._id,
              description: `Payment received for invoice ${s.invoiceNumber || ''}`,
              paymentStatus: s.paymentStatus || 'paid'
            });
          }
        });

        // Sort by date
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        ledgerData = entries;

        if (!customerInfo) {
          customerInfo = { 
            name: customerId, 
            _id: customerId,
            totalPurchases,
            totalPaid,
            remainingBalance: totalPurchases - totalPaid
          };
        } else {
          // Update customer info totals if they were derived
          customerInfo.totalPurchases = totalPurchases;
          customerInfo.totalPaid = totalPaid;
          customerInfo.remainingBalance = (customerInfo.previousDue || 0) + totalPurchases - totalPaid;
        }
      }

      setData({
        customer: customerInfo,
        ledger: ledgerData
      });
    } catch (e) {
      console.error('Statement fetch/fallback failed:', e);
      setError('Failed to load customer statement. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Calculate running balance locally
  const ledgerWithBalance = useMemo(() => {
    if (!data || !data.ledger) return [];
    let currentBalance = data.customer?.previousDue || 0;
    
    return data.ledger.map(entry => {
      // Handle both backend ledger (debit/credit) and derived ledger (amount + type)
      const isDebit = entry.transactionType === 'Sale' || entry.type === 'Invoice' || entry.debit > 0;
      const amount = entry.amount || (isDebit ? entry.debit : entry.credit);

      if (isDebit) {
        currentBalance += amount;
      } else {
        currentBalance -= amount;
      }
      
      return { 
        ...entry, 
        isDebit,
        displayAmount: amount,
        runningBalance: currentBalance 
      };
    });
  }, [data]);

  // CSV Export Logic
  const handleExportCSV = () => {
    if (!data?.customer || ledgerWithBalance.length === 0) return;
    const headers = ['Date', 'Reference', 'Description', 'Debit (+)', 'Credit (-)', 'Running Balance'];
    
    const rows = [];
    // Opening balance row
    rows.push([
      '-',
      'Opening Balance',
      'Previous Due / Opening Balance',
      '',
      '',
      `Rs. ${(data.customer.previousDue || 0).toLocaleString()}`
    ]);

    // Ledger transactions
    ledgerWithBalance.forEach(entry => {
      rows.push([
        new Date(entry.transactionDate || entry.date).toLocaleDateString(),
        entry.reference || 'Manual Entry',
        entry.description || '-',
        entry.isDebit ? entry.displayAmount : 0,
        !entry.isDebit ? entry.displayAmount : 0,
        entry.runningBalance
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${data.customer.name.replace(/\s+/g, '_')}_Statement.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Statement logic with temporary print-only hiding class insertion
  const handlePrint = () => {
    const printStyle = document.createElement('style');
    printStyle.innerHTML = `
      @media print {
        .no-print { display: none !important; }
        body { background: white !important; color: black !important; padding: 20px !important; }
        .MuiPaper-root { box-shadow: none !important; border: 1px solid #ccc !important; }
      }
    `;
    document.head.appendChild(printStyle);
    window.print();
    document.head.removeChild(printStyle);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert><Button onClick={() => navigate(-1)} startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>Go Back</Button></Box>;
  if (!data) return null;

  const { customer } = data;

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }} className="no-print">
        <MuiLink component={Link} to=".." underline="hover" color="inherit">Dashboard</MuiLink>
        <MuiLink component={Link} to="../customer-ledger" underline="hover" color="inherit">Ledger</MuiLink>
        <Typography color="text.primary">Statement</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} color="primary" className="no-print"><ArrowBackIcon /></IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{customer.name}</Typography>
            <Typography variant="body2" color="text.secondary">{customer.contact || 'No contact provided'}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }} className="no-print">
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>Print Statement</Button>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportCSV}>Export CSV</Button>
        </Box>
      </Box>

      {/* Summary Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Balance Summary</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Opening Due</Typography>
                <Typography variant="h6">Rs. {(customer.previousDue || 0).toLocaleString()}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Total Purchases</Typography>
                <Typography variant="h6" color="primary.main">Rs. {(customer.totalPurchases || 0).toLocaleString()}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Total Payments</Typography>
                <Typography variant="h6" color="success.main">Rs. {(customer.totalPaid || 0).toLocaleString()}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">Current Balance</Typography>
                <Typography variant="h6" color="error.main" sx={{ fontWeight: 700 }}>Rs. {(customer.remainingBalance || 0).toLocaleString()}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4} className="no-print">
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: '100%', bgcolor: darkMode ? '#1e1e1e' : '#fafafa' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Quick Actions</Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button fullWidth variant="contained" color="success" onClick={() => setPaymentModalOpen(true)}>Record New Payment</Button>
              <Button fullWidth variant="outlined" color="primary" onClick={() => navigate('../seller-sale')}>Create New Invoice</Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Transaction History */}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Transaction History</Typography>
        </Box>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Debit (+)</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Credit (-)</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Running Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Initial Balance Row */}
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell colSpan={3} sx={{ fontStyle: 'italic' }}>Opening Balance / Previous Due</TableCell>
                <TableCell align="center">-</TableCell>
                <TableCell align="right">-</TableCell>
                <TableCell align="right">-</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Rs. {(customer.previousDue || 0).toLocaleString()}</TableCell>
              </TableRow>

              {ledgerWithBalance.length > 0 ? ledgerWithBalance.map((entry, index) => {
                // Determine if row is an unpaid Invoice row to highlight (light red background)
                const isInvoice = entry.type === 'Invoice' || entry.transactionType === 'Sale';
                const isUnpaid = isInvoice && (entry.paymentStatus || '').toLowerCase() !== 'paid';
                
                // Highlight row with light-red color
                const rowBgColor = isUnpaid
                  ? (darkMode ? 'rgba(211, 47, 47, 0.15)' : '#ffebee')
                  : 'transparent';

                // Status chip configurations
                let statusLabel = '-';
                let statusColor = 'default';
                if (isInvoice) {
                  const status = (entry.paymentStatus || '').toLowerCase();
                  if (status === 'paid' || status === 'clear') {
                    statusLabel = 'Settled';
                    statusColor = 'success';
                  } else if (status === 'partial') {
                    statusLabel = 'Partial';
                    statusColor = 'warning';
                  } else {
                    statusLabel = 'Pending';
                    statusColor = 'error';
                  }
                } else if (entry.type === 'Payment' || entry.transactionType === 'Payment') {
                  statusLabel = 'Received';
                  statusColor = 'info';
                }

                return (
                  <TableRow 
                    key={index} 
                    hover 
                    sx={{ backgroundColor: rowBgColor, '&:hover': { backgroundColor: isUnpaid ? (darkMode ? 'rgba(211, 47, 47, 0.25)' : '#ffcdd2') : 'inherit' } }}
                  >
                    <TableCell>{new Date(entry.transactionDate || entry.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {entry.isDebit ? <ReceiptIcon fontSize="small" color="action" /> : <FileDownloadIcon fontSize="small" color="success" />}
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {entry.reference || 'Manual Entry'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{entry.description || '-'}</TableCell>
                    <TableCell>
                      {statusLabel !== '-' ? (
                        <Chip label={statusLabel} color={statusColor} size="small" variant="outlined" />
                      ) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'error.main' }}>
                      {entry.isDebit ? `Rs. ${entry.displayAmount.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>
                      {!entry.isDebit ? `Rs. ${entry.displayAmount.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Rs. {entry.runningBalance.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <Typography variant="body1" color="text.secondary">No transactions recorded yet</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Payment Modal */}
      {paymentModalOpen && (
        <AddPaymentModal
          open={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            fetchLedger(); // Refresh ledger details
          }}
          customer={customer}
        />
      )}
    </Box>
  );
};

export default CustomerStatement;
