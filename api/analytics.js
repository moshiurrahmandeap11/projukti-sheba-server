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
async function getAnalyticsData(startDate, endDate) {
  try {
    // Aggregate report for totals
    const [aggregateResponse] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "averageSessionDuration" },
      ],
    });

    const processedData = {
      newUsers: 0,
      returningUsers: 0,
      avgSessionDuration: 0,
      geo: {},
      devices: {},
      exitPages: {},
      funnel: { visitors: 0, leads: 0, clients: 0 },
      sources: {},
    };

    if (aggregateResponse.rows && aggregateResponse.rows.length > 0) {
      const row = aggregateResponse.rows[0];
      processedData.totalUsers = parseInt(row.metricValues[0].value);
      processedData.newUsers = parseInt(row.metricValues[1].value);
      processedData.returningUsers = processedData.totalUsers - processedData.newUsers;
      processedData.avgSessionDuration = parseFloat(row.metricValues[2].value);
      processedData.funnel.visitors = processedData.totalUsers;
    }

    // Main report for dimensions
    const [mainResponse] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: "country" },
        { name: "deviceCategory" },
        { name: "pagePath" },
      ],
      metrics: [{ name: "activeUsers" }],
    });

    if (mainResponse.rows) {
      processedData.geo = mainResponse.rows.reduce((acc, row) => {
        const country = row.dimensionValues[0].value;
        acc[country] = (acc[country] || 0) + parseInt(row.metricValues[0].value);
        return acc;
      }, {});

      processedData.devices = mainResponse.rows.reduce((acc, row) => {
        const device = row.dimensionValues[1].value;
        acc[device] = (acc[device] || 0) + parseInt(row.metricValues[0].value);
        return acc;
      }, {});

      processedData.exitPages = mainResponse.rows.reduce((acc, row) => {
        const page = row.dimensionValues[2].value;
        acc[page] = (acc[page] || 0) + parseInt(row.metricValues[0].value);
        return acc;
      }, {});
    }

    // Event report for funnel
    const [eventResponse] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
    });

    if (eventResponse.rows) {
      for (const row of eventResponse.rows) {
        const eventName = row.dimensionValues[0].value;
        const count = parseInt(row.metricValues[0].value);
        if (eventName === "generate_lead") {
          processedData.funnel.leads = count;
        } else if (eventName === "purchase") {
          processedData.funnel.clients = count;
        }
      }
    }

    // Sources report
    const [sourcesResponse] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
    });

    if (sourcesResponse.rows) {
      processedData.sources = sourcesResponse.rows.reduce((acc, row) => {
        const source = row.dimensionValues[0].value;
        acc[source] = parseInt(row.metricValues[0].value);
        return acc;
      }, {});
    }

    return processedData;
  } catch (error) {
    console.error("Error fetching analytics data:", error.message, error.stack);
    return {
      newUsers: 0,
      returningUsers: 0,
      geo: {},
      devices: {},
      exitPages: {},
      avgSessionDuration: 0,
      funnel: { visitors: 0, leads: 0, clients: 0 },
      sources: {},
    };
  }
}

// API route
router.get("/", async (req, res) => {
  try {
    const startDate = req.query.startDate || "7daysAgo";
    const endDate = req.query.endDate || "today";
    const data = await getAnalyticsData(startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in analytics route:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Failed to fetch analytics data" });
  }
});

module.exports = { router };