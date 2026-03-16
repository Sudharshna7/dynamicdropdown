// server.js
const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

// ====== Environment Variables ======
const JIRA_DOMAIN = process.env.JIRA_DOMAIN; // e.g., "https://yourcompany.atlassian.net"
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;
const TEMPO_BEARER_TOKEN = process.env.TEMPO_BEARER_TOKEN;

// ====== Helper Functions ======

// Decode HTML entities from Jira options
function decodeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Fetch all Jira fields (paginated)
async function getAllJiraFields() {
  let startAt = 0, allFields = [], total = 0;
  const maxResults = 100;

  do {
    const res = await axios.get(
      `${JIRA_DOMAIN}/rest/api/3/field/search?startAt=${startAt}&maxResults=${maxResults}`,
      { auth: { username: EMAIL, password: API_TOKEN }, headers: { Accept: "application/json" } }
    );
    allFields = allFields.concat(res.data.values);
    total = res.data.total;
    startAt += res.data.values.length;
  } while (startAt < total);

  console.log(`Total Jira fields fetched: ${allFields.length}`);
  return allFields;
}

// Get contexts for a Jira field
async function getJiraFieldContexts(fieldId) {
  const res = await axios.get(`${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context`, {
    auth: { username: EMAIL, password: API_TOKEN },
    headers: { Accept: "application/json" },
  });
  return res.data.values || [];
}

// Get options for a Jira field context
async function getContextOptions(fieldId, contextId) {
  const res = await axios.get(
    `${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context/${contextId}/option`,
    { auth: { username: EMAIL, password: API_TOKEN }, headers: { Accept: "application/json" } }
  );
  return res.data.values || [];
}

// Tempo UUID → friendly name
async function getTempoAccountName(uuid) {
  try {
    const res = await axios.get("https://api.tempo.io/4/work-attributes/_Account1_", {
      headers: { Authorization: `Bearer ${TEMPO_BEARER_TOKEN}` },
    });
    return res.data.names[uuid];
  } catch (err) {
    console.error("Error fetching Tempo Account1 mapping:", err.message);
    return null;
  }
}

// ====== Main Endpoint ======
app.get("/tasks", async (req, res) => {
  const params = req.query;

  // Tempo verification
  if (params.tempoVerificationToken) {
    console.log("Tempo verification received:", params.tempoVerificationToken);
    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("Tempo verification token received");
  }

  const callback = params.callback || "fn";

  // Grab fieldName and fieldValue from query
  let fieldName, fieldValue;
  for (const [k, v] of Object.entries(params)) {
    if (k === "callback" || k === "tempoVerificationToken") continue;
    fieldName = k;
    fieldValue = v;
    break;
  }

  let values = [];

  switch (fieldName) {
    case "firstAttr":
      try {
        const accountName = (await getTempoAccountName(fieldValue))?.trim().toLowerCase();
        if (!accountName) break;

        const jiraFields = await getAllJiraFields();
        const matchingField = jiraFields.find(f => decodeHTML(f.name.trim().toLowerCase()) === accountName);
        if (!matchingField) break;

        const contexts = await getJiraFieldContexts(matchingField.id);
        for (const ctx of contexts) {
          const options = await getContextOptions(matchingField.id, ctx.id);
          if (options.length > 0) {
            values = options.map(opt => ({
              key: decodeHTML(opt.value || ""),
              value: decodeHTML(opt.value || "")
            }));
            break;
          }
        }
      } catch (err) {
        console.error("Error fetching Jira options for firstAttr:", err.message);
      }
      break;

    case "secondAttr":
      try {
        const accountName = (await getTempoAccountName(fieldValue))?.trim().toLowerCase();
        if (!accountName) break;

        const jiraFields = await getAllJiraFields();
        const matchingField = jiraFields.find(f => decodeHTML(f.name.trim().toLowerCase()) === accountName);
        if (!matchingField) break;

        const contexts = await getJiraFieldContexts(matchingField.id);
        for (const ctx of contexts) {
          const options = await getContextOptions(matchingField.id, ctx.id);
          if (options.length > 0) {
            values = options.map(opt => ({
              key: decodeHTML(opt.value || ""),
              value: decodeHTML(opt.value || "")
            }));
            break;
          }
        }
      } catch (err) {
        console.error("Error fetching Jira options for secondAttr:", err.message);
      }
      break;

    default:
      // Fallback options if fieldName not recognized
      values = [
        { key: "1", value: "Category 1" },
        { key: "2", value: "Category 2" },
        { key: "3", value: "Category 3" }
      ];
  }

  // Return JSONP with key Task1 for frontend dropdown
  const response = `${callback}(${JSON.stringify({ Task1: values })})`;
  res.setHeader("Content-Type", "application/javascript");
  res.status(200).send(response);
});

// ====== Start Server ======
const PORT = 3000;
app.listen(PORT, () => console.log(`Tempo dropdown API running on port ${PORT}`));