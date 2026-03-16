const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;

// Helpers to get fields, contexts, options
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

app.get("/tasks", async (req, res) => {
  const params = req.query;

  if (params.tempoVerificationToken) {
    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("Tempo verification token received");
  }

  const callback = params.callback || "fn";

  // Assuming first query param is the Account1 attribute
  let account1Value;
  for (const [k, v] of Object.entries(params)) {
    if (k === "callback" || k === "tempoVerificationToken") continue;
    account1Value = v;
    break;
  }

  let values = [];

  try {
    if (account1Value) {
      // Step 1: Find Jira custom field whose name matches the selected Account1 value
      const jiraFields = await getJiraCustomFields();

      const matchingField = jiraFields.find(f => f.name.toLowerCase() === account1Value.toLowerCase());

      if (!matchingField) {
        console.warn(`No Jira custom field found named '${account1Value}'`);
      } else {
        const fieldId = matchingField.id;

        // Step 2: Get contexts for this field
        const contexts = await getJiraFieldContexts(fieldId);

        if (contexts.length === 0) {
          console.warn(`No contexts found for Jira field '${fieldId}'`);
        } else {
          // Step 3: Pick first context (or enhance logic if needed)
          const context = contexts[0];

          // Step 4: Get options from context
          const options = await getContextOptions(fieldId, context.id);

          // Step 5: Map to key/value for Tempo dropdown
          values = options.map(opt => ({
            key: opt.value,
            value: opt.value
          }));
        }
      }
    }
  } catch (error) {
    console.error("Error fetching Jira options:", error.message);
  }

  const response = `${callback}(${JSON.stringify({ values })})`;
  res.setHeader("Content-Type", "application/javascript");
  res.status(200).send(response);
});

app.listen(3000, () => {
  console.log("Tempo dropdown API running on port 3000");
});