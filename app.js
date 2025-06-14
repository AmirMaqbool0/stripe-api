require('dotenv').config(); // Load environment variables
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "sk_test_51RZ80x2NylYdi9wzyebzcTTFSAFC3YHm4hDDvPmUGdBjl8fiWtKlLJqkyfLEAkBFT9eLK5IENtJySnlkBDzZpQo400m3OSWo1D");

const app = express();

// Enhanced CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'https://your-frontend-domain.com' // Replace with your actual frontend domain
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint with improved response
app.get("/", (req, res) => {
  res.status(200).json({
    status: "active",
    message: "Stripe Payment API is running",
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Create Checkout Session with enhanced validation
app.post("/api/create-checkout", async (req, res) => {
  try {
    const { products, orderId, customerEmail } = req.body;

    // Validate request data
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Products array is required and cannot be empty",
        path: req.path
      });
    }

    // Prepare line items with enhanced validation
    const lineItems = products.map((product, index) => {
      // Validate required fields
      if (!product.name || typeof product.name !== 'string') {
        throw new Error(`Product ${index + 1}: Name is required and must be a string`);
      }
      
      const price = Number(product.price);
      if (isNaN(price) || price <= 0) {
        throw new Error(`Product '${product.name}': Price must be a positive number`);
      }

      const quantity = Math.max(1, Number(product.quantity) || 1);

      const productData = {
        name: product.name.trim(),
        ...(product.description && { description: product.description.trim() }),
        ...(product.poster && { images: [product.poster] })
      };

      return {
        price_data: {
          currency: 'usd',
          product_data: productData,
          unit_amount: Math.round(price * 100), // Convert to cents
        },
        quantity: quantity
      };
    });

    // Create Stripe session with enhanced metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.FRONTEND_SUCCESS_URL || 'http://localhost:5173/success'}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_CANCEL_URL || 'http://localhost:5173/cancel'}`,
      client_reference_id: orderId,
      customer_email: customerEmail,
      metadata: {
        orderId: orderId,
        productsCount: products.length.toString(),
        environment: process.env.NODE_ENV || 'development'
      },
      shipping_address_collection: {
        allowed_countries: ['US', 'GB', 'CA'] // Customize as needed
      }
    });

    res.json({
      success: true,
      id: session.id,
      url: session.url,
      amount_total: session.amount_total,
      currency: session.currency
    });

  } catch (error) {
    console.error("Stripe Error:", error);
    
    const statusCode = error.type === 'StripeInvalidRequestError' ? 400 : 500;
    const errorResponse = {
      error: error.type || 'PaymentError',
      message: error.message || 'Failed to create checkout session',
      path: req.path,
      timestamp: new Date().toISOString()
    };

    // Include additional details in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = {
        raw: error.raw,
        stack: error.stack
      };
    }

    res.status(statusCode).json(errorResponse);
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `The requested resource ${req.path} was not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({
    error: "InternalServerError",
    message: "Something went wrong",
    path: req.path,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Server configuration
const PORT = process.env.PORT || 7000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`API URL: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`Stripe endpoint: http://localhost:${PORT}/api/create-checkout`);
});

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server terminated');
  });
});

module.exports = app;