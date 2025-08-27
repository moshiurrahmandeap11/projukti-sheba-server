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

// Helper function to get common date range
const getDateRange = () => [{ startDate: "7daysAgo", endDate: "today" }];

// 1. Unique/Returning Visitors + Basic Stats (আপনার বর্তমান কোড আপডেট)
async function getVisitorStats() {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: getDateRange(),
      dimensions: [
        { name: "country" }, // Geo
        { name: "deviceCategory" }, // Device
        { name: "browser" }, // Browser
        { name: "pagePath" }, // Most visited pages
        { name: "sessionSourceMedium" }, // Source tracking
      ],
      metrics: [
        { name: "totalUsers" }, // Unique visitors
        { name: "newUsers" }, // New users
        { name: "activeUsers" }, // Active/Returning (totalUsers - newUsers)
        { name: "averageSessionDuration" }, // Session duration
        { name: "engagementRate" }, // For bounce rate (1 - engagementRate)
        { name: "views" }, // Page views for most visited
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      return {
        totalUsers: 0,
        newUsers: 0,
        returningUsers: 0,
        avgSessionDuration: 0,
        bounceRate: 0,
        geo: {},
        devices: {},
        browsers: {},
        mostVisitedPages: {},
        sources: {},
      };
    }

    // Process data
    const processedData = {
      totalUsers: response.rows.reduce((sum, row) => sum + parseInt(row.metricValues[0].value), 0),
      newUsers: response.rows.reduce((sum, row) => sum + parseInt(row.metricValues[1].value), 0),
      returningUsers: 0, // Calculate as totalUsers - newUsers (aggregate later)
      avgSessionDuration: response.rows.reduce((sum, row) => sum + parseFloat(row.metricValues[3].value), 0) / response.rows.length,
      bounceRate: 0, // Calculate as 100 - (engagementRate * 100)
      engagementRate: response.rows.reduce((sum, row) => sum + parseFloat(row.metricValues[4].value), 0) / response.rows.length,
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
      browsers: response.rows.reduce((acc, row) => {
        const browser = row.dimensionValues[2].value;
        acc[browser] = (acc[browser] || 0) + parseInt(row.metricValues[0].value);
        return acc;
      }, {}),
      mostVisitedPages: response.rows.reduce((acc, row) => {
        const page = row.dimensionValues[3].value;
        acc[page] = (acc[page] || 0) + parseInt(row.metricValues[5].value); // Views
        return acc;
      }, {}),
      sources: response.rows.reduce((acc, row) => {
        const source = row.dimensionValues[4].value;
        acc[source] = (acc[source] || 0) + parseInt(row.metricValues[0].value);
        return acc;
      }, {}),
    };

    processedData.returningUsers = processedData.totalUsers - processedData.newUsers;
    processedData.bounceRate = 100 - (processedData.engagementRate * 100);

    return processedData;
  } catch (error) {
    console.error("Error fetching visitor stats:", error.message, error.stack);
    return {
      totalUsers: 0,
      newUsers: 0,
      returningUsers: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      geo: {},
      devices: {},
      browsers: {},
      mostVisitedPages: {},
      sources: {},
    };
  }
}

// 2. CTR (Click-Through Rate) - কাস্টম ইভেন্ট (click/impression) দিয়ে
async function getCTR() {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: getDateRange(),
      dimensions: [
        { name: "eventName" }, // click events
        { name: "pagePath" }, // Page-wise CTR
      ],
      metrics: [
        { name: "eventCount" }, // Clicks
        { name: "eventValue" }, // Impressions or custom value
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      return { ctr: 0, pageCTR: {} };
    }

    const totalClicks = response.rows.reduce((sum, row) => sum + parseInt(row.metricValues[0].value), 0);
    const totalImpressions = response.rows.reduce((sum, row) => sum + parseFloat(row.metricValues[1].value), 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    const pageCTR = response.rows.reduce((acc, row) => {
      const page = row.dimensionValues[1].value;
      const clicks = parseInt(row.metricValues[0].value);
      const impressions = parseFloat(row.metricValues[1].value);
      acc[page] = impressions > 0 ? (clicks / impressions) * 100 : 0;
      return acc;
    }, {});

    return { ctr, pageCTR };
  } catch (error) {
    console.error("Error fetching CTR:", error.message);
    return { ctr: 0, pageCTR: {} };
  }
}

// 3. Scroll Depth - কাস্টম ইভেন্ট (scroll_25, scroll_50, etc.) দিয়ে
async function getScrollDepth() {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: getDateRange(),
      dimensions: [
        { name: "eventName" }, // scroll_25, scroll_50, scroll_75, scroll_100
        { name: "pagePath" },
      ],
      metrics: [
        { name: "eventCount" },
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      return { scrollDepth: {} };
    }

    const scrollDepth = response.rows.reduce((acc, row) => {
      const event = row.dimensionValues[0].value; // e.g., scroll_50
      const page = row.dimensionValues[1].value;
      const count = parseInt(row.metricValues[0].value);
      if (!acc[page]) acc[page] = {};
      acc[page][event] = count;
      return acc;
    }, {});

    return { scrollDepth };
  } catch (error) {
    console.error("Error fetching scroll depth:", error.message);
    return { scrollDepth: {} };
  }
}

