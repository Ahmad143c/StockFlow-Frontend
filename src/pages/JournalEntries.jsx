import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Grid, CircularProgress, Alert, Chip, Divider,
  TextField, InputAdornment, Button
} from '@mui/material';
import { useDarkMode } from '../context/DarkModeContext';
import API from '../api/api';
import SearchIcon from '@mui/icons-material/Search';
import BookIcon from '@mui/icons-material/Book';
import FilterListIcon from '@mui/icons-material/FilterList';

const JournalEntries = () => {
  const { darkMode } = useDarkMode();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchJournal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get('/accounting/journal');
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      if (e.response?.status === 404) {
        setError('Journal API not found. Please ensure the backend changes are deployed. Fallback: Showing recent sales as journal entries.');
        // Fallback: Fetch sales as a proxy for sales journal
        try {
          const salesRes = await API.get('/sales');
          const sales = Array.isArray(salesRes.data) ? salesRes.data : [];
          const proxyEntries = sales.map(s => ({
            _id: s._id,
            date: s.date || s.createdAt,
            reference: s.invoiceNumber || s._id,
            description: `Sale to ${s.customerName || 'Walk-in'}`,
            accountName: 'Sales Revenue',
            type: 'Credit',
            amount: Number(s.netAmount || s.totalAmount || 0)
          }));
          setEntries(proxyEntries);
        } catch (err) {
          setError('Failed to fetch journal fallback data');
        }
      } else {
        setError(e.response?.data?.message || 'Failed to fetch journal entries');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJournal();
  }, [fetchJournal]);

  const filteredEntries = entries.filter(e => 
    e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.reference?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BookIcon sx={{ fontSize: 40 }} /> Journal Entries
          </Typography>
          <Typography variant="body2" color="text.secondary">Detailed view of all accounting transactions</Typography>
        </Box>
        <Button variant="outlined" startIcon={<FilterListIcon />}>Advanced Filters</Button>
      </Box>

      <Paper elevation={2} sx={{ p: 2, borderRadius: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search by description or reference..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
          }}
        />
      </Paper>

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
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Account</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Debit</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Credit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEntries.length > 0 ? filteredEntries.map((entry, index) => (
                  <TableRow key={entry._id || index} hover>
                    <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{entry.reference || '-'}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>{entry.accountName || entry.accountId?.name}</TableCell>
                    <TableCell align="right" sx={{ color: entry.type === 'Debit' ? 'error.main' : 'inherit', fontWeight: entry.type === 'Debit' ? 600 : 400 }}>
                      {entry.type === 'Debit' ? `Rs. ${entry.amount.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: entry.type === 'Credit' ? 'success.main' : 'inherit', fontWeight: entry.type === 'Credit' ? 600 : 400 }}>
                      {entry.type === 'Credit' ? `Rs. ${entry.amount.toLocaleString()}` : '-'}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      No journal entries found
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

export default JournalEntries;
