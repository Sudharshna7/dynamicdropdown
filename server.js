const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;
const TEMPO_BEARER_TOKEN = process.env.TEMPO_BEARER_TOKEN;

// Decode HTML entities (e.g., &amp; → &)
function decodeHTML(str) {
  if (!str) return "";
  return str.replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
}

// Fetch all Jira fields with pagination
async function getAllJiraFields() {
  let startAt = 0;
  const maxResults = 100;
  let allFields = [];
  let total = 0;

  do {
    const res = await axios.get(
      `${JIRA_DOMAIN}/rest/api/3/field/search?startAt=${startAt}&maxResults=${maxResults}`,
      {
        auth: { username: EMAIL, password: API_TOKEN },
        headers: { Accept: "application/json" },
      }
    );

    allFields = allFields.concat(res.data.values);
    total = res.data.total;
    startAt += res.data.values.length;
  } while (startAt < total);

  return allFields;
}

// Get contexts for a Jira custom field
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
    {
      auth: { username: EMAIL, password: API_TOKEN },
      headers: { Accept: "application/json" },
    }
  );
  return res.data.values || [];
}

// Map Tempo UUID -> friendly name
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

// Main endpoint
app.get("/tasks", async (req, res) => {
  const params = req.query;

  // Tempo verification token
  if (params.tempoVerificationToken) {
    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("Tempo verification token received");
  }

  const callback = params.callback || "fn";

  // Capture the original Tempo attribute key and UUID
  let fieldKey = null;
  let account1Uuid = null;
  for (const [k, v] of Object.entries(params)) {
    if (k === "callback" || k === "tempoVerificationToken") continue;
    fieldKey = k;
    account1Uuid = v;
    break;
  }

  let values = [];

  try {
    if (account1Uuid && fieldKey) {
      // Step 1: Tempo UUID -> friendly name
      let accountName = await getTempoAccountName(account1Uuid);
      if (accountName) {
        accountName = decodeHTML(accountName.trim().toLowerCase());

        // Step 2: Fetch all Jira fields
        const jiraFields = await getAllJiraFields();

        // Step 3: Match Jira custom field by name
        const matchingField = jiraFields.find(
          (f) => decodeHTML(f.name.trim().toLowerCase()) === accountName
        );

        if (matchingField) {
          const fieldId = matchingField.id;

          // Step 4: Get contexts
          const contexts = await getJiraFieldContexts(fieldId);

          // Step 5: Find first context with options
          for (const ctx of contexts) {
            const options = await getContextOptions(fieldId, ctx.id);
            if (options.length > 0) {
              values = options.map((opt) => ({
                key: decodeHTML(opt.value || ""),
                value: decodeHTML(opt.value || ""),
              }));
              break;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error fetching Jira options dynamically:", error.message);
  }

  // Return JSONP keyed by the original Tempo attribute
  const response = `${callback}(${JSON.stringify({ [fieldKey]: values })})`;
  res.setHeader("Content-Type", "application/javascript");
  res.status(200).send(response);
});

app.listen(3000, () => {
  console.log("Tempo dropdown API running on port 3000");
});