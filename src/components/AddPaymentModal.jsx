import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, MenuItem, Grid, InputAdornment, Box, Typography, Alert
} from '@mui/material';
import API from '../api/api';
import SaveIcon from '@mui/icons-material/Save';

const AddPaymentModal = ({ open, onClose, customer }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'Cash',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let actualCustomerId = customer._id;
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(String(actualCustomerId));

      // If customer is derived from sales but has no real ID in the Customer collection
      // we need to create it first.
      if (!isObjectId || customer.isDerived) {
        const custRes = await API.post('/customers', {
          name: customer.name || actualCustomerId,
          contact: customer.contact || 'N/A',
          email: '',
          address: '',
          previousDue: customer.remainingBalance || 0,
          currentBalance: customer.remainingBalance || 0
        });
        actualCustomerId = custRes.data._id;
      }

      await API.post('/customers/payment', {
        customerId: actualCustomerId,
        ...formData,
        amount: Number(formData.amount)
      });
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to record payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontWeight: 700, bgcolor: 'primary.main', color: 'white' }}>
          Add Payment - {customer?.name}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">Current Balance</Typography>
            <Typography variant="h6" color="error.main" sx={{ fontWeight: 700 }}>
              Rs. {(customer?.remainingBalance || 0).toLocaleString()}
            </Typography>
          </Box>
          <Grid container spacing={2}>
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
            <Grid item xs={12}>
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                name="notes"
                multiline
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Reference number, bank name, etc."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: 'background.default' }}>
          <Button onClick={onClose} color="inherit" disabled={loading}>Cancel</Button>
          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            startIcon={<SaveIcon />}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddPaymentModal;