// 4. Source Tracking (আপনার কোডে আছে, এক্সপ্যান্ড)
async function getSourceTracking() {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: getDateRange(),
      dimensions: [
        { name: "sessionSourceMedium" },
        { name: "sessionCampaignSource" },
        { name: "sessionCampaignMedium" },
      ],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      return { sources: {} };
    }

    const sources = response.rows.reduce((acc, row) => {
      const sourceMedium = row.dimensionValues[0].value;
      const sessions = parseInt(row.metricValues[0].value);
      acc[sourceMedium] = (acc[sourceMedium] || 0) + sessions;
      return acc;
    }, {});

    return { sources };
  } catch (error) {
    console.error("Error fetching source tracking:", error.message);
    return { sources: {} };
  }
}

// 5. Page Load Speed / Core Web Vitals
async function getCoreWebVitals() {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: getDateRange(),
      dimensions: [
        { name: "pagePath" },
        { name: "webVitalRecommendation" }, // LCP, FID, CLS recommendations
      ],
      metrics: [
        { name: "eventCount" }, // Events for vitals
        { name: "averageLcpDuration" }, // LCP
        { name: "averageFidDuration" }, // FID
        { name: "averageClsDuration" }, // CLS
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      return { coreWebVitals: {} };
    }

    const coreWebVitals = response.rows.reduce((acc, row) => {
      const page = row.dimensionValues[0].value;
      const vital = row.dimensionValues[1].value;
      const lcp = parseFloat(row.metricValues[1].value);
      const fid = parseFloat(row.metricValues[2].value);
      const cls = parseFloat(row.metricValues[3].value);
      if (!acc[page]) acc[page] = {};
      acc[page][vital] = { lcp, fid, cls };
      return acc;
    }, {});

    return { coreWebVitals };
  } catch (error) {
    console.error("Error fetching Core Web Vitals:", error.message);
    return { coreWebVitals: {} };
  }
}

// 6. Error Tracking - কাস্টম ইভেন্ট (error_event) দিয়ে
async function getErrorTracking() {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: getDateRange(),
      dimensions: [
        { name: "eventName" }, // error_event
        { name: "customEvent:errorType" }, // Custom dimension for error type
        { name: "pagePath" },
      ],
      metrics: [
        { name: "eventCount" },
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      return { errors: {} };
    }

    const errors = response.rows.reduce((acc, row) => {
      const event = row.dimensionValues[0].value;
      const errorType = row.dimensionValues[1].value;
      const page = row.dimensionValues[2].value;
      const count = parseInt(row.metricValues[0].value);
      if (event === 'error_event') {
        if (!acc[page]) acc[page] = {};
        acc[page][errorType] = (acc[page][errorType] || 0) + count;
      }
      return acc;
    }, {});

    return { errors };
  } catch (error) {
    console.error("Error fetching error tracking:", error.message);
    return { errors: {} };
  }
}

// 7. Security Events - কাস্টম ইভেন্ট (security_violation) দিয়ে
async function getSecurityEvents() {
  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dateRanges: getDateRange(),
      dimensions: [
        { name: "eventName" }, // security_violation
        { name: "customEvent:securityType" }, // Custom dimension for security type
        { name: "pagePath" },
      ],
      metrics: [
        { name: "eventCount" },
      ],
    });

    if (!response.rows || response.rows.length === 0) {
      return { securityEvents: {} };
    }

    const securityEvents = response.rows.reduce((acc, row) => {
      const event = row.dimensionValues[0].value;
      const securityType = row.dimensionValues[1].value;
      const page = row.dimensionValues[2].value;
      const count = parseInt(row.metricValues[0].value);
      if (event === 'security_violation') {
        if (!acc[page]) acc[page] = {};
        acc[page][securityType] = (acc[page][securityType] || 0) + count;
      }
      return acc;
    }, {});

    return { securityEvents };
  } catch (error) {
    console.error("Error fetching security events:", error.message);
    return { securityEvents: {} };
  }
}

// Routes
router.get("/", async (req, res) => { // Basic (আপনার বর্তমান রুট)
  try {
    const data = await getVisitorStats(); // আপডেটেড visitor stats
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error in analytics route:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch analytics data" });
  }
});

router.get("/ctr", async (req, res) => {
  try {
    const data = await getCTR();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch CTR" });
  }
});

router.get("/scroll-depth", async (req, res) => {
  try {
    const data = await getScrollDepth();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch scroll depth" });
  }
});

router.get("/sources", async (req, res) => {
  try {
    const data = await getSourceTracking();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch sources" });
  }
});

router.get("/core-web-vitals", async (req, res) => {
  try {
    const data = await getCoreWebVitals();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch Core Web Vitals" });
  }
});

router.get("/errors", async (req, res) => {
  try {
    const data = await getErrorTracking();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch errors" });
  }
});

router.get("/security", async (req, res) => {
  try {
    const data = await getSecurityEvents();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch security events" });
  }
});

module.exports = { router };