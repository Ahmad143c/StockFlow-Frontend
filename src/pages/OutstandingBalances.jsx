import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Button, CircularProgress, Alert
} from '@mui/material';
import { useDarkMode } from '../context/DarkModeContext';
import API from '../api/api';
import { useNavigate } from 'react-router-dom';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PrintIcon from '@mui/icons-material/Print';

const OutstandingBalances = () => {
  const { darkMode } = useDarkMode();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOutstanding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get('/customers/outstanding');
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch outstanding balances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutstanding();
  }, [fetchOutstanding]);

  const totalOutstanding = data.reduce((sum, c) => sum + (c.remainingBalance || 0), 0);

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <WarningAmberIcon sx={{ fontSize: 40 }} /> Outstanding Balances
          </Typography>
          <Typography variant="body2" color="text.secondary">Customers with unpaid invoices and pending dues</Typography>
        </Box>
        <Button variant="contained" color="primary" startIcon={<PrintIcon />}>Download Report</Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, bgcolor: darkMode ? '#b71c1c' : '#ffebee', borderLeft: '6px solid red' }}>
            <Typography variant="subtitle2" gutterBottom>Total Amount Receivable</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Rs. {totalOutstanding.toLocaleString()}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2, bgcolor: darkMode ? '#333' : '#fff' }}>
            <Typography variant="subtitle2" gutterBottom>Outstanding Accounts</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{data.length}</Typography>
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
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Contact</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total Purchases</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Total Paid</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Balance Due</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Severity</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.length > 0 ? data.map((customer) => {
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
                      <TableCell align="center">
                        <Chip label={severity} color={severityColor} size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" onClick={() => navigate(`/admin/customer-statement/${customer._id}`)}>
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
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
