const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;

app.get("/tasks", async (req, res) => {

  const params = req.query;

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

    if (fieldName === "firstAttr") {

      const response = await axios.get(
        `${JIRA_DOMAIN}/rest/api/3/field/customfield_10608/context/10909/option`,
        {
          auth: {
            username: EMAIL,
            password: API_TOKEN
          },
          headers: {
            Accept: "application/json"
          }
        }
      );

      const jiraOptions = response.data.values;

      values = jiraOptions.map(opt => ({
        key: opt.value,
        value: opt.value
      }));

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