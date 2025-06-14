require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const serverless = require('@netlify/express');
const app = express();

// Enhanced CORS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://your-frontend.vercel.app' // ACTUAL frontend URL
  ],
  methods: ['GET', 'POST', 'OPTIONS']
}));

// Routes
app.get('/', (req, res) => res.json({ status: 'API Live 🚀' }));

app.post('/api/create-checkout', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: req.body.products.map(p => ({
        price_data: {
          currency: 'usd',
          product_data: { name: p.name },
          unit_amount: Math.round(p.price * 100),
        },
        quantity: p.quantity || 1
      })),
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vercel-specific export
module.exports = app;
module.exports.handler = serverless(app);
// Local development
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 7000;
  app.listen(PORT, () => {
    console.log(`Local server: http://localhost:${PORT}`);
  });
}