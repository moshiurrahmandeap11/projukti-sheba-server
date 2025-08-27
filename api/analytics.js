const express = require("express");
const { BetaAnalyticsDataClient } = require("@google-analytics/data");
require("dotenv").config();

const router = express.Router();

// Parse GA4 credentials from .env
let credentials;
try {
  credentials = JSON.parse(process.env.GA4_CREDENTIALS);
} catch (error) {
  console.error("Error parsing GA4_CREDENTIALS from .env:", error.message);
  credentials = {};
}

// Google Analytics client init
const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials,
});

// Function to fetch data
async function getAnalyticsData() {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      dimensions: [
        { name: "country" },
        { name: "deviceCategory" },
        { name: "city" },
        { name: "pagePath" },
      ],
      metrics: [
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "averageSessionDuration" },
        { name: "totalUsers" },
      ],
    });

    // Check if response has rows
    if (!response.rows || response.rows.length === 0) {
      console.log("No analytics data available");
      return {
        newUsers: 0,
        returningUsers: 0,
        geo: {},
        devices: {},
        cities: {},
        exitPages: {},
        avgSessionDuration: 0,
      };
    }

    // Process data for frontend
    const processedData = {
      newUsers: response.rows.reduce((sum, row) => sum + parseInt(row.metricValues[1].value), 0),
      returningUsers: response.rows.reduce(
        (sum, row) => sum + parseInt(row.metricValues[0].value) - parseInt(row.metricValues[1].value),
        0
      ),
      geo: response.rows.reduce((acc, row) => {
        const country = row.dimensionValues[0].value;
        acc[country] = (acc[country] || 0) + parseInt(row.metricValues[0].value);
        return acc;
      }, {}),
      devices: response.rows.reduce((acc, row) => {
        const device = row.dimensionValues[1].value;
        acc[device] = (acc[device] || 0) + parseInt(row.metricValues[0].value);
        return acc;
      }, {}),
      cities: response.rows.reduce((acc, row) => {
        const city = row.dimensionValues[2].value;
        acc[city] = (acc[city] || 0) + parseInt(row.metricValues[0].value);
        return acc;
      }, {}),
      exitPages: response.rows.reduce((acc, row) => {
        const page = row.dimensionValues[3].value;
        acc[page] = (acc[page] || 0) + parseInt(row.metricValues[0].value);
        return acc;
      }, {}),
      avgSessionDuration: response.rows.reduce(
        (sum, row) => sum + parseFloat(row.metricValues[2].value),
        0
      ) / response.rows.length,
    };

    return processedData;
  } catch (error) {
    console.error("Error fetching analytics data:", error.message, error.stack);
    return {
      newUsers: 0,
      returningUsers: 0,
      geo: {},
      devices: {},
      cities: {},
      exitPages: {},
      avgSessionDuration: 0,
    };
  }
}

// API route
router.get("/", async (req, res) => {
  try {
    const data = await getAnalyticsData();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in analytics route:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Failed to fetch analytics data" });
  }
});

module.exports = { router };