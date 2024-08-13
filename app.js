const express = require("express");
const cors = require("cors");
const stripe = require("stripe")("sk_test_51PiAAHRv0Tzi9A7A4GibaM6hNhyQV408BrU4HuzBu2n6YjDwsthNkFWkD8Zp62NKClcg7zHZ6gJ97duvwY5VZonC00uExZvqzZ");

const app = express();

app.use(express.json());
app.use(cors());

app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { products } = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).send('Invalid products data');
        }

        
        const lineItems = products.map(product => ({
            price_data: {
                currency: 'pkr',
                product_data: {
                    name: product.name,
                    images: [product.cover.startsWith('http') ? product.cover : `http://localhost:3000${product.cover}`] 
                },
                unit_amount: product.price * 100,
            },
            quantity: product.quantity || 1 
        }));

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: lineItems,
            mode: "payment",
            success_url: "http://localhost:5173/success",
            cancel_url: "http://localhost:5173/cancel",
        });
        res.json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).send(`Internal Server Error: ${error.message}`);
    }
});

app.listen(7000, () => {
    console.log("Server listening on port 7000");
});
