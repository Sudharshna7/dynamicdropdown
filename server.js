const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

const JIRA_DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const API_TOKEN = process.env.JIRA_API_TOKEN;

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
    if (fieldName === "firstAttr") {
      // Map fieldValue to Jira context ID
      let contextId;
      switch (fieldValue) {
        case "f2d236ad-b8a8-42f3-aed4-e46b6d81288c":
          contextId = "10909"; // context for Agile Ceremonies / New Feature
          break;
        case "3f3c1a34-a76e-45b1-87ca-063dbe62d44b":
          contextId = "10910"; // context for Defect Resolution / Post Deployment
          break;
        case "f934440e-1edd-4789-9464-de5027b5acd2":
          contextId = "10911"; // context for Concept & Release / Testing
          break;
        default:
          contextId = null;
      }

      if (contextId) {
        const response = await axios.get(
          `${JIRA_DOMAIN}/rest/api/3/field/customfield_10608/context/${contextId}/option`,
          {
            auth: {
              username: EMAIL,
              password: API_TOKEN
            },
            headers: { Accept: "application/json" }
          }
        );

        values = response.data.values.map(opt => ({
          key: opt.value,
          value: opt.value
        }));
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