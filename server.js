const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;
const TEMPO_BEARER_TOKEN = process.env.TEMPO_BEARER_TOKEN;

// Helpers to get Jira fields, contexts, options
async function getJiraCustomFields() {
  const res = await axios.get(`${JIRA_DOMAIN}/rest/api/3/field`, {
    auth: { username: EMAIL, password: API_TOKEN },
    headers: { Accept: "application/json" }
  });
  return res.data;
}

async function getJiraFieldContexts(fieldId) {
  const res = await axios.get(`${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context`, {
    auth: { username: EMAIL, password: API_TOKEN },
    headers: { Accept: "application/json" }
  });
  return res.data.values || [];
}

async function getContextOptions(fieldId, contextId) {
  const res = await axios.get(`${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context/${contextId}/option`, {
    auth: { username: EMAIL, password: API_TOKEN },
    headers: { Accept: "application/json" }
  });
  return res.data.values || [];
}

// Helper to get Tempo Account1 UUID → name mapping
async function getTempoAccountName(uuid) {
  try {
    const res = await axios.get("https://api.tempo.io/4/work-attributes/_Account1_", {
      headers: { Authorization: `Bearer ${TEMPO_BEARER_TOKEN}` }
    });
    const names = res.data.names;
    return names[uuid]; // returns "PS", "R&D", etc.
  } catch (err) {
    console.error("Error fetching Tempo Account1 mapping:", err.message);
    return null;
  }
}

app.get("/tasks", async (req, res) => {
  const params = req.query;

  if (params.tempoVerificationToken) {
    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("Tempo verification token received");
  }

  const callback = params.callback || "fn";

  // Extract first query param as Account1 UUID
  let account1Uuid;
  for (const [k, v] of Object.entries(params)) {
    if (k === "callback" || k === "tempoVerificationToken") continue;
    account1Uuid = v;
    break;
  }

  let values = [];

  try {
    if (account1Uuid) {
      // Step 1: Get the friendly name from Tempo
      const accountName = await getTempoAccountName(account1Uuid);

      if (!accountName) {
        console.warn(`No Tempo name found for UUID ${account1Uuid}`);
      } else {
        // Step 2: Find Jira custom field with this name
        const jiraFields = await getJiraCustomFields();
        const matchingField = jiraFields.find(f => f.name.toLowerCase() === accountName.toLowerCase());

        if (!matchingField) {
          console.warn(`No Jira custom field found named '${accountName}'`);
        } else {
          const fieldId = matchingField.id;

          // Step 3: Get contexts for the Jira field
          const contexts = await getJiraFieldContexts(fieldId);

          if (contexts.length === 0) {
            console.warn(`No contexts found for Jira field '${fieldId}'`);
          } else {
            // Step 4: Pick first context (you can refine selection by project)
            const context = contexts[0];

            // Step 5: Get options from Jira
            const options = await getContextOptions(fieldId, context.id);

            values = options.map(opt => ({ key: opt.value, value: opt.value }));
          }
        }
      }
    }
  } catch (error) {
    console.error("Error fetching options dynamically:", error.message);
  }

  const response = `${callback}(${JSON.stringify({ values })})`;
  res.setHeader("Content-Type", "application/javascript");
  res.status(200).send(response);
});

app.listen(3000, () => {
  console.log("Tempo dropdown API running on port 3000");
});