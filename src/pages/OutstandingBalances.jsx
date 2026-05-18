import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Button, CircularProgress, Alert,
  TableSortLabel
} from '@mui/material';
import { useDarkMode } from '../context/DarkModeContext';
import API from '../api/api';
import { useNavigate } from 'react-router-dom';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

const OutstandingBalances = () => {
  const { darkMode } = useDarkMode();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'remainingBalance', direction: 'desc' });

  const fetchOutstanding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let formalOutstanding = [];
      try {
        const res = await API.get('/customers/outstanding');
        formalOutstanding = Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        if (e.response?.status !== 404) throw e;
        console.log('Backend /customers/outstanding not found');
      }

      // Fetch sales data to compute days overdue & support aggregation fallback
      let allSales = [];
      try {
        const salesRes = await API.get('/sales');
        allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
      } catch (err) {
        console.error('Failed to fetch sales for overdue computation:', err);
      }

      // Map of customer ID to oldest unpaid invoice date
      const today = new Date();
      const oldestUnpaidMap = {};
      allSales.forEach(s => {
        const status = (s.paymentStatus || '').toLowerCase();
        const isUnpaid = status !== 'paid' && status !== 'clear';
        if (isUnpaid) {
          const custId = String(s.customerId?._id || s.customerId || s.customerName);
          const invoiceDate = new Date(s.date || s.createdAt);
          if (!oldestUnpaidMap[custId] || invoiceDate < oldestUnpaidMap[custId]) {
            oldestUnpaidMap[custId] = invoiceDate;
          }
        }
      });

      let finalData = [];

      // If formal list is empty, aggregate from sales
      if (formalOutstanding.length === 0) {
        console.log('No formal outstanding balances found, aggregating from /sales');
        const map = {};
        allSales.forEach(s => {
          const status = (s.paymentStatus || '').toLowerCase();
          if (status !== 'paid' && status !== 'clear') {
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
                remainingBalance: 0
              };
            }
            const net = Number(s.netAmount || s.totalAmount || 0);
            const paid = Number(s.paidAmount || s.cashAmount || 0);
            map[id].totalPurchases += net;
            map[id].totalPaid += paid;
            map[id].remainingBalance += (net - paid);
          }
        });
        finalData = Object.values(map).filter(c => c.remainingBalance > 0);
      } else {
        finalData = formalOutstanding;
      }

      // Map days overdue onto the dataset
      finalData = finalData.map(c => {
        const oldestDate = oldestUnpaidMap[String(c._id)] || oldestUnpaidMap[String(c.name)];
        let daysOverdue = 0;
        if (oldestDate) {
          const timeDiff = today - oldestDate;
          daysOverdue = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
        }
        return {
          ...c,
          daysOverdue
        };
      });

      setData(finalData);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch outstanding balances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutstanding();
  }, [fetchOutstanding]);

  // Calculations
  const totalOutstanding = useMemo(() => {
    return data.reduce((sum, c) => sum + (c.remainingBalance || 0), 0);
  }, [data]);

  const averageBalanceDue = useMemo(() => {
    if (data.length === 0) return 0;
    return totalOutstanding / data.length;
  }, [data, totalOutstanding]);

  // Dynamic sorting logic
  const handleRequestSort = (key) => {
    const isAsc = sortConfig.key === key && sortConfig.direction === 'asc';
    setSortConfig({ key, direction: isAsc ? 'desc' : 'asc' });
  };

  const sortedData = useMemo(() => {
    const sortableItems = [...data];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        // Handle undefined or null values gracefully
        if (valA === undefined || valA === null) valA = 0;
        if (valB === undefined || valB === null) valB = 0;

        if (typeof valA === 'string') {
          return sortConfig.direction === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else {
          return sortConfig.direction === 'asc'
            ? valA - valB
            : valB - valA;
        }
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  // Export to CSV Functionality
  const handleDownloadReport = () => {
    const headers = ['Customer', 'Contact', 'Total Purchases', 'Total Paid', 'Balance Due', 'Severity', 'Days Overdue'];
    const rows = sortedData.map(c => {
      const severity = c.remainingBalance > 50000 ? 'High' : (c.remainingBalance > 10000 ? 'Medium' : 'Low');
      return [
        c.name,
        c.contact || '-',
        c.totalPurchases || 0,
        c.totalPaid || 0,
        c.remainingBalance || 0,
        severity,
        c.daysOverdue || 0
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
      + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Outstanding_Balances_Report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <WarningAmberIcon sx={{ fontSize: 40 }} /> Outstanding Balances
          </Typography>
          <Typography variant="body2" color="text.secondary">Customers with unpaid invoices and pending dues</Typography>
        </Box>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<FileDownloadIcon />}
          onClick={handleDownloadReport}
          disabled={data.length === 0}
        >
          Download Report
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, bgcolor: darkMode ? '#b71c1c' : '#ffebee', borderLeft: '6px solid red' }}>
            <Typography variant="subtitle2" gutterBottom>Total Amount Receivable</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Rs. {totalOutstanding.toLocaleString()}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, bgcolor: darkMode ? '#333' : '#fff' }}>
            <Typography variant="subtitle2" gutterBottom>Outstanding Accounts</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{data.length}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, bgcolor: darkMode ? '#0288d1' : '#e1f5fe', borderLeft: '6px solid #0288d1' }}>
            <Typography variant="subtitle2" gutterBottom>Average Balance Due</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Rs. {Math.round(averageBalanceDue).toLocaleString()}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Table */}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : (
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortConfig.key === 'name'}
                      direction={sortConfig.key === 'name' ? sortConfig.direction : 'asc'}
                      onClick={() => handleRequestSort('name')}
                    >
                      Customer
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    <TableSortLabel
                      active={sortConfig.key === 'totalPurchases'}
                      direction={sortConfig.key === 'totalPurchases' ? sortConfig.direction : 'asc'}
                      onClick={() => handleRequestSort('totalPurchases')}
                    >
                      Total Purchases
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    <TableSortLabel
                      active={sortConfig.key === 'totalPaid'}
                      direction={sortConfig.key === 'totalPaid' ? sortConfig.direction : 'asc'}
                      onClick={() => handleRequestSort('totalPaid')}
                    >
                      Total Paid
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    <TableSortLabel
                      active={sortConfig.key === 'remainingBalance'}
                      direction={sortConfig.key === 'remainingBalance' ? sortConfig.direction : 'desc'}
                      onClick={() => handleRequestSort('remainingBalance')}
                    >
                      Balance Due
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    <TableSortLabel
                      active={sortConfig.key === 'daysOverdue'}
                      direction={sortConfig.key === 'daysOverdue' ? sortConfig.direction : 'desc'}
                      onClick={() => handleRequestSort('daysOverdue')}
                    >
                      Days Overdue
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Severity</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedData.length > 0 ? sortedData.map((customer) => {
                  const severity = customer.remainingBalance > 50000 ? 'High' : (customer.remainingBalance > 10000 ? 'Medium' : 'Low');
                  const severityColor = severity === 'High' ? 'error' : (severity === 'Medium' ? 'warning' : 'info');
                  
                  return (
                    <TableRow key={customer._id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{customer.name}</TableCell>
                      <TableCell>{customer.contact || '-'}</TableCell>
                      <TableCell align="right">Rs. {(customer.totalPurchases || 0).toLocaleString()}</TableCell>
                      <TableCell align="right">Rs. {(customer.totalPaid || 0).toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>
                        Rs. {(customer.remainingBalance || 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {customer.daysOverdue || 0} {customer.daysOverdue === 1 ? 'day' : 'days'}
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={severity} color={severityColor} size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" onClick={() => navigate(`../customer-statement/${customer._id}`)}>
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                      <Typography variant="body1" color="text.secondary">No outstanding balances found! Great job.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default OutstandingBalances;
