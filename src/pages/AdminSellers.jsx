import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Fade, Divider, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Avatar, CircularProgress, Alert } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import API from '../api/api';
import { useDarkMode } from '../context/DarkModeContext';

const AdminSellers = () => {
  const { darkMode } = useDarkMode();
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editSeller, setEditSeller] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSeller, setDeleteSeller] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState('');
    const [editPasswordOpen, setEditPasswordOpen] = useState(false);
  const [editPasswordInput, setEditPasswordInput] = useState('');
  const [editPasswordError, setEditPasswordError] = useState('');
  const ADMIN_PASSWORD = 'admin123'; // Change this to your desired password

  
  const handleEditPasswordSubmit = () => {
    if (editPasswordInput === ADMIN_PASSWORD) {
      setEditPasswordOpen(false);
      setEditPasswordError('');
      // Continue with edit
      setEditOpen(true);
    } else {
      setEditPasswordError('Incorrect password');
    }
  };

  const handleEditPasswordClose = () => {
    setEditPasswordOpen(false);
    setEditPasswordError('');
    setEditPasswordInput('');
  };

  const fetchSellers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await API.get('/users/sellers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSellers(res.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch sellers');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  const handleEditClick = (seller) => {
    setEditSeller(seller);
    setEditForm({
      shopName: seller.shopName || '',
      username: seller.username || '',
      sellingPoint: seller.sellingPoint || '',
      productCategory: seller.productCategory || '',
      password: ''
    });
    setEditPasswordError('');
    setEditPasswordInput('');
    setEditPasswordOpen(true);
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');
    try {
      const token = localStorage.getItem('token');
      await API.put(`/auth/update/${editSeller._id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditSuccess('Seller updated successfully!');
      setEditLoading(false);
      setEditOpen(false);
      fetchSellers();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update seller');
      setEditLoading(false);
    }
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setEditSeller(null);
    setEditError('');
    setEditSuccess('');
  };

  const handleDeleteClick = (seller) => {
    setDeleteSeller(seller);
    setDeleteOpen(true);
  };

  const handleDeleteClose = () => {
    setDeleteOpen(false);
    setDeleteSeller(null);
  };

  const generateSellerPDF = async (seller) => {
    setPdfDownloading(true);
    setPdfError('');
    try {
      const token = localStorage.getItem('token');
      
      // Fetch seller's sales
      const salesRes = await API.get(`/sales?sellerId=${seller._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Fetch seller's refunds
      const refundsRes = await API.get(`/sales/refunds?sellerId=${seller._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const sales = Array.isArray(salesRes.data) ? salesRes.data : [];
      const refunds = Array.isArray(refundsRes.data) ? refundsRes.data : [];
      
      // Generate HTML for PDF
      const html = generateSellerReportHTML(seller, sales, refunds);
      
      // Open print window
      const printWindow = window.open('', '_blank');
      if (!printWindow || !printWindow.document) {
        setPdfError('Popup blocked. Please allow popups to download the report.');
        setPdfDownloading(false);
        return;
      }
      
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
      
      setPdfDownloading(false);
      return true;
    } catch (err) {
      setPdfError(err.response?.data?.message || 'Failed to generate report');
      setPdfDownloading(false);
      return false;
    }
  };

  const generateSellerReportHTML = (seller, sales, refunds) => {
    const totalSales = sales.reduce((sum, s) => sum + Number(s.netAmount || 0), 0);
    const totalRefunds = refunds.reduce((sum, r) => {
      // Use the same calculation logic as AdminRefunds.jsx
      if (r && (Number(r.totalRefundAmount) || 0) > 0) return sum + Number(r.totalRefundAmount || 0);
      return sum + (r.items || []).reduce((itemTotal, item) => {
        const price = Number(item.perPiecePrice || item.price || 0);
        const qty = Number(item.quantity || 0);
        return itemTotal + (price * qty);
      }, 0);
    }, 0);
    
    const salesRows = sales.map((sale, idx) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${sale.invoiceNumber || sale._id?.substr(-6) || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${new Date(sale.createdAt).toLocaleDateString()}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${sale.customerName || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${sale.items?.length || 0}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">Rs. ${Number(sale.netAmount || 0).toLocaleString()}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${sale.paymentStatus || '-'}</td>
      </tr>
    `).join('');
    
    const refundsRows = refunds.map((refund, idx) => {
      // Calculate refund amount using the same logic as AdminRefunds.jsx
      let refundAmount = 0;
      if (refund && (Number(refund.totalRefundAmount) || 0) > 0) {
        refundAmount = Number(refund.totalRefundAmount || 0);
      } else {
        refundAmount = (refund.items || []).reduce((itemTotal, item) => {
          const price = Number(item.perPiecePrice || item.price || 0);
          const qty = Number(item.quantity || 0);
          return itemTotal + (price * qty);
        }, 0);
      }
      
      return `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${refund.invoiceNumber || refund._id?.substr(-6) || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${new Date(refund.createdAt).toLocaleDateString()}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${refund.customerName || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${refund.items?.length || 0}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">Rs. ${refundAmount.toLocaleString()}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${refund.reason || '-'}</td>
      </tr>
    `;
    }).join('');
    
    return `
      <html>
        <head>
          <title>Seller Deletion Report - ${seller.username}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1976d2; padding-bottom: 15px; }
            .seller-info { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .summary { display: flex; justify-content: space-around; margin-bottom: 30px; }
            .summary-item { text-align: center; padding: 15px; background: #e3f2fd; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #1976d2; color: white; padding: 10px; text-align: left; }
            td { padding: 8px; border: 1px solid #ddd; }
            tr:nth-child(even) { background: #f9f9f9; }
            .section-title { color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 5px; margin: 30px 0 15px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Seller Deletion Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="seller-info">
            <h2>Seller Information</h2>
            <p><strong>Username:</strong> ${seller.username}</p>
            <p><strong>Shop Name:</strong> ${seller.shopName || '-'}</p>
            <p><strong>Email:</strong> ${seller.email || '-'}</p>
            <p><strong>Contact:</strong> ${seller.contact || '-'}</p>
            <p><strong>Selling Point:</strong> ${seller.sellingPoint || '-'}</p>
            <p><strong>Member Since:</strong> ${seller.createdAt ? new Date(seller.createdAt).toLocaleDateString() : '-'}</p>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <h3>Total Sales</h3>
              <p style="font-size: 24px; font-weight: bold; color: #4caf50;">Rs. ${totalSales.toLocaleString()}</p>
            </div>
            <div class="summary-item">
              <h3>Total Refunds</h3>
              <p style="font-size: 24px; font-weight: bold; color: #f44336;">Rs. ${totalRefunds.toLocaleString()}</p>
            </div>
            <div class="summary-item">
              <h3>Net Amount</h3>
              <p style="font-size: 24px; font-weight: bold; color: #2196f3;">Rs. ${(totalSales - totalRefunds).toLocaleString()}</p>
            </div>
          </div>
          
          <h2 class="section-title">Sales Records (${sales.length})</h2>
          <table>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Invoice</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${salesRows || '<tr><td colspan="7" style="text-align: center;">No sales found</td></tr>'}
            </tbody>
          </table>
          
          <h2 class="section-title">Refund Records (${refunds.length})</h2>
          <table>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Invoice</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${refundsRows || '<tr><td colspan="7" style="text-align: center;">No refunds found</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const handleDeleteConfirm = async () => {
    // First download PDF
    const pdfSuccess = await generateSellerPDF(deleteSeller);
    if (!pdfSuccess) {
      return; // Stop if PDF generation failed
    }
    
    // Then proceed with deletion
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Delete all sales for this seller
      await API.delete(`/sales/seller/${deleteSeller._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Delete all refunds for this seller
      await API.delete(`/sales/refunds/seller/${deleteSeller._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Delete the seller
      await API.delete(`/auth/delete/${deleteSeller._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setDeleteLoading(false);
      setDeleteOpen(false);
      setDeleteSeller(null);
      fetchSellers();
    } catch (err) {
      setDeleteLoading(false);
      alert(err.response?.data?.message || 'Failed to delete seller and associated data');
    }
  };

  if (loading) return <Typography>Loading sellers...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Fade in timeout={500}>
      <Box sx={{ mt: 2, width: '100%', backgroundColor: darkMode ? '#121212' : '#fafafa', minHeight: '100vh', px: { xs: 1, sm: 2 } }}>
        <Typography variant="h4" gutterBottom fontWeight={700} align="center" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>Seller List</Typography>
        <Paper elevation={4} sx={{ p: { xs: 2, md: 3 }, width: '100%', borderRadius: 4, backgroundColor: darkMode ? '#1e1e1e' : '#fff' }}>
          <List sx={{ width: '100%' }}>
            {sellers.length === 0 && <Typography align="center">No sellers found.</Typography>}
            {sellers.map(seller => (
              <React.Fragment key={seller._id}>
                <ListItem sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 1, sm: 2 }, bgcolor: darkMode ? '#2a2a2a' : '#f5f5f5', borderRadius: 2, mb: 2, boxShadow: 1, p: { xs: 2, sm: 3 } }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mb: { xs: 1, sm: 0 }, mr: { xs: 0, sm: 2 } }}>{seller.username[0]?.toUpperCase()}</Avatar>
                  <Box sx={{ flexGrow: 1, width: '100%' }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ wordBreak: 'break-word' }}>{seller.username}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>Shop: {seller.shopName || '-'}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>Selling Point: {seller.sellingPoint || '-'}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>Category: {seller.productCategory || '-'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                    <IconButton color="primary" onClick={() => handleEditClick(seller)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDeleteClick(seller)}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Paper>

        <Dialog open={editPasswordOpen} onClose={handleEditPasswordClose} maxWidth="xs" fullWidth>
          <DialogTitle>Enter Password to Edit</DialogTitle>
          <DialogContent>
            <TextField
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              value={editPasswordInput}
              onChange={(e) => setEditPasswordInput(e.target.value)}
              error={!!editPasswordError}
              helperText={editPasswordError}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleEditPasswordSubmit();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleEditPasswordClose}>Close</Button>
            <Button onClick={handleEditPasswordSubmit} variant="contained">Submit</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={editOpen} onClose={handleEditClose} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 1, sm: 2 } } }}>
          <DialogTitle sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>Edit Seller Info</DialogTitle>
          <DialogContent>
            <TextField label="Shop Name" name="shopName" fullWidth margin="normal" value={editForm.shopName} onChange={handleEditChange} required />
            <TextField label="Username" name="username" fullWidth margin="normal" value={editForm.username} onChange={handleEditChange} required />
            <TextField label="Selling Point" name="sellingPoint" fullWidth margin="normal" value={editForm.sellingPoint} onChange={handleEditChange} required />
            <TextField label="Product Category" name="productCategory" fullWidth margin="normal" value={editForm.productCategory} onChange={handleEditChange} required />
            <TextField
              label="New Password (leave blank to keep current)"
              name="password"
              type="password"
              fullWidth
              margin="normal"
              value={editForm.password}
              onChange={handleEditChange}
              helperText="Enter new password to change, leave blank to keep current password"
            />
            {editError && <Typography color="error" variant="body2">{editError}</Typography>}
            {editSuccess && <Typography color="success.main" variant="body2">{editSuccess}</Typography>}
          </DialogContent>
          <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 } }}>
            <Button onClick={handleEditClose} fullWidth={false} sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>Cancel</Button>
            <Button onClick={handleEditSave} variant="contained" color="primary" disabled={editLoading} fullWidth={false} sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>{editLoading ? 'Saving...' : 'Save'}</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deleteOpen} onClose={handleDeleteClose} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { m: { xs: 1, sm: 2 } } }}>
          <DialogTitle sx={{ color: 'error.main' }}>⚠️ Warning: Delete Seller</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                This will permanently delete the seller and ALL associated data:
              </Typography>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>All sales records</li>
                <li>All refund records</li>
                <li>Seller account information</li>
              </ul>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                This action CANNOT be undone!
              </Typography>
            </Alert>
            
            <Typography variant="body1" sx={{ mb: 2 }}>
              Are you sure you want to delete the seller <strong>{deleteSeller?.username}</strong>?
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              A PDF report of all sales and refunds will be automatically downloaded before deletion for your records.
            </Typography>
            
            {pdfError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {pdfError}
              </Alert>
            )}
            
            {pdfDownloading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Generating report...</Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 } }}>
            <Button onClick={handleDeleteClose} fullWidth={false} sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteConfirm} 
              variant="contained" 
              color="error" 
              disabled={deleteLoading || pdfDownloading}
              startIcon={<DeleteIcon />}
              fullWidth={false} 
              sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
            >
              {deleteLoading ? 'Deleting...' : pdfDownloading ? 'Generating Report...' : 'Download Report & Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default AdminSellers;
