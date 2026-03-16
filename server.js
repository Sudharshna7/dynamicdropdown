const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;
const TEMPO_BEARER_TOKEN = process.env.TEMPO_BEARER_TOKEN;

// Decode HTML entities (e.g., &amp; -> &)
function decodeHTML(str) {
  return str.replace(/&amp;/g, "&");
}

// Fetch all Jira fields using paging
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

    const data = res.data;
    allFields = allFields.concat(data.values);
    total = data.total;
    startAt += data.values.length;

    console.log(`Fetched ${data.values.length} fields (startAt=${startAt})`);
  } while (startAt < total);

  console.log(`Total Jira fields fetched: ${allFields.length}`);
  return allFields;
}

// Get contexts for a Jira custom field
async function getJiraFieldContexts(fieldId) {
  const res = await axios.get(`${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context`, {
    auth: { username: EMAIL, password: API_TOKEN },
    headers: { Accept: "application/json" },
  });

  console.log(`Fetched ${res.data.values.length} contexts for field ${fieldId}`);
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

  console.log(`Fetched ${res.data.values.length} options for field ${fieldId}, context ${contextId}`);
  return res.data.values || [];
}

// Get friendly name from Tempo UUID
async function getTempoAccountName(uuid) {
  try {
    const res = await axios.get("https://api.tempo.io/4/work-attributes/_Account1_", {
      headers: { Authorization: `Bearer ${TEMPO_BEARER_TOKEN}` },
    });
    const names = res.data.names;
    console.log("Tempo names mapping fetched:", names);
    return names[uuid]; // e.g., "PS", "R&D"
  } catch (err) {
    console.error("Error fetching Tempo Account1 mapping:", err.message);
    return null;
  }
}

app.get("/tasks", async (req, res) => {
  const params = req.query;

  // Tempo verification
  if (params.tempoVerificationToken) {
    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("Tempo verification token received");
  }

  const callback = params.callback || "fn";

  // Get first query param as Account1 UUID
  let account1Uuid;
  for (const [k, v] of Object.entries(params)) {
    if (k === "callback" || k === "tempoVerificationToken") continue;
    account1Uuid = v;
    break;
  }

  let values = [];

  try {
    if (account1Uuid) {
      console.log("Received Tempo UUID:", account1Uuid);

      // Step 1: Convert UUID to friendly name using Tempo API
      let accountName = await getTempoAccountName(account1Uuid);
      if (!accountName) {
        console.warn(`No Tempo name found for UUID ${account1Uuid}`);
      } else {
        console.log("Tempo UUID mapped to friendly name:", accountName);

        accountName = decodeHTML(accountName.trim().toLowerCase());

        // Step 2: Fetch all Jira fields (paged)
        const jiraFields = await getAllJiraFields();

        // Step 3: Find Jira custom field matching the Tempo-friendly name
        const matchingField = jiraFields.find(
          (f) => decodeHTML(f.name.trim().toLowerCase()) === accountName
        );

        if (!matchingField) {
          console.warn(`No Jira custom field found named '${accountName}'`);
        } else {
          console.log("Matching Jira field found:", matchingField);
          const fieldId = matchingField.id;

          // Step 4: Get contexts for the Jira field
          const contexts = await getJiraFieldContexts(fieldId);

          let contextWithOptions = null;

          // Step 5: Find the first context that has options
          for (const ctx of contexts) {
            const options = await getContextOptions(fieldId, ctx.id);
            if (options.length > 0) {
              contextWithOptions = { ctx, options };
              break;
            }
          }

          if (contextWithOptions) {
            console.log("Context with options found:", contextWithOptions.ctx);
            console.log("Options:", contextWithOptions.options.map((o) => o.value));
            values = contextWithOptions.options.map((opt) => ({
              key: opt.value,
              value: opt.value,
            }));
          } else {
            console.warn(`No options found in any context for Jira field '${fieldId}'`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error fetching Jira options dynamically:", error.message);
  }

  const response = `${callback}(${JSON.stringify({ values })})`;
  res.setHeader("Content-Type", "application/javascript");
  res.status(200).send(response);
});

app.listen(3000, () => {
  console.log("Tempo dropdown API running on port 3000");
});