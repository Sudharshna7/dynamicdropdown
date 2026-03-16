const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;
const TEMPO_BEARER_TOKEN = process.env.TEMPO_BEARER_TOKEN;

// Decode HTML entities
function decodeHTML(str) {
  if (!str) return "";
  return str.replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
}

// Fetch all Jira fields
async function getAllJiraFields() {
  let startAt = 0, allFields = [];
  const maxResults = 100;
  let total = 0;

  do {
    const res = await axios.get(
      `${JIRA_DOMAIN}/rest/api/3/field/search?startAt=${startAt}&maxResults=${maxResults}`,
      { auth: { username: EMAIL, password: API_TOKEN }, headers: { Accept: "application/json" } }
    );
    allFields = allFields.concat(res.data.values);
    total = res.data.total;
    startAt += res.data.values.length;
  } while (startAt < total);

  return allFields;
}

// Get contexts
async function getJiraFieldContexts(fieldId) {
  const res = await axios.get(`${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context`, {
    auth: { username: EMAIL, password: API_TOKEN },
    headers: { Accept: "application/json" },
  });
  return res.data.values || [];
}

// Get options
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

// Main endpoint
app.get("/tasks", async (req, res) => {
  const params = req.query;

  if (params.tempoVerificationToken) {
    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("Tempo verification token received");
  }

  const callback = params.callback || "fn";

  // Grab the selected Account1 UUID
  const account1Uuid = params.Account1 || params.firstAttr; // fallback if you used firstAttr
  let values = [];

  if (account1Uuid) {
    try {
      // Step 1: UUID → friendly name
      const accountName = (await getTempoAccountName(account1Uuid))?.trim().toLowerCase();

      if (accountName) {
        // Step 2: Find Jira custom field matching this Account name
        const jiraFields = await getAllJiraFields();
        const matchingField = jiraFields.find(f => decodeHTML(f.name.trim().toLowerCase()) === accountName);

        if (matchingField) {
          const fieldId = matchingField.id;
          const contexts = await getJiraFieldContexts(fieldId);

          // Step 3: Use first context with options
          for (const ctx of contexts) {
            const options = await getContextOptions(fieldId, ctx.id);
            if (options.length > 0) {
              values = options.map(opt => ({
                key: decodeHTML(opt.value || ""),
                value: decodeHTML(opt.value || "")
              }));
              break;
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching Jira options:", err.message);
    }
  }

  // Step 4: Return JSONP keyed by Task1
  const response = `${callback}(${JSON.stringify({ Task1: values })})`;
  res.setHeader("Content-Type", "application/javascript");
  res.status(200).send(response);
});

app.listen(3000, () => console.log("Tempo dropdown API running on port 3000"));