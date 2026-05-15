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

const CustomerStatement = () => {
  const { customerId } = useParams();
  const { darkMode } = useDarkMode();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let ledgerData = null;
      try {
        const res = await API.get(`/customers/ledger/${customerId}`);
        if (Array.isArray(res.data) && res.data.length > 0) {
          ledgerData = res.data;
        }
      } catch (e) {
        console.log('Backend ledger failed, attempting fallback');
      }

      if (!ledgerData) {
        console.log('Deriving statement from /sales');
        const [salesRes, customersRes] = await Promise.all([
          API.get('/sales'),
          API.get('/customers').catch(() => ({ data: [] }))
        ]);
        
        const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
        const customer = Array.isArray(customersRes.data) 
          ? customersRes.data.find(c => c._id === customerId)
          : null;

        // Filter sales for this customer
        const customerSales = allSales.filter(s => 
          String(s.customerId?._id || s.customerId || s.customerName) === String(customerId)
        );

        // Map sales to ledger entries
        const ledgerEntries = customerSales.map(s => ({
          transactionDate: s.date || s.createdAt,
          transactionType: 'Sale',
          debit: Number(s.netAmount || s.totalAmount || 0),
          credit: 0,
          description: `Invoice: ${s.invoiceNumber || 'Manual'}`
        }));

        setData({
          customer: customer || { name: customerId, _id: customerId },
          ledger: ledgerEntries
        });
      } else {
        // Fetch customer info separately if ledger came from API
        const custRes = await API.get(`/customers/${customerId}`).catch(() => null);
        setData({
          customer: custRes?.data || { name: 'Customer', _id: customerId },
          ledger: ledgerData
        });
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch customer ledger');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Calculate running balance locally if not provided by backend
  const ledgerWithBalance = useMemo(() => {
    if (!data || !data.ledger) return [];
    let currentBalance = data.customer?.previousDue || 0;
    
    return data.ledger.map(entry => {
      if (entry.type === 'Debit' || entry.type === 'Invoice') {
        currentBalance += entry.amount;
      } else {
        currentBalance -= entry.amount;
      }
      return { ...entry, runningBalance: currentBalance };
    });
  }, [data]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert><Button onClick={() => navigate(-1)} startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>Go Back</Button></Box>;
  if (!data) return null;

  const { customer } = data;

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink component={Link} to=".." underline="hover" color="inherit">Dashboard</MuiLink>
        <MuiLink component={Link} to="../customer-ledger" underline="hover" color="inherit">Ledger</MuiLink>
        <Typography color="text.primary">Statement</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} color="primary"><ArrowBackIcon /></IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{customer.name}</Typography>
            <Typography variant="body2" color="text.secondary">{customer.contact || 'No contact provided'}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<PrintIcon />}>Print Statement</Button>
          <Button variant="outlined" startIcon={<FileDownloadIcon />}>Export CSV</Button>
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
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: '100%', bgcolor: darkMode ? '#1e1e1e' : '#fafafa' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Quick Actions</Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button fullWidth variant="contained" color="success">Record New Payment</Button>
              <Button fullWidth variant="outlined" color="primary">Create New Invoice</Button>
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
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Debit (+)</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Credit (-)</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Running Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Initial Balance Row */}
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell colSpan={3} sx={{ fontStyle: 'italic' }}>Opening Balance / Previous Due</TableCell>
                <TableCell align="right">-</TableCell>
                <TableCell align="right">-</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Rs. {(customer.previousDue || 0).toLocaleString()}</TableCell>
              </TableRow>

              {ledgerWithBalance.length > 0 ? ledgerWithBalance.map((entry, index) => (
                <TableRow key={index} hover>
                  <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {entry.invoiceId && <ReceiptIcon fontSize="small" color="action" />}
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {entry.reference || (entry.invoiceId ? `Invoice #${entry.invoiceId.toString().slice(-6)}` : 'Payment')}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{entry.description || '-'}</TableCell>
                  <TableCell align="right" sx={{ color: 'error.main' }}>
                    {entry.type === 'Debit' || entry.type === 'Invoice' ? `Rs. ${entry.amount.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'success.main' }}>
                    {entry.type === 'Credit' || entry.type === 'Payment' ? `Rs. ${entry.amount.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Rs. {entry.runningBalance.toLocaleString()}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <Typography variant="body1" color="text.secondary">No transactions recorded yet</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default CustomerStatement;
