const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

// ===== ENV =====
const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;
const TEMPO_BEARER_TOKEN = process.env.TEMPO_BEARER_TOKEN;

// ===== CACHE =====
const fieldCache = {};       // accountName -> fieldId
const optionsCache = {};     // fieldId -> dropdown options

// ===== Decode HTML =====
function decodeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ===== Fetch ALL Jira Fields (only once) =====
async function getAllJiraFields() {
  let startAt = 0;
  let total = 0;
  let allFields = [];
  const maxResults = 100;

  do {
    const res = await axios.get(
      `${JIRA_DOMAIN}/rest/api/3/field/search?startAt=${startAt}&maxResults=${maxResults}`,
      {
        auth: { username: EMAIL, password: API_TOKEN },
        headers: { Accept: "application/json" }
      }
    );

    allFields = allFields.concat(res.data.values);
    total = res.data.total;
    startAt += res.data.values.length;

  } while (startAt < total);

  console.log("Total Jira fields fetched:", allFields.length);
  return allFields;
}

// ===== Get Jira Field ID from name =====
async function getJiraFieldId(accountName) {

  if (fieldCache[accountName]) {
    return fieldCache[accountName];
  }

  const jiraFields = await getAllJiraFields();

  const matchingField = jiraFields.find(
    f => decodeHTML(f.name.trim().toLowerCase()) === accountName
  );

  if (!matchingField) return null;

  fieldCache[accountName] = matchingField.id;

  console.log("Cached Jira field:", matchingField.name);

  return matchingField.id;
}

// ===== Get Field Contexts =====
async function getFieldContexts(fieldId) {

  const res = await axios.get(
    `${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context`,
    {
      auth: { username: EMAIL, password: API_TOKEN },
      headers: { Accept: "application/json" }
    }
  );

  return res.data.values || [];
}

// ===== Get Options =====
async function getContextOptions(fieldId, contextId) {

  const res = await axios.get(
    `${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context/${contextId}/option`,
    {
      auth: { username: EMAIL, password: API_TOKEN },
      headers: { Accept: "application/json" }
    }
  );

  return res.data.values || [];
}

// ===== Fetch Jira Options (cached) =====
async function getJiraOptions(fieldId) {

  if (optionsCache[fieldId]) {
    return optionsCache[fieldId];
  }

  const contexts = await getFieldContexts(fieldId);

  for (const ctx of contexts) {

    const options = await getContextOptions(fieldId, ctx.id);

    if (options.length > 0) {

      const formatted = options.map(opt => ({
        key: decodeHTML(opt.value || ""),
        value: decodeHTML(opt.value || "")
      }));

      optionsCache[fieldId] = formatted;

      console.log("Cached options:", formatted.map(o => o.value));

      return formatted;
    }
  }

  return [];
}

// ===== Tempo UUID -> Account Name =====
async function getTempoAccountName(uuid) {

  try {

    const res = await axios.get(
      "https://api.tempo.io/4/work-attributes/_Account1_",
      {
        headers: { Authorization: `Bearer ${TEMPO_BEARER_TOKEN}` }
      }
    );

    return res.data.names[uuid];

  } catch (err) {

    console.error("Tempo API error:", err.message);
    return null;

  }
}

// ===== MAIN API =====
app.get("/tasks", async (req, res) => {

  console.time("API_RESPONSE_TIME");

  const params = req.query;
  console.log("Incoming request params:", params);

  // Tempo verification
  if (params.tempoVerificationToken) {

    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("Tempo verification successful");

  }

  const callback = params.callback || "fn";

  let fieldName, fieldValue;

  for (const [k, v] of Object.entries(params)) {

    if (k === "callback" || k === "tempoVerificationToken") continue;

    fieldName = k;
    fieldValue = v;
    break;

  }

  console.log("Field:", fieldName, "Value:", fieldValue);

  let values = [];

  if (fieldName === "firstAttr") {

    try {

      const accountName = (await getTempoAccountName(fieldValue))?.trim().toLowerCase();

      console.log("Tempo account:", accountName);

      if (!accountName) throw new Error("Account name not found");

      const fieldId = await getJiraFieldId(accountName);

      if (!fieldId) throw new Error("Jira field not found");

      values = await getJiraOptions(fieldId);

    } catch (err) {

      console.error("Error:", err.message);

    }

  }

  const response = `${callback}(${JSON.stringify({ values })})`;

  res.setHeader("Content-Type", "application/javascript");

  res.status(200).send(response);

  console.timeEnd("API_RESPONSE_TIME");

});

// ===== START SERVER =====
const PORT = 3000;

app.listen(PORT, () => {

  console.log(`Tempo dropdown API running on port ${PORT}`);

});