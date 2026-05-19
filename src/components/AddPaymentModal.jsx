import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Grid, InputAdornment, Box, Typography, Alert,
  CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Paper
} from '@mui/material';
import API from '../api/api';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const AddPaymentModal = ({ open, onClose, customer, preselectedInvoice }) => {
  const [loading, setLoading] = useState(false);
  const [fetchingInvoices, setFetchingInvoices] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);
  const [successSummary, setSuccessSummary] = useState(null);

  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'Cash',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Fetch customer invoices
  const fetchInvoices = useCallback(async () => {
    if (!customer) return;
    setFetchingInvoices(true);
    setError(null);
    try {
      const hasValidId = customer._id && /^[0-9a-fA-F]{24}$/.test(customer._id);
      const res = await API.get(`/sales${hasValidId ? `?customerId=${customer._id}` : ''}`);
      const rawSales = Array.isArray(res.data) ? res.data : [];
      
      // Filter unpaid, partial, or credit invoices specifically for THIS customer
      const unpaid = rawSales
        .filter(s => {
          const status = (s.paymentStatus || '').toLowerCase();
          const isEligibleStatus = status.includes('unpaid') || status.includes('partial') || status.includes('credit');
          if (!isEligibleStatus) return false;

          // Perform robust customer matching
          const sCustId = s.customerId?._id || s.customerId;
          const sName = (s.customerName || s.customer?.name || '').trim();
          const sContact = (s.customerContact || s.customer?.phone || s.customerPhone || '').trim();

          const matchId = sCustId && customer._id && String(sCustId) === String(customer._id);
          const matchName = sName && customer.name && sName.toLowerCase() === customer.name.trim().toLowerCase();
          const matchContact = sContact && customer.contact && customer.contact.trim() !== '' && sContact.toLowerCase() === customer.contact.trim().toLowerCase();

          return matchId || matchName || matchContact;
        })
        .map(s => {
          const net = Number(s.netAmount || s.totalAmount || 0);
          const paid = Number(s.paidAmount || 0);
          const remaining = Math.max(0, net - paid);
          return {
            ...s,
            netAmount: net,
            paidAmount: paid,
            remainingBalance: remaining
          };
        })
        .filter(s => s.remainingBalance > 0);

      // Sort chronological (oldest first)
      unpaid.sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));

      // If preselected invoice is passed, bring it to the top
      if (preselectedInvoice) {
        const index = unpaid.findIndex(inv => String(inv._id) === String(preselectedInvoice._id));
        if (index > -1) {
          const [selected] = unpaid.splice(index, 1);
          unpaid.unshift(selected);
        }
      }

      setInvoices(unpaid);
    } catch (e) {
      console.error('Failed to fetch unpaid invoices:', e);
      setError('Could not load customer outstanding invoices.');
    } finally {
      setFetchingInvoices(false);
    }
  }, [customer, preselectedInvoice]);

  useEffect(() => {
    if (open && customer) {
      fetchInvoices();
      // Prepopulate amount if preselected invoice is passed
      if (preselectedInvoice) {
        const net = Number(preselectedInvoice.netAmount || preselectedInvoice.totalAmount || 0);
        const paid = Number(preselectedInvoice.paidAmount || 0);
        setFormData(prev => ({
          ...prev,
          amount: String(Math.max(0, net - paid))
        }));
      } else {
        setFormData(prev => ({ ...prev, amount: '' }));
      }
      setSuccessSummary(null);
    }
  }, [open, customer, preselectedInvoice, fetchInvoices]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Run dynamic FIFO payment allocation
  const allocation = useMemo(() => {
    const inputAmount = Number(formData.amount) || 0;
    let remainingPayment = inputAmount;
    
    return invoices.map(inv => {
      const remainingBalance = inv.remainingBalance;
      const allocated = Math.min(remainingBalance, remainingPayment);
      remainingPayment -= allocated;

      const newPaid = inv.paidAmount + allocated;
      const remainingAfter = Math.max(0, remainingBalance - allocated);
      
      let newStatus = inv.paymentStatus;
      if (allocated > 0) {
        newStatus = remainingAfter === 0 ? 'paid' : 'partial';
      }

      return {
        ...inv,
        allocated,
        newPaid,
        remainingAfter,
        newStatus
      };
    });
  }, [invoices, formData.amount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setLoading(true);
    setError(null);

    const allocatedInvoices = allocation.filter(item => item.allocated > 0);
    const settledList = [];

    try {
      // 1. Process PATCH for each affected invoice
      for (const item of allocatedInvoices) {
        await API.put(`/sales/${item._id}`, {
          paidAmount: item.newPaid,
          paymentStatus: item.newStatus
        });
        settledList.push({
          invoiceNumber: item.invoiceNumber || item._id.toString().slice(-6),
          allocated: item.allocated,
          status: item.newStatus
        });
      }

      // 2. Process POST to customer's ledger
      let paymentRecorded = false;
      // Try GET /customers/:customerId/payments endpoint first
      try {
        await API.post(`/customers/${customer._id}/payments`, {
          amount: Number(formData.amount),
          date: formData.date,
          notes: formData.notes || `FIFO Payment Allocation. Settled invoices: ${settledList.map(s => s.invoiceNumber).join(', ')}`,
          paymentMethod: formData.paymentMethod
        });
        paymentRecorded = true;
      } catch (err) {
        console.log('Formal payments endpoint not found, trying fallback payment endpoint');
      }

      if (!paymentRecorded) {
        // Fallback to general payment endpoint
        await API.post('/customers/payment', {
          customerId: customer._id,
          amount: Number(formData.amount),
          paymentMethod: formData.paymentMethod,
          date: formData.date,
          notes: formData.notes
        });
      }

      // Display Success Summary
      setSuccessSummary({
        total: Number(formData.amount),
        settled: settledList
      });
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.message || 'Failed to process payment allocation. Note: Only registered customers can receive payments.');
    } finally {
      setLoading(false);
    }
  };

  if (successSummary) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent sx={{ textAlign: 'center', p: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            Payment Recorded Successfully!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            A total of <strong>Rs. {successSummary.total.toLocaleString()}</strong> has been allocated across invoices.
          </Typography>
          
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, mb: 3, textAlign: 'left' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Settlement Breakdown:
            </Typography>
            {successSummary.settled.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {successSummary.settled.map((item, idx) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">Invoice #{item.invoiceNumber}</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        Rs. {item.allocated.toLocaleString()}
                      </Typography>
                      <Chip 
                        label={item.status.toUpperCase()} 
                        size="small" 
                        color={item.status === 'paid' ? 'success' : 'warning'} 
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No individual invoices required allocation (recorded as general payment ledger entry).
              </Typography>
            )}
          </Box>
          
          <Button variant="contained" color="success" onClick={onClose} fullWidth>
            Close & Refresh
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }}>
          Smart Payment Allocation - {customer?.name}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Current Dues</Typography>
              <Typography variant="h5" color="error.main" sx={{ fontWeight: 700 }}>
                Rs. {(customer?.remainingBalance || 0).toLocaleString()}
              </Typography>
            </Box>
            {preselectedInvoice && (
              <Chip label={`Selected Invoice: #${preselectedInvoice.invoiceNumber || preselectedInvoice._id?.toString().slice(-6)}`} color="info" />
            )}
          </Box>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Payment Amount"
                name="amount"
                type="number"
                value={formData.amount}
                onChange={handleChange}
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                  inputProps: { min: 0 }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Payment Method"
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                required
              >
                <MenuItem value="Cash">Cash</MenuItem>
                <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                <MenuItem value="JazzCash">JazzCash</MenuItem>
                <MenuItem value="EasyPaisa">EasyPaisa</MenuItem>
                <MenuItem value="Cheque">Cheque</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Payment Date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Reference number, bank name, notes"
              />
            </Grid>
          </Grid>

          {/* Table displaying outstanding invoices */}
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Outstanding Invoices & FIFO Allocation Preview
          </Typography>
          {fetchingInvoices ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>
          ) : invoices.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>No outstanding unpaid invoices found for this customer.</Alert>
          ) : (
            <TableContainer component={Paper} sx={{ maxHeight: 250, mb: 2 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Invoice #</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Total</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Paid</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Remaining</TableCell>
                    {Number(formData.amount) > 0 && (
                      <>
                        <TableCell sx={{ fontWeight: 'bold', color: 'success.main' }} align="right">Allocation</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="center">New Status</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allocation.map((item) => {
                    const shortNum = item.invoiceNumber || item._id.toString().slice(-6);
                    return (
                      <TableRow key={item._id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{shortNum}</TableCell>
                        <TableCell>{new Date(item.date || item.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell align="right">Rs. {item.netAmount.toLocaleString()}</TableCell>
                        <TableCell align="right">Rs. {item.paidAmount.toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: 'error.main' }}>
                          Rs. {item.remainingBalance.toLocaleString()}
                        </TableCell>
                        {Number(formData.amount) > 0 && (
                          <>
                            <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>
                              + Rs. {item.allocated.toLocaleString()}
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={item.allocated > 0 ? item.newStatus.toUpperCase() : 'UNCHANGED'} 
                                color={item.allocated > 0 ? (item.newStatus === 'paid' ? 'success' : 'warning') : 'default'} 
                                size="small"
                              />
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: 'background.default' }}>
          <Button onClick={onClose} color="inherit" disabled={loading}>Cancel</Button>
          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            startIcon={<SaveIcon />}
            disabled={loading || invoices.length === 0}
          >
            {loading ? 'Processing...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddPaymentModal;
