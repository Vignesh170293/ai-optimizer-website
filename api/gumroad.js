// /api/gumroad.js
// This Vercel Serverless Function acts as a secure proxy to the Gumroad API.
// It relies on a GUMROAD_ACCESS_TOKEN Environment Variable set in your Vercel project.
// It now fetches both product details and product reviews.

export default async function handler(request, response) {
  // --- CONFIGURATION ---
  // Ensure you have these environment variables set in your Vercel project settings.
  const GUMROAD_ACCESS_TOKEN = process.env.GUMROAD_ACCESS_TOKEN;
  const PRODUCT_ID = process.env.GUMROAD_PRODUCT_ID || 'rdcvzn'; // Use environment variable or default

  // --- Main Logic ---
  try {
    // Step 1: Check for the Access Token
    if (!GUMROAD_ACCESS_TOKEN) {
      // This error will appear in your Vercel logs if the environment variable is not set.
      console.error("GUMROAD_ACCESS_TOKEN environment variable is not set.");
      throw new Error("Server configuration error: Missing API token.");
    }

    // Step 2: Define API endpoints
    const productUrl = `https://api.gumroad.com/v2/products/${PRODUCT_ID}`;
    const reviewsUrl = `https://api.gumroad.com/v2/products/${PRODUCT_ID}/reviews`;
    
    const apiHeaders = {
      'Authorization': `Bearer ${GUMROAD_ACCESS_TOKEN}`
    };

    // Step 3: Fetch product and reviews data from Gumroad API in parallel
    const [productRes, reviewsRes] = await Promise.all([
      fetch(productUrl, { headers: apiHeaders }),
      fetch(reviewsUrl, { headers: apiHeaders })
    ]);

    // Step 4: Check if the Gumroad API calls were successful
    if (!productRes.ok) {
      const errorBody = await productRes.text();
      throw new Error(`Gumroad Product API responded with status ${productRes.status}. Details: ${errorBody}`);
    }
    if (!reviewsRes.ok) {
      const errorBody = await reviewsRes.text();
      throw new Error(`Gumroad Reviews API responded with status ${reviewsRes.status}. Details: ${errorBody}`);
    }
    
    const productData = await productRes.json();
    const reviewsData = await reviewsRes.json();

    // Step 5: Sanitize and structure the data to send back to the frontend
    const responseData = {
      // Product Details
      sales_count: productData.product.sales_count,
      rating_average: parseFloat(productData.product.rating.average_rating),
      rating_count: productData.product.rating.count,
      formatted_price: productData.product.formatted_price,
      permalink: productData.product.permalink,
      // Product Reviews
      reviews: reviewsData.reviews.map(review => ({
          name: review.user_name,
          rating: review.rating,
          content: review.review_content,
          // Create a simple hash from the name for a consistent avatar
          avatar_id: review.user_name.replace(/[^a-zA-Z0-9]/g, '') 
      }))
    };
    
    // Step 6: Send the combined data back to your website
    // Set a Cache-Control header to cache the response at the edge for 15 minutes
    response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
    return response.status(200).json(responseData);

  } catch (error) {
    // This will catch any errors from the steps above and log them in Vercel.
    console.error("Error in Vercel function:", error.message);
    // Return a structured error to the frontend for better debugging
    return response.status(500).json({ 
      error: "An internal server error occurred while fetching Gumroad data.", 
      details: error.message 
    });
  }
}
