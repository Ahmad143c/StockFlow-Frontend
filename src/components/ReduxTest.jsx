import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchProducts } from '../redux/productsSlice';
import { loginUser } from '../redux/authSlice';
import { Button, Box, Typography, Card, CardContent } from '@mui/material';

const ReduxTest = () => {
  const dispatch = useDispatch();
  const { items, status } = useSelector(state => state.products);
  const { user, isAuthenticated } = useSelector(state => state.auth);

  const testProducts = () => {
    console.log('🧪 Testing Redux: Fetching products...');
    dispatch(fetchProducts());
  };

  const testAuth = () => {
    console.log('🧪 Testing Redux: Auth state check...');
    console.log('Current user:', user);
    console.log('Is authenticated:', isAuthenticated);
  };

  return (
    <Box sx={{ p: 2, maxWidth: 600, margin: 'auto' }}>
      <Typography variant="h5" gutterBottom>🔍 Redux Toolkit Test</Typography>
      
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" color="primary">Auth State</Typography>
          <Typography variant="body2">
            User: {user ? user.username : 'Not logged in'}
          </Typography>
          <Typography variant="body2">
            Authenticated: {isAuthenticated ? 'Yes' : 'No'}
          </Typography>
          <Button 
            variant="outlined" 
            onClick={testAuth} 
            sx={{ mt: 1 }}
            size="small"
          >
            Test Auth
          </Button>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" color="primary">Products State</Typography>
          <Typography variant="body2">
            Status: {status}
          </Typography>
          <Typography variant="body2">
            Products loaded: {items.length}
          </Typography>
          <Button 
            variant="outlined" 
            onClick={testProducts} 
            sx={{ mt: 1 }}
            size="small"
          >
            Test Products
          </Button>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary">
        Check browser console for detailed Redux logs
      </Typography>
    </Box>
  );
};

export default ReduxTest;
