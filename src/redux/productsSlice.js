import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api/api';

export const fetchProducts = createAsyncThunk('products/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const res = await API.get('/products');
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch products');
  }
});

export const fetchProductById = createAsyncThunk('products/fetchById', async (id, { rejectWithValue }) => {
  try {
    const res = await API.get(`/products/${id}`);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch product');
  }
});

export const createProduct = createAsyncThunk('products/create', async (productData, { rejectWithValue }) => {
  try {
    const res = await API.post('/products', productData);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to create product');
  }
});

export const updateProduct = createAsyncThunk('products/update', async ({ id, ...productData }, { rejectWithValue }) => {
  try {
    const res = await API.put(`/products/${id}`, productData);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to update product');
  }
});

export const deleteProduct = createAsyncThunk('products/delete', async (id, { rejectWithValue }) => {
  try {
    await API.delete(`/products/${id}`);
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to delete product');
  }
});

const productsSlice = createSlice({
  name: 'products',
  initialState: {
    items: [],
    currentProduct: null,
    status: 'idle',
    error: null,
    crudStatus: 'idle',
    crudError: null,
  },
  reducers: {
    applySale(state, action) {
      const soldItems = action.payload || [];
      soldItems.forEach(sold => {
        const product = state.items.find(p => p._id === sold.productId || p.SKU === sold.SKU);
        if (!product) return;
        const piecesPerCarton = Number(product.piecesPerCarton) || 0;
        const cartonQuantity = Number(product.cartonQuantity) || 0;
        const losePieces = Number(product.losePieces) || 0;
        const totalPieces = (cartonQuantity * piecesPerCarton) + losePieces;
        const remaining = Math.max(0, totalPieces - (Number(sold.quantity) || 0));
        const newCartons = piecesPerCarton > 0 ? Math.floor(remaining / piecesPerCarton) : 0;
        const newLose = piecesPerCarton > 0 ? (remaining % piecesPerCarton) : remaining;
        product.cartonQuantity = newCartons;
        product.losePieces = newLose;
      });
    },
    clearCurrentProduct(state) {
      state.currentProduct = null;
    },
    clearCrudStatus(state) {
      state.crudStatus = 'idle';
      state.crudError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch products';
      })
      .addCase(fetchProductById.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.currentProduct = action.payload;
        state.status = 'succeeded';
      })
      .addCase(fetchProductById.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(createProduct.pending, (state) => {
        state.crudStatus = 'loading';
        state.crudError = null;
      })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.crudStatus = 'succeeded';
      })
      .addCase(createProduct.rejected, (state, action) => {
        state.crudStatus = 'failed';
        state.crudError = action.payload;
      })
      .addCase(updateProduct.pending, (state) => {
        state.crudStatus = 'loading';
        state.crudError = null;
      })
      .addCase(updateProduct.fulfilled, (state, action) => {
        const index = state.items.findIndex(p => p._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        state.currentProduct = action.payload;
        state.crudStatus = 'succeeded';
      })
      .addCase(updateProduct.rejected, (state, action) => {
        state.crudStatus = 'failed';
        state.crudError = action.payload;
      })
      .addCase(deleteProduct.pending, (state) => {
        state.crudStatus = 'loading';
        state.crudError = null;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.items = state.items.filter(p => p._id !== action.payload);
        state.crudStatus = 'succeeded';
      })
      .addCase(deleteProduct.rejected, (state, action) => {
        state.crudStatus = 'failed';
        state.crudError = action.payload;
      });
  },
});

export const { applySale, clearCurrentProduct, clearCrudStatus } = productsSlice.actions;

export const selectAllProducts = (state) => state.products.items;
export const selectProductById = (state, id) => state.products.items.find(p => p._id === id);
export const selectProductsStatus = (state) => state.products.status;
export const selectProductsError = (state) => state.products.error;
export const selectCrudStatus = (state) => state.products.crudStatus;
export const selectCrudError = (state) => state.products.crudError;
export const selectCurrentProduct = (state) => state.products.currentProduct;

export default productsSlice.reducer;
