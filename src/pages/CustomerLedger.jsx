import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, TextField, Grid, CircularProgress,
  Alert, Chip, IconButton, Tooltip, InputAdornment
} from '@mui/material';
import { useDarkMode } from '../context/DarkModeContext';
import API from '../api/api';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useNavigate } from 'react-router-dom';
import AddPaymentModal from '../components/AddPaymentModal';

const CustomerLedger = () => {
  const { darkMode } = useDarkMode();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let formalCustomers = [];
      try {
        const res = await API.get('/customers');
        formalCustomers = Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        if (e.response?.status !== 404) throw e;
        console.log('Backend /customers not found');
      }

      const salesRes = await API.get('/sales').catch(() => ({ data: [] }));
      const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
      
      const map = {};

      // 1. Map all registered (formal) customers
      formalCustomers.forEach(c => {
        map[c.name.toLowerCase()] = {
          ...c,
          remainingBalance: c.currentBalance !== undefined ? c.currentBalance : (c.remainingBalance || 0),
          isDerived: false
        };
      });

      // 2. Aggregate sales for unregistered (derived) customers
      allSales.forEach(s => {
        const name = s.customerName || s.customer?.name || 'Unknown';
        const contact = s.customerContact || s.customer?.phone || s.customerPhone || '';
        const lowerName = name.toLowerCase();

        // If not already in our map (meaning they aren't registered yet)
        if (!map[lowerName]) {
          map[lowerName] = {
            _id: name, // fallback ID for derived
            name,
            contact,
            totalPurchases: 0,
            totalPaid: 0,
            remainingBalance: 0,
            isDerived: true
          };
        }

        // Only add up amounts if this is a purely derived customer. 
        // Formal customers already have their precise totals managed by the backend Ledger.
        if (map[lowerName].isDerived) {
          const net = Number(s.netAmount || s.totalAmount || 0);
          const paid = Number(s.paidAmount || s.cashAmount || 0);
          map[lowerName].totalPurchases += net;
          map[lowerName].totalPaid += paid;
          map[lowerName].remainingBalance += (net - paid);
        }
      });

      setCustomers(Object.values(map));
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact?.includes(searchQuery)
  );

  const stats = {
    totalReceivable: customers.reduce((sum, c) => sum + (c.remainingBalance || 0), 0),
    totalCustomers: customers.length,
    overdueCount: customers.filter(c => (c.remainingBalance || 0) > 0).length
  };

  const handleAddPayment = (customer) => {
    setSelectedCustomer(customer);
    setPaymentModalOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      {/* Header & Stats */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AccountBalanceWalletIcon sx={{ fontSize: 40 }} /> Customer Ledger
          </Typography>
          <Typography variant="body2" color="text.secondary">Manage customer balances and payment history</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" startIcon={<RefreshIcon />} onClick={fetchCustomers} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, textAlign: 'center', background: darkMode ? 'linear-gradient(135deg, #0d47a1 0%, #1565c0 100%)' : 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' }}>
            <Typography variant="overline" display="block" gutterBottom>Total Receivable</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Rs. {stats.totalReceivable.toLocaleString()}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, textAlign: 'center', background: darkMode ? 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)' : 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' }}>
            <Typography variant="overline" display="block" gutterBottom>Total Customers</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{stats.totalCustomers}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, textAlign: 'center', background: darkMode ? 'linear-gradient(135deg, #b71c1c 0%, #d32f2f 100%)' : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' }}>
            <Typography variant="overline" display="block" gutterBottom>Outstanding Accounts</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{stats.overdueCount}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Search & Table */}
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search by customer name or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total Purchases</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total Paid</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Remaining Balance</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCustomers.length > 0 ? filteredCustomers.map((customer) => (
                  <TableRow key={customer._id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{customer.name}</TableCell>
                    <TableCell>{customer.contact || '-'}</TableCell>
                    <TableCell align="right">Rs. {(customer.totalPurchases || 0).toLocaleString()}</TableCell>
                    <TableCell align="right">Rs. {(customer.totalPaid || 0).toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: customer.remainingBalance > 0 ? 'error.main' : 'success.main' }}>
                      Rs. {(customer.remainingBalance || 0).toLocaleString()}
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={customer.remainingBalance > 0 ? 'Outstanding' : 'Clear'} 
                        color={customer.remainingBalance > 0 ? 'error' : 'success'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                        <Tooltip title="View Statement">
                          <IconButton color="primary" onClick={() => navigate(`../customer-statement/${customer._id}`)}>
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Add Payment">
                          <IconButton color="success" onClick={() => handleAddPayment(customer)}>
                            <AddIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      <Typography variant="body1" color="text.secondary">No customers found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Payment Modal */}
      {paymentModalOpen && (
        <AddPaymentModal 
          open={paymentModalOpen} 
          onClose={() => {
            setPaymentModalOpen(false);
            fetchCustomers();
          }} 
          customer={selectedCustomer}
        />
      )}
    </Box>
  );
};

export default CustomerLedger;
