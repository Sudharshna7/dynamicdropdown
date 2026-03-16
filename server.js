const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;

// Utility to get all custom fields
async function getCustomFields() {
  const response = await axios.get(`${JIRA_DOMAIN}/rest/api/3/field`, {
    auth: { username: EMAIL, password: API_TOKEN },
    headers: { Accept: "application/json" }
  });
  return response.data;
}

// Utility to get all contexts for a custom field
async function getCustomFieldContexts(fieldId) {
  const response = await axios.get(`${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context`, {
    auth: { username: EMAIL, password: API_TOKEN },
    headers: { Accept: "application/json" }
  });
  return response.data.values || [];
}

// Utility to get options for a context
async function getContextOptions(fieldId, contextId) {
  const response = await axios.get(`${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context/${contextId}/option`, {
    auth: { username: EMAIL, password: API_TOKEN },
    headers: { Accept: "application/json" }
  });
  return response.data.values || [];
}

app.get("/tasks", async (req, res) => {
  const params = req.query;

  // Tempo verification
  if (params.tempoVerificationToken) {
    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("Tempo verification token received");
  }

  const callback = params.callback || "fn";

  let fieldName, fieldValue;
  for (const [k, v] of Object.entries(params)) {
    if (k === "callback" || k === "tempoVerificationToken") continue;
    fieldName = k;
    fieldValue = v;
    break;
  }

  let values = [];

  try {
    if (fieldName === "firstAttr" && fieldValue) {
      // 1. Get all custom fields
      const fields = await getCustomFields();

      // 2. Find the custom field that matches this Tempo selection
      //    You need some mapping rule here. For example, maybe the custom field name contains the fieldValue
      const matchingField = fields.find(f => f.name.toLowerCase().includes(fieldValue.toLowerCase()));

      if (matchingField) {
        const fieldId = matchingField.id;

        // 3. Get all contexts for this custom field
        const contexts = await getCustomFieldContexts(fieldId);

        // 4. Pick a context (you could choose first, or filter by something)
        const context = contexts[0]; // adjust this logic if needed

        if (context) {
          // 5. Get options for this context
          const options = await getContextOptions(fieldId, context.id);

          values = options.map(opt => ({ key: opt.value, value: opt.value }));
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