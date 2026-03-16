const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

/* ===============================
   ENV VARIABLES
================================ */
const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;
const TEMPO_TOKEN = process.env.TEMPO_BEARER_TOKEN;

/* ===============================
   CACHE
================================ */
let cachedFields = null;
let cachedOptions = {};

/* ===============================
   HELPERS
================================ */
function decodeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/* ===============================
   GET JIRA FIELDS (CACHED)
================================ */
async function getJiraFields() {

  if (cachedFields) {
    console.log("Using cached Jira fields");
    return cachedFields;
  }

  const res = await axios.get(
    `${JIRA_DOMAIN}/rest/api/3/field/search`,
    {
      auth: { username: EMAIL, password: API_TOKEN },
      headers: { Accept: "application/json" }
    }
  );

  cachedFields = res.data.values;
  console.log("Jira fields cached");

  return cachedFields;
}

/* ===============================
   GET JIRA OPTIONS (CACHED)
================================ */
async function getJiraOptions(fieldId) {

  if (cachedOptions[fieldId]) {
    console.log("Using cached options");
    return cachedOptions[fieldId];
  }

  const ctx = await axios.get(
    `${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context`,
    {
      auth: { username: EMAIL, password: API_TOKEN },
      headers: { Accept: "application/json" }
    }
  );

  const contextId = ctx.data.values[0].id;

  const opt = await axios.get(
    `${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context/${contextId}/option`,
    {
      auth: { username: EMAIL, password: API_TOKEN },
      headers: { Accept: "application/json" }
    }
  );

  const values = opt.data.values.map(o => ({
    id: decodeHTML(o.value),
    label: decodeHTML(o.value)
  }));

  cachedOptions[fieldId] = values;

  return values;
}

/* ===============================
   GET TEMPO ACCOUNT NAME
================================ */
async function getTempoAccountName(uuid) {

  const res = await axios.get(
    "https://api.tempo.io/4/work-attributes/_Account1_",
    {
      headers: { Authorization: `Bearer ${TEMPO_TOKEN}` }
    }
  );

  return res.data.names[uuid]?.toLowerCase();
}

/* ===============================
   MAIN ENDPOINT
================================ */
app.get("/tasks", async (req, res) => {

  const params = req.query;

  /* Tempo verification */
  if (params.tempoVerificationToken) {
    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("Verified");
  }

  const callback = params.callback || "fn";

  let fieldValue;

  for (const [k, v] of Object.entries(params)) {
    if (k !== "callback") {
      fieldValue = v;
      break;
    }
  }

  let values = [];

  try {

    if (fieldValue) {

      console.log("Tempo UUID:", fieldValue);

      /* Get Tempo Account Name */
      const accountName = await getTempoAccountName(fieldValue);

      console.log("Account:", accountName);

      /* Find Jira Field */
      const fields = await getJiraFields();

      const jiraField = fields.find(
        f => f.name.toLowerCase() === accountName
      );

      if (jiraField) {

        console.log("Matching Jira Field:", jiraField.name);

        values = await getJiraOptions(jiraField.id);

      } else {
        console.log("No matching Jira field");
      }

    }

  } catch (err) {
    console.error("Error:", err.message);
  }

  const response = `${callback}(${JSON.stringify({ values })})`;

  res.setHeader("Content-Type", "application/javascript");
  res.status(200).send(response);

});

/* ===============================
   START SERVER
================================ */
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Tempo dropdown API running on ${PORT}`);
});