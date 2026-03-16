const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;

/* Account UUID → Jira Field */
const accountFieldMap = {
  "f934440e-1edd-4789-9464-de5027b5acd2": "PS"
};

/* Decode helper */
function decodeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/* Fetch Jira fields */
async function getJiraFields() {

  const res = await axios.get(
    `${JIRA_DOMAIN}/rest/api/3/field/search`,
    {
      auth: { username: EMAIL, password: API_TOKEN },
      headers: { Accept: "application/json" }
    }
  );

  return res.data.values;
}

/* Get Jira options */
async function getFieldOptions(fieldId) {

  const ctx = await axios.get(
    `${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context`,
    {
      auth: { username: EMAIL, password: API_TOKEN }
    }
  );

  const contextId = ctx.data.values[0].id;

  const opt = await axios.get(
    `${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context/${contextId}/option`,
    {
      auth: { username: EMAIL, password: API_TOKEN }
    }
  );

  return opt.data.values.map(o => ({
    key: o.id,
    value: decodeHTML(o.value)
  }));
}

/* Main API */
app.get("/tasks", async (req, res) => {

  const params = req.query;

  if (params.tempoVerificationToken) {
    res.setHeader("X-Tempo-Verification-Token", params.tempoVerificationToken);
    return res.status(200).send("verified");
  }

  const callback = params.callback || "fn";

  const uuid = params.firstAttr;

  let values = [];

  try {

    const jiraFieldName = accountFieldMap[uuid];

    if (jiraFieldName) {

      const fields = await getJiraFields();

      const field = fields.find(f =>
        f.name.toLowerCase() === jiraFieldName.toLowerCase()
      );

      if (field) {
        values = await getFieldOptions(field.id);
      }

    }

  } catch (err) {
    console.error(err.message);
  }

  const response = `${callback}(${JSON.stringify({ values })})`;

  res.setHeader("Content-Type", "application/javascript");
  res.send(response);

});

app.listen(3000, () => {
  console.log("Tempo dropdown API running");
});