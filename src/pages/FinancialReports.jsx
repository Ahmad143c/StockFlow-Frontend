import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Tabs, Tab, Grid, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Button
} from '@mui/material';
import API from '../api/api';
import BarChartIcon from '@mui/icons-material/BarChart';
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

const FinancialReports = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);

  const fetchReport = useCallback(async (type) => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = '';
      if (type === 0) endpoint = '/accounting/trial-balance';
      else if (type === 1) endpoint = '/accounting/profit-loss';
      else if (type === 2) endpoint = '/accounting/balance-sheet';

      const res = await API.get(endpoint);
      setReportData(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(tabValue);
  }, [tabValue, fetchReport]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const renderTrialBalance = () => {
    const accounts = Array.isArray(reportData) ? reportData : (reportData?.accounts || []);
    const totalDebit = accounts.reduce((s, a) => s + (a.category === 'Assets' || a.category === 'Expenses' ? a.balance : 0), 0);
    const totalCredit = accounts.reduce((s, a) => s + (a.category === 'Liabilities' || a.category === 'Equity' || a.category === 'Income' ? a.balance : 0), 0);
    
    return (
      <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ color: 'white', fontWeight: 700 }}>Account Name</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 700 }} align="right">Debit</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 700 }} align="right">Credit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((acc, i) => {
              const isDebit = acc.category === 'Assets' || acc.category === 'Expenses';
              return (
                <TableRow key={i} hover>
                  <TableCell>{acc.name} ({acc.code})</TableCell>
                  <TableCell align="right">{isDebit ? `Rs. ${acc.balance.toLocaleString()}` : '-'}</TableCell>
                  <TableCell align="right">{!isDebit ? `Rs. ${acc.balance.toLocaleString()}` : '-'}</TableCell>
                </TableRow>
              );
            })}
            <TableRow sx={{ bgcolor: 'action.hover', fontWeight: 700 }}>
              <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Rs. {totalDebit.toLocaleString()}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Rs. {totalCredit.toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderProfitLoss = () => (
    <Paper elevation={2} sx={{ p: 4, borderRadius: 2 }}>
      <Typography variant="h5" align="center" gutterBottom sx={{ fontWeight: 700 }}>Profit & Loss Statement</Typography>
      <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 4 }}>For the period ended {new Date().toLocaleDateString()}</Typography>
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" color="primary" sx={{ fontWeight: 700, mb: 1 }}>Revenue / Income</Typography>
        <Divider sx={{ mb: 1 }} />
        {(reportData?.income || []).map((item, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Typography>{item.name}</Typography>
            <Typography>Rs. {item.balance.toLocaleString()}</Typography>
          </Box>
        ))}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, fontWeight: 700, borderTop: '1px solid #eee' }}>
          <Typography sx={{ fontWeight: 700 }}>Total Revenue</Typography>
          <Typography sx={{ fontWeight: 700 }}>Rs. {(reportData?.totalIncome || 0).toLocaleString()}</Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" color="error" sx={{ fontWeight: 700, mb: 1 }}>Expenses</Typography>
        <Divider sx={{ mb: 1 }} />
        {(reportData?.expenses || []).map((item, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Typography>{item.name}</Typography>
            <Typography>Rs. {item.balance.toLocaleString()}</Typography>
          </Box>
        ))}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, fontWeight: 700, borderTop: '1px solid #eee' }}>
          <Typography sx={{ fontWeight: 700 }}>Total Expenses</Typography>
          <Typography sx={{ fontWeight: 700 }}>Rs. {(reportData?.totalExpenses || 0).toLocaleString()}</Typography>
        </Box>
      </Box>

      <Box sx={{ p: 2, bgcolor: reportData?.netProfit >= 0 ? 'success.light' : 'error.light', borderRadius: 1, display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Net {reportData?.netProfit >= 0 ? 'Profit' : 'Loss'}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Rs. {Math.abs(reportData?.netProfit || 0).toLocaleString()}</Typography>
      </Box>
    </Paper>
  );

  const renderBalanceSheet = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2, height: '100%' }}>
          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700, mb: 2 }}>Assets</Typography>
          {(reportData?.assets || []).map((item, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f0f0f0' }}>
              <Typography variant="body2">{item.name}</Typography>
              <Typography variant="body2">Rs. {item.balance.toLocaleString()}</Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, fontWeight: 700 }}>
            <Typography sx={{ fontWeight: 700 }}>Total Assets</Typography>
            <Typography sx={{ fontWeight: 700 }}>Rs. {reportData?.totalAssets?.toLocaleString()}</Typography>
          </Box>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2, mb: 3 }}>
          <Typography variant="h6" color="error.main" sx={{ fontWeight: 700, mb: 2 }}>Liabilities</Typography>
          {(reportData?.liabilities || []).map((item, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f0f0f0' }}>
              <Typography variant="body2">{item.name}</Typography>
              <Typography variant="body2">Rs. {item.balance.toLocaleString()}</Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, fontWeight: 700 }}>
            <Typography sx={{ fontWeight: 700 }}>Total Liabilities</Typography>
            <Typography sx={{ fontWeight: 700 }}>Rs. {reportData?.totalLiabilities?.toLocaleString()}</Typography>
          </Box>
        </Paper>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" color="warning.main" sx={{ fontWeight: 700, mb: 2 }}>Equity</Typography>
          {(reportData?.equity || []).map((item, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f0f0f0' }}>
              <Typography variant="body2">{item.name}</Typography>
              <Typography variant="body2">Rs. {item.balance.toLocaleString()}</Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, fontWeight: 700 }}>
            <Typography sx={{ fontWeight: 700 }}>Total Equity & Liabilities</Typography>
            <Typography sx={{ fontWeight: 700 }}>Rs. {((reportData?.totalEquity || 0) + (reportData?.totalLiabilities || 0)).toLocaleString()}</Typography>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BarChartIcon sx={{ fontSize: 40 }} /> Financial Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">Trial Balance, Profit & Loss, and Balance Sheet</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<PrintIcon />}>Print</Button>
          <Button variant="outlined" startIcon={<FileDownloadIcon />}>Export PDF</Button>
        </Box>
      </Box>

      <Paper elevation={2} sx={{ mb: 4, borderRadius: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth" indicatorColor="primary" textColor="primary">
          <Tab label="Trial Balance" />
          <Tab label="Profit & Loss" />
          <Tab label="Balance Sheet" />
        </Tabs>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Box>
          {tabValue === 0 && renderTrialBalance()}
          {tabValue === 1 && renderProfitLoss()}
          {tabValue === 2 && renderBalanceSheet()}
        </Box>
      )}
    </Box>
  );
};

export default FinancialReports;
