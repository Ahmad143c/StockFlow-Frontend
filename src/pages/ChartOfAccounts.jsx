import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Grid, CircularProgress, Alert, Chip, Divider,
  IconButton, Tooltip, TextField, InputAdornment
} from '@mui/material';
import { useDarkMode } from '../context/DarkModeContext';
import API from '../api/api';
import SearchIcon from '@mui/icons-material/Search';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import VisibilityIcon from '@mui/icons-material/Visibility';

const ChartOfAccounts = () => {
  const { darkMode } = useDarkMode();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Endpoint to get all GL accounts
      const res = await API.get('/accounting/accounts');
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const filteredAccounts = accounts.filter(a => 
    a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.code?.includes(searchQuery)
  );

  const getAccountTypeColor = (type) => {
    switch(type) {
      case 'Asset': return 'success';
      case 'Liability': return 'error';
      case 'Equity': return 'warning';
      case 'Revenue': return 'primary';
      case 'Expense': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AccountTreeIcon sx={{ fontSize: 40 }} /> Chart of Accounts
        </Typography>
        <Typography variant="body2" color="text.secondary">Master list of all general ledger accounts</Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
            <TextField
              fullWidth
              placeholder="Search by account name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              }}
            />
          </Paper>
        </Grid>
      </Grid>

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
                  <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Account Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Current Balance</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAccounts.length > 0 ? filteredAccounts.map((account) => (
                  <TableRow key={account._id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{account.code || '-'}</TableCell>
                    <TableCell>{account.name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={account.type} 
                        color={getAccountTypeColor(account.type)} 
                        size="small" 
                        variant="outlined" 
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Rs. {(account.balance || 0).toLocaleString()}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Ledger">
                        <IconButton color="primary">
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      No accounts found
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

export default ChartOfAccounts;
