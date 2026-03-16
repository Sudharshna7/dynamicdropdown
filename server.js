const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;

// Helper: Get all Jira custom fields
async function getJiraCustomFields() {
  const res = await axios.get(`${JIRA_DOMAIN}/rest/api/3/field`, {
    auth: { username: EMAIL, password: API_TOKEN },
    headers: { Accept: "application/json" }
  });
  return res.data;
}

// Helper: Get contexts for a Jira custom field
async function getJiraFieldContexts(fieldId) {
  const res = await axios.get(`${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context`, {
    auth: { username: EMAIL, password: API_TOKEN },
    headers: { Accept: "application/json" }
  });
  return res.data.values || [];
}

// Helper: Get options for a Jira custom field context
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

  // Extract the fieldName and fieldValue from query params (skip known params)
  let fieldName, fieldValue;
  for (const [k, v] of Object.entries(params)) {
    if (k === "callback" || k === "tempoVerificationToken") continue;
    fieldName = k;
    fieldValue = v;
    break;
  }

  let values = [];

  try {
    if (fieldName && fieldValue) {
      // Step 1: Find Jira custom field by matching the fieldName with Jira custom field name
      // Adjust matching logic if needed (e.g., ignore case, prefix "Account1" etc.)
      const jiraFields = await getJiraCustomFields();

      // Match field by name exactly or by some heuristic
      const matchingField = jiraFields.find(f => f.name.toLowerCase() === fieldName.toLowerCase());
      if (!matchingField) {
        console.warn(`No matching Jira custom field found for '${fieldName}'`);
      } else {
        const fieldId = matchingField.id;

        // Step 2: Get contexts for this custom field
        const contexts = await getJiraFieldContexts(fieldId);
        if (contexts.length === 0) {
          console.warn(`No contexts found for Jira field '${fieldId}'`);
        } else {
          // Step 3: Pick a context
          // TODO: Improve logic to select context based on project or other criteria
          const context = contexts[0];

          // Step 4: Fetch options for the chosen context
          const options = await getContextOptions(fieldId, context.id);

          // Step 5: Filter options if needed (optional, if you want to filter based on fieldValue)
          // Here, just return all options for the context
          values = options.map(opt => ({
            key: opt.value,
            value: opt.value
          }));
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