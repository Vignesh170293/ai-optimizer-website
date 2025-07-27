// /api/gumroad.js
// This Vercel Serverless Function acts as a secure proxy to the Gumroad API.
// It relies on a GUMROAD_ACCESS_TOKEN Environment Variable set in your Vercel project.
// CORS headers are now handled by the vercel.json configuration file.

export default async function handler(request, response) {
  // --- CONFIGURATION ---
  const GUMROAD_ACCESS_TOKEN = process.env.GUMROAD_ACCESS_TOKEN;
  const PRODUCT_ID = 'rdcvzn'; // Your Gumroad Product ID

  // --- Main Logic ---
  try {
    // Step 1: Check for the Access Token
    if (!GUMROAD_ACCESS_TOKEN) {
      // This error will appear in your Vercel logs if the environment variable is not set.
      throw new Error("GUMROAD_ACCESS_TOKEN environment variable is not set.");
    }

    // Step 2: Fetch data from Gumroad API using a Bearer token
    const productUrl = `https://api.gumroad.com/v2/products/${PRODUCT_ID}`;
    const productRes = await fetch(productUrl, {
      headers: {
        'Authorization': `Bearer ${GUMROAD_ACCESS_TOKEN}`
      }
    });

    // Step 3: Check if the Gumroad API call was successful
    if (!productRes.ok) {
      const errorBody = await productRes.text();
      // Provide a detailed error message for easier debugging in Vercel logs
      throw new Error(`Gumroad API responded with status ${productRes.status}. Details: ${errorBody}`);
    }
    
    const productData = await productRes.json();

    // Step 4: Send the relevant data back to your website
    // We select only the data we need to send to the frontend.
    const responseData = {
      sales_count: productData.product.sales_count,
      rating_average: parseFloat(productData.product.rating.average_rating),
      rating_count: productData.product.rating.count,
      formatted_price: productData.product.formatted_price,
      permalink: productData.product.permalink
    };
    
    // Set a Cache-Control header to cache the response at the edge for 1 hour
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return response.status(200).json(responseData);

  } catch (error) {
    // This will catch any errors from the steps above and log them in Vercel.
    console.error("Error in Vercel function:", error.message);
    // Return a structured error to the frontend
    return response.status(500).json({ 
      error: "An internal server error occurred.", 
      details: error.message 
    });
  }
}
