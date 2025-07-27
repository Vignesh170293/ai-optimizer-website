// /api/gumroad.js
// This Vercel Serverless Function acts as a secure proxy to the Gumroad API.
// It relies on Environment Variables set in your Vercel project.
// NOTE: All CORS headers are now managed in the vercel.json file.

export default async function handler(request, response) {
  // --- CONFIGURATION ---
  // Ensure you have these environment variables set in your Vercel project settings.
  const GUMROAD_ACCESS_TOKEN = process.env.GUMROAD_ACCESS_TOKEN;
  const PRODUCT_ID = process.env.GUMROAD_PRODUCT_ID || 'rdcvzn'; // Use env var or default

  // --- Main Logic ---
  try {
    // Step 1: Check for the Access Token
    if (!GUMROAD_ACCESS_TOKEN) {
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
    
    // The product API call MUST succeed.
    if (!productRes.ok) {
      const errorBody = await productRes.text();
      throw new Error(`Gumroad Product API responded with status ${productRes.status}. Details: ${errorBody}`);
    }
    
    // The reviews API call can fail with a 404 if there are no reviews.
    let reviewsData;
    if (reviewsRes.ok) {
        reviewsData = await reviewsRes.json();
    } else if (reviewsRes.status === 404) {
        console.log("Gumroad reviews returned 404. This is normal if there are no reviews yet. Proceeding with an empty list.");
        reviewsData = { success: true, reviews: [] }; // Provide a default empty structure
    } else {
        const errorBody = await reviewsRes.text();
        throw new Error(`Gumroad Reviews API responded with status ${reviewsRes.status}. Details: ${errorBody}`);
    }
    
    const productData = await productRes.json();

    // Step 5: Sanitize and structure the data to send back to the frontend
    const responseData = {
      sales_count: productData.product.sales_count,
      // Safely access rating data, providing 0 as a default if it doesn't exist.
      rating_average: parseFloat(productData.product.rating?.average_rating || 0),
      rating_count: productData.product.rating?.count || 0,
      formatted_price: productData.product.formatted_price,
      // FIX: Use the permalink from the API if it exists, otherwise fall back to the hardcoded correct value.
      // The frontend expects the short code, not the full URL.
      permalink: productData.product.permalink || 'rdcvzn', 
      reviews: reviewsData.reviews.map(review => ({
          name: review.user_name,
          rating: review.rating,
          content: review.review_content,
          avatar_id: review.user_name.replace(/[^a-zA-Z0-9]/g, '') 
      }))
    };
    
    // Step 6: Send the combined data back to your website with caching re-enabled.
    response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
    return response.status(200).json(responseData);

  } catch (error) {
    // This will catch any errors from the steps above and log them in Vercel.
    console.error("Error in Vercel function:", error.message);
    return response.status(500).json({ 
      error: "An internal server error occurred while fetching Gumroad data.", 
      details: error.message 
    });
  }
}
