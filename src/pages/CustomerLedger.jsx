import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, TextField, Grid, CircularProgress,
  Alert, Chip, IconButton, Tooltip, InputAdornment, MenuItem
} from '@mui/material';
import { useDarkMode } from '../context/DarkModeContext';
import API from '../api/api';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useNavigate } from 'react-router-dom';
import AddPaymentModal from '../components/AddPaymentModal';

const CustomerLedger = () => {
  const { darkMode } = useDarkMode();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Outstanding', 'Clear'
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [overdueMap, setOverdueMap] = useState({});

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

      // We always fetch sales to compute 30+ days overdue map
      let allSales = [];
      try {
        const salesRes = await API.get('/sales');
        allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
      } catch (err) {
        console.error('Failed to fetch sales for overdue computation:', err);
      }

      // Compute >30 days overdue map
      const tempOverdueMap = {};
      const today = new Date();
      allSales.forEach(s => {
        const status = (s.paymentStatus || '').toLowerCase();
        const isUnpaid = status !== 'paid' && status !== 'clear';
        if (isUnpaid) {
          const invoiceDate = new Date(s.date || s.createdAt);
          const timeDiff = today - invoiceDate;
          const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
          if (daysDiff > 30) {
            const custId = s.customerId?._id || s.customerId || s.customerName;
            tempOverdueMap[String(custId)] = true;
          }
        }
      });
      setOverdueMap(tempOverdueMap);

      // If formal customers is empty, try to aggregate from sales
      if (formalCustomers.length === 0) {
        console.log('No formal customers found, aggregating from /sales');
        const map = {};
        allSales.forEach(s => {
          const name = s.customerName || s.customer?.name || 'Unknown';
          const contact = s.customerContact || s.customer?.phone || s.customerPhone || '';
          const id = s.customerId?._id || s.customerId || name;

          if (!map[id]) {
            map[id] = {
              _id: id,
              name,
              contact,
              totalPurchases: 0,
              totalPaid: 0,
              remainingBalance: 0,
              isDerived: true
            };
          }
          const net = Number(s.netAmount || s.totalAmount || 0);
          const paid = Number(s.paidAmount || s.cashAmount || 0);
          map[id].totalPurchases += net;
          map[id].totalPaid += paid;
          map[id].remainingBalance += (net - paid);
        });
        setCustomers(Object.values(map));
      } else {
        setCustomers(formalCustomers);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Apply filters
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.contact?.includes(searchQuery);
      if (!matchesSearch) return false;

      if (statusFilter === 'Outstanding') return c.remainingBalance > 0;
      if (statusFilter === 'Clear') return c.remainingBalance <= 0;
      return true;
    });
  }, [customers, searchQuery, statusFilter]);

  // Global summary statistics
  const stats = useMemo(() => {
    return {
      totalReceivable: customers.reduce((sum, c) => sum + (c.remainingBalance || 0), 0),
      totalCustomers: customers.length,
      outstandingCount: customers.filter(c => (c.remainingBalance || 0) > 0).length
    };
  }, [customers]);

  // Filtered total receivable
  const filteredTotalReceivable = useMemo(() => {
    return filteredCustomers.reduce((sum, c) => sum + (c.remainingBalance || 0), 0);
  }, [filteredCustomers]);

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
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{stats.outstandingCount}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Search & Filters Table */}
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={8}>
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
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              select
              label="Status Filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="All">All Customers</MenuItem>
              <MenuItem value="Outstanding">Outstanding Dues</MenuItem>
              <MenuItem value="Clear">Clear / No Dues</MenuItem>
            </TextField>
          </Grid>
        </Grid>

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
                {filteredCustomers.length > 0 ? (
                  <>
                    {filteredCustomers.map((customer) => {
                      const isOverdue30 = overdueMap[String(customer._id)] || overdueMap[String(customer.name)];
                      return (
                        <TableRow key={customer._id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {customer.name}
                              {isOverdue30 && (
                                <Tooltip title="Has invoices overdue by more than 30 days">
                                  <Chip
                                    label="Overdue >30d"
                                    color="error"
                                    size="small"
                                    icon={<WarningAmberIcon style={{ fontSize: 14 }} />}
                                    sx={{ fontWeight: 'bold', height: 20, fontSize: '0.65rem' }}
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
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
                      );
                    })}
                    
                    {/* Summary row at the bottom of the table representing total receivable of filtered customers */}
                    <TableRow sx={{ bgcolor: darkMode ? '#1c1c1c' : '#f5f5f5', fontWeight: 'bold' }}>
                      <TableCell colSpan={2} sx={{ fontWeight: 800 }}>Total Filtered Receivable</TableCell>
                      <TableCell align="right" colSpan={3} sx={{ fontWeight: 800, color: filteredTotalReceivable > 0 ? 'error.main' : 'success.main', fontSize: '1.05rem' }}>
                        Rs. {filteredTotalReceivable.toLocaleString()}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </>
                ) : (
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
