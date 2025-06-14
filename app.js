const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(
  "sk_test_51RZ80x2NylYdi9wzyebzcTTFSAFC3YHm4hDDvPmUGdBjl8fiWtKlLJqkyfLEAkBFT9eLK5IENtJySnlkBDzZpQo400m3OSWo1D"
);

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Health check endpoint
app.get("/", (req, res) => {
  res
    .status(200)
    .json({ status: "active", message: "Stripe Payment API is running" });
});

// Create Checkout Session
app.post("/api/create-checkout", async (req, res) => {
  try {
    const { products, orderId, customerEmail } = req.body;

    // Validate request data
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        error: "Validation failed",
        message: "Products array is required and cannot be empty",
      });
    }

    // Prepare line items with validation
    const lineItems = products.map(product => {
    return {
        price_data: {
            currency: 'usd',
            product_data: {
                name: product.name.trim(),
                // Only include description if it has content
                ...(product.description && { description: product.description }),
                // Only include images if available
                ...(product.poster && { images: [product.poster] })
            },
            unit_amount: Math.round(Number(product.price) * 100),
        },
        quantity: Math.max(1, Number(product.quantity) || 1)
    };
});
    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url:
        "http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:5173/cancel",
      client_reference_id: orderId,
      customer_email: customerEmail,
      metadata: {
        orderId: orderId,
        productsCount: products.length.toString(),
      },
    });

    res.json({
      success: true,
      id: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe Error:", error);

    const statusCode = error.type === "StripeInvalidRequestError" ? 400 : 500;

    res.status(statusCode).json({
      error: error.type || "PaymentError",
      message: error.message || "Failed to create checkout session",
      details:
        process.env.NODE_ENV === "development"
          ? {
              raw: error.raw,
              stack: error.stack,
            }
          : undefined,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({
    error: "InternalServerError",
    message: "Something went wrong",
  });
});

// Start server
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Endpoint: http://localhost:${PORT}/api/create-checkout`);
});
